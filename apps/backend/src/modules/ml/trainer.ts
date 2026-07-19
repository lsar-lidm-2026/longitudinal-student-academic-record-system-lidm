/**
 * trainer.ts
 * 
 * Cara kerja file ini:
 * - ML Trainer — melatih model unsupervised learning yang legitimate.
 * - Saat ini hanya melatih K-Means clustering untuk behavior clustering siswa.
 * - Tidak lagi melatih model supervised (risk classification, trend prediction)
 *   karena sudah digantikan oleh rule-based scoring dan per-student regression.
 * - Hasil training di-cache in-memory dan dipersist ke database + file ONNX.
 * 
 * Alur lengkap trainModels():
 * 1. Ambil semua student dari DB (minimal 3).
 * 2. Untuk setiap student: computeFeatures() → kumpulkan feature vectors.
 * 3. Jika < 3 student punya fitur valid → return cachedModels (tidak training).
 * 4. Tentukan nilai maksimum per dimensi untuk normalisasi.
 * 5. trainKMeans(clusterVectors, k=3, maxIterations=100).
 * 6. Update cachedModels dengan hasil training + metadata.
 * 7. Export model ke ONNX file (via exportKMeansOnnx).
 * 8. Export juga JSON version (via exportKMeansJson).
 * 9. Upload ONNX ke S3 jika dikonfigurasi.
 * 10. Persist model ke tabel MlModel (Prisma upsert).
 * 11. Hapus model record RISK_CLASSIFICATION dan TREND_PREDICTION yang sudah obsolete.
 * 
 * Fungsi lain:
 * - getModels(): return cached model, auto-train jika belum ada.
 * - retrainModels(): reset cache, lalu trainModels() dari awal.
 * - resetCache(): untuk keperluan testing.
 */

import { prisma } from "../../lib/prisma";
import { computeFeatures } from "./features";
import { trainKMeans, type KMeansResult } from "./models/k-means";
import { exportKMeansOnnx, exportKMeansJson } from "./models/onnx-export";
import { uploadToS3 } from "../../lib/s3";
import { env } from "../../config/env";
import * as fs from "fs";
import type { StudentFeatures } from "./features";
import logger from "../../lib/logger";

/**
 * TrainedModels
 * 
 * Interface untuk hasil training model — berisi model cluster, timestamp, dan metadata.
 */
export interface TrainedModels {
  /** K-Means untuk behavior clustering — dilatih di seluruh siswa */
  clusterModel: KMeansResult | null;
  /** Timestamp kapan terakhir training */
  trainedAt: Date | null;
  /** Metadata training — jumlah siswa, iterasi K-Means, inertia, dll */
  meta: {
    nStudents: number;
    nStudentsWithFeatures: number;
    kmeansIterations: number;
    kmeansInertia: number;
  } | null;
}

/** Cache in-memory untuk model yang sudah di-train — menghindari retrain ulang tiap request */
let cachedModels: TrainedModels = {
  clusterModel: null,
  trainedAt: null,
  meta: null,
};

/**
 * resetCache
 * 
 * Mereset cache model — digunakan dalam testing agar setiap test
 * dimulai dengan state yang bersih.
 */
export function resetCache() {
  logger.info({}, "Resetting cached models");
  cachedModels = { clusterModel: null, trainedAt: null, meta: null };
}

/**
 * getCachedModels — Membaca cache model TANPA trigger training.
 * 
 * Berbeda dengan getModels() yang akan auto-train jika cache kosong,
 * fungsi ini hanya mengembalikan cache apa adanya.
 */
export function getCachedModels(): TrainedModels {
  return cachedModels;
}

/**
 * extractClusterVector
 * 
 * Menormalisasi feature vector siswa ke rentang [0, 1] untuk input K-Means.
 * Setiap fitur dibagi dengan nilai maksimumnya (atau minimum threshold).
 * 
 * @param features - StudentFeatures hasil computeFeatures()
 * @param maxes - Array nilai maksimum per dimensi untuk normalisasi [maxKnowledge, maxSkills, maxAbsence, maxAchievement]
 * @returns Array 4 elemen yang sudah dinormalisasi [0, 1]
 */
function extractClusterVector(
  features: StudentFeatures,
  maxes: number[]
): number[] {
  return [
    // Normalisasi avgKnowledge dengan minimum threshold 100
    features.avgKnowledge / Math.max(maxes[0], 100),
    // Normalisasi avgSkills dengan minimum threshold 100
    features.avgSkills / Math.max(maxes[1], 100),
    // Normalisasi totalAbsence, di-clamp maksimum 1 (min threshold 10)
    Math.min(features.totalAbsence / Math.max(maxes[2], 10), 1),
    // Normalisasi achievementCount, di-clamp maksimum 1 (min threshold 5)
    Math.min(features.achievementCount / Math.max(maxes[3], 5), 1),
  ];
}

/**
 * trainModels
 * 
 * Melatih model ML (K-Means clustering) berdasarkan data seluruh siswa.
 * 1. Ambil semua student → computeFeatures → filter valid.
 * 2. Normalisasi fitur → train K-Means.
 * 3. Update cache → export ONNX/JSON → persist ke DB + S3.
 * 
 * @returns TrainedModels — hasil training (juga tersimpan di cache)
 */
export async function trainModels(): Promise<TrainedModels> {
  logger.info({}, "trainModels called");

  // ── 1. Fetch semua siswa ──
  const students = await prisma.student.findMany({ select: { id: true } });
  if (students.length < 3) {
    logger.warn({ studentCount: students.length }, "Too few students to train clustering model (need >= 3)");
    return cachedModels;
  }

  logger.debug({ studentCount: students.length }, "Students fetched for training");

  // ── 2. Compute features untuk semua siswa ──
  const allFeatures: StudentFeatures[] = [];
  for (const student of students) {
    try {
      const features = await computeFeatures(student.id);
      allFeatures.push(features);
    } catch (err: any) {
      logger.warn({ err, studentId: student.id }, "Skipping student during feature computation for training");
    }
  }

  if (allFeatures.length < 3) {
    logger.warn({ validFeatureCount: allFeatures.length }, "Too few students with features for clustering");
    return cachedModels;
  }

  // ── 3. K-Means Clustering ──
  // Tentukan nilai maksimum per dimensi untuk normalisasi
  const maxes = [
    Math.max(...allFeatures.map((f) => f.avgKnowledge), 100),
    Math.max(...allFeatures.map((f) => f.avgSkills), 100),
    Math.max(...allFeatures.map((f) => f.totalAbsence), 10),
    Math.max(...allFeatures.map((f) => f.achievementCount), 5),
  ];

  // Normalisasi dan latih K-Means dengan k=3, max 100 iterasi
  const clusterVectors = allFeatures.map((f) => extractClusterVector(f, maxes));
  const clusterModel = trainKMeans(clusterVectors, 3, 100);

  const trainedAt = new Date();

  // ── 4. Update cache ──
  cachedModels = {
    clusterModel,
    trainedAt,
    meta: {
      nStudents: students.length,
      nStudentsWithFeatures: allFeatures.length,
      kmeansIterations: clusterModel.iterations,
      kmeansInertia: Math.round(clusterModel.inertia * 100) / 100,
    },
  };

  logger.info(
    {
      nStudents: allFeatures.length,
      iterations: clusterModel.iterations,
      inertia: clusterModel.inertia.toFixed(2),
    },
    "K-Means trained successfully"
  );

  // ── 5. Persist model ke disk & S3 ──
  try {
    if (clusterModel) {
      // Export ke ONNX format
      const onnxExported = exportKMeansOnnx(
        "behavior-cluster",
        clusterModel.centroids,
        ["avgKnowledge", "avgSkills", "totalAbsence", "achievementCount"]
      );

      // Export juga JSON version untuk fallback
      exportKMeansJson(
        "behavior-cluster",
        clusterModel.centroids,
        ["avgKnowledge", "avgSkills", "totalAbsence", "achievementCount"]
      );

      logger.debug({ filePath: onnxExported.filePath }, "ONNX model exported");

      // Upload ke S3 jika dikonfigurasi
      let filePath = onnxExported.filePath;
      if (env.s3Configured() && fs.existsSync(onnxExported.filePath)) {
        try {
          const fileBuffer = fs.readFileSync(onnxExported.filePath);
          const s3Result = await uploadToS3(fileBuffer, "kmeans-model.onnx", "application/octet-stream", "ml-models");
          filePath = s3Result.url;
          logger.info({ s3Url: s3Result.url }, "Model uploaded to S3");
        } catch (s3Err: any) {
          logger.warn({ err: s3Err }, "S3 upload failed, keeping local path");
        }
      }

      // Persist ke tabel MlModel via upsert
      await prisma.mlModel.upsert({
        where: { modelType_version: { modelType: "BEHAVIOR_CLUSTER", version: 1 } },
        update: {
          filePath,
          metrics: onnxExported.metrics as any,
          isActive: true,
          trainedAt,
        },
        create: {
          name: "Behavior Cluster v1",
          modelType: "BEHAVIOR_CLUSTER",
          version: 1,
          filePath,
          metrics: onnxExported.metrics as any,
          featureList: ["avgKnowledge", "avgSkills", "totalAbsence", "achievementCount"],
          isActive: true,
          trainedAt,
        },
      });

      logger.info({}, "Model persisted to database");
    }

    // Hapus model records yang sudah obsolete (RISK_CLASSIFICATION, TREND_PREDICTION)
    // karena kita sudah tidak lagi melatih model supervised
    await prisma.mlModel.deleteMany({
      where: {
        modelType: { in: ["RISK_CLASSIFICATION", "TREND_PREDICTION"] },
      },
    }).catch(() => {
      // Tabel mungkin belum memiliki record tersebut — itu tidak masalah
      logger.debug({}, "No obsolete model records to delete (RISK_CLASSIFICATION, TREND_PREDICTION)");
    });
  } catch (err: any) {
    logger.warn({ err }, "Failed to persist model artifacts");
  }

  logger.info(
    {
      nStudents: cachedModels.meta?.nStudents,
      kmeansInertia: cachedModels.meta?.kmeansInertia,
    },
    "trainModels completed"
  );
  return cachedModels;
}

/**
 * getModels
 * 
 * Mendapatkan model yang sudah di-train. Jika belum ada (cache kosong),
 * otomatis memicu training.
 * 
 * @returns TrainedModels — model yang sudah di-train (atau hasil training baru)
 */
export async function getModels(): Promise<TrainedModels> {
  logger.debug({}, "getModels called");
  if (!cachedModels.trainedAt) {
    logger.info({}, "No cached models found, triggering auto-training");
    await trainModels();
  }
  return cachedModels;
}

/**
 * retrainModels
 * 
 * Retrain model dari awal — mereset cache terlebih dahulu, lalu menjalankan
 * trainModels() untuk menghasilkan model baru.
 * 
 * @returns TrainedModels — hasil retraining
 */
export async function retrainModels(): Promise<TrainedModels> {
  logger.info({}, "retrainModels called — force reset and retrain");
  cachedModels = { clusterModel: null, trainedAt: null, meta: null };
  return trainModels();
}

export type { KMeansResult };

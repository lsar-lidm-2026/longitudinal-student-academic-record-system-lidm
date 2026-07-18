/**
 * ML Trainer — trains ONLY legitimate unsupervised models.
 *
 * What's real:
 * - K-Means clustering → legitimate unsupervised learning on student feature vectors
 *
 * What's NOT here (anymore):
 * - Decision tree for risk classification → was circular (trained on synthetic labels).
 *   Replaced by transparent rule-based scoring (see scoring-engine.ts).
 * - Global trend model → was a fabricated average with no predictive value.
 *   Replaced by per-student linear regression (computed on-the-fly in ml.service.ts).
 *
 * Honest ML > pretending ML.
 */

import { prisma } from "../../lib/prisma";
import { computeFeatures } from "./features";
import { trainKMeans, type KMeansResult } from "./models/k-means";
import { exportKMeansOnnx, exportKMeansJson } from "./models/onnx-export";
import type { StudentFeatures } from "./features";

export interface TrainedModels {
  /** K-Means for behavior clustering — trained across all students */
  clusterModel: KMeansResult | null;
  /** Trained at timestamp */
  trainedAt: Date | null;
  /** Training metadata */
  meta: {
    nStudents: number;
    nStudentsWithFeatures: number;
    kmeansIterations: number;
    kmeansInertia: number;
  } | null;
}

let cachedModels: TrainedModels = {
  clusterModel: null,
  trainedAt: null,
  meta: null,
};

/** Reset cached models — used in tests */
export function resetCache() {
  cachedModels = { clusterModel: null, trainedAt: null, meta: null };
}

/**
 * Extract normalized feature vector for k-means clustering.
 * Normalizes each feature to [0, 1] range.
 */
function extractClusterVector(
  features: StudentFeatures,
  maxes: number[]
): number[] {
  return [
    features.avgKnowledge / Math.max(maxes[0], 100),
    features.avgSkills / Math.max(maxes[1], 100),
    Math.min(features.totalAbsence / Math.max(maxes[2], 10), 1),
    Math.min(features.achievementCount / Math.max(maxes[3], 5), 1),
  ];
}

export async function trainModels(): Promise<TrainedModels> {
  // Fetch all students
  const students = await prisma.student.findMany({ select: { id: true } });
  if (students.length < 3) {
    console.warn("[Analytics] Too few students to train clustering model (need >= 3)");
    return cachedModels;
  }

  // Compute features for all students
  const allFeatures: StudentFeatures[] = [];
  for (const student of students) {
    try {
      const features = await computeFeatures(student.id);
      allFeatures.push(features);
    } catch (err: any) {
      console.warn(`[Analytics] Skipping student ${student.id}: ${err.message}`);
    }
  }

  if (allFeatures.length < 3) {
    console.warn("[Analytics] Too few students with features for clustering");
    return cachedModels;
  }

  // ── K-Means Clustering ──────────────────────────────────────────
  // Find max values for normalization
  const maxes = [
    Math.max(...allFeatures.map((f) => f.avgKnowledge), 100),
    Math.max(...allFeatures.map((f) => f.avgSkills), 100),
    Math.max(...allFeatures.map((f) => f.totalAbsence), 10),
    Math.max(...allFeatures.map((f) => f.achievementCount), 5),
  ];

  const clusterVectors = allFeatures.map((f) => extractClusterVector(f, maxes));
  const clusterModel = trainKMeans(clusterVectors, 3, 100);

  const trainedAt = new Date();

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

  console.log(`[Analytics] K-Means trained on ${allFeatures.length} students (${clusterModel.iterations} iterations, inertia: ${clusterModel.inertia.toFixed(2)})`);

  // ── Persist model to disk ──────────────────────────────────────
  try {
    if (clusterModel) {
      const onnxExported = exportKMeansOnnx(
        "behavior-cluster",
        clusterModel.centroids,
        ["avgKnowledge", "avgSkills", "totalAbsence", "achievementCount"]
      );

      exportKMeansJson(
        "behavior-cluster",
        clusterModel.centroids,
        ["avgKnowledge", "avgSkills", "totalAbsence", "achievementCount"]
      );

      await prisma.mlModel.upsert({
        where: { modelType_version: { modelType: "BEHAVIOR_CLUSTER", version: 1 } },
        update: {
          filePath: onnxExported.filePath,
          metrics: onnxExported.metrics as any,
          isActive: true,
          trainedAt,
        },
        create: {
          name: "Behavior Cluster v1",
          modelType: "BEHAVIOR_CLUSTER",
          version: 1,
          filePath: onnxExported.filePath,
          metrics: onnxExported.metrics as any,
          featureList: ["avgKnowledge", "avgSkills", "totalAbsence", "achievementCount"],
          isActive: true,
          trainedAt,
        },
      });
    }

    // Hapus model records yang nggak valid lagi (RISK_CLASSIFICATION, TREND_PREDICTION)
    // karena kita udah nggak training model supervised
    await prisma.mlModel.deleteMany({
      where: {
        modelType: { in: ["RISK_CLASSIFICATION", "TREND_PREDICTION"] },
      },
    }).catch(() => {}); // might not exist, that's fine
  } catch (err: any) {
    console.warn(`[Analytics] Failed to persist model artifacts: ${err.message}`);
  }

  return cachedModels;
}

/**
 * Get trained models — auto-trains K-Means if not trained yet.
 */
export async function getModels(): Promise<TrainedModels> {
  if (!cachedModels.trainedAt) {
    await trainModels();
  }
  return cachedModels;
}

/**
 * Re-train models (force reset).
 */
export async function retrainModels(): Promise<TrainedModels> {
  cachedModels = { clusterModel: null, trainedAt: null, meta: null };
  return trainModels();
}

export type { KMeansResult };

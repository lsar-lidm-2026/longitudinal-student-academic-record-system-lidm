/**
 * ml.service.ts
 * 
 * Cara kerja file ini:
 * - Service layer untuk fitur machine learning (ML) di LSAR.
 * - Menyediakan fungsi-fungsi yang dipanggil oleh `ml.controller.ts` untuk:
 *   risk assessment, trend prediction, behavior clustering, model management, dan evaluasi.
 * - Menggabungkan beberapa pendekatan: rule-based scoring, linear regression,
 *   K-Means clustering, ONNX Runtime inference, dan LLM Agent untuk explanation.
 * - Semua hasil prediksi di-persist ke tabel `PredictedOutcome` via Prisma upsert.
 * 
 * Alur lengkap:
 * 1. getStudentRisk(studentId):
 *    a. Ambil data student dari DB.
 *    b. computeFeatures() → ekstrak fitur dari riwayat akademik.
 *    c. factorsFromFeatures() → tentukan faktor risiko deskriptif.
 *    d. evaluateRisk() → scoring engine (rule-based, deterministic).
 *    e. analyzeRisk() → LLM Agent untuk explanation (graceful fallback jika gagal).
 *    f. Gabungkan hasil → return { features, risk }.
 *    g. Persist ke PredictedOutcome (upsert).
 * 
 * 2. getClassRisk(classId):
 *    a. Ambil semua siswa dalam kelas.
 *    b. Loop: untuk setiap siswa computeFeatures + evaluateRisk.
 *    c. Sortir berdasarkan score (descending).
 *    d. Return results + summary (kritis/waspada/aman count).
 * 
 * 3. getStudentTrend(studentId):
 *    a. Ambil data student + semester averages dari DB.
 *    b. trainLinearRegression() → hitung slope, R², prediksi semester depan.
 *    c. analyzeTrend() → LLM Agent untuk explanation (graceful fallback).
 *    d. Persist ke PredictedOutcome (upsert).
 *    e. Return { features, trend }.
 * 
 * 4. getClassCluster(classId):
 *    a. Cek apakah cluster model sudah di-train (DB query, tanpa auto-training).
 *    b. Load centroids dari JSON file.
 *    c. Ambil semua siswa dalam kelas.
 *    d. BATCH query semua semester records → hitung fitur per siswa tanpa DB loop.
 *    e. K-Means inference via centroid distance (tanpa ONNX).
 *    f. Agregasi cluster → hitung avgKnowledge & avgAbsence per cluster.
 *    g. explainCluster() → LLM Agent untuk label/deskripsi cluster (graceful fallback).
 *    h. Return { clusters, assignments, profiles }.
 * 
 * 5. getModels() / retrainModels() / evaluateAllModels() / getOutcomes():
 *    - Operasi manajemen model: lihat daftar, retrain, evaluasi, lihat outcome.
 *    - refreshOnnxPaths() dijalankan setelah retrain untuk update cache ONNX.
 */

import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../common/error";
import { computeFeatures } from "./features";
import { getModels as getTrainedModels, retrainModels as retrain } from "./trainer";
import { evaluateRisk } from "./scoring-engine";
import { analyzeRisk, analyzeTrend, explainCluster } from "./agent";
import {
  analyzeFeatures,
  analyzeRiskDistribution,
  evaluateCluster,
  evaluateTrends,
  euclidean,
  type EvaluationReport,
} from "./model-evaluator";
import { clearOnnxCache } from "./onnx-runner";
import { trainLinearRegression } from "./models/linear-regression";
import type { StudentFeatures } from "./features";
import * as fs from "fs";
import * as path from "path";
import { env } from "../../config/env";
import logger from "../../lib/logger";

/**
 * Cache path file ONNX yang aktif — di-refresh setiap kali retrain.
 * Key: modelType (string), Value: filePath atau null jika tidak tersedia.
 */
let onnxPaths: Record<string, string | null> = {};

/**
 * refreshOnnxPaths
 * 
 * Mengambil model ML aktif dari DB yang memiliki filePath valid (file exists),
 * lalu memperbarui cache `onnxPaths`. Juga membersihkan cache ONNX Runtime
 * agar inference menggunakan file terbaru.
 */
async function refreshOnnxPaths() {
  logger.info({}, "Refreshing ONNX file paths cache");

  // Ambil maksimal 3 model aktif terbaru yang punya filePath
  const models = await prisma.mlModel.findMany({
    where: { isActive: true, filePath: { not: null } },
    orderBy: { trainedAt: "desc" },
    take: 3,
  });

  onnxPaths = {};
  for (const m of models) {
    // Validasi keberadaan file fisik sebelum caching
    if (m.filePath && fs.existsSync(m.filePath)) {
      onnxPaths[m.modelType] = m.filePath;
      logger.debug({ modelType: m.modelType, filePath: m.filePath }, "ONNX path cached");
    } else {
      logger.warn({ modelType: m.modelType, filePath: m.filePath }, "ONNX file not found on disk");
    }
  }

  // Bersihkan cache ONNX Runtime agar inference pakai file baru
  clearOnnxCache();
  logger.info({ cachedPaths: Object.keys(onnxPaths).length }, "ONNX paths refreshed");
}

// ============================================================
// Risk Assessment — menggunakan rule-based ScoringEngine yang transparan
// ============================================================

/**
 * factorsFromFeatures
 * 
 * Mengubah fitur-fitur numerik menjadi array string faktor risiko deskriptif.
 * Setiap faktor punya ambang batas (threshold) yang jelas dan terdokumentasi.
 * 
 * @param features - StudentFeatures hasil computeFeatures()
 * @returns Array of string deskripsi faktor risiko
 */
function factorsFromFeatures(features: StudentFeatures): string[] {
  const factors: string[] = [];

  // Faktor 1: Rata-rata nilai rendah (< 70)
  if (features.avgKnowledge < 70) factors.push(`Rata-rata nilai ${features.avgKnowledge.toFixed(0)} (di bawah 70)`);

  // Faktor 2: Volatilitas nilai tinggi (> 15)
  if (features.scoreVolatility > 15) factors.push(`Nilai tidak stabil (volatilitas ${features.scoreVolatility.toFixed(0)})`);

  // Faktor 3: Tren negatif — nilai turun > 10 poin (minimal 2 semester data)
  if (features.semesterCount >= 2 && features.scoreDelta < -10) factors.push(`Nilai turun ${Math.abs(features.scoreDelta).toFixed(0)} poin`);

  // Faktor 4: Rata-rata ketidakhadiran tinggi (> 5 hari/semester)
  const avgAbsence = features.semesterCount > 0 ? features.totalAbsence / features.semesterCount : 0;
  if (avgAbsence > 5) factors.push(`Rata-rata ketidakhadiran ${avgAbsence.toFixed(0)} hari/semester`);

  // Faktor 5: Tidak ada prestasi (minimal 2 semester data)
  if (features.semesterCount >= 2 && features.achievementCount === 0) factors.push("Belum ada prestasi akademik/non-akademik");

  // Jika tidak ada faktor, berikan indikasi aman
  return factors.length > 0 ? factors : ["Tidak ada faktor risiko signifikan"];
}

/**
 * getStudentRisk
 * 
 * Risk assessment untuk satu siswa. Menggabungkan:
 * - Feature extraction dari riwayat akademik
 * - Rule-based scoring (deterministic, transparan)
 * - LLM Agent explanation (opsional, graceful fallback)
 * 
 * Hasil di-persist ke tabel PredictedOutcome via upsert.
 * 
 * @param studentId - ID siswa yang akan di-assess
 * @returns Object { features, risk } — fitur + hasil assessment
 */
export async function getStudentRisk(studentId: string) {
  logger.info({ studentId }, "getStudentRisk called");

  // Ambil data dasar student (nama, kelas)
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, class: { select: { name: true } } },
  });
  if (!student) {
    logger.warn({ studentId }, "Student not found for risk assessment");
    throw new NotFoundError("Student not found");
  }

  // Ekstrak fitur dari seluruh riwayat akademik
  const features = await computeFeatures(studentId);
  const factors = factorsFromFeatures(features);

  // Rule-based risk scoring — transparan, terdokumentasi, tanpa confidence palsu
  const risk = evaluateRisk({
    avgKnowledge: features.avgKnowledge,
    scoreVolatility: features.scoreVolatility,
    totalAbsence: features.totalAbsence,
    scoreDelta: features.scoreDelta,
    semesterCount: features.semesterCount,
    achievementCount: features.achievementCount,
    avgAbsencePerSemester: features.semesterCount > 0 ? features.totalAbsence / features.semesterCount : 0,
  });

  logger.debug({ studentId, riskLevel: risk.level, riskScore: risk.score }, "Rule-based risk computed");

  // LLM Agent explanation (opsional, graceful fallback jika gagal)
  let agentResult = { explanation: "", recommendations: [] as string[] };
  try {
    agentResult = await analyzeRisk(
      {
        name: student.name,
        className: student.class?.name,
        avgKnowledge: features.avgKnowledge,
        scoreVolatility: features.scoreVolatility,
        scoreDelta: features.scoreDelta,
        totalAbsence: features.totalAbsence,
        achievementCount: features.achievementCount,
        semesterCount: features.semesterCount,
      },
      {
        level: risk.level,
        factors: risk.factors.map((f) => f.detail),
        score: risk.score,
      }
    );
  } catch (err: any) {
    logger.warn({ err, studentId }, "LLM risk analysis failed, using fallback recommendations");
  }

  // Susun hasil akhir: level + score + faktor + rekomendasi + AI explanation
  const result = {
    level: risk.level,
    score: risk.score,
    factors: risk.factors.map((f) => f.detail),
    recommendations: agentResult.recommendations.length > 0
      ? agentResult.recommendations
      : risk.factors.map((f) =>
          f.name === "LOW_KNOWLEDGE" ? "Pertimbangkan program remedial atau bimbingan belajar tambahan" :
          f.name === "HIGH_VOLATILITY" ? "Pantau konsistensi belajar dan identifikasi faktor pengganggu" :
          f.name === "HIGH_ABSENCE" ? "Koordinasi dengan orang tua untuk meningkatkan kehadiran" :
          f.name === "NEGATIVE_TREND" ? "Evaluasi metode belajar dan pertimbangkan intervensi dini" :
          f.name === "NO_ACHIEVEMENT" ? "Dorong partisipasi dalam kegiatan akademik/non-akademik" :
          "Pemantauan berkala disarankan"
        ),
    aiExplanation: agentResult.explanation,
  };

  // Persist assessment ke PredictedOutcome via upsert
  await prisma.predictedOutcome.upsert({
    where: {
      studentId_academicYearId_modelType_isActive: {
        studentId,
        academicYearId: features.academicYearId || "",
        modelType: "RISK_CLASSIFICATION",
        isActive: true,
      },
    },
    update: {
      label: risk.level,
      score: risk.score,
      confidence: 1, // deterministic rule-based, selalu 1
      features: { factors: risk.factors } as any,
    },
    create: {
      studentId,
      academicYearId: features.academicYearId || null,
      modelType: "RISK_CLASSIFICATION",
      label: risk.level,
      score: risk.score,
      confidence: 1,
      features: { factors: risk.factors } as any,
    },
  });

  logger.info({ studentId, riskLevel: risk.level }, "getStudentRisk completed");
  return { features, risk: result };
}

// ============================================================
// Class Risk — menilai risiko semua siswa dalam satu kelas
// ============================================================

/**
 * getClassRisk
 * 
 * Risk assessment untuk seluruh siswa dalam satu kelas.
 * Setiap siswa dihitung secara individual, lalu hasilnya diagregasi.
 * 
 * @param classId - ID kelas
 * @returns Object { results, summary } — array hasil per siswa + ringkasan statistik
 */
export async function getClassRisk(classId: string) {
  logger.info({ classId }, "getClassRisk called");

  // Ambil semua siswa dalam kelas
  const students = await prisma.student.findMany({
    where: { classId },
    select: { id: true, name: true },
  });

  logger.debug({ classId, studentCount: students.length }, "Students fetched for class risk");

  // Generic result type untuk setiap siswa
  const results: Array<{
    studentId: string;
    name: string;
    risk: {
      level: string;
      score: number;
      factors: string[];
      recommendations: string[];
    };
    features: Record<string, number>;
    trend: {
      trend: "NAIK" | "STABIL" | "TURUN";
      description: string;
    };
  }> = [];

  // Loop setiap siswa: computeFeatures + evaluateRisk
  for (const student of students) {
    try {
      const features = await computeFeatures(student.id);
      const risk = evaluateRisk({
        avgKnowledge: features.avgKnowledge,
        scoreVolatility: features.scoreVolatility,
        totalAbsence: features.totalAbsence,
        scoreDelta: features.scoreDelta,
        semesterCount: features.semesterCount,
        achievementCount: features.achievementCount,
      });

      results.push({
        studentId: student.id,
        name: student.name,
        risk: {
          level: risk.level,
          score: risk.score,
          factors: risk.factors.map((f) => f.detail),
          recommendations: [],
        },
        features: {
          avgKnowledge: features.avgKnowledge,
          scoreDelta: features.scoreDelta,
          scoreVolatility: features.scoreVolatility,
          totalAbsence: features.totalAbsence,
          achievementCount: features.achievementCount,
          semesterCount: features.semesterCount,
        },
        trend: {
          // Tentukan tren berdasarkan scoreDelta — threshold +/-5
          trend: features.scoreDelta > 5 ? "NAIK" : features.scoreDelta < -5 ? "TURUN" : "STABIL" as "NAIK" | "STABIL" | "TURUN",
          description: features.semesterCount < 2
            ? "Data belum cukup untuk analisis tren"
            : features.scoreDelta > 5
              ? `Nilai meningkat ${features.scoreDelta.toFixed(0)} poin dari semester sebelumnya`
              : features.scoreDelta < -5
                ? `Nilai turun ${Math.abs(features.scoreDelta).toFixed(0)} poin dari semester sebelumnya`
                : "Nilai relatif stabil dibanding semester sebelumnya",
        },
      });
    } catch (err: any) {
      // Skip siswa jika ada error (misal data tidak lengkap)
      logger.warn({ err, studentId: student.id }, "Skipping student for class risk");
    }
  }

  // Sortir descending berdasarkan risk score (paling berisiko di atas)
  results.sort((a, b) => b.risk.score - a.risk.score);

  // Ringkasan statistik
  const summary = {
    total: results.length,
    kritis: results.filter((r) => r.risk.level === "KRITIS").length,
    waspada: results.filter((r) => r.risk.level === "WASPADA").length,
    aman: results.filter((r) => r.risk.level === "AMAN").length,
    // Daftar siswa kritis untuk quick reference
    kritisStudents: results
      .filter((r) => r.risk.level === "KRITIS")
      .map((r) => ({ id: r.studentId, name: r.name, score: r.risk.score })),
  };

  logger.info({ classId, total: summary.total, kritis: summary.kritis }, "getClassRisk completed");
  return { results, summary };
}

// ============================================================
// Trend Prediction — menggunakan Linear Regression dengan R² asli
// ============================================================

/**
 * getSemesterAverages
 * 
 * Menghitung rata-rata nilai knowledge per semester untuk seorang siswa.
 * Data diurutkan berdasarkan tahun ajaran dan semester (ascending).
 * 
 * @param studentId - ID siswa
 * @returns Object { x, y, nPoints } — indeks semester sebagai x, rata-rata nilai sebagai y
 */
async function getSemesterAverages(studentId: string): Promise<{
  x: number[];
  y: number[];
  nPoints: number;
}> {
  // Ambil semua semester records milik siswa, urut ascending
  const records = await prisma.semesterRecord.findMany({
    where: { studentId },
    include: { subjectScores: true },
    orderBy: [{ academicYear: { year: "asc" } }, { semester: "asc" }],
  });

  // Hitung rata-rata knowledgeScore per semester
  const semAvgs = records.map((r) => {
    const scores = r.subjectScores;
    return scores.length > 0
      ? scores.reduce((s, sc) => s + sc.knowledgeScore, 0) / scores.length
      : 0;
  });

  // x = indeks (0, 1, 2, ...), y = rata-rata nilai
  const x = semAvgs.map((_, i) => i);
  const y = semAvgs;

  return { x, y, nPoints: semAvgs.length };
}

/**
 * getStudentTrend
 * 
 * Menganalisis tren akademik seorang siswa menggunakan Linear Regression.
 * - Fitur dihitung via computeFeatures()
 * - Rata-rata per semester dihitung via getSemesterAverages()
 * - trainLinearRegression() menghitung slope, intercept, R², dan prediksi
 * - LLM Agent memberikan explanation (graceful fallback)
 * - Hasil di-persist ke PredictedOutcome
 * 
 * @param studentId - ID siswa
 * @returns Object { features, trend } — fitur + hasil analisis tren
 */
export async function getStudentTrend(studentId: string) {
  logger.info({ studentId }, "getStudentTrend called");

  // Ambil data dasar student
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, name: true },
  });
  if (!student) {
    logger.warn({ studentId }, "Student not found for trend analysis");
    throw new NotFoundError("Student not found");
  }

  // Ekstrak fitur + data semester averages
  const features = await computeFeatures(studentId);
  const { x, y, nPoints } = await getSemesterAverages(studentId);
  const nextSemesterIndex = nPoints;

  // Linear Regression — dihitung on-the-fly, R² asli
  const regression = trainLinearRegression(x, y);
  const nextPrediction = regression.predict(nextSemesterIndex);

  logger.debug({ studentId, slope: regression.slope, rSquared: regression.rSquared, nextPrediction }, "Linear regression computed");

  // Tentukan arah tren berdasarkan slope — threshold +/-2
  const direction: "NAIK" | "STABIL" | "TURUN" =
    regression.slope > 2 ? "NAIK" : regression.slope < -2 ? "TURUN" : "STABIL";

  // LLM Agent explanation (graceful fallback jika gagal)
  let agentResult = { explanation: "" };
  try {
    agentResult = await analyzeTrend(
      {
        name: student.name,
        avgKnowledge: features.avgKnowledge,
        scoreVolatility: features.scoreVolatility,
        scoreDelta: features.scoreDelta,
        totalAbsence: features.totalAbsence,
        achievementCount: features.achievementCount,
        semesterCount: features.semesterCount,
      },
      {
        slope: regression.slope,
        rSquared: regression.rSquared,
        nextPrediction,
        direction,
      }
    );
  } catch (err: any) {
    logger.warn({ err, studentId }, "LLM trend analysis failed, using fallback description");
  }

  // Susun hasil trend
  const trend = {
    trend: direction,
    slope: regression.slope,
    rSquared: regression.rSquared, // R² ASLI, bukan hardcoded
    nextPrediction: Math.round(nextPrediction * 100) / 100,
    description: agentResult.explanation,
  };

  // Persist ke PredictedOutcome — hanya jika academicYearId tersedia
  if (features.academicYearId) {
    await prisma.predictedOutcome.upsert({
      where: {
        studentId_academicYearId_modelType_isActive: {
          studentId,
          academicYearId: features.academicYearId,
          modelType: "TREND_PREDICTION",
          isActive: true,
        },
      },
      update: {
        score: nextPrediction,
        confidence: Math.max(0, regression.rSquared), // R² sebagai confidence proxy
        features: features as any,
      },
      create: {
        studentId,
        academicYearId: features.academicYearId,
        modelType: "TREND_PREDICTION",
        score: nextPrediction,
        confidence: Math.max(0, regression.rSquared),
        features: features as any,
      },
    });
  }

  logger.info({ studentId, trend: direction, rSquared: regression.rSquared }, "getStudentTrend completed");
  return { features, trend };
}

// ============================================================
// Behavior Clustering — menggunakan K-Means (unsupervised learning)
// ============================================================

/**
 * getClassCluster
 * 
 * Mengelompokkan siswa dalam satu kelas berdasarkan perilaku akademik
 * menggunakan K-Means clustering. Inference bisa via ONNX Runtime atau
 * fallback K-Means JS jika ONNX tidak tersedia.
 * 
 * Setiap siswa direpresentasikan sebagai vektor 4 dimensi:
 * [avgKnowledge, avgSkills, totalAbsence, achievementCount]
 * yang sudah dinormalisasi.
 * 
 * @param classId - ID kelas
 * @returns Object { clusters, assignments, profiles } — info cluster per siswa + agregasi
 */
export async function getClassCluster(classId: string) {
  logger.info({ classId }, "getClassCluster called");

  // Cek apakah cluster model sudah di-train — langsung dari DB, tanpa auto-training
  const clusterModelDb = await prisma.mlModel.findFirst({
    where: { modelType: "BEHAVIOR_CLUSTER", isActive: true },
  });
  if (!clusterModelDb) {
    logger.warn({ classId }, "Cluster model not trained yet");
    return { error: "Model cluster belum dilatih. Klik 'Latih Model' untuk memulai.", clusters: [], assignments: [] };
  }

  // Load centroids dari exported JSON file (dihasilkan saat training)
  let centroids: number[][] = [];
  try {
    const jsonPath = path.join(env.modelPath, "behavior-cluster.json");
    const jsonContent = fs.readFileSync(jsonPath, "utf-8");
    const jsonData = JSON.parse(jsonContent);
    centroids = jsonData.centroids;
  } catch (err: any) {
    logger.warn({ err }, "Failed to load centroids from JSON file");
    return { error: "File model tidak ditemukan. Silakan latih ulang model.", clusters: [], assignments: [] };
  }

  // Ambil semua siswa dalam kelas
  const students = await prisma.student.findMany({
    where: { classId },
    select: { id: true, name: true },
  });

  logger.debug({ classId, studentCount: students.length }, "Students fetched for clustering");

  // Array untuk menyimpan assignment tiap siswa
  const assignments: Array<{
    studentId: string;
    name: string;
    clusterId: number;
  }> = [];

  // Map untuk agregasi data per cluster
  const clusterData: Record<number, { totalKnowledge: number; totalAbsence: number; count: number }> = {};

  // ── BATCH query semua semester records untuk semua siswa di kelas ──
  const studentIds = students.map((s) => s.id);
  const allRecords = await prisma.semesterRecord.findMany({
    where: { studentId: { in: studentIds } },
    include: { subjectScores: true, attendance: true, achievements: { select: { id: true } } },
  });
  const recordsByStudent = new Map<string, typeof allRecords>();
  for (const r of allRecords) {
    if (!recordsByStudent.has(r.studentId)) recordsByStudent.set(r.studentId, []);
    recordsByStudent.get(r.studentId)!.push(r);
  }

  const maxes = [100, 100, 10, 5];
  for (const student of students) {
    const records = recordsByStudent.get(student.id) || [];
    let avgK = 0, avgS = 0, totalAbs = 0, achCount = 0;
    const kList: number[] = [];
    for (const rec of records) {
      const scores = rec.subjectScores;
      if (scores.length > 0) {
        const mean = scores.reduce((s, sc) => s + sc.knowledgeScore, 0) / scores.length;
        kList.push(mean);
        avgS += scores.reduce((s, sc) => s + sc.skillsScore, 0) / scores.length;
      }
      if (rec.attendance) totalAbs += rec.attendance.sick + rec.attendance.permission + rec.attendance.absent;
      achCount += rec.achievements.length;
    }
    avgK = kList.length > 0 ? kList.reduce((a, b) => a + b, 0) / kList.length : 0;
    avgS = records.length > 0 ? avgS / records.length : 0;

    const vec = [
      avgK / maxes[0], avgS / maxes[1],
      Math.min(totalAbs / maxes[2], 1),
      Math.min(achCount / maxes[3], 1),
    ];

    // K-Means inference — direct centroid distance (tanpa ONNX, tanpa computeFeatures individual)
    let minDist = Infinity;
    let clusterId = 0;
    for (let ci = 0; ci < centroids.length; ci++) {
      const dist = euclidean(vec, centroids[ci]);
      if (dist < minDist) { minDist = dist; clusterId = ci; }
    }

    assignments.push({ studentId: student.id, name: student.name, clusterId });

    // Agregasi per cluster
    if (!clusterData[clusterId]) {
      clusterData[clusterId] = { totalKnowledge: 0, totalAbsence: 0, count: 0 };
    }
    clusterData[clusterId].totalKnowledge += avgK;
    clusterData[clusterId].totalAbsence += totalAbs;
    clusterData[clusterId].count++;
  }

  // Agregasi data per cluster → hitung rata-rata
  const clusters = Object.entries(clusterData).map(([id, data]) => ({
    clusterId: Number(id),
    size: data.count,
    avgKnowledge: Math.round((data.totalKnowledge / data.count) * 100) / 100,
    avgAbsence: Math.round((data.totalAbsence / data.count) * 100) / 100,
  }));

  // LLM Agent untuk label dan deskripsi cluster (graceful fallback)
  let profiles: Array<{ clusterId: number; label: string; description: string }> = [];
  try {
    const agentResult = await explainCluster(clusters);
    profiles = agentResult.profiles;
  } catch (err: any) {
    logger.warn({ err, classId }, "LLM cluster explanation failed, using fallback labels");
    // Fallback: label generik berdasarkan data agregasi
    profiles = clusters.map((c) => ({
      clusterId: c.clusterId,
      label: `Kelompok ${c.clusterId + 1}`,
      description: `${c.size} siswa dengan rata-rata nilai ${c.avgKnowledge.toFixed(0)}`,
    }));
  }

  // Map clusterId → label untuk assignment
  const labelMap: Record<number, string> = {};
  for (const profile of profiles) {
    labelMap[profile.clusterId] = profile.label;
  }

  logger.info({ classId, clusterCount: clusters.length }, "getClassCluster completed");
  return {
    clusters,
    assignments: assignments.map((a) => ({
      ...a,
      clusterLabel: labelMap[a.clusterId] || `Kelompok ${a.clusterId + 1}`,
    })),
    profiles,
  };
}

// ============================================================
// Model Management
// ============================================================

/**
 * getModels
 * 
 * Mendapatkan daftar model ML yang sudah di-train beserta metadata-nya.
 * 
 * @returns Object { trainedAt, hasClusterModel, meta }
 */
export async function getModels() {
  logger.info({}, "getModels called");
  const models = await getTrainedModels();
  return {
    trainedAt: models.trainedAt,
    hasClusterModel: models.clusterModel !== null,
    meta: models.meta,
  };
}

/**
 * retrainModels
 * 
 * Memicu retraining semua model ML. Setelah retrain, cache ONNX paths di-refresh
 * agar inference menggunakan model terbaru.
 * 
 * @returns Hasil retrain dari trainer.ts
 */
export async function retrainModels() {
  logger.info({}, "retrainModels called — triggering model retraining");
  const result = await retrain();
  await refreshOnnxPaths();
  logger.info({}, "retrainModels completed");
  return result;
}

/**
 * evaluateAllModels
 * 
 * Evaluasi komprehensif semua model ML:
 * 1. Kumpulkan fitur semua siswa.
 * 2. Analisis distribusi fitur.
 * 3. Analisis distribusi risiko.
 * 4. Evaluasi cluster (silhouette score jika model tersedia).
 * 5. Evaluasi tren (distribusi slope dan R²).
 * 
 * @returns EvaluationReport — laporan evaluasi lengkap
 */
export async function evaluateAllModels(): Promise<EvaluationReport> {
  logger.info({}, "evaluateAllModels called");

  // Kumpulkan fitur semua siswa — BATCH query
  const students = await prisma.student.findMany({ select: { id: true } });
  const allFeatures: StudentFeatures[] = [];

  // Batch: ambil semua semester records sekaligus untuk semua siswa
  const allRecords = await prisma.semesterRecord.findMany({
    where: { studentId: { in: students.map(s => s.id) } },
    include: {
      subjectScores: true,
      attendance: true,
      achievements: { select: { id: true } },
    },
    orderBy: [{ studentId: "asc" }, { academicYear: { year: "asc" } }, { semester: "asc" }],
  });

  // Kelompokkan per studentId
  const recordsByStudent = new Map<string, typeof allRecords>();
  for (const r of allRecords) {
    if (!recordsByStudent.has(r.studentId)) recordsByStudent.set(r.studentId, []);
    recordsByStudent.get(r.studentId)!.push(r);
  }

  for (const student of students) {
    try {
      const records = recordsByStudent.get(student.id) || [];
      // Hitung features dari records — tanpa DB query per siswa
      const avgKnowledgeList: number[] = [];
      const avgSkillsList: number[] = [];
      let totalAbsence = 0;
      let achievementCount = 0;
      const attendancesWithData: typeof records = [];
      
      for (const rec of records) {
        const scores = rec.subjectScores;
        if (scores.length > 0) {
          avgKnowledgeList.push(scores.reduce((s, sc) => s + sc.knowledgeScore, 0) / scores.length);
          avgSkillsList.push(scores.reduce((s, sc) => s + sc.skillsScore, 0) / scores.length);
        }
        if (rec.attendance) {
          totalAbsence += rec.attendance.sick + rec.attendance.permission + rec.attendance.absent;
          attendancesWithData.push(rec);
        }
        achievementCount += rec.achievements.length;
      }
      
      const avgKnowledge = avgKnowledgeList.length > 0
        ? avgKnowledgeList.reduce((a, b) => a + b, 0) / avgKnowledgeList.length
        : 0;
      const avgSkills = avgSkillsList.length > 0
        ? avgSkillsList.reduce((a, b) => a + b, 0) / avgSkillsList.length
        : 0;
      const scoreDelta = avgKnowledgeList.length >= 2
        ? avgKnowledgeList[avgKnowledgeList.length - 1] - avgKnowledgeList[0]
        : 0;
      const scoreVolatility = avgKnowledgeList.length >= 2
        ? Math.sqrt(avgKnowledgeList.reduce((sum, v) => sum + (v - avgKnowledge) ** 2, 0) / avgKnowledgeList.length)
        : 0;
      const absenceTrend = attendancesWithData.length >= 2
        ? (attendancesWithData[attendancesWithData.length - 1]!.attendance!.absent) -
          (attendancesWithData[attendancesWithData.length - 2]!.attendance!.absent)
        : 0;
      const academicYearId = records.length > 0 ? records[records.length - 1]?.academicYearId : undefined;
      
      allFeatures.push({
        studentId: student.id,
        avgKnowledge: Math.round(avgKnowledge * 100) / 100,
        avgSkills: Math.round(avgSkills * 100) / 100,
        scoreDelta: Math.round(scoreDelta * 100) / 100,
        scoreVolatility: Math.round(scoreVolatility * 100) / 100,
        totalAbsence,
        absenceTrend,
        achievementCount,
        semesterCount: records.length,
        academicYearId,
      });
    } catch {
      // Skip siswa tanpa data — tidak mempengaruhi evaluasi
    }
  }

  logger.debug({ totalStudents: students.length, validFeatures: allFeatures.length }, "Features collected for evaluation");

  // Analisis distribusi fitur
  const featureAnalysis = analyzeFeatures(allFeatures);

  // Analisis distribusi risiko
  const riskDistribution = analyzeRiskDistribution(allFeatures);

  // Evaluasi cluster — dilewati untuk /ml/eval (mencegah trigger training 200 siswa)
  // K-Means clustering adalah post-MVP (FR-17/P5). Silhouette & inertia tersedia
  // di halaman ML Dashboard per kelas melalui endpoint /ml/cluster/class/:id
  const clusterEvaluation = null;

  // Evaluasi tren — untuk setiap siswa dengan minimal 2 semester data
  const trendResults: Array<{ slope: number; rSquared: number; nPoints: number }> = [];
  for (const f of allFeatures) {
    try {
      // Gunakan data batch yang sudah dimuat — tanpa DB query tambahan
      const stuRecords = recordsByStudent.get(f.studentId) || [];
      const semesterData: number[] = [];
      for (const rec of stuRecords) {
        const scores = rec.subjectScores;
        if (scores.length > 0) {
          semesterData.push(scores.reduce((s, sc) => s + sc.knowledgeScore, 0) / scores.length);
        }
      }
      const nPoints = semesterData.length;
      const x = Array.from({ length: nPoints }, (_, i) => i);
      const y = semesterData;
      if (nPoints >= 2) {
        const reg = trainLinearRegression(x, y);
        trendResults.push({ slope: reg.slope, rSquared: reg.rSquared, nPoints });
      } else {
        // Data tidak cukup untuk regresi
        trendResults.push({ slope: 0, rSquared: 0, nPoints });
      }
    } catch {
      trendResults.push({ slope: 0, rSquared: 0, nPoints: 0 });
    }
  }
  const trendEvaluation = evaluateTrends(trendResults);
  logger.debug({ trendEvaluation }, "Trend evaluation computed");

  const report: EvaluationReport = {
    generatedAt: new Date().toISOString(),
    nStudents: allFeatures.length,
    dataQuality: featureAnalysis.dataQuality,
    featureStats: featureAnalysis.features,
    riskDistribution,
    clusterEvaluation,
    trendEvaluation,
  };

  logger.info({ nStudents: allFeatures.length }, "evaluateAllModels completed");
  return report;
}

/**
 * getOutcomes
 * 
 * Mendapatkan semua predicted outcomes (hasil prediksi ML) yang tersimpan.
 * Bisa difilter berdasarkan studentId jika disediakan.
 * 
 * @param studentId - (opsional) Filter berdasarkan ID siswa
 * @returns Array of PredictedOutcome dengan relasi student
 */
export async function getOutcomes(studentId?: string) {
  logger.info({ studentId: studentId || "all" }, "getOutcomes called");
  const where = studentId ? { studentId } : {};
  return prisma.predictedOutcome.findMany({
    where: { ...where, isActive: true },
    include: {
      student: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

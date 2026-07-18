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
  type EvaluationReport,
} from "./model-evaluator";
import { runOnnxInference, clearOnnxCache } from "./onnx-runner";
import { trainLinearRegression } from "./models/linear-regression";
import type { StudentFeatures } from "./features";
import * as fs from "fs";

/** Cache the active ONNX file paths — refreshed on retrain */
let onnxPaths: Record<string, string | null> = {};

async function refreshOnnxPaths() {
  const models = await prisma.mlModel.findMany({
    where: { isActive: true, filePath: { not: null } },
    orderBy: { trainedAt: "desc" },
    take: 3,
  });
  onnxPaths = {};
  for (const m of models) {
    if (m.filePath && fs.existsSync(m.filePath)) {
      onnxPaths[m.modelType] = m.filePath;
    }
  }
  clearOnnxCache();
}

async function ensureOnnxExists(): Promise<void> {
  if (Object.keys(onnxPaths).length > 0) return;

  const records = await prisma.mlModel.findMany({
    where: { isActive: true },
    select: { id: true, modelType: true, filePath: true, trainedAt: true },
    orderBy: { trainedAt: "desc" },
  });

  const needsRetrain = records.length === 0 || records.some((r) => !r.filePath || !fs.existsSync(r.filePath));
  if (needsRetrain) {
    try {
      console.log("[Analytics] ONNX files missing — regenerating K-Means model...");
      await retrain();
      await refreshOnnxPaths();
    } catch (err: any) {
      console.warn(`[Analytics] Auto-generation failed: ${err.message}`);
    }
  } else {
    await refreshOnnxPaths();
  }
}

// ============================================================
// Risk Assessment — uses transparent rule-based ScoringEngine
// ============================================================

function factorsFromFeatures(features: StudentFeatures): string[] {
  const factors: string[] = [];
  if (features.avgKnowledge < 70) factors.push(`Rata-rata nilai ${features.avgKnowledge.toFixed(0)} (di bawah 70)`);
  if (features.scoreVolatility > 15) factors.push(`Nilai tidak stabil (volatilitas ${features.scoreVolatility.toFixed(0)})`);
  if (features.semesterCount >= 2 && features.scoreDelta < -10) factors.push(`Nilai turun ${Math.abs(features.scoreDelta).toFixed(0)} poin`);
  const avgAbsence = features.semesterCount > 0 ? features.totalAbsence / features.semesterCount : 0;
  if (avgAbsence > 5) factors.push(`Rata-rata ketidakhadiran ${avgAbsence.toFixed(0)} hari/semester`);
  if (features.semesterCount >= 2 && features.achievementCount === 0) factors.push("Belum ada prestasi akademik/non-akademik");
  return factors.length > 0 ? factors : ["Tidak ada faktor risiko signifikan"];
}

export async function getStudentRisk(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, class: { select: { name: true } } },
  });
  if (!student) throw new NotFoundError("Student not found");

  const features = await computeFeatures(studentId);
  const factors = factorsFromFeatures(features);

  // Rule-based risk scoring — transparent, documented, no fake confidence
  const risk = evaluateRisk({
    avgKnowledge: features.avgKnowledge,
    scoreVolatility: features.scoreVolatility,
    totalAbsence: features.totalAbsence,
    scoreDelta: features.scoreDelta,
    semesterCount: features.semesterCount,
    achievementCount: features.achievementCount,
    avgAbsencePerSemester: features.semesterCount > 0 ? features.totalAbsence / features.semesterCount : 0,
  });

  // LLM Agent explanation (optional enhancement, falls back gracefully)
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
    console.warn(`[Analytics] LLM risk analysis failed for ${studentId}: ${err.message}`);
  }

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

  // Persist the assessment
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
      confidence: 1, // deterministic rule-based, always 1
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

  return { features, risk: result };
}

// ============================================================
// Class Risk — assesses all students in a class
// ============================================================

export async function getClassRisk(classId: string) {
  const students = await prisma.student.findMany({
    where: { classId },
    select: { id: true, name: true },
  });

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
      console.warn(`[Analytics] Skipping student ${student.id}: ${err.message}`);
    }
  }

  results.sort((a, b) => b.risk.score - a.risk.score);

  const summary = {
    total: results.length,
    kritis: results.filter((r) => r.risk.level === "KRITIS").length,
    waspada: results.filter((r) => r.risk.level === "WASPADA").length,
    aman: results.filter((r) => r.risk.level === "AMAN").length,
    kritisStudents: results
      .filter((r) => r.risk.level === "KRITIS")
      .map((r) => ({ id: r.studentId, name: r.name, score: r.risk.score })),
  };

  return { results, summary };
}

// ============================================================
// Trend Prediction — uses Linear Regression with real R²
// ============================================================

/**
 * Compute per-semester knowledge averages for trend analysis.
 */
async function getSemesterAverages(studentId: string): Promise<{
  x: number[];
  y: number[];
  nPoints: number;
}> {
  const records = await prisma.semesterRecord.findMany({
    where: { studentId },
    include: { subjectScores: true },
    orderBy: [{ academicYear: { year: "asc" } }, { semester: "asc" }],
  });

  const semAvgs = records.map((r) => {
    const scores = r.subjectScores;
    return scores.length > 0
      ? scores.reduce((s, sc) => s + sc.knowledgeScore, 0) / scores.length
      : 0;
  });

  const x = semAvgs.map((_, i) => i);
  const y = semAvgs;

  return { x, y, nPoints: semAvgs.length };
}

export async function getStudentTrend(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, name: true },
  });
  if (!student) throw new NotFoundError("Student not found");

  const features = await computeFeatures(studentId);
  const { x, y, nPoints } = await getSemesterAverages(studentId);
  const nextSemesterIndex = nPoints;

  // Linear Regression — computed on the fly, real R²
  const regression = trainLinearRegression(x, y);
  const nextPrediction = regression.predict(nextSemesterIndex);

  const direction: "NAIK" | "STABIL" | "TURUN" =
    regression.slope > 2 ? "NAIK" : regression.slope < -2 ? "TURUN" : "STABIL";

  // LLM Agent explanation (graceful fallback)
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
    console.warn(`[Analytics] LLM trend analysis failed for ${studentId}: ${err.message}`);
  }

  const trend = {
    trend: direction,
    slope: regression.slope,
    rSquared: regression.rSquared, // REAL R², bukan hardcoded
    nextPrediction: Math.round(nextPrediction * 100) / 100,
    description: agentResult.explanation,
  };

  // Persist
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
        confidence: Math.max(0, regression.rSquared), // R² as confidence proxy
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

  return { features, trend };
}

// ============================================================
// Behavior Clustering — uses K-Means (legitimate unsupervised learning)
// ============================================================

export async function getClassCluster(classId: string) {
  const models = await getTrainedModels();
  if (!models.clusterModel) {
    return { error: "Cluster model not trained yet. Train models first.", clusters: [], assignments: [] };
  }

  const students = await prisma.student.findMany({
    where: { classId },
    select: { id: true, name: true },
  });

  const assignments: Array<{
    studentId: string;
    name: string;
    clusterId: number;
  }> = [];

  const clusterData: Record<number, { totalKnowledge: number; totalAbsence: number; count: number }> = {};

  // Auto-generate ONNX if not exist
  if (Object.keys(onnxPaths).length === 0) await ensureOnnxExists();

  for (const student of students) {
    try {
      const features = await computeFeatures(student.id);
      const maxes = [100, 100, 10, 5];
      const vec = [
        features.avgKnowledge / maxes[0],
        features.avgSkills / maxes[1],
        Math.min(features.totalAbsence / maxes[2], 1),
        Math.min(features.achievementCount / maxes[3], 1),
      ];

      // K-Means inference — ONNX Runtime or JS fallback
      let clusterId: number;
      const onnxCluster = await runOnnxInference(onnxPaths["BEHAVIOR_CLUSTER"], vec);
      if (onnxCluster && onnxCluster.length > 0) {
        clusterId = Math.round(onnxCluster[0]);
      } else {
        clusterId = models.clusterModel.predict(vec);
      }

      assignments.push({
        studentId: student.id,
        name: student.name,
        clusterId,
      });

      if (!clusterData[clusterId]) {
        clusterData[clusterId] = { totalKnowledge: 0, totalAbsence: 0, count: 0 };
      }
      clusterData[clusterId].totalKnowledge += features.avgKnowledge;
      clusterData[clusterId].totalAbsence += features.totalAbsence;
      clusterData[clusterId].count++;
    } catch (err: any) {
      console.warn(`[Analytics] Skipping cluster assignment for student ${student.id}: ${err.message}`);
    }
  }

  const clusters = Object.entries(clusterData).map(([id, data]) => ({
    clusterId: Number(id),
    size: data.count,
    avgKnowledge: Math.round((data.totalKnowledge / data.count) * 100) / 100,
    avgAbsence: Math.round((data.totalAbsence / data.count) * 100) / 100,
  }));

  // LLM Agent explanation for clusters (graceful fallback)
  let profiles: Array<{ clusterId: number; label: string; description: string }> = [];
  try {
    const agentResult = await explainCluster(clusters);
    profiles = agentResult.profiles;
  } catch (err: any) {
    console.warn(`[Analytics] LLM cluster explanation failed: ${err.message}`);
    profiles = clusters.map((c) => ({
      clusterId: c.clusterId,
      label: `Kelompok ${c.clusterId + 1}`,
      description: `${c.size} siswa dengan rata-rata nilai ${c.avgKnowledge.toFixed(0)}`,
    }));
  }

  const labelMap: Record<number, string> = {};
  for (const profile of profiles) {
    labelMap[profile.clusterId] = profile.label;
  }

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

export async function getModels() {
  const models = await getTrainedModels();
  return {
    trainedAt: models.trainedAt,
    hasClusterModel: models.clusterModel !== null,
    meta: models.meta,
  };
}

export async function retrainModels() {
  const result = await retrain();
  await refreshOnnxPaths();
  return result;
}

export async function evaluateAllModels(): Promise<EvaluationReport> {
  // Gather all students' features for evaluation
  const students = await prisma.student.findMany({ select: { id: true } });
  const allFeatures: StudentFeatures[] = [];

  for (const student of students) {
    try {
      const features = await computeFeatures(student.id);
      allFeatures.push(features);
    } catch {
      // skip — student without data doesn't add to evaluation
    }
  }

  const models = await getTrainedModels();

  // Feature analysis
  const featureAnalysis = analyzeFeatures(allFeatures);

  // Risk distribution
  const riskDistribution = analyzeRiskDistribution(allFeatures);

  // Cluster evaluation
  let clusterEvaluation = null;
  if (models.clusterModel && allFeatures.length > 0) {
    const maxes = [
      Math.max(...allFeatures.map((f) => f.avgKnowledge), 100),
      Math.max(...allFeatures.map((f) => f.avgSkills), 100),
      Math.max(...allFeatures.map((f) => f.totalAbsence), 10),
      Math.max(...allFeatures.map((f) => f.achievementCount), 5),
    ];
    const clusterVectors = allFeatures.map((f) => [
      f.avgKnowledge / Math.max(maxes[0], 100),
      f.avgSkills / Math.max(maxes[1], 100),
      Math.min(f.avgSkills / Math.max(maxes[2], 10), 1),
      Math.min(f.achievementCount / Math.max(maxes[3], 5), 1),
    ]);
    clusterEvaluation = evaluateCluster(clusterVectors, models.clusterModel);
  }

  // Trend evaluation
  const trendResults: Array<{ slope: number; rSquared: number; nPoints: number }> = [];
  for (const f of allFeatures) {
    try {
      const { x, y, nPoints } = await getSemesterAverages(f.studentId);
      if (nPoints >= 2) {
        const reg = trainLinearRegression(x, y);
        trendResults.push({ slope: reg.slope, rSquared: reg.rSquared, nPoints });
      } else {
        trendResults.push({ slope: 0, rSquared: 0, nPoints });
      }
    } catch {
      trendResults.push({ slope: 0, rSquared: 0, nPoints: 0 });
    }
  }
  const trendEvaluation = evaluateTrends(trendResults);

  return {
    generatedAt: new Date().toISOString(),
    nStudents: allFeatures.length,
    dataQuality: featureAnalysis.dataQuality,
    featureStats: featureAnalysis.features,
    riskDistribution,
    clusterEvaluation,
    trendEvaluation,
  };
}

export async function getOutcomes(studentId?: string) {
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

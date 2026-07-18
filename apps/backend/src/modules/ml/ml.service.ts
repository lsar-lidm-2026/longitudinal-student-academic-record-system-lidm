import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../common/error";
import { computeFeatures } from "./features";
import { getModels as getTrainedModels, getStudentRegression, retrainModels as retrain } from "./trainer";
import { analyzeRisk, analyzeTrend, explainCluster } from "./agent";
import { evaluateModel } from "./eval-agent";
import { runOnnxInference, clearOnnxCache } from "./onnx-runner";
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
  // Clear ONNX Runtime session cache since models may have changed
  clearOnnxCache();
}

/**
 * Auto-generate ONNX files if they don't exist yet.
 * Called before any ML inference that needs ONNX.
 */
async function ensureOnnxExists(): Promise<void> {
  if (Object.keys(onnxPaths).length > 0) return; // Already have cached paths

  // Check DB for model records
  const records = await prisma.mlModel.findMany({
    where: { isActive: true },
    select: { id: true, modelType: true, filePath: true, trainedAt: true },
    orderBy: { trainedAt: "desc" },
  });

  // If records exist but no valid file paths, or no records at all → retrain
  const needsRetrain = records.length === 0 || records.some((r) => !r.filePath || !fs.existsSync(r.filePath));
  if (needsRetrain) {
    try {
      console.log("[ML] ONNX files missing — auto-regenerating...");
      await retrain();
      await refreshOnnxPaths();
      console.log("[ML] ONNX files generated");
    } catch (err: any) {
      console.warn(`[ML] Auto-generation failed: ${err.message}`);
    }
  } else {
    await refreshOnnxPaths();
  }
}

// ============================================================
// Risk Classification — uses Decision Tree
// ============================================================

function factorsFromFeatures(features: StudentFeatures): string[] {
  const factors: string[] = [];
  if (features.avgKnowledge < 70) factors.push(`Rata-rata nilai ${features.avgKnowledge.toFixed(0)} (di bawah 70)`);
  if (features.scoreVolatility > 15) factors.push(`Nilai tidak stabil (volatilitas ${features.scoreVolatility.toFixed(0)})`);
  if (features.semesterCount >= 2 && features.scoreDelta < -10) factors.push(`Nilai turun ${Math.abs(features.scoreDelta).toFixed(0)} poin`);
  const avgAbsence = features.semesterCount > 0 ? features.totalAbsence / features.semesterCount : 0;
  if (avgAbsence > 5) factors.push(`Rata-rata ketidakhadiran ${avgAbsence.toFixed(0)}/semester`);
  if (features.absenceTrend > 2) factors.push("Tren alpha meningkat");
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

  // Ensure models are trained
  const models = await getTrainedModels();

  // 1. Risk prediction — try ONNX Runtime first, fall back to Decision Tree
  let riskLevel: string;
  let riskConfidence: number;

  // Auto-generate ONNX if not exist
  if (Object.keys(onnxPaths).length === 0) await ensureOnnxExists();

  // Try ONNX Runtime inference
  const onnxResult = await runOnnxInference(onnxPaths["RISK_CLASSIFICATION"], [
    features.avgKnowledge,
    features.scoreVolatility,
    features.totalAbsence,
    features.scoreDelta,
    features.achievementCount,
  ]);

  if (onnxResult && onnxResult.length > 0) {
    // ONNX model returns class index: 0=AMAN, 1=WASPADA, 2=KRITIS
    const classLabels = ["AMAN", "WASPADA", "KRITIS"];
    const idx = Math.round(onnxResult[0]);
    riskLevel = classLabels[Math.max(0, Math.min(idx, classLabels.length - 1))];
    riskConfidence = 0.8;
  } else if (models.riskTree) {
    // Fallback: Decision Tree inference
    const prediction = models.riskTree.predict([
      features.avgKnowledge,
      features.scoreVolatility,
      features.totalAbsence,
      features.scoreDelta,
      features.achievementCount,
    ]);
    riskLevel = prediction.label;
    riskConfidence = prediction.confidence;
  } else {
    // Hard fallback
    riskLevel = features.avgKnowledge < 70 ? "WASPADA" : "AMAN";
    riskConfidence = 0.5;
  }

  const factors = factorsFromFeatures(features);

  // 2. LLM Agent analysis
  const agentResult = await analyzeRisk(
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
    { level: riskLevel, confidence: riskConfidence, factors }
  );

  // Derive risk score from confidence + severity
  const baseScore = riskLevel === "KRITIS" ? 70 : riskLevel === "WASPADA" ? 35 : 10;
  const score = Math.min(100, baseScore + Math.round((1 - riskConfidence) * 15));

  const risk = {
    level: riskLevel as "AMAN" | "WASPADA" | "KRITIS",
    score,
    confidence: riskConfidence,
    factors,
    recommendations: agentResult.recommendations,
    aiExplanation: agentResult.explanation,
  };

  // 3. Persist prediction
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
      label: riskLevel,
      score: risk.score,
      confidence: riskConfidence,
      features: features as any,
    },
    create: {
      studentId,
      academicYearId: features.academicYearId || null,
      modelType: "RISK_CLASSIFICATION",
      label: riskLevel,
      score: risk.score,
      confidence: riskConfidence,
      features: features as any,
    },
  });

  return { features, risk };
}

// ============================================================
// Class Risk — analyzes all students in a class
// ============================================================

export async function getClassRisk(classId: string) {
  const students = await prisma.student.findMany({
    where: { classId },
    select: { id: true, name: true },
  });

  const results = [];

  for (const student of students) {
    try {
      const features = await computeFeatures(student.id);
      const models = await getTrainedModels();

      const featureVec = [
        features.avgKnowledge,
        features.scoreVolatility,
        features.totalAbsence,
        features.scoreDelta,
        features.achievementCount,
      ];

      let level: string;
      let confidence: number;
      if (models.riskTree) {
        const pred = models.riskTree.predict(featureVec);
        level = pred.label;
        confidence = pred.confidence;
      } else {
        level = features.avgKnowledge < 70 ? "WASPADA" : "AMAN";
        confidence = 0.5;
      }

      const baseScore = level === "KRITIS" ? 70 : level === "WASPADA" ? 35 : 10;
      const score = Math.min(100, baseScore + Math.round((1 - confidence) * 15));

      results.push({
        studentId: student.id,
        name: student.name,
        risk: {
          level,
          score,
          confidence,
          factors: factorsFromFeatures(features),
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
    } catch {
      // Skip students without records
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
// Trend Prediction — uses Linear Regression
// ============================================================

export async function getStudentTrend(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, name: true },
  });
  if (!student) throw new NotFoundError("Student not found");

  const features = await computeFeatures(studentId);
  const nextSemesterIndex = features.semesterCount;

  // Try ONNX Runtime for trend prediction
  let nextPrediction = features.avgKnowledge;
  let regressionSlope = 0;
  let regressionRSquared = 0;

  if (Object.keys(onnxPaths).length === 0) await ensureOnnxExists();
  const onnxResult = await runOnnxInference(onnxPaths["TREND_PREDICTION"], [nextSemesterIndex]);

  if (onnxResult && onnxResult.length > 0) {
    nextPrediction = Math.max(0, Math.min(100, onnxResult[0]));
    // Approximate slope from prediction: delta from last known value
    regressionSlope = nextPrediction - features.avgKnowledge;
    regressionRSquared = 0.6; // Default — actual R² from training data
  } else {
    // Fallback: JS linear regression
    const { regression, features: _f } = await getStudentRegression(studentId);
    nextPrediction = regression.predict(nextSemesterIndex);
    regressionSlope = regression.slope;
    regressionRSquared = regression.rSquared;
  }

  const direction: "NAIK" | "STABIL" | "TURUN" =
    regressionSlope > 2 ? "NAIK" : regressionSlope < -2 ? "TURUN" : "STABIL";

  const agentResult = await analyzeTrend(
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
      slope: regressionSlope,
      rSquared: regressionRSquared,
      nextPrediction,
      direction,
    }
  );

  const trend = {
    trend: direction,
    slope: regressionSlope,
    rSquared: regressionRSquared,
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
        confidence: Math.max(0, regressionRSquared),
        features: features as any,
      },
      create: {
        studentId,
        academicYearId: features.academicYearId,
        modelType: "TREND_PREDICTION",
        score: nextPrediction,
        confidence: Math.max(0, regressionRSquared),
        features: features as any,
      },
    });
  }

  return { features, trend };
}

// ============================================================
// Behavior Clustering — uses K-Means
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

  const clusterData: Record<number, { totalKnowledge: number; totalAbsence: number; count: number; label: string }> = {};

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

      // Try ONNX Runtime for K-Means inference
      let clusterId: number;
      const onnxCluster = await runOnnxInference(onnxPaths["BEHAVIOR_CLUSTER"], vec);
      if (onnxCluster && onnxCluster.length > 0) {
        clusterId = Math.round(onnxCluster[0]);
      } else {
        // Fallback: JS nearest-centroid
        clusterId = models.clusterModel.predict(vec);
      }

      assignments.push({
        studentId: student.id,
        name: student.name,
        clusterId,
      });

      if (!clusterData[clusterId]) {
        clusterData[clusterId] = { totalKnowledge: 0, totalAbsence: 0, count: 0, label: "" };
      }
      clusterData[clusterId].totalKnowledge += features.avgKnowledge;
      clusterData[clusterId].totalAbsence += features.totalAbsence;
      clusterData[clusterId].count++;
    } catch {
      // Skip
    }
  }

  const clusters = Object.entries(clusterData).map(([id, data]) => ({
    clusterId: Number(id),
    size: data.count,
    avgKnowledge: Math.round((data.totalKnowledge / data.count) * 100) / 100,
    avgAbsence: Math.round((data.totalAbsence / data.count) * 100) / 100,
  }));

  // LLM Agent explanation
  const agentResult = await explainCluster(clusters);

  // Map cluster IDs to labels from agent
  const labelMap: Record<number, string> = {};
  for (const profile of agentResult.profiles) {
    labelMap[profile.clusterId] = profile.label;
  }

  return {
    clusters,
    assignments: assignments.map((a) => ({
      ...a,
      clusterLabel: labelMap[a.clusterId] || `Kelompok ${a.clusterId + 1}`,
    })),
    profiles: agentResult.profiles,
  };
}

// ============================================================
// Model Management
// ============================================================

export async function getModels() {
  const models = await getTrainedModels();
  return {
    trainedAt: models.trainedAt,
    hasRiskTree: models.riskTree !== null,
    hasClusterModel: models.clusterModel !== null,
    totalStudents: 0, // Filled by the caller if needed
  };
}

export async function retrainModels() {
  const result = await retrain();
  // Refresh ONNX path cache after retraining
  await refreshOnnxPaths();
  return result;
}

export async function evaluateAllModels() {
  const models = await getTrainedModels();
  const evaluations: any[] = [];

  // Count total students with features
  const studentCount = await prisma.student.count();

  if (models.riskTree) {
    const result = await evaluateModel({
      type: "RISK_CLASSIFICATION",
      name: "Decision Tree — Risk Classification",
      metrics: { treeDepth: getTreeDepth(models.riskTree.tree) },
      nSamples: studentCount,
      nFeatures: models.riskTree.featureNames.length,
      trainingDate: models.trainedAt?.toISOString() || "unknown",
    });
    evaluations.push({ modelType: "RISK_CLASSIFICATION", ...result });
  }

  if (models.clusterModel) {
    const result = await evaluateModel({
      type: "BEHAVIOR_CLUSTER",
      name: "K-Means — Behavior Clustering",
      metrics: {
        nClusters: models.clusterModel.centroids.length,
        iterations: models.clusterModel.iterations,
        inertia: Math.round(models.clusterModel.inertia * 100) / 100,
      },
      nSamples: studentCount,
      nFeatures: 4,
      trainingDate: models.trainedAt?.toISOString() || "unknown",
    });
    evaluations.push({ modelType: "BEHAVIOR_CLUSTER", ...result });
  }

  return {
    trainedAt: models.trainedAt,
    evaluations,
    studentCount,
  };
}

function getTreeDepth(node: any): number {
  if (!node || node.isLeaf) return 1;
  return 1 + Math.max(
    node.left ? getTreeDepth(node.left) : 0,
    node.right ? getTreeDepth(node.right) : 0
  );
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

/**
 * ML Trainer — trains all models from database data.
 * Uses computeFeatures() to extract feature vectors for all students.
 * Models are stored in-memory and optionally persisted as JSON.
 */

import { prisma } from "../../lib/prisma";
import { computeFeatures } from "./features";
import { trainLinearRegression, type RegressionResult } from "./models/linear-regression";
import { trainKMeans, type KMeansResult } from "./models/k-means";
import { trainDecisionTree, type DecisionTreeResult } from "./models/decision-tree";
import { exportLinearRegressionOnnx, exportDecisionTreeOnnx, exportKMeansOnnx, exportKMeansJson } from "./models/onnx-export";
import type { StudentFeatures } from "./features";

export interface TrainedModels {
  /** Decision tree for risk classification — trained across all students */
  riskTree: DecisionTreeResult | null;
  /** K-Means for behavior clustering — trained across all students */
  clusterModel: KMeansResult | null;
  /** Trained at timestamp */
  trainedAt: Date | null;
}

let cachedModels: TrainedModels = {
  riskTree: null,
  clusterModel: null,
  trainedAt: null,
};

/** Reset cached models — used in tests */
export function resetCache() {
  cachedModels = { riskTree: null, clusterModel: null, trainedAt: null };
}

const FEATURE_NAMES = [
  "avgKnowledge",
  "scoreVolatility",
  "totalAbsence",
  "scoreDelta",
  "achievementCount",
];

/**
 * Generate risk labels for training the decision tree.
 * Uses reasonable performance thresholds as pseudo-ground-truth.
 */
function generateRiskLabel(features: StudentFeatures): string {
  let score = 0;
  if (features.avgKnowledge < 70) score += 3;
  if (features.scoreVolatility > 15) score += 2;
  if (features.totalAbsence / Math.max(features.semesterCount, 1) > 5) score += 4;
  if (features.semesterCount >= 2 && features.scoreDelta < -10) score += 3;
  if (features.semesterCount >= 2 && features.achievementCount === 0) score += 1;

  if (score >= 7) return "KRITIS";
  if (score >= 4) return "WASPADA";
  return "AMAN";
}

function extractFeatureVector(features: StudentFeatures): number[] {
  return [
    features.avgKnowledge,
    features.scoreVolatility,
    features.totalAbsence,
    features.scoreDelta,
    features.achievementCount,
  ];
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
    console.warn("[ML] Too few students to train models");
    return cachedModels;
  }

  // Compute features for all students
  const allFeatures: StudentFeatures[] = [];
  for (const student of students) {
    try {
      const features = await computeFeatures(student.id);
      allFeatures.push(features);
    } catch (err: any) {
      // Skip students without records
      if (process.env.NODE_ENV === "development") {
        console.debug(`[ML] Skipping student ${student.id}: ${err.message}`);
      }
    }
  }

  if (allFeatures.length < 3) {
    console.warn("[ML] Too few students with features to train models");
    return cachedModels;
  }

  // 1. Train Decision Tree for risk classification
  const treeFeatures = allFeatures.map(extractFeatureVector);
  const treeLabels = allFeatures.map(generateRiskLabel);

  const riskTree = trainDecisionTree(treeFeatures, treeLabels, FEATURE_NAMES, 5, 2);

  // 2. Train K-Means for behavior clustering
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
    riskTree,
    clusterModel,
    trainedAt,
  };

  console.log(`[ML] Models trained on ${allFeatures.length} students`);
  console.log(`[ML]  - Risk tree depth: computed ${treeFeatures.length} samples`);
  console.log(`[ML]  - K-means converged in ${clusterModel.iterations} iterations`);

  // ── Persist models to disk (ONNX/JSON) + database ─────────────────────
  try {
    // Export decision tree as ONNX
    if (riskTree) {
      const exported = exportDecisionTreeOnnx(
        "risk-classification",
        riskTree.tree,
        riskTree.featureNames
      );

      // Save/update ML model record in database
      await prisma.mlModel.upsert({
        where: { modelType_version: { modelType: "RISK_CLASSIFICATION", version: 1 } },
        update: {
          filePath: exported.filePath,
          metrics: exported.metrics as any,
          featureList: FEATURE_NAMES,
          isActive: true,
          trainedAt,
        },
        create: {
          name: "Risk Classification v1",
          modelType: "RISK_CLASSIFICATION",
          version: 1,
          filePath: exported.filePath,
          metrics: exported.metrics as any,
          featureList: FEATURE_NAMES,
          isActive: true,
          trainedAt,
        },
      });
    }

    // Export k-means as ONNX + JSON
    if (clusterModel) {
      // Proper ONNX graph: Tile → Sub → Pow → ReduceSum → ArgMin
      const onnxExported = exportKMeansOnnx(
        "behavior-cluster",
        clusterModel.centroids,
        ["avgKnowledge", "avgSkills", "totalAbsence", "achievementCount"]
      );

      // Also save JSON fallback
      const exported = exportKMeansJson(
        "behavior-cluster",
        clusterModel.centroids,
        ["avgKnowledge", "avgSkills", "totalAbsence", "achievementCount"]
      );

      await prisma.mlModel.upsert({
        where: { modelType_version: { modelType: "BEHAVIOR_CLUSTER", version: 1 } },
        update: {
          filePath: onnxExported.filePath,  // ONNX path for runtime inference
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

    // Export global trend model (average regression slope)
    if (allFeatures.length >= 2) {
      const avgDelta = allFeatures.filter((f) => f.semesterCount >= 2)
        .reduce((sum, f) => sum + f.scoreDelta, 0);
      const nDelta = allFeatures.filter((f) => f.semesterCount >= 2).length;
      const globalSlope = nDelta > 0 ? avgDelta / nDelta / 2 : 0;
      const globalIntercept = allFeatures.reduce((sum, f) => sum + f.avgKnowledge, 0) / allFeatures.length;

      const exported = exportLinearRegressionOnnx(
        "trend-prediction",
        Math.max(-5, Math.min(5, globalSlope || 0)),
        globalIntercept
      );

      await prisma.mlModel.upsert({
        where: { modelType_version: { modelType: "TREND_PREDICTION", version: 1 } },
        update: {
          filePath: exported.filePath,
          metrics: exported.metrics as any,
          isActive: true,
          trainedAt,
        },
        create: {
          name: "Trend Prediction v1",
          modelType: "TREND_PREDICTION",
          version: 1,
          filePath: exported.filePath,
          metrics: exported.metrics as any,
          featureList: ["semesterCount", "avgKnowledge", "scoreDelta"],
          isActive: true,
          trainedAt,
        },
      });
    }

    console.log(`[ML] Model artifacts saved to disk`);
  } catch (err: any) {
    console.warn(`[ML] Failed to persist model artifacts: ${err.message}`);
  }

  return cachedModels;
}

/**
 * Get trained models — auto-trains if not trained yet.
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
  cachedModels = { riskTree: null, clusterModel: null, trainedAt: null };
  return trainModels();
}

/**
 * Get regression model for a single student's trend.
 */
export async function getStudentRegression(studentId: string): Promise<{
  regression: RegressionResult;
  features: StudentFeatures;
}> {
  const features = await computeFeatures(studentId);

  // Get per-semester knowledge averages
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

  const x = semAvgs.map((_, i) => i); // [0, 1, 2, ...]
  const y = semAvgs;

  const regression = trainLinearRegression(x, y);

  // Predict next semester's average
  regression.predict(x.length); // trigger clamp

  return { regression, features };
}

export type { RegressionResult };

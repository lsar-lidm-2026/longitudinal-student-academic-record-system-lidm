/**
 * Model Evaluator — Real statistical evaluation metrics.
 *
 * Bukan LLM-based evaluation. Ini ngasih actual metrics:
 * - Feature distribution (mean, std, min, max)
 * - Data quality checks (missing values, outliers via IQR)
 * - K-Means internal metrics (inertia, silhouette score approximation)
 * - Risk scoring distribution
 * - Trend prediction residuals (historical prediction error)
 */

import type { StudentFeatures } from "./features";
import { evaluateRisk } from "./scoring-engine";
import type { KMeansResult } from "./models/k-means";

// ── Basic Statistics ──────────────────────────────────────────────

export interface FeatureStats {
  name: string;
  mean: number;
  std: number;
  min: number;
  max: number;
  q1: number;
  median: number;
  q3: number;
  missing: number;
  outlierCount: number;
}

export interface DistributionBucket {
  range: string;
  count: number;
  pct: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx] ?? 0;
}

function computeStats(values: number[], name: string): FeatureStats {
  const sorted = [...values].sort((a, b) => a - b);
  const n = values.length;
  const mean = n > 0 ? values.reduce((s, v) => s + v, 0) / n : 0;
  const variance = n > 0 ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / n : 0;
  const std = Math.sqrt(variance);

  // IQR-based outlier detection
  const q1 = percentile(sorted, 25);
  const q3 = percentile(sorted, 75);
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const outlierCount = values.filter((v) => v < lowerFence || v > upperFence).length;

  return {
    name,
    mean: round2(mean),
    std: round2(std),
    min: round2(sorted[0] ?? 0),
    max: round2(sorted[n - 1] ?? 0),
    q1: round2(q1),
    median: round2(percentile(sorted, 50)),
    q3: round2(q3),
    missing: values.filter((v) => v === 0 || isNaN(v)).length,
    outlierCount,
  };
}

function computeDistribution(values: number[], buckets: number = 5): DistributionBucket[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const bucketSize = range / buckets;

  const bucketNames = Array.from({ length: buckets }, (_, i) => {
    const lo = round2(min + i * bucketSize);
    const hi = round2(min + (i + 1) * bucketSize);
    return `${lo}-${hi}`;
  });

  const counts = new Array(buckets).fill(0);
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / bucketSize), buckets - 1);
    counts[idx]++;
  }

  return counts.map((count, i) => ({
    range: bucketNames[i],
    count,
    pct: round2((count / values.length) * 100),
  }));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Feature Analysis ──────────────────────────────────────────────

export interface FeatureAnalysis {
  nStudents: number;
  features: FeatureStats[];
  dataQuality: {
    missingDataPct: number;
    warnings: string[];
  };
  distributions: Record<string, DistributionBucket[]>;
}

export function analyzeFeatures(allFeatures: StudentFeatures[]): FeatureAnalysis {
  if (allFeatures.length === 0) {
    return { nStudents: 0, features: [], dataQuality: { missingDataPct: 0, warnings: ["No data"] }, distributions: {} };
  }

  const warnings: string[] = [];
  const featureNames: (keyof StudentFeatures)[] = [
    "avgKnowledge", "avgSkills", "scoreVolatility", "scoreDelta",
    "totalAbsence", "achievementCount", "semesterCount",
  ];

  const features: FeatureStats[] = featureNames.map((name) => {
    const values = allFeatures.map((f) => Number(f[name]) || 0);
    return computeStats(values, name);
  });

  // Data quality checks
  const studentsWithoutRecords = allFeatures.filter((f) => f.semesterCount === 0).length;
  if (studentsWithoutRecords > 0) {
    warnings.push(`${studentsWithoutRecords} siswa tidak punya semester records (${round2((studentsWithoutRecords / allFeatures.length) * 100)}%)`);
  }

  const studentsWithSingleRecord = allFeatures.filter((f) => f.semesterCount === 1).length;
  if (studentsWithSingleRecord > 0) {
    warnings.push(`${studentsWithSingleRecord} siswa baru punya 1 semester — trend analysis not reliable`);
  }

  const volatileStudents = allFeatures.filter((f) => f.scoreVolatility > 20 && f.semesterCount >= 2).length;
  if (volatileStudents > 5) {
    warnings.push(`${volatileStudents} siswa punya volatilitas > 20 — possible data entry issues`);
  }

  const distributions: Record<string, DistributionBucket[]> = {};
  for (const f of features) {
    distributions[f.name] = computeDistribution(
      allFeatures.map((sf) => Number(sf[f.name as keyof StudentFeatures]) || 0)
    );
  }

  return {
    nStudents: allFeatures.length,
    features,
    dataQuality: {
      missingDataPct: round2((studentsWithoutRecords / allFeatures.length) * 100),
      warnings,
    },
    distributions,
  };
}

// ── Risk Scoring Distribution ─────────────────────────────────────

export interface RiskDistribution {
  total: number;
  aman: number;
  waspada: number;
  kritis: number;
  pctAman: number;
  pctWaspada: number;
  pctKritis: number;
  avgScore: number;
  scoreHistogram: DistributionBucket[];
}

export function analyzeRiskDistribution(allFeatures: StudentFeatures[]): RiskDistribution {
  if (allFeatures.length === 0) {
    return { total: 0, aman: 0, waspada: 0, kritis: 0, pctAman: 0, pctWaspada: 0, pctKritis: 0, avgScore: 0, scoreHistogram: [] };
  }

  const results = allFeatures.map((f) =>
    evaluateRisk({
      avgKnowledge: f.avgKnowledge,
      scoreVolatility: f.scoreVolatility,
      totalAbsence: f.totalAbsence,
      scoreDelta: f.scoreDelta,
      semesterCount: f.semesterCount,
      achievementCount: f.achievementCount,
    })
  );

  const aman = results.filter((r) => r.level === "AMAN").length;
  const waspada = results.filter((r) => r.level === "WASPADA").length;
  const kritis = results.filter((r) => r.level === "KRITIS").length;
  const avgScore = results.reduce((s, r) => s + r.score, 0) / results.length;

  return {
    total: results.length,
    aman,
    waspada,
    kritis,
    pctAman: round2((aman / results.length) * 100),
    pctWaspada: round2((waspada / results.length) * 100),
    pctKritis: round2((kritis / results.length) * 100),
    avgScore: round2(avgScore),
    scoreHistogram: computeDistribution(results.map((r) => r.score), 10),
  };
}

// ── K-Means Evaluation ────────────────────────────────────────────

export interface ClusterEvaluation {
  nClusters: number;
  nSamples: number;
  inertia: number;
  clusterSizes: number[];
  avgDistanceToCentroid: number;
  silhouetteScore: number | null; // approximation
}

/**
 * Simplified silhouette score: measures how similar a point is to its own cluster
 * vs other clusters. Range [-1, 1], higher = better separation.
 * Approximation: only uses centroids, not all pairwise distances.
 */
function approximateSilhouette(
  data: number[][],
  labels: number[],
  centroids: number[][]
): number | null {
  const n = data.length;
  if (n === 0 || centroids.length < 2) return null;

  let totalScore = 0;
  let scored = 0;

  for (let i = 0; i < n; i++) {
    const label = labels[i];
    const point = data[i];

    // Average distance to same-cluster points (a)
    const sameCluster = data.filter((_, j) => labels[j] === label);
    const a =
      sameCluster.length > 1
        ? sameCluster.reduce((sum, p) => sum + euclidean(point, p), 0) / (sameCluster.length - 1)
        : 0;

    // Average distance to nearest other cluster (b)
    let b = Infinity;
    for (let c = 0; c < centroids.length; c++) {
      if (c === label) continue;
      const otherCluster = data.filter((_, j) => labels[j] === c);
      if (otherCluster.length === 0) continue;
      const avgDist = otherCluster.reduce((sum, p) => sum + euclidean(point, p), 0) / otherCluster.length;
      b = Math.min(b, avgDist);
    }

    if (b === Infinity) continue;
    const si = (b - a) / Math.max(a, b);
    totalScore += si;
    scored++;
  }

  return scored > 0 ? totalScore / scored : null;
}

function euclidean(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

export function evaluateCluster(
  data: number[][],
  result: KMeansResult
): ClusterEvaluation {
  const clusterSizes = new Array(result.centroids.length).fill(0);
  let totalDistance = 0;

  for (let i = 0; i < result.labels.length; i++) {
    const label = result.labels[i];
    clusterSizes[label]++;
    totalDistance += euclidean(data[i], result.centroids[label]);
  }

  const silhouette = approximateSilhouette(data, result.labels, result.centroids);

  return {
    nClusters: result.centroids.length,
    nSamples: data.length,
    inertia: round2(result.inertia),
    clusterSizes,
    avgDistanceToCentroid: round2(data.length > 0 ? totalDistance / data.length : 0),
    silhouetteScore: silhouette !== null ? round2(silhouette) : null,
  };
}

// ── Trend Evaluation ──────────────────────────────────────────────

export interface TrendEvaluation {
  totalStudents: number;
  studentsWithTrend: number;
  avgSlope: number;
  avgRSquared: number;
  improving: number;
  declining: number;
  stable: number;
  qualityWarnings: string[];
}

export function evaluateTrends(
  regressions: Array<{ slope: number; rSquared: number; nPoints: number }>
): TrendEvaluation {
  const warnings: string[] = [];
  const withData = regressions.filter((r) => r.nPoints >= 2);

  if (withData.length === 0) {
    return {
      totalStudents: regressions.length,
      studentsWithTrend: 0,
      avgSlope: 0,
      avgRSquared: 0,
      improving: 0,
      declining: 0,
      stable: 0,
      qualityWarnings: ["Tidak cukup data untuk analisis tren"],
    };
  }

  if (withData.length < regressions.length) {
    warnings.push(`${regressions.length - withData.length} siswa hanya punya 1 semester data`);
  }

  const avgSlope = withData.reduce((s, r) => s + r.slope, 0) / withData.length;
  const avgRSquared = withData.reduce((s, r) => s + r.rSquared, 0) / withData.length;
  const improving = withData.filter((r) => r.slope > 2).length;
  const declining = withData.filter((r) => r.slope < -2).length;
  const stable = withData.filter((r) => r.slope >= -2 && r.slope <= 2).length;

  if (avgRSquared < 0.3) {
    warnings.push("Rata-rata R² rendah (< 0.3) — prediksi tren mungkin tidak akurat");
  }

  return {
    totalStudents: regressions.length,
    studentsWithTrend: withData.length,
    avgSlope: round2(avgSlope),
    avgRSquared: round2(avgRSquared),
    improving,
    declining,
    stable,
    qualityWarnings: warnings,
  };
}

// ── Full Evaluation Report ────────────────────────────────────────

export interface EvaluationReport {
  generatedAt: string;
  nStudents: number;
  dataQuality: FeatureAnalysis["dataQuality"];
  featureStats: FeatureStats[];
  riskDistribution: RiskDistribution;
  clusterEvaluation: ClusterEvaluation | null;
  trendEvaluation: TrendEvaluation;
}

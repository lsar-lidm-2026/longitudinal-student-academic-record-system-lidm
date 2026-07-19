/**
 * model-evaluator.ts
 * 
 * Cara kerja file ini:
 * - Model Evaluator — menyediakan metrik evaluasi statistik yang nyata (bukan LLM-based).
 * - Fungsi-fungsi evaluasi untuk: distribusi fitur, kualitas data, K-Means clustering,
 *   distribusi risk scoring, dan prediksi tren.
 * - Semua perhitungan bersifat deterministic dan transparan.
 * 
 * Alur lengkap per bagian:
 * 
 * 1. computeStats(values, name):
 *    - Hitung mean, std, min, max, q1, median, q3 dari array numerik.
 *    - Deteksi outlier menggunakan metode IQR (Interquartile Range).
 *    - Return FeatureStats.
 * 
 * 2. computeDistribution(values, buckets):
 *    - Bagi rentang nilai menjadi N bucket.
 *    - Hitung count dan persentase per bucket.
 *    - Return array DistributionBucket.
 * 
 * 3. analyzeFeatures(allFeatures):
 *    - Untuk setiap fitur (avgKnowledge, avgSkills, dll), hitung statistik.
 *    - Cek kualitas data: siswa tanpa records, siswa dengan 1 semester, volatilitas tinggi.
 *    - Generate distribution histogram untuk setiap fitur.
 *    - Return FeatureAnalysis.
 * 
 * 4. analyzeRiskDistribution(allFeatures):
 *    - Untuk setiap siswa, panggil evaluateRisk().
 *    - Hitung distribusi level (AMAN/WASPADA/KRITIS) + rata-rata score.
 *    - Generate histogram skor risiko (10 buckets).
 *    - Return RiskDistribution.
 * 
 * 5. evaluateCluster(data, result):
 *    - Hitung clusterSizes (jumlah anggota per cluster).
 *    - Hitung avgDistanceToCentroid.
 *    - Hitung silhouette score approximation (bukan pairwise, centroid-based).
 *    - Return ClusterEvaluation.
 * 
 * 6. evaluateTrends(regressions):
 *    - Filter siswa dengan >= 2 semester data.
 *    - Hitung rata-rata slope dan R².
 *    - Kategorikan: improving (slope > 2), declining (slope < -2), stable.
 *    - Generate quality warnings.
 *    - Return TrendEvaluation.
 * 
 * Fungsi pembantu:
 * - percentile(sorted, p): hitung persentil ke-p dari array terurut.
 * - round2(n): bulatkan ke 2 desimal.
 * - euclidean(a, b): jarak Euclidean antara dua vektor.
 * - approximateSilhouette(data, labels, centroids): silhouette score approximation.
 */

import type { StudentFeatures } from "./features";
import { evaluateRisk } from "./scoring-engine";
import type { KMeansResult } from "./models/k-means";
import logger from "../../lib/logger";

// ── Basic Statistics ──────────────────────────────────────────────

/**
 * FeatureStats
 * 
 * Statistik deskriptif untuk satu fitur: mean, std, min, max, kuartil, outlier.
 */
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

/**
 * DistributionBucket
 * 
 * Satu bucket dalam histogram distribusi — rentang nilai, count, dan persentase.
 */
export interface DistributionBucket {
  range: string;
  count: number;
  pct: number;
}

/**
 * percentile
 * 
 * Menghitung persentil ke-p dari array yang sudah diurutkan.
 * Menggunakan linear interpolation antara nilai terdekat.
 * 
 * @param sorted - Array numerik yang sudah diurutkan ascending
 * @param p - Persentil yang diinginkan (0-100)
 * @returns Nilai pada persentil ke-p
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx] ?? 0;
}

/**
 * computeStats
 * 
 * Menghitung statistik deskriptif lengkap untuk satu fitur:
 * mean, standar deviasi, min, max, Q1, median, Q3, missing count, outlier count.
 * 
 * Outlier detection menggunakan metode IQR: nilai di luar [Q1 - 1.5*IQR, Q3 + 1.5*IQR].
 * 
 * @param values - Array nilai numerik untuk fitur tersebut
 * @param name - Nama fitur (untuk identifikasi)
 * @returns FeatureStats — statistik lengkap
 */
function computeStats(values: number[], name: string): FeatureStats {
  const sorted = [...values].sort((a, b) => a - b);
  const n = values.length;

  // Mean dan standar deviasi populasi
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

/**
 * computeDistribution
 * 
 * Membagi rentang nilai menjadi N bucket (equal-width) dan menghitung
 * frekuensi serta persentase per bucket.
 * 
 * @param values - Array nilai numerik
 * @param buckets - Jumlah bucket (default 5)
 * @returns Array DistributionBucket — histogram distribusi
 */
function computeDistribution(values: number[], buckets: number = 5): DistributionBucket[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1; // Hindari division by zero jika semua nilai sama
  const bucketSize = range / buckets;

  // Generate nama bucket: "lo-hi"
  const bucketNames = Array.from({ length: buckets }, (_, i) => {
    const lo = round2(min + i * bucketSize);
    const hi = round2(min + (i + 1) * bucketSize);
    return `${lo}-${hi}`;
  });

  // Hitung frekuensi per bucket
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

/**
 * round2
 * 
 * Membulatkan angka ke 2 desimal.
 * 
 * @param n - Angka yang akan dibulatkan
 * @returns Angka yang sudah dibulatkan ke 2 desimal
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Feature Analysis ──────────────────────────────────────────────

/**
 * FeatureAnalysis
 * 
 * Hasil analisis fitur untuk seluruh siswa — statistik per fitur + kualitas data.
 */
export interface FeatureAnalysis {
  nStudents: number;
  features: FeatureStats[];
  dataQuality: {
    missingDataPct: number;
    warnings: string[];
  };
  distributions: Record<string, DistributionBucket[]>;
}

/**
 * analyzeFeatures
 * 
 * Menganalisis distribusi fitur untuk seluruh siswa.
 * - Hitung statistik per fitur (mean, std, min, max, outlier, dll).
 * - Cek kualitas data: siswa tanpa records, siswa dengan 1 semester, volatilitas tinggi.
 * - Generate histogram distribusi untuk setiap fitur.
 * 
 * @param allFeatures - Array StudentFeatures untuk semua siswa
 * @returns FeatureAnalysis — statistik fitur + kualitas data
 */
export function analyzeFeatures(allFeatures: StudentFeatures[]): FeatureAnalysis {
  logger.info({ nStudents: allFeatures.length }, "analyzeFeatures called");

  if (allFeatures.length === 0) {
    logger.warn({}, "No features to analyze");
    return { nStudents: 0, features: [], dataQuality: { missingDataPct: 0, warnings: ["No data"] }, distributions: {} };
  }

  const warnings: string[] = [];

  // Daftar fitur yang akan dianalisis
  const featureNames: (keyof StudentFeatures)[] = [
    "avgKnowledge", "avgSkills", "scoreVolatility", "scoreDelta",
    "totalAbsence", "achievementCount", "semesterCount",
  ];

  // Hitung statistik untuk setiap fitur
  const features: FeatureStats[] = featureNames.map((name) => {
    const values = allFeatures.map((f) => Number(f[name]) || 0);
    return computeStats(values, name);
  });

  // Data quality checks

  // 1. Siswa tanpa semester records
  const studentsWithoutRecords = allFeatures.filter((f) => f.semesterCount === 0).length;
  if (studentsWithoutRecords > 0) {
    warnings.push(`${studentsWithoutRecords} siswa tidak punya semester records (${round2((studentsWithoutRecords / allFeatures.length) * 100)}%)`);
  }

  // 2. Siswa dengan hanya 1 semester — trend analysis tidak reliable
  const studentsWithSingleRecord = allFeatures.filter((f) => f.semesterCount === 1).length;
  if (studentsWithSingleRecord > 0) {
    warnings.push(`${studentsWithSingleRecord} siswa baru punya 1 semester — trend analysis not reliable`);
  }

  // 3. Siswa dengan volatilitas sangat tinggi — kemungkinan data entry issues
  const volatileStudents = allFeatures.filter((f) => f.scoreVolatility > 20 && f.semesterCount >= 2).length;
  if (volatileStudents > 5) {
    warnings.push(`${volatileStudents} siswa punya volatilitas > 20 — possible data entry issues`);
  }

  // Generate histogram distribusi untuk setiap fitur
  const distributions: Record<string, DistributionBucket[]> = {};
  for (const f of features) {
    distributions[f.name] = computeDistribution(
      allFeatures.map((sf) => Number(sf[f.name as keyof StudentFeatures]) || 0)
    );
  }

  logger.info({ nStudents: allFeatures.length, warningCount: warnings.length }, "analyzeFeatures completed");
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

/**
 * RiskDistribution
 * 
 * Distribusi level risiko untuk seluruh siswa — count dan persentase per level.
 */
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

/**
 * analyzeRiskDistribution
 * 
 * Menganalisis distribusi risk score untuk seluruh siswa.
 * 
 * @param allFeatures - Array StudentFeatures untuk semua siswa
 * @returns RiskDistribution — distribusi level risiko + histogram
 */
export function analyzeRiskDistribution(allFeatures: StudentFeatures[]): RiskDistribution {
  logger.info({ nStudents: allFeatures.length }, "analyzeRiskDistribution called");

  if (allFeatures.length === 0) {
    return { total: 0, aman: 0, waspada: 0, kritis: 0, pctAman: 0, pctWaspada: 0, pctKritis: 0, avgScore: 0, scoreHistogram: [] };
  }

  // Hitung risk score untuk setiap siswa
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

  // Hitung distribusi level
  const aman = results.filter((r) => r.level === "AMAN").length;
  const waspada = results.filter((r) => r.level === "WASPADA").length;
  const kritis = results.filter((r) => r.level === "KRITIS").length;
  const avgScore = results.reduce((s, r) => s + r.score, 0) / results.length;

  logger.info(
    { total: results.length, aman, waspada, kritis, avgScore: round2(avgScore) },
    "analyzeRiskDistribution completed"
  );

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

/**
 * ClusterEvaluation
 * 
 * Metrik evaluasi untuk hasil K-Means clustering.
 */
export interface ClusterEvaluation {
  nClusters: number;
  nSamples: number;
  inertia: number;
  clusterSizes: number[];
  avgDistanceToCentroid: number;
  silhouetteScore: number | null; // approximation, not exact pairwise
}

/**
 * approximateSilhouette
 * 
 * Simplified silhouette score: mengukur seberapa mirip suatu titik dengan
 * clusternya sendiri vs cluster lain. Rentang [-1, 1], semakin tinggi = semakin baik.
 * 
 * Approximation: menggunakan semua pairwise distances dalam cluster,
 * bukan hanya centroid. Ini lebih akurat daripada centroid-only approximation.
 * 
 * @param data - Array data points (feature vectors)
 * @param labels - Array cluster labels untuk setiap data point
 * @param centroids - Array centroid setiap cluster
 * @returns Silhouette score rata-rata, atau null jika tidak bisa dihitung
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

    // Average distance to same-cluster points (a) — cohesion
    const sameCluster = data.filter((_, j) => labels[j] === label);
    const a =
      sameCluster.length > 1
        ? sameCluster.reduce((sum, p) => sum + euclidean(point, p), 0) / (sameCluster.length - 1)
        : 0;

    // Average distance to nearest other cluster (b) — separation
    let b = Infinity;
    for (let c = 0; c < centroids.length; c++) {
      if (c === label) continue;
      const otherCluster = data.filter((_, j) => labels[j] === c);
      if (otherCluster.length === 0) continue;
      const avgDist = otherCluster.reduce((sum, p) => sum + euclidean(point, p), 0) / otherCluster.length;
      b = Math.min(b, avgDist);
    }

    if (b === Infinity) continue;
    // Silhouette formula: (b - a) / max(a, b)
    const si = (b - a) / Math.max(a, b);
    totalScore += si;
    scored++;
  }

  return scored > 0 ? totalScore / scored : null;
}

/**
 * euclidean
 * 
 * Menghitung jarak Euclidean antara dua vektor.
 * 
 * @param a - Vektor pertama
 * @param b - Vektor kedua
 * @returns Jarak Euclidean
 */
export function euclidean(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

/**
 * evaluateCluster
 * 
 * Evaluasi hasil K-Means clustering:
 * - Hitung cluster sizes (jumlah anggota per cluster).
 * - Hitung rata-rata jarak ke centroid.
 * - Hitung silhouette score approximation.
 * 
 * @param data - Array data points (feature vectors yang sudah dinormalisasi)
 * @param result - KMeansResult dari training K-Means
 * @returns ClusterEvaluation — metrik evaluasi clustering
 */
export function evaluateCluster(
  data: number[][],
  result: KMeansResult
): ClusterEvaluation {
  logger.info({ nClusters: result.centroids.length, nSamples: data.length }, "evaluateCluster called");

  const clusterSizes = new Array(result.centroids.length).fill(0);
  let totalDistance = 0;

  // Iterasi setiap data point dan hitung jarak ke centroid-nya
  for (let i = 0; i < result.labels.length; i++) {
    const label = result.labels[i];
    clusterSizes[label]++;
    totalDistance += euclidean(data[i], result.centroids[label]);
  }

  const silhouette = approximateSilhouette(data, result.labels, result.centroids);

  const evaluation: ClusterEvaluation = {
    nClusters: result.centroids.length,
    nSamples: data.length,
    inertia: round2(result.inertia),
    clusterSizes,
    avgDistanceToCentroid: round2(data.length > 0 ? totalDistance / data.length : 0),
    silhouetteScore: silhouette !== null ? round2(silhouette) : null,
  };

  logger.info(
    { inertia: evaluation.inertia, silhouetteScore: evaluation.silhouetteScore },
    "evaluateCluster completed"
  );

  return evaluation;
}

// ── Trend Evaluation ──────────────────────────────────────────────

/**
 * TrendEvaluation
 * 
 * Metrik evaluasi untuk hasil trend prediction (linear regression) seluruh siswa.
 */
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

/**
 * evaluateTrends
 * 
 * Evaluasi hasil regresi linear untuk seluruh siswa:
 * - Filter siswa dengan >= 2 semester data.
 * - Hitung rata-rata slope dan R².
 * - Kategorikan: improving (slope > 2), declining (slope < -2), stable.
 * - Generate quality warnings (R² rendah, data tidak cukup).
 * 
 * @param regressions - Array hasil regresi per siswa (slope, rSquared, nPoints)
 * @returns TrendEvaluation — statistik tren + peringatan kualitas
 */
export function evaluateTrends(
  regressions: Array<{ slope: number; rSquared: number; nPoints: number }>
): TrendEvaluation {
  logger.info({ totalStudents: regressions.length }, "evaluateTrends called");

  const warnings: string[] = [];

  // Filter siswa dengan minimal 2 semester data (cukup untuk regresi linear)
  const withData = regressions.filter((r) => r.nPoints >= 2);

  if (withData.length === 0) {
    logger.warn({}, "No students with sufficient data for trend evaluation");
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

  // Peringatan: ada siswa dengan hanya 1 semester data
  if (withData.length < regressions.length) {
    warnings.push(`${regressions.length - withData.length} siswa hanya punya 1 semester data`);
  }

  // Hitung rata-rata slope dan R²
  const avgSlope = withData.reduce((s, r) => s + r.slope, 0) / withData.length;
  const avgRSquared = withData.reduce((s, r) => s + r.rSquared, 0) / withData.length;

  // Kategorisasi: improving (slope > 2), declining (slope < -2), stable
  const improving = withData.filter((r) => r.slope > 2).length;
  const declining = withData.filter((r) => r.slope < -2).length;
  const stable = withData.filter((r) => r.slope >= -2 && r.slope <= 2).length;

  // Peringatan jika R² rata-rata rendah
  if (avgRSquared < 0.3) {
    warnings.push("Rata-rata R² rendah (< 0.3) — prediksi tren mungkin tidak akurat");
  }

  logger.info(
    { studentsWithTrend: withData.length, avgSlope: round2(avgSlope), avgRSquared: round2(avgRSquared) },
    "evaluateTrends completed"
  );

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

/**
 * EvaluationReport
 * 
 * Laporan evaluasi lengkap — menggabungkan semua metrik evaluasi.
 */
export interface EvaluationReport {
  generatedAt: string;
  nStudents: number;
  dataQuality: FeatureAnalysis["dataQuality"];
  featureStats: FeatureStats[];
  riskDistribution: RiskDistribution;
  clusterEvaluation: ClusterEvaluation | null;
  trendEvaluation: TrendEvaluation;
}

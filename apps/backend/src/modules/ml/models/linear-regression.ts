/**
 * linear-regression.ts
 * 
 * Cara kerja file ini:
 * - Implementasi Linear Regression menggunakan Ordinary Least Squares (OLS) method.
 * - Murni TypeScript tanpa dependensi eksternal.
 * - Digunakan untuk trend prediction: memprediksi nilai akademik siswa di semester
 *   mendatang berdasarkan data historis.
 * 
 * Alur lengkap trainLinearRegression(x, y):
 * 1. Validasi: jika n < 2 (data tidak cukup), return flat prediction (mean Y).
 * 2. Hitung sumX, sumY, sumXY, sumX² untuk rumus OLS.
 * 3. Hitung slope (m):
 *      m = (n * Σxy - Σx * Σy) / (n * Σx² - (Σx)²)
 * 4. Hitung intercept (b):
 *      b = ȳ - m * x̄
 * 5. Hitung R² (coefficient of determination):
 *      ssRes = Σ(yi - ŷi)²  (residual sum of squares)
 *      ssTot = Σ(yi - ȳ)²   (total sum of squares)
 *      R² = 1 - ssRes/ssTot
 * 6. Return RegressionResult dengan fungsi predict() yang di-clamp ke [0, 100].
 * 
 * Catatan:
 * - R² asli, bukan hardcoded atau fabricated.
 * - Predict di-clamp ke [0, 100] karena nilai akademik tidak mungkin di luar rentang itu.
 */

import logger from "../../../lib/logger";

/**
 * RegressionResult
 * 
 * Hasil training Linear Regression: slope, intercept, R², dan fungsi predict.
 */
export interface RegressionResult {
  /** Slope (kemiringan garis regresi) — positif = naik, negatif = turun */
  slope: number;
  /** Intercept (titik potong sumbu Y) */
  intercept: number;
  /** R² (coefficient of determination) — 0-1, ukuran seberapa baik model拟合 data */
  rSquared: number;
  /**
   * Fungsi predict: memprediksi nilai Y untuk input X tertentu.
   * Hasil di-clamp ke [0, 100] (rentang nilai akademik).
   */
  predict(x: number): number;
}

/**
 * trainLinearRegression
 * 
 * Melatih model Linear Regression menggunakan metode OLS (Ordinary Least Squares).
 * 
 * Proses:
 * 1. Jika n < 2, return flat prediction (rata-rata Y) — tidak cukup data untuk regresi.
 * 2. Hitung slope (m) dan intercept (b) menggunakan rumus OLS.
 * 3. Hitung R² untuk mengukur kualitas model.
 * 4. Return RegressionResult dengan fungsi predict() yang ter-clamp.
 * 
 * @param x - Array nilai independen (biasanya indeks semester: 0, 1, 2, ...)
 * @param y - Array nilai dependen (rata-rata nilai per semester)
 * @returns RegressionResult — slope, intercept, rSquared, dan fungsi predict
 */
export function trainLinearRegression(
  x: number[],
  y: number[]
): RegressionResult {
  const n = x.length;
  logger.debug({ n }, "trainLinearRegression called");

  // Guard: tidak cukup data untuk regresi linear (minimal 2 titik)
  if (n < 2) {
    const meanY = y.length > 0 ? y.reduce((a, b) => a + b, 0) / y.length : 0;
    logger.warn({ n, meanY }, "Insufficient data for linear regression, returning flat prediction");
    return {
      slope: 0,
      intercept: meanY,
      rSquared: 0,
      predict: () => meanY,
    };
  }

  // ── Hitung komponen untuk OLS ──
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

  // ── Slope (m) — OLS formula ──
  // m = (n*Σxy - Σx*Σy) / (n*Σx² - (Σx)²)
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  // ── Intercept (b) ──
  // b = (Σy - m*Σx) / n
  const intercept = (sumY - slope * sumX) / n;

  // ── Hitung R² (coefficient of determination) ──
  const meanY = sumY / n;
  // ssRes: residual sum of squares — Σ(yi - ŷi)²
  const ssRes = y.reduce((sum, yi, i) => {
    const pred = slope * x[i] + intercept;
    return sum + (yi - pred) ** 2;
  }, 0);
  // ssTot: total sum of squares — Σ(yi - ȳ)²
  const ssTot = y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0);
  // R² = 1 - ssRes/ssTot. Jika ssTot = 0 (semua nilai Y sama), R² = 0.
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  logger.debug({ slope, intercept, rSquared: Math.round(rSquared * 100) / 100 }, "Linear regression computed");

  return {
    slope,
    intercept,
    rSquared,
    // Fungsi predict: clamp ke [0, 100] karena nilai akademik tidak mungkin di luar rentang itu
    predict: (xVal: number) => Math.max(0, Math.min(100, slope * xVal + intercept)),
  };
}

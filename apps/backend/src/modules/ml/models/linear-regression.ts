/**
 * Linear Regression — Ordinary Least Squares (OLS)
 * m = (n*Σxy - Σx*Σy) / (n*Σx² - (Σx)²)
 * b = ȳ - m*x̄
 *
 * Pure TypeScript, zero external dependencies.
 */

export interface RegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
  predict(x: number): number;
}

export function trainLinearRegression(
  x: number[],
  y: number[]
): RegressionResult {
  const n = x.length;
  if (n < 2) {
    // Not enough data — return flat prediction (mean)
    const meanY = y.length > 0 ? y.reduce((a, b) => a + b, 0) / y.length : 0;
    return {
      slope: 0,
      intercept: meanY,
      rSquared: 0,
      predict: () => meanY,
    };
  }

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // R² calculation
  const meanY = sumY / n;
  const ssRes = y.reduce((sum, yi, i) => {
    const pred = slope * x[i] + intercept;
    return sum + (yi - pred) ** 2;
  }, 0);
  const ssTot = y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0);
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return {
    slope,
    intercept,
    rSquared,
    predict: (xVal: number) => Math.max(0, Math.min(100, slope * xVal + intercept)),
  };
}

/**
 * K-Means Clustering — Lloyd's algorithm with k-means++ initialization.
 * Pure TypeScript, zero external dependencies.
 */

/**
 * Compute Euclidean distance between two vectors.
 */
function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

/**
 * Initialize centroids using k-means++ algorithm.
 */
function initializeCentroids(data: number[][], k: number): number[][] {
  if (data.length === 0) return [];

  // Pick first centroid randomly
  const centroids: number[][] = [data[Math.floor(Math.random() * data.length)]];

  for (let c = 1; c < k; c++) {
    // Compute distances from each point to nearest centroid
    const distances = data.map((point) => {
      const minDist = Math.min(
        ...centroids.map((centroid) => euclideanDistance(point, centroid))
      );
      return minDist * minDist; // squared distance for probability
    });

    const totalDist = distances.reduce((a, b) => a + b, 0);
    if (totalDist === 0) {
      // All points are the same — pick random remaining
      centroids.push(data[Math.floor(Math.random() * data.length)]);
      continue;
    }

    // Weighted random selection
    let r = Math.random() * totalDist;
    for (let i = 0; i < data.length; i++) {
      r -= distances[i];
      if (r <= 0) {
        centroids.push(data[i]);
        break;
      }
    }
  }

  return centroids;
}

export interface KMeansResult {
  centroids: number[][];
  labels: number[]; // cluster assignment for each data point
  iterations: number;
  inertia: number; // sum of squared distances to centroids
  predict(point: number[]): number;
}

export function trainKMeans(
  data: number[][],
  k: number = 3,
  maxIterations: number = 100
): KMeansResult {
  if (data.length === 0) {
    return {
      centroids: [],
      labels: [],
      iterations: 0,
      inertia: 0,
      predict: () => 0,
    };
  }

  const n = data.length;
  const actualK = Math.min(k, n);
  let centroids = initializeCentroids(data, actualK);
  let labels: number[] = new Array(n).fill(0);
  let iterations = 0;
  let hasConverged = false;

  while (!hasConverged && iterations < maxIterations) {
    iterations++;

    // Assign each point to nearest centroid
    let changed = false;
    for (let i = 0; i < n; i++) {
      let minDist = Infinity;
      let nearest = 0;
      for (let j = 0; j < actualK; j++) {
        const dist = euclideanDistance(data[i], centroids[j]);
        if (dist < minDist) {
          minDist = dist;
          nearest = j;
        }
      }
      if (labels[i] !== nearest) {
        labels[i] = nearest;
        changed = true;
      }
    }

    // Recompute centroids
    const newCentroids: number[][] = [];
    for (let j = 0; j < actualK; j++) {
      const members = data.filter((_, i) => labels[i] === j);
      if (members.length === 0) {
        // Empty cluster — keep old centroid
        newCentroids.push([...centroids[j]]);
      } else {
        const dim = members[0].length;
        const centroid: number[] = new Array(dim).fill(0);
        for (const member of members) {
          for (let d = 0; d < dim; d++) {
            centroid[d] += member[d];
          }
        }
        for (let d = 0; d < dim; d++) {
          centroid[d] /= members.length;
        }
        newCentroids.push(centroid);
      }
    }

    centroids = newCentroids;

    if (!changed) {
      hasConverged = true;
    }
  }

  // Compute inertia (within-cluster sum of squared distances)
  let inertia = 0;
  for (let i = 0; i < n; i++) {
    inertia += euclideanDistance(data[i], centroids[labels[i]]) ** 2;
  }

  return {
    centroids,
    labels,
    iterations,
    inertia,
    predict: (point: number[]) => {
      let minDist = Infinity;
      let nearest = 0;
      for (let j = 0; j < centroids.length; j++) {
        const dist = euclideanDistance(point, centroids[j]);
        if (dist < minDist) {
          minDist = dist;
          nearest = j;
        }
      }
      return nearest;
    },
  };
}

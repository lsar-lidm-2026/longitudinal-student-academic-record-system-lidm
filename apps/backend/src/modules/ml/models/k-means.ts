/**
 * k-means.ts
 * 
 * Cara kerja file ini:
 * - Implementasi K-Means Clustering murni TypeScript tanpa dependensi eksternal.
 * - Menggunakan Lloyd's algorithm dengan k-means++ initialization.
 * - Digunakan untuk behavior clustering siswa berdasarkan feature vectors.
 * - Hasil training berupa centroid, label assignment, inertia, dan fungsi predict().
 * 
 * Alur lengkap trainKMeans(data, k, maxIterations):
 * 1. Validasi: jika data kosong, return default (centroids/labels kosong).
 * 2. Tentukan actualK = min(k, n) — tidak boleh melebihi jumlah data points.
 * 3. initializeCentroids() → k-means++ initialization:
 *    a. Pilih centroid pertama secara random dari data.
 *    b. Untuk setiap centroid berikutnya:
 *       - Hitung jarak setiap point ke centroid terdekat (squared distance).
 *       - Pilih point baru secara weighted random (berdasarkan jarak kuadrat).
 *       - Semakin jauh dari centroid existing, semakin besar probabilitas terpilih.
 * 4. Iterasi Lloyd's algorithm hingga konvergen atau maxIterations:
 *    a. Assignment step: assign setiap point ke centroid terdekat.
 *    b. Update step: hitung ulang centroid sebagai rata-rata anggota cluster.
 *    c. Jika tidak ada perubahan assignment → konvergen.
 * 5. Hitung inertia (within-cluster sum of squared distances).
 * 6. Return KMeansResult: centroids, labels, iterations, inertia, predict().
 * 
 * Fungsi predict(point):
 * - Untuk inference: cari centroid terdekat dari point input.
 * - Return index centroid (cluster assignment).
 */

import logger from "../../../lib/logger";

/**
 * euclideanDistance
 * 
 * Menghitung jarak Euclidean antara dua vektor.
 * 
 * @param a - Vektor pertama
 * @param b - Vektor kedua
 * @returns Jarak Euclidean (akar dari sum of squared differences)
 */
function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

/**
 * initializeCentroids
 * 
 * Inisialisasi centroid menggunakan k-means++ algorithm.
 * 
 * K-means++ memilih centroid awal secara cerdas:
 * - Centroid pertama dipilih random.
 * - Centroid berikutnya dipilih dengan probabilitas proporsional terhadap
 *   jarak kuadrat ke centroid terdekat yang sudah ada.
 * - Ini mengurangi kemungkinan konvergensi ke local optimum yang buruk.
 * 
 * @param data - Array data points (feature vectors)
 * @param k - Jumlah cluster yang diinginkan
 * @returns Array centroid (k buah vektor)
 */
function initializeCentroids(data: number[][], k: number): number[][] {
  if (data.length === 0) return [];

  // Centroid pertama: pilih random dari data
  const centroids: number[][] = [data[Math.floor(Math.random() * data.length)]];
  logger.debug({ k }, "Initializing centroids with k-means++");

  // Pilih centroid sisanya
  for (let c = 1; c < k; c++) {
    // Hitung jarak setiap point ke centroid terdekat yang sudah ada
    const distances = data.map((point) => {
      const minDist = Math.min(
        ...centroids.map((centroid) => euclideanDistance(point, centroid))
      );
      return minDist * minDist; // Squared distance untuk probabilitas
    });

    const totalDist = distances.reduce((a, b) => a + b, 0);
    if (totalDist === 0) {
      // Semua point sama — pilih random dari sisa data
      centroids.push(data[Math.floor(Math.random() * data.length)]);
      continue;
    }

    // Weighted random selection: semakin jauh, semakin besar probabilitas
    let r = Math.random() * totalDist;
    for (let i = 0; i < data.length; i++) {
      r -= distances[i];
      if (r <= 0) {
        centroids.push(data[i]);
        break;
      }
    }
  }

  logger.debug({ centroidCount: centroids.length }, "Centroids initialized");
  return centroids;
}

/**
 * KMeansResult
 * 
 * Hasil training K-Means: centroid, label assignment, metadata, dan fungsi predict.
 */
export interface KMeansResult {
  /** Array centroid — setiap centroid adalah vektor dengan dimensi yang sama dengan data */
  centroids: number[][];
  /** Cluster assignment untuk setiap data point (index ke centroid) */
  labels: number[];
  /** Jumlah iterasi yang dijalankan hingga konvergen */
  iterations: number;
  /** Inertia: within-cluster sum of squared distances — semakin kecil semakin baik */
  inertia: number;
  /**
   * Fungsi predict: untuk inference — mengembalikan index centroid terdekat
   * dari suatu point input.
   */
  predict(point: number[]): number;
}

/**
 * trainKMeans
 * 
 * Melatih model K-Means clustering menggunakan Lloyd's algorithm.
 * 
 * Proses:
 * 1. Validasi input → inisialisasi centroid (k-means++).
 * 2. Iterasi: assign → update hingga konvergen atau max iterasi.
 * 3. Hitung inertia.
 * 4. Return KMeansResult dengan fungsi predict().
 * 
 * @param data - Array data points (masing-masing adalah vektor numerik)
 * @param k - Jumlah cluster (default 3)
 * @param maxIterations - Maksimum iterasi (default 100)
 * @returns KMeansResult — centroid, labels, metadata, dan fungsi predict
 */
export function trainKMeans(
  data: number[][],
  k: number = 3,
  maxIterations: number = 100
): KMeansResult {
  logger.info({ dataPoints: data.length, k, maxIterations }, "trainKMeans called");

  // Guard: data kosong
  if (data.length === 0) {
    logger.warn({}, "No data points provided to K-Means");
    return {
      centroids: [],
      labels: [],
      iterations: 0,
      inertia: 0,
      predict: () => 0,
    };
  }

  const n = data.length;
  const actualK = Math.min(k, n); // Tidak boleh melebihi jumlah data points

  // Inisialisasi centroid dengan k-means++
  let centroids = initializeCentroids(data, actualK);
  let labels: number[] = new Array(n).fill(0); // Label assignment per point
  let iterations = 0;
  let hasConverged = false;

  // ── Lloyd's algorithm ──
  while (!hasConverged && iterations < maxIterations) {
    iterations++;

    // ── Assignment step: assign setiap point ke centroid terdekat ──
    let changed = false;
    for (let i = 0; i < n; i++) {
      let minDist = Infinity;
      let nearest = 0;
      // Cari centroid terdekat untuk point ini
      for (let j = 0; j < actualK; j++) {
        const dist = euclideanDistance(data[i], centroids[j]);
        if (dist < minDist) {
          minDist = dist;
          nearest = j;
        }
      }
      if (labels[i] !== nearest) {
        labels[i] = nearest;
        changed = true; // Ada perubahan assignment
      }
    }

    // ── Update step: hitung ulang centroid sebagai rata-rata anggota ──
    const newCentroids: number[][] = [];
    for (let j = 0; j < actualK; j++) {
      // Ambil semua data point yang ter-assign ke cluster j
      const members = data.filter((_, i) => labels[i] === j);
      if (members.length === 0) {
        // Cluster kosong — pertahankan centroid lama
        newCentroids.push([...centroids[j]]);
      } else {
        // Hitung rata-rata (mean) dari semua anggota cluster
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

    // Jika tidak ada perubahan assignment → sudah konvergen
    if (!changed) {
      hasConverged = true;
    }
  }

  // ── Hitung inertia (within-cluster sum of squared distances) ──
  let inertia = 0;
  for (let i = 0; i < n; i++) {
    inertia += euclideanDistance(data[i], centroids[labels[i]]) ** 2;
  }

  logger.info(
    { iterations, inertia: Math.round(inertia * 100) / 100, hasConverged },
    "trainKMeans completed"
  );

  return {
    centroids,
    labels,
    iterations,
    inertia,
    // Fungsi predict: untuk inference — cari centroid terdekat dari point baru
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

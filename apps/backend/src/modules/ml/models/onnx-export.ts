/**
 * onnx-export.ts
 * 
 * Cara kerja file ini:
 * - ONNX Model Exporter — menghasilkan file model ONNX protobuf yang valid.
 * - Menggunakan library `onnx-proto` (protobufjs wrapper) untuk membuat objek
 *   ModelProto ONNX dan men-serialize-nya ke file binary .onnx.
 * - Saat ini hanya mengekspor K-Means clustering sebagai computation graph ONNX.
 * - Juga menyimpan versi JSON sebagai fallback untuk JS inference.
 * 
 * Alur lengkap exportKMeansOnnx(modelName, centroids, featureNames):
 * 1. Pastikan direktori model (env.modelPath) ada.
 * 2. Flatten centroids (2D → 1D array) untuk disimpan sebagai tensor.
 * 3. Juga simpan versi JSON untuk fallback.
 * 4. Buat ModelProto ONNX dengan:
 *    - Input: X (float32, shape [1, nFeatures])
 *    - Output: cluster_id (int64, scalar)
 *    - Initializer: centroids tensor, repeats tensor, pow_exp tensor, sum_axes tensor.
 *    - Nodes (computation graph):
 *      a. Tile(X, repeats) → tiled [nClusters, nFeatures]
 *      b. Sub(tiled, centroids) → diff [nClusters, nFeatures]
 *      c. Pow(diff, 2) → squared [nClusters, nFeatures]
 *      d. ReduceSum(squared, axis=1, keepdims=0) → distances [nClusters]
 *      e. ArgMin(distances, axis=0, keepdims=0) → cluster_id (scalar)
 * 5. Encode ModelProto ke buffer binary → tulis ke file .onnx.
 * 6. Return OnnxExportResult { filePath, modelType, format, metrics }.
 * 
 * Fungsi lain:
 * - exportKMeansJson(): menyimpan model sebagai JSON untuk JS fallback.
 * - makeTensor(): helper untuk membuat TensorProto ONNX.
 * - makeValueInfo(): helper untuk membuat ValueInfoProto (type/shape info).
 * - float32ToBytes() / int64ToBytes(): konversi number ke binary buffer.
 * 
 * Catatan:
 * - Computation graph menggunakan ONNX standard ops saja (Tile, Sub, Pow, ReduceSum, ArgMin).
 * - Tidak ada custom ops — compatible dengan ONNX Runtime.
 */

import { env } from "../../../config/env";
import * as path from "path";
import * as fs from "fs";
import logger from "../../../lib/logger";

// onnx-proto provides the compiled ONNX protobuf types
import onnxMod from "onnx-proto";
const $onnx = (onnxMod as any).onnx;

/**
 * OnnxExportResult
 * 
 * Hasil export model ONNX — berisi path file, tipe model, format, dan metadata.
 */
export interface OnnxExportResult {
  /** Path absolut ke file yang dihasilkan */
  filePath: string;
  /** Tipe model (TREND_PREDICTION, RISK_CLASSIFICATION, BEHAVIOR_CLUSTER) */
  modelType: "TREND_PREDICTION" | "RISK_CLASSIFICATION" | "BEHAVIOR_CLUSTER";
  /** Format file: "onnx" atau "json" */
  format: "onnx" | "json";
  /** Metrik/metadata model (jumlah cluster, dimensi, dll) */
  metrics: Record<string, number>;
}

/**
 * float32ToBytes
 * 
 * Mengonversi nilai float32 JavaScript ke Buffer 4-byte (little-endian).
 * 
 * @param value - Nilai float yang akan dikonversi
 * @returns Buffer 4-byte berisi representasi float32 LE
 */
function float32ToBytes(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeFloatLE(value, 0);
  return buf;
}

/**
 * int64ToBytes
 * 
 * Mengonversi nilai integer JavaScript ke Buffer 8-byte (little-endian).
 * 
 * @param value - Nilai integer yang akan dikonversi
 * @returns Buffer 8-byte berisi representasi int64 LE
 */
function int64ToBytes(value: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64LE(BigInt(value), 0);
  return buf;
}

/**
 * makeTensor
 * 
 * Membuat objek TensorProto ONNX dari data numerik.
 * Mendukung float32 (dataType=1) dan int64 (dataType=7).
 * 
 * @param name - Nama tensor
 * @param data - Array nilai numerik (akan di-flatten otomatis)
 * @param dims - Array dimensi tensor (shape)
 * @param dataType - Tipe data ONNX: 1=FLOAT, 7=INT64 (default 1)
 * @returns TensorProto ONNX yang siap dimasukkan ke initializer
 */
function makeTensor(
  name: string,
  data: number[],
  dims: number[],
  dataType: number = 1 // 1=FLOAT, 7=INT64
) {
  const isFloat = dataType === 1;
  // Konversi ke raw binary sesuai tipe data
  const rawData = isFloat
    ? Buffer.concat(data.map(float32ToBytes))
    : Buffer.concat(data.map(int64ToBytes));

  return $onnx.TensorProto.create({
    name,
    dataType,
    dims,
    rawData,
  });
}

/**
 * makeValueInfo
 * 
 * Membuat objek ValueInfoProto ONNX — mendefinisikan nama, tipe, dan shape
 * dari input/output tensor.
 * 
 * @param name - Nama value info
 * @param dims - Array dimensi (shape). Array kosong = scalar.
 * @param elemType - Tipe elemen ONNX: 1=float32, 7=int64 (default 1)
 * @returns ValueInfoProto ONNX
 */
function makeValueInfo(name: string, dims: number[], elemType: number = 1) {
  return $onnx.ValueInfoProto.create({
    name,
    type: $onnx.TypeProto.create({
      tensorType: $onnx.TypeProto.Tensor.create({
        elemType,
        shape: $onnx.TensorShapeProto.create({
          dim: dims.map((d) => $onnx.TensorShapeProto.Dimension.create({ dimValue: d })),
        }),
      }),
    }),
  });
}

/**
 * exportKMeansOnnx
 * 
 * Mengekspor K-Means centroids sebagai ONNX computation graph yang valid.
 * 
 * Architecture (standard ONNX ops, no custom ops):
 *   Input: X (float32, [1, nFeatures])
 *   Tile(X, [nClusters, 1]) → [nClusters, nFeatures]
 *   Sub(tiled, centroids) → [nClusters, nFeatures]
 *   Pow(diff, 2) → [nClusters, nFeatures]
 *   ReduceSum(squared, axis=1) → [nClusters]
 *   ArgMin(distances, axis=0) → scalar (cluster ID)
 *   Output: cluster_id (int64)
 * 
 * Valid ONNX computation graph — compatible dengan ONNX Runtime.
 * 
 * @param modelName - Nama model (digunakan untuk penamaan file dan node)
 * @param centroids - Array centroid (masing-masing adalah vektor fitur)
 * @param featureNames - Array nama fitur (untuk dokumentasi/dicatat di JSON)
 * @returns OnnxExportResult — path file dan metadata model
 */
export function exportKMeansOnnx(
  modelName: string,
  centroids: number[][],
  featureNames: string[]
): OnnxExportResult {
  logger.info({ modelName, nClusters: centroids.length }, "exportKMeansOnnx called");

  // Pastikan direktori model ada
  const modelDir = path.resolve(env.modelPath);
  if (!fs.existsSync(modelDir)) {
    fs.mkdirSync(modelDir, { recursive: true });
    logger.debug({ modelDir }, "Model directory created");
  }

  const nClusters = centroids.length;
  const nFeatures = centroids[0]?.length || 4;

  // Flatten centroids dari 2D ke 1D array untuk disimpan sebagai tensor
  const flatCentroids = centroids.flat();
  const repeats = [nClusters, 1]; // Tile repeats: duplikasi input sebanyak nClusters

  // ── Simpan juga versi JSON untuk JS fallback ──
  const jsonPath = path.join(modelDir, `${modelName.replace(/\s+/g, "-").toLowerCase()}.json`);
  fs.writeFileSync(
    jsonPath,
    JSON.stringify({ type: "KMeans", k: nClusters, centroids, featureNames, exportedAt: new Date().toISOString() }),
    "utf-8"
  );
  logger.debug({ jsonPath }, "K-Means JSON fallback saved");

  // ── Buat ModelProto ONNX ──
  const modelProto = $onnx.ModelProto.create({
    irVersion: 9,
    producerName: "LSAR-Analytics",
    docString: `K-Means Clustering: ${modelName}. ${nClusters} clusters, ${nFeatures} features.`,
    opsetImport: [
      $onnx.OperatorSetIdProto.create({ domain: "", version: 21 }),
    ],
    graph: $onnx.GraphProto.create({
      name: modelName,
      docString: `Nearest-centroid clustering with ${nClusters} clusters`,
      // Input: vektor fitur [1, nFeatures]
      input: [makeValueInfo("X", [1, nFeatures])],
      // Output: cluster ID (scalar int64)
      output: [makeValueInfo("cluster_id", [], 7)],
      // Initializer: konstanta yang digunakan dalam graph
      initializer: [
        makeTensor("centroids", flatCentroids, [nClusters, nFeatures], 1),
        makeTensor("repeats", repeats, [2], 7),
        makeTensor("pow_exp", [2], [1], 1),    // Eksponen untuk Pow (kuadrat)
        makeTensor("sum_axes", [1], [1], 7),    // Axis untuk ReduceSum
      ],
      // Computation graph nodes
      node: [
        // 1. Tile: duplikasi input X sebanyak nClusters
        $onnx.NodeProto.create({
          input: ["X", "repeats"],
          output: ["tiled"],
          name: `${modelName}_tile`,
          opType: "Tile",
        }),
        // 2. Sub: hitung selisih tiap baris dengan centroid
        $onnx.NodeProto.create({
          input: ["tiled", "centroids"],
          output: ["diff"],
          name: `${modelName}_sub`,
          opType: "Sub",
        }),
        // 3. Pow: kuadratkan selisih (untuk Euclidean distance)
        $onnx.NodeProto.create({
          input: ["diff", "pow_exp"],
          output: ["squared"],
          name: `${modelName}_pow`,
          opType: "Pow",
        }),
        // 4. ReduceSum: jumlahkan kuadrat selisih per baris (axis=1)
        $onnx.NodeProto.create({
          input: ["squared", "sum_axes"],
          output: ["distances"],
          name: `${modelName}_sum`,
          opType: "ReduceSum",
          attribute: [
            $onnx.AttributeProto.create({ name: "keepdims", type: 2, i: 0 }),
          ],
        }),
        // 5. ArgMin: cari cluster dengan jarak terkecil
        $onnx.NodeProto.create({
          input: ["distances"],
          output: ["cluster_id"],
          name: `${modelName}_argmin`,
          opType: "ArgMin",
          attribute: [
            $onnx.AttributeProto.create({ name: "axis", type: 2, i: 0 }),
            $onnx.AttributeProto.create({ name: "keepdims", type: 2, i: 0 }),
          ],
        }),
      ],
    }),
  });

  // ── Encode dan tulis ke file .onnx ──
  const buffer = $onnx.ModelProto.encode(modelProto).finish() as Buffer;
  const fileName = `${modelName.replace(/\s+/g, "-").toLowerCase()}.onnx`;
  const filePath = path.join(modelDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(buffer));

  logger.info({ filePath, nClusters, nFeatures, fileSize: buffer.length }, "ONNX model exported successfully");

  return {
    filePath,
    modelType: "BEHAVIOR_CLUSTER",
    format: "onnx",
    metrics: { nClusters, nFeatures, centroidsFlattened: flatCentroids.length },
  };
}

/**
 * exportKMeansJson
 * 
 * Menyimpan K-Means centroids sebagai file JSON untuk fallback inference
 * ketika ONNX Runtime tidak tersedia.
 * 
 * @param modelName - Nama model (digunakan untuk penamaan file)
 * @param centroids - Array centroid
 * @param featureNames - Array nama fitur
 * @returns OnnxExportResult — path file dan metadata
 */
export function exportKMeansJson(
  modelName: string,
  centroids: number[][],
  featureNames: string[]
): OnnxExportResult {
  logger.info({ modelName, nClusters: centroids.length }, "exportKMeansJson called");

  // Pastikan direktori model ada
  const modelDir = path.resolve(env.modelPath);
  if (!fs.existsSync(modelDir)) {
    fs.mkdirSync(modelDir, { recursive: true });
  }

  const fileName = `${modelName.replace(/\s+/g, "-").toLowerCase()}.json`;
  const filePath = path.join(modelDir, fileName);

  // Simpan data centroid sebagai JSON
  fs.writeFileSync(
    filePath,
    JSON.stringify({
      type: "KMeans",
      k: centroids.length,
      centroids,
      featureNames,
      exportedAt: new Date().toISOString(),
    }),
    "utf-8"
  );

  logger.info({ filePath }, "K-Means JSON fallback exported successfully");

  return {
    filePath,
    modelType: "BEHAVIOR_CLUSTER",
    format: "json",
    metrics: { nClusters: centroids.length, dimensions: featureNames.length },
  };
}

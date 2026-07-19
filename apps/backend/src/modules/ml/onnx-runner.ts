/**
 * onnx-runner.ts
 * 
 * Cara kerja file ini:
 * - ONNX Runtime Adapter — memuat model ONNX yang sudah di-train dan menjalankan inference.
 * - Fallback graceful ke JS-based inference jika ONNX Runtime tidak tersedia.
 * - Memvalidasi bahwa file ONNX adalah protobuf asli sebelum mencoba inference
 *   (mencegah error akibat file JSON yang disamarkan sebagai .onnx).
 * - Meng-cache InferenceSession untuk menghindari reload file pada setiap request.
 * 
 * Alur lengkap runOnnxInference(filePath, inputValues):
 * 1. Cek apakah ONNX Runtime (ort) tersedia. Jika tidak → return null (fallback ke JS).
 * 2. Cek apakah filePath valid. Jika null/undefined → return null.
 * 3. Resolve path absolut (relatif terhadap env.modelPath jika perlu).
 * 4. Cek apakah file exists. Jika tidak → return null.
 * 5. Validasi protobuf via isLikelyProtobuf(). Jika bukan protobuf → return null.
 * 6. Cek sessionCache untuk modelPath yang sama. Jika tidak ada → create session baru.
 * 7. Build input tensor (float32, shape [1, n]).
 * 8. Jalankan session.run(feeds) → dapatkan output.
 * 9. Return output data sebagai Float32Array.
 * 
 * Fungsi lain:
 * - clearOnnxCache(): membersihkan session cache (dipanggil setelah retrain).
 * - isLikelyProtobuf(): deteksi cepat apakah file adalah protobuf asli.
 */

import { env } from "../../config/env";
import * as path from "path";
import * as fs from "fs";
import logger from "../../lib/logger";

/**
 * ONNX Runtime library — dimuat secara opsional.
 * Jika tidak tersedia, inference akan fallback ke JS.
 */
let ort: any = null;
try {
  ort = require("onnxruntime-node");
  logger.info({}, "ONNX Runtime loaded successfully");
} catch {
  logger.warn({}, "onnxruntime-node not available — JS inference fallback will be used");
}

/**
 * Cache untuk ONNX InferenceSession — menghindari reload file pada setiap request.
 * Key: path file model (string), Value: InferenceSession instance.
 */
const sessionCache = new Map<string, any>();

/**
 * isLikelyProtobuf
 * 
 * Pemeriksaan cepat: apakah file ini benar-benar protobuf, bukan file JSON?
 * Protobuf dimulai dengan byte field tag (biasanya 0x08-0x0F),
 * bukan '{' (0x7B) atau '"' (0x22).
 * 
 * Ini mencegah error dari file JSON yang disamarkan sebagai .onnx.
 * 
 * @param filePath - Path absolut ke file yang akan diperiksa
 * @returns true jika file kemungkinan adalah protobuf, false jika JSON atau error
 */
function isLikelyProtobuf(filePath: string): boolean {
  try {
    // Baca byte pertama file
    const buf = Buffer.alloc(1);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buf, 0, 1, 0);
    fs.closeSync(fd);
    const firstByte = buf.toString("utf-8");
    // Protobuf tidak dimulai dengan '{' (JSON object) atau '"' (JSON string)
    return firstByte !== "{" && firstByte !== '"';
  } catch (err) {
    logger.warn({ err, filePath }, "Failed to check if file is protobuf");
    return false;
  }
}

/**
 * runOnnxInference
 * 
 * Menjalankan inference melalui ONNX Runtime.
 * 
 * Proses:
 * 1. Validasi ketersediaan ONNX Runtime dan filePath.
 * 2. Resolve path absolut.
 * 3. Validasi file exists dan merupakan protobuf asli.
 * 4. Gunakan session cache atau buat session baru.
 * 5. Build input tensor dan jalankan inference.
 * 6. Return output sebagai Float32Array, atau null jika gagal.
 * 
 * @param filePath - Path ke file model ONNX (absolut atau relatif terhadap env.modelPath)
 * @param inputValues - Array nilai input untuk inference
 * @returns Float32Array hasil inference, atau null jika gagal/tidak tersedia
 */
export async function runOnnxInference(
  filePath: string | null | undefined,
  inputValues: number[]
): Promise<Float32Array | null> {
  // Jika ONNX Runtime tidak tersedia atau filePath tidak valid → return null (fallback ke JS)
  if (!ort || !filePath) {
    logger.debug({ ortAvailable: !!ort, filePathProvided: !!filePath }, "ONNX inference skipped — fallback to JS");
    return null;
  }

  try {
    // Resolve path: jika relatif, jadikan absolut terhadap env.modelPath
    const modelPath = path.isAbsolute(filePath) ? filePath : path.resolve(env.modelPath, filePath);

    // Cek apakah file model benar-benar ada di disk
    if (!fs.existsSync(modelPath)) {
      logger.warn({ modelPath }, "ONNX model file not found on disk");
      return null;
    }

    // Validasi bahwa file adalah protobuf asli (bukan JSON)
    if (!isLikelyProtobuf(modelPath)) {
      logger.warn({ modelPath }, "ONNX file is not a valid protobuf (looks like JSON)");
      return null;
    }

    logger.debug({ modelPath, inputLength: inputValues.length }, "Running ONNX inference");

    // Dapatkan atau buat session baru (cache untuk reuse)
    let session = sessionCache.get(modelPath);
    if (!session) {
      session = await ort.InferenceSession.create(modelPath);
      sessionCache.set(modelPath, session);
      logger.debug({ modelPath }, "New ONNX InferenceSession created and cached");
    }

    // Build input tensor: float32, shape [1, inputValues.length]
    const inputName = session.inputNames[0];
    const feeds: Record<string, any> = {};
    feeds[inputName] = new ort.Tensor("float32", new Float32Array(inputValues), [1, inputValues.length]);

    // Jalankan inference
    const results = await session.run(feeds);
    const outputName = session.outputNames[0];

    if (results[outputName]?.data) {
      const outputData = results[outputName].data as Float32Array;
      logger.debug({ modelPath, outputLength: outputData.length }, "ONNX inference successful");
      return outputData;
    }

    logger.warn({ modelPath }, "ONNX inference returned no output data");
    return null;
  } catch (err: any) {
    logger.warn({ err, filePath }, "ONNX inference failed");
    return null;
  }
}

/**
 * clearOnnxCache
 * 
 * Membersihkan session cache ONNX Runtime.
 * Dipanggil setelah model retrain agar inference menggunakan file model terbaru.
 */
export function clearOnnxCache() {
  const cacheSize = sessionCache.size;
  sessionCache.clear();
  logger.info({ cacheSize }, "ONNX session cache cleared");
}

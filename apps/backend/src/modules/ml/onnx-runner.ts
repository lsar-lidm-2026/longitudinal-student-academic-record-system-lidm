/**
 * ONNX Runtime Adapter — loads trained ONNX models and runs inference.
 * Falls back gracefully to JS-based inference when ONNX is unavailable.
 */

import { env } from "../../config/env";
import * as path from "path";
import * as fs from "fs";

let ort: any = null;
try {
  ort = require("onnxruntime-node");
} catch {
  console.warn("[ONNX] onnxruntime-node not available — JS inference fallback");
}

/** Cache ONNX InferenceSessions to avoid reloading on every request */
const sessionCache = new Map<string, any>();

/**
 * Run inference through ONNX Runtime.
 * Tries model files from mlModel DB records, falls back to JS inference.
 */
export async function runOnnxInference(
  filePath: string | null | undefined,
  inputValues: number[]
): Promise<Float32Array | null> {
  if (!ort || !filePath) return null;

  try {
    // Resolve absolute path
    const modelPath = path.isAbsolute(filePath) ? filePath : path.resolve(env.mlModelPath, filePath);
    if (!fs.existsSync(modelPath)) return null;

    // Get or create cached session
    let session = sessionCache.get(modelPath);
    if (!session) {
      session = await ort.InferenceSession.create(modelPath);
      sessionCache.set(modelPath, session);
    }

    // Build input
    const inputName = session.inputNames[0];
    const feeds: Record<string, any> = {};
    feeds[inputName] = new ort.Tensor("float32", new Float32Array(inputValues), [1, inputValues.length]);

    // Run inference
    const results = await session.run(feeds);
    const outputName = session.outputNames[0];
    if (results[outputName]?.data) {
      return results[outputName].data as Float32Array;
    }
    return null;
  } catch (err: any) {
    console.warn(`[ONNX] Inference failed: ${err.message}`);
    return null;
  }
}

/**
 * Clear the ONNX session cache (useful after model retraining).
 */
export function clearOnnxCache() {
  sessionCache.clear();
}

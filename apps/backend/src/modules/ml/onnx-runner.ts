/**
 * ONNX Runtime Adapter — loads trained ONNX models and runs inference.
 * Falls back gracefully to JS-based inference when ONNX is unavailable.
 *
 * Validates that ONNX files are genuine protobuf before attempting inference.
 * The decision tree "ONNX" export that was a JSON-in-disguise will be rejected.
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
 * Quick check: is this file actually a protobuf, not a JSON file?
 * Reads first byte — protobuf starts with a field tag byte (0x08-0x0F typically),
 * not '{' or '"'.
 */
function isLikelyProtobuf(filePath: string): boolean {
  try {
    const buf = Buffer.alloc(1);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buf, 0, 1, 0);
    fs.closeSync(fd);
    const firstByte = buf.toString("utf-8");
    return firstByte !== "{" && firstByte !== '"';
  } catch {
    return false;
  }
}

/**
 * Run inference through ONNX Runtime.
 */
export async function runOnnxInference(
  filePath: string | null | undefined,
  inputValues: number[]
): Promise<Float32Array | null> {
  if (!ort || !filePath) return null;

  try {
    const modelPath = path.isAbsolute(filePath) ? filePath : path.resolve(env.modelPath, filePath);
    if (!fs.existsSync(modelPath)) {
      console.warn(`[ONNX] Model file not found: ${modelPath}`);
      return null;
    }

    // Reject non-protobuf files (catches JSON-disguised-as-ONNX)
    if (!isLikelyProtobuf(modelPath)) {
      console.warn(`[ONNX] File is not a valid protobuf (looks like JSON): ${modelPath}`);
      return null;
    }

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

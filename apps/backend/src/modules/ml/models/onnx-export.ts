/**
 * ONNX Model Exporter — generates valid ONNX protobuf model files.
 *
 * Uses onnx-proto (protobufjs wrapper) to create ONNX ModelProto objects
 * and serialize them to binary .onnx files.
 *
 * Supported exports (VALID):
 * - Linear Regression → ONNX Gemm op (y = wx + b)
 * - K-Means → Sub → Pow → ReduceSum → ArgMin graph (valid computation)
 *
 * NOT exported (because they were FAKE):
 * - Decision Tree → previous export was a JSON blob disguised as ONNX
 *   (Constant node with tree data encoded as a tensor — NOT valid inference).
 *   Use the JSON companion file for rule inspection instead.
 */

import { env } from "../../../config/env";
import * as path from "path";
import * as fs from "fs";

// onnx-proto provides the compiled ONNX protobuf types
import onnxMod from "onnx-proto";
const $onnx = (onnxMod as any).onnx;

export interface OnnxExportResult {
  filePath: string;
  modelType: "TREND_PREDICTION" | "RISK_CLASSIFICATION" | "BEHAVIOR_CLUSTER";
  format: "onnx" | "json";
  metrics: Record<string, number>;
}

function float32ToBytes(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeFloatLE(value, 0);
  return buf;
}

function int64ToBytes(value: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64LE(BigInt(value), 0);
  return buf;
}

function makeTensor(
  name: string,
  data: number[],
  dims: number[],
  dataType: number = 1 // 1=FLOAT, 7=INT64
) {
  const isFloat = dataType === 1;
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
 * Export a linear regression model (y = slope * x + intercept) as ONNX.
 * Architecture: Input → Gemm → Output
 * Valid ONNX computation graph.
 */
export function exportLinearRegressionOnnx(
  modelName: string,
  slope: number,
  intercept: number
): OnnxExportResult {
  const modelDir = path.resolve(env.modelPath);
  if (!fs.existsSync(modelDir)) fs.mkdirSync(modelDir, { recursive: true });

  const modelProto = $onnx.ModelProto.create({
    irVersion: 9,
    producerName: "LSAR-Analytics",
    producerVersion: "1.0",
    domain: "lsar",
    modelVersion: 1,
    docString: `LSAR Linear Regression: ${modelName}`,
    opsetImport: [
      $onnx.OperatorSetIdProto.create({ domain: "", version: 21 }),
    ],
    graph: $onnx.GraphProto.create({
      name: modelName,
      docString: `Linear regression for ${modelName}`,
      input: [makeValueInfo("X", [-1, 1])],
      output: [makeValueInfo("Y", [-1, 1])],
      initializer: [
        makeTensor("W", [slope], [1, 1]),
        makeTensor("B", [intercept], [1]),
      ],
      node: [
        $onnx.NodeProto.create({
          input: ["X", "W", "B"],
          output: ["Y"],
          name: `${modelName}_gemm`,
          opType: "Gemm",
          attribute: [
            $onnx.AttributeProto.create({ name: "alpha", type: 1, f: 1.0 }),
            $onnx.AttributeProto.create({ name: "beta", type: 1, f: 1.0 }),
            $onnx.AttributeProto.create({ name: "transA", type: 2, i: 0 }),
            $onnx.AttributeProto.create({ name: "transB", type: 2, i: 0 }),
          ],
        }),
      ],
    }),
  });

  const buffer = $onnx.ModelProto.encode(modelProto).finish() as Buffer;
  const fileName = `${modelName.replace(/\s+/g, "-").toLowerCase()}.onnx`;
  const filePath = path.join(modelDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(buffer));

  return { filePath, modelType: "TREND_PREDICTION", format: "onnx", metrics: { slope, intercept } };
}

/**
 * Export K-Means centroids as a proper ONNX inference graph.
 *
 * Architecture (standard ONNX ops, no custom ops):
 *   Input: X (float32, [1, n_features])
 *   Tile(X, [n_clusters, 1]) → [n_clusters, n_features]
 *   Sub(tiled, centroids) → [n_clusters, n_features]
 *   Pow(diff, 2) → [n_clusters, n_features]
 *   ReduceSum(squared, axis=1) → [n_clusters]
 *   ArgMin(distances, axis=0) → scalar (cluster ID)
 *   Output: cluster_id (int64)
 *
 * Valid ONNX computation graph.
 */
export function exportKMeansOnnx(
  modelName: string,
  centroids: number[][],
  featureNames: string[]
): OnnxExportResult {
  const modelDir = path.resolve(env.modelPath);
  if (!fs.existsSync(modelDir)) fs.mkdirSync(modelDir, { recursive: true });

  const nClusters = centroids.length;
  const nFeatures = centroids[0]?.length || 4;

  // Flatten centroids to 1D array
  const flatCentroids = centroids.flat();
  const repeats = [nClusters, 1];

  // Also save as JSON for JS fallback
  fs.writeFileSync(
    path.join(modelDir, `${modelName.replace(/\s+/g, "-").toLowerCase()}.json`),
    JSON.stringify({ type: "KMeans", k: nClusters, centroids, featureNames, exportedAt: new Date().toISOString() }),
    "utf-8"
  );

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
      input: [makeValueInfo("X", [1, nFeatures])],
      output: [makeValueInfo("cluster_id", [], 7)],
      initializer: [
        makeTensor("centroids", flatCentroids, [nClusters, nFeatures], 1),
        makeTensor("repeats", repeats, [2], 7),
        makeTensor("pow_exp", [2], [1], 1),
        makeTensor("sum_axes", [1], [1], 7),
      ],
      node: [
        $onnx.NodeProto.create({
          input: ["X", "repeats"],
          output: ["tiled"],
          name: `${modelName}_tile`,
          opType: "Tile",
        }),
        $onnx.NodeProto.create({
          input: ["tiled", "centroids"],
          output: ["diff"],
          name: `${modelName}_sub`,
          opType: "Sub",
        }),
        $onnx.NodeProto.create({
          input: ["diff", "pow_exp"],
          output: ["squared"],
          name: `${modelName}_pow`,
          opType: "Pow",
        }),
        $onnx.NodeProto.create({
          input: ["squared", "sum_axes"],
          output: ["distances"],
          name: `${modelName}_sum`,
          opType: "ReduceSum",
          attribute: [
            $onnx.AttributeProto.create({ name: "keepdims", type: 2, i: 0 }),
          ],
        }),
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

  const buffer = $onnx.ModelProto.encode(modelProto).finish() as Buffer;
  const fileName = `${modelName.replace(/\s+/g, "-").toLowerCase()}.onnx`;
  const filePath = path.join(modelDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(buffer));

  return {
    filePath,
    modelType: "BEHAVIOR_CLUSTER",
    format: "onnx",
    metrics: { nClusters, nFeatures, centroidsFlattened: flatCentroids.length },
  };
}

export function exportKMeansJson(
  modelName: string,
  centroids: number[][],
  featureNames: string[]
): OnnxExportResult {
  const modelDir = path.resolve(env.modelPath);
  if (!fs.existsSync(modelDir)) fs.mkdirSync(modelDir, { recursive: true });

  const filePath = path.join(modelDir, `${modelName.replace(/\s+/g, "-").toLowerCase()}.json`);
  fs.writeFileSync(
    filePath,
    JSON.stringify({ type: "KMeans", k: centroids.length, centroids, featureNames, exportedAt: new Date().toISOString() }),
    "utf-8"
  );

  return {
    filePath,
    modelType: "BEHAVIOR_CLUSTER",
    format: "json",
    metrics: { nClusters: centroids.length, dimensions: featureNames.length },
  };
}

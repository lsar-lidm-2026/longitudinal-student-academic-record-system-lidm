/**
 * ONNX Model Exporter — generates valid ONNX protobuf model files.
 *
 * Uses onnx-proto (protobufjs wrapper) to create ONNX ModelProto objects
 * and serialize them to binary .onnx files.
 *
 * Supported exports:
 * - Linear Regression → ONNX Gemm op (y = wx + b)
 * - Decision Tree → ONNX metadata + JSON companion
 * - K-Means → Sub → Pow → ReduceSum → ArgMin graph
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
  // Write as signed 64-bit little-endian (fits in 32 bits for our use case)
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
 */
export function exportLinearRegressionOnnx(
  modelName: string,
  slope: number,
  intercept: number
): OnnxExportResult {
  const modelDir = path.resolve(env.mlModelPath);
  if (!fs.existsSync(modelDir)) fs.mkdirSync(modelDir, { recursive: true });

  const modelProto = $onnx.ModelProto.create({
    irVersion: 9,
    producerName: "LSAR-ML",
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
 * Export a decision tree model as ONNX + JSON.
 */
export function exportDecisionTreeOnnx(
  modelName: string,
  tree: any,
  featureNames: string[]
): OnnxExportResult {
  const modelDir = path.resolve(env.mlModelPath);
  if (!fs.existsSync(modelDir)) fs.mkdirSync(modelDir, { recursive: true });

  const treeData = JSON.stringify({
    type: "DecisionTree",
    featureNames,
    tree,
    exportedAt: new Date().toISOString(),
  });

  fs.writeFileSync(
    path.join(modelDir, `${modelName.replace(/\s+/g, "-").toLowerCase()}.json`),
    treeData,
    "utf-8"
  );

  // Minimal ONNX metadata wrapper
  const metadataProto = $onnx.ModelProto.create({
    irVersion: 9,
    producerName: "LSAR-ML",
    producerVersion: "1.0",
    docString: `Decision Tree: ${modelName}. Inference uses JS from companion .json file.`,
    opsetImport: [
      $onnx.OperatorSetIdProto.create({ domain: "", version: 21 }),
    ],
    graph: $onnx.GraphProto.create({
      name: modelName,
      node: [
        $onnx.NodeProto.create({
          output: ["Y"],
          name: `${modelName}_constant`,
          opType: "Constant",
          attribute: [
            $onnx.AttributeProto.create({
              name: "value",
              type: 4,
              t: makeTensor("tree_ref", [treeData.length], [1]),
            }),
          ],
        }),
      ],
      output: [makeValueInfo("Y", [1])],
    }),
  });

  const buffer = $onnx.ModelProto.encode(metadataProto).finish() as Buffer;
  const onnxPath = path.join(modelDir, `${modelName.replace(/\s+/g, "-").toLowerCase()}.onnx`);
  fs.writeFileSync(onnxPath, Buffer.from(buffer));

  return { filePath: onnxPath, modelType: "RISK_CLASSIFICATION", format: "onnx", metrics: { treeDepth: getTreeDepth(tree), nFeatures: featureNames.length } };
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
 */
export function exportKMeansOnnx(
  modelName: string,
  centroids: number[][],
  featureNames: string[]
): OnnxExportResult {
  const modelDir = path.resolve(env.mlModelPath);
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
    producerName: "LSAR-ML",
    docString: `K-Means Clustering: ${modelName}. ${nClusters} clusters, ${nFeatures} features.`,
    opsetImport: [
      $onnx.OperatorSetIdProto.create({ domain: "", version: 21 }),
    ],
    graph: $onnx.GraphProto.create({
      name: modelName,
      docString: `Nearest-centroid clustering with ${nClusters} clusters`,
      // Input: X (1 x n_features) float32
      input: [makeValueInfo("X", [1, nFeatures])],
      // Output: cluster_id scalar int64
      output: [makeValueInfo("cluster_id", [], 7)],
      // Initializers
      initializer: [
        // Centroids as float32 tensor [nClusters, nFeatures]
        makeTensor("centroids", flatCentroids, [nClusters, nFeatures], 1),
        // Tile repeats as int64 [2]
        makeTensor("repeats", repeats, [2], 7),
        // Pow exponent as float32 scalar
        makeTensor("pow_exp", [2], [1], 1),
        // ReduceSum axes: [1] (sum across feature dimension) as int64
        makeTensor("sum_axes", [1], [1], 7),
        // No need for separate argmin_axis — it's an attribute in opset 12+
      ],
      // Computation graph
      node: [
        // 1. Tile input to match centroid count
        $onnx.NodeProto.create({
          input: ["X", "repeats"],
          output: ["tiled"],
          name: `${modelName}_tile`,
          opType: "Tile",
        }),
        // 2. Subtract centroids
        $onnx.NodeProto.create({
          input: ["tiled", "centroids"],
          output: ["diff"],
          name: `${modelName}_sub`,
          opType: "Sub",
        }),
        // 3. Square differences
        $onnx.NodeProto.create({
          input: ["diff", "pow_exp"],
          output: ["squared"],
          name: `${modelName}_pow`,
          opType: "Pow",
        }),
        // 4. Sum across features — axes is input Tensor in opset 18+
        $onnx.NodeProto.create({
          input: ["squared", "sum_axes"],
          output: ["distances"],
          name: `${modelName}_sum`,
          opType: "ReduceSum",
          attribute: [
            $onnx.AttributeProto.create({
              name: "keepdims",
              type: 2, // INT
              i: 0,
            }),
          ],
        }),
        // 5. Find nearest centroid — axis is an attribute in opset 12+
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
  const modelDir = path.resolve(env.mlModelPath);
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

function getTreeDepth(node: any): number {
  if (!node || node.isLeaf) return 1;
  return 1 + Math.max(
    node.left ? getTreeDepth(node.left) : 0,
    node.right ? getTreeDepth(node.right) : 0
  );
}

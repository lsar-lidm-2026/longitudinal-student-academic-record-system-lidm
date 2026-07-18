/**
 * Simple Decision Tree — CART-like classifier for risk levels.
 * Uses information gain (entropy) for split selection.
 * Max depth with pruning to avoid overfitting.
 *
 * Pure TypeScript, zero external dependencies.
 */

interface Split {
  featureIndex: number;
  threshold: number;
  gain: number;
}

interface TreeNode {
  isLeaf: boolean;
  label?: string;
  probability?: number; // confidence of the prediction
  split?: Split;
  left?: TreeNode;
  right?: TreeNode;
}

export interface DecisionTreeResult {
  tree: TreeNode;
  featureNames: string[];
  predict(features: number[]): { label: string; confidence: number };
}

function entropy(counts: number[], total: number): number {
  if (total === 0) return 0;
  let e = 0;
  for (const c of counts) {
    if (c === 0) continue;
    const p = c / total;
    e -= p * Math.log2(p);
  }
  return e;
}

function findBestSplit(
  data: number[][],
  labels: string[],
  labelSet: string[]
): Split | null {
  const n = data.length;
  if (n === 0) return null;

  const features = data[0].length;
  const labelCounts = labelSet.map(
    (l) => labels.filter((y) => y === l).length
  );
  const parentEntropy = entropy(labelCounts, n);
  let bestSplit: Split | null = null;

  for (let f = 0; f < features; f++) {
    // Get sorted unique values for this feature
    const values = [...new Set(data.map((row) => row[f]))].sort((a, b) => a - b);

    for (let i = 0; i < values.length - 1; i++) {
      const threshold = (values[i] + values[i + 1]) / 2;

      // Split data
      const leftIndices: number[] = [];
      const rightIndices: number[] = [];
      for (let j = 0; j < n; j++) {
        if (data[j][f] <= threshold) {
          leftIndices.push(j);
        } else {
          rightIndices.push(j);
        }
      }

      if (leftIndices.length === 0 || rightIndices.length === 0) continue;

      // Weighted entropy after split
      const leftCounts = labelSet.map(
        (l) => leftIndices.filter((idx) => labels[idx] === l).length
      );
      const rightCounts = labelSet.map(
        (l) => rightIndices.filter((idx) => labels[idx] === l).length
      );

      const leftEntropy = entropy(leftCounts, leftIndices.length);
      const rightEntropy = entropy(rightCounts, rightIndices.length);

      const weightedEntropy =
        (leftIndices.length / n) * leftEntropy +
        (rightIndices.length / n) * rightEntropy;

      const gain = parentEntropy - weightedEntropy;

      if (!bestSplit || gain > bestSplit.gain) {
        bestSplit = { featureIndex: f, threshold, gain };
      }
    }
  }

  return bestSplit;
}

function buildTree(
  data: number[][],
  labels: string[],
  labelSet: string[],
  featureNames: string[],
  depth: number,
  maxDepth: number,
  minSamples: number
): TreeNode {
  const n = data.length;

  // Check stop conditions
  const uniqueLabels = [...new Set(labels)];
  if (uniqueLabels.length === 1) {
    return {
      isLeaf: true,
      label: uniqueLabels[0],
      probability: 1.0,
    };
  }

  if (depth >= maxDepth || n < minSamples) {
    // Return majority class
    const counts = labelSet.map(
      (l) => labels.filter((y) => y === l).length
    );
    const maxIdx = counts.indexOf(Math.max(...counts));
    return {
      isLeaf: true,
      label: labelSet[maxIdx],
      probability: counts[maxIdx] / n,
    };
  }

  const split = findBestSplit(data, labels, labelSet);
  if (!split || split.gain <= 0) {
    // No good split — return majority class
    const counts = labelSet.map(
      (l) => labels.filter((y) => y === l).length
    );
    const maxIdx = counts.indexOf(Math.max(...counts));
    return {
      isLeaf: true,
      label: labelSet[maxIdx],
      probability: counts[maxIdx] / n,
    };
  }

  // Split data
  const leftIndices: number[] = [];
  const rightIndices: number[] = [];
  for (let i = 0; i < n; i++) {
    if (data[i][split.featureIndex] <= split.threshold) {
      leftIndices.push(i);
    } else {
      rightIndices.push(i);
    }
  }

  // Safety: if split creates empty children, return majority
  if (leftIndices.length === 0 || rightIndices.length === 0) {
    const counts = labelSet.map(
      (l) => labels.filter((y) => y === l).length
    );
    const maxIdx = counts.indexOf(Math.max(...counts));
    return {
      isLeaf: true,
      label: labelSet[maxIdx],
      probability: counts[maxIdx] / n,
    };
  }

  const leftData = leftIndices.map((idx) => data[idx]);
  const leftLabels = leftIndices.map((idx) => labels[idx]);
  const rightData = rightIndices.map((idx) => data[idx]);
  const rightLabels = rightIndices.map((idx) => labels[idx]);

  return {
    isLeaf: false,
    split,
    left: buildTree(leftData, leftLabels, labelSet, featureNames, depth + 1, maxDepth, minSamples),
    right: buildTree(rightData, rightLabels, labelSet, featureNames, depth + 1, maxDepth, minSamples),
  };
}

export function trainDecisionTree(
  data: number[][],
  labels: string[],
  featureNames: string[] = [],
  maxDepth: number = 5,
  minSamples: number = 2
): DecisionTreeResult {
  const labelSet = [...new Set(labels)].sort();

  const tree = buildTree(
    data,
    labels,
    labelSet,
    featureNames,
    0,
    maxDepth,
    minSamples
  );

  return {
    tree,
    featureNames,
    predict: (features: number[]) => {
      let node = tree;
      while (!node.isLeaf && node.split) {
        if (features[node.split.featureIndex] <= node.split.threshold) {
          node = node.left!;
        } else {
          node = node.right!;
        }
      }
      return {
        label: node.label || "UNKNOWN",
        confidence: node.probability || 0,
      };
    },
  };
}

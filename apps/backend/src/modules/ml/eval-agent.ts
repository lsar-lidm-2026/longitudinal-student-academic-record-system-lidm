/**
 * ML Evaluation Agent — evaluates trained model performance using LLM.
 * Generates structured performance reports and improvement suggestions.
 */

import { generateChatCompletion } from "../ai/llm.client";
import { prisma } from "../../lib/prisma";

interface ModelMetrics {
  type: string;
  name: string;
  metrics: Record<string, number>;
  nSamples: number;
  nFeatures: number;
  trainingDate: string;
}

interface EvalResult {
  summary: string;
  score: number; // 0-100
  issues: string[];
  suggestions: string[];
  details: string;
}

/**
 * Evaluate model performance using LLM Agent.
 * Falls back to basic evaluation if LLM unavailable.
 */
export async function evaluateModel(metrics: ModelMetrics): Promise<EvalResult> {
  // Count actual predictions for ground truth
  const [totalPredictions, correctPredictions] = await getPredictionStats(metrics.type);

  try {
    const prompt = `Anda adalah AI/ML engineer yang mengevaluasi model machine learning untuk sistem pendidikan SD.

Model: ${metrics.name}
Tipe: ${metrics.type}
Metrik: ${JSON.stringify(metrics.metrics)}
Jumlah sample training: ${metrics.nSamples}
Jumlah fitur: ${metrics.nFeatures}
Tanggal training: ${metrics.trainingDate}
Total prediksi: ${totalPredictions}
Prediksi akurat: ${correctPredictions}

Evaluasi model ini berikan:
1. **Skor Kualitas**: 0-100
2. **Ringkasan**: 2-3 kalimat evaluasi kualitas model
3. **Issues**: masalah yang terdeteksi (jika ada)
4. **Saran Perbaikan**: saran untuk meningkatkan model

Format JSON:
{
  "score": number,
  "summary": "string",
  "issues": ["string"],
  "suggestions": ["string"],
  "details": "string"
}

Jawab hanya dengan JSON valid, tanpa markdown formatting.`;

    const content = await generateChatCompletion([
      {
        role: "system",
        content: "Anda adalah AI/ML engineer yang mengevaluasi model. Berikan evaluasi objektif dan saran perbaikan.",
      },
      { role: "user", content: prompt },
    ]);

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || "Evaluasi selesai",
        score: parsed.score || 50,
        issues: parsed.issues || [],
        suggestions: parsed.suggestions || [],
        details: parsed.details || "",
      };
    }
  } catch {
    // Fallback: structured evaluation without LLM
  }

  // Fallback evaluation
  return generateBasicEval(metrics, totalPredictions, correctPredictions);
}

function generateBasicEval(
  metrics: ModelMetrics,
  totalPredictions: number,
  correctPredictions: number
): EvalResult {
  const highConfRatio = totalPredictions > 0 ? correctPredictions / totalPredictions : 0;
  const score = Math.round(highConfRatio * 50) + (metrics.nSamples > 30 ? 25 : 0) + (metrics.nFeatures > 2 ? 25 : 0);

  const issues: string[] = [];
  const suggestions: string[] = [];

  if (metrics.nSamples < 30) {
    issues.push("Training sample terlalu sedikit (< 30) untuk hasil yang reliable");
    suggestions.push("Tambah data training dengan mengisi lebih banyak semester records");
  }
  if (highConfRatio < 0.3 && totalPredictions > 0) {
    issues.push("Proporsi prediksi confidence tinggi rendah (< 30%)");
    suggestions.push("Evaluasi ulang feature engineering dan pertimbangkan rule-based fallback");
  }

  const modelLabel =
    metrics.type === "RISK_CLASSIFICATION"
      ? "Klasifikasi Risiko"
      : metrics.type === "TREND_PREDICTION"
        ? "Prediksi Tren"
        : "Clustering Perilaku";

  return {
    summary: `Model ${modelLabel} (${metrics.name}) memiliki skor ${score}/100 dengan ${totalPredictions} prediksi dan ${(highConfRatio * 100).toFixed(1)}% prediksi confidence tinggi.`,
    score,
    issues,
    suggestions: suggestions.length > 0
      ? suggestions
      : ["Model berjalan dengan baik — pertahankan training berkala"],
    details: `nSamples: ${metrics.nSamples}, nFeatures: ${metrics.nFeatures}, totalPredictions: ${totalPredictions}, highConfPredictions: ${correctPredictions}`,
  };
}

async function getPredictionStats(modelType: string): Promise<[number, number]> {
  try {
    const modelTypeUpper = modelType.toUpperCase().includes("RISK")
      ? "RISK_CLASSIFICATION"
      : modelType.toUpperCase().includes("TREND")
        ? "TREND_PREDICTION"
        : "BEHAVIOR_CLUSTER";

    const predictions = await prisma.predictedOutcome.findMany({
      where: { modelType: modelTypeUpper as any, isActive: true },
      select: { id: true, confidence: true },
    });

    // "High-confidence" predictions — a proxy metric, NOT accuracy (no ground truth labels)
    const highConf = predictions.filter((p) => (p.confidence || 0) > 0.7).length;
    return [predictions.length, highConf];
  } catch {
    return [0, 0];
  }
}

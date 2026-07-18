/**
 * LLM Agent for ML analysis.
 * Takes raw ML model outputs + student data → generates natural language analysis in Indonesian.
 * Falls back to plain ML output if LLM call fails (graceful degradation).
 */

import { generateChatCompletion } from "../ai/llm.client";

interface StudentSummary {
  name: string;
  className?: string;
  avgKnowledge: number;
  scoreVolatility: number;
  scoreDelta: number;
  totalAbsence: number;
  achievementCount: number;
  semesterCount: number;
}

interface RiskPrediction {
  level: string;
  confidence: number;
  factors: string[];
}

interface TrendPrediction {
  slope: number;
  rSquared: number;
  nextPrediction: number;
  direction: "NAIK" | "STABIL" | "TURUN";
}

interface ClusterInfo {
  clusterId: number;
  label: string;
  description: string;
}

/**
 * Generate risk analysis using LLM Agent.
 * Falls back to structured output if LLM fails.
 */
export async function analyzeRisk(
  student: StudentSummary,
  risk: RiskPrediction
): Promise<{ explanation: string; recommendations: string[] }> {
  try {
    const prompt = `Anda adalah asisten analisis akademik untuk guru SD. Analisis data siswa berikut dan berikan penjelasan dalam Bahasa Indonesia yang ramah dan mudah dipahami.

Data Siswa:
- Nama: ${student.name}
- Rata-rata nilai: ${student.avgKnowledge.toFixed(1)}
- Volatilitas nilai: ${student.scoreVolatility.toFixed(1)}
- Perubahan nilai antar semester: ${student.scoreDelta > 0 ? "+" : ""}${student.scoreDelta.toFixed(1)}
- Total ketidakhadiran: ${student.totalAbsence}
- Jumlah prestasi: ${student.achievementCount}

Hasil Analisis Model:
- Level Risiko: ${risk.level}
- Confidence: ${(risk.confidence * 100).toFixed(0)}%
- Faktor kontribusi: ${risk.factors.join(", ")}

Beri output dalam format:
**Analisis**: [2-3 kalimat analisis kondisi siswa berdasarkan data]
**Rekomendasi**:
- [rekomendasi 1]
- [rekomendasi 2]
- [rekomendasi 3]`;

    const content = await generateChatCompletion([
      {
        role: "system",
        content:
          "Anda adalah asisten analisis pendidikan SD yang membantu guru memahami kondisi akademik siswa. Gunakan bahasa Indonesia yang sopan dan informatif.",
      },
      { role: "user", content: prompt },
    ]);

    // Parse the response — handle multiple possible formats
    const sections = content.split(/\*{0,2}Rekomendasi\*{0,2}\s*:?\s*/i);
    let explanation = sections[0] || content;
    explanation = explanation.replace(/\*{0,2}Analisis\*{0,2}\s*:?\s*/i, "").trim();

    const recSection = sections[1] || "";
    const recommendations = recSection
      .split("\n")
      .map((line) => line.replace(/^[-*]\s*/, "").trim())
      .filter((line) => line.length > 5);

    return {
      explanation,
      recommendations: recommendations.length > 0 ? recommendations : risk.factors,
    };
  } catch {
    // Fallback: structured output without LLM
    return {
      explanation: `Berdasarkan analisis data, siswa ${student.name} berada pada level ${risk.level} dengan confidence ${(risk.confidence * 100).toFixed(0)}%. Faktor utama: ${risk.factors.join(", ")}.`,
      recommendations: risk.factors,
    };
  }
}

/**
 * Generate trend analysis using LLM Agent.
 */
export async function analyzeTrend(
  student: StudentSummary,
  trend: TrendPrediction
): Promise<{ explanation: string }> {
  try {
    const directionLabel =
      trend.direction === "NAIK"
        ? "meningkat"
        : trend.direction === "TURUN"
          ? "menurun"
          : "stabil";

    const prompt = `Berdasarkan data akademik ${student.name}:
- Rata-rata nilai sekarang: ${student.avgKnowledge.toFixed(1)}
- Tren: ${directionLabel} (slope: ${trend.slope.toFixed(2)})
- Prediksi nilai semester depan: ${trend.nextPrediction.toFixed(1)}
- Akurasi model: ${(trend.rSquared * 100).toFixed(0)}%

Berikan analisis singkat dalam 2-3 kalimat tentang tren akademik siswa ini dalam Bahasa Indonesia.`;

    const content = await generateChatCompletion([
      {
        role: "system",
        content:
          "Anda adalah asisten analisis tren akademik SD.",
      },
      { role: "user", content: prompt },
    ]);

    return { explanation: content };
  } catch {
    const dir =
      trend.direction === "NAIK"
        ? "naik"
        : trend.direction === "TURUN"
          ? "turun"
          : "stabil";
    return {
      explanation: `Tren akademik ${student.name} cenderung ${dir} dengan prediksi nilai semester depan sekitar ${trend.nextPrediction.toFixed(0)}. Akurasi prediksi: ${(trend.rSquared * 100).toFixed(0)}%.`,
    };
  }
}

/**
 * Generate cluster explanation using LLM Agent.
 */
export async function explainCluster(
  clusters: { clusterId: number; size: number; avgKnowledge: number; avgAbsence: number }[]
): Promise<{ profiles: ClusterInfo[] }> {
  try {
    const clusterData = clusters
      .map(
        (c) =>
          `Cluster ${c.clusterId}: ${c.size} siswa, rata-rata nilai ${c.avgKnowledge.toFixed(1)}, rata-rata ketidakhadiran ${c.avgAbsence.toFixed(1)}`
      )
      .join("\n");

    const prompt = `Berikut adalah hasil clustering siswa berdasarkan pola akademik:

${clusterData}

Beri label dan deskripsi singkat untuk setiap cluster dalam Bahasa Indonesia. Format:
- Cluster 0: [label, misal "Siswa Berprestasi"] — [deskripsi singkat]
- Cluster 1: ...`;

    const content = await generateChatCompletion([
      {
        role: "system",
        content:
          "Anda adalah asisten analisis clustering untuk pendidikan SD.",
      },
      { role: "user", content: prompt },
    ]);

    const profiles: ClusterInfo[] = clusters.map((c) => {
      const line = content
        .split("\n")
        .find((l) => l.includes(`Cluster ${c.clusterId}`));
      const label = line?.split("—")[0]?.split(":")[1]?.trim() || `Cluster ${c.clusterId}`;
      const description = line?.split("—")[1]?.trim() || "";
      return { clusterId: c.clusterId, label, description };
    });

    return { profiles };
  } catch {
    return {
      profiles: clusters.map((c) => ({
        clusterId: c.clusterId,
        label: `Kelompok ${c.clusterId + 1}`,
        description: `${c.size} siswa dengan rata-rata nilai ${c.avgKnowledge.toFixed(0)}`,
      })),
    };
  }
}

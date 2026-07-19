/**
 * agent.ts
 * 
 * Cara kerja file ini:
 * - LLM Agent untuk menghasilkan penjelasan (explanation) dalam bahasa natural
 *   dari data analitik yang sudah terstruktur.
 * - Menggunakan LLM client (`generateChatCompletion`) untuk memanggil AI.
 * - Fallback ke template text jika panggilan LLM gagal (graceful degradation).
 * - Tiga fungsi utama: analyzeRisk, analyzeTrend, explainCluster.
 * 
 * Alur lengkap untuk setiap fungsi:
 * 1. Buat prompt terstruktur dari data numerik → minta LLM menghasilkan teks.
 * 2. Panggil generateChatCompletion() dengan system prompt + user prompt.
 * 3. Parse response LLM (split berdasarkan marker/format tertentu).
 * 4. Jika sukses → return hasil parsing.
 * 5. Jika gagal (catch) → return fallback template (tidak pernah throw).
 * 
 * Catatan penting:
 * - Ini adalah penggunaan LLM yang VALID: generate penjelasan readable dari data.
 * - Kami TIDAK meminta LLM: mengevaluasi model, memfabrikasi confidence,
 *   atau berpura-pura ini "AI-powered ML".
 * - Semua fungsi bersifat opsional — sistem tetap berjalan tanpa LLM.
 */

import { generateChatCompletion } from "../ai/llm.client";
import logger from "../../lib/logger";

/**
 * StudentSummary
 * 
 * Ringkasan data siswa yang diberikan ke LLM untuk analisis.
 */
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

/**
 * RiskPrediction
 * 
 * Hasil risk assessment yang diberikan ke LLM untuk eksplanasi.
 */
interface RiskPrediction {
  level: string;
  factors: string[];
  score: number;
}

/**
 * TrendPrediction
 * 
 * Hasil trend prediction yang diberikan ke LLM untuk eksplanasi.
 */
interface TrendPrediction {
  slope: number;
  rSquared: number;
  nextPrediction: number;
  direction: "NAIK" | "STABIL" | "TURUN";
}

/**
 * ClusterInfo
 * 
 * Informasi satu cluster: ID, label, dan deskripsi.
 */
interface ClusterInfo {
  clusterId: number;
  label: string;
  description: string;
}

/**
 * analyzeRisk
 * 
 * Menghasilkan analisis risiko siswa dalam bahasa natural menggunakan LLM.
 * 
 * Flow:
 * 1. Buat prompt dari data StudentSummary + RiskPrediction.
 * 2. Panggil LLM dengan system prompt + user prompt.
 * 3. Parse response: pisahkan bagian **Analisis** dan **Rekomendasi**.
 * 4. Return { explanation, recommendations }.
 * 
 * Fallback: teks template sederhana jika LLM gagal.
 * 
 * @param student - Data ringkasan siswa
 * @param risk - Hasil risk assessment
 * @returns Object berisi explanation (string) dan recommendations (string[])
 */
export async function analyzeRisk(
  student: StudentSummary,
  risk: RiskPrediction
): Promise<{ explanation: string; recommendations: string[] }> {
  logger.info({ studentName: student.name, riskLevel: risk.level }, "analyzeRisk called");

  try {
    // Buat prompt terstruktur dengan data akademik dan hasil analisis risiko
    const prompt = `Anda adalah asisten analisis akademik untuk guru SD. Analisis data siswa berikut dan berikan penjelasan dalam Bahasa Indonesia yang ramah dan mudah dipahami.

Data Siswa:
- Nama: ${student.name}
- Rata-rata nilai: ${student.avgKnowledge.toFixed(1)}
- Volatilitas nilai: ${student.scoreVolatility.toFixed(1)}
- Perubahan nilai antar semester: ${student.scoreDelta > 0 ? "+" : ""}${student.scoreDelta.toFixed(1)}
- Total ketidakhadiran: ${student.totalAbsence}
- Jumlah prestasi: ${student.achievementCount}

Hasil Analisis Risiko:
- Level Risiko: ${risk.level}
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

    // Parse response: split berdasarkan marker "Rekomendasi"
    const sections = content.split(/\*{0,2}Rekomendasi\*{0,2}\s*:?\s*/i);
    let explanation = sections[0] || content;
    // Bersihkan marker "Analisis" dari explanation
    explanation = explanation.replace(/\*{0,2}Analisis\*{0,2}\s*:?\s*/i, "").trim();

    // Parse rekomendasi dari section kedua (baris per baris)
    const recSection = sections[1] || "";
    const recommendations = recSection
      .split("\n")
      .map((line) => line.replace(/^[-*]\s*/, "").trim())
      .filter((line) => line.length > 5);

    const result = {
      explanation,
      recommendations: recommendations.length > 0 ? recommendations : risk.factors,
    };

    logger.info({ studentName: student.name }, "analyzeRisk completed with LLM response");
    return result;
  } catch (err) {
    // Graceful fallback — gunakan template teks sederhana
    logger.warn({ err, studentName: student.name }, "LLM risk analysis failed, using fallback template");
    return {
      explanation: `Berdasarkan data, siswa ${student.name} berada pada level ${risk.level}. Faktor utama: ${risk.factors.join(", ")}.`,
      recommendations: risk.factors,
    };
  }
}

/**
 * analyzeTrend
 * 
 * Menghasilkan analisis tren akademik siswa dalam bahasa natural menggunakan LLM.
 * 
 * Flow:
 * 1. Tentukan label arah tren (meningkat/menurun/stabil).
 * 2. Buat prompt dari data + hasil regresi (slope, R², prediksi).
 * 3. Panggil LLM → dapatkan explanation.
 * 4. Return { explanation }.
 * 
 * @param student - Data ringkasan siswa
 * @param trend - Hasil trend prediction (slope, R², direction, nextPrediction)
 * @returns Object berisi explanation (string) dari LLM atau fallback
 */
export async function analyzeTrend(
  student: StudentSummary,
  trend: TrendPrediction
): Promise<{ explanation: string }> {
  logger.info({ studentName: student.name, trendDirection: trend.direction }, "analyzeTrend called");

  try {
    // Tentukan label arah tren dalam bahasa Indonesia
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
- Kualitas model (R²): ${(trend.rSquared * 100).toFixed(0)}%

Berikan analisis singkat dalam 2-3 kalimat tentang tren akademik siswa ini dalam Bahasa Indonesia.`;

    const content = await generateChatCompletion([
      {
        role: "system",
        content:
          "Anda adalah asisten analisis tren akademik SD.",
      },
      { role: "user", content: prompt },
    ]);

    logger.info({ studentName: student.name }, "analyzeTrend completed with LLM response");
    return { explanation: content };
  } catch (err) {
    // Graceful fallback — deskripsi sederhana berdasarkan arah tren
    logger.warn({ err, studentName: student.name }, "LLM trend analysis failed, using fallback template");
    const dir =
      trend.direction === "NAIK"
        ? "naik"
        : trend.direction === "TURUN"
          ? "turun"
          : "stabil";
    return {
      explanation: `Tren akademik ${student.name} cenderung ${dir} dengan prediksi nilai semester depan sekitar ${trend.nextPrediction.toFixed(0)}.`,
    };
  }
}

/**
 * explainCluster
 * 
 * Menghasilkan label dan deskripsi untuk setiap cluster menggunakan LLM.
 * 
 * Flow:
 * 1. Format data cluster (ID, size, avgKnowledge, avgAbsence) sebagai teks.
 * 2. Buat prompt → minta LLM memberi label dan deskripsi per cluster.
 * 3. Parse response: cari baris yang mengandung "Cluster N" untuk setiap cluster.
 * 4. Return { profiles } dengan label dan deskripsi.
 * 
 * @param clusters - Array data cluster hasil K-Means
 * @returns Object berisi profiles[] dengan label dan deskripsi per cluster
 */
export async function explainCluster(
  clusters: { clusterId: number; size: number; avgKnowledge: number; avgAbsence: number }[]
): Promise<{ profiles: ClusterInfo[] }> {
  logger.info({ clusterCount: clusters.length }, "explainCluster called");

  try {
    // Format data cluster sebagai teks untuk prompt
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

    // Parse response: cari baris yang mengandung "Cluster N" untuk setiap cluster
    const profiles: ClusterInfo[] = clusters.map((c) => {
      const line = content
        .split("\n")
        .find((l) => l.includes(`Cluster ${c.clusterId}`));
      // Label = bagian sebelum "—", setelah ":", deskripsi = bagian setelah "—"
      const label = line?.split("—")[0]?.split(":")[1]?.trim() || `Cluster ${c.clusterId}`;
      const description = line?.split("—")[1]?.trim() || "";
      return { clusterId: c.clusterId, label, description };
    });

    logger.info({ clusterCount: clusters.length }, "explainCluster completed with LLM response");
    return { profiles };
  } catch (err) {
    // Graceful fallback — label dan deskripsi generik
    logger.warn({ err }, "LLM cluster explanation failed, using fallback labels");
    return {
      profiles: clusters.map((c) => ({
        clusterId: c.clusterId,
        label: `Kelompok ${c.clusterId + 1}`,
        description: `${c.size} siswa dengan rata-rata nilai ${c.avgKnowledge.toFixed(0)}`,
      })),
    };
  }
}

import type { StudentFeatures } from "./features";

export type RiskLevel = "AMAN" | "WASPADA" | "KRITIS";

export interface RiskAssessment {
  studentId: string;
  level: RiskLevel;
  score: number; // 0-100 (100 = highest risk)
  factors: string[];
  recommendations: string[];
}

/**
 * Rule-based early warning system.
 * Returns risk level + contributing factors + recommendations.
 */
export function assessRisk(features: StudentFeatures): RiskAssessment {
  const factors: string[] = [];
  const recommendations: string[] = [];
  let riskScore = 0;

  // ── Akademik ──────────────────────────────────────────────────────
  if (features.semesterCount >= 2 && features.scoreDelta < -10) {
    factors.push(`Nilai turun ${Math.abs(features.scoreDelta).toFixed(0)} poin`);
    riskScore += 25;
    recommendations.push("Review metode belajar, berikan latihan tambahan");
  }
  if (features.semesterCount >= 2 && features.scoreDelta < -20) {
    riskScore += 15; // tambahan untuk penurunan parah
    recommendations.push("Pertimbangkan bimbingan belajar khusus");
  }
  if (features.avgKnowledge < 70) {
    factors.push(`Rata-rata nilai ${features.avgKnowledge.toFixed(0)} (di bawah 70)`);
    riskScore += 15;
    recommendations.push("Fokus pada penguatan dasar mata pelajaran");
  }
  if (features.scoreVolatility > 15) {
    factors.push(`Nilai tidak stabil (volatilitas ${features.scoreVolatility.toFixed(0)})`);
    riskScore += 10;
    recommendations.push("Perhatikan konsistensi belajar siswa");
  }

  // ── Kehadiran ──────────────────────────────────────────────────────
  const avgAbsencePerSemester =
    features.semesterCount > 0
      ? features.totalAbsence / features.semesterCount
      : 0;

  if (avgAbsencePerSemester > 5) {
    factors.push(`Rata-rata ketidakhadiran ${avgAbsencePerSemester.toFixed(0)}/semester`);
    riskScore += 20;
    recommendations.push("Komunikasikan dengan orang tua tentang kehadiran");
  }
  if (features.absenceTrend > 2) {
    factors.push("Tren alpha meningkat");
    riskScore += 10;
    recommendations.push("Cari penyebab peningkatan ketidakhadiran");
  }

  // ── Prestasi ───────────────────────────────────────────────────────
  if (features.semesterCount >= 2 && features.achievementCount === 0) {
    factors.push("Belum ada prestasi akademik/non-akademik");
    riskScore += 5;
    recommendations.push("Dorong partisipasi dalam kegiatan sekolah");
  }

  // ── Skor Final ─────────────────────────────────────────────────────
  const level: RiskLevel =
    riskScore >= 50 ? "KRITIS" : riskScore >= 25 ? "WASPADA" : "AMAN";

  return {
    studentId: features.studentId,
    level,
    score: Math.min(riskScore, 100),
    factors: factors.length > 0 ? factors : ["Tidak ada faktor risiko signifikan"],
    recommendations: recommendations.length > 0
      ? recommendations
      : ["Pertahankan performa akademik"],
  };
}

/**
 * Assess risk for all students in a class.
 */
export async function assessClassRisk(
  featuresMap: Map<string, StudentFeatures>
): Promise<Map<string, RiskAssessment>> {
  const result = new Map<string, RiskAssessment>();
  for (const [studentId, features] of featuresMap) {
    result.set(studentId, assessRisk(features));
  }
  return result;
}

/**
 * Generate trend analysis summary for a student.
 */
export function trendSummary(features: StudentFeatures): {
  trend: "NAIK" | "STABIL" | "TURUN";
  description: string;
} {
  if (features.semesterCount < 2) {
    return { trend: "STABIL", description: "Data belum cukup untuk analisis tren" };
  }

  if (features.scoreDelta > 5) {
    return {
      trend: "NAIK",
      description: `Nilai meningkat ${features.scoreDelta.toFixed(0)} poin dari semester sebelumnya`,
    };
  }
  if (features.scoreDelta < -5) {
    return {
      trend: "TURUN",
      description: `Nilai turun ${Math.abs(features.scoreDelta).toFixed(0)} poin dari semester sebelumnya`,
    };
  }
  return {
    trend: "STABIL",
    description: "Nilai relatif stabil dibanding semester sebelumnya",
  };
}

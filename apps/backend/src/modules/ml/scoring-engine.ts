/**
 * Scoring Engine — Honest rule-based risk assessment.
 *
 * BUKAN machine learning. Ini adalah weighted scoring system yang transparent,
 * documented, dan bisa diaudit. Setiap bobot dan threshold punya justifikasi
 * berdasarkan praktik pendidikan umum.
 *
 * Kenapa nggak pake ML?
 * - Kita nggak punya ground truth labels (data historis "siswa ini beneran bermasalah").
 * - Decision tree yang dilatih pada synthetic labels cuma ngereplikasi heuristic kita.
 * - Lebih jujur pake rule-based scoring yang transparan daripada pretend ML.
 */

export interface ScoringInput {
  /** Rata-rata nilai pengetahuan dari semua semester (0-100) */
  avgKnowledge: number;
  /** Standar deviasi rata-rata nilai per semester — ukur kestabilan */
  scoreVolatility: number;
  /** Total ketidakhadiran (sakit + izin + alpha) sepanjang riwayat */
  totalAbsence: number;
  /** Perubahan nilai semester terakhir vs sebelumnya (+/-) */
  scoreDelta: number;
  /** Jumlah semester dengan data */
  semesterCount: number;
  /** Jumlah total prestasi */
  achievementCount: number;
  /** Rata-rata alpha per semester (opsional, untuk absence trend) */
  avgAbsencePerSemester?: number;
}

export interface ScoringResult {
  /** Skor risiko 0-100 (0 = aman, 100 = kritis) */
  score: number;
  /** Level risiko */
  level: "AMAN" | "WASPADA" | "KRITIS";
  /** Faktor-faktor kontribusi (hanya yang aktif) */
  factors: ScoringFactor[];
  /** Penjelasan singkat */
  summary: string;
}

export interface ScoringFactor {
  name: string;
  label: string;
  /** Seberapa besar kontribusi ke skor akhir (0-1) */
  contribution: number;
  detail: string;
}

/*
 * BOBOT RISIKO — documented rationale
 *
 * Setiap faktor dapat berkontribusi maksimum `maxPoints` poin.
 * Total maksimum skor = 100.
 *
 * Pedagogical rationale:
 * - Nilai akademik secara umum adalah indikator paling kuat → 35 pts
 * - Ketidakhadiran langsung mempengaruhi pembelajaran → 25 pts
 * - Trend negatif menunjukkan masalah berkelanjutan → 20 pts
 * - Volatilitas bisa menunjukkan ketidakstabilan belajar → 10 pts
 * - Kurangnya prestasi mungkin indikasi engagement rendah → 10 pts
 */

const WEIGHTS = {
  LOW_KNOWLEDGE: { maxPoints: 35, label: "Nilai Rendah", desc: "Rata-rata nilai di bawah 70" },
  HIGH_VOLATILITY: { maxPoints: 10, label: "Nilai Tidak Stabil", desc: "Volatilitas nilai > 15" },
  HIGH_ABSENCE: { maxPoints: 25, label: "Ketidakhadiran Tinggi", desc: "Rata-rata alpha > 5 per semester" },
  NEGATIVE_TREND: { maxPoints: 20, label: "Tren Menurun", desc: "Nilai turun > 10 poin antar semester" },
  NO_ACHIEVEMENT: { maxPoints: 10, label: "Kurang Prestasi", desc: "Belum ada prestasi (min 2 semester)" },
} as const;

export function evaluateRisk(input: ScoringInput): ScoringResult {
  const factors: ScoringFactor[] = [];
  let totalScore = 0;

  // 1. LOW KNOWLEDGE — pengetahuan di bawah KKM
  if (input.semesterCount > 0 && input.avgKnowledge < 70) {
    const severity = Math.min(1, (70 - input.avgKnowledge) / 30); // 0-1 berdasarkan jarak dari 70
    const pts = Math.round(WEIGHTS.LOW_KNOWLEDGE.maxPoints * severity);
    if (pts > 0) {
      totalScore += pts;
      factors.push({
        name: "LOW_KNOWLEDGE",
        label: WEIGHTS.LOW_KNOWLEDGE.label,
        contribution: pts / 100,
        detail: `Rata-rata nilai ${input.avgKnowledge.toFixed(0)} (di bawah KKM 70)`,
      });
    }
  }

  // 2. HIGH VOLATILITY — nilai tidak stabil antar semester
  if (input.semesterCount >= 2 && input.scoreVolatility > 15) {
    const severity = Math.min(1, (input.scoreVolatility - 15) / 25);
    const pts = Math.round(WEIGHTS.HIGH_VOLATILITY.maxPoints * severity);
    totalScore += pts;
    factors.push({
      name: "HIGH_VOLATILITY",
      label: WEIGHTS.HIGH_VOLATILITY.label,
      contribution: pts / 100,
      detail: `Volatilitas nilai ${input.scoreVolatility.toFixed(0)} poin (fluktuatif)`,
    });
  }

  // 3. HIGH ABSENCE — alpha per semester
  if (input.semesterCount > 0) {
    const avgAlpha = input.avgAbsencePerSemester ?? input.totalAbsence / input.semesterCount;
    if (avgAlpha > 5) {
      const severity = Math.min(1, (avgAlpha - 5) / 10);
      const pts = Math.round(WEIGHTS.HIGH_ABSENCE.maxPoints * severity);
      totalScore += pts;
      factors.push({
        name: "HIGH_ABSENCE",
        label: WEIGHTS.HIGH_ABSENCE.label,
        contribution: pts / 100,
        detail: `Rata-rata ketidakhadiran ${avgAlpha.toFixed(1)} hari/semester`,
      });
    }
  }

  // 4. NEGATIVE TREND — nilai turun signifikan
  if (input.semesterCount >= 2 && input.scoreDelta < -10) {
    const severity = Math.min(1, Math.abs(input.scoreDelta + 10) / 20);
    const pts = Math.round(WEIGHTS.NEGATIVE_TREND.maxPoints * severity);
    totalScore += pts;
    factors.push({
      name: "NEGATIVE_TREND",
      label: WEIGHTS.NEGATIVE_TREND.label,
      contribution: pts / 100,
      detail: `Nilai turun ${Math.abs(input.scoreDelta).toFixed(0)} poin dari semester sebelumnya`,
    });
  }

  // 5. NO ACHIEVEMENT — belum ada prestasi (min 2 semester)
  if (input.semesterCount >= 2 && input.achievementCount === 0) {
    totalScore += WEIGHTS.NO_ACHIEVEMENT.maxPoints;
    factors.push({
      name: "NO_ACHIEVEMENT",
      label: WEIGHTS.NO_ACHIEVEMENT.label,
      contribution: WEIGHTS.NO_ACHIEVEMENT.maxPoints / 100,
      detail: "Belum ada prestasi akademik/non-akademik yang tercatat",
    });
  }

  // Clamp ke 0-100
  totalScore = Math.max(0, Math.min(100, totalScore));

  // Tentukan level
  let level: "AMAN" | "WASPADA" | "KRITIS";
  if (totalScore >= 50) level = "KRITIS";
  else if (totalScore >= 25) level = "WASPADA";
  else level = "AMAN";

  // Summary
  let summary: string;
  if (totalScore === 0) {
    summary = "Tidak terdeteksi faktor risiko yang signifikan.";
  } else if (factors.length === 1) {
    summary = `Faktor utama: ${factors[0].label}.`;
  } else if (factors.length === 2) {
    summary = `Faktor utama: ${factors[0].label} dan ${factors[1].label}.`;
  } else {
    const last = factors.pop()!;
    summary = `Faktor utama: ${factors.map((f) => f.label).join(", ")}, dan ${last.label}.`;
    factors.push(last); // restore
  }

  return {
    score: totalScore,
    level,
    factors,
    summary,
  };
}

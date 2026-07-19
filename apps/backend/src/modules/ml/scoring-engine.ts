/**
 * scoring-engine.ts
 * 
 * Cara kerja file ini:
 * - Scoring Engine untuk risk assessment siswa — menggunakan rule-based weighted scoring.
 * - BUKAN machine learning. Ini adalah sistem skoring transparan yang bisa diaudit.
 * - Setiap faktor risiko memiliki bobot (maxPoints) dan threshold yang jelas.
 * - Total skor 0-100: 0 = aman, 100 = kritis.
 * 
 * Alur lengkap evaluateRisk(input):
 * 1. Evaluasi 5 faktor risiko secara berurutan:
 *    a. LOW_KNOWLEDGE (max 35 pts) — nilai < 70, severity berdasarkan jarak dari 70.
 *    b. HIGH_VOLATILITY (max 10 pts) — volatilitas > 15, severity berdasarkan selisih.
 *    c. HIGH_ABSENCE (max 25 pts) — rata-rata alpha > 5 per semester.
 *    d. NEGATIVE_TREND (max 20 pts) — scoreDelta < -10 (turun signifikan).
 *    e. NO_ACHIEVEMENT (max 10 pts) — achievementCount = 0 dengan minimal 2 semester data.
 * 2. Total skor di-clamp ke [0, 100].
 * 3. Level ditentukan berdasarkan threshold: >= 50 = KRITIS, >= 25 = WASPADA, < 25 = AMAN.
 * 4. Summary dibuat secara deskriptif berdasarkan faktor yang aktif.
 * 5. Return ScoringResult { score, level, factors[], summary }.
 * 
 * Pedagogical rationale bobot:
 * - Nilai akademik adalah indikator paling kuat → 35 pts
 * - Ketidakhadiran langsung mempengaruhi pembelajaran → 25 pts
 * - Trend negatif menunjukkan masalah berkelanjutan → 20 pts
 * - Volatilitas bisa menunjukkan ketidakstabilan belajar → 10 pts
 * - Kurangnya prestasi mungkin indikasi engagement rendah → 10 pts
 */

import logger from "../../lib/logger";

/**
 * ScoringInput
 * 
 * Input yang diperlukan oleh scoring engine untuk menghitung risk score.
 * Semua nilai numerik diekstrak dari feature vector (StudentFeatures).
 */
export interface ScoringInput {
  /** Rata-rata nilai pengetahuan dari semua semester (0-100) */
  avgKnowledge: number;
  /** Standar deviasi rata-rata nilai per semester — mengukur kestabilan performa */
  scoreVolatility: number;
  /** Total ketidakhadiran (sakit + izin + alpha) sepanjang riwayat */
  totalAbsence: number;
  /** Perubahan nilai semester terakhir vs sebelumnya (+/-) */
  scoreDelta: number;
  /** Jumlah semester dengan data yang tercatat */
  semesterCount: number;
  /** Jumlah total prestasi sepanjang riwayat */
  achievementCount: number;
  /** Rata-rata ketidakhadiran per semester (opsional, untuk absence trend) */
  avgAbsencePerSemester?: number;
}

/**
 * ScoringResult
 * 
 * Hasil dari scoring engine — berisi skor, level, faktor kontribusi, dan ringkasan.
 */
export interface ScoringResult {
  /** Skor risiko 0-100 (0 = aman, 100 = kritis) */
  score: number;
  /** Level risiko — AMAN, WASPADA, atau KRITIS */
  level: "AMAN" | "WASPADA" | "KRITIS";
  /** Faktor-faktor kontribusi (hanya yang aktif/terpenuhi threshold-nya) */
  factors: ScoringFactor[];
  /** Penjelasan singkat dalam bahasa Indonesia */
  summary: string;
}

/**
 * ScoringFactor
 * 
 * Satu faktor risiko yang teridentifikasi — berisi nama, label, kontribusi, dan detail.
 */
export interface ScoringFactor {
  /** Nama internal faktor (snake_case) */
  name: string;
  /** Label display dalam bahasa Indonesia */
  label: string;
  /** Seberapa besar kontribusi terhadap skor akhir (0-1) */
  contribution: number;
  /** Deskripsi detail dalam bahasa Indonesia */
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

/** Bobot risiko untuk setiap faktor — konstanta immutable */
const WEIGHTS = {
  LOW_KNOWLEDGE: { maxPoints: 35, label: "Nilai Rendah", desc: "Rata-rata nilai di bawah 70" },
  HIGH_VOLATILITY: { maxPoints: 10, label: "Nilai Tidak Stabil", desc: "Volatilitas nilai > 15" },
  HIGH_ABSENCE: { maxPoints: 25, label: "Ketidakhadiran Tinggi", desc: "Rata-rata alpha > 5 per semester" },
  NEGATIVE_TREND: { maxPoints: 20, label: "Tren Menurun", desc: "Nilai turun > 10 poin antar semester" },
  NO_ACHIEVEMENT: { maxPoints: 10, label: "Kurang Prestasi", desc: "Belum ada prestasi (min 2 semester)" },
} as const;

/**
 * evaluateRisk
 * 
 * Fungsi utama scoring engine. Mengevaluasi 5 faktor risiko berdasarkan input
 * dan menghasilkan skor, level, serta faktor-faktor kontribusi.
 * 
 * Proses:
 * 1. Inisialisasi factors[] = [] dan totalScore = 0.
 * 2. Evaluasi setiap faktor secara berurutan:
 *    - Cek apakah threshold terpenuhi (berdasarkan semesterCount dan nilai).
 *    - Hitung severity (0-1) berdasarkan jarak dari threshold.
 *    - Hitung points = maxPoints * severity.
 *    - Tambahkan ke totalScore dan factors[].
 * 3. Clamp totalScore ke [0, 100].
 * 4. Tentukan level berdasarkan threshold.
 * 5. Generate summary deskriptif.
 * 6. Return ScoringResult.
 * 
 * @param input - ScoringInput yang berisi fitur-fitur siswa
 * @returns ScoringResult — skor, level, faktor, dan ringkasan
 */
export function evaluateRisk(input: ScoringInput): ScoringResult {
  logger.debug({ avgKnowledge: input.avgKnowledge, semesterCount: input.semesterCount }, "evaluateRisk called");

  const factors: ScoringFactor[] = [];
  let totalScore = 0;

  // ── 1. LOW KNOWLEDGE — pengetahuan di bawah KKM (70) ──
  // Hanya evaluasi jika ada data semester (semesterCount > 0)
  if (input.semesterCount > 0 && input.avgKnowledge < 70) {
    // severity: 0-1 berdasarkan jarak dari KKM 70, maksimum di 30 poin di bawah KKM
    const severity = Math.min(1, (70 - input.avgKnowledge) / 30);
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

  // ── 2. HIGH VOLATILITY — nilai tidak stabil antar semester ──
  // Minimal 2 semester untuk bisa menghitung volatilitas
  if (input.semesterCount >= 2 && input.scoreVolatility > 15) {
    // severity: berdasarkan seberapa jauh di atas threshold 15
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

  // ── 3. HIGH ABSENCE — rata-rata alpha per semester ──
  if (input.semesterCount > 0) {
    // Gunakan avgAbsencePerSemester jika disediakan, fallback ke totalAbsence / semesterCount
    const avgAlpha = input.avgAbsencePerSemester ?? input.totalAbsence / input.semesterCount;
    if (avgAlpha > 5) {
      // severity: berdasarkan seberapa jauh di atas threshold 5
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

  // ── 4. NEGATIVE TREND — nilai turun signifikan ──
  // Minimal 2 semester, scoreDelta < -10 (turun lebih dari 10 poin)
  if (input.semesterCount >= 2 && input.scoreDelta < -10) {
    // severity: berdasarkan seberapa besar penurunan di atas 10 poin
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

  // ── 5. NO ACHIEVEMENT — belum ada prestasi (minimal 2 semester) ──
  if (input.semesterCount >= 2 && input.achievementCount === 0) {
    totalScore += WEIGHTS.NO_ACHIEVEMENT.maxPoints;
    factors.push({
      name: "NO_ACHIEVEMENT",
      label: WEIGHTS.NO_ACHIEVEMENT.label,
      contribution: WEIGHTS.NO_ACHIEVEMENT.maxPoints / 100,
      detail: "Belum ada prestasi akademik/non-akademik yang tercatat",
    });
  }

  // Clamp total skor ke rentang [0, 100]
  totalScore = Math.max(0, Math.min(100, totalScore));

  // Tentukan level berdasarkan threshold
  let level: "AMAN" | "WASPADA" | "KRITIS";
  if (totalScore >= 50) level = "KRITIS";
  else if (totalScore >= 25) level = "WASPADA";
  else level = "AMAN";

  // Generate summary deskriptif berdasarkan faktor aktif
  let summary: string;
  if (totalScore === 0) {
    summary = "Tidak terdeteksi faktor risiko yang signifikan.";
  } else if (factors.length === 1) {
    summary = `Faktor utama: ${factors[0].label}.`;
  } else if (factors.length === 2) {
    summary = `Faktor utama: ${factors[0].label} dan ${factors[1].label}.`;
  } else {
    // Untuk 3+ faktor: pop terakhir, buat list, lalu restore
    const last = factors.pop()!;
    summary = `Faktor utama: ${factors.map((f) => f.label).join(", ")}, dan ${last.label}.`;
    factors.push(last); // restore array ke kondisi semula
  }

  logger.info(
    { score: totalScore, level, factorCount: factors.length },
    "evaluateRisk completed"
  );

  return {
    score: totalScore,
    level,
    factors,
    summary,
  };
}

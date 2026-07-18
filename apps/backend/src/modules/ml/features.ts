import { prisma } from "../../lib/prisma";

/**
 * Feature Vector — computed features for a single student.
 *
 * Feature Documentation:
 * | Feature | Range | Description |
 * |---------|-------|-------------|
 * | avgKnowledge | 0-100 | Rata-rata nilai pengetahuan dari semua subject scores across all semesters |
 * | avgSkills | 0-100 | Rata-rata nilai keterampilan dari semua subject scores across all semesters |
 * | scoreVolatility | 0+ | Standar deviasi rata-rata nilai per semester — ukuran kestabilan performa |
 * | scoreDelta | ±100 | Perubahan rata-rata nilai semester terakhir vs semester sebelumnya |
 * | totalAbsence | 0+ | Total hari ketidakhadiran (sakit + izin + alpha) sepanjang riwayat |
 * | absenceTrend | ±N | Perubahan jumlah alpha dari semester sebelumnya ke semester terakhir. **Caveat**: hanya berdasarkan 2 data points terakhir, minimal interpretasi |
 * | achievementCount | 0+ | Total jumlah prestasi sepanjang riwayat |
 * | semesterCount | 1+ | Jumlah semester dengan data yang tercatat |
 */

export interface StudentFeatures {
  studentId: string;
  /** Rata-rata nilai pengetahuan (0-100) */
  avgKnowledge: number;
  /** Rata-rata nilai keterampilan (0-100) */
  avgSkills: number;
  /** Standar deviasi rata-rata nilai per semester — ukur kestabilan */
  scoreVolatility: number;
  /** Perubahan nilai semester terakhir vs sebelumnya (+/-) */
  scoreDelta: number;
  /** Total hari ketidakhadiran sepanjang riwayat */
  totalAbsence: number;
  /** Perubahan alpha dari semester sebelumnya ke terakhir (hanya 2 data points — interpret with caution) */
  absenceTrend: number;
  /** Total jumlah prestasi */
  achievementCount: number;
  /** Jumlah semester dengan data */
  semesterCount: number;
  /** Academic year ID dari semester terakhir */
  academicYearId?: string;
}

/**
 * Compute feature vector for a single student based on ALL semester records.
 */
export async function computeFeatures(studentId: string): Promise<StudentFeatures> {
  const records = await prisma.semesterRecord.findMany({
    where: { studentId },
    include: {
      subjectScores: true,
      attendance: true,
      achievements: true,
      academicYear: { select: { year: true } },
    },
    orderBy: [{ academicYear: { year: "asc" } }, { semester: "asc" }],
  });

  if (records.length === 0) {
    return {
      studentId,
      avgKnowledge: 0,
      avgSkills: 0,
      scoreVolatility: 0,
      scoreDelta: 0,
      totalAbsence: 0,
      absenceTrend: 0,
      achievementCount: 0,
      semesterCount: 0,
    };
  }

  // Rata-rata nilai semua semester
  const allScores = records.flatMap((r) => r.subjectScores);
  const avgKnowledge =
    allScores.length > 0
      ? allScores.reduce((s, sc) => s + sc.knowledgeScore, 0) / allScores.length
      : 0;
  const avgSkills =
    allScores.length > 0
      ? allScores.reduce((s, sc) => s + sc.skillsScore, 0) / allScores.length
      : 0;

  // Volatilitas nilai (standar deviasi rata-rata per semester)
  const semesterAvgs = records.map((r) => {
    const scores = r.subjectScores;
    return scores.length > 0
      ? scores.reduce((s, sc) => s + sc.knowledgeScore, 0) / scores.length
      : 0;
  });
  const mean = semesterAvgs.reduce((s, v) => s + v, 0) / semesterAvgs.length;
  const variance =
    semesterAvgs.reduce((s, v) => s + (v - mean) ** 2, 0) / semesterAvgs.length;
  const scoreVolatility = Math.sqrt(variance);

  // Delta nilai (perubahan semester terakhir vs sebelumnya)
  const scoreDelta =
    semesterAvgs.length >= 2
      ? semesterAvgs[semesterAvgs.length - 1] - semesterAvgs[semesterAvgs.length - 2]
      : 0;

  // Kehadiran
  const attendances = records.filter((r) => r.attendance);
  const totalAbsence = attendances.reduce(
    (s, r) => s + r.attendance!.sick + r.attendance!.permission + r.attendance!.absent,
    0
  );

  // Absence trend: perubahan alpha.
  // CAVEAT: Hanya berdasarkan 2 data points terakhir.
  // Untuk trend yang reliable, butuh minimal 3+ data points.
  // Interpretasi: positif = alpha meningkat, negatif = alpha menurun.
  const absenceTrend =
    attendances.length >= 2
      ? (attendances[attendances.length - 1]!.attendance!.absent) -
        (attendances[attendances.length - 2]!.attendance!.absent)
      : 0;

  // Prestasi
  const achievementCount = records.reduce((s, r) => s + r.achievements.length, 0);

  return {
    studentId,
    avgKnowledge: Math.round(avgKnowledge * 100) / 100,
    avgSkills: Math.round(avgSkills * 100) / 100,
    scoreVolatility: Math.round(scoreVolatility * 100) / 100,
    scoreDelta: Math.round(scoreDelta * 100) / 100,
    totalAbsence,
    absenceTrend,
    achievementCount,
    semesterCount: records.length,
    academicYearId: records[records.length - 1]?.academicYearId,
  };
}

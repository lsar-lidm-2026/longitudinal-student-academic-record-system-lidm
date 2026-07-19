/**
 * features.ts
 * 
 * Cara kerja file ini:
 * - Bertanggung jawab untuk mengekstrak fitur (feature extraction) dari data
 *   akademik siswa yang tersimpan di database.
 * - Fitur-fitur ini digunakan oleh komponen ML lain: risk scoring, trend prediction,
 *   dan behavior clustering.
 * - Data diambil dari tabel SemesterRecord beserta relasi SubjectScore, Attendance,
 *   dan Achievement.
 * 
 * Alur lengkap computeFeatures(studentId):
 * 1. Query prisma.semesterRecord.findMany() dengan include subjectScores, attendance,
 *    achievements, dan academicYear — diurutkan ascending berdasarkan tahun & semester.
 * 2. Jika tidak ada record → return default feature vector (semua 0).
 * 3. Hitung avgKnowledge & avgSkills: rata-rata dari seluruh SubjectScore.
 * 4. Hitung scoreVolatility: standar deviasi dari rata-rata nilai per semester.
 * 5. Hitung scoreDelta: selisih rata-rata semester terakhir vs sebelumnya.
 * 6. Hitung totalAbsence: akumulasi sick + permission + absent dari Attendance.
 * 7. Hitung absenceTrend: perubahan alpha (absent) dari semester sebelumnya ke terakhir.
 * 8. Hitung achievementCount: total jumlah Achievement.
 * 9. Kembalikan StudentFeatures dengan semua nilai dibulatkan 2 desimal.
 * 
 * Catatan penting:
 * - scoreVolatility menggunakan standar devasi populasi (bukan sampel) — karena
 *   kita punya seluruh data yang tersedia.
 * - absenceTrend hanya berdasarkan 2 data points — interpretasi minimal.
 * - academicYearId diambil dari semester record terakhir.
 */

import { prisma } from "../../lib/prisma";
import logger from "../../lib/logger";

/**
 * Feature Vector — fitur yang dihitung untuk satu siswa.
 *
 * Dokumentasi Fitur:
 * | Fitur | Rentang | Deskripsi |
 * |-------|---------|-----------|
 * | avgKnowledge | 0-100 | Rata-rata nilai pengetahuan dari semua subject scores seluruh semester |
 * | avgSkills | 0-100 | Rata-rata nilai keterampilan dari semua subject scores seluruh semester |
 * | scoreVolatility | 0+ | Standar deviasi rata-rata nilai per semester — ukuran kestabilan performa |
 * | scoreDelta | ±100 | Perubahan rata-rata nilai semester terakhir vs semester sebelumnya |
 * | totalAbsence | 0+ | Total hari ketidakhadiran (sakit + izin + alpha) sepanjang riwayat |
 * | absenceTrend | ±N | Perubahan jumlah alpha dari semester sebelumnya ke semester terakhir. **Caveat**: hanya berdasarkan 2 data points terakhir, minimal interpretasi |
 * | achievementCount | 0+ | Total jumlah prestasi sepanjang riwayat |
 * | semesterCount | 1+ | Jumlah semester dengan data yang tercatat |
 */
export interface StudentFeatures {
  /** ID siswa sebagai identifier */
  studentId: string;
  /** Rata-rata nilai pengetahuan (0-100) */
  avgKnowledge: number;
  /** Rata-rata nilai keterampilan (0-100) */
  avgSkills: number;
  /** Standar deviasi rata-rata nilai per semester — mengukur kestabilan performa */
  scoreVolatility: number;
  /** Perubahan nilai semester terakhir vs sebelumnya (+/-) */
  scoreDelta: number;
  /** Total hari ketidakhadiran sepanjang riwayat (sakit + izin + alpha) */
  totalAbsence: number;
  /** Perubahan alpha dari semester sebelumnya ke terakhir (hanya 2 data points — interpretasi hati-hati) */
  absenceTrend: number;
  /** Total jumlah prestasi */
  achievementCount: number;
  /** Jumlah semester dengan data yang tercatat */
  semesterCount: number;
  /** Academic year ID dari semester terakhir */
  academicYearId?: string;
}

/**
 * computeFeatures
 * 
 * Mengekstrak feature vector untuk satu siswa berdasarkan seluruh record semester
 * yang tersimpan di database. Ini adalah fungsi inti yang menjadi dasar bagi
 * risk assessment, trend prediction, dan behavior clustering.
 * 
 * Proses:
 * 1. Query seluruh SemesterRecord milik siswa (termasuk SubjectScore, Attendance, Achievement).
 * 2. Jika tidak ada data → return default (semua 0) dengan semesterCount = 0.
 * 3. Hitung fitur demi fitur dari data yang ada.
 * 4. Kembalikan StudentFeatures yang sudah dibulatkan.
 * 
 * @param studentId - ID siswa yang akan diekstrak fiturnya
 * @returns Promise<StudentFeatures> — feature vector lengkap
 */
export async function computeFeatures(studentId: string): Promise<StudentFeatures> {
  logger.info({ studentId }, "computeFeatures called");

  // Ambil seluruh semester records milik siswa beserta relasi yang diperlukan
  // Urut ascending berdasarkan tahun ajaran dan semester
  const records = await prisma.semesterRecord.findMany({
    where: { studentId },
    include: {
      subjectScores: true,      // Nilai mata pelajaran per semester
      attendance: true,          // Data kehadiran per semester
      achievements: true,        // Prestasi per semester
      academicYear: { select: { year: true } },
    },
    orderBy: [{ academicYear: { year: "asc" } }, { semester: "asc" }],
  });

  logger.debug({ studentId, recordCount: records.length }, "Semester records fetched");

  // Guard: jika tidak ada data, return default feature vector
  if (records.length === 0) {
    logger.warn({ studentId }, "No semester records found, returning default features");
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

  // ── 1. Rata-rata nilai (knowledge & skills) ──
  // Flatmap seluruh SubjectScore dari semua semester
  const allScores = records.flatMap((r) => r.subjectScores);
  const avgKnowledge =
    allScores.length > 0
      ? allScores.reduce((s, sc) => s + sc.knowledgeScore, 0) / allScores.length
      : 0;
  const avgSkills =
    allScores.length > 0
      ? allScores.reduce((s, sc) => s + sc.skillsScore, 0) / allScores.length
      : 0;

  // ── 2. Volatilitas nilai ──
  // Hitung rata-rata nilai per semester, lalu hitung standar deviasi populasi
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

  // ── 3. Delta nilai (perubahan semester terakhir vs sebelumnya) ──
  // Positif = naik, negatif = turun
  const scoreDelta =
    semesterAvgs.length >= 2
      ? semesterAvgs[semesterAvgs.length - 1] - semesterAvgs[semesterAvgs.length - 2]
      : 0;

  // ── 4. Kehadiran ──
  // Filter records yang memiliki data attendance
  const attendances = records.filter((r) => r.attendance);
  // Akumulasi sakit + izin + alpha
  const totalAbsence = attendances.reduce(
    (s, r) => s + r.attendance!.sick + r.attendance!.permission + r.attendance!.absent,
    0
  );

  // ── 5. Absence trend: perubahan alpha ──
  // CAVEAT: Hanya berdasarkan 2 data points terakhir.
  // Untuk trend yang reliable, butuh minimal 3+ data points.
  // Interpretasi: positif = alpha meningkat, negatif = alpha menurun.
  const absenceTrend =
    attendances.length >= 2
      ? (attendances[attendances.length - 1]!.attendance!.absent) -
        (attendances[attendances.length - 2]!.attendance!.absent)
      : 0;

  // ── 6. Prestasi ──
  // Total dari semua achievement di seluruh semester
  const achievementCount = records.reduce((s, r) => s + r.achievements.length, 0);

  // ── 7. Academic year ID terakhir ──
  const academicYearId = records[records.length - 1]?.academicYearId;

  // Susun dan kembalikan feature vector (dibulatkan 2 desimal)
  const features: StudentFeatures = {
    studentId,
    avgKnowledge: Math.round(avgKnowledge * 100) / 100,
    avgSkills: Math.round(avgSkills * 100) / 100,
    scoreVolatility: Math.round(scoreVolatility * 100) / 100,
    scoreDelta: Math.round(scoreDelta * 100) / 100,
    totalAbsence,
    absenceTrend,
    achievementCount,
    semesterCount: records.length,
    academicYearId,
  };

  logger.info(
    {
      studentId,
      avgKnowledge: features.avgKnowledge,
      scoreVolatility: features.scoreVolatility,
      semesterCount: features.semesterCount,
    },
    "computeFeatures completed"
  );

  return features;
}

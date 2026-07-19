/**
 * Profile Service — Logika Bisnis Profil dan Timeline Siswa
 * ==========================================================
 *
 * Cara Kerja:
 * 1. getStudentProfile: Ambil data siswa + class, lalu ambil semua semester record
 *    dengan relasi (subjectScores, attendance, achievements, healthRecord, aiSummaries final).
 * 2. getTimeline: Ambil semester record siswa dan format menjadi array timeline
 *    dengan label "Semester Ganjil/Genap {tahun}".
 * 3. Kedua fungsi melempar NotFoundError jika siswa tidak ditemukan.
 *
 * Alur:
 * 1. Service menerima studentId.
 * 2. getStudentProfile: cari student → jika tidak ada throw error → cari semester records → return.
 * 3. getTimeline: cari semester records → format ke timeline → return.
 */

import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../common/error";
import logger from "../../lib/logger";

/**
 * getStudentProfile — Mengambil profil lengkap siswa beserta seluruh riwayat semester.
 *
 * Data yang dikembalikan mencakup:
 * - Informasi dasar siswa + kelas
 * - Semua semester record dengan nilai, presensi, prestasi, kesehatan, dan ringkasan AI final
 *
 * @param studentId - ID siswa yang akan diambil profilnya.
 * @returns Objek { student, semesterRecords }.
 * @throws NotFoundError jika siswa dengan ID tersebut tidak ditemukan.
 */
export async function getStudentProfile(studentId: string) {
  logger.info({ studentId }, "Fetching student profile");

  // Ambil data siswa beserta informasi kelas
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      class: { select: { id: true, name: true } }, // Hanya field id dan name dari class
    },
  });
  if (!student) {
    logger.error({ studentId }, "Fetch profile failed: Student not found");
    throw new NotFoundError("Student not found");
  }
  logger.debug({ studentId, className: student.class?.name }, "Student found, fetching semester records");

  // Ambil semua semester record siswa dengan seluruh relasi terkait
  const semesterRecords = await prisma.semesterRecord.findMany({
    where: { studentId },
    include: {
      academicYear: { select: { year: true } },                    // Tahun ajaran
      subjectScores: true,                                          // Nilai mata pelajaran
      attendance: true,                                              // Presensi
      achievements: true,                                            // Prestasi
      healthRecord: true,                                            // Catatan kesehatan
      aiSummaries: {
        // Hanya ringkasan AI yang sudah final (disetujui guru)
        where: { isFinal: true },
        select: { summaryType: true, content: true, version: true },
        orderBy: { version: "desc" },  // Urutkan dari versi terbaru
      },
    },
    // Urutkan berdasarkan tahun ajaran (asc) lalu semester (asc)
    orderBy: [{ academicYear: { year: "asc" } }, { semester: "asc" }],
  });

  logger.info({ studentId, semesterRecordCount: semesterRecords.length }, "Student profile fetched successfully");
  return { student, semesterRecords };
}

/**
 * getTimeline — Mengambil kronologi semester siswa dalam format yang siap ditampilkan.
 *
 * @param studentId - ID siswa yang akan diambil timeline-nya.
 * @returns Array of { id, semester, year, label, createdAt }.
 * @throws NotFoundError jika siswa dengan ID tersebut tidak ditemukan.
 */
export async function getTimeline(studentId: string) {
  logger.info({ studentId }, "Fetching student timeline");

  // Ambil semua semester record siswa (hanya perlu academicYear untuk label)
  const records = await prisma.semesterRecord.findMany({
    where: { studentId },
    include: {
      academicYear: { select: { year: true } },
    },
    // Urutkan berdasarkan tahun ajaran (asc) lalu semester (asc)
    orderBy: [{ academicYear: { year: "asc" } }, { semester: "asc" }],
  });

  // Format data menjadi array timeline dengan label yang mudah dibaca
  const timeline = records.map((r) => ({
    id: r.id,
    semester: r.semester,
    year: r.academicYear.year,
    // Contoh label: "Semester Ganjil 2024/2025" atau "Semester Genap 2024/2025"
    label: `Semester ${r.semester === 1 ? "Ganjil" : "Genap"} ${r.academicYear.year}`,
    createdAt: r.createdAt, // Timestamp pembuatan record
  }));

  logger.info({ studentId, recordCount: timeline.length }, "Student timeline fetched successfully");
  return timeline;
}

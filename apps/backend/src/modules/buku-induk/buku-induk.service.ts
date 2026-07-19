/**
 * Buku Induk Service — Logika Bisnis Preview, Validasi, dan Workspace Buku Induk
 * ==============================================================================
 *
 * Cara Kerja:
 * 1. getPreview: Ambil biodata siswa + semua semester record dengan nilai, presensi,
 *    prestasi, dan kesehatan untuk ditampilkan sebagai pratinjau Buku Induk.
 * 2. getValidationStatus: Periksa kelengkapan data per semester (nilai, presensi,
 *    kesehatan) dan beri status complete/incomplete.
 * 3. getWorkspace: Gabungan getPreview + getValidationStatus + timestamp generated.
 * 4. Semua fungsi melempar NotFoundError jika siswa tidak ditemukan.
 *
 * Alur:
 * 1. Service menerima studentId.
 * 2. getPreview: cari student → cari records → format biodata + semesterRecords → return.
 * 3. getValidationStatus: cari student → cari records dengan _count → format → return.
 * 4. getWorkspace: panggil getPreview + getValidationStatus → gabung → return.
 */

import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../common/error";
import { Prisma } from "../../generated/prisma/client";
import logger from "../../lib/logger";

/**
 * getPreview — Mengambil data lengkap siswa untuk pratinjau Buku Induk.
 *
 * @param studentId - ID siswa yang akan diambil preview-nya.
 * @returns Objek { biodata, semesterRecords }.
 * @throws NotFoundError jika siswa dengan ID tersebut tidak ditemukan.
 */
export async function getPreview(studentId: string) {
  logger.info({ studentId }, "Fetching buku induk preview");

  // Ambil data siswa beserta nama kelas
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      class: { select: { name: true } }, // Hanya nama kelas yang dibutuhkan
    },
  });
  if (!student) {
    logger.error({ studentId }, "Preview failed: Student not found");
    throw new NotFoundError("Student not found");
  }
  logger.debug({ studentId, className: student.class.name }, "Student found, fetching semester records");

  // Ambil semua semester record dengan seluruh data terkait
  const records = await prisma.semesterRecord.findMany({
    where: { studentId },
    include: {
      academicYear: { select: { year: true } }, // Tahun ajaran
      subjectScores: true,                        // Nilai mata pelajaran
      attendance: true,                           // Presensi
      achievements: true,                         // Prestasi
      healthRecord: true,                         // Catatan kesehatan
    },
    // Urutkan berdasarkan tahun (asc) lalu semester (asc)
    orderBy: [{ academicYear: { year: "asc" } }, { semester: "asc" }],
  });

  logger.info({ studentId, recordCount: records.length }, "Buku induk preview fetched successfully");

  // Format response: biodata + semester records
  return {
    biodata: {
      nis: student.nis,                   // Nomor Induk Siswa
      nisn: student.nisn,                 // Nomor Induk Siswa Nasional
      name: student.name,                 // Nama lengkap siswa
      gender: student.gender,             // Jenis kelamin
      className: student.class.name,       // Nama kelas
      photoUrl: student.photoUrl,         // URL foto siswa
    },
    // Map setiap semester record ke format yang siap ditampilkan
    semesterRecords: records.map(
      (r: Prisma.SemesterRecordGetPayload<{
        include: {
          academicYear: { select: { year: true } };
          subjectScores: true;
          attendance: true;
          achievements: true;
          healthRecord: true;
        };
      }>) => ({
        id: r.id,
        year: r.academicYear.year,     // Tahun ajaran
        semester: r.semester,           // Semester (1 = Ganjil, 2 = Genap)
        subjectScores: r.subjectScores, // Array nilai mata pelajaran
        attendance: r.attendance,       // Data presensi (1:1)
        achievements: r.achievements,   // Array prestasi
        healthRecord: r.healthRecord,   // Data kesehatan (1:1)
      })
    ),
  };
}

/**
 * getValidationStatus — Memeriksa status kelengkapan data setiap semester.
 *
 * Mengecek tiga komponen:
 * - subjectScores: ada tidaknya nilai mata pelajaran
 * - attendance: ada tidaknya data presensi
 * - healthRecord: ada tidaknya data kesehatan
 *
 * @param studentId - ID siswa yang akan dicek validasinya.
 * @returns Array of { year, semester, status }.
 * @throws NotFoundError jika siswa dengan ID tersebut tidak ditemukan.
 */
export async function getValidationStatus(studentId: string) {
  logger.info({ studentId }, "Fetching validation status");

  // Verifikasi keberadaan siswa (hanya butuh id untuk validasi)
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true },
  });
  if (!student) {
    logger.error({ studentId }, "Validation status failed: Student not found");
    throw new NotFoundError("Student not found");
  }

  // Ambil semua semester record dengan _count untuk subjectScores
  // dan keberadaan attendance & healthRecord
  const records = await prisma.semesterRecord.findMany({
    where: { studentId },
    include: {
      academicYear: { select: { year: true } },     // Tahun ajaran
      _count: { select: { subjectScores: true } },   // Jumlah nilai mata pelajaran
      attendance: { select: { id: true } },           // Cek apakah attendance ada
      healthRecord: { select: { id: true } },         // Cek apakah healthRecord ada
    },
    // Urutkan berdasarkan tahun (asc) lalu semester (asc)
    orderBy: [{ academicYear: { year: "asc" } }, { semester: "asc" }],
  });

  logger.info({ studentId, recordCount: records.length }, "Validation status fetched successfully");

  // Format: setiap record diberi status complete/incomplete untuk setiap komponen
  return records.map(
    (r: Prisma.SemesterRecordGetPayload<{
      include: {
        academicYear: { select: { year: true } };
        _count: { select: { subjectScores: true } };
        attendance: { select: { id: true } };
        healthRecord: { select: { id: true } };
      };
    }>) => ({
      year: r.academicYear.year,         // Tahun ajaran
      semester: r.semester,               // Semester (1/2)
      status: {
        // Nilai: complete jika setidaknya ada 1 subjectScore
        subjectScores: r._count.subjectScores > 0 ? "complete" : "incomplete",
        // Presensi: complete jika data attendance ada
        attendance: r.attendance ? "complete" : "incomplete",
        // Kesehatan: complete jika data healthRecord ada
        healthRecord: r.healthRecord ? "complete" : "incomplete",
      },
    })
  );
}

/**
 * getWorkspace — Menggabungkan preview Buku Induk dengan status validasi.
 *
 * Fungsi ini merupakan aggregator yang memanggil getPreview dan getValidationStatus
 * lalu menggabungkannya dalam satu response bersama timestamp.
 *
 * @param studentId - ID siswa yang akan diambil data workspace-nya.
 * @returns Objek { preview, validation, generatedAt }.
 */
export async function getWorkspace(studentId: string) {
  logger.info({ studentId }, "Fetching administrative workspace");

  // Panggil preview dan validation secara paralel
  const [preview, validation] = await Promise.all([
    getPreview(studentId),
    getValidationStatus(studentId),
  ]);

  logger.info({ studentId }, "Administrative workspace assembled successfully");

  return {
    preview,                                          // Data pratinjau Buku Induk
    validation,                                       // Status kelengkapan per semester
    generatedAt: new Date().toISOString(),              // Timestamp generasi data
  };
}

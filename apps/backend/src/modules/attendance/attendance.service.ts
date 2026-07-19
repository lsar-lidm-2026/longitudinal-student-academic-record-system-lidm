/**
 * Attendance Service — Logika Bisnis Presensi Siswa
 * ==================================================
 *
 * Cara Kerja:
 * 1. upsert: Memeriksa keberadaan SemesterRecord, lalu melakukan Prisma upsert
 *    pada model Attendance (hubungan 1:1 dengan SemesterRecord).
 * 2. Jika SemesterRecord tidak ditemukan, melempar NotFoundError.
 *
 * Alur:
 * 1. Service menerima semesterRecordId dan data { sick, permission, absent }.
 * 2. Memverifikasi keberadaan SemesterRecord.
 * 3. Jika tidak ada, throw NotFoundError.
 * 4. Prisma upsert: jika Attendance sudah ada, update; jika belum, create.
 * 5. Mengembalikan data Attendance yang sudah di-upsert.
 */

import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../common/error";
import logger from "../../lib/logger";

/**
 * upsert — Membuat atau memperbarui data presensi untuk satu semester record.
 *
 * @param semesterRecordId - ID SemesterRecord yang akan dikaitkan dengan presensi.
 * @param data - Objek berisi jumlah hari: sick (sakit), permission (izin), absent (tanpa keterangan).
 * @returns Prisma Attendance record yang sudah di-create atau di-update.
 * @throws NotFoundError jika SemesterRecord dengan ID tersebut tidak ditemukan.
 */
export async function upsert(
  semesterRecordId: string,
  data: { sick: number; permission: number; absent: number }
) {
  logger.info({ semesterRecordId, data }, "Attendance upsert: checking SemesterRecord existence");

  // Verifikasi keberadaan SemesterRecord — prasyarat untuk membuat Attendance
  const record = await prisma.semesterRecord.findUnique({
    where: { id: semesterRecordId },
  });
  if (!record) {
    logger.error({ semesterRecordId }, "Attendance upsert failed: SemesterRecord not found");
    throw new NotFoundError("Semester record not found");
  }

  logger.debug({ semesterRecordId }, "SemesterRecord found, performing upsert on Attendance");

  // Prisma upsert: cocokkan berdasarkan semesterRecordId (unik/1:1)
  // Jika ditemukan → update field sick, permission, absent
  // Jika tidak ditemukan → create record baru dengan data tersebut
  return prisma.attendance.upsert({
    where: { semesterRecordId },
    update: {
      sick: data.sick,
      permission: data.permission,
      absent: data.absent,
    },
    create: {
      semesterRecordId,
      sick: data.sick,
      permission: data.permission,
      absent: data.absent,
    },
  });
}

/**
 * Health Record Service — Logika Bisnis Catatan Kesehatan Siswa
 * =============================================================
 *
 * Cara Kerja:
 * 1. upsert: Memeriksa keberadaan SemesterRecord, lalu melakukan Prisma upsert
 *    pada model HealthRecord (hubungan 1:1 dengan SemesterRecord).
 * 2. Jika SemesterRecord tidak ditemukan, melempar NotFoundError.
 * 3. Semua field HealthRecord bersifat opsional, sehingga bisa partial update.
 *
 * Alur:
 * 1. Service menerima semesterRecordId dan data kesehatan.
 * 2. Memverifikasi keberadaan SemesterRecord.
 * 3. Jika tidak ada, throw NotFoundError.
 * 4. Prisma upsert: jika HealthRecord sudah ada, update; jika belum, create.
 * 5. Mengembalikan data HealthRecord yang sudah di-upsert.
 */

import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../common/error";
import logger from "../../lib/logger";

/**
 * upsert — Membuat atau memperbarui catatan kesehatan untuk satu semester record.
 *
 * @param semesterRecordId - ID SemesterRecord yang akan dikaitkan dengan health record.
 * @param data - Objek berisi data kesehatan (semua opsional).
 * @returns Prisma HealthRecord record yang sudah di-create atau di-update.
 * @throws NotFoundError jika SemesterRecord dengan ID tersebut tidak ditemukan.
 */
export async function upsert(
  semesterRecordId: string,
  data: {
    height?: number;              // Tinggi badan dalam cm (opsional)
    weight?: number;              // Berat badan dalam kg (opsional)
    hearingCondition?: string;    // Kondisi pendengaran (opsional)
    visionCondition?: string;     // Kondisi penglihatan (opsional)
    teethCondition?: string;      // Kondisi gigi (opsional)
  }
) {
  logger.info({ semesterRecordId, data }, "Health record upsert: checking SemesterRecord existence");

  // Verifikasi keberadaan SemesterRecord — prasyarat untuk membuat HealthRecord
  const record = await prisma.semesterRecord.findUnique({
    where: { id: semesterRecordId },
  });
  if (!record) {
    logger.error({ semesterRecordId }, "Health record upsert failed: SemesterRecord not found");
    throw new NotFoundError("Semester record not found");
  }

  logger.debug({ semesterRecordId }, "SemesterRecord found, performing upsert on HealthRecord");

  // Prisma upsert: cocokkan berdasarkan semesterRecordId (unik/1:1)
  // Jika ditemukan → update dengan data baru
  // Jika tidak ditemukan → create record baru dengan data tersebut
  return prisma.healthRecord.upsert({
    where: { semesterRecordId },
    update: data,
    create: {
      semesterRecordId,
      ...data,
    },
  });
}

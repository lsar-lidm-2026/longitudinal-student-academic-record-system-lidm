/**
 * Achievement Service — Logika Bisnis Prestasi Siswa
 * ==================================================
 *
 * Cara Kerja:
 * 1. create: Verifikasi SemesterRecord, lalu buat Achievement baru.
 * 2. update: Verifikasi keberadaan Achievement, lalu update field.
 * 3. remove: Verifikasi keberadaan Achievement, lalu hapus.
 * 4. Semua operasi melempar NotFoundError jika entitas tidak ditemukan.
 *
 * Alur:
 * 1. Service menerima parameter yang diperlukan.
 * 2. Memeriksa keberadaan entitas terkait (SemesterRecord / Achievement).
 * 3. Jika tidak ditemukan, throw NotFoundError.
 * 4. Melakukan operasi Prisma (create / update / delete).
 * 5. Mengembalikan data hasil operasi.
 */

import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../common/error";
import logger from "../../lib/logger";

/**
 * create — Membuat prestasi baru untuk suatu semester record.
 *
 * @param data - Objek berisi semesterRecordId, title, type, dan description opsional.
 * @returns Prisma Achievement record yang baru dibuat.
 * @throws NotFoundError jika SemesterRecord dengan ID tersebut tidak ditemukan.
 */
export async function create(data: {
  semesterRecordId: string;   // ID semester record yang akan dikaitkan
  title: string;              // Judul prestasi
  type: string;               // Jenis prestasi (akademik/non-akademik/dll)
  description?: string;       // Deskripsi tambahan (opsional)
}) {
  logger.info({ semesterRecordId: data.semesterRecordId, title: data.title, type: data.type }, "Creating achievement");

  // Verifikasi keberadaan SemesterRecord — achievement tidak bisa berdiri sendiri
  const record = await prisma.semesterRecord.findUnique({
    where: { id: data.semesterRecordId },
  });
  if (!record) {
    logger.error({ semesterRecordId: data.semesterRecordId }, "Create achievement failed: SemesterRecord not found");
    throw new NotFoundError("Semester record not found");
  }

  logger.debug({ semesterRecordId: data.semesterRecordId }, "SemesterRecord found, creating Achievement");
  // Buat achievement baru dengan data yang diberikan
  return prisma.achievement.create({ data });
}

/**
 * update — Memperbarui prestasi yang sudah ada.
 *
 * @param id - ID Achievement yang akan diperbarui.
 * @param data - Objek partial berisi field yang akan diupdate (title, type, description).
 * @returns Prisma Achievement record yang sudah diupdate.
 * @throws NotFoundError jika Achievement dengan ID tersebut tidak ditemukan.
 */
export async function update(
  id: string,
  data: { title?: string; type?: string; description?: string }
) {
  logger.info({ achievementId: id, data }, "Updating achievement");

  // Verifikasi keberadaan Achievement sebelum update
  const item = await prisma.achievement.findUnique({ where: { id } });
  if (!item) {
    logger.error({ achievementId: id }, "Update achievement failed: Achievement not found");
    throw new NotFoundError("Achievement not found");
  }

  logger.debug({ achievementId: id }, "Achievement found, performing update");
  // Lakukan update dengan data partial (hanya field yang dikirim)
  return prisma.achievement.update({ where: { id }, data });
}

/**
 * remove — Menghapus prestasi.
 *
 * @param id - ID Achievement yang akan dihapus.
 * @returns Prisma Achievement record yang dihapus.
 * @throws NotFoundError jika Achievement dengan ID tersebut tidak ditemukan.
 */
export async function remove(id: string) {
  logger.info({ achievementId: id }, "Deleting achievement");

  // Verifikasi keberadaan Achievement sebelum hapus
  const item = await prisma.achievement.findUnique({ where: { id } });
  if (!item) {
    logger.error({ achievementId: id }, "Delete achievement failed: Achievement not found");
    throw new NotFoundError("Achievement not found");
  }

  logger.debug({ achievementId: id }, "Achievement found, performing delete");
  // Hapus achievement dari database
  return prisma.achievement.delete({ where: { id } });
}

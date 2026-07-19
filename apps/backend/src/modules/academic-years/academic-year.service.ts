/**
 * Academic Year Service — Business logic untuk manajemen tahun ajaran
 * =====================================================================
 *
 * Cara Kerja:
 * 1. Fungsi-fungsi di sini dipanggil oleh academic-year.controller.ts.
 * 2. Semua operasi database dilakukan melalui Prisma Client pada model AcademicYear.
 * 3. Validasi existing entity dilakukan via getById() yang dipanggil oleh fungsi update/activate/archive.
 * 4. Operasi activate menggunakan Prisma $transaction untuk menonaktifkan semua tahun ajaran lalu mengaktifkan satu.
 *
 * Alur Lengkap:
 * - list() → findAll academicYear, order by year desc → return array
 * - getById(id) → findUnique by id → throw NotFoundError jika tidak ditemukan
 * - create(data) → cek duplikat year → ConflictError jika sudah ada → create → return academicYear baru
 * - update(id, data) → getById(id) → update field year → return academicYear terupdate
 * - activate(id) → getById(id) → transaction: deactivate semua → activate satu id → return array [count, updated]
 * - archive(id) → getById(id) → set isArchived=true, isActive=false → return academicYear
 */

import logger from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { ConflictError, NotFoundError } from "../../common/error";

// ── List All ─────────────────────────────────────────────────────────────────

/**
 * list — Mengambil daftar semua tahun ajaran, diurutkan dari tahun terbaru.
 *
 * @returns - Promise<AcademicYear[]>
 */
export async function list() {
  logger.debug("academic-year.service.list — start");

  // Ambil semua academic year, urut descending berdasarkan year
  const items = await prisma.academicYear.findMany({
    orderBy: { year: "desc" },
  });

  logger.debug({ count: items.length }, "academic-year.service.list — success");
  return items;
}

// ── Get By ID ────────────────────────────────────────────────────────────────

/**
 * getById — Mengambil satu tahun ajaran berdasarkan ID.
 *
 * @param id - UUID academic year
 * @returns  - Promise<AcademicYear>
 * @throws   - NotFoundError jika tidak ditemukan
 */
export async function getById(id: string) {
  logger.debug({ academicYearId: id }, "academic-year.service.getById — start");

  const item = await prisma.academicYear.findUnique({ where: { id } });

  if (!item) {
    logger.warn({ academicYearId: id }, "academic-year.service.getById — not found");
    throw new NotFoundError("Academic year not found");
  }

  logger.debug({ academicYearId: id }, "academic-year.service.getById — success");
  return item;
}

// ── Create ───────────────────────────────────────────────────────────────────

/**
 * create — Membuat tahun ajaran baru.
 *
 * Alur:
 * 1. Cek duplikat berdasarkan field unique year → ConflictError jika sudah ada.
 * 2. Simpan academic year baru ke database.
 *
 * @param data - { year: string }
 * @returns    - Promise<AcademicYear>
 * @throws     - ConflictError jika year sudah terdaftar
 */
export async function create(data: { year: string }) {
  logger.info({ year: data.year }, "academic-year.service.create — start");

  // Cek apakah tahun ajaran dengan year yang sama sudah ada
  const existing = await prisma.academicYear.findUnique({
    where: { year: data.year },
  });

  if (existing) {
    logger.warn({ year: data.year }, "academic-year.service.create — already exists");
    throw new ConflictError("Academic year already exists");
  }

  logger.info({ year: data.year }, "academic-year.service.create — creating");

  // Buat academic year baru
  return prisma.academicYear.create({
    data: { year: data.year },
  });
}

// ── Update ───────────────────────────────────────────────────────────────────

/**
 * update — Memperbarui data tahun ajaran (field year).
 *
 * @param id   - UUID academic year yang akan diupdate
 * @param data - { year?: string }
 * @returns    - Promise<AcademicYear>
 * @throws     - NotFoundError jika academic year tidak ditemukan
 */
export async function update(id: string, data: { year?: string }) {
  logger.info({ academicYearId: id, updates: data }, "academic-year.service.update — start");

  // Pastikan academic year ada sebelum diupdate
  await getById(id);

  logger.info({ academicYearId: id }, "academic-year.service.update — updating");

  // Update field year
  return prisma.academicYear.update({
    where: { id },
    data,
  });
}

// ── Activate ─────────────────────────────────────────────────────────────────

/**
 * activate — Mengaktifkan satu tahun ajaran dan menonaktifkan semua lainnya.
 *
 * Alur:
 * 1. Pastikan academic year ada via getById().
 * 2. Dalam satu transaksi: deactivate semua academic year → activate satu.
 *
 * @param id - UUID academic year yang akan diaktifkan
 * @returns  - Promise<[Prisma.BatchPayload, AcademicYear]> (hasil updateMany + update)
 * @throws   - NotFoundError jika academic year tidak ditemukan
 */
export async function activate(id: string) {
  logger.info({ academicYearId: id }, "academic-year.service.activate — start");

  // Pastikan academic year ada
  await getById(id);

  // Transaction: deactivate semua, activate satu
  logger.info({ academicYearId: id }, "academic-year.service.activate — running transaction: deactivate all, activate one");

  return prisma.$transaction([
    // Step 1: Nonaktifkan semua academic year yang sedang aktif
    prisma.academicYear.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    }),
    // Step 2: Aktifkan academic year yang dipilih, hapus status arsip
    prisma.academicYear.update({
      where: { id },
      data: { isActive: true, isArchived: false },
    }),
  ]);
}

// ── Archive ──────────────────────────────────────────────────────────────────

/**
 * archive — Mengarsipkan tahun ajaran (set isArchived=true, isActive=false).
 *
 * @param id - UUID academic year yang akan diarsipkan
 * @returns  - Promise<AcademicYear>
 * @throws   - NotFoundError jika academic year tidak ditemukan
 */
export async function archive(id: string) {
  logger.info({ academicYearId: id }, "academic-year.service.archive — start");

  // Pastikan academic year ada
  await getById(id);

  logger.info({ academicYearId: id }, "academic-year.service.archive — archiving");

  // Set isArchived=true dan isActive=false
  return prisma.academicYear.update({
    where: { id },
    data: { isArchived: true, isActive: false },
  });
}

/**
 * BULK IMPORT SERVICE — Import Siswa Secara Massal
 * ==================================================
 *
 * Cara Kerja:
 * 1. Menerima array data siswa [{ name, nis, nisn, gender, classId }].
 * 2. Melakukan validasi per-entry:
 *    - Field wajib (name, nis, nisn, gender, classId) harus ada.
 *    - Duplikat NIS/NISN dalam batch yang sama.
 *    - Duplikat NIS/NISN dengan database yang sudah ada.
 *    - Validasi classId merujuk ke kelas yang valid.
 * 3. Semua siswa yang valid dibuat dalam satu transaksi database.
 * 4. Mengembalikan laporan { imported: number, errors: { index, message }[] }.
 * 5. Hanya ADMINISTRATOR dan OPERATOR_SEKOLAH yang boleh menggunakan endpoint ini.
 *
 * Alur Lengkap:
 * - Controller POST /students/bulk → checkRole (ADMIN / OPERATOR) →
 *   bulkImportService.import(students) →
 *   Validasi per-entry → Cek duplikat dengan DB → Kumpulkan error →
 *   Prisma $transaction createMany → Return hasil import
 *
 * Dependencies:
 * - ../../lib/prisma: Prisma client untuk query dan transaksi database
 * - ../../lib/logger: Pino logger untuk logging terstruktur
 */

import { prisma } from "../../lib/prisma";
import logger from "../../lib/logger";

/**
 * Antarmuka input untuk satu siswa dalam bulk import.
 */
export interface BulkStudentInput {
  name: string;
  nis: string;
  nisn: string;
  gender: string;
  classId: string;
}

/**
 * Antarmuka hasil bulk import.
 */
export interface BulkImportResult {
  /** Jumlah siswa yang berhasil di-import */
  imported: number;
  /** Daftar error per-entry (index = posisi dalam array input) */
  errors: BulkImportError[];
}

/**
 * Antarmuka satu error dalam bulk import.
 */
export interface BulkImportError {
  /** Index dalam array input (0-based) */
  index: number;
  /** Pesan error human-readable */
  message: string;
}

/**
 * importStudents — Memvalidasi dan mengimpor siswa secara massal dalam transaksi.
 *
 * Alur:
 * 1. Validasi setiap entry: field wajib, format NIS/NISN minimal, gender valid.
 * 2. Deteksi duplikat NIS/NISN dalam batch yang sama.
 * 3. Cek duplikat NIS/NISN dengan database yang sudah ada.
 * 4. Validasi setiap classId merujuk ke kelas yang valid.
 * 5. Kumpulkan semua error; jika ada error serius (classId tidak valid), skip entry.
 * 6. Buat semua siswa valid dalam satu transaksi ($transaction).
 * 7. Log hasil import (jumlah sukses + error) untuk audit.
 *
 * @param students - Array data siswa yang akan di-import.
 * @returns        - Promise<BulkImportResult> { imported, errors }
 */
export async function importStudents(students: BulkStudentInput[]): Promise<BulkImportResult> {
  const total = students.length;
  logger.info({ total }, "bulk-import.service.importStudents — starting bulk import");

  // Jika array kosong, kembalikan hasil kosong
  if (total === 0) {
    logger.warn("bulk-import.service.importStudents — empty array received");
    return { imported: 0, errors: [] };
  }

  const errors: BulkImportError[] = [];
  const validStudents: BulkStudentInput[] = [];

  // ── Tahap 1: Validasi per-entry ──────────────────────────────────────────
  logger.debug({ total }, "bulk-import.service.importStudents — phase 1: validating entries");

  for (let i = 0; i < total; i++) {
    const s = students[i];
    const fieldErrors: string[] = [];

    // Validasi field wajib
    if (!s.name || typeof s.name !== "string" || s.name.trim().length === 0) {
      fieldErrors.push("Field 'name' wajib diisi");
    }
    if (!s.nis || typeof s.nis !== "string" || s.nis.trim().length === 0) {
      fieldErrors.push("Field 'nis' wajib diisi");
    }
    if (!s.nisn || typeof s.nisn !== "string" || s.nisn.trim().length === 0) {
      fieldErrors.push("Field 'nisn' wajib diisi");
    }
    if (!s.gender || !["L", "P", "Laki-laki", "Perempuan"].includes(s.gender)) {
      fieldErrors.push("Field 'gender' harus 'L', 'P', 'Laki-laki', atau 'Perempuan'");
    }
    if (!s.classId || typeof s.classId !== "string" || s.classId.trim().length === 0) {
      fieldErrors.push("Field 'classId' wajib diisi");
    }

    if (fieldErrors.length > 0) {
      errors.push({ index: i, message: fieldErrors.join("; ") });
      logger.warn({ index: i, nis: s.nis, errors: fieldErrors }, "bulk-import — validation error");
    } else {
      validStudents.push(s);
    }
  }

  // Jika tidak ada satupun entry yang valid, hentikan
  if (validStudents.length === 0) {
    logger.warn("bulk-import.service.importStudents — no valid entries after validation");
    return { imported: 0, errors };
  }

  // ── Tahap 2: Deteksi duplikat NIS/NISN dalam batch ──────────────────────
  logger.debug("bulk-import.service.importStudents — phase 2: checking batch duplicates");

  const nisSet = new Map<string, number>();  // nis → index
  const nisnSet = new Map<string, number>(); // nisn → index
  const deduplicated: BulkStudentInput[] = [];

  for (let i = 0; i < validStudents.length; i++) {
    const s = validStudents[i];

    // Cek duplikat NIS dalam batch
    if (nisSet.has(s.nis)) {
      const originalIndex = nisSet.get(s.nis)!;
      errors.push({
        index: i,
        message: `NIS '${s.nis}' duplikat dengan entry index ${originalIndex}`,
      });
      logger.warn({ index: i, nis: s.nis, duplicateOf: originalIndex }, "bulk-import — duplicate NIS in batch");
      continue;
    }

    // Cek duplikat NISN dalam batch
    if (nisnSet.has(s.nisn)) {
      const originalIndex = nisnSet.get(s.nisn)!;
      errors.push({
        index: i,
        message: `NISN '${s.nisn}' duplikat dengan entry index ${originalIndex}`,
      });
      logger.warn({ index: i, nisn: s.nisn, duplicateOf: originalIndex }, "bulk-import — duplicate NISN in batch");
      continue;
    }

    nisSet.set(s.nis, i);
    nisnSet.set(s.nisn, i);
    deduplicated.push(s);
  }

  if (deduplicated.length === 0) {
    logger.warn("bulk-import.service.importStudents — no entries after batch dedup");
    return { imported: 0, errors };
  }

  // ── Tahap 3: Cek duplikat dengan database ───────────────────────────────
  logger.debug("bulk-import.service.importStudents — phase 3: checking DB duplicates");

  // Kumpulkan semua NIS dan NISN dari entry yang valid
  const allNis = deduplicated.map((s) => s.nis);
  const allNisn = deduplicated.map((s) => s.nisn);

  // Query existing students yang punya NIS atau NISN yang sama
  const existingStudents = await prisma.student.findMany({
    where: {
      OR: [
        { nis: { in: allNis } },
        { nisn: { in: allNisn } },
      ],
    },
    select: { nis: true, nisn: true },
  });

  // Map NIS → true dan NISN → true untuk lookup cepat
  const existingNis = new Set(existingStudents.map((e) => e.nis));
  const existingNisn = new Set(existingStudents.map((e) => e.nisn));

  const afterDbCheck: BulkStudentInput[] = [];
  for (const s of deduplicated) {
    if (existingNis.has(s.nis)) {
      errors.push({ index: students.indexOf(s), message: `NIS '${s.nis}' sudah terdaftar di database` });
      logger.warn({ nis: s.nis }, "bulk-import — NIS already exists in DB");
      continue;
    }
    if (existingNisn.has(s.nisn)) {
      errors.push({ index: students.indexOf(s), message: `NISN '${s.nisn}' sudah terdaftar di database` });
      logger.warn({ nisn: s.nisn }, "bulk-import — NISN already exists in DB");
      continue;
    }
    afterDbCheck.push(s);
  }

  if (afterDbCheck.length === 0) {
    logger.warn("bulk-import.service.importStudents — no entries after DB dedup check");
    return { imported: 0, errors };
  }

  // ── Tahap 4: Validasi classId ────────────────────────────────────────────
  logger.debug("bulk-import.service.importStudents — phase 4: validating class IDs");

  const uniqueClassIds = [...new Set(afterDbCheck.map((s) => s.classId))];
  const validClasses = await prisma.class.findMany({
    where: { id: { in: uniqueClassIds } },
    select: { id: true },
  });
  const validClassIdSet = new Set(validClasses.map((c) => c.id));

  const finalStudents: BulkStudentInput[] = [];
  for (const s of afterDbCheck) {
    if (!validClassIdSet.has(s.classId)) {
      errors.push({ index: students.indexOf(s), message: `classId '${s.classId}' tidak ditemukan` });
      logger.warn({ classId: s.classId, nis: s.nis }, "bulk-import — class not found");
      continue;
    }
    finalStudents.push(s);
  }

  if (finalStudents.length === 0) {
    logger.warn("bulk-import.service.importStudents — no entries after class validation");
    return { imported: 0, errors };
  }

  // ── Tahap 5: Insert ke database dalam transaksi ──────────────────────────
  logger.info({ count: finalStudents.length }, "bulk-import.service.importStudents — phase 5: inserting in transaction");

  const importCount = await prisma.$transaction(async (tx) => {
    // Gunakan createMany untuk insert batch yang efisien
    const result = await tx.student.createMany({
      data: finalStudents.map((s) => ({
        name: s.name.trim(),
        nis: s.nis.trim(),
        nisn: s.nisn.trim(),
        gender: s.gender === "Laki-laki" ? "L" : s.gender === "Perempuan" ? "P" : s.gender,
        classId: s.classId,
      })),
    });

    return result.count;
  });

  logger.info(
    { imported: importCount, errors: errors.length, total },
    "bulk-import.service.importStudents — completed"
  );

  return {
    imported: importCount,
    errors,
  };
}

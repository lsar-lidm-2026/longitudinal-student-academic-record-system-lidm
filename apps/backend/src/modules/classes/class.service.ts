/**
 * Class Service — Business logic untuk manajemen kelas
 * ======================================================
 *
 * Cara Kerja:
 * 1. Fungsi-fungsi di sini dipanggil oleh class.controller.ts.
 * 2. Semua operasi database dilakukan melalui Prisma Client pada model Class, Student, ClassAuditLog.
 * 3. Fungsi getById() digunakan sebagai guard oleh fungsi assignTeacher() dan updateClass().
 * 4. assignTeacher() menggunakan Prisma $transaction untuk atomic update class + buat audit log.
 *
 * Alur Lengkap:
 * - list() → findAll class dengan include academicYear, homeroomTeacher, _count students → order by year desc, name asc
 * - getById(id) → findUnique class by id dengan include lengkap → throw NotFoundError jika tidak ditemukan
 * - create(data) → class.create({ name, academicYearId }) → return class baru
 * - getStudents(classId) → student.findMany where classId → order by name asc
 * - assignTeacher(classId, teacherId, changedBy) → getById class → transaction: class.update(homeroomTeacherId) + classAuditLog.create → return updated
 * - updateClass(id, data) → getById(id) → class.update → return class dengan include
 */

import logger from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../common/error";

// ── List All Classes ─────────────────────────────────────────────────────────

/**
 * list — Mengambil daftar semua kelas dengan relasi academicYear, homeroomTeacher, dan jumlah siswa.
 * Diurutkan berdasarkan tahun ajaran (desc) lalu nama kelas (asc).
 *
 * @returns - Promise<Class[]> dengan include academicYear.year, homeroomTeacher, _count.students
 */
export async function list() {
  logger.debug("class.service.list — start");

  // Ambil semua kelas dengan relasi tahun ajaran, wali kelas, dan hitungan siswa
  const classes = await prisma.class.findMany({
    include: {
      academicYear: { select: { year: true } },
      homeroomTeacher: { select: { id: true, name: true } },
      _count: { select: { students: true } },
    },
    // Urut: tahun ajaran terbaru dulu, lalu nama kelas A-Z
    orderBy: [{ academicYear: { year: "desc" } }, { name: "asc" }],
  });

  logger.debug({ count: classes.length }, "class.service.list — success");
  return classes;
}

// ── Get By ID ────────────────────────────────────────────────────────────────

/**
 * getById — Mengambil satu kelas berdasarkan ID dengan relasi lengkap.
 *
 * @param id - UUID class
 * @returns  - Promise<Class> dengan include academicYear, homeroomTeacher, _count.students
 * @throws   - NotFoundError jika kelas tidak ditemukan
 */
export async function getById(id: string) {
  logger.debug({ classId: id }, "class.service.getById — start");

  const item = await prisma.class.findUnique({
    where: { id },
    include: {
      academicYear: true,
      homeroomTeacher: { select: { id: true, name: true } },
      _count: { select: { students: true } },
    },
  });

  if (!item) {
    logger.warn({ classId: id }, "class.service.getById — not found");
    throw new NotFoundError("Class not found");
  }

  logger.debug({ classId: id }, "class.service.getById — success");
  return item;
}

// ── Create Class ─────────────────────────────────────────────────────────────

/**
 * create — Membuat kelas baru.
 *
 * @param data - { name: string, academicYearId: string }
 * @returns    - Promise<Class>
 */
export async function create(data: {
  name: string;
  academicYearId: string;
}) {
  logger.info({ name: data.name, academicYearId: data.academicYearId }, "class.service.create — start");

  // Buat kelas baru di database
  const newClass = await prisma.class.create({ data });

  logger.info({ classId: newClass.id, name: newClass.name }, "class.service.create — success");
  return newClass;
}

// ── Get Students by Class ────────────────────────────────────────────────────

/**
 * getStudents — Mengambil daftar siswa dalam satu kelas, diurutkan berdasarkan nama.
 *
 * @param classId - UUID class
 * @returns       - Promise<Student[]> siswa dalam kelas tersebut
 */
export async function getStudents(classId: string) {
  logger.debug({ classId }, "class.service.getStudents — start");

  // Ambil semua siswa dengan classId tertentu, urut A-Z berdasarkan nama
  const students = await prisma.student.findMany({
    where: { classId },
    orderBy: { name: "asc" },
  });

  logger.debug({ classId, count: students.length }, "class.service.getStudents — success");
  return students;
}

// ── Assign Homeroom Teacher ──────────────────────────────────────────────────

/**
 * assignTeacher — Menetapkan atau mengganti wali kelas.
 * Operasi ini dilakukan dalam satu transaksi Prisma untuk atomicity:
 * 1. Update field homeroomTeacherId di tabel Class.
 * 2. Buat catatan audit di ClassAuditLog (previousTeacherId, newTeacherId, changedById).
 *
 * @param classId   - UUID kelas
 * @param teacherId - UUID guru yang ditetapkan sebagai wali kelas
 * @param changedBy - UUID user yang melakukan perubahan (dari JWT)
 * @returns         - Promise<Class> (data kelas setelah update)
 * @throws          - NotFoundError jika kelas tidak ditemukan
 */
export async function assignTeacher(classId: string, teacherId: string, changedBy: string) {
  logger.info({ classId, teacherId, changedBy }, "class.service.assignTeacher — start");

  // Ambil data kelas untuk validasi dan mendapatkan wali kelas sebelumnya
  const cls = await getById(classId);
  // Simpan teacherId sebelumnya (null jika belum pernah punya wali kelas)
  const previousTeacherId = cls.homeroomTeacher?.id || null;

  logger.info({ classId, previousTeacherId, newTeacherId: teacherId }, "class.service.assignTeacher — running transaction");

  // Jalankan dalam transaksi: update class + buat audit log
  return prisma.$transaction(async (tx) => {
    // Step 1: Update homeroomTeacherId di tabel Class
    const updated = await tx.class.update({
      where: { id: classId },
      data: { homeroomTeacherId: teacherId },
    });

    // Step 2: Buat audit log untuk mencatat perubahan wali kelas
    await tx.classAuditLog.create({
      data: {
        classId,
        previousTeacherId,
        newTeacherId: teacherId,
        changedById: changedBy,
      },
    });

    logger.info({ classId, teacherId }, "class.service.assignTeacher — success");
    return updated;
  });
}

// ── Update Class ─────────────────────────────────────────────────────────────

/**
 * updateClass — Memperbarui data kelas (name, academicYearId).
 *
 * @param id   - UUID kelas yang akan diupdate
 * @param data - { name?: string, academicYearId?: string }
 * @returns    - Promise<Class> dengan include academicYear, homeroomTeacher, _count.students
 * @throws     - NotFoundError jika kelas tidak ditemukan
 */
export async function updateClass(id: string, data: { name?: string; academicYearId?: string }) {
  logger.info({ classId: id, updates: data }, "class.service.updateClass — start");

  // Pastikan kelas ada sebelum diupdate
  const cls = await getById(id);

  logger.info({ classId: id }, "class.service.updateClass — updating");

  // Update data kelas dan return dengan relasi
  return prisma.class.update({
    where: { id },
    data,
    include: {
      academicYear: { select: { year: true } },
      homeroomTeacher: { select: { id: true, name: true } },
      _count: { select: { students: true } },
    },
  });
}

/**
 * Teacher Note Service — Logika Bisnis Catatan Guru
 * ===================================================
 *
 * Cara Kerja:
 * 1. listByStudent: Mengambil semua catatan untuk seorang siswa, diurutkan
 *    berdasarkan createdAt descending. Include nama pembuat (createdBy.name).
 * 2. create: Membuat catatan baru setelah memvalidasi keberadaan siswa.
 * 3. update: Memperbarui konten catatan jika user adalah pembuatnya.
 * 4. remove: Menghapus catatan jika user adalah pembuatnya.
 *
 * Alur:
 * 1. Service menerima parameter (studentId, data, userId).
 * 2. Untuk create: Verifikasi keberadaan Student → throw NotFoundError jika tidak ada.
 * 3. Untuk update/remove: Verifikasi ownership → throw ForbiddenError jika bukan pemilik.
 * 4. Mengembalikan data TeacherNote yang sudah di-create/update/remove.
 */

import { prisma } from "../../lib/prisma";
import { NotFoundError, ForbiddenError } from "../../common/error";
import logger from "../../lib/logger";

/**
 * listByStudent — Mengambil semua catatan guru untuk seorang siswa.
 *
 * @param studentId - ID siswa yang catatannya ingin diambil.
 * @returns Array TeacherNote dengan include createdBy.name, diurutkan createdAt DESC.
 */
export async function listByStudent(studentId: string) {
  logger.info({ studentId }, "Teacher note list: fetching notes for student");

  // Ambil semua notes untuk student ini, urut dari yang terbaru
  // Include nama pembuat (createdBy) untuk ditampilkan di UI
  const notes = await prisma.teacherNote.findMany({
    where: { studentId },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: {
        select: { id: true, name: true }, // Hanya ambil field yang diperlukan
      },
    },
  });

  logger.debug({ studentId, count: notes.length }, "Teacher notes fetched successfully");
  return notes;
}

/**
 * create — Membuat catatan guru baru untuk seorang siswa.
 *
 * @param data - Objek berisi studentId, createdById (user ID pembuat), dan content.
 * @returns Prisma TeacherNote record yang baru dibuat.
 * @throws NotFoundError jika Student dengan ID tersebut tidak ditemukan.
 */
export async function create(data: {
  studentId: string;
  createdById: string;
  content: string;
}) {
  logger.info({ studentId: data.studentId, createdById: data.createdById }, "Teacher note create: checking student existence");

  // Verifikasi keberadaan Student — prasyarat untuk membuat TeacherNote
  const student = await prisma.student.findUnique({
    where: { id: data.studentId },
    select: { id: true },
  });
  if (!student) {
    logger.error({ studentId: data.studentId }, "Teacher note create failed: Student not found");
    throw new NotFoundError("Student not found");
  }

  logger.debug({ studentId: data.studentId }, "Student found, creating teacher note");

  // Buat TeacherNote baru dengan data yang diberikan
  const note = await prisma.teacherNote.create({
    data: {
      studentId: data.studentId,
      createdById: data.createdById,
      content: data.content,
    },
    include: {
      createdBy: {
        select: { id: true, name: true },
      },
    },
  });

  logger.info({ noteId: note.id, studentId: data.studentId }, "Teacher note created successfully");
  return note;
}

/**
 * update — Memperbarui konten catatan guru.
 * Hanya pemilik catatan (createdById == userId) yang bisa mengupdate.
 *
 * @param id - ID TeacherNote yang akan diupdate.
 * @param content - Konten baru untuk catatan.
 * @param userId - ID user yang melakukan request (untuk validasi ownership).
 * @returns Prisma TeacherNote record yang sudah diupdate.
 * @throws NotFoundError jika TeacherNote tidak ditemukan.
 * @throws ForbiddenError jika user bukan pembuat catatan.
 */
export async function update(id: string, content: string, userId: string) {
  logger.info({ noteId: id, userId }, "Teacher note update: checking note existence");

  // Cari catatan yang akan diupdate
  const existing = await prisma.teacherNote.findUnique({
    where: { id },
    select: { id: true, createdById: true },
  });
  if (!existing) {
    logger.error({ noteId: id }, "Teacher note update failed: Note not found");
    throw new NotFoundError("Teacher note not found");
  }

  // Validasi ownership: hanya pembuat catatan yang bisa mengupdate
  if (existing.createdById !== userId) {
    logger.warn(
      { noteId: id, userId, ownerId: existing.createdById },
      "Teacher note update failed: Forbidden — user is not the owner"
    );
    throw new ForbiddenError("You can only edit your own notes");
  }

  logger.debug({ noteId: id }, "Ownership verified, updating teacher note content");

  // Update konten catatan
  const updated = await prisma.teacherNote.update({
    where: { id },
    data: { content },
    include: {
      createdBy: {
        select: { id: true, name: true },
      },
    },
  });

  logger.info({ noteId: id }, "Teacher note updated successfully");
  return updated;
}

/**
 * remove — Menghapus catatan guru.
 * Hanya pemilik catatan (createdById == userId) yang bisa menghapus.
 *
 * @param id - ID TeacherNote yang akan dihapus.
 * @param userId - ID user yang melakukan request (untuk validasi ownership).
 * @returns Prisma TeacherNote record yang dihapus.
 * @throws NotFoundError jika TeacherNote tidak ditemukan.
 * @throws ForbiddenError jika user bukan pembuat catatan.
 */
export async function remove(id: string, userId: string) {
  logger.info({ noteId: id, userId }, "Teacher note remove: checking note existence");

  // Cari catatan yang akan dihapus
  const existing = await prisma.teacherNote.findUnique({
    where: { id },
    select: { id: true, createdById: true },
  });
  if (!existing) {
    logger.error({ noteId: id }, "Teacher note remove failed: Note not found");
    throw new NotFoundError("Teacher note not found");
  }

  // Validasi ownership: hanya pembuat catatan yang bisa menghapus
  if (existing.createdById !== userId) {
    logger.warn(
      { noteId: id, userId, ownerId: existing.createdById },
      "Teacher note remove failed: Forbidden — user is not the owner"
    );
    throw new ForbiddenError("You can only delete your own notes");
  }

  logger.debug({ noteId: id }, "Ownership verified, deleting teacher note");

  // Hapus catatan dari database
  const deleted = await prisma.teacherNote.delete({
    where: { id },
    include: {
      createdBy: {
        select: { id: true, name: true },
      },
    },
  });

  logger.info({ noteId: id }, "Teacher note deleted successfully");
  return deleted;
}

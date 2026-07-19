/**
 * Homeroom Access Middleware (requireHomeroomAccess)
 * ==================================================
 *
 * Cara Kerja:
 * 1. Extends requireAuth — jadi auth sudah terverifikasi sebelum masuk sini.
 * 2. Mengecek apakah user memiliki akses ke resource siswa tertentu:
 *    - ADMINISTRATOR / KEPALA_SEKOLAH → akses global (semua siswa).
 *    - OPERATOR_SEKOLAH → akses global (management data).
 *    - GURU → divalidasi apakah dia wali kelas dari siswa yang dimaksud.
 * 3. Validasi guru: cari Student → ambil classId → cek homeroomTeacherId == user.userId.
 * 4. Menggunakan params.id sebagai studentId.
 *
 * Alur:
 * - Route dengan params.id (studentId): .use(requireHomeroomAccess)
 * - Jika lolos: handler jalan normal.
 * - Jika tidak: HTTP 403 (bukan wali kelas) atau HTTP 404 (siswa tidak ditemukan).
 */

import { Elysia } from "elysia";
import { ForbiddenError, NotFoundError } from "../common/error";
import { prisma } from "../lib/prisma";
import { requireAuth } from "./auth";
import logger from "../lib/logger";

/**
 * requireHomeroomAccess — Elysia plugin untuk validasi akses wali kelas.
 * Memastikan guru hanya bisa mengakses data siswa yang menjadi walinya.
 */
export const requireHomeroomAccess = new Elysia({ name: "requireHomeroomAccess" })
  .use(requireAuth)
  .derive({ as: "scoped" }, async ({ request, user, params }) => {
    // Pastikan user ada (requireAuth sudah jalan)
    if (!user) throw new ForbiddenError();

    logger.debug({ userId: user.userId, role: user.role }, "Homeroom access check started");

    // Admin dan Kepsek punya akses global
    if (user.role === "ADMINISTRATOR" || user.role === "KEPALA_SEKOLAH") {
      logger.debug({ role: user.role }, "Global access granted (admin/principal)");
      return {};
    }

    // Operator hanya akses untuk management data (tidak perlu homeroom check)
    if (user.role === "OPERATOR_SEKOLAH") {
      logger.debug({ role: user.role }, "Global access granted (operator)");
      return {};
    }

    // Guru harus divalidasi: apakah dia wali kelas dari siswa ini?
    const studentId = (params as { id?: string }).id;
    if (!studentId) {
      logger.warn("Student ID is missing from params for homeroom check");
      throw new ForbiddenError("Student ID required");
    }

    logger.debug({ studentId }, "Checking homeroom teacher for student");

    // Cari siswa beserta data kelas dan wali kelasnya
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        classId: true,
        class: { select: { homeroomTeacherId: true } },
      },
    });

    // Siswa tidak ditemukan di database
    if (!student) {
      logger.warn({ studentId }, "Student not found during homeroom check");
      throw new NotFoundError("Student not found");
    }

    // Bandingkan homeroomTeacherId dengan userId guru yang login
    if (student.class.homeroomTeacherId !== user.userId) {
      logger.warn(
        { studentId, homeroomTeacherId: student.class.homeroomTeacherId, userId: user.userId },
        "Homeroom access denied — teacher is not the homeroom teacher"
      );
      throw new ForbiddenError("You are not the homeroom teacher of this student");
    }

    logger.info(
      { studentId, userId: user.userId },
      "Homeroom access granted — teacher is the homeroom teacher"
    );
    return {};
  });

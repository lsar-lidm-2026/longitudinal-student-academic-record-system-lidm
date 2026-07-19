/**
 * Record Owner Middleware (requireRecordOwner)
 * ============================================
 *
 * Cara Kerja:
 * 1. Extends requireAuth — auth sudah terverifikasi.
 * 2. Digunakan untuk route dimana params.id adalah SemesterRecord ID (bukan studentId).
 * 3. Resolve studentId dari SemesterRecord, lalu validasi homeroom access:
 *    - ADMINISTRATOR / KEPALA_SEKOLAH / OPERATOR_SEKOLAH → akses global.
 *    - GURU → cari SemesterRecord → dapatkan student → cek homeroomTeacherId.
 *
 * Perbedaan dengan requireHomeroomAccess:
 * - requireHomeroomAccess: params.id = studentId.
 * - requireRecordOwner: params.id = semesterRecordId.
 *
 * Alur:
 * - Route dengan params.id (semesterRecordId): .use(requireRecordOwner)
 * - Jika lolos: handler jalan normal.
 * - Jika tidak: HTTP 403 (bukan wali kelas) atau HTTP 404 (record tidak ditemukan).
 */

import { Elysia } from "elysia";
import { ForbiddenError, NotFoundError } from "../common/error";
import { prisma } from "../lib/prisma";
import { requireAuth } from "./auth";
import logger from "../lib/logger";

/**
 * requireRecordOwner — Elysia plugin untuk validasi kepemilikan semester record.
 * Memastikan guru hanya bisa mengakses semester record milik siswa yang menjadi walinya.
 */
export const requireRecordOwner = new Elysia({ name: "requireRecordOwner" })
  .use(requireAuth)
  .derive({ as: "scoped" }, async ({ params, user }) => {
    // Pastikan user ada (requireAuth sudah jalan)
    if (!user) throw new ForbiddenError();

    logger.debug({ userId: user.userId, role: user.role }, "Record owner check started");

    // Admin, Kepsek, dan Operator punya akses global
    if (["ADMINISTRATOR", "KEPALA_SEKOLAH", "OPERATOR_SEKOLAH"].includes(user.role)) {
      logger.debug({ role: user.role }, "Global record access granted (admin/principal/operator)");
      return {};
    }

    // GURU — validasi apakah dia wali kelas dari siswa pemilik record ini
    const semesterRecordId = (params as { id?: string }).id;
    if (!semesterRecordId) {
      logger.warn("Semester record ID is missing from params");
      throw new ForbiddenError("Semester record ID required");
    }

    logger.debug({ semesterRecordId }, "Looking up semester record for owner validation");

    // Cari semester record beserta relasi student → class → homeroomTeacher
    const record = await prisma.semesterRecord.findUnique({
      where: { id: semesterRecordId },
      select: {
        student: {
          select: {
            classId: true,
            class: { select: { homeroomTeacherId: true } },
          },
        },
      },
    });

    // Record tidak ditemukan
    if (!record) {
      logger.warn({ semesterRecordId }, "Semester record not found during owner check");
      throw new NotFoundError("Semester record not found");
    }

    // Bandingkan homeroomTeacherId dengan userId guru yang login
    if (record.student.class.homeroomTeacherId !== user.userId) {
      logger.warn(
        {
          semesterRecordId,
          homeroomTeacherId: record.student.class.homeroomTeacherId,
          userId: user.userId,
        },
        "Record owner check denied — teacher is not the homeroom teacher"
      );
      throw new ForbiddenError("You are not the homeroom teacher of this student");
    }

    logger.info(
      { semesterRecordId, userId: user.userId },
      "Record owner check granted — teacher is the homeroom teacher"
    );
    return {};
  });

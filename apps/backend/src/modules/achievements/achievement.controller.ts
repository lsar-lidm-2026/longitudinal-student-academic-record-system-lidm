/**
 * Achievement Controller — Kelola Prestasi Siswa
 * ==============================================
 *
 * Cara Kerja:
 * 1. Menyediakan endpoint REST untuk CRUD prestasi siswa:
 *    - POST /semester-records/:id/achievements → create prestasi
 *    - PUT /achievements/:id → update prestasi
 *    - DELETE /achievements/:id → hapus prestasi
 * 2. Create menggunakan middleware requireAuth + requireRecordOwner.
 * 3. Update/Delete menggunakan requireAuth saja + pengecekan homeroom teacher manual
 *    via verifyAchievementAccess (Admin bypass).
 * 4. Mendelegasikan logika ke achievement.service.ts.
 *
 * Alur:
 * 1. Client mengirim request ke endpoint.
 * 2. Middleware autentikasi memverifikasi JWT.
 * 3. Untuk create, requireRecordOwner memverifikasi akses ke semester record.
 * 4. Untuk update/delete, non-Admin diverifikasi via verifyAchievementAccess.
 * 5. Controller memanggil service yang sesuai (create/update/remove).
 * 6. Mengembalikan response sukses.
 */

import { Elysia, t } from "elysia";
import logger from "../../lib/logger";
import * as service from "./achievement.service";
import { success, error as errorResponse } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { requireRecordOwner } from "../../middleware/record-owner";
import { prisma } from "../../lib/prisma";

/**
 * verifyAchievementAccess — Memeriksa apakah user adalah wali kelas
 * dari siswa yang memiliki achievement tertentu.
 *
 * Alur:
 * 1. Cari Achievement dengan relasi ke SemesterRecord → Student → Class.
 * 2. Bandingkan homeroomTeacherId class dengan userId.
 * 3. Jika achievement tidak ditemukan, return false.
 *
 * @param achievementId - ID achievement yang akan diperiksa.
 * @param userId - ID user (guru) yang sedang terautentikasi.
 * @returns boolean — true jika user adalah wali kelas, false jika tidak.
 */
async function verifyAchievementAccess(achievementId: string, userId: string) {
  // Cari achievement beserta nested relasi hingga homeroomTeacherId
  const achievement = await prisma.achievement.findUnique({
    where: { id: achievementId },
    select: {
      semesterRecord: {
        select: {
          student: {
            select: {
              class: { select: { homeroomTeacherId: true } },
            },
          },
        },
      },
    },
  });

  // Jika achievement tidak ditemukan, akses ditolak
  if (!achievement) {
    logger.warn({ achievementId, userId }, "Achievement not found for access verification");
    return false;
  }

  // Bandingkan homeroomTeacherId class dengan userId user yang login
  const hasAccess = achievement.semesterRecord.student.class.homeroomTeacherId === userId;
  logger.debug({ achievementId, userId, hasAccess }, "Achievement access verification result");
  return hasAccess;
}

/**
 * achievementController — Elysia route group untuk prefix /semester-records.
 * Menangani CRUD prestasi dengan dua grup akses berbeda:
 * - Grup 1 (create): requireAuth + requireRecordOwner
 * - Grup 2 (update/delete): requireAuth + manual homeroom check
 */
export const achievementController = new Elysia({ prefix: "/semester-records" })
  // === Grup 1: Create Achievement ===
  .guard({}, (app) =>
    app
      // Middleware: autentikasi JWT
      .use(requireAuth)
      // Middleware: kepemilikan record — memastikan user pemilik semester record
      .use(requireRecordOwner)
      // POST /semester-records/:id/achievements — Buat prestasi baru
      .post(
        "/:id/achievements",
        async ({ params, body }) => {
          // params.id — ID semester record yang akan dikaitkan dengan prestasi
          // body — data prestasi { title, type, description? }
          logger.info({ semesterRecordId: params.id, body }, "Creating new achievement");
          const data = await service.create({
            ...body,
            semesterRecordId: params.id,
          });
          logger.info({ achievementId: data.id }, "Achievement created successfully");
          return success(data);
        },
        {
          // Validasi body: title dan type wajib, description opsional
          body: t.Object({
            title: t.String(),                // Judul prestasi
            type: t.String(),                 // Jenis prestasi (akademik/non-akademik)
            description: t.Optional(t.String()), // Deskripsi tambahan (opsional)
          }),
        }
      )
  )
  // === Grup 2: Update & Delete Achievement ===
  .guard({}, (app) =>
    app
      // Middleware: autentikasi JWT
      .use(requireAuth)
      // PUT /achievements/:id — Perbarui prestasi
      .put(
        "/achievements/:id",
        async ({ params, body, user, set }) => {
          logger.info({ achievementId: params.id, userId: user.userId, role: user.role }, "Updating achievement");

          // Admin bypass ownership check — Admin bisa edit semua
          if (user.role !== "ADMINISTRATOR") {
            // Non-Admin: verifikasi bahwa user adalah wali kelas siswa terkait
            const hasAccess = await verifyAchievementAccess(params.id, user.userId);
            if (!hasAccess) {
              logger.warn({ achievementId: params.id, userId: user.userId }, "Forbidden: user is not homeroom teacher");
              set.status = 403;
              return errorResponse(
                "FORBIDDEN",
                "You are not the homeroom teacher of this student"
              );
            }
          }
          // Panggil service untuk update data achievement
          const data = await service.update(params.id, body);
          logger.info({ achievementId: data.id }, "Achievement updated successfully");
          return success(data);
        },
        {
          // Validasi body: semua field opsional (partial update)
          body: t.Object({
            title: t.Optional(t.String()),       // Judul prestasi (opsional)
            type: t.Optional(t.String()),        // Jenis prestasi (opsional)
            description: t.Optional(t.String()), // Deskripsi (opsional)
          }),
        }
      )
      // DELETE /achievements/:id — Hapus prestasi
      .delete("/achievements/:id", async ({ params, user, set }) => {
        logger.info({ achievementId: params.id, userId: user.userId, role: user.role }, "Deleting achievement");

        // Admin bypass ownership check — Admin bisa hapus semua
        if (user.role !== "ADMINISTRATOR") {
          // Non-Admin: verifikasi bahwa user adalah wali kelas siswa terkait
          const hasAccess = await verifyAchievementAccess(params.id, user.userId);
          if (!hasAccess) {
            logger.warn({ achievementId: params.id, userId: user.userId }, "Forbidden: user is not homeroom teacher");
            set.status = 403;
            return errorResponse(
              "FORBIDDEN",
              "You are not the homeroom teacher of this student"
            );
          }
        }
        // Panggil service untuk hapus achievement
        await service.remove(params.id);
        logger.info({ achievementId: params.id }, "Achievement deleted successfully");
        return success({ deleted: true });
      })
  );

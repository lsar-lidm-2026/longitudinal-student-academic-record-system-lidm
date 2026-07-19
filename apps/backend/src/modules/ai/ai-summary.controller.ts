/**
 * AI Summary Controller
 * ======================
 * Cara Kerja:
 *   1. Mendefinisikan route group tanpa prefix (path langsung) untuk CRUD AiSummary.
 *   2. Semua endpoint butuh `requireAuth` (JWT).
 *   3. Helper `verifyAiSummaryAccess` mengecek apakah user (GURU) adalah wali kelas
 *      dari siswa yang memiliki AiSummary tersebut — via join AiSummary → SemesterRecord → Student → Class → homeroomTeacherId.
 *   4. Role-based access: ADMINISTRATOR + GURU bisa edit/regenerate/delete,
 *      OPERATOR_SEKOLAH + KEPALA_SEKOLAH hanya bisa GET.
 *   5. GURU hanya boleh mengakses summary siswa yang merupakan wali kelasnya.
 *
 * Alur Lengkap:
 *   Request → Elysia Router → requireAuth → checkRole (role-based gate)
 *     → [jika GURU] verifyAiSummaryAccess (homeroom check) → 403 jika bukan walinya
 *     → aiSummaryService.{method} → response `{ success, data }`
 *
 * Endpoints:
 *   GET    /semester-records/:id/ai-summaries  — List all AiSummary for a semester record
 *   PUT    /ai-summaries/:id                     — Update isFinal / content
 *   POST   /ai-summaries/:id/regenerate          — Regenerate via LLM (version increment)
 *   DELETE /ai-summaries/:id                     — Delete an AiSummary
 */

import { Elysia, t } from "elysia";
import * as aiSummaryService from "./ai-summary.service";
import { success, error as errorResponse } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { checkRole } from "../../middleware/role";
import { prisma } from "../../lib/prisma";
import logger from "../../lib/logger";

/**
 * Verify that the authenticated user has homeroom access
 * to the student associated with this AI summary.
 *
 * Alur:
 *   1. Cari AiSummary by id → include semesterRecord → student → class
 *   2. Bandingkan homeroomTeacherId dengan userId
 *
 * @param summaryId — UUID AiSummary
 * @param userId — UUID dari JWT user
 * @returns boolean — true jika user adalah wali kelas siswa tersebut
 */
async function verifyAiSummaryAccess(summaryId: string, userId: string): Promise<boolean> {
  logger.debug({ summaryId, userId }, "verifyAiSummaryAccess — checking homeroom access");

  // Fetch summary dengan nested relasi sampai ke class.homeroomTeacherId
  const summary = await prisma.aiSummary.findUnique({
    where: { id: summaryId },
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

  // Jika summary tidak ditemukan, return false (access denied)
  if (!summary) {
    logger.warn({ summaryId, userId }, "verifyAiSummaryAccess — summary not found");
    return false;
  }

  // Bandingkan homeroomTeacherId dengan userId
  const isHomeroom = summary.semesterRecord.student.class.homeroomTeacherId === userId;
  logger.debug({ summaryId, userId, isHomeroom }, "verifyAiSummaryAccess — access check result");
  return isHomeroom;
}

export const aiSummaryController = new Elysia()
  .guard({}, (app) =>
    app
      .use(requireAuth)

      /**
       * GET /semester-records/:id/ai-summaries
       * Ambil semua AiSummary milik suatu SemesterRecord.
       * Role yang diizinkan: ADMINISTRATOR, OPERATOR_SEKOLAH, GURU, KEPALA_SEKOLAH
       * @param params.id — SemesterRecord ID
       */
      .get("/semester-records/:id/ai-summaries", async ({ params, user }) => {
        logger.info({ userId: user.userId, semesterRecordId: params.id }, "GET /semester-records/:id/ai-summaries — handler invoked");
        checkRole(user, "ADMINISTRATOR", "OPERATOR_SEKOLAH", "GURU", "KEPALA_SEKOLAH");
        const data = await aiSummaryService.getBySemesterRecord(params.id);
        logger.debug({ semesterRecordId: params.id, count: data.length }, "GET ai-summaries — fetched");
        return success(data);
      })

      /**
       * PUT /ai-summaries/:id
       * Update isFinal (human-in-the-loop approval) dan/atau konten.
       * Role: ADMINISTRATOR, GURU (GURU harus wali kelas siswa tersebut).
       * @param params.id — AiSummary ID
       * @param body.isFinal — Boolean (opsional) untuk finalisasi
       * @param body.content — String (opsional) untuk edit konten
       */
      .put(
        "/ai-summaries/:id",
        async ({ params, body, user, set }) => {
          logger.info({ userId: user.userId, summaryId: params.id, body }, "PUT /ai-summaries/:id — handler invoked");
          checkRole(user, "ADMINISTRATOR", "GURU");

          // GURU must be the homeroom teacher of the student
          if (user.role === "GURU") {
            const hasAccess = await verifyAiSummaryAccess(params.id, user.userId);
            if (!hasAccess) {
              logger.warn({ userId: user.userId, summaryId: params.id }, "PUT ai-summaries — access denied: not homeroom teacher");
              set.status = 403;
              return errorResponse("FORBIDDEN", "You are not the homeroom teacher of this student");
            }
          }

          const data = await aiSummaryService.update(params.id, body);
          logger.info({ summaryId: params.id }, "PUT ai-summaries — updated successfully");
          return success(data);
        },
        {
          body: t.Object({
            isFinal: t.Optional(t.Boolean()),
            content: t.Optional(t.String()),
          }),
        }
      )

      /**
       * POST /ai-summaries/:id/regenerate
       * Regenerate konten AiSummary via LLM (version increment otomatis).
       * Role: ADMINISTRATOR, GURU (GURU harus wali kelas).
       * @param params.id — AiSummary ID
       */
      .post("/ai-summaries/:id/regenerate", async ({ params, user, set }) => {
        logger.info({ userId: user.userId, summaryId: params.id }, "POST /ai-summaries/:id/regenerate — handler invoked");
        checkRole(user, "ADMINISTRATOR", "GURU");

        if (user.role === "GURU") {
          const hasAccess = await verifyAiSummaryAccess(params.id, user.userId);
          if (!hasAccess) {
            logger.warn({ userId: user.userId, summaryId: params.id }, "POST ai-summaries regenerate — access denied: not homeroom teacher");
            set.status = 403;
            return errorResponse("FORBIDDEN", "You are not the homeroom teacher of this student");
          }
        }

        const data = await aiSummaryService.regenerate(params.id);
        logger.info({ summaryId: params.id, newVersion: data.version }, "POST ai-summaries regenerate — regenerated successfully");
        return success(data);
      })

      /**
       * DELETE /ai-summaries/:id
       * Hapus AiSummary.
       * Role: ADMINISTRATOR, GURU (GURU harus wali kelas).
       * @param params.id — AiSummary ID
       */
      .delete("/ai-summaries/:id", async ({ params, user, set }) => {
        logger.info({ userId: user.userId, summaryId: params.id }, "DELETE /ai-summaries/:id — handler invoked");
        checkRole(user, "ADMINISTRATOR", "GURU");

        if (user.role === "GURU") {
          const hasAccess = await verifyAiSummaryAccess(params.id, user.userId);
          if (!hasAccess) {
            logger.warn({ userId: user.userId, summaryId: params.id }, "DELETE ai-summaries — access denied: not homeroom teacher");
            set.status = 403;
            return errorResponse("FORBIDDEN", "You are not the homeroom teacher of this student");
          }
        }

        await aiSummaryService.remove(params.id);
        logger.info({ summaryId: params.id }, "DELETE ai-summaries — deleted successfully");
        return success({ deleted: true });
      })
  );

/**
 * AI Controller
 * ==============
 * Cara Kerja:
 *   1. Mendefinisikan route-group `/ai` menggunakan Elysia dengan prefix `/ai`.
 *   2. Dua grup guard terpisah:
 *      - Grup 1: Butuh auth + homeroomAccess → endpoint siswa (summary, draft-description).
 *      - Grup 2: Butuh auth saja → endpoint kelas (transition-summary).
 *   3. Setiap handler memanggil service layer (aiService.*) lalu membungkus
 *      hasilnya dengan helper `success()`.
 *
 * Alur Lengkap:
 *   Request → Elysia Router → requireAuth (JWT verify) → requireHomeroomAccess (jika ada)
 *   → Handler (parse params) → aiService.{method} → response `{ success, data }`.
 *
 * Endpoints:
 *   POST /api/ai/students/:id/summary          — Generate ringkasan siswa (1 siswa)
 *   POST /api/ai/students/:id/draft-description — Generate draft deskripsi rapor
 *   POST /api/ai/classes/:id/transition-summary  — Generate ringkasan transisi (semua siswa 1 kelas)
 */

import { Elysia, t } from "elysia";
import * as aiService from "./ai.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { requireHomeroomAccess } from "../../middleware/homeroom";
import { rateLimitAi } from "../../middleware/rate-limit";
import logger from "../../lib/logger";

export const aiController = new Elysia({ prefix: "/ai" })
  /**
   * Guard group 1 — Butuh auth + akses wali kelas.
   * Endpoint untuk operasi per-siswa.
   */
  .guard({}, (app) =>
    app
      .use(requireAuth)
      .use(requireHomeroomAccess)
      .use(rateLimitAi())
      /**
       * POST /students/:id/summary
       * Generate ringkasan perkembangan siswa via AI.
       * @param params.id — Student ID
       */
      .post(
        "/students/:id/summary",
        async ({ params, rateLimitAi }) => {
          rateLimitAi("summary");
          logger.info({ studentId: params.id }, "POST /ai/students/:id/summary — handler invoked");
          const data = await aiService.generateStudentSummary(params.id);
          logger.info({ studentId: params.id }, "Student summary generated successfully");
          return success(data);
        },
        {
          params: t.Object({ id: t.String() }),
        }
      )
      /**
       * POST /students/:id/draft-description
       * Generate draft deskripsi rapor per siswa via AI.
       * @param params.id — Student ID
       */
      .post(
        "/students/:id/draft-description",
        async ({ params, rateLimitAi }) => {
          rateLimitAi("draft");
          logger.info({ studentId: params.id }, "POST /ai/students/:id/draft-description — handler invoked");
          const data = await aiService.generateDraftDescription(params.id);
          logger.info({ studentId: params.id }, "Draft description generated successfully");
          return success(data);
        },
        {
          params: t.Object({ id: t.String() }),
        }
      )
  )
  /**
   * Guard group 2 — Butuh auth saja (tanpa homeroom check).
   * Endpoint untuk operasi per-kelas (transisi).
   */
  .guard({}, (app) =>
    app
      .use(requireAuth)
      .use(rateLimitAi())
      /**
       * POST /classes/:id/transition-summary
       * Generate ringkasan transisi untuk semua siswa dalam satu kelas.
       * @param params.id — Class ID
       */
      .post(
        "/classes/:id/transition-summary",
        async ({ params, rateLimitAi }) => {
          rateLimitAi("transition");
          logger.info({ classId: params.id }, "POST /ai/classes/:id/transition-summary — handler invoked");
          const data = await aiService.generateTransitionSummary(params.id);
          logger.info({ classId: params.id, count: data.length }, "Transition summary generated for class");
          return success(data);
        },
        {
          params: t.Object({ id: t.String() }),
        }
      )
  );

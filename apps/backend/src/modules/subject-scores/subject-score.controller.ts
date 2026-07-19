/**
 * SUBJECT SCORE CONTROLLER
 * ========================
 *
 * Cara kerja file ini:
 * Controller ini mendefinisikan route Elysia untuk resource SubjectScore
 * yang nested di bawah SemesterRecord dengan prefix "/semester-records".
 * Semua endpoint menggunakan requireAuth + requireRecordOwner untuk otorisasi.
 *
 * Alur lengkap:
 *
 * 1. PUT /semester-records/:id/subject-scores
 *    - requireAuth + requireRecordOwner
 *    - service.upsert() — create atau update berdasarkan composite unique
 *      [semesterRecordId + subjectName]
 *    - Validasi body: subjectName (required), knowledgeScore, skillsScore, notes (optional)
 *
 * 2. PUT /semester-records/:id/subject-scores/batch
 *    - service.batchUpsert() — multiple upsert dalam satu transaksi
 *    - Body: array of { subjectName, knowledgeScore, skillsScore, notes? }
 *
 * 3. PUT /semester-records/:id/subject-scores/:scoreId
 *    - service.update() — update field spesifik berdasarkan scoreId
 *    - Semua field body optional untuk partial update
 *
 * 4. DELETE /semester-records/:id/subject-scores/:scoreId
 *    - service.remove() — hapus subject score berdasarkan scoreId
 *    - Return { deleted: true } jika berhasil
 *
 * Error handling: service melempar NotFoundError jika resource tidak ditemukan,
 * dan framework Elysia meng-handle response error secara otomatis.
 */

import { Elysia, t } from "elysia";
import * as service from "./subject-score.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { requireRecordOwner } from "../../middleware/record-owner";
import logger from "../../lib/logger";

export const subjectScoreController = new Elysia({ prefix: "/semester-records" })
  .guard({}, (app) =>
    app
      // Auth + record ownership verification for all endpoints
      .use(requireAuth)
      .use(requireRecordOwner)
      // PUT /semester-records/:id/subject-scores — upsert (create or update) a single subject score
      .put(
        "/:id/subject-scores",
        async ({ params, body, user }) => {
          logger.info({ userId: user.userId, recordId: params.id, body }, "Upserting subject score");
          // Upsert by composite key [semesterRecordId, subjectName]
          const data = await service.upsert(params.id, body);
          logger.info({ scoreId: data.id, subjectName: data.subjectName }, "Subject score upserted");
          return success(data);
        },
        {
          // Validation: subjectName, knowledgeScore, skillsScore required; notes optional
          body: t.Object({
            subjectName: t.String(),
            knowledgeScore: t.Number(),
            skillsScore: t.Number(),
            notes: t.Optional(t.String()),
          }),
        }
      )
      // PUT /semester-records/:id/subject-scores/batch — batch upsert multiple scores in one transaction
      .put(
        "/:id/subject-scores/batch",
        async ({ params, body, user }) => {
          logger.info({ userId: user.userId, recordId: params.id, scoreCount: body.scores.length }, "Batch upserting subject scores");
          const data = await service.batchUpsert(params.id, body.scores);
          logger.info({ recordId: params.id, count: data.length }, "Subject scores batch upserted");
          return success(data);
        },
        {
          // Array of subject score objects to upsert
          body: t.Object({
            scores: t.Array(
              t.Object({
                subjectName: t.String(),
                knowledgeScore: t.Number(),
                skillsScore: t.Number(),
                notes: t.Optional(t.String()),
              })
            ),
          }),
        }
      )
      // PUT /semester-records/:id/subject-scores/:scoreId — update existing score by ID
      .put(
        "/:id/subject-scores/:scoreId",
        async ({ params, body, user }) => {
          logger.info({ userId: user.userId, scoreId: params.scoreId, body }, "Updating subject score");
          const data = await service.update(params.scoreId, body);
          logger.info({ scoreId: params.scoreId }, "Subject score updated");
          return success(data);
        },
        {
          // All fields optional for partial update
          body: t.Object({
            subjectName: t.Optional(t.String()),
            knowledgeScore: t.Optional(t.Number()),
            skillsScore: t.Optional(t.Number()),
            notes: t.Optional(t.String()),
          }),
        }
      )
      // DELETE /semester-records/:id/subject-scores/:scoreId — remove a subject score
      .delete("/:id/subject-scores/:scoreId", async ({ params, user }) => {
        logger.info({ userId: user.userId, scoreId: params.scoreId }, "Deleting subject score");
        await service.remove(params.scoreId);
        logger.info({ scoreId: params.scoreId }, "Subject score deleted");
        return success({ deleted: true });
      })
  );

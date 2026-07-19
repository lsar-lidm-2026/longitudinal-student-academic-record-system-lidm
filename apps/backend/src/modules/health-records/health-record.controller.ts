/**
 * Health Record Controller — Kelola Catatan Kesehatan Siswa
 * ==========================================================
 *
 * Cara Kerja:
 * 1. Menyediakan endpoint PUT /semester-records/:id/health-record untuk upsert data kesehatan.
 * 2. Endpoint dilindungi oleh middleware requireAuth (JWT) dan requireRecordOwner (kepemilikan).
 * 3. Validasi body menggunakan Elysia t.Object dengan semua field opsional.
 * 4. Mendelegasikan logika upsert ke health-record.service.ts.
 *
 * Alur:
 * 1. Client mengirim request PUT ke /semester-records/:id/health-record.
 * 2. Middleware requireAuth memverifikasi JWT token.
 * 3. Middleware requireRecordOwner memverifikasi akses ke record.
 * 4. Controller memvalidasi body (height, weight, hearingCondition, visionCondition, teethCondition).
 * 5. Memanggil service.upsert(semesterRecordId, body).
 * 6. Mengembalikan response sukses dengan data health record.
 */

import { Elysia, t } from "elysia";
import logger from "../../lib/logger";
import * as service from "./health-record.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { requireRecordOwner } from "../../middleware/record-owner";

/**
 * healthRecordController — Elysia route group untuk prefix /semester-records.
 * Semua route dalam grup ini membutuhkan autentikasi dan kepemilikan record.
 */
export const healthRecordController = new Elysia({ prefix: "/semester-records" })
  .guard({}, (app) =>
    app
      // Middleware: autentikasi JWT — memverifikasi token dan mengisi user context
      .use(requireAuth)
      // Middleware: kepemilikan record — memastikan user adalah pemilik semester record
      .use(requireRecordOwner)
      // PUT /semester-records/:id/health-record — Upsert catatan kesehatan siswa
      .put(
        "/:id/health-record",
        async ({ params, body }) => {
          // params.id — ID semester record yang akan diupsert catatan kesehatannya
          // body — data kesehatan { height?, weight?, hearingCondition?, visionCondition?, teethCondition? }
          logger.info({ semesterRecordId: params.id, body }, "Upserting health record");
          const data = await service.upsert(params.id, body);
          logger.info({ semesterRecordId: params.id, healthRecordId: data.id }, "Health record upserted successfully");
          return success(data);
        },
        {
          // Validasi body: semua field opsional (partial update/create)
          body: t.Object({
            height: t.Optional(t.Number()),            // Tinggi badan (cm)
            weight: t.Optional(t.Number()),            // Berat badan (kg)
            hearingCondition: t.Optional(t.String()),   // Kondisi pendengaran
            visionCondition: t.Optional(t.String()),    // Kondisi penglihatan
            teethCondition: t.Optional(t.String()),     // Kondisi gigi
          }),
        }
      )
  );

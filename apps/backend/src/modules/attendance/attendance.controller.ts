/**
 * Attendance Controller — Kelola Presensi Siswa
 * ==============================================
 *
 * Cara Kerja:
 * 1. Menyediakan endpoint PUT /semester-records/:id/attendance untuk upsert data presensi.
 * 2. Endpoint dilindungi oleh middleware requireAuth (JWT) dan requireRecordOwner (kepemilikan).
 * 3. validasi body menggunakan Elysia t.Object untuk memastikan sick, permission, absent >= 0.
 * 4. Mendelegasikan logika upsert ke attendance.service.ts.
 *
 * Alur:
 * 1. Client mengirim request PUT ke /semester-records/:id/attendance.
 * 2. Middleware requireAuth memverifikasi JWT token.
 * 3. Middleware requireRecordOwner memverifikasi akses ke record.
 * 4. Controller memvalidasi body (sick, permission, absent).
 * 5. Memanggil service.upsert(semesterRecordId, body).
 * 6. Mengembalikan response sukses dengan data attendance.
 */

import { Elysia, t } from "elysia";
import logger from "../../lib/logger";
import * as service from "./attendance.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { requireRecordOwner } from "../../middleware/record-owner";
import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../common/error";

/**
 * attendanceController — Elysia route group untuk prefix /semester-records.
 * Semua route dalam grup ini membutuhkan autentikasi dan kepemilikan record.
 */
export const attendanceController = new Elysia({ prefix: "/semester-records" })
  .guard({}, (app) =>
    app
      // Middleware: autentikasi JWT — memverifikasi token dan mengisi user context
      .use(requireAuth)
      // Middleware: kepemilikan record — memastikan user adalah pemilik semester record
      .use(requireRecordOwner)
      // PUT /semester-records/:id/attendance — Upsert presensi siswa
      .put(
        "/:id/attendance",
        async ({ params, body }) => {
          // params.id — ID semester record yang akan diupsert presensinya
          // body — data presensi { sick, permission, absent }
          logger.info({ semesterRecordId: params.id, body }, "Upserting attendance");
          const data = await service.upsert(params.id, body);
          logger.info({ semesterRecordId: params.id }, "Attendance upserted successfully");
          return success(data);
        },
        {
          // Validasi body: semua field number dengan minimum 0
          body: t.Object({
            sick: t.Number({ minimum: 0 }),       // Jumlah hari sakit
            permission: t.Number({ minimum: 0 }),    // Jumlah hari izin
            absent: t.Number({ minimum: 0 }),      // Jumlah hari tanpa keterangan
          }),
        }
      )
      // ── DELETE /semester-records/:id/attendance — Hapus data kehadiran ────
      .delete("/:id/attendance", async ({ params }) => {
        logger.info({ recordId: params.id }, "DELETE attendance");
        const existing = await prisma.attendance.findUnique({
          where: { semesterRecordId: params.id },
        });
        if (!existing) throw new NotFoundError("Data kehadiran tidak ditemukan");
        await prisma.attendance.delete({ where: { semesterRecordId: params.id } });
        return success({ message: "Data kehadiran berhasil dihapus" });
      })
  );

/**
 * Teacher Note Controller — Kelola Catatan Guru untuk Siswa
 * ===========================================================
 *
 * Cara Kerja:
 * 1. Menyediakan 4 endpoint untuk CRUD catatan guru:
 *    - GET /students/:id/notes → List semua notes untuk seorang siswa
 *    - POST /students/:id/notes → Buat note baru untuk seorang siswa
 *    - PUT /teacher-notes/:id → Update konten note (hanya pemilik)
 *    - DELETE /teacher-notes/:id → Hapus note (hanya pemilik)
 * 2. Endpoint siswa (/students/:id/notes) dilindungi oleh requireHomeroomAccess
 *    yang memvalidasi akses wali kelas via params.id (studentId).
 * 3. Endpoint note (/teacher-notes/:id) dilindungi oleh requireAuth,
 *    dengan ownership check di service layer.
 *
 * Alur:
 * 1. Client mengirim request ke salah satu endpoint.
 * 2. Middleware memverifikasi autentikasi (requireAuth) dan akses homeroom jika perlu.
 * 3. Controller memvalidasi body request.
 * 4. Mendelegasikan logika ke teacher-note.service.ts.
 * 5. Mengembalikan response sukses dengan data.
 */

import { Elysia, t } from "elysia";
import logger from "../../lib/logger";
import * as service from "./teacher-note.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { requireHomeroomAccess } from "../../middleware/homeroom";

/**
 * teacherNoteController — Elysia route group untuk prefix /students/:id/notes.
 * Endpoint untuk list dan create catatan guru per siswa.
 * Membutuhkan akses homeroom (wali kelas) karena params.id adalah studentId.
 */
export const teacherNoteController = new Elysia({ prefix: "/students" })
  .guard({}, (app) =>
    app
      // Middleware: autentikasi JWT — memverifikasi token dan mengisi user context
      .use(requireAuth)
      // Middleware: akses wali kelas — hanya guru wali kelas yang bisa akses catatan siswanya
      .use(requireHomeroomAccess)
      // GET /students/:id/notes — List semua catatan guru untuk seorang siswa
      .get(
        "/:id/notes",
        async ({ params }) => {
          // params.id — ID siswa yang catatannya akan diambil
          logger.info({ studentId: params.id }, "Listing teacher notes for student");
          const data = await service.listByStudent(params.id);
          logger.info({ studentId: params.id, count: data.length }, "Teacher notes listed successfully");
          return success(data);
        }
      )
      // POST /students/:id/notes — Buat catatan guru baru untuk seorang siswa
      .post(
        "/:id/notes",
        async ({ params, body, user }) => {
          // params.id — ID siswa yang akan diberi catatan
          // body.content — Isi catatan dari request body
          // user.userId — ID guru yang membuat catatan (dari JWT)
          logger.info({ studentId: params.id, userId: user.userId }, "Creating teacher note");
          const data = await service.create({
            studentId: params.id,
            createdById: user.userId,
            content: body.content,
          });
          logger.info({ noteId: data.id, studentId: params.id }, "Teacher note created successfully");
          return success(data);
        },
        {
          // Validasi body: content wajib diisi
          body: t.Object({
            content: t.String({ minLength: 1 }), // Isi catatan tidak boleh kosong
          }),
        }
      )
  );

/**
 * teacherNoteUpdateController — Elysia route group untuk prefix /teacher-notes.
 * Endpoint untuk update dan delete catatan guru berdasarkan ID note.
 * Hanya membutuhkan autentikasi; ownership check dilakukan di service.
 */
export const teacherNoteUpdateController = new Elysia({ prefix: "/teacher-notes" })
  .guard({}, (app) =>
    app
      // Middleware: autentikasi JWT — memverifikasi token dan mengisi user context
      .use(requireAuth)
      // PUT /teacher-notes/:id — Update konten catatan guru (hanya pemilik)
      .put(
        "/:id",
        async ({ params, body, user }) => {
          // params.id — ID TeacherNote yang akan diupdate
          // body.content — Konten baru untuk catatan
          // user.userId — ID user untuk validasi ownership
          logger.info({ noteId: params.id, userId: user.userId }, "Updating teacher note");
          const data = await service.update(params.id, body.content, user.userId);
          logger.info({ noteId: data.id }, "Teacher note updated successfully");
          return success(data);
        },
        {
          // Validasi body: content wajib diisi, minimal 1 karakter
          body: t.Object({
            content: t.String({ minLength: 1 }),
          }),
        }
      )
      // DELETE /teacher-notes/:id — Hapus catatan guru (hanya pemilik)
      .delete(
        "/:id",
        async ({ params, user }) => {
          // params.id — ID TeacherNote yang akan dihapus
          // user.userId — ID user untuk validasi ownership
          logger.info({ noteId: params.id, userId: user.userId }, "Deleting teacher note");
          const data = await service.remove(params.id, user.userId);
          logger.info({ noteId: data.id }, "Teacher note deleted successfully");
          return success(data);
        }
      )
  );

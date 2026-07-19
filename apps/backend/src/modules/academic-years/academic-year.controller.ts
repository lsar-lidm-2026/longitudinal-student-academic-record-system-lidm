/**
 * Academic Year Controller — Handler untuk endpoint /academic-years
 * ===================================================================
 *
 * Cara Kerja:
 * 1. Mendefinisikan route Elysia dengan prefix "/academic-years" untuk CRUD tahun ajaran.
 * 2. Semua endpoint dilindungi middleware requireAuth (JWT).
 * 3. Endpoint GET bisa diakses oleh ADMINISTRATOR, OPERATOR_SEKOLAH, KEPALA_SEKOLAH, dan GURU.
 * 4. Endpoint POST/PUT/PATCH hanya untuk ADMINISTRATOR.
 * 5. Fungsi bisnis di-delegate ke academic-year.service.ts.
 *
 * Alur Lengkap:
 * - GET /academic-years → requireAuth → checkRole (multiple) → service.list() → return semua tahun ajaran
 * - POST /academic-years → requireAuth → checkRole ADMIN → service.create(body) → return tahun ajaran baru
 * - PUT /academic-years/:id → requireAuth → checkRole ADMIN → service.update(id, body) → return update
 * - PATCH /academic-years/:id/activate → requireAuth → checkRole ADMIN → service.activate(id) → set aktif
 * - PATCH /academic-years/:id/archive → requireAuth → checkRole ADMIN → service.archive(id) → set arsip
 */

import { Elysia, t } from "elysia";
import * as service from "./academic-year.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { checkRole } from "../../middleware/role";
import { prisma } from "../../lib/prisma";
import { NotFoundError, ValidationError } from "../../common/error";
import logger from "../../lib/logger";

export const academicYearController = new Elysia({ prefix: "/academic-years" })
  // ── Middleware: requireAuth (JWT verification) ─────────────────────────────
  .use(requireAuth)
  // ── GET /academic-years ────────────────────────────────────────────────────
  .get("/", async ({ user }) => {
    // Semua role boleh melihat daftar tahun ajaran — data ini digunakan di dropdown filter halaman lain (classes, semester records)
    checkRole(user, "ADMINISTRATOR", "OPERATOR_SEKOLAH", "KEPALA_SEKOLAH", "GURU");
    logger.info({ requesterId: user.userId }, "List all academic years");
    const data = await service.list();
    return success(data);
  })
  // ── POST /academic-years ───────────────────────────────────────────────────
  .post(
    "/",
    async ({ body, user }) => {
      // Hanya ADMINISTRATOR yang bisa membuat tahun ajaran baru
      checkRole(user, "ADMINISTRATOR");
      logger.info({ requesterId: user.userId, year: body.year }, "Create academic year");
      const data = await service.create(body);
      return success(data);
    },
    {
      // Validasi body: year (string) wajib diisi
      body: t.Object({ year: t.RegExp(/^\d{4}\/\d{4}$/, { description: "Format tahun harus YYYY/YYYY (contoh: 2025/2026)" }) }),
    }
  )
  // ── PUT /academic-years/:id ────────────────────────────────────────────────
  .put(
    "/:id",
    async ({ params, body, user }) => {
      // Hanya ADMINISTRATOR yang bisa mengupdate tahun ajaran
      checkRole(user, "ADMINISTRATOR");
      logger.info({ requesterId: user.userId, id: params.id, updates: body }, "Update academic year");
      const data = await service.update(params.id, body);
      return success(data);
    },
    {
      // Validasi body: year (string) opsional
      body: t.Object({ year: t.Optional(t.String()) }),
    }
  )
  // ── PATCH /academic-years/:id/activate ─────────────────────────────────────
  .patch("/:id/activate", async ({ params, user }) => {
    // Hanya ADMINISTRATOR yang bisa mengaktifkan tahun ajaran
    checkRole(user, "ADMINISTRATOR");
    logger.info({ requesterId: user.userId, id: params.id }, "Activate academic year");
    const data = await service.activate(params.id);
    return success(data);
  })
  // ── PATCH /academic-years/:id/archive ──────────────────────────────────────
  .patch("/:id/archive", async ({ params, user }) => {
    // Hanya ADMINISTRATOR yang bisa mengarsipkan tahun ajaran
    checkRole(user, "ADMINISTRATOR");
    logger.info({ requesterId: user.userId, id: params.id }, "Archive academic year");
    const data = await service.archive(params.id);
    return success(data);
  })
  // ── DELETE /academic-years/:id ─────────────────────────────────────────────
  .delete("/:id", async ({ params, user }) => {
    // Hanya ADMINISTRATOR yang bisa menghapus tahun ajaran
    checkRole(user, "ADMINISTRATOR");
    logger.warn({ requesterId: user.userId, yearId: params.id }, "DELETE /academic-years/:id called");
    const year = await prisma.academicYear.findUnique({ where: { id: params.id } });
    if (!year) throw new NotFoundError("Tahun ajaran tidak ditemukan");
    if (year.isActive) throw new ValidationError("Tidak dapat menghapus tahun ajaran yang sedang aktif");
    if (year.isArchived) throw new ValidationError("Tidak dapat menghapus tahun ajaran yang sudah diarsipkan");
    await prisma.academicYear.delete({ where: { id: params.id } });
    return success({ message: "Tahun ajaran berhasil dihapus" });
  });

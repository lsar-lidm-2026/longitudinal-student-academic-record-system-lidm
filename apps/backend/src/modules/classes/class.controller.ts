/**
 * Class Controller — Handler untuk endpoint /classes (manajemen kelas)
 * ======================================================================
 *
 * Cara Kerja:
 * 1. Mendefinisikan route Elysia dengan prefix "/classes" untuk CRUD kelas dan assignment wali kelas.
 * 2. Semua endpoint dilindungi middleware requireAuth (JWT).
 * 3. Endpoint GET /classes untuk ADMIN, OPERATOR, KEPSEK; POST/PUT/PATCH hanya ADMIN.
 * 4. GET /classes/:id/students bisa diakses oleh GURU juga (untuk melihat siswa di kelasnya).
 * 5. Fungsi bisnis di-delegate ke class.service.ts.
 *
 * Alur Lengkap:
 * - GET /classes → requireAuth → checkRole(admin, operator, kepsek) → service.list() → return semua kelas
 * - POST /classes → requireAuth → checkRole(admin) → service.create(body) → return kelas baru
 * - PUT /classes/:id → requireAuth → checkRole(admin) → service.updateClass(id, body) → return kelas terupdate
 * - PATCH /classes/:id/homeroom-teacher → requireAuth → checkRole(admin) → service.assignTeacher(id, teacherId, userId) → return kelas + audit log
 * - GET /classes/:id/students → requireAuth → checkRole(admin, operator, guru, kepsek) → service.getStudents(id) → return daftar siswa
 */

import { Elysia, t } from "elysia";
import * as service from "./class.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { checkRole } from "../../middleware/role";
import logger from "../../lib/logger";

export const classController = new Elysia({ prefix: "/classes" })
  // ── Middleware: requireAuth (JWT verification) ─────────────────────────────
  .use(requireAuth)
  // ── GET /classes ───────────────────────────────────────────────────────────
  .get("/", async ({ user, query }) => {
    // ADMIN, OPERATOR, KEPSEK bisa melihat daftar kelas
    checkRole(user, "ADMINISTRATOR", "OPERATOR_SEKOLAH", "KEPALA_SEKOLAH");
    logger.info({ requesterId: user.userId, all: query.all, yearId: query.yearId }, "List all classes");
    const data = await service.list(query.all === "true", query.yearId);
    return success(data);
  }, {
    query: t.Optional(t.Object({
      all: t.Optional(t.String()),
      yearId: t.Optional(t.String()),
    })),
  })
  // ── POST /classes ──────────────────────────────────────────────────────────
  .post(
    "/",
    async ({ body, user }) => {
      // Hanya ADMINISTRATOR yang bisa membuat kelas baru
      checkRole(user, "ADMINISTRATOR");
      logger.info({ requesterId: user.userId, name: body.name, academicYearId: body.academicYearId }, "Create class");
      const data = await service.create(body);
      return success(data);
    },
    {
      // Validasi body: name (string) dan academicYearId (string) wajib
      body: t.Object({
        name: t.String(),
        academicYearId: t.String(),
      }),
    }
  )
  // ── PUT /classes/:id ───────────────────────────────────────────────────────
  .put(
    "/:id",
    async ({ params, body, user }) => {
      // Hanya ADMINISTRATOR yang bisa mengupdate kelas
      checkRole(user, "ADMINISTRATOR");
      logger.info({ requesterId: user.userId, classId: params.id, updates: body }, "Update class");
      const data = await service.updateClass(params.id, body);
      return success(data);
    },
    {
      // Validasi body: name, academicYearId — opsional
      body: t.Object({
        name: t.Optional(t.String()),
        academicYearId: t.Optional(t.String()),
      }),
    }
  )
  // ── PATCH /classes/:id/homeroom-teacher ────────────────────────────────────
  .patch(
    "/:id/homeroom-teacher",
    async ({ params, body, user }) => {
      // Hanya ADMINISTRATOR yang bisa menetapkan/mengganti wali kelas
      checkRole(user, "ADMINISTRATOR");
      logger.info({ requesterId: user.userId, classId: params.id, teacherId: body.teacherId }, "Assign homeroom teacher");
      // Panggil service.assignTeacher dengan classId, teacherId, dan userId pembuat perubahan
      const data = await service.assignTeacher(params.id, body.teacherId, user.userId);
      return success(data);
    },
    {
      // Validasi body: teacherId (string) wajib
      body: t.Object({ teacherId: t.String() }),
    }
  )
  // ── GET /classes/:id/students ──────────────────────────────────────────────
  .get("/:id/students", async ({ params, user }) => {
    // Multiple role bisa melihat siswa dalam kelas (termasuk GURU untuk akses wali kelas)
    checkRole(user, "ADMINISTRATOR", "OPERATOR_SEKOLAH", "GURU", "KEPALA_SEKOLAH");
    logger.info({ requesterId: user.userId, classId: params.id }, "Get students by class");
    const data = await service.getStudents(params.id);
    return success(data);
  })
  // ── POST /classes/:id/promote — Kenaikan kelas (promote all students) ──────
  .post(
    "/:id/promote",
    async ({ params, body, user }) => {
      // Hanya ADMINISTRATOR dan OPERATOR_SEKOLAH yang bisa melakukan promote
      checkRole(user, "ADMINISTRATOR", "OPERATOR_SEKOLAH");
      logger.info({ fromClassId: params.id, toClassId: body.toClassId }, "POST /classes/:id/promote called");
      const result = await service.promoteStudents(params.id, body.toClassId);
      return success(result);
    },
    {
      body: t.Object({
        toClassId: t.String(),
      }),
    }
  );

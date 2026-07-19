/**
 * Users Controller — Handler untuk endpoint /users (manajemen user oleh ADMINISTRATOR)
 * ===================================================================================
 *
 * Cara Kerja:
 * 1. Mendefinisikan route Elysia dengan prefix "/users" untuk CRUD user.
 * 2. Semua endpoint dilindungi middleware requireAuth (JWT) dan checkRole ADMINISTRATOR.
 * 3. Fungsi bisnis di-delegate ke auth.service.ts (createUser, listUsers, getMe, updateUser, toggleUserStatus).
 * 4. Response diformat menggunakan helper success() dari common/response.
 *
 * Alur Lengkap:
 * - GET /users → requireAuth → checkRole ADMINISTRATOR → authService.listUsers() → return semua user
 * - POST /users → requireAuth → checkRole ADMINISTRATOR → authService.createUser(body) → return user baru
 * - GET /users/:id → requireAuth → checkRole ADMINISTRATOR → authService.getMe(id) → return user by id
 * - PUT /users/:id → requireAuth → checkRole ADMINISTRATOR → authService.updateUser(id, body) → return user terupdate
 * - PATCH /users/:id/status → requireAuth → checkRole ADMINISTRATOR → authService.toggleUserStatus(id) → return user dengan status baru
 */

import { Elysia, t } from "elysia";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { checkRole } from "../../middleware/role";
import * as authService from "../auth/auth.service";
import logger from "../../lib/logger";

export const usersController = new Elysia({ prefix: "/users" })
  // ── Middleware: requireAuth (JWT verification) ─────────────────────────────
  .use(requireAuth)
  // ── GET /users ─────────────────────────────────────────────────────────────
  .get("/", async ({ user }) => {
    // Diperbolehkan untuk ADMINISTRATOR, OPERATOR_SEKOLAH, GURU, KEPALA_SEKOLAH
    checkRole(user, "ADMINISTRATOR", "OPERATOR_SEKOLAH", "GURU", "KEPALA_SEKOLAH");
    logger.info({ requesterId: user.userId }, "List all users");
    const data = await authService.listUsers();
    return success(data);
  })
  // ── POST /users ────────────────────────────────────────────────────────────
  .post(
    "/",
    async ({ body, user }) => {
      // Hanya ADMINISTRATOR yang bisa membuat user baru
      checkRole(user, "ADMINISTRATOR");
      logger.info({ requesterId: user.userId, newUsername: body.username }, "Create new user");
      const data = await authService.createUser(body);
      return success(data);
    },
    {
      // Validasi body: username, password (min 6), name, role (enum)
      body: t.Object({
        username: t.String(),
        password: t.String({ minLength: 6 }),
        name: t.String(),
        role: t.Union([
          t.Literal("ADMINISTRATOR"),
          t.Literal("OPERATOR_SEKOLAH"),
          t.Literal("GURU"),
          t.Literal("KEPALA_SEKOLAH"),
        ]),
      }),
    }
  )
  // ── GET /users/:id ─────────────────────────────────────────────────────────
  .get("/:id", async ({ params, user }) => {
    // Hanya ADMINISTRATOR yang bisa melihat detail user
    checkRole(user, "ADMINISTRATOR");
    logger.info({ requesterId: user.userId, targetUserId: params.id }, "Get user by ID");
    const data = await authService.getMe(params.id);
    return success(data);
  })
  // ── PUT /users/:id ─────────────────────────────────────────────────────────
  .put(
    "/:id",
    async ({ params, body, user }) => {
      // Hanya ADMINISTRATOR yang bisa mengupdate user
      checkRole(user, "ADMINISTRATOR");
      logger.info({ requesterId: user.userId, targetUserId: params.id, updates: body }, "Update user");
      const data = await authService.updateUser(params.id, body);
      return success(data);
    },
    {
      // Validasi body: name, role, isActive — semua opsional
      body: t.Object({
        name: t.Optional(t.String()),
        role: t.Optional(
          t.Union([
            t.Literal("ADMINISTRATOR"),
            t.Literal("OPERATOR_SEKOLAH"),
            t.Literal("GURU"),
            t.Literal("KEPALA_SEKOLAH"),
          ])
        ),
        isActive: t.Optional(t.Boolean()),
      }),
    }
  )
  // ── PATCH /users/:id/status ────────────────────────────────────────────────
  .patch("/:id/status", async ({ params, user }) => {
    // Hanya ADMINISTRATOR yang bisa toggle status user
    checkRole(user, "ADMINISTRATOR");
    logger.info({ requesterId: user.userId, targetUserId: params.id }, "Toggle user status");
    const data = await authService.toggleUserStatus(params.id);
    return success(data);
  });

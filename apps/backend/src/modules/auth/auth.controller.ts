/**
 * Auth Controller — Handler untuk endpoint /auth
 * ===============================================
 *
 * Cara Kerja:
 * 1. Mendefinisikan route Elysia dengan prefix "/auth" untuk login, refresh token, logout, dan profile.
 * 2. Setiap handler memanggil service function dari auth.service.ts untuk logika bisnis.
 * 3. Response diformat menggunakan helper success() / errorResponse() dari common/response.
 * 4. Endpoint /me dilindungi oleh middleware requireAuth (JWT verification).
 *
 * Alur Lengkap:
 * - POST /auth/login → validasi body (username, password) → authService.login() → generate JWT + refresh token → return success
 * - POST /auth/refresh → validasi body (refreshToken) → authService.refresh() → verify token → generate new pair → return success
 * - POST /auth/logout → server acknowledgment (client-side token invalidation)
 * - GET /auth/me → requireAuth middleware (JWT check) → authService.getMe(userId) → return user profile
 */

import { Elysia, t } from "elysia";
import * as authService from "./auth.service";
import { success, error as errorResponse } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { checkRole } from "../../middleware/role";
import logger from "../../lib/logger";

export const authController = new Elysia({ prefix: "/auth" })
  // ── POST /auth/login ──────────────────────────────────────────────────────
  .post(
    "/login",
    // Handler untuk login: menerima username & password, mengembalikan JWT + refresh token
    async ({ body, set }) => {
      logger.info({ username: body.username }, "Login attempt");
      try {
        // Panggil service login untuk verifikasi kredensial dan generate token
        const result = await authService.login(body);
        logger.info({ userId: result.user.userId }, "Login successful");
        return success(result);
      } catch (e: any) {
        // Tangkap UnauthorizedError (salah username/password) → response 401
        if (e.name === "AppError" && e.code === "UNAUTHORIZED") {
          logger.warn({ username: body.username }, "Login failed: invalid credentials");
          set.status = 401;
          return errorResponse("UNAUTHORIZED", e.message);
        }
        // Jangan mask error internal sebagai 401 — biar error handler global yang tangani
        logger.error({ err: e, username: body.username }, "Login internal error");
        throw e;
      }
    },
    {
      // Validasi body: username (string) dan password (string) wajib diisi
      body: t.Object({
        username: t.String(),
        password: t.String(),
      }),
    }
  )
  // ── POST /auth/refresh ─────────────────────────────────────────────────────
  .post(
    "/refresh",
    // Handler untuk refresh token: menerima refreshToken, mengembalikan access+refresh token baru
    async ({ body, set }) => {
      logger.info("Token refresh attempt");
      try {
        // Verifikasi refresh token dan generate token pair baru
        const result = await authService.refresh(body.refreshToken);
        logger.info({ userId: result.user.userId }, "Token refresh successful");
        return success(result);
      } catch (e: any) {
        // Semua error dari refresh dianggap invalid/expired → response 401
        logger.warn({ err: e }, "Token refresh failed");
        set.status = 401;
        return errorResponse("UNAUTHORIZED", e.message);
      }
    },
    {
      // Validasi body: refreshToken (string) wajib diisi
      body: t.Object({
        refreshToken: t.String(),
      }),
    }
  )
  // ── POST /auth/logout ──────────────────────────────────────────────────────
  .post(
    "/logout",
    // Handler untuk logout: server acknowledgment saja, token invalidation dilakukan client-side
    async ({ body }) => {
      logger.info("Logout acknowledged");
      // Client-side token invalidation; server acknowledges logout
      return success({ message: "Logged out successfully" });
    }
  )
  // ── Middleware: requireAuth (JWT verification) ─────────────────────────────
  .use(requireAuth)
  // ── GET /auth/me ───────────────────────────────────────────────────────────
  .get("/me", async ({ user }) => {
    // Mendapatkan profil user yang sedang login berdasarkan userId dari JWT payload
    logger.info({ userId: user.userId }, "Get current user profile");
    const data = await authService.getMe(user.userId);
    return success(data);
  });

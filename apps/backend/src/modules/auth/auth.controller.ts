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
import { ValidationError, NotFoundError } from "../../common/error";
import { requireAuth } from "../../middleware/auth";
import { checkRole } from "../../middleware/role";
import logger from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { sendPasswordResetEmail } from "../../lib/mail";

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
  // ── POST /auth/forgot-password ─────────────────────────────────────────────
  .post(
    "/forgot-password",
    // Handler: menerima email, generate token reset, simpan di DB, kirim email via SMTP.
    // Untuk keamanan, selalu return success meskipun email tidak ditemukan.
    async ({ body }) => {
      logger.info({ email: body.email }, "Forgot password request");

      // Cari user berdasarkan email (username = local-part sebelum @)
      const user = await prisma.user.findFirst({
        where: { username: body.email.split("@")[0] },
        select: { id: true, username: true },
      });

      // Generate token kriptografik (32 bytes hex = 64 karakter)
      const crypto = await import("node:crypto");
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // Kedaluwarsa 1 jam

      // Simpan token ke database (selalu simpan, meskipun user tidak ditemukan)
      await prisma.passwordResetToken.create({
        data: { email: body.email, token, expiresAt },
      });

      // Kirim email reset password
      const resetLink = `${env.appUrl}/reset-password?token=${token}`;
      const sent = await sendPasswordResetEmail(body.email, resetLink);

      // Selalu return success — jangan reveal apakah email terdaftar atau tidak
      return success({
        message: sent
          ? "Tautan reset password telah dikirim ke email Anda."
          : "Gagal mengirim email. Silakan hubungi administrator sekolah untuk mereset password Anda.",
      });
    },
    {
      // Validasi body: email wajib diisi dan harus format email valid
      body: t.Object({
        email: t.String({ format: "email" }),
      }),
    }
  )
  // ── POST /auth/reset-password ─────────────────────────────────────────────
  .post(
    "/reset-password",
    // Handler: menerima token + password baru, validasi token, update password, tandai token terpakai.
    async ({ body }) => {
      logger.info({}, "Reset password request");

      const { token, newPassword } = body;

      // Validasi input
      if (!token || !newPassword || newPassword.length < 6) {
        throw new ValidationError(
          "Token tidak valid atau password terlalu pendek (min 6 karakter)"
        );
      }

      // Cari token yang valid (belum dipakai, belum expired)
      const resetToken = await prisma.passwordResetToken.findUnique({
        where: { token },
      });

      if (!resetToken) {
        throw new NotFoundError("Token reset password tidak valid");
      }

      if (resetToken.usedAt) {
        throw new ValidationError("Token sudah pernah digunakan");
      }

      if (new Date() > resetToken.expiresAt) {
        throw new ValidationError(
          "Token sudah kedaluwarsa. Silakan minta reset ulang."
        );
      }

      // Cari user berdasarkan email (username = local-part sebelum @)
      const localPart = resetToken.email.split("@")[0];
      const user = await prisma.user.findFirst({
        where: { username: localPart },
      });

      if (!user) {
        throw new NotFoundError("User tidak ditemukan");
      }

      // Hash password baru menggunakan Bun native bcrypt
      const hashedPassword = await Bun.password.hash(newPassword, {
        algorithm: "bcrypt",
        cost: 10,
      });

      // Update password user dalam transaction dengan Prisma
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { password: hashedPassword },
        }),
        // Tandai token sebagai sudah dipakai
        prisma.passwordResetToken.update({
          where: { id: resetToken.id },
          data: { usedAt: new Date() },
        }),
      ]);

      logger.info({ userId: user.id }, "Password reset successfully");
      return success({
        message:
          "Password berhasil direset. Silakan login dengan password baru.",
      });
    },
    {
      // Validasi body: token (string) dan newPassword (min 6 karakter) wajib diisi
      body: t.Object({
        token: t.String(),
        newPassword: t.String({ minLength: 6 }),
      }),
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

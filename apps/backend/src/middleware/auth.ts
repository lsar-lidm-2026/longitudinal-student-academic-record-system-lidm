/**
 * Authentication Middleware (requireAuth)
 * =======================================
 *
 * Cara Kerja:
 * 1. Middleware Elysia dengan nama "requireAuth" — dipasang di route yang perlu autentikasi.
 * 2. Mengekstrak token JWT dari header Authorization (format: "Bearer <token>").
 * 3. Memverifikasi token via verifyToken() dari lib/jwt.
 * 4. Jika valid: inject objek { user: JwtPayload } ke context Elysia (scoped).
 * 5. Jika invalid/missing: throw UnauthorizedError (HTTP 401).
 *
 * Alur:
 * - Route handler cukup menggunakan .use(requireAuth) untuk melindungi endpoint.
 * - Setelah middleware, handler bisa mengakses `user` dari context (e.g., user.userId).
 */

import { Elysia } from "elysia";
import { verifyToken } from "../lib/jwt";
import { UnauthorizedError } from "../common/error";
import type { JwtPayload } from "../common/types";
import logger from "../lib/logger";

/**
 * requireAuth — Elysia plugin yang memvalidasi JWT Bearer token.
 * Mengekstrak user dari token dan menyediakannya sebagai scoped context.
 */
export const requireAuth = new Elysia({ name: "requireAuth" })
  .derive({ as: "scoped" }, async ({ request }) => {
    // Ambil header Authorization dari request HTTP
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      logger.warn("Request missing or invalid Authorization header");
      throw new UnauthorizedError("Missing or invalid token");
    }

    // Ekstrak token setelah "Bearer " (7 karakter)
    const token = authHeader.slice(7);
    try {
      // Verifikasi dan decode token JWT
      const payload = verifyToken(token);
      logger.info({ userId: payload.userId, role: payload.role }, "Authentication successful");
      // Inject user payload ke context route handler
      return { user: payload as JwtPayload };
    } catch {
      // Token tidak valid (expired, signature mismatch, dll)
      logger.warn("Invalid or expired token rejected");
      throw new UnauthorizedError("Invalid or expired token");
    }
  });

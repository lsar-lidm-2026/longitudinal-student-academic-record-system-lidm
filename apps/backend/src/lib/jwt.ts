/**
 * JWT Utility — Token Generation & Verification
 * ==============================================
 *
 * Cara Kerja:
 * 1. `generateToken()` membuat access JWT dengan payload { userId, username, role, name, iat }
 *    yang ditandatangani menggunakan secret dari env dengan masa berlaku konfigurabel.
 * 2. `verifyToken()` memverifikasi dan mendekode token, mengembalikan JwtPayload.
 * 3. `generateRefreshToken()` membuat refresh token dengan masa berlaku 30 hari.
 * 4. `getExpiresIn()` membaca durasi dari env dan mendukung format string ("7d") atau number (detik).
 *
 * Alur:
 * - Controller login → generateToken(payload) → kirim ke client.
 * - Middleware auth → verifyToken(token) → inject user ke context.
 * - Endpoint refresh → generateRefreshToken(payload) → token baru.
 */

import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import type { JwtPayload } from "../common/types";
import logger from "./logger";

/**
 * Mendapatkan opsi expiresIn dari environment variable.
 * jsonwebtoken menerima string ("7d") atau number (detik) — kita deteksi otomatis.
 * @returns SignOptions dengan expiresIn yang sesuai.
 */
function getExpiresIn(): SignOptions {
  const val = env.jwtExpiresIn;
  // jsonwebtoken accepts either a string like "7d" or a number of seconds
  const num = parseInt(val, 10);
  // Jika hasil parseInt NaN berarti val adalah string durasi, otherwise gunakan angka
  return { expiresIn: isNaN(num) ? val : num } as SignOptions;
}

/**
 * Membuat access token JWT.
 * @param payload - Data user yang akan dimasukkan ke token.
 * @returns Signed JWT string.
 */
export function generateToken(payload: JwtPayload): string {
  logger.info({ userId: payload.userId, role: payload.role }, "Generating access token");
  return jwt.sign(
    {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
      name: payload.name,
      // iat (issued at) dalam epoch detik
      iat: Math.floor(Date.now() / 1000),
    },
    env.jwtSecret,
    getExpiresIn()
  );
}

/**
 * Memverifikasi dan mendekode JWT token.
 * @param token - JWT string dari Authorization header.
 * @returns JwtPayload yang sudah divalidasi.
 * @throws JsonWebTokenError jika token invalid/expired.
 */
export function verifyToken(token: string): JwtPayload {
  // Decode dan verifikasi token menggunakan secret
  const decoded = jwt.verify(token, env.jwtSecret) as Record<string, unknown>;
  logger.info({ userId: decoded.userId, role: decoded.role }, "Token verified successfully");
  return {
    userId: String(decoded.userId ?? ""),
    username: String(decoded.username ?? ""),
    role: String(decoded.role ?? "") as JwtPayload["role"],
    name: String(decoded.name ?? ""),
    // iat bersifat opsional — hanya disertakan jika ada dan bertipe number
    iat: typeof decoded.iat === "number" ? decoded.iat : undefined,
  };
}

/**
 * Membuat refresh token dengan masa berlaku 30 hari.
 * @param payload - Data user yang akan dimasukkan ke token.
 * @returns Signed JWT string dengan expiry 30d.
 */
export function generateRefreshToken(payload: JwtPayload): string {
  logger.info({ userId: payload.userId, role: payload.role }, "Generating refresh token (30d)");
  return jwt.sign(
    {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
      name: payload.name,
      iat: Math.floor(Date.now() / 1000),
    },
    env.jwtSecret,
    // Refresh token selalu 30 hari — tidak pakai konfigurasi
    { expiresIn: "30d" } as SignOptions
  );
}

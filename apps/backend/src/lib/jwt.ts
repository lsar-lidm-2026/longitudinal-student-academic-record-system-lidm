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
 * jsonwebtoken menerima string ("7d", "1h") atau number (detik).
 * parseInt("7d") = 7 (BUG!) — kita harus deteksi string durasi dengan regex.
 * @returns SignOptions dengan expiresIn yang sesuai.
 */
function getExpiresIn(): SignOptions {
  const val = env.jwtExpiresIn;
  // Hanya gunakan parseInt jika seluruh string adalah angka (detik)
  // Jika mengandung huruf seperti "7d", "1h", "30m", langsung gunakan sebagai string
  const isPureNumber = /^\d+$/.test(val);
  const expiresIn = isPureNumber ? parseInt(val, 10) : val;
  logger.debug({ val, expiresIn, isPureNumber }, "JWT expiresIn configured");
  return { expiresIn } as SignOptions;
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
    // refreshTokenVersion bersifat opsional — untuk validasi refresh token
    refreshTokenVersion: typeof decoded.refreshTokenVersion === "number" ? decoded.refreshTokenVersion : undefined,
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
  logger.info({ userId: payload.userId, role: payload.role, version: payload.refreshTokenVersion }, "Generating refresh token (7d)");
  return jwt.sign(
    {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
      name: payload.name,
      refreshTokenVersion: payload.refreshTokenVersion,
      iat: Math.floor(Date.now() / 1000),
    },
    env.jwtSecret,
    // Refresh token — 7 hari (FR-01: refresh token expiry sesuai plan)
    { expiresIn: "7d" } as SignOptions
  );
}

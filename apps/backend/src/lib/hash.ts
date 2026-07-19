/**
 * Password Hashing Utility (Bun-native bcrypt)
 * ============================================
 *
 * Cara Kerja:
 * 1. `hashPassword()` — Meng-hash password plaintext menggunakan algoritma bcrypt
 *    via Bun.password.hash dengan cost factor 10.
 * 2. `verifyPassword()` — Memverifikasi password plaintext terhadap hash bcrypt
 *    via Bun.password.verify.
 *
 * Alur:
 * - Saat registrasi/update password: hashPassword(plainPassword) → simpan hash ke DB.
 * - Saat login: verifyPassword(inputPassword, storedHash) → true/false.
 *
 * Catatan: Menggunakan implementasi bcrypt bawaan Bun — tidak perlu dependency eksternal.
 */

import logger from "./logger";

/**
 * Meng-hash password dengan bcrypt (cost=10).
 * @param password - Password plaintext dari user.
 * @returns String hash bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  logger.debug("Hashing password with bcrypt (cost=10)");
  return await Bun.password.hash(password, {
    algorithm: "bcrypt",
    cost: 10,
  });
}

/**
 * Memverifikasi password plaintext terhadap hash bcrypt.
 * @param password - Password plaintext yang akan dicek.
 * @param hash - Hash bcrypt yang tersimpan di database.
 * @returns Boolean apakah password cocok dengan hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  logger.debug("Verifying password against bcrypt hash");
  return await Bun.password.verify(password, hash, "bcrypt");
}

/**
 * Response Helpers — Standard API Response Builders
 * ===================================================
 *
 * Cara Kerja:
 * 1. Menyediakan 3 fungsi helper untuk membuat response API yang konsisten.
 * 2. Setiap fungsi mengembalikan objek yang sesuai dengan interface ApiResponse<T>.
 * 3. success(data, meta?) → Response untuk operasi berhasil, opsional dengan pagination meta.
 * 4. error(code, message) → Response untuk operasi gagal, berisi kode dan pesan error.
 * 5. paginated(data, page, limit, total) → Response khusus untuk endpoint terpaginasi.
 * 6. Logger mencatat setiap pembuatan response error untuk audit trail.
 *
 * Alur Lengkap:
 * - Controller memanggil success(data) / error(code, msg) / paginated(data, p, l, t) →
 *   Helper membuat objek ApiResponse → Dikembalikan ke client
 *
 * Dependencies:
 * - ./types: Interface ApiResponse<T> untuk type safety
 * - ./logger: Pino logger — mencatat response error untuk debugging
 */

import type { ApiResponse } from "./types";
import logger from "../lib/logger";

/**
 * success — Membuat response sukses.
 * @param data Payload yang akan dikembalikan ke client.
 * @param meta Opsional — metadata pagination (page, limit, total).
 * @returns ApiResponse<T> dengan success=true dan data yang diberikan.
 */
export function success<T>(data: T, meta?: { page: number; limit: number; total: number }): ApiResponse<T> {
  return { success: true, data, ...(meta ? { meta } : {}) };
}

/**
 * error — Membuat response error.
 * @param code Kode error machine-readable (e.g. "NOT_FOUND", "UNAUTHORIZED").
 * @param message Pesan error human-readable.
 * @returns ApiResponse<never> dengan success=false dan detail error.
 */
export function error(code: string, message: string): ApiResponse<never> {
  logger.warn({ errorCode: code, errorMessage: message }, "API error response");
  return { success: false, error: { code, message } };
}

/**
 * paginated — Membuat response sukses dengan pagination metadata.
 * @param data Array data yang akan dikembalikan.
 * @param page Nomor halaman saat ini.
 * @param limit Jumlah item per halaman.
 * @param total Total jumlah item di seluruh halaman.
 * @returns ApiResponse<T> dengan success=true, data, dan meta pagination.
 */
export function paginated<T>(
  data: T,
  page: number,
  limit: number,
  total: number
): ApiResponse<T> {
  return { success: true, data, meta: { page, limit, total } };
}

/**
 * Pagination Helpers — Parse & Build Pagination Parameters
 * ==========================================================
 *
 * Cara Kerja:
 * 1. parsePagination() menerima query string dari request (page, limit) dan
 *    mengonversinya ke PaginationParams yang sudah divalidasi.
 * 2. Validasi memastikan: page >= 1, limit antara 1-100.
 * 3. buildPagination() mengonversi page/limit ke format Prisma (skip/take).
 * 4. Kedua fungsi ini digunakan bersama oleh controller yang membutuhkan pagination.
 *
 * Alur Lengkap:
 * - Controller menerima query { page?: string, limit?: string } dari request →
 *   parsePagination(query) → { page: number, limit: number } →
 *   buildPagination(page, limit) → { skip: number, take: number } →
 *   Prisma findMany({ skip, take }) → response paginated(data, page, limit, total)
 *
 * Dependencies:
 * - ./types: Interface PaginationParams untuk type safety
 * - ./logger: Pino logger — mencatat parameter pagination untuk debugging
 */

import type { PaginationParams } from "./types";
import logger from "../lib/logger";

/**
 * parsePagination — Parse dan validasi parameter pagination dari query string.
 * @param query Query object dari request (biasanya ctx.query atau req.query).
 * @returns PaginationParams dengan page >= 1 dan limit antara 1-100.
 */
export function parsePagination(query: { page?: string; limit?: string }): PaginationParams {
  // Parse page, default 1, minimal 1
  const page = Math.max(1, parseInt(query.page || "1", 10) || 1);
  // Parse limit, default 20, minimal 1, maksimal 100
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || "20", 10) || 20));
  logger.debug({ page, limit }, "Pagination parameters parsed");
  return { page, limit };
}

/**
 * buildPagination — Konversi page/limit ke Prisma skip/take.
 * @param page Nomor halaman (1-indexed).
 * @param limit Jumlah item per halaman.
 * @returns Object { skip, take } untuk Prisma findMany query.
 */
export function buildPagination(page: number, limit: number) {
  // skip: lompati item dari halaman sebelumnya
  // take: ambil sebanyak limit item
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

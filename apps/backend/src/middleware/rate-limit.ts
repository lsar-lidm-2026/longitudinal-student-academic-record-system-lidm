/**
 * Rate Limit Middleware — mencegah spam pada AI endpoints
 * ==========================================================
 *
 * Cara Kerja:
 * 1. Map in-memory yang menyimpan timestamp request terakhir per userId + endpoint.
 * 2. Setiap request dicek: jika < 30 detik dari request sebelumnya, ditolak dengan ValidationError.
 * 3. Map di-clear setiap 10 menit untuk mencegah memory leak.
 *
 * Alur:
 * - Controller pasang `.use(rateLimitAi())` di guard group.
 * - Setiap handler AI panggil `rateLimitAi("endpoint-name")` di awal.
 * - Jika terlalu cepat → throw ValidationError("Mohon tunggu X detik...").
 */

import { Elysia } from "elysia";
import { ValidationError } from "../common/error";
import logger from "../lib/logger";

const RATE_LIMIT_WINDOW = 30_000; // 30 detik
const CLEANUP_INTERVAL = 600_000; // 10 menit

/** Map<"userId:endpoint", timestamp> */
const requestLog = new Map<string, number>();

// Cleanup periodic — hapus entry yang sudah lebih dari 2x window
setInterval(() => {
  const now = Date.now();
  let cleared = 0;
  for (const [key, ts] of requestLog.entries()) {
    if (now - ts > RATE_LIMIT_WINDOW * 2) {
      requestLog.delete(key);
      cleared++;
    }
  }
  if (cleared > 0) logger.debug({ cleared }, "Rate limit cache cleaned");
}, CLEANUP_INTERVAL);

/**
 * rateLimitAi — Elysia plugin yang menyuntikkan fungsi `rateLimitAi` ke context.
 *
 * @param maxRequests - Jumlah maksimum request dalam window (default: 1)
 * @param windowMs    - Window waktu dalam ms (default: 30.000 = 30 detik)
 *
 * @returns Elysia plugin (gunakan dengan `.use(rateLimitAi())`)
 *
 * Contoh penggunaan di handler:
 * ```typescript
 * async ({ rateLimitAi }) => {
 *   rateLimitAi("summary");
 *   // ... logic AI ...
 * }
 * ```
 */
export function rateLimitAi(maxRequests = 1, windowMs = RATE_LIMIT_WINDOW) {
  return (app: Elysia) =>
    app.derive((context) => {
      // `user` disuntikkan oleh middleware requireAuth yang berjalan sebelumnya
      const ctx = context as { user?: { userId: string } };
      return {
        rateLimitAi: (endpoint: string) => {
          const key = `${ctx.user?.userId || "anonymous"}:${endpoint}`;
          const lastRequest = requestLog.get(key);
          const now = Date.now();

          if (lastRequest && now - lastRequest < windowMs) {
            const remaining = Math.ceil((windowMs - (now - lastRequest)) / 1000);
            throw new ValidationError(
              `Mohon tunggu ${remaining} detik sebelum membuat request AI lagi`
            );
          }

          requestLog.set(key, now);
        },
      };
    });
}

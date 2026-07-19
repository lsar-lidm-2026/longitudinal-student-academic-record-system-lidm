/**
 * ACTIVITY CONTROLLER — Handler untuk endpoint /activity
 * =======================================================
 *
 * Cara Kerja:
 * 1. Mendefinisikan route Elysia dengan prefix "/activity".
 * 2. GET /activity — mengambil aktivitas terbaru dari ClassAuditLog.
 * 3. Memerlukan autentikasi JWT (requireAuth) namun bisa diakses oleh semua role.
 * 4. Memanggil activityService.list() untuk query dan format data.
 *
 * Alur Lengkap:
 * - Client GET /activity → requireAuth (JWT check) → checkRole (min GURU) →
 *   activityService.list() → query ClassAuditLog → lookup teacher names →
 *   format ActivityItem[] → return success response
 *
 * Dependencies:
 * - ../../middleware/auth: requireAuth untuk autentikasi JWT
 * - ../../middleware/role: checkRole untuk verifikasi hak akses
 * - ./activity.service: Business logic query dan formatting
 * - ../../lib/logger: Pino logger untuk logging terstruktur
 */

import { Elysia } from "elysia";
import * as activityService from "./activity.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { checkRole } from "../../middleware/role";
import logger from "../../lib/logger";

/**
 * Activity Controller — prefix "/activity".
 *
 * Endpoints:
 * - GET /activity — Mengembalikan daftar aktivitas terbaru (ClassAuditLog).
 *   Query params opsional: ?limit=10 (default 20, max 100).
 *   Response: { success, data: ActivityItem[] }
 */
export const activityController = new Elysia({ prefix: "/activity" })
  // Terapkan autentikasi JWT untuk semua endpoint di controller ini
  .use(requireAuth)
  // ── GET /activity ─────────────────────────────────────────────────────────
  .get("/", async ({ query, user }) => {
    // Minimal role GURU bisa melihat activity log
    checkRole(user, "ADMINISTRATOR", "OPERATOR_SEKOLAH", "KEPALA_SEKOLAH", "GURU");

    logger.info({ userId: user.userId, query }, "activity.controller — listing activities");

    // Parse optional limit dari query string, default 20
    const limit = query.limit ? parseInt(query.limit as string, 10) || 20 : 20;

    // Panggil service untuk mengambil dan memformat data aktivitas
    const data = await activityService.list(limit);

    logger.info({ count: data.length }, "activity.controller — activities retrieved successfully");
    return success(data);
  });

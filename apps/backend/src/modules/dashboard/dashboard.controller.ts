/**
 * Dashboard Controller — Ringkasan Dashboard dan Status Administratif
 * ====================================================================
 *
 * Cara Kerja:
 * 1. Menyediakan endpoint GET untuk data dashboard:
 *    - GET /dashboard/summary → ringkasan data (total siswa, kelas, tahun aktif, draft AI)
 *    - GET /dashboard/administrative-status → status kelengkapan data per kelas
 * 2. Kedua endpoint dilindungi oleh middleware requireAuth.
 * 3. Pengecekan role dilakukan via checkRole (berbeda untuk tiap endpoint).
 * 4. Mendelegasikan logika ke dashboard.service.ts.
 *
 * Alur:
 * 1. Client mengirim request GET ke endpoint dashboard.
 * 2. Middleware requireAuth memverifikasi JWT token.
 * 3. checkRole memverifikasi apakah role user diizinkan mengakses endpoint.
 * 4. Controller memanggil service yang sesuai (getSummary / getAdministrativeStatus).
 * 5. Mengembalikan response sukses.
 */

import { Elysia } from "elysia";
import logger from "../../lib/logger";
import { checkRole } from "../../middleware/role";
import * as service from "./dashboard.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";

/**
 * dashboardController — Elysia route group untuk prefix /dashboard.
 * Menyediakan data ringkasan dan status administratif untuk dashboard.
 */
export const dashboardController = new Elysia({ prefix: "/dashboard" })
  .guard({}, (app) =>
    app
      // Middleware: autentikasi JWT — semua endpoint dashboard butuh login
      .use(requireAuth)
      // GET /dashboard/summary — Ringkasan data umum dashboard
      .get("/summary", async ({ user }) => {
        // checkRole: izinkan ADMINISTRATOR, OPERATOR_SEKOLAH, GURU, KEPALA_SEKOLAH
        checkRole(user, "ADMINISTRATOR", "OPERATOR_SEKOLAH", "GURU", "KEPALA_SEKOLAH");
        logger.info({ userId: user.userId, role: user.role }, "Fetching dashboard summary");
        const data = await service.getSummary(user.userId, user.role);
        logger.info({ userId: user.userId }, "Dashboard summary fetched successfully");
        return success(data);
      })
      // GET /dashboard/administrative-status — Status kelengkapan data per kelas
      .get("/administrative-status", async ({ user }) => {
        // checkRole: izinkan ADMINISTRATOR, GURU, KEPALA_SEKOLAH (tanpa OPERATOR)
        checkRole(user, "ADMINISTRATOR", "GURU", "KEPALA_SEKOLAH");
        logger.info({ userId: user.userId, role: user.role }, "Fetching administrative status");
        const data = await service.getAdministrativeStatus(user.userId, user.role);
        logger.info({ userId: user.userId, classCount: data.length }, "Administrative status fetched successfully");
        return success(data);
      })
  );

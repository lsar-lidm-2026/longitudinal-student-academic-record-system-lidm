/**
 * Role-based Access Control (checkRole)
 * ======================================
 *
 * Cara Kerja:
 * 1. Fungsi `checkRole()` menerima objek user (dari requireAuth) dan daftar role yang diizinkan.
 * 2. Jika user tidak ada atau role user tidak termasuk dalam daftar → throw ForbiddenError.
 * 3. Harus dipanggil di dalam route handler yang sudah menggunakan requireAuth (user sudah tersedia).
 *
 * Alur:
 * - Route handler: checkRole(user, "ADMINISTRATOR", "KEPALA_SEKOLAH")
 * - Jika lolos: lanjut ke logic handler.
 * - Jika tidak: HTTP 403 Forbidden.
 */

import { ForbiddenError } from "../common/error";
import logger from "../lib/logger";

/**
 * Memvalidasi apakah user memiliki salah satu role yang diizinkan.
 * @param user - Objek user dari context (hasil requireAuth) — bisa undefined jika belum login.
 * @param roles - Satu atau lebih role yang diizinkan mengakses resource.
 * @throws ForbiddenError jika user tidak memiliki role yang sesuai.
 */
export function checkRole(user: { role: string } | undefined, ...roles: string[]) {
  // Cek apakah user ada dan role-nya termasuk dalam daftar yang diizinkan
  if (!user || !roles.includes(user.role)) {
    logger.warn(
      { userRole: user?.role, requiredRoles: roles },
      "Role check failed — user does not have required role"
    );
    throw new ForbiddenError(`Requires one of roles: ${roles.join(", ")}`);
  }

  logger.debug({ userRole: user.role, requiredRoles: roles }, "Role check passed");
}

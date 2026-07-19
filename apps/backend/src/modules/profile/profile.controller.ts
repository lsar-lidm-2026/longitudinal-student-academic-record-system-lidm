/**
 * Profile Controller — Profil dan Timeline Siswa
 * ===============================================
 *
 * Cara Kerja:
 * 1. Menyediakan endpoint GET untuk profil dan timeline siswa:
 *    - GET /students/:id/profile → data lengkap siswa + semua semester record
 *    - GET /students/:id/timeline → daftar kronologis semester
 * 2. Kedua endpoint dilindungi oleh middleware requireAuth + requireHomeroomAccess.
 * 3. Mendelegasikan logika ke profile.service.ts.
 *
 * Alur:
 * 1. Client mengirim request GET ke /students/:id/profile atau /students/:id/timeline.
 * 2. Middleware requireAuth memverifikasi JWT token.
 * 3. Middleware requireHomeroomAccess memverifikasi akses wali kelas ke siswa.
 * 4. Controller memanggil service yang sesuai (getStudentProfile / getTimeline).
 * 5. Mengembalikan response sukses dengan data yang diminta.
 */

import { Elysia } from "elysia";
import logger from "../../lib/logger";
import * as service from "./profile.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { requireHomeroomAccess } from "../../middleware/homeroom";

/**
 * profileController — Elysia route group untuk prefix /students.
 * Menyediakan data profil dan timeline siswa untuk wali kelas.
 */
export const profileController = new Elysia({ prefix: "/students" })
  .guard({}, (app) =>
    app
      // Middleware: autentikasi JWT
      .use(requireAuth)
      // Middleware: akses wali kelas — memastikan user adalah wali kelas siswa
      .use(requireHomeroomAccess)
      // GET /students/:id/profile — Ambil profil lengkap siswa
      .get("/:id/profile", async ({ params }) => {
        // params.id — ID siswa yang akan diambil profilnya
        logger.info({ studentId: params.id }, "Fetching student profile");
        const data = await service.getStudentProfile(params.id);
        logger.info({ studentId: params.id, semesterRecordCount: data.semesterRecords.length }, "Student profile fetched successfully");
        return success(data);
      })
      // GET /students/:id/timeline — Ambil kronologi semester siswa
      .get("/:id/timeline", async ({ params }) => {
        // params.id — ID siswa yang akan diambil timeline-nya
        logger.info({ studentId: params.id }, "Fetching student timeline");
        const data = await service.getTimeline(params.id);
        logger.info({ studentId: params.id, recordCount: data.length }, "Student timeline fetched successfully");
        return success(data);
      })
  );

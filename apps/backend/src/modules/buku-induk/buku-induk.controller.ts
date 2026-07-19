/**
 * Buku Induk Controller — Preview, Validasi, dan Workspace Administratif
 * ======================================================================
 *
 * Cara Kerja:
 * 1. Menyediakan endpoint GET untuk data administrasi Buku Induk siswa:
 *    - GET /students/:id/buku-induk-preview → pratinjau data buku induk
 *    - GET /students/:id/validation-status → status kelengkapan data per semester
 *    - GET /students/:id/administrative-workspace → gabungan preview + validation
 * 2. Semua endpoint dilindungi oleh middleware requireAuth + requireHomeroomAccess.
 * 3. Mendelegasikan logika ke buku-induk.service.ts.
 *
 * Alur:
 * 1. Client mengirim request GET ke endpoint yang sesuai.
 * 2. Middleware requireAuth memverifikasi JWT token.
 * 3. Middleware requireHomeroomAccess memverifikasi akses wali kelas.
 * 4. Controller memanggil service yang sesuai.
 * 5. Mengembalikan response sukses.
 */

import { Elysia } from "elysia";
import logger from "../../lib/logger";
import * as service from "./buku-induk.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { requireHomeroomAccess } from "../../middleware/homeroom";

/**
 * bukuIndukController — Elysia route group untuk prefix /students.
 * Menyediakan data untuk keperluan Buku Induk dan administrasi siswa.
 */
export const bukuIndukController = new Elysia({ prefix: "/students" })
  .guard({}, (app) =>
    app
      // Middleware: autentikasi JWT
      .use(requireAuth)
      // Middleware: akses wali kelas — memastikan user adalah wali kelas siswa
      .use(requireHomeroomAccess)
      // GET /students/:id/administrative-workspace — Gabungan preview + validation status
      .get("/:id/administrative-workspace", async ({ params }) => {
        // params.id — ID siswa yang akan diambil data administrasinya
        logger.info({ studentId: params.id }, "Fetching administrative workspace");
        const data = await service.getWorkspace(params.id);
        logger.info({ studentId: params.id }, "Administrative workspace fetched successfully");
        return success(data);
      })
      // GET /students/:id/validation-status — Status kelengkapan data per semester
      .get("/:id/validation-status", async ({ params }) => {
        // params.id — ID siswa yang akan dicek validasi datanya
        logger.info({ studentId: params.id }, "Fetching validation status");
        const data = await service.getValidationStatus(params.id);
        logger.info({ studentId: params.id, recordCount: data.length }, "Validation status fetched successfully");
        return success(data);
      })
      // GET /students/:id/buku-induk-preview — Pratinjau data buku induk siswa
      .get("/:id/buku-induk-preview", async ({ params }) => {
        // params.id — ID siswa yang akan diambil preview buku induknya
        logger.info({ studentId: params.id }, "Fetching buku induk preview");
        const data = await service.getPreview(params.id);
        logger.info({ studentId: params.id }, "Buku induk preview fetched successfully");
        return success(data);
      })
  );

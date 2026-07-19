/**
 * Upload Controller — REST endpoints untuk upload file ke S3.
 * =============================================================
 *
 * Cara Kerja:
 * 1. Semua endpoint dilindungi oleh middleware `requireAuth` (JWT) — user harus login.
 * 2. Setiap endpoint menerima multipart/form-data melalui `request.formData()`.
 * 3. File divalidasi di service layer (tipe, ukuran), kemudian di-upload ke S3.
 * 4. Prisma record di-update dengan URL hasil upload dari S3.
 * 5. Response dikembalikan dalam format standar `{ success, data }`.
 *
 * Alur Lengkap:
 * 1. Client mengirim HTTP request (POST/GET/DELETE) ke endpoint upload.
 * 2. Middleware `requireAuth` memverifikasi JWT token dari header Authorization.
 * 3. Handler membaca file dari form-data request.
 * 4. File diteruskan ke fungsi service yang sesuai (uploadStudentPhoto, dll).
 * 5. Service memvalidasi file, upload ke S3, update database, return URL.
 * 6. Controller mengembalikan response success/error dalam format standar.
 *
 * Endpoints:
 * - POST   /upload/students/:id/photo        — Upload foto profil siswa
 * - POST   /upload/achievements/:id/attachment — Upload lampiran prestasi
 * - POST   /upload/students/:id/documents    — Upload dokumen siswa (akte, KK, dll)
 * - GET    /upload/students/:id/documents    — Lihat daftar dokumen siswa
 * - DELETE /upload/documents/:id             — Hapus dokumen siswa
 */
import { Elysia, t } from "elysia";               // Elysia web framework + validation
import { requireAuth } from "../../middleware/auth"; // JWT auth middleware
import { success, error as errorResponse } from "../../common/response"; // Standar response formatter
import { NotFoundError, ValidationError } from "../../common/error";
import {
  uploadStudentPhoto,
  uploadAchievementAttachment,
  uploadStudentDocument,
  deleteStudentDocument,
} from "./upload.service";                          // Upload business logic functions
import type { JwtPayload } from "../../common/types"; // JWT payload type definition
import logger from "../../lib/logger";              // Pino logger instance
import fs from "fs/promises";                      // File system operations
import { env } from "../../config/env";             // Environment configuration
import { prisma } from "../../lib/prisma";          // Prisma client for DB queries

/**
 * UploadController — instance Elysia dengan prefix "/upload".
 *
 * Semua route di grup ini membutuhkan autentikasi JWT.
 * Menggunakan `requireAuth` plugin yang memvalidasi token dan menyisipkan `user` ke context.
 */
export const uploadController = new Elysia({ prefix: "/upload" })
  .use(requireAuth)

  // ── Profile Photo (Logged-in User) ────────────────────────────────
  /**
   * POST /upload/profile/photo
   *
   * Upload foto profil user yang sedang login.
   * Menerima multipart/form-data dengan field `file` (tipe image: jpeg/png/webp).
   * File disimpan di {modelPath}/profiles/.
   * Rute ini HARUS sebelum /:id/photo untuk menghindari konflik path.
   *
   * @param body.file - File gambar (max 2MB)
   * @returns - { photoUrl }
   */
  .post(
    "/profile/photo",
    async ({ body, user, set }) => {
      logger.info({ userId: user.userId }, "Upload controller: profile photo upload started");
      try {
        const file = body.file;
        if (!file || file.size === 0) {
          set.status = 400;
          return errorResponse("VALIDATION_ERROR", "File tidak ditemukan");
        }

        // Validasi tipe file — hanya gambar yang diizinkan
        if (!file.type?.startsWith("image/")) {
          set.status = 400;
          return errorResponse("VALIDATION_ERROR", "File harus berupa gambar (JPEG, PNG, WebP)");
        }

        // Validasi ukuran (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
          set.status = 400;
          return errorResponse("VALIDATION_ERROR", "Ukuran file maksimal 2MB");
        }

        // Generate filename unik
        const ext = file.name?.split(".").pop() || "jpg";
        const filename = `profile-${user.userId}.${ext}`;
        const uploadDir = `${env.modelPath}/profiles`;

        // Buat direktori jika belum ada
        await fs.mkdir(uploadDir, { recursive: true });

        // Simpan file ke disk
        const buffer = await file.arrayBuffer();
        await fs.writeFile(`${uploadDir}/${filename}`, Buffer.from(buffer));

        const photoUrl = `/uploads/profiles/${filename}`;
        logger.info({ userId: user.userId, photoUrl }, "Upload controller: profile photo uploaded successfully");
        return success({ photoUrl });
      } catch (e: any) {
        logger.error({ err: e, userId: user.userId }, "Upload controller: profile photo upload failed");
        set.status = e.statusCode || 500;
        return errorResponse(e.code || "UPLOAD_ERROR", e.message);
      }
    },
    {
      body: t.Object({ file: t.File() }),
    }
  )

  // ── Student Photo ────────────────────────────────────────────────
  /**
   * POST /upload/students/:id/photo
   *
   * Upload foto profil siswa.
   * Menerima multipart/form-data dengan field `file` (tipe image: jpeg/png/webp/gif).
   * Akan menghapus foto lama jika sudah ada.
   *
   * @param params.id - UUID siswa
   * @param request   - Request object (untuk mengambil form-data)
   * @param set       - Elysia Set object (untuk mengatur status code)
   * @returns         - { url, key, mimeType, fileSize }
   */
  .post(
    "/students/:id/photo",
    async ({ params, request, set }) => {
      // Destructure parameter untuk akses langsung
      logger.info({ studentId: params.id }, "Upload controller: student photo upload started");
      try {
        // Parse multipart/form-data dari request body
        const formData = await request.formData();
        // Ambil file dari field "file"
        const file = formData.get("file") as File | null;
        if (!file) {
          // Jika file tidak ada, set status 400 dan return error
          logger.warn({ studentId: params.id }, "Upload controller: no file provided for student photo");
          set.status = 400;
          return errorResponse("VALIDATION_ERROR", "File tidak ditemukan");
        }
        // Delegasikan ke service untuk upload ke S3 dan update database
        const result = await uploadStudentPhoto(params.id, file);
        logger.info({ studentId: params.id, url: result.url }, "Upload controller: student photo uploaded successfully");
        return success(result);
      } catch (e: any) {
        // Tangkap error dari service layer (NotFoundError, ValidationError, dll)
        logger.error({ err: e, studentId: params.id }, "Upload controller: student photo upload failed");
        set.status = e.statusCode || 400;
        return errorResponse(e.code || "UPLOAD_ERROR", e.message);
      }
    },
    {
      // Validasi parameter path menggunakan Elysia t.Object
      params: t.Object({ id: t.String() }),
    }
  )

  // ── Achievement Attachment ───────────────────────────────────────
  /**
   * POST /upload/achievements/:id/attachment
   *
   * Upload lampiran prestasi siswa.
   * Menerima multipart/form-data dengan field `file` (tipe: pdf/doc/docx/image).
   * Akan menghapus lampiran lama jika sudah ada.
   *
   * @param params.id - UUID achievement
   * @param request   - Request object (untuk mengambil form-data)
   * @param set       - Elysia Set object (untuk mengatur status code)
   * @returns         - { url, key, mimeType, fileSize }
   */
  .post(
    "/achievements/:id/attachment",
    async ({ params, request, set }) => {
      logger.info({ achievementId: params.id }, "Upload controller: achievement attachment upload started");
      try {
        // Parse multipart/form-data dari request body
        const formData = await request.formData();
        // Ambil file dari field "file"
        const file = formData.get("file") as File | null;
        if (!file) {
          // Jika file tidak ada, set status 400 dan return error
          logger.warn({ achievementId: params.id }, "Upload controller: no file provided for achievement attachment");
          set.status = 400;
          return errorResponse("VALIDATION_ERROR", "File tidak ditemukan");
        }
        // Delegasikan ke service untuk upload ke S3 dan update database
        const result = await uploadAchievementAttachment(params.id, file);
        logger.info({ achievementId: params.id, url: result.url }, "Upload controller: achievement attachment uploaded successfully");
        return success(result);
      } catch (e: any) {
        // Tangkap error dari service layer
        logger.error({ err: e, achievementId: params.id }, "Upload controller: achievement attachment upload failed");
        set.status = e.statusCode || 400;
        return errorResponse(e.code || "UPLOAD_ERROR", e.message);
      }
    },
    {
      // Validasi parameter path menggunakan Elysia t.Object
      params: t.Object({ id: t.String() }),
    }
  )

  // ── Student Document ─────────────────────────────────────────────
  /**
   * POST /upload/students/:id/documents
   *
   * Upload dokumen siswa (akte kelahiran, KK, ijazah, dll).
   * Menerima multipart/form-data dengan field `file` dan `name` (nama dokumen).
   *
   * @param params.id - UUID siswa
   * @param request   - Request object (untuk mengambil form-data)
   * @param set       - Elysia Set object (untuk mengatur status code)
   * @returns         - { url, key, mimeType, fileSize }
   */
  .post(
    "/students/:id/documents",
    async ({ params, request, set }) => {
      logger.info({ studentId: params.id }, "Upload controller: student document upload started");
      try {
        // Parse multipart/form-data dari request body
        const formData = await request.formData();
        // Ambil file dari field "file"
        const file = formData.get("file") as File | null;
        // Ambil nama dokumen dari field "name" (misal: "Akte Kelahiran")
        const name = formData.get("name") as string | null;
        if (!file || !name) {
          // Jika file atau nama tidak ada, set status 400 dan return error
          logger.warn({ studentId: params.id, hasFile: !!file, hasName: !!name }, "Upload controller: missing file or document name");
          set.status = 400;
          return errorResponse("VALIDATION_ERROR", "File dan nama dokumen wajib diisi");
        }
        // Delegasikan ke service untuk upload ke S3 dan simpan record di StudentDocument
        const result = await uploadStudentDocument(params.id, file, name);
        logger.info({ studentId: params.id, documentName: name, url: result.url }, "Upload controller: student document uploaded successfully");
        return success(result);
      } catch (e: any) {
        // Tangkap error dari service layer
        logger.error({ err: e, studentId: params.id }, "Upload controller: student document upload failed");
        set.status = e.statusCode || 400;
        return errorResponse(e.code || "UPLOAD_ERROR", e.message);
      }
    },
    {
      // Validasi parameter path menggunakan Elysia t.Object
      params: t.Object({ id: t.String() }),
    }
  )

  // ── List Student Documents ───────────────────────────────────────
  /**
   * GET /upload/students/:id/documents
   *
   * Mengambil daftar semua dokumen milik seorang siswa, diurutkan dari yang terbaru.
   * Tidak memerlukan file upload — hanya membaca data dari database.
   *
   * @param params.id - UUID siswa
   * @returns         - Array StudentDocument[]
   */
  .get(
    "/students/:id/documents",
    async ({ params }) => {
      logger.info({ studentId: params.id }, "Upload controller: listing student documents");
      // Dynamic import prisma untuk menghindari circular dependency (jarang diperlukan)
      const { prisma } = await import("../../lib/prisma");
      // Cari semua dokumen milik siswa, urutkan dari yang terbaru
      const docs = await prisma.studentDocument.findMany({
        where: { studentId: params.id },
        orderBy: { createdAt: "desc" },
      });
      logger.info({ studentId: params.id, count: docs.length }, "Upload controller: student documents listed");
      return success(docs);
    },
    {
      // Validasi parameter path menggunakan Elysia t.Object
      params: t.Object({ id: t.String() }),
    }
  )

  // ── Delete Student Document ──────────────────────────────────────
  /**
   * DELETE /upload/documents/:id
   *
   * Menghapus dokumen siswa berdasarkan ID dokumen.
   * Juga menghapus file dari S3.
   *
   * @param params.id - UUID dokumen (StudentDocument)
   * @param set       - Elysia Set object (untuk mengatur status code)
   * @returns         - { message: "Dokumen berhasil dihapus" }
   */
  .delete(
    "/documents/:id",
    async ({ params, set }) => {
      logger.info({ documentId: params.id }, "Upload controller: student document deletion started");
      try {
        // Delegasikan ke service untuk hapus dari S3 dan database
        await deleteStudentDocument(params.id);
        logger.info({ documentId: params.id }, "Upload controller: student document deleted successfully");
        return success({ message: "Dokumen berhasil dihapus" });
      } catch (e: any) {
        // Tangkap error dari service layer (NotFoundError, dll)
        logger.error({ err: e, documentId: params.id }, "Upload controller: student document deletion failed");
        set.status = e.statusCode || 400;
        return errorResponse(e.code || "DELETE_ERROR", e.message);
      }
    },
    {
      // Validasi parameter path menggunakan Elysia t.Object
      params: t.Object({ id: t.String() }),
    }
  )

  // ── Update Student Document ──────────────────────────────────────
  /**
   * PUT /upload/documents/:id
   *
   * Memperbarui nama dokumen siswa.
   *
   * @param params.id - UUID dokumen (StudentDocument)
   * @param body.name - Nama dokumen yang baru
   * @returns         - StudentDocument yang sudah diupdate
   */
  .put(
    "/documents/:id",
    async ({ params, body }) => {
      logger.info({ documentId: params.id, newName: body.name }, "PUT document");
      const doc = await prisma.studentDocument.findUnique({ where: { id: params.id } });
      if (!doc) throw new NotFoundError("Dokumen tidak ditemukan");
      const updated = await prisma.studentDocument.update({
        where: { id: params.id },
        data: { name: body.name },
      });
      return success(updated);
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
      }),
    }
  );

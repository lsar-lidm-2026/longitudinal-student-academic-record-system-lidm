/**
 * Upload Controller — REST endpoints untuk upload file ke S3.
 *
 * Semua endpoint menerima multipart/form-data dengan field `file`.
 */
import { Elysia, t } from "elysia";
import { requireAuth } from "../../middleware/auth";
import { requireHomeroomAccess } from "../../middleware/homeroom";
import { success, error as errorResponse } from "../../common/response";
import {
  uploadStudentPhoto,
  uploadAchievementAttachment,
  uploadStudentDocument,
  deleteStudentDocument,
} from "./upload.service";
import type { JwtPayload } from "../../common/types";

export const uploadController = new Elysia({ prefix: "/upload" })
  .use(requireAuth)

  // ── Student Photo ────────────────────────────────────────────────
  .post(
    "/students/:id/photo",
    async ({ params, request, set }) => {
      try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        if (!file) {
          set.status = 400;
          return errorResponse("VALIDATION_ERROR", "File tidak ditemukan");
        }
        const result = await uploadStudentPhoto(params.id, file);
        return success(result);
      } catch (e: any) {
        set.status = e.statusCode || 400;
        return errorResponse(e.code || "UPLOAD_ERROR", e.message);
      }
    },
    {
      params: t.Object({ id: t.String() }),
    }
  )

  // ── Achievement Attachment ───────────────────────────────────────
  .post(
    "/achievements/:id/attachment",
    async ({ params, request, set }) => {
      try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        if (!file) {
          set.status = 400;
          return errorResponse("VALIDATION_ERROR", "File tidak ditemukan");
        }
        const result = await uploadAchievementAttachment(params.id, file);
        return success(result);
      } catch (e: any) {
        set.status = e.statusCode || 400;
        return errorResponse(e.code || "UPLOAD_ERROR", e.message);
      }
    },
    {
      params: t.Object({ id: t.String() }),
    }
  )

  // ── Student Document ─────────────────────────────────────────────
  .post(
    "/students/:id/documents",
    async ({ params, request, set }) => {
      try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const name = formData.get("name") as string | null;
        if (!file || !name) {
          set.status = 400;
          return errorResponse("VALIDATION_ERROR", "File dan nama dokumen wajib diisi");
        }
        const result = await uploadStudentDocument(params.id, file, name);
        return success(result);
      } catch (e: any) {
        set.status = e.statusCode || 400;
        return errorResponse(e.code || "UPLOAD_ERROR", e.message);
      }
    },
    {
      params: t.Object({ id: t.String() }),
    }
  )

  // ── List Student Documents ───────────────────────────────────────
  .get(
    "/students/:id/documents",
    async ({ params }) => {
      const { prisma } = await import("../../lib/prisma");
      const docs = await prisma.studentDocument.findMany({
        where: { studentId: params.id },
        orderBy: { createdAt: "desc" },
      });
      return success(docs);
    },
    {
      params: t.Object({ id: t.String() }),
    }
  )

  // ── Delete Student Document ──────────────────────────────────────
  .delete(
    "/documents/:id",
    async ({ params, set }) => {
      try {
        await deleteStudentDocument(params.id);
        return success({ message: "Dokumen berhasil dihapus" });
      } catch (e: any) {
        set.status = e.statusCode || 400;
        return errorResponse(e.code || "DELETE_ERROR", e.message);
      }
    },
    {
      params: t.Object({ id: t.String() }),
    }
  );

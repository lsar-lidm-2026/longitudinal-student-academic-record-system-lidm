/**
 * STUDENT CONTROLLER
 * ==================
 *
 * Cara kerja file ini:
 * Controller ini mendefinisikan route Elysia untuk CRUD resource Student
 * dengan prefix "/students". Semua endpoint memerlukan autentikasi JWT (requireAuth).
 *
 * Alur lengkap:
 * 1. GET /students
 *    - checkRole (min GURU) untuk memverifikasi hak akses
 *    - service.list() untuk query database dengan filter & pagination
 *    - return paginated response { data, page, limit, total }
 *
 * 2. POST /students
 *    - checkRole (OPERATOR_SEKOLAH) — hanya operator yang bisa membuat siswa
 *    - Validasi body request (nis, nisn, name, gender, classId)
 *    - service.create() untuk insert ke database
 *    - return success response dengan data siswa baru
 *
 * 3. POST /students/bulk
 *    - checkRole (ADMINISTRATOR, OPERATOR_SEKOLAH)
 *    - bulkImportService.importStudents() — validasi per-entry + insert transaksional
 *    - return { imported: number, errors: { index, message }[] }
 *
 * 4. PUT /students/:id
 *    - requireHomeroomAccess guard — guru hanya bisa akses siswa di kelas walinya
 *    - checkRole (OPERATOR_SEKOLAH)
 *    - service.update() untuk update field parsial
 *    - return success response dengan data yang diupdate
 *
 * 5. GET /students/:id
 *    - requireHomeroomAccess guard
 *    - checkRole (min GURU)
 *    - service.getById() — throw NotFoundError jika tidak ditemukan
 *    - return success response dengan detail siswa
 */

import { Elysia, t } from "elysia";
import * as service from "./student.service";
import * as bulkImportService from "./bulk-import.service";
import { success, paginated } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { requireHomeroomAccess } from "../../middleware/homeroom";
import { checkRole } from "../../middleware/role";
import logger from "../../lib/logger";

export const studentController = new Elysia({ prefix: "/students" })
  // Auth middleware applied globally for all routes in this controller
  .use(requireAuth)
  // GET / — list all students with optional filters & pagination
  .get("/", async ({ query, user }) => {
    // Verify user has at minimum GURU role to access student list
    checkRole(user, "ADMINISTRATOR", "OPERATOR_SEKOLAH", "KEPALA_SEKOLAH", "GURU");
    logger.info({ userId: user.userId, query }, "Listing students");
    // Delegate to service layer for filtering & pagination logic
    const result = await service.list(query);
    logger.info({ total: result.total, page: result.page, limit: result.limit }, "Students listed successfully");
    // Return paginated response with data, page, limit, total
    return paginated(result.data, result.page, result.limit, result.total);
  })
  // POST / — create a new student (operator only)
  .post(
    "/",
    async ({ body, user }) => {
      // Only OPERATOR_SEKOLAH is allowed to create students
      checkRole(user, "OPERATOR_SEKOLAH");
      logger.info({ userId: user.userId, body }, "Creating student");
      // Delegate to service for validation & DB insert
      const data = await service.create(body);
      logger.info({ studentId: data.id }, "Student created successfully");
      return success(data);
    },
      {
        // Request body validation schema: required + optional fields for student creation
        body: t.Object({
          nis: t.String(),
          nisn: t.String(),
          name: t.String(),
          gender: t.String(),
          classId: t.String(),
          birthDate: t.Optional(t.String()),   // Format: YYYY-MM-DD — FR-04
          address: t.Optional(t.String()),     // Alamat domisili — FR-04
          parentName: t.Optional(t.String()),  // Nama orang tua/wali — FR-04
        }),
      }
  )
  // ── POST /students/bulk — Import siswa secara massal ────────────────────
  .post(
    "/bulk",
    async ({ body, user }) => {
      // Hanya ADMINISTRATOR dan OPERATOR_SEKOLAH yang bisa import massal
      checkRole(user, "ADMINISTRATOR", "OPERATOR_SEKOLAH");
      logger.info({ userId: user.userId, count: body.students?.length }, "Bulk import started");

      // Delegasikan ke bulkImportService untuk validasi dan insert transaksional
      const result = await bulkImportService.importStudents(body.students);

      logger.info(
        { imported: result.imported, errors: result.errors.length, userId: user.userId },
        "Bulk import completed"
      );

      // Log setiap error individual untuk audit trail dan debugging
      for (const err of result.errors) {
        logger.warn({ index: err.index, message: err.message }, "Bulk import entry error");
      }

      return success(result);
    },
    {
      // Validasi body: array of students dengan field yang sama seperti create individual
      body: t.Object({
        students: t.Array(
          t.Object({
            name: t.String(),
            nis: t.String(),
            nisn: t.String(),
            gender: t.String(),
            classId: t.String(),
            birthDate: t.Optional(t.String()),   // Format: YYYY-MM-DD — FR-04
            address: t.Optional(t.String()),     // Alamat domisili — FR-04
            parentName: t.Optional(t.String()),  // Nama orang tua/wali — FR-04
          })
        ),
      }),
    }
  )
  // Guard: semua route di dalam blok ini memerlukan akses homeroom (wali kelas)
  .guard({}, (app) =>
    app
      .use(requireHomeroomAccess)
      // PUT /:id — update student data (operator only)
      .put(
        "/:id",
        async ({ params, body, user }) => {
          // Only OPERATOR_SEKOLAH is allowed to update students
          checkRole(user, "OPERATOR_SEKOLAH");
          logger.info({ userId: user.userId, studentId: params.id, body }, "Updating student");
          // Delegate to service for field-level update
          const data = await service.update(params.id, body);
          logger.info({ studentId: data.id }, "Student updated successfully");
          return success(data);
        },
        {
          // Request body validation schema: all fields optional for partial update
          body: t.Object({
            nis: t.Optional(t.String()),
            nisn: t.Optional(t.String()),
            name: t.Optional(t.String()),
            gender: t.Optional(t.String()),
            classId: t.Optional(t.String()),
            birthDate: t.Optional(t.String()),   // Format: YYYY-MM-DD — FR-04
            address: t.Optional(t.String()),     // Alamat domisili — FR-04
            parentName: t.Optional(t.String()),  // Nama orang tua/wali — FR-04
          }),
        }
      )
      // GET /:id — get single student by ID (accessible by all roles)
      .get("/:id", async ({ params, user }) => {
        // Any authenticated user with sufficient role can view student details
        checkRole(user, "ADMINISTRATOR", "OPERATOR_SEKOLAH", "GURU", "KEPALA_SEKOLAH");
        logger.info({ userId: user.userId, studentId: params.id }, "Getting student by ID");
        // Delegate to service which throws NotFoundError if missing
        const data = await service.getById(params.id);
        logger.info({ studentId: data.id }, "Student retrieved successfully");
        return success(data);
      })
  );

/**
 * SEMESTER RECORD CONTROLLER
 * ==========================
 *
 * Cara kerja file ini:
 * Controller ini mendefinisikan route Elysia untuk resource SemesterRecord
 * beserta sub-resources-nya (SubjectScore, Attendance, Achievement, HealthRecord).
 * Terdapat dua controller yang diekspor:
 *   - semesterRecordController  → prefix "/students" (nested di bawah student)
 *   - semesterRecordSubController → prefix "/semester-records" (langsung)
 *
 * Alur lengkap semesterRecordController (prefix: /students):
 * 1. POST /:id/semester-records
 *    - requireAuth + requireHomeroomAccess
 *    - service.create() dengan studentId + academicYearId + semester + createdById
 *    - Cek duplikat (studentId + academicYearId + semester unique)
 *    - Return success dengan data termasuk relasi
 *
 * 2. GET /:id/semester-records
 *    - service.listByStudent() → return semua semester record siswa
 *
 * 3. GET /:id/semester-records/:recordId
 *    - service.getById() → detail satu record dengan semua relasi
 *
 * 4. PUT /:id/semester-records/:recordId
 *    - service.update() → update academicYearId dan/atau semester
 *
 * 5. DELETE /:id/semester-records/:recordId
 *    - service.deleteRecord() → hapus record + semua sub-data dalam transaksi
 *
 * Alur lengkap semesterRecordSubController (prefix: /semester-records):
 * 1. PUT /:id/subject-scores           → subjectScoreService.upsert()
 * 2. PUT /:id/subject-scores/batch     → subjectScoreService.batchUpsert()
 * 3. PUT /:id/subject-scores/:scoreId   → subjectScoreService.update()
 * 4. DELETE /:id/subject-scores/:scoreId → subjectScoreService.remove()
 * 5. PUT /:id/attendance               → attendanceService.upsert()
 * 6. POST /:id/achievements            → achievementService.create()
 * 7. PUT /achievements/:achievementId   → achievementService.update()
 * 8. DELETE /achievements/:achievementId → achievementService.remove()
 * 9. PUT /:id/health-record            → healthRecordService.upsert()
 *
 * Semua endpoint menggunakan requireAuth + requireHomeroomAccess.
 */

import { Elysia, t } from "elysia";
import * as service from "./semester-record.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { requireHomeroomAccess } from "../../middleware/homeroom";
import { checkRole } from "../../middleware/role";
import logger from "../../lib/logger";

/**
 * Controller untuk CRUD SemesterRecord yang nested di bawah resource Student.
 * Prefix: /students — endpoint pattern: /students/:id/semester-records
 */
export const semesterRecordController = new Elysia({ prefix: "/students" })
  .guard({}, (app) =>
    app
      // Auth + homeroom access applied to all routes in this guard
      .use(requireAuth)
      .use(requireHomeroomAccess)
      // POST /students/:id/semester-records — create a new semester record
      .post(
        "/:id/semester-records",
        async ({ params, body, user }) => {
          logger.info({ userId: user.userId, studentId: params.id, body }, "Creating semester record");
          // Merge route params + body + user info for service layer
          const data = await service.create({
            ...body,
            studentId: params.id,
            createdById: user.userId,
          });
          logger.info({ recordId: data.id, studentId: params.id }, "Semester record created");
          return success(data);
        },
        {
          // Validation: academicYearId is required, semester must be 1 or 2
          body: t.Object({
            academicYearId: t.String(),
            semester: t.Number({ minimum: 1, maximum: 2 }),
          }),
        }
      )
      // GET /students/:id/semester-records — list all records for a student
      .get("/:id/semester-records", async ({ params, user }) => {
        logger.info({ userId: user.userId, studentId: params.id }, "Listing semester records by student");
        const data = await service.listByStudent(params.id);
        logger.info({ studentId: params.id, count: data.length }, "Semester records listed");
        return success(data);
      })
      // GET /students/:id/semester-records/:recordId — get single record detail
      .get("/:id/semester-records/:recordId", async ({ params, user }) => {
        logger.info({ userId: user.userId, recordId: params.recordId }, "Getting semester record by ID");
        const data = await service.getById(params.recordId);
        logger.info({ recordId: params.recordId }, "Semester record retrieved");
        return success(data);
      })
      // PUT /students/:id/semester-records/:recordId — update semester record metadata
      .put(
        "/:id/semester-records/:recordId",
        async ({ params, body, user }) => {
          logger.info({ userId: user.userId, recordId: params.recordId, body }, "Updating semester record");
          const data = await service.update(params.recordId, body);
          logger.info({ recordId: params.recordId }, "Semester record updated");
          return success(data);
        },
        {
          // All fields optional for partial update
          body: t.Object({
            academicYearId: t.Optional(t.String()),
            semester: t.Optional(t.Number({ minimum: 1, maximum: 2 })),
          }),
        }
      )
      // DELETE /students/:id/semester-records/:recordId — delete record + all related data (hanya ADMIN/OPERATOR)
      .delete("/:id/semester-records/:recordId", async ({ params, user }) => {
        logger.info({ userId: user.userId, recordId: params.recordId }, "Deleting semester record");
        checkRole(user, "ADMINISTRATOR", "OPERATOR_SEKOLAH");
        // Cascading delete handled inside service via Prisma transaction
        await service.deleteRecord(params.recordId);
        logger.info({ recordId: params.recordId }, "Semester record deleted");
        return success({ deleted: true });
      })
  );

// Sub-resources under /semester-records/:id
import * as subjectScoreService from "../subject-scores/subject-score.service";
import * as attendanceService from "../attendance/attendance.service";
import * as achievementService from "../achievements/achievement.service";
import * as healthRecordService from "../health-records/health-record.service";

/**
 * Controller untuk sub-resources dari SemesterRecord (SubjectScore, Attendance, dll).
 * Prefix: /semester-records — endpoint pattern: /semester-records/:id/{sub-resource}
 */
export const semesterRecordSubController = new Elysia({ prefix: "/semester-records" })
  // Bootstrap route needs requireAuth but NOT requireHomeroomAccess (uses classId, not studentId)
  .use(requireAuth)
  .post(
    "/classes/:classId/bootstrap",
    async ({ params, body, user }) => {
      logger.info({ classId: params.classId }, "POST /classes/:classId/bootstrap called");
      const result = await service.bootstrapClassSemester(
        params.classId,
        body.academicYearId,
        body.semester,
        user.userId,
      );
      return success(result);
    },
    {
      body: t.Object({
        academicYearId: t.String(),
        semester: t.Number(),
      }),
    },
  )
  .guard({}, (app) =>
    app
      .use(requireHomeroomAccess)

      // GET /semester-records/:id — get single semester record by ID with all sub-resources
      .get(
        "/:id",
        async ({ params }) => {
          logger.info({ recordId: params.id }, "Getting semester record by ID");
          const data = await service.getById(params.id);
          logger.info({ recordId: params.id }, "Semester record fetched successfully");
          return success(data);
        }
      )

      // ===================== Subject Scores =====================
      // PUT /semester-records/:id/subject-scores — upsert a single subject score
      .put(
        "/:id/subject-scores",
        async ({ params, body, user }) => {
          logger.info({ userId: user.userId, recordId: params.id, body }, "Upserting subject score");
          const data = await subjectScoreService.upsert(params.id, body);
          logger.info({ recordId: params.id, subjectName: data.subjectName }, "Subject score upserted");
          return success(data);
        },
        {
          // SubjectName + scores required; notes optional
          body: t.Object({
            subjectName: t.String(),
            knowledgeScore: t.Number(),
            skillsScore: t.Number(),
            notes: t.Optional(t.String()),
          }),
        }
      )
      // PUT /semester-records/:id/subject-scores/batch — batch upsert multiple scores
      .put(
        "/:id/subject-scores/batch",
        async ({ params, body, user }) => {
          logger.info({ userId: user.userId, recordId: params.id, scoreCount: body.scores.length }, "Batch upserting subject scores");
          const data = await subjectScoreService.batchUpsert(params.id, body.scores);
          logger.info({ recordId: params.id, count: data.length }, "Subject scores batch upserted");
          return success(data);
        },
        {
          // Array of subject scores to upsert in a transaction
          body: t.Object({
            scores: t.Array(
              t.Object({
                subjectName: t.String(),
                knowledgeScore: t.Number(),
                skillsScore: t.Number(),
                notes: t.Optional(t.String()),
              })
            ),
          }),
        }
      )
      // PUT /semester-records/:id/subject-scores/:scoreId — update existing score by ID
      .put(
        "/:id/subject-scores/:scoreId",
        async ({ params, body, user }) => {
          logger.info({ userId: user.userId, scoreId: params.scoreId, body }, "Updating subject score");
          const data = await subjectScoreService.update(params.scoreId, body);
          logger.info({ scoreId: params.scoreId }, "Subject score updated");
          return success(data);
        },
        {
          // All fields optional for partial update
          body: t.Object({
            subjectName: t.Optional(t.String()),
            knowledgeScore: t.Optional(t.Number()),
            skillsScore: t.Optional(t.Number()),
            notes: t.Optional(t.String()),
          }),
        }
      )
      // DELETE /semester-records/:id/subject-scores/:scoreId — remove a subject score
      .delete("/:id/subject-scores/:scoreId", async ({ params, user }) => {
        logger.info({ userId: user.userId, scoreId: params.scoreId }, "Deleting subject score");
        await subjectScoreService.remove(params.scoreId);
        logger.info({ scoreId: params.scoreId }, "Subject score deleted");
        return success({ deleted: true });
      })

      // ===================== Attendance (upsert) =====================
      // PUT /semester-records/:id/attendance — upsert attendance data (1:1)
      .put(
        "/:id/attendance",
        async ({ params, body, user }) => {
          logger.info({ userId: user.userId, recordId: params.id, body }, "Upserting attendance");
          const data = await attendanceService.upsert(params.id, body);
          logger.info({ recordId: params.id }, "Attendance upserted");
          return success(data);
        },
        {
          // Attendance counts: sick, permission, absent — all non-negative
          body: t.Object({
            sick: t.Number({ minimum: 0 }),
            permission: t.Number({ minimum: 0 }),
            absent: t.Number({ minimum: 0 }),
          }),
        }
      )

      // ===================== Achievements =====================
      // POST /semester-records/:id/achievements — create a new achievement
      .post(
        "/:id/achievements",
        async ({ params, body, user }) => {
          logger.info({ userId: user.userId, recordId: params.id, body }, "Creating achievement");
          const data = await achievementService.create({ ...body, semesterRecordId: params.id });
          logger.info({ achievementId: data.id, recordId: params.id }, "Achievement created");
          return success(data);
        },
        {
          // title and type required; description optional
          body: t.Object({
            title: t.String(),
            type: t.String(),
            description: t.Optional(t.String()),
          }),
        }
      )
      // PUT /semester-records/achievements/:achievementId — update an achievement
      .put(
        "/achievements/:achievementId",
        async ({ params, body, user }) => {
          logger.info({ userId: user.userId, achievementId: params.achievementId, body }, "Updating achievement");
          const data = await achievementService.update(params.achievementId, body);
          logger.info({ achievementId: params.achievementId }, "Achievement updated");
          return success(data);
        },
        {
          // All fields optional for partial update
          body: t.Object({
            title: t.Optional(t.String()),
            type: t.Optional(t.String()),
            description: t.Optional(t.String()),
          }),
        }
      )
      // DELETE /semester-records/achievements/:achievementId — delete an achievement
      .delete("/achievements/:achievementId", async ({ params, user }) => {
        logger.info({ userId: user.userId, achievementId: params.achievementId }, "Deleting achievement");
        await achievementService.remove(params.achievementId);
        logger.info({ achievementId: params.achievementId }, "Achievement deleted");
        return success({ deleted: true });
      })

      // ===================== Health Record (upsert) =====================
      // PUT /semester-records/:id/health-record — upsert health record (1:1)
      .put(
        "/:id/health-record",
        async ({ params, body, user }) => {
          logger.info({ userId: user.userId, recordId: params.id, body }, "Upserting health record");
          const data = await healthRecordService.upsert(params.id, body);
          logger.info({ recordId: params.id }, "Health record upserted");
          return success(data);
        },
        {
          // All health fields optional; typical measurements for elementary students
          body: t.Object({
            height: t.Optional(t.Number()),
            weight: t.Optional(t.Number()),
            hearingCondition: t.Optional(t.String()),
            visionCondition: t.Optional(t.String()),
            teethCondition: t.Optional(t.String()),
          }),
        }
      )

      // ===================== Development Description (FR-05) =====================
      // PATCH /semester-records/:id/development-description — manual text by teacher
      .patch(
        "/:id/development-description",
        async ({ params, body, user }) => {
          logger.info({ userId: user.userId, recordId: params.id }, "PATCH development description");
          const updated = await service.update(params.id, {
            developmentDescription: body.developmentDescription,
          });
          logger.info({ recordId: params.id }, "Development description updated");
          return success(updated);
        },
        {
          body: t.Object({
            developmentDescription: t.Optional(t.String()),
          }),
        }
      )
  );

import { Elysia, t } from "elysia";
import * as service from "./semester-record.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { requireHomeroomAccess } from "../../middleware/homeroom";

export const semesterRecordController = new Elysia({ prefix: "/students" })
  .guard({}, (app) =>
    app
      .use(requireAuth)
      .use(requireHomeroomAccess)
      .post(
        "/:id/semester-records",
        async ({ params, body, user }) => {
          const data = await service.create({
            ...body,
            studentId: params.id,
            createdById: user.userId,
          });
          return success(data);
        },
        {
          body: t.Object({
            academicYearId: t.String(),
            semester: t.Number({ minimum: 1, maximum: 2 }),
          }),
        }
      )
      .get("/:id/semester-records", async ({ params }) => {
        const data = await service.listByStudent(params.id);
        return success(data);
      })
      .get("/:id/semester-records/:recordId", async ({ params }) => {
        const data = await service.getById(params.recordId);
        return success(data);
      })
      .put(
        "/:id/semester-records/:recordId",
        async ({ params, body }) => {
          const data = await service.update(params.recordId, body);
          return success(data);
        },
        {
          body: t.Object({
            academicYearId: t.Optional(t.String()),
            semester: t.Optional(t.Number({ minimum: 1, maximum: 2 })),
          }),
        }
      )
      .delete("/:id/semester-records/:recordId", async ({ params }) => {
        await service.deleteRecord(params.recordId);
        return success({ deleted: true });
      })
  );

// Sub-resources under /semester-records/:id
import * as subjectScoreService from "../subject-scores/subject-score.service";
import * as attendanceService from "../attendance/attendance.service";
import * as achievementService from "../achievements/achievement.service";
import * as healthRecordService from "../health-records/health-record.service";

export const semesterRecordSubController = new Elysia({ prefix: "/semester-records" })
  .guard({}, (app) =>
    app
      .use(requireAuth)
      .use(requireHomeroomAccess)
      // Subject Scores
      .put(
        "/:id/subject-scores",
        async ({ params, body }) => {
          const data = await subjectScoreService.upsert(params.id, body);
          return success(data);
        },
        {
          body: t.Object({
            subjectName: t.String(),
            knowledgeScore: t.Number(),
            skillsScore: t.Number(),
            notes: t.Optional(t.String()),
          }),
        }
      )
      .put(
        "/:id/subject-scores/batch",
        async ({ params, body }) => {
          const data = await subjectScoreService.batchUpsert(params.id, body.scores);
          return success(data);
        },
        {
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
      .put(
        "/:id/subject-scores/:scoreId",
        async ({ params, body }) => {
          const data = await subjectScoreService.update(params.scoreId, body);
          return success(data);
        },
        {
          body: t.Object({
            subjectName: t.Optional(t.String()),
            knowledgeScore: t.Optional(t.Number()),
            skillsScore: t.Optional(t.Number()),
            notes: t.Optional(t.String()),
          }),
        }
      )
      .delete("/:id/subject-scores/:scoreId", async ({ params }) => {
        await subjectScoreService.remove(params.scoreId);
        return success({ deleted: true });
      })
      // Attendance (upsert)
      .put(
        "/:id/attendance",
        async ({ params, body }) => {
          const data = await attendanceService.upsert(params.id, body);
          return success(data);
        },
        {
          body: t.Object({
            sick: t.Number({ minimum: 0 }),
            permission: t.Number({ minimum: 0 }),
            absent: t.Number({ minimum: 0 }),
          }),
        }
      )
      // Achievements
      .post(
        "/:id/achievements",
        async ({ params, body }) => {
          const data = await achievementService.create({ ...body, semesterRecordId: params.id });
          return success(data);
        },
        {
          body: t.Object({
            title: t.String(),
            type: t.String(),
            description: t.Optional(t.String()),
          }),
        }
      )
      .put(
        "/achievements/:achievementId",
        async ({ params, body }) => {
          const data = await achievementService.update(params.achievementId, body);
          return success(data);
        },
        {
          body: t.Object({
            title: t.Optional(t.String()),
            type: t.Optional(t.String()),
            description: t.Optional(t.String()),
          }),
        }
      )
      .delete("/achievements/:achievementId", async ({ params }) => {
        await achievementService.remove(params.achievementId);
        return success({ deleted: true });
      })
      // Health Record (upsert)
      .put(
        "/:id/health-record",
        async ({ params, body }) => {
          const data = await healthRecordService.upsert(params.id, body);
          return success(data);
        },
        {
          body: t.Object({
            height: t.Optional(t.Number()),
            weight: t.Optional(t.Number()),
            hearingCondition: t.Optional(t.String()),
            visionCondition: t.Optional(t.String()),
            teethCondition: t.Optional(t.String()),
          }),
        }
      )
  );

import { Elysia, t } from "elysia";
import * as aiSummaryService from "./ai-summary.service";
import { success, error as errorResponse } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { checkRole } from "../../middleware/role";
import { prisma } from "../../lib/prisma";

/**
 * Verify that the authenticated user has homeroom access
 * to the student associated with this AI summary.
 */
async function verifyAiSummaryAccess(summaryId: string, userId: string): Promise<boolean> {
  const summary = await prisma.aiSummary.findUnique({
    where: { id: summaryId },
    select: {
      semesterRecord: {
        select: {
          student: {
            select: {
              class: { select: { homeroomTeacherId: true } },
            },
          },
        },
      },
    },
  });
  if (!summary) return false;
  return summary.semesterRecord.student.class.homeroomTeacherId === userId;
}

export const aiSummaryController = new Elysia()
  .guard({}, (app) =>
    app
      .use(requireAuth)
      .get("/semester-records/:id/ai-summaries", async ({ params, user }) => {
        checkRole(user, "ADMINISTRATOR", "OPERATOR_SEKOLAH", "GURU", "KEPALA_SEKOLAH");
        const data = await aiSummaryService.getBySemesterRecord(params.id);
        return success(data);
      })
      .put(
        "/ai-summaries/:id",
        async ({ params, body, user, set }) => {
          checkRole(user, "ADMINISTRATOR", "GURU");
          // GURU must be the homeroom teacher
          if (user.role === "GURU") {
            const hasAccess = await verifyAiSummaryAccess(params.id, user.userId);
            if (!hasAccess) {
              set.status = 403;
              return errorResponse("FORBIDDEN", "You are not the homeroom teacher of this student");
            }
          }
          const data = await aiSummaryService.update(params.id, body);
          return success(data);
        },
        {
          body: t.Object({
            isFinal: t.Optional(t.Boolean()),
            content: t.Optional(t.String()),
          }),
        }
      )
      .post("/ai-summaries/:id/regenerate", async ({ params, user, set }) => {
        checkRole(user, "ADMINISTRATOR", "GURU");
        if (user.role === "GURU") {
          const hasAccess = await verifyAiSummaryAccess(params.id, user.userId);
          if (!hasAccess) {
            set.status = 403;
            return errorResponse("FORBIDDEN", "You are not the homeroom teacher of this student");
          }
        }
        const data = await aiSummaryService.regenerate(params.id);
        return success(data);
      })
      .delete("/ai-summaries/:id", async ({ params, user, set }) => {
        checkRole(user, "ADMINISTRATOR", "GURU");
        if (user.role === "GURU") {
          const hasAccess = await verifyAiSummaryAccess(params.id, user.userId);
          if (!hasAccess) {
            set.status = 403;
            return errorResponse("FORBIDDEN", "You are not the homeroom teacher of this student");
          }
        }
        await aiSummaryService.remove(params.id);
        return success({ deleted: true });
      })
  );

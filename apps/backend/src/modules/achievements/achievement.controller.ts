import { Elysia, t } from "elysia";
import * as service from "./achievement.service";
import { success, error as errorResponse } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { requireRecordOwner } from "../../middleware/record-owner";
import { prisma } from "../../lib/prisma";

/**
 * Verify that the authenticated user has homeroom access
 * to the student associated with this achievement.
 */
async function verifyAchievementAccess(achievementId: string, userId: string) {
  const achievement = await prisma.achievement.findUnique({
    where: { id: achievementId },
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
  if (!achievement) return false;
  return achievement.semesterRecord.student.class.homeroomTeacherId === userId;
}

export const achievementController = new Elysia({ prefix: "/semester-records" })
  .guard({}, (app) =>
    app
      .use(requireAuth)
      .use(requireRecordOwner)
      .post(
        "/:id/achievements",
        async ({ params, body }) => {
          const data = await service.create({
            ...body,
            semesterRecordId: params.id,
          });
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
  )
  .guard({}, (app) =>
    app
      .use(requireAuth)
      .put(
        "/achievements/:id",
        async ({ params, body, user, set }) => {
          // Admin bypass ownership check
          if (user.role !== "ADMINISTRATOR") {
            const hasAccess = await verifyAchievementAccess(params.id, user.userId);
            if (!hasAccess) {
              set.status = 403;
              return errorResponse("FORBIDDEN", "You are not the homeroom teacher of this student");
            }
          }
          const data = await service.update(params.id, body);
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
      .delete("/achievements/:id", async ({ params, user, set }) => {
        // Admin bypass ownership check
        if (user.role !== "ADMINISTRATOR") {
          const hasAccess = await verifyAchievementAccess(params.id, user.userId);
          if (!hasAccess) {
            set.status = 403;
            return errorResponse("FORBIDDEN", "You are not the homeroom teacher of this student");
          }
        }
        await service.remove(params.id);
        return success({ deleted: true });
      })
  );

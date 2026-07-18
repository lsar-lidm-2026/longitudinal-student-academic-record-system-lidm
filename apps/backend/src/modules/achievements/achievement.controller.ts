import { Elysia, t } from "elysia";
import * as service from "./achievement.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { requireRecordOwner } from "../../middleware/record-owner";

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
  );

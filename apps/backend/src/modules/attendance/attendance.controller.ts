import { Elysia, t } from "elysia";
import * as service from "./attendance.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";

export const attendanceController = new Elysia({ prefix: "/semester-records" })
  .guard({}, (app) =>
    app
      .use(requireAuth)
      .put(
        "/:id/attendance",
        async ({ params, body }) => {
          const data = await service.upsert(params.id, body);
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
  );

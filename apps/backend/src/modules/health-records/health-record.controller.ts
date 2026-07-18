import { Elysia, t } from "elysia";
import * as service from "./health-record.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { requireRecordOwner } from "../../middleware/record-owner";

export const healthRecordController = new Elysia({ prefix: "/semester-records" })
  .guard({}, (app) =>
    app
      .use(requireAuth)
      .use(requireRecordOwner)
      .put(
        "/:id/health-record",
        async ({ params, body }) => {
          const data = await service.upsert(params.id, body);
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

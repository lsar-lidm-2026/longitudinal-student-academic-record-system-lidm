import { Elysia, t } from "elysia";
import * as aiSummaryService from "./ai-summary.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";

export const aiSummaryController = new Elysia()
  .guard({}, (app) =>
    app
      .use(requireAuth)
      .get("/semester-records/:id/ai-summaries", async ({ params }) => {
        const data = await aiSummaryService.getBySemesterRecord(params.id);
        return success(data);
      })
      .put(
        "/ai-summaries/:id",
        async ({ params, body }) => {
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
      .delete("/ai-summaries/:id", async ({ params }) => {
        await aiSummaryService.remove(params.id);
        return success({ deleted: true });
      })
  );

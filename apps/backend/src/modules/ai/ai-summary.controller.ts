import { Elysia, t } from "elysia";
import * as aiSummaryService from "./ai-summary.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { checkRole } from "../../middleware/role";

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
        async ({ params, body, user }) => {
          checkRole(user, "ADMINISTRATOR", "GURU");
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
      .delete("/ai-summaries/:id", async ({ params, user }) => {
        checkRole(user, "ADMINISTRATOR", "GURU");
        await aiSummaryService.remove(params.id);
        return success({ deleted: true });
      })
  );

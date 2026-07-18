import { Elysia, t } from "elysia";
import * as aiService from "./ai.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { requireHomeroomAccess } from "../../middleware/homeroom";

export const aiController = new Elysia({ prefix: "/ai" })
  .guard({}, (app) =>
    app
      .use(requireAuth)
      .use(requireHomeroomAccess)
      .post(
        "/students/:id/summary",
        async ({ params }) => {
          const data = await aiService.generateStudentSummary(params.id);
          return success(data);
        },
        {
          params: t.Object({ id: t.String() }),
        }
      )
      .post(
        "/students/:id/draft-description",
        async ({ params }) => {
          const data = await aiService.generateDraftDescription(params.id);
          return success(data);
        },
        {
          params: t.Object({ id: t.String() }),
        }
      )
  )
  .guard({}, (app) =>
    app
      .use(requireAuth)
      .post(
        "/classes/:id/transition-summary",
        async ({ params }) => {
          const data = await aiService.generateTransitionSummary(params.id);
          return success(data);
        },
        {
          params: t.Object({ id: t.String() }),
        }
      )
  );

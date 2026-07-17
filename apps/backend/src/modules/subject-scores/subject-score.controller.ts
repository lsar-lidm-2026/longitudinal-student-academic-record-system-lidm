import { Elysia, t } from "elysia";
import * as service from "./subject-score.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";

export const subjectScoreController = new Elysia({ prefix: "/semester-records" })
  .guard({}, (app) =>
    app
      .use(requireAuth)
      .put(
        "/:id/subject-scores",
        async ({ params, body }) => {
          const data = await service.upsert(params.id, body);
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
  );

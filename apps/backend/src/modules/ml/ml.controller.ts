import { Elysia } from "elysia";
import * as mlService from "./ml.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";

export const mlController = new Elysia({ prefix: "/ml" })
  .guard({}, (app) =>
    app
      .use(requireAuth)
      .get("/risk/student/:id", async ({ params }) => {
        const data = await mlService.getStudentRisk(params.id);
        return success(data);
      })
      .get("/risk/class/:id", async ({ params }) => {
        const data = await mlService.getClassRisk(params.id);
        return success(data);
      })
      .get("/trend/student/:id", async ({ params }) => {
        const data = await mlService.getStudentTrend(params.id);
        return success(data);
      })
      .get("/models", async () => {
        const data = await mlService.getModels();
        return success(data);
      })
      .get("/outcomes", async ({ query }) => {
        const data = await mlService.getOutcomes(query.studentId as string | undefined);
        return success(data);
      })
  );

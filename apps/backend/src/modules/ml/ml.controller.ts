import { Elysia } from "elysia";
import * as mlService from "./ml.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { requireHomeroomAccess } from "../../middleware/homeroom";
import { checkRole } from "../../middleware/role";

export const mlController = new Elysia({ prefix: "/ml" })
  .guard({}, (app) =>
    app
      .use(requireAuth)
      .get("/models", async () => {
        const data = await mlService.getModels();
        return success(data);
      })
      .get("/outcomes", async ({ query, user }) => {
        checkRole(user, "ADMINISTRATOR", "GURU", "KEPALA_SEKOLAH");
        const data = await mlService.getOutcomes(query.studentId as string | undefined);
        return success(data);
      })
      .post("/train", async ({ user }) => {
        checkRole(user, "ADMINISTRATOR");
        const data = await mlService.retrainModels();
        return success({
          trainedAt: data.trainedAt,
          status: "success",
          models: {
            hasClusterModel: data.clusterModel !== null,
          },
        });
      })
      .get("/eval", async ({ user }) => {
        checkRole(user, "ADMINISTRATOR");
        const data = await mlService.evaluateAllModels();
        return success(data);
      })
  )
  .guard({}, (app) =>
    app
      .use(requireAuth)
      .use(requireHomeroomAccess)
      .get("/risk/student/:id", async ({ params }) => {
        const data = await mlService.getStudentRisk(params.id);
        return success(data);
      })
      .get("/trend/student/:id", async ({ params }) => {
        const data = await mlService.getStudentTrend(params.id);
        return success(data);
      })
  )
  .guard({}, (app) =>
    app
      .use(requireAuth)
      .get("/risk/class/:id", async ({ params }) => {
        const data = await mlService.getClassRisk(params.id);
        return success(data);
      })
      .get("/cluster/class/:id", async ({ params }) => {
        const data = await mlService.getClassCluster(params.id);
        return success(data);
      })
  );

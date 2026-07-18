import { Elysia } from "elysia";
import { checkRole } from "../../middleware/role";
import * as service from "./dashboard.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";

export const dashboardController = new Elysia({ prefix: "/dashboard" })
  .guard({}, (app) =>
    app
      .use(requireAuth)
      .get("/summary", async ({ user }) => {
        checkRole(user, "ADMINISTRATOR", "OPERATOR_SEKOLAH", "GURU", "KEPALA_SEKOLAH");
        const data = await service.getSummary(user.userId, user.role);
        return success(data);
      })
  );

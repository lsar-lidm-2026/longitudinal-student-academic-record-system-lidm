import { Elysia } from "elysia";
import * as service from "./dashboard.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";

export const dashboardController = new Elysia({ prefix: "/dashboard" })
  .guard({}, (app) =>
    app
      .use(requireAuth)
      .get("/summary", async ({ user }) => {
        const data = await service.getSummary(user.userId, user.role);
        return success(data);
      })
  );

import { Elysia } from "elysia";
import * as service from "./profile.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { requireHomeroomAccess } from "../../middleware/homeroom";

export const profileController = new Elysia({ prefix: "/students" })
  .guard({}, (app) =>
    app
      .use(requireAuth)
      .use(requireHomeroomAccess)
      .get("/:id/profile", async ({ params }) => {
        const data = await service.getStudentProfile(params.id);
        return success(data);
      })
      .get("/:id/timeline", async ({ params }) => {
        const data = await service.getTimeline(params.id);
        return success(data);
      })
  );

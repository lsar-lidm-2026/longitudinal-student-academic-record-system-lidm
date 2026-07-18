import { Elysia } from "elysia";
import * as service from "./buku-induk.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { requireHomeroomAccess } from "../../middleware/homeroom";

export const bukuIndukController = new Elysia({ prefix: "/students" })
  .guard({}, (app) =>
    app
      .use(requireAuth)
      .use(requireHomeroomAccess)
      .get("/:id/administrative-workspace", async ({ params }) => {
        const data = await service.getWorkspace(params.id);
        return success(data);
      })
      .get("/:id/validation-status", async ({ params }) => {
        const data = await service.getValidationStatus(params.id);
        return success(data);
      })
      .get("/:id/buku-induk-preview", async ({ params }) => {
        const data = await service.getPreview(params.id);
        return success(data);
      })
  );

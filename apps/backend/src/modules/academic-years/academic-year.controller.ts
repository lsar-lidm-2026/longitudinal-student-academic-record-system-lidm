import { Elysia, t } from "elysia";
import * as service from "./academic-year.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { checkRole } from "../../middleware/role";

export const academicYearController = new Elysia({ prefix: "/academic-years" })
  .use(requireAuth)
  .get("/", async ({ user }) => {
    checkRole(user, "ADMINISTRATOR", "OPERATOR_SEKOLAH", "KEPALA_SEKOLAH", "GURU");
    const data = await service.list();
    return success(data);
  })
  .post(
    "/",
    async ({ body, user }) => {
      checkRole(user, "ADMINISTRATOR");
      const data = await service.create(body);
      return success(data);
    },
    {
      body: t.Object({ year: t.String() }),
    }
  )
  .put(
    "/:id",
    async ({ params, body, user }) => {
      checkRole(user, "ADMINISTRATOR");
      const data = await service.update(params.id, body);
      return success(data);
    },
    {
      body: t.Object({ year: t.Optional(t.String()) }),
    }
  )
  .patch("/:id/activate", async ({ params, user }) => {
    checkRole(user, "ADMINISTRATOR");
    const data = await service.activate(params.id);
    return success(data);
  })
  .patch("/:id/archive", async ({ params, user }) => {
    checkRole(user, "ADMINISTRATOR");
    const data = await service.archive(params.id);
    return success(data);
  });

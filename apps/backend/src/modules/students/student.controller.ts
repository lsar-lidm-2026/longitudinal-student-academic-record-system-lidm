import { Elysia, t } from "elysia";
import * as service from "./student.service";
import { success, paginated } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { requireHomeroomAccess } from "../../middleware/homeroom";
import { checkRole } from "../../middleware/role";

export const studentController = new Elysia({ prefix: "/students" })
  .use(requireAuth)
  .get("/", async ({ query, user }) => {
    checkRole(user, "ADMINISTRATOR", "OPERATOR_SEKOLAH", "KEPALA_SEKOLAH");
    const result = await service.list(query);
    return paginated(result.data, result.page, result.limit, result.total);
  })
  .post(
    "/",
    async ({ body, user }) => {
      checkRole(user, "OPERATOR_SEKOLAH");
      const data = await service.create(body);
      return success(data);
    },
    {
      body: t.Object({
        nis: t.String(),
        nisn: t.String(),
        name: t.String(),
        gender: t.String(),
        classId: t.String(),
      }),
    }
  )
  .guard({}, (app) =>
    app
      .use(requireHomeroomAccess)
      .put(
        "/:id",
        async ({ params, body, user }) => {
          checkRole(user, "OPERATOR_SEKOLAH");
          const data = await service.update(params.id, body);
          return success(data);
        },
        {
          body: t.Object({
            nis: t.Optional(t.String()),
            nisn: t.Optional(t.String()),
            name: t.Optional(t.String()),
            gender: t.Optional(t.String()),
            classId: t.Optional(t.String()),
          }),
        }
      )
      .get("/:id", async ({ params, user }) => {
        checkRole(user, "ADMINISTRATOR", "OPERATOR_SEKOLAH", "GURU", "KEPALA_SEKOLAH");
        const data = await service.getById(params.id);
        return success(data);
      })
  );

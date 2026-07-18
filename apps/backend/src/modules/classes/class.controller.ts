import { Elysia, t } from "elysia";
import * as service from "./class.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { checkRole } from "../../middleware/role";

export const classController = new Elysia({ prefix: "/classes" })
  .use(requireAuth)
  .get("/", async ({ user }) => {
    checkRole(user, "ADMINISTRATOR", "OPERATOR_SEKOLAH", "KEPALA_SEKOLAH");
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
      body: t.Object({
        name: t.String(),
        academicYearId: t.String(),
      }),
    }
  )
  .patch(
    "/:id/homeroom-teacher",
    async ({ params, body, user }) => {
      checkRole(user, "ADMINISTRATOR");
      const data = await service.assignTeacher(params.id, body.teacherId, user.userId);
      return success(data);
    },
    {
      body: t.Object({ teacherId: t.String() }),
    }
  )
  .get("/:id/students", async ({ params, user }) => {
    checkRole(user, "ADMINISTRATOR", "OPERATOR_SEKOLAH", "GURU", "KEPALA_SEKOLAH");
    const data = await service.getStudents(params.id);
    return success(data);
  });

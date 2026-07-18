import { Elysia, t } from "elysia";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { checkRole } from "../../middleware/role";
import * as authService from "../auth/auth.service";

export const usersController = new Elysia({ prefix: "/users" })
  .use(requireAuth)
  .get("/", async ({ user }) => {
    checkRole(user, "ADMINISTRATOR");
    const data = await authService.listUsers();
    return success(data);
  })
  .post(
    "/",
    async ({ body, user }) => {
      checkRole(user, "ADMINISTRATOR");
      const data = await authService.createUser(body);
      return success(data);
    },
    {
      body: t.Object({
        username: t.String(),
        password: t.String({ minLength: 6 }),
        name: t.String(),
        role: t.Union([
          t.Literal("ADMINISTRATOR"),
          t.Literal("OPERATOR_SEKOLAH"),
          t.Literal("GURU"),
          t.Literal("KEPALA_SEKOLAH"),
        ]),
      }),
    }
  )
  .get("/:id", async ({ params, user }) => {
    checkRole(user, "ADMINISTRATOR");
    const data = await authService.getMe(params.id);
    return success(data);
  })
  .put(
    "/:id",
    async ({ params, body, user }) => {
      checkRole(user, "ADMINISTRATOR");
      const data = await authService.updateUser(params.id, body);
      return success(data);
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        role: t.Optional(
          t.Union([
            t.Literal("ADMINISTRATOR"),
            t.Literal("OPERATOR_SEKOLAH"),
            t.Literal("GURU"),
            t.Literal("KEPALA_SEKOLAH"),
          ])
        ),
        isActive: t.Optional(t.Boolean()),
      }),
    }
  )
  .patch("/:id/status", async ({ params, user }) => {
    checkRole(user, "ADMINISTRATOR");
    const data = await authService.toggleUserStatus(params.id);
    return success(data);
  });

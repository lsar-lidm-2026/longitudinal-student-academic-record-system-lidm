import { Elysia, t } from "elysia";
import * as authService from "./auth.service";
import { success, error as errorResponse } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { checkRole } from "../../middleware/role";

export const authController = new Elysia({ prefix: "/auth" })
  .post(
    "/login",
    async ({ body, set }) => {
      try {
        const result = await authService.login(body);
        return success(result);
      } catch (e: any) {
        set.status = 401;
        return errorResponse("UNAUTHORIZED", e.message);
      }
    },
    {
      body: t.Object({
        username: t.String(),
        password: t.String(),
      }),
    }
  )
  .use(requireAuth)
  .get("/me", async ({ user }) => {
    const data = await authService.getMe(user.userId);
    return success(data);
  })
  .get("/users", async ({ user }) => {
    checkRole(user, "ADMINISTRATOR");
    const data = await authService.listUsers();
    return success(data);
  })
  .post(
    "/users",
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
  );

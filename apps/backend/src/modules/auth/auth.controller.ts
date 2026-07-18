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
        if (e.name === "AppError" && e.code === "UNAUTHORIZED") {
          set.status = 401;
          return errorResponse("UNAUTHORIZED", e.message);
        }
        // Jangan mask error internal sebagai 401
        throw e;
      }
    },
    {
      body: t.Object({
        username: t.String(),
        password: t.String(),
      }),
    }
  )
  .post(
    "/refresh",
    async ({ body, set }) => {
      try {
        const result = await authService.refresh(body.refreshToken);
        return success(result);
      } catch (e: any) {
        set.status = 401;
        return errorResponse("UNAUTHORIZED", e.message);
      }
    },
    {
      body: t.Object({
        refreshToken: t.String(),
      }),
    }
  )
  .post(
    "/logout",
    async ({ body }) => {
      // Client-side token invalidation; server acknowledges logout
      return success({ message: "Logged out successfully" });
    }
  )
  .use(requireAuth)
  .get("/me", async ({ user }) => {
    const data = await authService.getMe(user.userId);
    return success(data);
  });

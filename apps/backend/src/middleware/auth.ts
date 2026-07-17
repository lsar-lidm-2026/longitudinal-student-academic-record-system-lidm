import { Elysia } from "elysia";
import { verifyToken } from "../lib/jwt";
import { UnauthorizedError } from "../common/error";
import type { JwtPayload } from "../common/types";

export const requireAuth = new Elysia({ name: "requireAuth" })
  .derive({ as: "scoped" }, async ({ request }) => {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedError("Missing or invalid token");
    }

    const token = authHeader.slice(7);
    try {
      const payload = verifyToken(token);
      return { user: payload as JwtPayload };
    } catch {
      throw new UnauthorizedError("Invalid or expired token");
    }
  });

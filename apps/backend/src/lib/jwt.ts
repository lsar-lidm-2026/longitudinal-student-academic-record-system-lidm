import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { JwtPayload } from "../common/types";

function getExpiresIn(): string | number {
  const val = env.jwtExpiresIn;
  // jsonwebtoken accepts either a string like "7d" or a number of seconds
  const num = parseInt(val, 10);
  return isNaN(num) ? val : num;
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(
    {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
      name: payload.name,
      iat: Math.floor(Date.now() / 1000),
    },
    env.jwtSecret,
    { expiresIn: getExpiresIn() }
  );
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.jwtSecret) as Record<string, unknown>;
  return {
    userId: String(decoded.userId ?? ""),
    username: String(decoded.username ?? ""),
    role: String(decoded.role ?? "") as JwtPayload["role"],
    name: String(decoded.name ?? ""),
    iat: typeof decoded.iat === "number" ? decoded.iat : undefined,
  };
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(
    {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
      name: payload.name,
      iat: Math.floor(Date.now() / 1000),
    },
    env.jwtSecret,
    { expiresIn: "30d" }
  );
}

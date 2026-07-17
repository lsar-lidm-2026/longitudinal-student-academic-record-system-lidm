import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { JwtPayload } from "../common/types";

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(
    { userId: payload.userId, username: payload.username, role: payload.role, name: payload.name },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn as any }
  );
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.jwtSecret) as any;
  return {
    userId: decoded.userId,
    username: decoded.username,
    role: decoded.role,
    name: decoded.name,
  };
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(
    { userId: payload.userId, username: payload.username, role: payload.role, name: payload.name },
    env.jwtSecret,
    { expiresIn: "30d" }
  );
}

import { prisma } from "../../lib/prisma";
import { verifyPassword, hashPassword } from "../../lib/hash";
import { generateToken, generateRefreshToken } from "../../lib/jwt";
import { UnauthorizedError, NotFoundError, ConflictError } from "../../common/error";
import type { JwtPayload } from "../../common/types";
import type { Role } from "../../generated/prisma";

export interface LoginInput {
  username: string;
  password: string;
}

export interface CreateUserInput {
  username: string;
  password: string;
  name: string;
  role: Role;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: JwtPayload;
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    where: { username: input.username },
  });

  if (!user || !user.isActive) {
    throw new UnauthorizedError("Invalid username or password");
  }

  const valid = await verifyPassword(input.password, user.password);
  if (!valid) {
    throw new UnauthorizedError("Invalid username or password");
  }

  const payload: JwtPayload = {
    userId: user.id,
    username: user.username,
    role: user.role as Role,
    name: user.name,
  };

  return {
    accessToken: generateToken(payload),
    refreshToken: generateRefreshToken(payload),
    user: payload,
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!user) throw new NotFoundError("User not found");
  return user;
}

export async function createUser(input: CreateUserInput) {
  const existing = await prisma.user.findUnique({
    where: { username: input.username },
  });

  if (existing) throw new ConflictError("Username already exists");

  const hashed = await hashPassword(input.password);

  return prisma.user.create({
    data: {
      username: input.username,
      password: hashed,
      name: input.name,
      role: input.role,
    },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export async function listUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function refresh(refreshToken: string) {
  try {
    const { verifyToken } = await import("../../lib/jwt");
    const decoded = verifyToken(refreshToken);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      role: user.role as Role,
      name: user.name,
    };

    return {
      accessToken: generateToken(payload),
      refreshToken: generateRefreshToken(payload),
      user: payload,
    };
  } catch {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }
}

export async function updateUser(
  id: string,
  data: { name?: string; role?: Role; isActive?: boolean }
) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError("User not found");

  return prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export async function toggleUserStatus(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError("User not found");

  return prisma.user.update({
    where: { id },
    data: { isActive: !user.isActive },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
}

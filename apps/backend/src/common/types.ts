import { Role } from "../generated/prisma/client";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface JwtPayload {
  userId: string;
  username: string;
  role: Role;
  name: string;
  iat?: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

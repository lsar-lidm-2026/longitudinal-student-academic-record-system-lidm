import type { ApiResponse } from "./types";

export function success<T>(data: T, meta?: { page: number; limit: number; total: number }): ApiResponse<T> {
  return { success: true, data, ...(meta ? { meta } : {}) };
}

export function error(code: string, message: string): ApiResponse<never> {
  return { success: false, error: { code, message } };
}

export function paginated<T>(
  data: T,
  page: number,
  limit: number,
  total: number
): ApiResponse<T> {
  return { success: true, data, meta: { page, limit, total } };
}

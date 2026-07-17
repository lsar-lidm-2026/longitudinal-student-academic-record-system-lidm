import type { PaginationParams } from "./types";

export function parsePagination(query: { page?: string; limit?: string }): PaginationParams {
  const page = Math.max(1, parseInt(query.page || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || "20", 10) || 20));
  return { page, limit };
}

export function buildPagination(page: number, limit: number) {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

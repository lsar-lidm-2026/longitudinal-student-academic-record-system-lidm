import { describe, expect, it } from "bun:test";
import { success, error, paginated } from "../src/common/response";
import { AppError, UnauthorizedError, ForbiddenError, NotFoundError, ValidationError, ConflictError, AiError } from "../src/common/error";
import { parsePagination, buildPagination } from "../src/common/pagination";

describe("Response helpers", () => {
  it("success() wraps data", () => {
    const res = success({ name: "test" });
    expect(res).toEqual({ success: true, data: { name: "test" } });
  });

  it("success() includes meta when provided", () => {
    const res = success([], { page: 1, limit: 20, total: 0 });
    expect(res.meta).toEqual({ page: 1, limit: 20, total: 0 });
  });

  it("error() returns error object", () => {
    const res = error("NOT_FOUND", "Not found");
    expect(res).toEqual({ success: false, error: { code: "NOT_FOUND", message: "Not found" } });
  });

  it("paginated() constructs proper response", () => {
    const res = paginated(["a"], 1, 10, 1);
    expect(res.success).toBe(true);
    expect(res.data).toEqual(["a"]);
    expect(res.meta).toEqual({ page: 1, limit: 10, total: 1 });
  });
});

describe("Error classes", () => {
  it("AppError has statusCode, code, message", () => {
    const e = new AppError(418, "TEAPOT", "I'm a teapot");
    expect(e.statusCode).toBe(418);
    expect(e.code).toBe("TEAPOT");
    expect(e.message).toBe("I'm a teapot");
  });

  it("UnauthorizedError defaults to 401", () => {
    const e = new UnauthorizedError();
    expect(e.statusCode).toBe(401);
    expect(e.code).toBe("UNAUTHORIZED");
  });

  it("ForbiddenError defaults to 403", () => {
    const e = new ForbiddenError();
    expect(e.statusCode).toBe(403);
  });

  it("NotFoundError defaults to 404", () => {
    const e = new NotFoundError();
    expect(e.statusCode).toBe(404);
  });

  it("ValidationError defaults to 400", () => {
    const e = new ValidationError();
    expect(e.statusCode).toBe(400);
  });

  it("ConflictError defaults to 409", () => {
    const e = new ConflictError();
    expect(e.statusCode).toBe(409);
  });

  it("AiError defaults to 502", () => {
    const e = new AiError();
    expect(e.statusCode).toBe(502);
  });

  it("custom messages propagate", () => {
    const e = new NotFoundError("Student not found");
    expect(e.message).toBe("Student not found");
  });
});

describe("Pagination", () => {
  it("parsePagination defaults", () => {
    const p = parsePagination({});
    expect(p).toEqual({ page: 1, limit: 20 });
  });

  it("parsePagination parses query strings", () => {
    const p = parsePagination({ page: "3", limit: "10" });
    expect(p).toEqual({ page: 3, limit: 10 });
  });

  it("parsePagination clamps page to min 1, limit defaults to 20", () => {
    const p = parsePagination({ page: "0", limit: "0" });
    expect(p).toEqual({ page: 1, limit: 20 });
  });

  it("parsePagination clamps limit to max 100", () => {
    const p = parsePagination({ limit: "999" });
    expect(p.limit).toBe(100);
  });

  it("parsePagination clamps max limit to 100", () => {
    const p = parsePagination({ limit: "999" });
    expect(p.limit).toBe(100);
  });

  it("buildPagination computes skip/take", () => {
    const p = buildPagination(2, 10);
    expect(p).toEqual({ skip: 10, take: 10 });
  });
});

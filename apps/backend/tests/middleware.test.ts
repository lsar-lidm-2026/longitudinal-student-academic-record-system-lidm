import { describe, expect, it } from "bun:test";
import { ForbiddenError } from "../src/common/error";
import { checkRole } from "../src/middleware/role";

describe("checkRole middleware", () => {
  it("allows matching role", () => {
    expect(() => checkRole({ userId: "1", role: "ADMINISTRATOR" }, "ADMINISTRATOR")).not.toThrow();
  });

  it("allows one of many roles", () => {
    expect(() => checkRole({ userId: "1", role: "GURU" }, "ADMINISTRATOR", "GURU", "KEPALA_SEKOLAH")).not.toThrow();
  });

  it("throws ForbiddenError for non-matching role", () => {
    expect(() => checkRole({ userId: "1", role: "GURU" }, "ADMINISTRATOR")).toThrow(ForbiddenError);
  });

  it("throws ForbiddenError for undefined user", () => {
    expect(() => checkRole(undefined, "ADMINISTRATOR")).toThrow(ForbiddenError);
  });
});

describe("Error classes", () => {
  it("AppError has statusCode and code", () => {
    const { AppError, UnauthorizedError, NotFoundError } = require("../src/common/error");
    expect(new AppError(418, "TEAPOT", "msg").statusCode).toBe(418);
    expect(new UnauthorizedError().statusCode).toBe(401);
    expect(new NotFoundError().statusCode).toBe(404);
    expect(new NotFoundError("custom").message).toBe("custom");
  });
});

describe("Response helpers", () => {
  it("success wraps data", async () => {
    const { success, error } = await import("../src/common/response");
    expect(success({ x: 1 })).toEqual({ success: true, data: { x: 1 } });
    expect(error("ERR", "msg")).toEqual({ success: false, error: { code: "ERR", message: "msg" } });
  });
});

describe("Pagination", () => {
  it("parses and builds correctly", async () => {
    const { parsePagination, buildPagination } = await import("../src/common/pagination");
    expect(parsePagination({ page: "2", limit: "10" })).toEqual({ page: 2, limit: 10 });
    expect(buildPagination(1, 20)).toEqual({ skip: 0, take: 20 });
  });

  it("clamps values", async () => {
    const { parsePagination } = await import("../src/common/pagination");
    expect(parsePagination({ page: "0", limit: "0" })).toEqual({ page: 1, limit: 20 });
    expect(parsePagination({ limit: "999" }).limit).toBe(100);
  });
});

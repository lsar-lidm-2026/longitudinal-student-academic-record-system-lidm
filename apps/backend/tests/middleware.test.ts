import { describe, expect, it } from "bun:test";
import { ForbiddenError, NotFoundError } from "../src/common/error";
import { checkRole } from "../src/middleware/role";

describe("checkRole middleware", () => {
  it("allows matching role", () => {
    expect(() => checkRole({ role: "ADMINISTRATOR" }, "ADMINISTRATOR")).not.toThrow();
  });

  it("allows one of many roles", () => {
    expect(() => checkRole({ role: "GURU" }, "ADMINISTRATOR", "GURU", "KEPALA_SEKOLAH")).not.toThrow();
  });

  it("throws ForbiddenError for non-matching role", () => {
    expect(() => checkRole({ role: "GURU" }, "ADMINISTRATOR")).toThrow(ForbiddenError);
  });

  it("throws ForbiddenError for undefined user", () => {
    expect(() => checkRole(undefined, "ADMINISTRATOR")).toThrow(ForbiddenError);
  });

  it("throws ForbiddenError for unrecognized role", () => {
    expect(() => checkRole({ role: "GURU" }, "ADMINISTRATOR", "OPERATOR_SEKOLAH")).toThrow(ForbiddenError);
  });

  it("allows ADMINISTRATOR when listed in allowed roles", () => {
    expect(() => checkRole({ role: "ADMINISTRATOR" }, "ADMINISTRATOR", "GURU")).not.toThrow();
  });

  it("throws if ADMINISTRATOR is not in allowed roles list", () => {
    expect(() => checkRole({ role: "ADMINISTRATOR" }, "GURU", "OPERATOR_SEKOLAH")).toThrow(ForbiddenError);
  });

  it("allows OPERATOR_SEKOLAH when included", () => {
    expect(() => checkRole({ role: "OPERATOR_SEKOLAH" }, "ADMINISTRATOR", "OPERATOR_SEKOLAH")).not.toThrow();
  });
});

describe("Error classes", () => {
  it("AppError has statusCode and code", () => {
    const { AppError, UnauthorizedError, NotFoundError: NE } = require("../src/common/error");
    expect(new AppError(418, "TEAPOT", "msg").statusCode).toBe(418);
    expect(new UnauthorizedError().statusCode).toBe(401);
    expect(new NE().statusCode).toBe(404);
    expect(new NE("custom").message).toBe("custom");
  });

  it("all error classes extend AppError", () => {
    const { AppError, UnauthorizedError, ForbiddenError: FE, NotFoundError: NE, ValidationError, ConflictError, AiError } = require("../src/common/error");
    expect(new UnauthorizedError()).toBeInstanceOf(AppError);
    expect(new FE()).toBeInstanceOf(AppError);
    expect(new NE()).toBeInstanceOf(AppError);
    expect(new ValidationError()).toBeInstanceOf(AppError);
    expect(new ConflictError()).toBeInstanceOf(AppError);
    expect(new AiError()).toBeInstanceOf(AppError);
  });

  it("AiError defaults to 502", () => {
    const { AiError } = require("../src/common/error");
    expect(new AiError().statusCode).toBe(502);
    expect(new AiError("LLM timeout").message).toBe("LLM timeout");
  });

  it("ValidationError defaults to 400", () => {
    const { ValidationError } = require("../src/common/error");
    expect(new ValidationError().statusCode).toBe(400);
  });
});

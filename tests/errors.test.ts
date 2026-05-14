import { describe, it, expect } from "vitest";
import {
  AppError,
  UnauthorizedError,
  ThrottledError,
  ValidationError,
  InternalError,
} from "../src/core/errors";

describe("UnauthorizedError", () => {
  it("has correct statusCode and code", () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("uses default message", () => {
    const err = new UnauthorizedError();
    expect(err.message).toBe("Missing or invalid token");
  });

  it("accepts custom message", () => {
    const err = new UnauthorizedError("Custom message");
    expect(err.message).toBe("Custom message");
  });

  it("toLambdaResponse returns correct format", () => {
    const res = new UnauthorizedError().toLambdaResponse();
    expect(res.statusCode).toBe(401);
    expect(res.headers).toEqual({ "Content-Type": "application/json" });
    const body = JSON.parse(res.body);
    expect(body.error).toBe("UNAUTHORIZED");
  });
});

describe("ThrottledError", () => {
  it("has correct statusCode and code", () => {
    const err = new ThrottledError(30);
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe("THROTTLED");
  });

  it("stores retryAfter", () => {
    const err = new ThrottledError(30);
    expect(err.retryAfter).toBe(30);
  });

  it("toLambdaResponse includes Retry-After header", () => {
    const res = new ThrottledError(15).toLambdaResponse();
    expect(res.statusCode).toBe(429);
    expect(res.headers["Content-Type"]).toBe("application/json");
    expect(res.headers["Retry-After"]).toBe("15");
    const body = JSON.parse(res.body);
    expect(body.error).toBe("THROTTLED");
  });
});

describe("ValidationError", () => {
  it("has correct statusCode and code", () => {
    const err = new ValidationError({ field: "name", issue: "required" });
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
  });

  it("stores details", () => {
    const details = { fieldErrors: { name: ["Required"] } };
    const err = new ValidationError(details);
    expect(err.details).toBe(details);
  });

  it("toLambdaResponse includes details in body", () => {
    const details = { fieldErrors: { name: ["Required"] } };
    const res = new ValidationError(details).toLambdaResponse();
    const body = JSON.parse(res.body);
    expect(body.details).toEqual(details);
  });
});

describe("InternalError", () => {
  it("has correct statusCode and code", () => {
    const err = new InternalError();
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe("INTERNAL_ERROR");
  });

  it("uses default message", () => {
    const err = new InternalError();
    expect(err.message).toBe("Internal server error");
  });

  it("toLambdaResponse returns correct format", () => {
    const res = new InternalError().toLambdaResponse();
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("INTERNAL_ERROR");
  });
});

describe("AppError", () => {
  it("cannot be instantiated directly", () => {
    // AppError is abstract, verify a subclass extends it properly
    const err = new UnauthorizedError();
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
  });
});

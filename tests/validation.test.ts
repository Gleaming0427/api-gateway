import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validate } from "../src/core/validation";
import { ValidationError } from "../src/core/errors";

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().min(0).optional(),
});

describe("validate", () => {
  it("returns typed data when valid", () => {
    const data = { name: "Alice", email: "alice@example.com" };
    const result = validate(userSchema, data);
    expect(result.name).toBe("Alice");
    expect(result.email).toBe("alice@example.com");
  });

  it("throws ValidationError with details when invalid", () => {
    const data = { name: "", email: "not-an-email" };
    try {
      validate(userSchema, data);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const ve = err as ValidationError;
      expect(ve.code).toBe("VALIDATION_ERROR");
      expect(ve.statusCode).toBe(400);
      expect(ve.details).toBeDefined();
    }
  });

  it("includes source in error message when provided", () => {
    try {
      validate(userSchema, {}, { source: "body" });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).message).toContain("body");
    }
  });

  it("uses default source 'request' when not provided", () => {
    try {
      validate(userSchema, {});
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).message).toContain("request");
    }
  });

  it("validates complex nested schemas", () => {
    const schema = z.object({
      items: z.array(z.object({ id: z.string(), qty: z.number().min(1) })),
    });
    const valid = { items: [{ id: "a", qty: 2 }] };
    const result = validate(schema, valid);
    expect(result.items).toHaveLength(1);
  });

  it("throws ValidationError for undefined", () => {
    try {
      validate(userSchema, undefined);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const ve = err as ValidationError;
      expect(ve.statusCode).toBe(400);
    }
  });

  it("throws ValidationError for null", () => {
    try {
      validate(userSchema, null);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
    }
  });
});

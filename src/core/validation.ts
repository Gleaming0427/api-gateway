/**
 * Request validation wrapper around Zod. Throws ValidationError with parsed details on failure.
 */
import { ZodSchema } from "zod";
import { ValidationError } from "./errors";

/** Parses `data` against `schema`. Returns typed result or throws ValidationError. */
export function validate<T>(
  schema: ZodSchema<T>,
  data: unknown,
  options?: { source?: string },
): T {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }

  const details = result.error.flatten();
  const source = options?.source ?? "request";
  throw new ValidationError(details, `${source} validation failed`);
}

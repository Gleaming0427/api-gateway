/**
 * Typed error hierarchy for API Gateway responses.
 * Each subclass maps to an HTTP status and a machine-readable code.
 * Use toLambdaResponse() for the API Gateway Lambda proxy format.
 */
export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  /** Formats this error as an API Gateway Lambda proxy response. */
  toLambdaResponse() {
    return {
      statusCode: this.statusCode,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: this.code, message: this.message }),
    };
  }
}

/** Missing, expired, or invalid authentication token. */
export class UnauthorizedError extends AppError {
  readonly code = "UNAUTHORIZED";
  readonly statusCode = 401;
  constructor(message = "Missing or invalid token") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** Rate limit exceeded. Carries the retryAfter delay in seconds. */
export class ThrottledError extends AppError {
  readonly code = "THROTTLED";
  readonly statusCode = 429;
  readonly retryAfter: number;
  constructor(retryAfter: number, message = "Rate limit exceeded") {
    super(message);
    this.name = "ThrottledError";
    this.retryAfter = retryAfter;
  }

  toLambdaResponse() {
    return {
      statusCode: this.statusCode,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(this.retryAfter),
      },
      body: JSON.stringify({ error: this.code, message: this.message }),
    };
  }
}

/** Invalid request payload. Carries the parsed Zod error details. */
export class ValidationError extends AppError {
  readonly code = "VALIDATION_ERROR";
  readonly statusCode = 400;
  readonly details: unknown;
  constructor(details: unknown, message = "Request validation failed") {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }

  toLambdaResponse() {
    return {
      statusCode: this.statusCode,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: this.code,
        message: this.message,
        details: this.details,
      }),
    };
  }
}

/** Unrecoverable server error. toLambdaResponse() always returns a generic body — the real cause is preserved for logging only. */
export class InternalError extends AppError {
  readonly code = "INTERNAL_ERROR";
  readonly statusCode = 500;
  // The original error that caused this, preserved for logging. Never exposed to the client.
  readonly cause?: unknown;
  constructor(message = "Internal server error", cause?: unknown) {
    super(message);
    this.name = "InternalError";
    this.cause = cause;
  }

  toLambdaResponse() {
    return {
      statusCode: this.statusCode,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: this.code, message: "Internal server error" }),
    };
  }
}

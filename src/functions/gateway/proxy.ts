/**
 * API Gateway proxy handler. Pipeline: rate-limit → forward to upstream → return response.
 * Compatible with API Gateway REST API (V1), HTTP API (V2), and Lambda Function URL.
 */
import type { APIGatewayProxyResult } from "aws-lambda";
import { Resource } from "sst";
import { RateLimiter } from "../../core/rate-limiter";
import { AppError, InternalError } from "../../core/errors";
import { DynamoRateLimiterStore } from "../../adapters/dynamo";

const upstreamUrl = Resource.UpstreamApiUrl.value;
const tableName = Resource.RateLimitTable.name;
const capacity = Number(process.env.RATE_LIMIT_CAPACITY ?? "100");
const refillRate = Number(process.env.RATE_LIMIT_REFILL_RATE ?? "10");

/** Module-scoped rate limiter — reused across warm Lambda invocations. */
const rateLimiter = new RateLimiter(new DynamoRateLimiterStore(tableName), {
  capacity,
  refillRate,
});

/** Headers stripped before forwarding to the upstream. */
const STRIP_HEADERS = new Set([
  "host",
  "authorization",
  "x-amz-content-sha256",
  "x-amz-date",
  "x-amz-security-token",
  "x-amz-user-agent",
  "x-forwarded-for",
  "x-forwarded-port",
  "x-forwarded-proto",
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- proxy handles multiple event shapes (V1, V2, Function URL)
type ProxyEvent = Record<string, any>;

/** Extracts the HTTP method from any event shape. */
function getMethod(e: ProxyEvent): string {
  return e.httpMethod ?? e.requestContext?.http?.method ?? "GET";
}

/** Extracts the path from any event shape. */
function getPath(e: ProxyEvent): string {
  return e.rawPath ?? e.path ?? "/";
}

/** Extracts headers from any event shape (normalized to Record<string, string | undefined>). */
function getHeaders(e: ProxyEvent): Record<string, string | undefined> {
  return e.headers ?? {};
}

/** Extracts query string parameters from any event shape. */
function getQueryParams(e: ProxyEvent): Record<string, string | undefined> | null {
  return e.queryStringParameters ?? e.rawQueryString?.length
    ? Object.fromEntries(new URLSearchParams(e.rawQueryString))
    : null;
}

/** Extracts the authorizer context from any event shape. */
function getAuthorizer(e: ProxyEvent): Record<string, string> | undefined {
  return e.requestContext?.authorizer as Record<string, string> | undefined;
}

/** Handler compatible with API Gateway REST, HTTP, and Lambda Function URL. */
export async function handler(event: ProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = getAuthorizer(event);

    // Staging protection: if STAGING_TOKEN is configured, require it in the Authorization header.
    const stagingToken = process.env.STAGING_TOKEN;
    if (stagingToken && !authorizer?.apiKeyId) {
      const headers = getHeaders(event);
      const auth = headers["authorization"] ?? headers.Authorization ?? "";
      if (auth !== `Bearer ${stagingToken}`) {
        return {
          statusCode: 401,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "UNAUTHORIZED", message: "Missing or invalid staging token" }),
        };
      }
    }

    // Use `||` not `??` — empty string env vars are falsy but not nullish.
    const apiKeyId = authorizer?.apiKeyId || authorizer?.sub || stagingToken || "dev-test-key";

    // Rate limit check
    const result = await rateLimiter.consume(apiKeyId);
    if (!result.allowed) {
      return {
        statusCode: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(result.retryAfter ?? 1)),
        },
        body: JSON.stringify({
          error: "THROTTLED",
          message: "Rate limit exceeded",
        }),
      };
    }

    // Forward to upstream
    const upstreamResponse = await forwardRequest(event, upstreamUrl);

    return {
      statusCode: upstreamResponse.status,
      headers: filterResponseHeaders(upstreamResponse.headers),
      body: await upstreamResponse.text(),
    };
  } catch (err) {
    if (err instanceof AppError) return err.toLambdaResponse();
    return new InternalError("Internal server error", err).toLambdaResponse();
  }
}

/** Forwards the API Gateway event as an HTTP request to the upstream. */
async function forwardRequest(event: ProxyEvent, baseUrl: string): Promise<Response> {
  const path = getPath(event);
  const queryParams = getQueryParams(event);
  const headers = filterForwardHeaders(getHeaders(event));

  const targetUrl = buildTargetUrl(baseUrl, path, queryParams);

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 29_000);

  try {
    return await fetch(targetUrl, {
      method: getMethod(event),
      headers,
      body: event.body ? event.body : undefined,
      signal: controller.signal,
      redirect: "manual",
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new InternalError("Upstream request timed out");
    }
    if (err instanceof Error && err.message.includes("aborted")) {
      throw new InternalError("Upstream request timed out");
    }
    throw new InternalError("Upstream request failed", err);
  } finally {
    clearTimeout(timeout);
  }
}

/** Builds the full target URL with path and query string. */
function buildTargetUrl(
  baseUrl: string,
  path: string,
  queryParams: Record<string, string | undefined> | null,
): string {
  const url = new URL(path, baseUrl);
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }
  }
  return url.toString();
}

/** Returns a new headers object with internal/security-sensitive headers removed. */
function filterForwardHeaders(
  headers: Record<string, string | undefined>,
): Record<string, string> {
  const filtered: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value !== undefined && !STRIP_HEADERS.has(name.toLowerCase())) {
      filtered[name] = value;
    }
  }
  return filtered;
}

/** Returns only safe response headers forwarded to the client. */
function filterResponseHeaders(headers: Headers): Record<string, string> {
  const filtered: Record<string, string> = {};
  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === "content-type" || lower === "content-length" || lower.startsWith("x-")) {
      filtered[key] = value;
    }
  });
  return filtered;
}

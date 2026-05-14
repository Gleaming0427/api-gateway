/**
 * API Gateway proxy handler. Pipeline: rate-limit → forward to upstream → return response.
 * Uses the apiKeyId from the authorizer context as the rate-limit key.
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
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

/** Handler for API Gateway REST API proxy integration. */
export async function handler(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer as
      | Record<string, string>
      | undefined;

    // Staging protection: if STAGING_TOKEN is configured, require it in the Authorization header.
    // This prevents an open proxy when the staging URL is deployed publicly.
    const stagingToken = process.env.STAGING_TOKEN;
    if (stagingToken && !authorizer?.apiKeyId) {
      const auth = event.headers["authorization"] ?? event.headers.Authorization ?? "";
      if (auth !== `Bearer ${stagingToken}`) {
        return {
          statusCode: 401,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "UNAUTHORIZED", message: "Missing or invalid staging token" }),
        };
      }
    }

    // In staging/dev the authorizer is skipped — use the sub claim or the staging token as the key, or a fixed dev key.
    const apiKeyId = authorizer?.apiKeyId ?? authorizer?.sub ?? stagingToken ?? "dev-test-key";

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
async function forwardRequest(
  event: APIGatewayProxyEvent,
  baseUrl: string,
): Promise<Response> {
  const targetUrl = buildTargetUrl(baseUrl, event.path, event.queryStringParameters);
  const headers = filterForwardHeaders(event.headers);

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 29_000);

  try {
    return await fetch(targetUrl, {
      method: event.httpMethod,
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

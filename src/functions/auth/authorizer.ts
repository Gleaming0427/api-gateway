/**
 * API Gateway REST API Lambda Authorizer (TOKEN type).
 * Validates the JWT Bearer token, resolves keys via JWKS, and returns an IAM policy.
 * Fail-closed: any error results in a Deny policy.
 */
import { decodeProtectedHeader } from "jose";
import { createHash } from "node:crypto";
import type {
  APIGatewayTokenAuthorizerEvent,
  APIGatewayAuthorizerResult,
} from "aws-lambda";
import { validateToken } from "../../core/jwt";
import type { JwtOptions } from "../../core/jwt";
import { UnauthorizedError } from "../../core/errors";
import { CachedJwksFetcher } from "../../adapters/jwks";

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- env vars guaranteed by SST Resource binding
const jwksUrl = process.env.JWKS_URL!;
const jwtOptions: JwtOptions = {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  issuer: process.env.JWT_ISSUER!,
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  audience: process.env.JWT_AUDIENCE!,
  maxTokenAge: Number(process.env.MAX_TOKEN_AGE) || 86400, // 24h default
};

/** Shared JWKS fetcher — lives across warm Lambda invocations. */
const fetcher = new CachedJwksFetcher(jwksUrl);

/** Handler for API Gateway TOKEN authorizer events. */
export async function handler(
  event: APIGatewayTokenAuthorizerEvent,
): Promise<APIGatewayAuthorizerResult> {
  const methodArn = event.methodArn;

  try {
    const token = extractBearerToken(event.authorizationToken);
    if (!token) return deny(methodArn);
    const kid = extractKid(token);

    const payload = await validateToken(token, jwtOptions, fetcher);
    const apiKeyId = (payload.api_key_id as string | undefined) ?? payload.sub;

    console.log({
      event: "authorized",
      sub: hashSub(payload.sub),
      kid,
    });

    return allow(methodArn, payload.sub, {
      apiKeyId,
      sub: payload.sub,
      scope: payload.scope ?? "",
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      console.log({ event: "unauthorized", reason: err.message });
      return deny(methodArn);
    }

    console.error({
      event: "authorizer_error",
      error: err instanceof Error ? err.constructor.name : typeof err,
    });
    return deny(methodArn);
  }
}

/** Extracts the Bearer token from the Authorization header. */
function extractBearerToken(header: string): string | null {
  if (!header) return null;
  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== "bearer") return null;
  return parts[1] ?? null;
}

/** Returns a truncated SHA-256 hex digest of `sub` for audit-safe logging. */
function hashSub(sub: string): string {
  return createHash("sha256").update(sub).digest("hex").slice(0, 12);
}

/** Decodes the JWT header to extract the kid for logging. */
function extractKid(token: string): string | null {
  try {
    const header = decodeProtectedHeader(token);
    const kid = header.kid;
    return typeof kid === "string" ? kid : null;
  } catch {
    return null;
  }
}

/** Builds an Allow IAM policy with authorizer context forwarded to the gateway Lambda. */
function allow(
  methodArn: string,
  principalId: string,
  context: Record<string, string>,
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: "Allow",
          Resource: methodArn,
        },
      ],
    },
    context,
  };
}

/** Builds a Deny IAM policy. */
function deny(methodArn: string): APIGatewayAuthorizerResult {
  return {
    principalId: "unauthorized",
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: "Deny",
          Resource: methodArn,
        },
      ],
    },
  };
}

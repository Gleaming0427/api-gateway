/**
 * JWT RS256 validation with pluggable JWKS fetcher.
 * Validates signature, expiry, issuer, and audience. Pure logic — no AWS imports.
 */
import jwt from "jsonwebtoken";
import { UnauthorizedError, InternalError } from "./errors";

export interface JwksFetcher {
  getKey(kid: string): Promise<string>;
}

export interface JwtOptions {
  issuer: string;
  audience: string;
  clockTolerance?: number; // seconds
}

export interface JwtPayload {
  sub: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  scope?: string;
  [key: string]: unknown;
}

/** Validates a JWT token: decodes header, fetches public key via JWKS, verifies RS256 signature, checks claims. */
export async function validateToken(
  token: string,
  options: JwtOptions,
  fetchKey: JwksFetcher,
): Promise<JwtPayload> {
  // Decode header without verifying to extract kid and alg
  const decoded = jwt.decode(token, { complete: true });
  if (decoded === null || typeof decoded === "string") {
    throw new UnauthorizedError("Invalid token format");
  }

  const { kid, alg } = decoded.header;

  if (!kid) {
    throw new UnauthorizedError("Token header missing kid");
  }

  if (alg !== "RS256") {
    throw new UnauthorizedError(`Unsupported algorithm: ${alg ?? "none"}`);
  }

  // Fetch the public key
  let publicKey: string;
  try {
    const key = await fetchKey.getKey(kid);
    if (!key) {
      throw new InternalError(`No key found for kid`);
    }
    publicKey = key;
  } catch (err) {
    if (err instanceof UnauthorizedError || err instanceof InternalError)
      throw err;
    throw new InternalError("JWKS fetch failed", err);
  }

  // Verify signature
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
      issuer: options.issuer,
      audience: options.audience,
      clockTolerance: options.clockTolerance ?? 0,
    }) as JwtPayload;
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      const message = err.message.toLowerCase();
      if (message.includes("expired")) {
        throw new UnauthorizedError("Token has expired");
      }
      if (message.includes("issuer")) {
        throw new UnauthorizedError("Invalid token issuer");
      }
      if (message.includes("audience")) {
        throw new UnauthorizedError("Invalid token audience");
      }
      throw new UnauthorizedError("Invalid token signature");
    }
    if (err instanceof jwt.NotBeforeError) {
      throw new UnauthorizedError("Token not yet valid");
    }
    throw new InternalError("Token verification failed", err);
  }

  // Validate sub is present
  if (!payload.sub) {
    throw new UnauthorizedError("Token missing sub claim");
  }

  return payload;
}

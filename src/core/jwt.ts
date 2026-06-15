/**
 * JWT RS256 validation with pluggable JWKS fetcher.
 * Validates signature, expiry, issuer, and audience. Pure logic — no AWS imports.
 */
import {
  jwtVerify,
  decodeProtectedHeader,
  importSPKI,
} from "jose";
import {
  JWTExpired,
  JWTClaimValidationFailed,
  JWTInvalid,
  JWSSignatureVerificationFailed,
} from "jose/errors";
import { UnauthorizedError, InternalError } from "./errors";

export interface JwksFetcher {
  getKey(kid: string): Promise<string>;
}

export interface JwtOptions {
  issuer: string;
  audience: string;
  clockTolerance?: number; // seconds
  maxTokenAge?: number; // seconds since iat — rejects tokens older than this
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
  // Decode protected header without verifying
  let header: { kid?: string; alg?: string };
  try {
    header = decodeProtectedHeader(token);
  } catch {
    throw new UnauthorizedError("Invalid token format");
  }

  const { kid, alg } = header;

  if (!kid) {
    throw new UnauthorizedError("Token header missing kid");
  }

  if (alg !== "RS256") {
    throw new UnauthorizedError(`Unsupported algorithm: ${alg ?? "none"}`);
  }

  // Fetch the public key
  let publicKeyPem: string;
  try {
    const key = await fetchKey.getKey(kid);
    if (!key) {
      throw new InternalError("No key found for kid");
    }
    publicKeyPem = key;
  } catch (err) {
    if (err instanceof UnauthorizedError || err instanceof InternalError)
      throw err;
    throw new InternalError("JWKS fetch failed", err);
  }

  // Import public key and verify
  let publicKey: Awaited<ReturnType<typeof importSPKI>>;
  try {
    publicKey = await importSPKI(publicKeyPem, alg);
  } catch {
    throw new UnauthorizedError("Invalid public key");
  }

  try {
    const { payload } = await jwtVerify(token, publicKey, {
      issuer: options.issuer,
      audience: options.audience,
      clockTolerance: options.clockTolerance ?? 0,
    });

    if (!payload.sub) {
      throw new UnauthorizedError("Token missing sub claim");
    }

    // Enforce maxTokenAge when configured
    if (options.maxTokenAge !== undefined && payload.iat) {
      const ageSeconds = Math.floor(Date.now() / 1000) - payload.iat;
      if (ageSeconds > options.maxTokenAge) {
        throw new UnauthorizedError("Token exceeds maximum age");
      }
    }

    return payload as unknown as JwtPayload;
  } catch (err) {
    if (err instanceof JWTExpired) {
      throw new UnauthorizedError("Token has expired");
    }
    if (err instanceof JWTClaimValidationFailed) {
      if (err.claim === "iss") {
        throw new UnauthorizedError("Invalid token issuer");
      }
      if (err.claim === "aud") {
        throw new UnauthorizedError("Invalid token audience");
      }
      throw new UnauthorizedError(`Invalid token claim: ${err.claim}`);
    }
    if (err instanceof JWTInvalid) {
      throw new UnauthorizedError("Invalid token signature");
    }
    if (err instanceof JWSSignatureVerificationFailed) {
      throw new UnauthorizedError("Invalid token signature");
    }
    if (err instanceof UnauthorizedError) throw err;
    throw new InternalError("Token verification failed", err);
  }
}

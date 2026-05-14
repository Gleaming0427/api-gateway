import { describe, it, expect } from "vitest";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { validateToken, JwksFetcher } from "../src/core/jwt";
import { UnauthorizedError, InternalError } from "../src/core/errors";

function generateKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKey, privateKey };
}

const { publicKey, privateKey } = generateKeyPair();

function createFetcher(keyMap: Record<string, string>): JwksFetcher {
  return {
    async getKey(kid: string) {
      return keyMap[kid] ?? "";
    },
  };
}

const validOptions = {
  issuer: "https://auth.example.com",
  audience: "api-gateway",
};

function signToken(
  claims: Record<string, unknown>,
  overrides?: { kid?: string },
): string {
  // Only set expiresIn if claims don't already have exp
  return jwt.sign(claims, privateKey, {
    algorithm: "RS256",
    keyid: overrides?.kid ?? "key-1",
    ...(claims.exp === undefined ? { expiresIn: "1h" } : {}),
  });
}

describe("validateToken", () => {
  const fetcher = createFetcher({ "key-1": publicKey });

  it("validates a valid token and returns payload", async () => {
    const token = signToken({
      sub: "user-123",
      iss: "https://auth.example.com",
      aud: "api-gateway",
    });
    const payload = await validateToken(token, validOptions, fetcher);
    expect(payload.sub).toBe("user-123");
    expect(payload.iss).toBe("https://auth.example.com");
    expect(payload.aud).toBe("api-gateway");
  });

  it("returns custom claims in payload", async () => {
    const token = signToken({
      sub: "user-123",
      iss: "https://auth.example.com",
      aud: "api-gateway",
      scope: "read:users",
      role: "admin",
    });
    const payload = await validateToken(token, validOptions, fetcher);
    expect(payload.scope).toBe("read:users");
    expect(payload.role).toBe("admin");
  });

  it("throws UnauthorizedError for expired token", async () => {
    const token = jwt.sign(
      { sub: "user-123", iss: "https://auth.example.com", aud: "api-gateway" },
      privateKey,
      { algorithm: "RS256", keyid: "key-1", expiresIn: "0s" },
    );
    await new Promise((r) => setTimeout(r, 50));
    await expect(
      validateToken(token, validOptions, fetcher),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError for wrong signature", async () => {
    const { privateKey: otherKey } = generateKeyPair();
    const token = jwt.sign(
      { sub: "user-123", iss: "https://auth.example.com", aud: "api-gateway" },
      otherKey,
      { algorithm: "RS256", keyid: "key-1" },
    );
    await expect(
      validateToken(token, validOptions, fetcher),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError when iss does not match", async () => {
    const token = signToken({
      sub: "user-123",
      iss: "https://wrong-issuer.com",
      aud: "api-gateway",
    });
    await expect(
      validateToken(token, validOptions, fetcher),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError when aud does not match", async () => {
    const token = signToken({
      sub: "user-123",
      iss: "https://auth.example.com",
      aud: "wrong-audience",
    });
    await expect(
      validateToken(token, validOptions, fetcher),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError when header has no kid", async () => {
    const token = jwt.sign(
      { sub: "user-123", iss: "https://auth.example.com", aud: "api-gateway" },
      privateKey,
      { algorithm: "RS256" },
    );
    await expect(
      validateToken(token, validOptions, fetcher),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError when alg is not RS256", async () => {
    // Manually craft a JWT with HS256 using a symmetric key
    const hs256Key = crypto.randomBytes(32).toString("hex");
    const token = jwt.sign(
      { sub: "user-123", iss: "https://auth.example.com", aud: "api-gateway" },
      hs256Key,
      { algorithm: "HS256", keyid: "key-1" },
    );
    await expect(
      validateToken(token, validOptions, fetcher),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError when token is missing sub", async () => {
    const token = jwt.sign(
      { iss: "https://auth.example.com", aud: "api-gateway" },
      privateKey,
      { algorithm: "RS256", keyid: "key-1" },
    );
    await expect(
      validateToken(token, validOptions, fetcher),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws InternalError when fetcher throws", async () => {
    const badFetcher: JwksFetcher = {
      async getKey(_kid: string) {
        throw new Error("network error");
      },
    };
    const token = signToken({
      sub: "user-123",
      iss: "https://auth.example.com",
      aud: "api-gateway",
    });
    await expect(
      validateToken(token, validOptions, badFetcher),
    ).rejects.toThrow(InternalError);
  });

  it("throws InternalError when fetcher returns empty key", async () => {
    const emptyFetcher = createFetcher({ "key-1": "" });
    const token = signToken({
      sub: "user-123",
      iss: "https://auth.example.com",
      aud: "api-gateway",
    });
    await expect(
      validateToken(token, validOptions, emptyFetcher),
    ).rejects.toThrow(InternalError);
  });

  it("clockTolerance allows slightly expired token", async () => {
    const past = Math.floor(Date.now() / 1000) - 4;
    const token = jwt.sign(
      {
        sub: "user-123",
        iss: "https://auth.example.com",
        aud: "api-gateway",
        iat: past - 3600,
        exp: past,
      },
      privateKey,
      { algorithm: "RS256", keyid: "key-1" },
    );
    const payload = await validateToken(
      token,
      { ...validOptions, clockTolerance: 5 },
      fetcher,
    );
    expect(payload.sub).toBe("user-123");
  });

  it("clockTolerance beyond threshold still throws", async () => {
    const past = Math.floor(Date.now() / 1000) - 6;
    const token = jwt.sign(
      {
        sub: "user-123",
        iss: "https://auth.example.com",
        aud: "api-gateway",
        iat: past - 3600,
        exp: past,
      },
      privateKey,
      { algorithm: "RS256", keyid: "key-1" },
    );
    await expect(
      validateToken(token, { ...validOptions, clockTolerance: 5 }, fetcher),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError for garbled token string", async () => {
    await expect(
      validateToken("not-a-jwt", validOptions, fetcher),
    ).rejects.toThrow(UnauthorizedError);
  });
});

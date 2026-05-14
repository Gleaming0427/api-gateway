import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { SignJWT } from "jose";
import { validateToken, JwksFetcher } from "../src/core/jwt";
import { UnauthorizedError, InternalError } from "../src/core/errors";

function generateKeyPair(): {
  publicKey: string;
  privateKey: crypto.KeyObject;
} {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return {
    publicKey,
    privateKey: crypto.createPrivateKey(privateKey),
  };
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

async function signToken(
  claims: Record<string, unknown>,
  overrides?: { kid?: string },
): Promise<string> {
  const builder = new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: overrides?.kid ?? "key-1" });

  if (claims.exp === undefined) {
    builder.setExpirationTime("1h");
  }

  return builder.sign(privateKey);
}

describe("validateToken", () => {
  const fetcher = createFetcher({ "key-1": publicKey });

  it("validates a valid token and returns payload", async () => {
    const token = await signToken({
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
    const token = await signToken({
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
    const token = await new SignJWT({
      sub: "user-123",
      iss: "https://auth.example.com",
      aud: "api-gateway",
    })
      .setProtectedHeader({ alg: "RS256", kid: "key-1" })
      .setExpirationTime("0s")
      .sign(privateKey);
    await new Promise((r) => setTimeout(r, 50));
    await expect(
      validateToken(token, validOptions, fetcher),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError for wrong signature", async () => {
    const { privateKey: otherKey } = generateKeyPair();
    const token = await new SignJWT({
      sub: "user-123",
      iss: "https://auth.example.com",
      aud: "api-gateway",
    })
      .setProtectedHeader({ alg: "RS256", kid: "key-1" })
      .setExpirationTime("1h")
      .sign(otherKey);
    await expect(
      validateToken(token, validOptions, fetcher),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError when iss does not match", async () => {
    const token = await signToken({
      sub: "user-123",
      iss: "https://wrong-issuer.com",
      aud: "api-gateway",
    });
    await expect(
      validateToken(token, validOptions, fetcher),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError when aud does not match", async () => {
    const token = await signToken({
      sub: "user-123",
      iss: "https://auth.example.com",
      aud: "wrong-audience",
    });
    await expect(
      validateToken(token, validOptions, fetcher),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError when header has no kid", async () => {
    const token = await new SignJWT({
      sub: "user-123",
      iss: "https://auth.example.com",
      aud: "api-gateway",
    })
      .setProtectedHeader({ alg: "RS256" })
      .setExpirationTime("1h")
      .sign(privateKey);
    await expect(
      validateToken(token, validOptions, fetcher),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError when alg is not RS256", async () => {
    const token = await new SignJWT({
      sub: "user-123",
      iss: "https://auth.example.com",
      aud: "api-gateway",
    })
      .setProtectedHeader({ alg: "HS256", kid: "key-1" })
      .setExpirationTime("1h")
      .sign(crypto.randomBytes(32));
    await expect(
      validateToken(token, validOptions, fetcher),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError when token is missing sub", async () => {
    const token = await new SignJWT({
      iss: "https://auth.example.com",
      aud: "api-gateway",
    })
      .setProtectedHeader({ alg: "RS256", kid: "key-1" })
      .setExpirationTime("1h")
      .sign(privateKey);
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
    const token = await signToken({
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
    const token = await signToken({
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
    const token = await new SignJWT({
      sub: "user-123",
      iss: "https://auth.example.com",
      aud: "api-gateway",
      iat: past - 3600,
      exp: past,
    })
      .setProtectedHeader({ alg: "RS256", kid: "key-1" })
      .sign(privateKey);
    const payload = await validateToken(
      token,
      { ...validOptions, clockTolerance: 5 },
      fetcher,
    );
    expect(payload.sub).toBe("user-123");
  });

  it("clockTolerance beyond threshold still throws", async () => {
    const past = Math.floor(Date.now() / 1000) - 6;
    const token = await new SignJWT({
      sub: "user-123",
      iss: "https://auth.example.com",
      aud: "api-gateway",
      iat: past - 3600,
      exp: past,
    })
      .setProtectedHeader({ alg: "RS256", kid: "key-1" })
      .sign(privateKey);
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

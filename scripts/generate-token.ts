/**
 * Generates a JWT token signed with the local private key for dev testing.
 * Usage: npx tsx scripts/generate-token.ts
 * Prints a curl command ready to paste.
 */
import { readFileSync } from "node:fs";
import { createPrivateKey } from "node:crypto";
import { SignJWT } from "jose";

const privateKeyPem = readFileSync(
  new URL("private.pem", import.meta.url),
  "utf-8",
);

const privateKey = createPrivateKey(privateKeyPem);

const token = await new SignJWT({
  sub: "test-api-key-001",
  iss: "https://local-dev.example.com",
  aud: "api.example.com",
})
  .setProtectedHeader({ alg: "RS256", kid: "dev-key-1" })
  .setExpirationTime("24h")
  .sign(privateKey);

const url = process.argv[2] ?? "http://localhost:3000/get";

console.log(`curl -i ${url} -H "Authorization: Bearer ${token}"`);

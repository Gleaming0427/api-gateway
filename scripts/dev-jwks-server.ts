/**
 * Local JWKS server for development.
 * Serves the public key from scripts/public.pem as a JWKS endpoint.
 * Usage: npx tsx scripts/dev-jwks-server.ts
 * Then set JwksUrl = "http://localhost:4567/.well-known/jwks.json"
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { createPublicKey } from "node:crypto";

const PORT = 4567;
const publicKeyPem = readFileSync(
  new URL("public.pem", import.meta.url),
  "utf-8",
);

const key = createPublicKey(publicKeyPem);
const jwk = key.export({ format: "jwk" });
const jwks = { keys: [{ ...jwk, kid: "dev-key-1", alg: "RS256", use: "sig" }] };

createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(jwks));
}).listen(PORT, () => {
  console.log(`JWKS server → http://localhost:${String(PORT)}/.well-known/jwks.json`);
});

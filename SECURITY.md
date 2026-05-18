# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 2.x | ✅ |
| 1.x | ❌ |

## Reporting a vulnerability

Do NOT open a public issue. Email **jigsaw_culpable558@simplelogin.com** with details.

## Dependencies

- `jose` — 0 known CVEs
- `zod` — 0 known CVEs
- `@aws-sdk/*` — optional, template only

Dependencies are pinned to exact versions. Run `npm audit` in CI on every push.

## Architecture

- JWT validation is fail-closed — any error returns Deny
- Rate limiter runs before any upstream call
- SSRF protection: path validation (rejects `//authority` paths) + origin check + `fetch({ redirect: "manual" })`
- Response header whitelist — only safe headers forwarded to the client (no `x-powered-by`, `x-debug-trace`, `x-amzn-requestid`)
- JWKS fetch has a 5-second timeout — prevents Lambda authorizer hanging on unresponsive endpoints
- Rate limiter uses atomic DynamoDB writes (UpdateItem + ConditionExpression) to prevent TOCTOU over-consumption
- JWT `maxTokenAge` enforcement — rejects tokens older than a configurable threshold
- Secrets via SST encrypted state, never in code
- Lambda authorizer logs `sub` and `kid`, never the token

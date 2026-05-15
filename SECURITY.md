# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 1.x | ✅ |

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
- SSRF protection: `fetch({ redirect: "manual" })`
- Secrets via SST encrypted state, never in code
- Lambda authorizer logs `sub` and `kid`, never the token

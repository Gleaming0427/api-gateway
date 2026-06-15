# Changelog

## 2.0.0 — Security hardening (2026-05-18)

### Security fixes
- **CRITICAL**: SSRF protection in proxy URL builder — rejects `//authority` paths and verifies origin after URL resolution
- **MEDIUM**: Atomic rate limiter writes via `UpdateItem` + `ConditionExpression` (TOCTOU race condition fix)
- **MEDIUM**: 5-second timeout on JWKS fetch (prevents Lambda authorizer DoS)
- **MEDIUM**: Response header whitelist — replaces `x-*` wildcard, prevents internal header leakage
- **LOW**: Negative token validation in `RateLimiter.consume()`
- **LOW**: `maxTokenAge` JWT option — rejects tokens exceeding a configurable age
- **INFO**: Staging rate-limit key now includes source IP (prevents self-throttling under load tests)

### Breaking changes
- `RateLimiterStore` gains optional `atomicConsume` method
- `JwtOptions` gains optional `maxTokenAge` field
- Response headers use explicit whitelist instead of `x-*` pass-through

## 1.0.x — Phase 2 (2026-05-14)

### Added
- SST infrastructure template: Lambda, DynamoDB, API Gateway
- Lambda authorizer (JWT RS256, IAM policy, 5 min cache)
- Lambda proxy/gateway (rate-limit → forward upstream)
- DynamoDB rate limiter store adapter
- JWKS fetcher with in-memory cache and stale-while-revalidate
- CI/CD workflows: npm publish on tag, deploy on manual trigger
- Staging mode: Lambda Function URL, no auth, 1 secret
- Production mode: API Gateway REST + authorizer (not yet deployed)
- Security hardening: `jose` (0 CVE), SSRF protection, staging token

### Changed
- `jsonwebtoken` → `jose` (0 CVE, smaller bundle)
- AWS SDK moved to optional peerDependencies
- Proxy handler supports V1, V2, and Function URL events

### Fixed
- `||` vs `??` pitfall: empty env vars are falsy but not nullish
- SST `api.route()` bug: link/env not propagated to route Lambdas
- DynamoDB empty key crash when `STAGING_TOKEN` is `""`

## 1.0.0 — Phase 1 (2026-05-13)

### Added
- `RateLimiter`: token bucket with pluggable store
- `validateToken`: RS256 JWT validation with pluggable JWKS fetcher
- `validate`: Zod-based request validation
- `AppError` hierarchy: `UnauthorizedError`, `ThrottledError`, `ValidationError`, `InternalError`
- Public API surface: `RateLimiter`, `validateToken`, `validate`, `AppError`

# @armored1486/api-gateway-core

[![npm version](https://img.shields.io/npm/v/@armored1486/api-gateway-core)](https://www.npmjs.com/package/@armored1486/api-gateway-core)
[![npm downloads](https://img.shields.io/npm/dm/@armored1486/api-gateway-core)](https://www.npmjs.com/package/@armored1486/api-gateway-core)
[![install size](https://packagephobia.com/badge?p=@armored1486/api-gateway-core)](https://packagephobia.com/result?p=@armored1486/api-gateway-core)
[![types](https://img.shields.io/npm/types/@armored1486/api-gateway-core)](https://www.npmjs.com/package/@armored1486/api-gateway-core)
[![license](https://img.shields.io/npm/l/@armored1486/api-gateway-core)](./LICENSE)

Serverless-native API Gateway toolkit — **token-bucket rate limiting, RS256 JWT auth, and typed errors**. Pure logic with zero AWS imports, so it drops into any runtime (Lambda, Node, edge). Where `express-rate-limit` + `jsonwebtoken` leave you wiring storage and error shapes by hand, this ships a pluggable atomic store and a machine-readable error contract out of the box.

```bash
npm install @armored1486/api-gateway-core
```

## Requirements

- **Node ≥ 22**
- **ESM only** — ships as ES modules (`import`); there is no CommonJS (`require`) build.

## What's inside

| Module | What it does |
|---|---|
| `RateLimiter` | Token bucket rate limiter with pluggable store (in-memory, DynamoDB, Redis) |
| `validateToken` | RS256 JWT validation with pluggable JWKS fetcher |
| `validate` | Zod-based request validation with typed errors |
| `AppError` | Typed error hierarchy — HTTP status + machine-readable code |

## RateLimiter

```ts
import { RateLimiter } from "@armored1486/api-gateway-core";
import type { RateLimiterStore, BucketState } from "@armored1486/api-gateway-core";

const store: RateLimiterStore = new MyStore(); // implement get/set
const limiter = new RateLimiter(store, { capacity: 100, refillRate: 10 });

const result = await limiter.consume("api-key-abc");
// { allowed: true, remaining: 99 }
// { allowed: false, remaining: 0, retryAfter: 5.2 }
```

The store is **pluggable** — implement `get(key)`, `set(key, state)`, and optionally `atomicConsume(key, tokens, capacity, refillRate)` using any backend (DynamoDB, Redis, PostgreSQL). The optional `atomicConsume` folds read-modify-write into one round trip and prevents TOCTOU race conditions under concurrency. The rate limiter is pure logic with zero runtime dependencies.

## JWT validation

```ts
import { validateToken } from "@armored1486/api-gateway-core";
import type { JwksFetcher } from "@armored1486/api-gateway-core";

const fetcher: JwksFetcher = {
  async getKey(kid: string) {
    // Fetch from JWKS endpoint, return the public key as a PEM (SPKI) string
    return "-----BEGIN PUBLIC KEY-----...";
  },
};

const payload = await validateToken(token, {
  issuer: "https://auth.example.com",
  audience: "api-gateway",
  maxTokenAge: 86_400, // 24h — reject tokens older than this (since iat)
  clockTolerance: 30,  // 30s clock skew
}, fetcher);
// { sub: "user-123", iss: "...", aud: "...", exp: 1712345678, ... }
```

Only `RS256` is accepted; tokens with any other `alg` are rejected.

## Validation

```ts
import { validate } from "@armored1486/api-gateway-core";
import { z } from "zod";

const schema = z.object({ name: z.string(), age: z.number() });
const data = validate(schema, req.body);
// data is typed as { name: string; age: number }
```

## Error codes

Every error extends `AppError` and carries a machine-readable `code`. **These codes are a public API contract.**

| Class | HTTP | Code |
|---|---|---|
| `UnauthorizedError` | 401 | `UNAUTHORIZED` |
| `ThrottledError` | 429 | `THROTTLED` |
| `ValidationError` | 400 | `VALIDATION_ERROR` |
| `InternalError` | 500 | `INTERNAL_ERROR` |

```ts
import { AppError } from "@armored1486/api-gateway-core";

try {
  await doSomething();
} catch (err) {
  if (err instanceof AppError) {
    return err.toLambdaResponse();
    // {
    //   statusCode: 429,
    //   headers: { "Content-Type": "application/json", "Retry-After": "5.2" },
    //   body: '{"error":"THROTTLED","message":"Rate limit exceeded"}'
    // }
  }
}
```

`InternalError` always serializes a generic body — the underlying cause is preserved on the instance for logging only, never sent to the client.

## Performance

The rate limiter is pure in-memory arithmetic — it does no I/O of its own. End-to-end latency is dominated entirely by the store you inject (≈ a single DynamoDB read in the template). Implementing the optional `atomicConsume` keeps that to one network round trip even under high concurrency.

## Bundle size

Under 50 KB gzipped (published tarball ≈ 10 KB). Two runtime dependencies: [Zod](https://zod.dev) and [jose](https://github.com/panva/jose). The AWS SDK is an optional peer dependency, only pulled in by the DynamoDB store in the template.

## Deploy the full gateway

This package is the pure-logic core. Its companion template wires it into a deployable, multi-region AWS stack — API Gateway + Lambda (ARM/Graviton) + DynamoDB Global Tables — via [SST](https://sst.dev):

```bash
npx sst deploy --stage production
```

You get latency-based routing to the nearest region, per-API-key rate tiers, and a cached JWT Lambda authorizer — production-grade API protection with no infrastructure to manage.

## Links

- [Changelog](./CHANGELOG.md)
- [Security policy](./SECURITY.md)

## License

MIT — see [LICENSE](./LICENSE).

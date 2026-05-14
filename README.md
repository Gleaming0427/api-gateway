# @armored1486/api-gateway-core

Serverless-native API Gateway toolkit — rate limiting, JWT auth, typed errors. Zero AWS imports. Under 50 KB gzipped.

```bash
npm install @armored1486/api-gateway-core
```

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

The store is **pluggable** — implement `get(key)` and `set(key, state)` using any backend (DynamoDB, Redis, PostgreSQL). The rate limiter is pure logic with zero runtime dependencies.

## JWT validation

```ts
import { validateToken } from "@armored1486/api-gateway-core";
import type { JwksFetcher } from "@armored1486/api-gateway-core";

const fetcher: JwksFetcher = {
  async getKey(kid: string) {
    // Fetch from JWKS endpoint, return PEM string
    return "-----BEGIN PUBLIC KEY-----...";
  },
};

const payload = await validateToken(token, {
  issuer: "https://auth.example.com",
  audience: "api-gateway",
}, fetcher);
// { sub: "user-123", iss: "...", aud: "...", exp: 1712345678, ... }
```

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
    // { statusCode: 429, headers: { "Retry-After": "5" }, body: '{"error":"THROTTLED","message":"..."}' }
  }
}
```

## Bundle size

Under 50 KB gzipped. Two runtime dependencies: [Zod](https://zod.dev) and [jose](https://github.com/panva/jose) (0 CVEs). AWS SDK is optional (only needed for DynamoDB adapter in the template).

## License

MIT

# CLAUDE.md — API Gateway HA pour SaaS B2B

## Build & Run Commands

```bash
# Dev (live-reload against AWS)
npx sst dev

# Deploy to staging
npx sst deploy --stage staging

# Deploy to production (multi-region)
npx sst deploy --stage production

# Type checking
npx tsc --noEmit

# Linting
npx eslint .

# Run tests
npx vitest run

# Run tests in watch mode
npx vitest

# Run a single test file
npx vitest run -t "rate-limiter"

# Format
npx prettier --write .
```

## Product Context

This project is a **product**, not a portfolio piece. It serves two audiences:

- **You (the builder)** — developing the core package (`@julienchapron/api-gateway-core`) and the SST template (`api-gateway-ha-template`).
- **Your client** — a B2B SaaS company that clones the template, configures their domain, and deploys to protect their customer-facing API.

When a client runs `npx sst deploy --stage production`, they get a production-grade multi-region API Gateway with rate limiting, JWT auth, and DynamoDB Global Tables. Their API consumers get <100ms P99 latency globally. The client gets enterprise-grade API protection they'd otherwise pay thousands/month for (Kong, Tyk, AWS WAF Advanced).

## Architecture

```
Route 53 (latency-based routing)
├── eu-west-1 (Ireland)
│   ├── API Gateway (REST)
│   ├── Lambda (authorizer + rate-limiter)
│   └── DynamoDB Global Table
└── us-east-1 (N. Virginia)
    ├── API Gateway (REST)
    ├── Lambda (authorizer + rate-limiter)
    └── DynamoDB Global Table
```

- **API Gateway** — REST API type, edge-optimized per region, custom domain with ACM cert
- **Lambda** — TypeScript handlers, minimal cold starts (512 MB, ARM/Graviton)
- **DynamoDB** — Global tables v2 for multi-region replication, on-demand capacity, P99 < 10ms
- **SST** — Ion mode for infrastructure-as-code, typed `Resource` bindings
- **JWT Auth** — RS256 asymmetric signing, Lambda authorizer caching (5 min TTL)
- **Rate Limiting** — Token bucket in DynamoDB, per-api-key granularity
- **Monitoring** — CloudWatch metrics + alarms (P99 latency, 5xx rate, throttle count)

### What This Means for Your Client

- **Latency-based routing** — your client's API consumers hit the nearest AWS region automatically, no client-side changes needed.
- **DynamoDB Global Tables** — your client can sign SLAs with multi-region failover guarantees. RPO = 0, RTO < 1s.
- **Token bucket rate limiter** — your client offers tiered API plans (Free: 100 req/min, Pro: 1000 req/min) with hard enforcement per API key.
- **JWT Lambda authorizer with cache** — your client's customers bring their own auth. 95%+ cache hit rate means auth adds <5ms P99 overhead.

## Project Structure

```
src/
├── stacks/        # SST infrastructure definitions (per region/env)
├── functions/     # Lambda handlers — one file per endpoint
│   ├── auth/      # JWT authorizer, token validation
│   └── gateway/   # Proxy, rate-limiter, request/response transforms
├── core/          # Shared business logic (no AWS imports)
│   ├── rate-limiter.ts
│   ├── jwt.ts
│   └── validation.ts
├── adapters/      # AWS-specific glue (DynamoDB client, CloudWatch)
└── types/         # Shared TypeScript types
```

### Package vs Template Boundary

This repo contains **two products** (see `docs/roadmap.md` for the business model):

**1. `@julienchapron/api-gateway-core`** (npm package)
Contains everything a developer needs to integrate rate limiting, JWT validation, and typed errors into their own infrastructure — without using SST.

- Ships: `src/core/`, `src/types/`
- Entry point: `src/core/index.ts`
- Zero AWS imports. Zero external runtime dependencies except Zod.

**2. `api-gateway-ha-template`** (GitHub template repo)
A cloneable SST project that wires the core package into a deployable multi-region API Gateway. The client clones this, configures their domain and secrets, and deploys.

- Ships: `src/stacks/`, `src/functions/`, `src/adapters/`, `sst.config.ts`
- Depends on: `@julienchapron/api-gateway-core`

## Conventions

- **Ports & Adapters** — `core/` contains pure logic; `adapters/` wraps AWS SDKs. Never import `aws-sdk` in `core/`.
- **SST Resources** — Always use `sst.Resource` bindings; never hardcode ARNs or table/function names.
- **Lambda handlers** — Export `handler` (not `main`). Keep handlers thin: parse → validate → call core → serialize.
- **Error model** — All errors extend `AppError` (in `core/errors.ts`). HTTP status code + machine-readable `code` field. Lambda authorizer returns `{ isAuthorized, context }`.
- **Testing** — `core/` tests are pure unit tests (vitest). Lambda handlers test with `sst dev --stage test`. Rate limiter tests use a real DynamoDB local table.
- **TypeScript** — strict mode ON. Prefer `interface` for public contracts, `type` for unions/derived types. No `any` — use `unknown` and narrow.
- **Secrets** — JWKS URL, signing keys, and API keys live in AWS Secrets Manager, accessed via `sst.Secret`.
- **Multi-region** — Every stack deploys identically to both regions. Region-specific config (domain, cert ARN) comes from `sst.Stage`-aware conditionals, never hardcoded.

### Commenting

Every file and every exported function must be commented. Comments answer **what** and **why**, never how (the code already says how).

**File header** — 1-2 lines max, placed at the very top:
```ts
/**
 * Token bucket rate limiter. Consumes tokens per key, refills over time.
 * Pure logic — no AWS imports, store injected via RateLimiterStore interface.
 */
```

**Exported functions** — 1 line, JSDoc format, placed directly above the function:
```ts
/** Consumes `tokens` for `key`. Returns allowed/denied with remaining count and optional retry delay. */
async consume(key: string, tokens = 1): Promise<ConsumeResult>
```

**Rules:**
- Only exported functions and classes require a comment. Private helpers don't (unless the WHY is non-obvious).
- Describe behavior and side effects, not implementation. "Validates signature and claims" not "calls jwt.verify with RS256".
- Keep it under 80 chars per line. If it needs more, the function is doing too much.
- Interfaces and type exports don't need comments if the name is self-documenting (`RateLimiterStore`, `JwtOptions`).
- Never write "This function..." — the reader already knows it's a function. Start with the verb.

### Product Conventions

- **Package boundaries** — `src/core/` and `src/types/` ship in the npm package. Everything under `src/stacks/`, `src/functions/`, `src/adapters/` lives only in the template. Never import from `src/adapters/` inside `src/core/` — this is a business requirement, not just architecture.
- **Bundle size budget** — The npm package must be <50 KB gzipped. Zero external runtime dependencies except Zod. A B2B SaaS dev evaluating the package compares install size against alternatives (express-rate-limit, jsonwebtoken, etc.).
- **Error codes are a public API contract** — Every `AppError.code` must be documented in the package README. Adding a new error code is a semver-minor change; changing an existing one is semver-major.
- **Benchmarks are sales collateral** — The local benchmark script (`scripts/benchmark.ts`) must produce numbers presentable to a prospect. P99 < 1ms local means the rate limiter does not degrade the client's API. Run and publish benchmarks before any client demo.

## Key Files

| File | Purpose |
|---|---|
| `sst.config.ts` | SST root config. Together with `src/stacks/ApiStack.ts`, this is the deployable template your client clones. |
| `src/stacks/ApiStack.ts` | The deployable infrastructure. Client runs `sst deploy` and gets a production-ready multi-region API Gateway. |
| `src/functions/auth/authorizer.ts` | JWT Lambda authorizer — validates tokens from your client's customers. 5-min cache, RS256. |
| `src/functions/gateway/proxy.ts` | Request pipeline: parse → rate-limit → forward. The 429 response is the first thing your client's customers see if they exceed their tier. |
| `src/core/rate-limiter.ts` | Ships in the npm package. Token bucket algorithm, pluggable store. The competitive moat: pure logic, no AWS. |
| `src/core/jwt.ts` | Ships in the npm package. RS256 token validation via pluggable JWKS fetcher. Zero AWS dependencies. |
| `src/core/index.ts` | Entry point for `@julienchapron/api-gateway-core`. Public API surface: `AppError`, `RateLimiter`, `validateToken`, `validate`. |
| `src/adapters/dynamo.ts` | Template adapter. Implements `RateLimiterStore` against DynamoDB Global Tables. NOT in the npm package. |
| `docs/deployment-guide.md` | Step-by-step guide a B2B SaaS CTO follows to deploy: domain, secrets, deploy, test. |
| `scripts/benchmark.ts` | Local benchmark producing numbers used in sales decks. P99 consume() < 1ms local, < 5ms DynamoDB. |

## Performance Budgets

- P99 latency < 100ms end-to-end
- Lambda cold start < 500ms (ARM, 512 MB, bundled with esbuild)
- DynamoDB reads < 5ms P99 (on-demand, no hot partitions)
- JWT authorizer cache hit > 95% (5 min TTL, shared across region)

These are not just engineering targets — they translate into SLAs your client can promise their own customers:

| Internal Target | Client-Side SLA | Why It Matters in Sales |
|---|---|---|
| P99 latency < 100ms | "P99 < 200ms for all API requests" | Client wins deals requiring SLA commitments |
| Lambda cold start < 500ms | "No request timeout > 1s" | Removes procurement friction — no "what about cold starts?" questions |
| DynamoDB reads < 5ms P99 | "Rate limiter adds < 10ms overhead" | Rate limiting is invisible to end users |
| JWT authorizer cache hit > 95% | "Auth adds < 20ms P99" | Token validation is nearly free |

## Go-to-Market Notes

### Positioning
"Serverless-native API Gateway for B2B SaaS companies that expose APIs to their customers. Deploy multi-region HA in hours, not months. No infrastructure to manage."

### ICP (Ideal Customer Profile)
- B2B SaaS, 5-50 employees, Seed to Series A
- AWS-native or AWS-willing
- API is a core revenue channel (not an internal tool)
- Currently losing deals because they cannot offer SLA guarantees
- Evaluating: AWS WAF (too limited), Kong/Tyk (too heavy), Zuplo (too early)

### Objection Handling
| Objection | Response |
|---|---|
| "We can just use API Gateway + WAF" | WAF rate limits are per-IP, not per-key. You can't tier your customers. |
| "We'll build it ourselves" | It'll take your team 3-6 months. This is deployed in a day. |
| "Kong handles this" | Kong means managing EC2 or EKS. This is serverless — zero infrastructure to manage. |
| "Why open source?" | The code is MIT. You can audit it, fork it, and customize it. You pay for implementation, not licensing. |

### Revenue Model
- **Open source** (MIT): `@julienchapron/api-gateway-core` + `api-gateway-ha-template` — goal: GitHub stars, npm downloads, authority.
- **Consulting**: Audit (assessment + migration plan), Implementation (deploy + customize), Managed (ongoing maintenance).

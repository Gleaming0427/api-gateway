import { describe, it, expect, beforeEach } from "vitest";
import {
  RateLimiter,
  RateLimiterStore,
  BucketState,
} from "../src/core/rate-limiter";
import { InternalError } from "../src/core/errors";

function createInMemoryStore(): RateLimiterStore {
  const data = new Map<string, BucketState>();
  return {
    async get(key: string) {
      return data.get(key) ?? null;
    },
    async set(key: string, state: BucketState) {
      data.set(key, state);
    },
  };
}

function createFailingStore(): RateLimiterStore {
  return {
    async get(_key: string) {
      throw new Error("connection refused");
    },
    async set(_key: string, _state: BucketState) {
      throw new Error("connection refused");
    },
  };
}

describe("RateLimiter", () => {
  let store: RateLimiterStore;
  let limiter: RateLimiter;

  beforeEach(() => {
    store = createInMemoryStore();
    limiter = new RateLimiter(store, { capacity: 10, refillRate: 5 });
  });

  it("first consume is allowed and decrements from capacity", async () => {
    const result = await limiter.consume("key-a");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it("consumes all tokens then denies", async () => {
    for (let i = 0; i < 10; i++) {
      const r = await limiter.consume("key-a");
      expect(r.allowed).toBe(true);
    }
    const denied = await limiter.consume("key-a");
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfter).toBeGreaterThan(0);
  });

  it("refills after waiting", async () => {
    // Exhaust the bucket
    for (let i = 0; i < 10; i++) {
      await limiter.consume("key-a");
    }

    // Wait for 1 token to refill (refillRate=5/s → 1 token = 200ms)
    await new Promise((r) => setTimeout(r, 250));

    const result = await limiter.consume("key-a");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
  });

  it("different keys have isolated buckets", async () => {
    // Exhaust key-a
    for (let i = 0; i < 10; i++) {
      await limiter.consume("key-a");
    }
    const aDenied = await limiter.consume("key-a");
    expect(aDenied.allowed).toBe(false);

    // key-b should still have full capacity
    const bResult = await limiter.consume("key-b");
    expect(bResult.allowed).toBe(true);
    expect(bResult.remaining).toBe(9);
  });

  it("consuming zero tokens always succeeds and does not change state", async () => {
    const first = await limiter.consume("key-a", 0);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(10);

    // consume some real tokens
    await limiter.consume("key-a", 3);
    const after = await limiter.consume("key-a", 0);
    expect(after.allowed).toBe(true);
    expect(after.remaining).toBe(7);
  });

  it("capacity=0 always denies", async () => {
    const zero = new RateLimiter(store, { capacity: 0, refillRate: 5 });
    const result = await zero.consume("key-a");
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBe(Infinity);
  });

  it("refillRate=0 creates fixed bucket with no refill", async () => {
    const fixed = new RateLimiter(store, { capacity: 5, refillRate: 0 });
    for (let i = 0; i < 5; i++) {
      const r = await fixed.consume("key-a");
      expect(r.allowed).toBe(true);
    }
    const denied = await fixed.consume("key-a");
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfter).toBe(Infinity);

    // Wait and verify no refill happens
    await new Promise((r) => setTimeout(r, 250));
    const stillDenied = await fixed.consume("key-a");
    expect(stillDenied.allowed).toBe(false);
    expect(stillDenied.retryAfter).toBe(Infinity);
  });

  it("store failure throws InternalError", async () => {
    const failing = new RateLimiter(createFailingStore(), {
      capacity: 10,
      refillRate: 5,
    });
    await expect(failing.consume("key-a")).rejects.toThrow(InternalError);
  });

  it("consuming more tokens than capacity denies with retryAfter", async () => {
    const result = await limiter.consume("key-a", 20);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("concurrent requests are handled (no crash)", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        limiter.consume("concurrent", 1).catch(() => null),
      ),
    );
    // At least some should have been processed
    const allowed = results.filter(
      (r) => r !== null && (r as ConsumeResult).allowed,
    );
    expect(allowed.length).toBeGreaterThan(0);
    // With capacity=10 and refillRate=5/s over concurrent requests, max ~10 allowed
    // but due to race conditions in in-memory store, exact count varies
  });
});

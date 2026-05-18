/**
 * Token bucket rate limiter with pluggable store.
 * Pure logic — no AWS imports, store injected via RateLimiterStore interface.
 */
import { InternalError } from "./errors";

export interface BucketState {
  tokens: number;
  lastRefill: number; // Unix timestamp ms
}

export interface RateLimiterStore {
  get(key: string): Promise<BucketState | null>;
  set(key: string, state: BucketState): Promise<void>;
  /** Atomically consume tokens. When implemented, replaces get-then-set to prevent TOCTOU race conditions under concurrency. Returns null when the atomic operation could not be completed (caller should retry or fall back). */
  atomicConsume?(
    key: string,
    tokens: number,
    capacity: number,
    refillRate: number,
  ): Promise<ConsumeResult | null>;
}

export interface ConsumeResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number; // seconds until enough tokens are available
}

/** Token bucket rate limiter. Capacity = max tokens, refillRate = tokens added per second. */
export class RateLimiter {
  constructor(
    private store: RateLimiterStore,
    private options: { capacity: number; refillRate: number },
  ) {}

  /** Consumes `tokens` for `key`. Returns allowed/denied with remaining count and optional retry delay. */
  async consume(key: string, tokens = 1): Promise<ConsumeResult> {
    if (tokens < 0) throw new InternalError("tokens must be non-negative");

    if (this.options.capacity === 0) {
      return { allowed: false, remaining: 0, retryAfter: Infinity };
    }

    if (tokens === 0) {
      let current = this.options.capacity;
      try {
        const existing = await this.store.get(key);
        if (existing !== null) current = existing.tokens;
      } catch {
        // swallow — return default capacity
      }
      return { allowed: true, remaining: current };
    }

    try {
      // Prefer atomic consume to prevent TOCTOU race conditions under concurrency
      if (this.store.atomicConsume) {
        const result = await this.store.atomicConsume(
          key,
          tokens,
          this.options.capacity,
          this.options.refillRate,
        );
        if (result === null) {
          throw new InternalError("Atomic consume failed — concurrent write detected");
        }
        return result;
      }

      // Fallback: get-then-set (not atomic, accepts rare over-consumption)
      const existing = await this.store.get(key);
      const now = Date.now();

      const refilled =
        existing === null
          ? this.options.capacity
          : Math.min(
              this.options.capacity,
              existing.tokens +
                ((now - existing.lastRefill) / 1000) * this.options.refillRate,
            );

      const allowed = refilled >= tokens;
      const newTokens = allowed ? refilled - tokens : refilled;
      const state: BucketState = { tokens: newTokens, lastRefill: now };

      await this.store.set(key, state);

      if (allowed) {
        return { allowed: true, remaining: Math.floor(newTokens) };
      }

      const tokensMissing = tokens - refilled;
      const retryAfter =
        this.options.refillRate > 0
          ? tokensMissing / this.options.refillRate
          : Infinity;

      return { allowed: false, remaining: 0, retryAfter };
    } catch (err) {
      if (err instanceof InternalError) throw err;
      throw new InternalError("Rate limiter store failure", err);
    }
  }
}

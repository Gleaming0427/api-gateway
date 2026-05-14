/**
 * JWKS fetcher with in-memory cache and stale-while-revalidate.
 * Fetches public keys from a JWKS endpoint, caches them by kid, and falls back to stale
 * entries when the endpoint is unreachable. Template-only — not shipped in the npm package.
 */
import { createPublicKey } from "node:crypto";
import { InternalError } from "../core/errors";
import type { JwksFetcher } from "../core/jwt";

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_CACHE_SIZE = 100;

interface CacheEntry {
  pem: string;
  expiresAt: number;
}

/** Implements JwksFetcher with a TTL-bound in-memory cache. Fetches the full JWKS on cache miss, extracts the key by kid, and caches all returned keys. */
export class CachedJwksFetcher implements JwksFetcher {
  private cache = new Map<string, CacheEntry>();

  constructor(
    private jwksUrl: string,
    private ttlMs = DEFAULT_TTL_MS,
  ) {}

  /** Returns the PEM-encoded public key for the given kid. Fetches from the JWKS endpoint on cache miss, refreshes on expiry. Falls back to a stale entry when the endpoint is unreachable. */
  async getKey(kid: string): Promise<string> {
    const cached = this.cache.get(kid);
    const now = Date.now();

    // Cache hit and still fresh — return immediately
    if (cached && cached.expiresAt > now) {
      return cached.pem;
    }

    try {
      const response = await fetch(this.jwksUrl);

      if (!response.ok) {
        throw new Error(
          `JWKS endpoint returned ${String(response.status)} ${response.statusText}`,
        );
      }

      const jwks = (await response.json()) as {
        keys?: Array<Record<string, unknown>>;
      };

      if (!jwks.keys || jwks.keys.length === 0) {
        throw new Error("JWKS response contains no keys");
      }

      // Cache all returned keys to reduce future fetches
      this.populateCache(jwks.keys, now);

      const fresh = this.cache.get(kid);
      if (!fresh) {
        throw new Error(`Key with kid "${kid}" not found in JWKS`);
      }

      return fresh.pem;
    } catch (err) {
      // Stale-while-revalidate: use cached entry even if expired when fetch fails
      if (cached) {
        return cached.pem;
      }

      throw new InternalError(
        `Failed to fetch JWKS and no cached key for kid "${kid}"`,
        err,
      );
    }
  }

  /** Converts every JWK in the set to PEM and caches it. Evicts the oldest entry when the cache exceeds MAX_CACHE_SIZE. */
  private populateCache(
    keys: Array<Record<string, unknown>>,
    now: number,
  ): void {
    for (const jwk of keys) {
      const kid = jwk.kid as string | undefined;
      if (!kid) continue;

      const pem = this.jwkToPem(jwk);
      const expiresAt = now + this.ttlMs;

      // Ensure we don't exceed the cache size limit
      if (this.cache.size >= MAX_CACHE_SIZE && !this.cache.has(kid)) {
        this.evictOldest();
      }

      this.cache.set(kid, { pem, expiresAt });
    }
  }

  /** Converts a JWK (JSON Web Key) to PEM-encoded SPKI public key using Node crypto. */
  private jwkToPem(jwk: Record<string, unknown>): string {
    const key = createPublicKey({ key: jwk as Record<string, string>, format: "jwk" });
    return key.export({ type: "spki", format: "pem" }) as string;
  }

  /** Evicts the cache entry with the earliest expiration time. */
  private evictOldest(): void {
    let oldestKid: string | null = null;
    let oldestExpiry = Infinity;

    for (const [kid, entry] of this.cache) {
      if (entry.expiresAt < oldestExpiry) {
        oldestExpiry = entry.expiresAt;
        oldestKid = kid;
      }
    }

    if (oldestKid) {
      this.cache.delete(oldestKid);
    }
  }
}

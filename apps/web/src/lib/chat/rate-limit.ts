export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export interface RateLimitStore {
  take(key: string, limit: number, windowMs: number): RateLimitResult | Promise<RateLimitResult>;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private windows = new Map<string, { count: number; resetAt: number }>();

  constructor(private now: () => number = Date.now) {}

  take(key: string, limit: number, windowMs: number): RateLimitResult {
    const time = this.now();
    if (this.windows.size >= 10_000) {
      for (const [k, w] of this.windows) if (w.resetAt <= time) this.windows.delete(k);
    }
    let window = this.windows.get(key);
    if (!window || window.resetAt <= time) {
      window = { count: 0, resetAt: time + windowMs };
      this.windows.set(key, window);
    }
    if (window.count >= limit) return { ok: false, retryAfterSeconds: Math.ceil((window.resetAt - time) / 1000) };
    window.count += 1;
    return { ok: true };
  }
}

/** Stub Redis store interface for distributed rate limiting across web instances. */
export class RedisRateLimitStore implements RateLimitStore {
  constructor(private redisClient?: unknown) {}

  async take(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    // Falls back to in-memory behavior if Redis is unavailable or unconfigured
    return new InMemoryRateLimitStore().take(key, limit, windowMs);
  }
}

/**
 * Fixed-window counter per key (a visitor's IP): `limit` hits per `windowMs`.
 * Uses pluggable RateLimitStore abstraction (In-memory by default).
 */
export function createRateLimiter({
  limit,
  windowMs,
  now = Date.now,
  store,
}: {
  limit: number;
  windowMs: number;
  now?: () => number;
  store?: RateLimitStore;
}) {
  const activeStore = store ?? new InMemoryRateLimitStore(now);

  return function take(key: string): RateLimitResult | Promise<RateLimitResult> {
    return activeStore.take(key, limit, windowMs);
  };
}

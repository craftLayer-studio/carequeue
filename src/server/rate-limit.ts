import { StoreError } from "./store/errors";

/**
 * Fixed-window in-memory rate limiter for public endpoints. One process only; a shared store
 * (Redis/Postgres) would replace it when running more than one instance.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();
const MAX_KEYS = 10_000;

export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): void {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
      if (buckets.size >= MAX_KEYS) buckets.clear();
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  b.count += 1;
  if (b.count > max) throw new StoreError(429, "Too many requests. Please wait a minute and try again.");
}

export function resetRateLimits() {
  buckets.clear();
}

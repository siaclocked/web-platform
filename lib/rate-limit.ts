/**
 * In-memory sliding window rate limiter.
 * For single-instance deployments. Upgrade to Redis for multi-instance.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 15 * 60 * 1000);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

interface RateLimitOptions {
  /** Unique prefix for the rate limit bucket (e.g. 'check-worker') */
  prefix: string;
  /** Key to rate limit on (e.g. email address or IP) */
  key: string;
  /** Maximum number of requests allowed in the window */
  maxAttempts: number;
  /** Time window in seconds */
  windowSeconds: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(options: RateLimitOptions): RateLimitResult {
  const { prefix, key, maxAttempts, windowSeconds } = options;
  const bucketKey = `${prefix}:${key.toLowerCase()}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  let entry = store.get(bucketKey);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(bucketKey, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxAttempts) {
    // Rate limited
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = windowMs - (now - oldestInWindow);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  // Allow and record
  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxAttempts - entry.timestamps.length,
    retryAfterSeconds: 0,
  };
}

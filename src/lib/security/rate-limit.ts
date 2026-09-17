import { NextRequest } from 'next/server';

interface RateLimitStore {
  tokens: number;
  lastRefill: number;
}

const memoryStore = new Map<string, RateLimitStore>();

export interface RateLimitOptions {
  limit?: number; // max requests per window
  windowSeconds?: number; // window size in seconds
}

/**
 * Token bucket rate limiter for API routes.
 * Prevents denial-of-wallet attacks and abuse on AI-heavy endpoints.
 */
export async function rateLimit(
  req: NextRequest,
  keyPrefix: string,
  userIdOrIp: string,
  options: RateLimitOptions = {}
): Promise<{ allowed: boolean; remaining: number; resetSeconds: number }> {
  const limit = options.limit || 30; // default 30 requests
  const windowSeconds = options.windowSeconds || 60; // per 60 seconds
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const key = `${keyPrefix}:${userIdOrIp}`;
  let bucket = memoryStore.get(key);

  if (!bucket) {
    bucket = { tokens: limit - 1, lastRefill: now };
    memoryStore.set(key, bucket);
    return { allowed: true, remaining: limit - 1, resetSeconds: windowSeconds };
  }

  // Refill tokens proportionally to elapsed time
  const elapsed = now - bucket.lastRefill;
  if (elapsed >= windowMs) {
    bucket.tokens = limit - 1;
    bucket.lastRefill = now;
    return { allowed: true, remaining: limit - 1, resetSeconds: windowSeconds };
  }

  // Tokens available in current window
  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    const resetSeconds = Math.ceil((windowMs - elapsed) / 1000);
    return { allowed: true, remaining: bucket.tokens, resetSeconds };
  }

  const resetSeconds = Math.ceil((windowMs - elapsed) / 1000);
  return { allowed: false, remaining: 0, resetSeconds };
}

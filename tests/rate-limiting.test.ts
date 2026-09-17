import { describe, it, expect } from 'vitest';
import { rateLimit } from '@/lib/security/rate-limit';
import { NextRequest } from 'next/server';

describe('Rate Limiter Token Bucket', () => {
  it('allows requests within limit and decrements remaining tokens', async () => {
    const dummyReq = new NextRequest('http://localhost/api/test');
    const userKey = 'test-user-' + Date.now();

    const first = await rateLimit(dummyReq, 'test', userKey, { limit: 3, windowSeconds: 10 });
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(2);

    const second = await rateLimit(dummyReq, 'test', userKey, { limit: 3, windowSeconds: 10 });
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(1);

    const third = await rateLimit(dummyReq, 'test', userKey, { limit: 3, windowSeconds: 10 });
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);

    const fourth = await rateLimit(dummyReq, 'test', userKey, { limit: 3, windowSeconds: 10 });
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
    expect(fourth.resetSeconds).toBeGreaterThan(0);
  });
});

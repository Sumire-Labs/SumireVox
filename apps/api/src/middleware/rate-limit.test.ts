import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const { redisMock, loggerMock } = vi.hoisted(() => ({
  redisMock: {
    incr: vi.fn(),
    expire: vi.fn(),
  },
  loggerMock: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../infrastructure/redis.js', () => ({
  getRedisClient: vi.fn(() => redisMock),
  isRedisReady: vi.fn(() => true),
}));

vi.mock('../infrastructure/logger.js', () => ({
  logger: loggerMock,
}));

import { rateLimit } from './rate-limit.js';

describe('rateLimit', () => {
  beforeEach(() => {
    redisMock.incr.mockReset().mockResolvedValue(1);
    redisMock.expire.mockReset().mockResolvedValue(1);
    loggerMock.info.mockReset();
    loggerMock.warn.mockReset();
    loggerMock.error.mockReset();
    loggerMock.debug.mockReset();
  });

  it('uses X-Real-IP before X-Forwarded-For for anonymous requests', async () => {
    const app = new Hono();

    app.use('/limited', rateLimit({ max: 5, windowSeconds: 60, keyPrefix: 'auth' }));
    app.get('/limited', (c) => c.json({ success: true }));

    const response = await app.request('http://localhost/limited', {
      headers: {
        'x-real-ip': '203.0.113.10',
        'x-forwarded-for': '198.51.100.77, 203.0.113.10',
      },
    });

    expect(response.status).toBe(200);
    expect(redisMock.incr).toHaveBeenCalledWith(
      expect.stringMatching(/^ratelimit:ip:203\.0\.113\.10:auth:/),
    );
  });
});

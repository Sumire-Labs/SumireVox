import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, stripeMock, redisMock, loggerMock } = vi.hoisted(() => ({
  prismaMock: {
    subscription: {
      findFirst: vi.fn(),
    },
  },
  stripeMock: {
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
  },
  redisMock: {
    set: vi.fn(),
    del: vi.fn(),
  },
  loggerMock: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../infrastructure/database.js', () => ({
  getPrisma: vi.fn(() => prismaMock),
}));

vi.mock('../../infrastructure/stripe-client.js', () => ({
  stripe: stripeMock,
}));

vi.mock('../../infrastructure/redis.js', () => ({
  getRedisClient: vi.fn(() => redisMock),
}));

vi.mock('../../infrastructure/config.js', () => ({
  config: {
    stripePriceId: 'price_test',
    webDomain: 'https://example.com',
  },
}));

vi.mock('../../infrastructure/logger.js', () => ({
  logger: loggerMock,
}));

import { createCheckoutSession } from '../stripe-service.js';

describe('createCheckoutSession', () => {
  beforeEach(() => {
    prismaMock.subscription.findFirst.mockReset();
    stripeMock.checkout.sessions.create.mockReset();
    redisMock.set.mockReset();
    redisMock.del.mockReset();
    loggerMock.info.mockReset();
    loggerMock.warn.mockReset();
    loggerMock.error.mockReset();
    loggerMock.debug.mockReset();

    prismaMock.subscription.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    redisMock.set.mockResolvedValue('OK');
    redisMock.del.mockResolvedValue(1);
  });

  it('releases the checkout lock after a successful session creation', async () => {
    stripeMock.checkout.sessions.create.mockResolvedValue({
      id: 'cs_123',
      url: 'https://checkout.stripe.test/session',
    });

    const url = await createCheckoutSession('user-1', 2);

    expect(url).toBe('https://checkout.stripe.test/session');
    expect(redisMock.set).toHaveBeenCalledWith('checkout_lock:user-1', '1', 'EX', 300, 'NX');
    expect(redisMock.del).toHaveBeenCalledWith('checkout_lock:user-1');
  });

  it('releases the checkout lock when Stripe session creation fails', async () => {
    stripeMock.checkout.sessions.create.mockRejectedValue(new Error('stripe down'));

    await expect(createCheckoutSession('user-1', 2)).rejects.toThrow('stripe down');
    expect(redisMock.del).toHaveBeenCalledWith('checkout_lock:user-1');
  });
});

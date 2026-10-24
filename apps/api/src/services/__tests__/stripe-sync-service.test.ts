import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prisma, tx, stripe, publish } = vi.hoisted(() => ({
  prisma: { subscription: { findFirst: vi.fn(), findUnique: vi.fn() }, $transaction: vi.fn() },
  tx: { subscription: { create: vi.fn(), update: vi.fn() }, boost: { createMany: vi.fn(), updateMany: vi.fn() } },
  stripe: { subscriptions: { list: vi.fn() } },
  publish: vi.fn(),
}));
vi.mock('../../infrastructure/database.js', () => ({ getPrisma: () => prisma }));
vi.mock('../../infrastructure/stripe-client.js', () => ({ stripe }));
vi.mock('../../infrastructure/redis.js', () => ({ getRedisClient: vi.fn() }));
vi.mock('../../infrastructure/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../premium-cache-sync.js', () => ({ publishGuildPremiumInvalidation: publish }));
import { syncUserSubscriptions } from '../stripe-sync-service.js';

describe('Stripe 23 user subscription sync', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.subscription.findFirst.mockResolvedValue({ stripeCustomerId: 'cus_test' });
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
    stripe.subscriptions.list.mockResolvedValue({ data: [{
      id: 'sub_test', status: 'active', items: { data: [{ quantity: 2, current_period_end: 1800000000 }] },
    }] });
  });

  it('creates subscription dates and boost slots from item billing data', async () => {
    prisma.subscription.findUnique.mockResolvedValue(null);
    await syncUserSubscriptions('user_test');
    expect(tx.subscription.create).toHaveBeenCalledWith({ data: {
      userId: 'user_test', stripeCustomerId: 'cus_test', stripeSubscriptionId: 'sub_test',
      status: 'ACTIVE', currentPeriodEnd: new Date(1800000000000), boostCount: 2,
    } });
    expect(tx.boost.createMany).toHaveBeenCalledWith({ data: [{ subscriptionId: 'sub_test' }, { subscriptionId: 'sub_test' }] });
  });

  it('preserves existing assignments and invalidates premium caches after updating dates', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ boosts: [{ id: 'b1', guildId: 'g1' }, { id: 'b2', guildId: null }] });
    await syncUserSubscriptions('user_test');
    expect(tx.subscription.update).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_test' },
      data: { status: 'ACTIVE', currentPeriodEnd: new Date(1800000000000), boostCount: 2 },
    });
    expect(tx.boost.updateMany).not.toHaveBeenCalled();
    expect(tx.boost.createMany).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith(['g1']);
  });
});

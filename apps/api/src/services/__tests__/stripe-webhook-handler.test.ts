import { beforeEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';

const { prismaMock, txMock, stripeMock, loggerMock, adjustBoostSlotsMock, redisPublisherMock } = vi.hoisted(() => ({
  prismaMock: {
    subscription: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    boost: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  txMock: {
    subscription: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    boost: {
      count: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
  stripeMock: {
    webhooks: {
      constructEvent: vi.fn(),
    },
    subscriptions: {
      retrieve: vi.fn(),
      cancel: vi.fn(),
    },
    invoices: {
      retrieve: vi.fn(),
    },
  },
  loggerMock: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  adjustBoostSlotsMock: vi.fn(),
  redisPublisherMock: {
    publish: vi.fn(),
  },
}));

vi.mock('../../infrastructure/database.js', () => ({
  getPrisma: vi.fn(() => prismaMock),
}));

vi.mock('../../infrastructure/stripe-client.js', () => ({
  stripe: stripeMock,
}));

vi.mock('../../infrastructure/redis.js', () => ({
  getRedisClient: vi.fn(),
  getRedisPublisher: vi.fn(() => redisPublisherMock),
}));

vi.mock('../../infrastructure/logger.js', () => ({
  logger: loggerMock,
}));

vi.mock('../adjust-boost-slots.js', async () => {
  const actual = await vi.importActual<typeof import('../adjust-boost-slots.js')>('../adjust-boost-slots.js');

  return {
    ...actual,
    adjustBoostSlots: adjustBoostSlotsMock,
  };
});

import { processStripeEvent } from '../stripe-webhook-handler.js';

describe('processStripeEvent', () => {
  beforeEach(() => {
    prismaMock.subscription.findFirst.mockReset();
    prismaMock.subscription.findUnique.mockReset();
    prismaMock.boost.findMany.mockReset();
    prismaMock.$transaction.mockReset().mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock));

    txMock.subscription.upsert.mockReset();
    txMock.subscription.updateMany.mockReset();
    txMock.boost.count.mockReset();
    txMock.boost.createMany.mockReset();
    txMock.boost.updateMany.mockReset();
    txMock.boost.deleteMany.mockReset();

    stripeMock.webhooks.constructEvent.mockReset();
    stripeMock.subscriptions.retrieve.mockReset();
    stripeMock.subscriptions.cancel.mockReset();
    stripeMock.invoices.retrieve.mockReset();

    loggerMock.info.mockReset();
    loggerMock.warn.mockReset();
    loggerMock.error.mockReset();
    loggerMock.debug.mockReset();
    adjustBoostSlotsMock.mockReset();
    redisPublisherMock.publish.mockReset().mockResolvedValue(1);

    prismaMock.boost.findMany.mockResolvedValue([]);
  });

  it('creates subscription and boosts on checkout.session.completed', async () => {
    const event = {
      id: 'evt-checkout',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_123',
          metadata: { userId: 'user-1', boostCount: '3' },
          subscription: 'sub-1',
          customer: 'cus-1',
        },
      },
    };
    stripeMock.subscriptions.retrieve.mockResolvedValue({
      current_period_end: 1_800_000_000,
    });
    txMock.boost.count.mockResolvedValue(1);

    await processStripeEvent(event as never);

    expect(txMock.subscription.upsert).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub-1' },
      create: {
        userId: 'user-1',
        stripeCustomerId: 'cus-1',
        stripeSubscriptionId: 'sub-1',
        status: 'ACTIVE',
        currentPeriodEnd: new Date('2027-01-15T08:00:00.000Z'),
        boostCount: 3,
      },
      update: {
        status: 'ACTIVE',
        currentPeriodEnd: new Date('2027-01-15T08:00:00.000Z'),
        boostCount: 3,
      },
    });
    expect(txMock.boost.createMany).toHaveBeenCalledWith({
      data: [{ subscriptionId: 'sub-1' }, { subscriptionId: 'sub-1' }],
    });
  });

  it('adds boosts when subscription quantity increases', async () => {
    const event = {
      id: 'evt-sub-up',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub-1',
          status: 'active',
          current_period_end: 1_800_000_000,
          items: {
            data: [{ quantity: 4 }],
          },
        },
      },
    };
    prismaMock.subscription.findUnique.mockResolvedValue({
      stripeSubscriptionId: 'sub-1',
      boosts: [{ id: 'boost-1' }, { id: 'boost-2' }],
    });

    await processStripeEvent(event as never);

    expect(txMock.subscription.updateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub-1' },
      data: {
        status: 'ACTIVE',
        currentPeriodEnd: new Date('2027-01-15T08:00:00.000Z'),
        boostCount: 4,
      },
    });
    expect(txMock.boost.createMany).toHaveBeenCalledWith({
      data: [{ subscriptionId: 'sub-1' }, { subscriptionId: 'sub-1' }],
    });
    expect(adjustBoostSlotsMock).not.toHaveBeenCalled();
  });

  it('force-removes excess boosts when subscription quantity decreases', async () => {
    const boosts = [
      { id: 'boost-1', guildId: null, assignedAt: null },
      { id: 'boost-2', guildId: 'guild-1', assignedAt: new Date('2026-01-01T00:00:00.000Z') },
      { id: 'boost-3', guildId: 'guild-2', assignedAt: new Date('2026-01-02T00:00:00.000Z') },
    ];
    const event = {
      id: 'evt-sub-down',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub-1',
          status: 'active',
          current_period_end: 1_800_000_000,
          items: {
            data: [{ quantity: 1 }],
          },
        },
      },
    };
    prismaMock.subscription.findUnique.mockResolvedValue({
      stripeSubscriptionId: 'sub-1',
      boosts,
    });

    await processStripeEvent(event as never);

    expect(adjustBoostSlotsMock).toHaveBeenCalledWith(txMock, 'sub-1', 1, boosts);
    expect(txMock.boost.createMany).not.toHaveBeenCalled();
  });

  it('unassigns all boosts when subscription is deleted', async () => {
    const event = {
      id: 'evt-sub-deleted',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub-1',
        },
      },
    };

    await processStripeEvent(event as never);

    expect(txMock.subscription.updateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub-1' },
      data: { status: 'CANCELED' },
    });
    expect(txMock.boost.updateMany).toHaveBeenCalledWith({
      where: { subscriptionId: 'sub-1', guildId: { not: null } },
      data: {
        guildId: null,
        assignedAt: null,
        unassignedAt: expect.any(Date),
      },
    });
  });

  it('unassigns all boosts when invoice payment fails', async () => {
    const event = {
      id: 'evt-invoice-failed',
      type: 'invoice.payment_failed',
      data: {
        object: {
          subscription: 'sub-1',
        },
      },
    };

    await processStripeEvent(event as never);

    expect(txMock.subscription.updateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub-1' },
      data: { status: 'PAST_DUE' },
    });
    expect(txMock.boost.updateMany).toHaveBeenCalledWith({
      where: { subscriptionId: 'sub-1', guildId: { not: null } },
      data: {
        guildId: null,
        assignedAt: null,
        unassignedAt: null,
      },
    });
  });

  it('cancels the subscription and deletes boosts on full charge refund', async () => {
    const event = {
      id: 'evt-refund',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_1',
          invoice: 'in_1',
          customer: 'cus-1',
          amount: 3000,
          amount_refunded: 3000,
        },
      },
    };
    stripeMock.invoices.retrieve.mockResolvedValue({
      subscription: 'sub-1',
    });
    stripeMock.subscriptions.retrieve.mockResolvedValue({
      status: 'active',
    });

    await processStripeEvent(event as never);

    expect(stripeMock.subscriptions.cancel).toHaveBeenCalledWith('sub-1');
    expect(txMock.subscription.updateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub-1' },
      data: { status: 'CANCELED' },
    });
    expect(txMock.boost.updateMany).toHaveBeenCalledWith({
      where: { subscriptionId: 'sub-1', guildId: { not: null } },
      data: {
        guildId: null,
        assignedAt: null,
        unassignedAt: expect.any(Date),
      },
    });
    expect(txMock.boost.deleteMany).toHaveBeenCalledWith({
      where: { subscriptionId: 'sub-1' },
    });
  });

  it('skips processing when the Stripe resource is missing (404)', async () => {
    const event = {
      id: 'evt-resource-missing',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_123',
          metadata: { userId: 'user-1', boostCount: '3' },
          subscription: 'sub-gone',
          customer: 'cus-1',
        },
      },
    };
    const resourceMissingError = Object.assign(
      new Stripe.errors.StripeError({
        type: 'invalid_request_error',
        message: 'No such subscription: sub-gone',
      }),
      { statusCode: 404 },
    );
    stripeMock.subscriptions.retrieve.mockRejectedValue(resourceMissingError);

    await expect(processStripeEvent(event as never)).resolves.toBeUndefined();

    expect(stripeMock.subscriptions.retrieve).toHaveBeenCalledWith('sub-gone');
    expect(txMock.subscription.upsert).not.toHaveBeenCalled();
  });
});
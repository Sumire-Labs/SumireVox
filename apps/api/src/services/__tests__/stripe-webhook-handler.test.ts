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
    invoicePayments: { list: vi.fn() },
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
    stripeMock.invoicePayments.list.mockReset().mockResolvedValue({ data: [], has_more: false });

    loggerMock.info.mockReset();
    loggerMock.warn.mockReset();
    loggerMock.error.mockReset();
    loggerMock.debug.mockReset();
    adjustBoostSlotsMock.mockReset();
    redisPublisherMock.publish.mockReset().mockResolvedValue(1);

    prismaMock.boost.findMany.mockResolvedValue([]);
  });

  it('handles current invoice parent references when payment fails', async () => {
    await processStripeEvent({
      id: 'evt-new-invoice', type: 'invoice.payment_failed',
      data: { object: { parent: { type: 'subscription_details', subscription_details: { subscription: { id: 'sub-2' } } } } },
    } as never);
    expect(txMock.subscription.updateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub-2' }, data: { status: 'PAST_DUE' },
    });
  });

  it('uses item billing periods for a current subscription event', async () => {
    await processStripeEvent({
      id: 'evt-new-sub', type: 'customer.subscription.updated',
      data: { object: { id: 'sub-2', status: 'active', items: { data: [{ quantity: 2, current_period_end: 1800000000 }] } } },
    } as never);
    expect(txMock.subscription.updateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub-2' },
      data: { status: 'ACTIVE', boostCount: 2, currentPeriodEnd: new Date(1800000000000) },
    });
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

  it('restores ACTIVE and item period on a paid current invoice', async () => {
    stripeMock.subscriptions.retrieve.mockResolvedValue({ items: { data: [{ current_period_end: 1800000000 }] } });
    await processStripeEvent({
      id: 'evt-paid', type: 'invoice.paid',
      data: { object: { parent: { type: 'subscription_details', subscription_details: { subscription: 'sub-paid' } } } },
    } as never);
    expect(txMock.subscription.updateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub-paid' },
      data: { status: 'ACTIVE', currentPeriodEnd: new Date(1800000000000) },
    });
  });

  it('resolves refunded payment invoices over all pages without canceling the customer fallback', async () => {
    stripeMock.invoicePayments.list
      .mockResolvedValueOnce({ data: [
        { id: 'inpay_1', status: 'paid', invoice: { parent: { type: 'subscription_details', subscription_details: { subscription: 'sub-correct' } } } },
      ], has_more: true })
      .mockResolvedValueOnce({ data: [
        { id: 'inpay_2', status: 'paid', invoice: 'in_2' },
      ], has_more: false });
    stripeMock.invoices.retrieve.mockResolvedValue({ parent: { type: 'subscription_details', subscription_details: { subscription: { id: 'sub-correct' } } } });
    stripeMock.subscriptions.retrieve.mockResolvedValue({ status: 'active' });
    prismaMock.subscription.findFirst.mockResolvedValue({ stripeSubscriptionId: 'sub-wrong' });
    await processStripeEvent({
      id: 'evt-new-refund', type: 'charge.refunded',
      data: { object: { id: 'ch_new', customer: 'cus-1', payment_intent: { id: 'pi_new' }, amount: 3000, amount_refunded: 3000 } },
    } as never);
    expect(stripeMock.invoicePayments.list).toHaveBeenNthCalledWith(2, {
      payment: { type: 'payment_intent', payment_intent: 'pi_new' },
      expand: ['data.invoice'], limit: 100, starting_after: 'inpay_1',
    });
    expect(stripeMock.subscriptions.cancel).toHaveBeenCalledExactlyOnceWith('sub-correct');
    expect(prismaMock.subscription.findFirst).not.toHaveBeenCalled();
    expect(txMock.boost.deleteMany).toHaveBeenCalledWith({ where: { subscriptionId: 'sub-correct' } });
  });

  it('preserves boosts on a partial current charge refund', async () => {
    stripeMock.invoicePayments.list.mockResolvedValue({ data: [
      { id: 'inpay_1', status: 'paid', invoice: { parent: { type: 'subscription_details', subscription_details: { subscription: 'sub-correct' } } } },
    ], has_more: false });
    await processStripeEvent({
      id: 'evt-partial', type: 'charge.refunded',
      data: { object: { id: 'ch_partial', payment_intent: 'pi_partial', amount: 3000, amount_refunded: 1000 } },
    } as never);
    expect(stripeMock.subscriptions.cancel).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(txMock.boost.deleteMany).not.toHaveBeenCalled();
  });

  it('does not acknowledge transient invoice payment API failures as a customer refund', async () => {
    stripeMock.invoicePayments.list.mockRejectedValue(new Error('temporary Stripe failure'));
    await expect(processStripeEvent({
      id: 'evt-retry', type: 'charge.refunded',
      data: { object: { id: 'ch_retry', customer: 'cus-1', payment_intent: 'pi_retry', amount: 100, amount_refunded: 100 } },
    } as never)).rejects.toThrow('temporary Stripe failure');
    expect(prismaMock.subscription.findFirst).not.toHaveBeenCalled();
    expect(txMock.boost.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects a missing period instead of storing an invalid date', async () => {
    await expect(processStripeEvent({
      id: 'evt-invalid-period', type: 'customer.subscription.updated',
      data: { object: { id: 'sub-2', status: 'active', items: { data: [{ quantity: 2 }] } } },
    } as never)).rejects.toThrow('no valid billing period');
    expect(txMock.subscription.updateMany).not.toHaveBeenCalled();
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
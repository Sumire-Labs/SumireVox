import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, txMock, stripeMock, loggerMock } = vi.hoisted(() => ({
  prismaMock: {
    subscription: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  txMock: {
    subscription: {
      update: vi.fn(),
    },
    boost: {
      updateMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    boostRevocation: {
      createMany: vi.fn(),
    },
  },
  stripeMock: {
    subscriptions: {
      retrieve: vi.fn(),
    },
  },
  loggerMock: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../infrastructure/database.js', () => ({
  getPrisma: vi.fn(() => prismaMock),
}));

vi.mock('../../infrastructure/stripe-client.js', () => ({
  stripe: stripeMock,
}));

vi.mock('../../infrastructure/logger.js', () => ({
  logger: loggerMock,
}));

vi.mock('../premium-cache-sync.js', () => ({
  publishGuildPremiumInvalidation: vi.fn().mockResolvedValue(undefined),
}));

import {
  createStripeSubscriptionReconcileRunner,
  reconcileStripeSubscriptions,
} from '../stripe-subscription-reconciler.js';

describe('stripe-subscription-reconciler', () => {
  beforeEach(() => {
    prismaMock.subscription.findMany.mockReset();
    prismaMock.$transaction.mockReset().mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock));

    txMock.subscription.update.mockReset();
    txMock.boost.updateMany.mockReset();
    txMock.boost.createMany.mockReset();
    txMock.boost.deleteMany.mockReset();
    txMock.boostRevocation.createMany.mockReset();

    stripeMock.subscriptions.retrieve.mockReset();

    loggerMock.info.mockReset();
    loggerMock.warn.mockReset();
    loggerMock.error.mockReset();
  });

  it('unassigns boosts when Stripe reports unpaid', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([
      {
        stripeSubscriptionId: 'sub-1',
        status: 'ACTIVE',
        currentPeriodEnd: new Date('2027-01-15T08:00:00.000Z'),
        boostCount: 2,
        boosts: [
          { id: 'boost-1', guildId: 'guild-1', assignedAt: new Date('2026-01-01T00:00:00.000Z') },
          { id: 'boost-2', guildId: null, assignedAt: null },
        ],
      },
    ]);
    stripeMock.subscriptions.retrieve.mockResolvedValue({
      status: 'unpaid',
    });

    await reconcileStripeSubscriptions();

    expect(txMock.subscription.update).toHaveBeenCalledWith({
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

  it('skips overlapping runs while a previous reconcile is still active', async () => {
    let resolveFirstRun: (() => void) | null = null;
    let callCount = 0;
    const runReconcile = vi.fn(() => {
      callCount += 1;
      if (callCount === 1) {
        return new Promise<void>((resolve) => {
          resolveFirstRun = resolve;
        });
      }

      return Promise.resolve();
    });
    const runner = createStripeSubscriptionReconcileRunner(runReconcile);

    const firstRun = runner();
    const secondRun = runner();
    await secondRun;

    expect(runReconcile).toHaveBeenCalledTimes(1);
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'Skipping Stripe subscription reconciliation because a previous run is still in progress',
    );

    const finishFirstRun: () => void =
      resolveFirstRun ??
      (() => {
        throw new Error('Expected first reconcile run to remain pending');
      });

    finishFirstRun();
    await firstRun;

    await runner();
    expect(runReconcile).toHaveBeenCalledTimes(2);
  });
});

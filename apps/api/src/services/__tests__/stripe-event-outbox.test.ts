import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const { stripeMock, prismaMock, processEventMock, loggerMock } = vi.hoisted(() => ({
  stripeMock: {
    subscriptions: { retrieve: vi.fn() },
  },
  prismaMock: {
    stripeEvent: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
  processEventMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
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

vi.mock('../stripe-webhook-handler.js', () => ({
  processStripeEvent: processEventMock,
}));

import { enqueueStripeEvent, drainStripeEventOutbox } from '../stripe-event-outbox.js';

describe('stripe-event-outbox', () => {
  beforeEach(() => {
    prismaMock.stripeEvent.upsert.mockReset();
    prismaMock.stripeEvent.findMany.mockReset();
    prismaMock.stripeEvent.update.mockReset();
    processEventMock.mockReset();
    loggerMock.info.mockReset();
    loggerMock.warn.mockReset();
    loggerMock.error.mockReset();
    loggerMock.debug.mockReset();
  });

  it('enqueues an event with PENDING status', async () => {
    prismaMock.stripeEvent.upsert.mockResolvedValue({});
    const event = { id: 'evt_1', type: 'invoice.paid', data: { object: {} } };

    await enqueueStripeEvent(event as never);

    expect(prismaMock.stripeEvent.upsert).toHaveBeenCalledWith({
      where: { id: 'evt_1' },
      create: {
        id: 'evt_1',
        type: 'invoice.paid',
        payload: event,
        status: 'PENDING',
      },
      update: {},
    });
  });

  it('swallows a P2002 unique constraint (concurrent enqueue)', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });
    prismaMock.stripeEvent.upsert.mockRejectedValue(p2002);

    await expect(enqueueStripeEvent({ id: 'evt_1', type: 'x', data: {} } as never)).resolves.toBeUndefined();
  });

  it('rethrows non-P2002 errors from enqueue', async () => {
    prismaMock.stripeEvent.upsert.mockRejectedValue(new Error('db down'));

    await expect(enqueueStripeEvent({ id: 'evt_1', type: 'x', data: {} } as never)).rejects.toThrow('db down');
  });

  it('processes pending events and marks them PROCESSED', async () => {
    const event = { id: 'evt_1', type: 'invoice.paid', data: { object: {} } };
    prismaMock.stripeEvent.findMany.mockResolvedValue([
      { id: 'evt_1', type: 'invoice.paid', payload: event, createdAt: new Date('2026-01-01') },
    ]);
    prismaMock.stripeEvent.update.mockResolvedValue({});
    processEventMock.mockResolvedValue(undefined);

    await drainStripeEventOutbox();

    expect(processEventMock).toHaveBeenCalledWith(event);
    expect(prismaMock.stripeEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt_1' },
      data: { status: 'PROCESSED', processedAt: expect.any(Date), attempts: 0, lastError: null },
    });
  });

  it('keeps a failed event PENDING and records the attempt', async () => {
    const event = { id: 'evt_1', type: 'checkout.session.completed', data: { object: {} } };
    prismaMock.stripeEvent.findMany.mockResolvedValue([
      { id: 'evt_1', type: 'checkout.session.completed', payload: event, createdAt: new Date('2026-01-01') },
    ]);
    prismaMock.stripeEvent.update.mockResolvedValue({});
    processEventMock.mockRejectedValue(new Error('boom'));

    await drainStripeEventOutbox();

    expect(prismaMock.stripeEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt_1' },
      data: { attempts: { increment: 1 }, lastError: 'boom' },
    });
    expect(loggerMock.error).toHaveBeenCalled();
  });

  it('only fetches PENDING events below the retry cap (dead-lettering exhausted events)', async () => {
    prismaMock.stripeEvent.findMany.mockResolvedValue([]);

    await drainStripeEventOutbox();

    expect(prismaMock.stripeEvent.findMany).toHaveBeenCalledWith({
      where: { status: 'PENDING', attempts: { lt: 100 } },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
  });
});
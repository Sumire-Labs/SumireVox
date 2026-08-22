import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const { stripeMock, configMock, enqueueMock, drainMock, loggerMock } = vi.hoisted(() => ({
  stripeMock: {
    webhooks: { constructEvent: vi.fn() },
  },
  configMock: { stripeWebhookSecret: 'whsec_test' },
  enqueueMock: vi.fn(),
  drainMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../infrastructure/stripe-client.js', () => ({
  stripe: stripeMock,
}));

vi.mock('../../infrastructure/config.js', () => ({
  config: configMock,
}));

vi.mock('../../services/stripe-event-outbox.js', () => ({
  enqueueStripeEvent: enqueueMock,
  drainStripeEventOutbox: drainMock,
}));

vi.mock('../../infrastructure/logger.js', () => ({
  logger: loggerMock,
}));

import { stripeWebhookRouter } from '../stripe-webhook.js';

function createApp(): Hono {
  const app = new Hono();
  app.route('/api/stripe', stripeWebhookRouter);
  return app;
}

const flushAsync = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('stripeWebhookRouter', () => {
  beforeEach(() => {
    stripeMock.webhooks.constructEvent.mockReset();
    enqueueMock.mockReset();
    enqueueMock.mockResolvedValue(undefined);
    drainMock.mockReset();
    drainMock.mockResolvedValue(undefined);
    loggerMock.info.mockReset();
    loggerMock.warn.mockReset();
    loggerMock.error.mockReset();
  });

  it('verifies the raw body signature, persists to outbox, and returns 200', async () => {
    const body = JSON.stringify({ id: 'evt_1', type: 'invoice.paid' });
    const event = { id: 'evt_1', type: 'invoice.paid', data: { object: {} } };
    stripeMock.webhooks.constructEvent.mockReturnValue(event);

    const res = await createApp().request('/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 't=...,v1=...' },
      body,
    });

    expect(res.status).toBe(200);
    expect(stripeMock.webhooks.constructEvent).toHaveBeenCalledWith(
      body,
      't=...,v1=...',
      'whsec_test',
    );
    expect(enqueueMock).toHaveBeenCalledWith(event);
  });

  it('triggers an asynchronous outbox drain after persisting the event', async () => {
    const event = { id: 'evt_1', type: 'invoice.paid', data: { object: {} } };
    stripeMock.webhooks.constructEvent.mockReturnValue(event);

    const res = await createApp().request('/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig' },
      body: '{}',
    });

    expect(res.status).toBe(200);
    await flushAsync();
    expect(drainMock).toHaveBeenCalled();
  });

  it('returns 400 when stripe-signature header is missing', async () => {
    const res = await createApp().request('/api/stripe/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });

    expect(res.status).toBe(400);
    expect(stripeMock.webhooks.constructEvent).not.toHaveBeenCalled();
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it('returns 400 when signature verification fails', async () => {
    stripeMock.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('invalid signature');
    });

    const res = await createApp().request('/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 'bad' },
      body: '{}',
    });

    expect(res.status).toBe(400);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it('returns 500 (not 200) when the event cannot be persisted to the outbox', async () => {
    const event = { id: 'evt_1', type: 'invoice.paid', data: { object: {} } };
    stripeMock.webhooks.constructEvent.mockReturnValue(event);
    enqueueMock.mockRejectedValue(new Error('db down'));

    const res = await createApp().request('/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig' },
      body: '{}',
    });

    expect(res.status).toBe(500);
    await flushAsync();
    expect(drainMock).not.toHaveBeenCalled();
  });
});
import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { z } from 'zod';
import { errorHandler } from './error-handler.js';
import { validate } from './validate.js';

describe('validate', () => {
  it('returns VALIDATION_ERROR for unknown body keys', async () => {
    const app = new Hono();
    app.onError(errorHandler);

    app.put('/settings', async (c) => {
      await validate.body(
        c,
        z
          .object({
            maxReadLength: z.number().int().min(1).max(500).optional(),
          })
          .strict(),
      );

      return c.json({ success: true });
    });

    const response = await app.request('http://localhost/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unknown: true }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
      },
    });
  });

  it('coerces pagination query values and applies defaults', async () => {
    const app = new Hono();
    app.onError(errorHandler);

    app.get('/items', async (c) => {
      const query = await validate.query(
        c,
        z.object({
          page: z.coerce.number().int().positive().default(1),
          perPage: z.coerce.number().int().min(1).max(100).default(20),
        }),
      );

      return c.json(query);
    });

    const response = await app.request('http://localhost/items?page=2');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ page: 2, perPage: 20 });
  });

  it('validates route params with coercion', async () => {
    const app = new Hono();
    app.onError(errorHandler);

    app.get('/bots/:instanceId', async (c) => {
      const params = await validate.params(
        c,
        z.object({
          instanceId: z.coerce.number().int().positive(),
        }),
      );

      return c.json(params);
    });

    const response = await app.request('http://localhost/bots/0');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
      },
    });
  });
});

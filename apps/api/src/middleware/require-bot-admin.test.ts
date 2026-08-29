import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { SessionData } from '../infrastructure/session.js';

vi.mock('../infrastructure/config.js', () => ({
  config: { botAdminUserIds: ['bot-admin'] },
}));

import { requireBotAdmin } from './require-bot-admin.js';

const session = (userId: string): SessionData => ({
  userId,
  username: 'test-user',
  discriminator: '0',
  avatar: null,
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  tokenExpiresAt: 0,
});

function createApp(currentSession: SessionData | null) {
  const app = new Hono();
  app.use('/admin', async (c, next) => {
    c.set('session', currentSession);
    await next();
  });
  app.use('/admin', requireBotAdmin);
  app.get('/admin', (c) => c.json({ success: true }));
  return app;
}

describe('requireBotAdmin', () => {
  it('rejects unauthenticated requests', async () => {
    const response = await createApp(null).request('/admin');

    expect(response.status).toBe(403);
  });

  it('rejects authenticated non-admin users', async () => {
    const response = await createApp(session('regular-user')).request('/admin');

    expect(response.status).toBe(403);
  });

  it('allows configured Bot administrators', async () => {
    const response = await createApp(session('bot-admin')).request('/admin');

    expect(response.status).toBe(200);
  });
});

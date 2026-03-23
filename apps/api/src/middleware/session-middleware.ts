import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { getSession, type SessionData } from '../infrastructure/session.js';

// Hono の Variables 型拡張
declare module 'hono' {
  interface ContextVariableMap {
    session: SessionData | null;
    sessionId: string | null;
  }
}

export const sessionMiddleware: MiddlewareHandler = async (c, next) => {
  const sessionId = getCookie(c, 'session_id') ?? null;

  if (sessionId) {
    const session = await getSession(sessionId);
    c.set('session', session);
    c.set('sessionId', sessionId);
  } else {
    c.set('session', null);
    c.set('sessionId', null);
  }

  await next();
};

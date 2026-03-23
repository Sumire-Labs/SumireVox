import type { MiddlewareHandler } from 'hono';
import { logger } from '../infrastructure/logger.js';

export const requestLogger: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;
  logger.info({ method, path, status, duration }, `${method} ${path} ${status} ${duration}ms`);
};

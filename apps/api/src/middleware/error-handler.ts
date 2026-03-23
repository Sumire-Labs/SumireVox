import type { ErrorHandler } from 'hono';
import { AppError } from '../infrastructure/app-error.js';
import { logger } from '../infrastructure/logger.js';

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    const statusCode = err.statusCode ?? 500;
    logger.warn({ code: err.code, message: err.message }, 'AppError');
    return c.json(
      {
        success: false,
        error: { code: err.code, message: err.message },
      },
      statusCode as Parameters<typeof c.json>[1],
    );
  }

  logger.error({ err }, 'Unhandled error');
  return c.json(
    {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'サーバー内部エラーが発生しました。' },
    },
    500,
  );
};

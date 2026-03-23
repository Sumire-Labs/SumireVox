import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { config } from './infrastructure/config.js';
import { logger } from './infrastructure/logger.js';
import { getPrisma, disconnectPrisma } from './infrastructure/database.js';
import { disconnectRedis } from './infrastructure/redis.js';
import { requestLogger } from './middleware/request-logger.js';
import { sessionMiddleware } from './middleware/session-middleware.js';
import { errorHandler } from './middleware/error-handler.js';

const app = new Hono();

// グローバルエラーハンドラ
app.onError(errorHandler);

// CORS
app.use(
  '*',
  cors({
    origin: config.corsOrigin,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
);

// リクエストログ
app.use('*', requestLogger);

// セッション読み込み（全リクエスト）
app.use('*', sessionMiddleware);

// ヘルスチェック（認証不要）
app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// ルート定義（後のフェーズで追加）
// app.route('/auth', authRouter);
// app.route('/api', apiRouter);

// サーバー起動
async function main(): Promise<void> {
  // DB 接続確認
  const prisma = getPrisma();
  await prisma.$connect();
  logger.info('Database connected');

  // サーバー起動
  const port = config.apiPort;
  serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      logger.info({ port: info.port }, `API server listening on port ${info.port}`);
    },
  );
}

// Graceful Shutdown
const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, `Received ${signal}, shutting down...`);

  await disconnectRedis();
  logger.info('Redis disconnected');

  await disconnectPrisma();
  logger.info('Database disconnected');

  logger.info('Shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled rejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  process.exit(1);
});

main().catch((error) => {
  logger.fatal({ err: error }, 'Failed to start API server');
  process.exit(1);
});

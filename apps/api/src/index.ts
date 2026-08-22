import { serve } from '@hono/node-server';
import { config } from './infrastructure/config.js';
import { logger } from './infrastructure/logger.js';
import { getPrisma, disconnectPrisma } from './infrastructure/database.js';
import { disconnectRedis } from './infrastructure/redis.js';
import { createApp } from './app.js';
import { reconcileBoosts } from './services/boost-service.js';
import {
  createStripeSubscriptionReconcileRunner,
  reconcileStripeSubscriptions,
} from './services/stripe-subscription-reconciler.js';
import { drainStripeEventOutbox } from './services/stripe-event-outbox.js';

const app = createApp();

let server: ReturnType<typeof serve> | null = null;
let reconcileTimer: ReturnType<typeof setInterval> | null = null;
const runStripeSubscriptionReconcile = createStripeSubscriptionReconcileRunner(reconcileStripeSubscriptions);

// サーバー起動
async function main(): Promise<void> {
  // DB 接続確認
  const prisma = getPrisma();
  await prisma.$connect();
  logger.info('Database connected');

  // サーバー起動
  const port = config.apiPort;
  server = serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      logger.info({ port: info.port }, `API server listening on port ${info.port}`);
    },
  );

  // 起動後にブースト整合処理を実行
  reconcileBoosts().catch((err) => logger.error({ err }, 'Boost reconciliation failed on startup'));

  // 起動時に未処理の Stripe イベント（outbox）をドレイン（クラッシュからの回復）
  drainStripeEventOutbox().catch((err) => logger.error({ err }, 'Stripe event outbox drain failed on startup'));

  // Stripe サブスクリプション定期整合処理（起動から1インターバル後に開始）
  reconcileTimer = setInterval(() => {
    runStripeSubscriptionReconcile().catch((err) =>
      logger.error({ err }, 'Stripe subscription reconciliation failed'),
    );
    drainStripeEventOutbox().catch((err) => logger.error({ err }, 'Stripe event outbox drain failed'));
  }, config.stripeReconcileIntervalMs);
}

// Graceful Shutdown
const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, `Received ${signal}, shutting down...`);

  if (reconcileTimer) {
    clearInterval(reconcileTimer);
    reconcileTimer = null;
  }

  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close((err) => {
        if (err) {
          logger.error({ err }, 'Error closing HTTP server');
          reject(err);
        } else {
          logger.info('HTTP server closed');
          resolve();
        }
      });
    }).catch(() => {
      // HTTP サーバーの停止に失敗してもシャットダウンは続行する
    });
  }

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

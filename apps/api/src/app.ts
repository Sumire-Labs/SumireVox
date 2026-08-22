import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { config } from './infrastructure/config.js';
import { requestLogger } from './middleware/request-logger.js';
import { sessionMiddleware } from './middleware/session-middleware.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRouter } from './routes/auth.js';
import { guildsRouter } from './routes/guilds.js';
import { dictionaryRouter } from './routes/dictionary.js';
import { userRouter } from './routes/user.js';
import { stripeWebhookRouter } from './routes/stripe-webhook.js';
import { adminRouter } from './routes/admin.js';
import { voicevoxRouter } from './routes/voicevox.js';
import { botInstancesRouter } from './routes/bot-instances.js';

/**
 * Hono アプリケーションを構築する。
 * ルート・ミドルウェアのマウント順序は index.ts から抽出した既存の挙動をそのまま維持する。
 */
export function createApp(): Hono {
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

  // Stripe Webhook（sessionMiddleware より前にマウント: raw body パース + セッション処理不要）
  app.route('/api/stripe', stripeWebhookRouter);

  // セッション読み込み（全リクエスト）
  app.use('*', sessionMiddleware);

  // ヘルスチェック（認証不要）
  app.get('/health', (c) => {
    return c.json({ status: 'ok' });
  });

  // ルート定義
  app.route('/auth', authRouter);
  app.route('/api/guilds', guildsRouter);
  app.route('/api/dictionary', dictionaryRouter);
  app.route('/api/user', userRouter);
  app.route('/api/admin', adminRouter);
  app.route('/api/voicevox', voicevoxRouter);
  app.route('/api/bot-instances', botInstancesRouter);

  // 未知パス・未対応メソッド（404）。Hono 4.12.8 は未対応メソッドも 405 ではなく 404 を返す
  app.notFound((c) => {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'リソースが見つかりません。' } },
      404,
    );
  });

  return app;
}

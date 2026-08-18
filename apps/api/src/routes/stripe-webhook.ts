import { Hono } from 'hono';
import type Stripe from 'stripe';
import { stripe } from '../infrastructure/stripe-client.js';
import { config } from '../infrastructure/config.js';
import { logger } from '../infrastructure/logger.js';
import { enqueueStripeEvent, drainStripeEventOutbox } from '../services/stripe-event-outbox.js';

export const stripeWebhookRouter = new Hono();

/**
 * POST /api/stripe/webhook
 * Stripe Webhook 受信。署名検証には raw body が必要。
 */
stripeWebhookRouter.post('/webhook', async (c) => {
  if (!stripe) {
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Stripe is not configured' } },
      503,
    );
  }

  const signature = c.req.header('stripe-signature');

  if (!signature) {
    return c.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing stripe-signature header' },
      },
      400,
    );
  }

  // フェーズ 1: 署名検証 — 失敗時のみ 400
  let event: Stripe.Event;
  try {
    const rawBody = await c.req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, config.stripeWebhookSecret);
  } catch (error) {
    logger.warn({ err: error }, 'Stripe webhook signature verification failed');
    return c.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid webhook signature' },
      },
      400,
    );
  }

  // フェーズ 2: 永続化（outbox）してから 200 を返す。
  // これにより、その後の業務処理の失敗やプロセスクラッシュでもイベントが失われず、
  // drainStripeEventOutbox（起動時・定期）が必ず再生する。Stripe の配信デッドライン
  // （約10秒）を守るため、業務処理そのものは直後に非同期で実行する。
  try {
    await enqueueStripeEvent(event);
  } catch (error) {
    logger.error({ err: error, eventId: event.id, eventType: event.type }, 'Failed to persist Stripe webhook event');
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Webhook event could not be persisted' } },
      500,
    );
  }

  // 非同期で処理（処理は冪等なので、多重実行しても安全）
  void drainStripeEventOutbox().catch((error) => {
    logger.error({ err: error }, 'Failed to drain Stripe event outbox');
  });

  return c.json({ received: true });
});
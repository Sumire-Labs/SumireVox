import { Hono } from 'hono';
import type Stripe from 'stripe';
import { handleStripeWebhook } from '../services/stripe-webhook-handler.js';
import { stripe } from '../infrastructure/stripe-client.js';
import { config } from '../infrastructure/config.js';
import { logger } from '../infrastructure/logger.js';

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

  // フェーズ 2: 業務処理 — 失敗時は 500 を返して Stripe に再試行させる
  try {
    await handleStripeWebhook(event);
  } catch (error) {
    logger.error({ err: error, eventId: event.id, eventType: event.type }, 'Stripe webhook processing failed');
    return c.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Webhook processing failed' },
      },
      500,
    );
  }

  return c.json({ received: true });
});

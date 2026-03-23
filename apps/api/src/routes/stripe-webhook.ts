import { Hono } from 'hono';
import { handleStripeWebhook } from '../services/stripe-webhook-handler.js';
import { config } from '../infrastructure/config.js';
import { logger } from '../infrastructure/logger.js';

export const stripeWebhookRouter = new Hono();

/**
 * POST /api/stripe/webhook
 * Stripe Webhook 受信。署名検証には raw body が必要。
 */
stripeWebhookRouter.post('/webhook', async (c) => {
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

  try {
    const rawBody = await c.req.text();
    await handleStripeWebhook(rawBody, signature, config.stripeWebhookSecret);
    return c.json({ received: true });
  } catch (error) {
    logger.error({ err: error }, 'Stripe webhook error');
    return c.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Webhook processing failed' },
      },
      400,
    );
  }
});

import Stripe from 'stripe';
import { config } from './config.js';
import { logger } from './logger.js';

export const stripe: Stripe | null = config.stripeSecretKey
  ? new Stripe(config.stripeSecretKey, { apiVersion: '2026-09-30.endive' })
  : null;

if (!stripe) {
  logger.warn('STRIPE_SECRET_KEY is not set. Stripe features will be disabled.');
}

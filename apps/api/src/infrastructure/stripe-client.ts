import Stripe from 'stripe';
import { config } from './config.js';

export const stripe = new Stripe(config.stripeSecretKey, {
  apiVersion: '2025-02-24.acacia',
});

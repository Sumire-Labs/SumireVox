import type Stripe from 'stripe';
import { AppError } from '../infrastructure/app-error.js';

export function stripeReferenceId(value: unknown): string | null {
  if (typeof value === 'string') return value || null;
  if (value !== null && typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
    return value.id || null;
  }
  return null;
}

export function stripeInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  if (invoice.parent?.type === 'subscription_details') {
    return stripeReferenceId(invoice.parent.subscription_details?.subscription);
  }
  // Previously persisted outbox events retain their original Stripe API shape.
  return 'subscription' in invoice ? stripeReferenceId(invoice.subscription) : null;
}

export function stripeSubscriptionPeriodEnd(subscription: Stripe.Subscription): Date {
  // Boost quantity and billing period must refer to the same subscription item.
  const itemPeriodEnd = subscription.items?.data[0]?.current_period_end;
  const legacyPeriodEnd = 'current_period_end' in subscription ? subscription.current_period_end : undefined;
  const periodEnd = itemPeriodEnd ?? legacyPeriodEnd;
  if (typeof periodEnd !== 'number' || !Number.isFinite(periodEnd) || periodEnd <= 0) {
    throw new AppError('INTERNAL_ERROR', 'Stripe subscription has no valid billing period', 502);
  }
  return new Date(periodEnd * 1000);
}

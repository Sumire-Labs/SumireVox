import type Stripe from 'stripe';

export function mapStripeStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case 'active':
      return 'ACTIVE';
    case 'past_due':
      return 'PAST_DUE';
    case 'canceled':
    case 'unpaid':
      return 'CANCELED';
    case 'incomplete':
    case 'incomplete_expired':
    case 'trialing':
    case 'paused':
    default:
      return 'INCOMPLETE';
  }
}

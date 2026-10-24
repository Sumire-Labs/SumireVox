import type Stripe from 'stripe';
import { stripeInvoiceSubscriptionId, stripeReferenceId } from './stripe-billing-data.js';

/** Resolve the paid invoices before using the legacy customer fallback. */
export async function stripeRefundSubscriptions(client: Stripe, charge: Stripe.Charge): Promise<string[]> {
  const legacyInvoiceId = 'invoice' in charge ? stripeReferenceId(charge.invoice) : null;
  if (legacyInvoiceId) {
    const invoice = await client.invoices.retrieve(legacyInvoiceId);
    const subscriptionId = stripeInvoiceSubscriptionId(invoice);
    return subscriptionId ? [subscriptionId] : [];
  }

  const paymentIntentId = stripeReferenceId(charge.payment_intent);
  if (!paymentIntentId) return [];

  const subscriptionIds = new Set<string>();
  let startingAfter: string | undefined;
  // A PaymentIntent may fund multiple invoices. Inspect every page, deduplicating subscriptions.
  do {
    const page = await client.invoicePayments.list({
      payment: { type: 'payment_intent', payment_intent: paymentIntentId },
      expand: ['data.invoice'],
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const payment of page.data) {
      if (payment.status !== 'paid') continue;
      const invoice = typeof payment.invoice === 'string'
        ? await client.invoices.retrieve(payment.invoice)
        : payment.invoice;
      if ('deleted' in invoice && invoice.deleted) continue;
      const subscriptionId = stripeInvoiceSubscriptionId(invoice);
      if (subscriptionId) subscriptionIds.add(subscriptionId);
    }
    startingAfter = page.has_more ? page.data.at(-1)?.id : undefined;
  } while (startingAfter);

  return [...subscriptionIds];
}

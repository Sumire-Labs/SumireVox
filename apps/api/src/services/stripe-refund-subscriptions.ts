import type Stripe from 'stripe';
import { AppError } from '../infrastructure/app-error.js';
import { stripeInvoiceSubscriptionId, stripeReferenceId } from './stripe-billing-data.js';

/** Only resolve a refund when every paid invoice identifies the same subscription. */
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
  let hasUnlinkedInvoice = false;
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
      if ('deleted' in invoice && invoice.deleted) {
        hasUnlinkedInvoice = true;
        continue;
      }
      const subscriptionId = stripeInvoiceSubscriptionId(invoice);
      if (subscriptionId) subscriptionIds.add(subscriptionId);
      else hasUnlinkedInvoice = true;
    }
    const nextCursor = page.data.at(-1)?.id;
    if (page.has_more && (!nextCursor || nextCursor === startingAfter)) {
      throw new AppError('INTERNAL_ERROR', 'Stripe invoice payment pagination did not advance', 502);
    }
    startingAfter = page.has_more ? nextCursor : undefined;
  } while (startingAfter);

  // A PaymentIntent can be shared with other invoices. Charge-level refunds do not
  // identify an allocation to each invoice: never cancel multiple or mixed contracts.
  return !hasUnlinkedInvoice && subscriptionIds.size === 1 ? [...subscriptionIds] : [];
}

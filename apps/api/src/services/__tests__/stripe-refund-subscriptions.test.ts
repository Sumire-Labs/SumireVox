import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import { stripeRefundSubscriptions } from '../stripe-refund-subscriptions.js';

const retrieve = vi.fn();
const list = vi.fn();
const client = { invoices: { retrieve }, invoicePayments: { list } } as unknown as Stripe;
const charge = (extra: Record<string, unknown> = {}) => ({ id: 'ch_1', payment_intent: 'pi_1', ...extra }) as Stripe.Charge;
const payment = (invoice: unknown, id = 'ip_1', status = 'paid') => ({ id, status, invoice });

describe('stripeRefundSubscriptions', () => {
  beforeEach(() => {
    retrieve.mockReset();
    list.mockReset().mockResolvedValue({ data: [], has_more: false });
  });

  it.each([
    { subscription: 'sub_1' },
    { subscription: { id: 'sub_1' } },
    { parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_1' } } },
    { parent: { type: 'subscription_details', subscription_details: { subscription: { id: 'sub_1' } } } },
  ])('resolves old and current invoice references: %j', async (invoice) => {
    retrieve.mockResolvedValue(invoice);
    expect(await stripeRefundSubscriptions(client, charge({ invoice: { id: 'in_1' } }))).toEqual(['sub_1']);
    expect(retrieve).toHaveBeenCalledExactlyOnceWith('in_1');
    expect(list).not.toHaveBeenCalled();
  });

  it('ignores open and canceled payments', async () => {
    list.mockResolvedValue({ data: [payment({ subscription: 'sub_open' }, 'ip_open', 'open'),
      payment({ subscription: 'sub_canceled' }, 'ip_canceled', 'canceled'),
      payment({ subscription: 'sub_paid' })], has_more: false });
    expect(await stripeRefundSubscriptions(client, charge())).toEqual(['sub_paid']);
  });

  it('rejects a deleted invoice mixed with a subscription invoice', async () => {
    list.mockResolvedValue({ data: [payment({ subscription: 'sub_paid' }),
      payment({ id: 'in_deleted', deleted: true }, 'ip_deleted')], has_more: false });
    expect(await stripeRefundSubscriptions(client, charge())).toEqual([]);
  });

  it('does not return the first page if the next page fails', async () => {
    list.mockResolvedValueOnce({ data: [payment({ subscription: 'sub_1' })], has_more: true })
      .mockRejectedValueOnce(new Error('Stripe unavailable'));
    await expect(stripeRefundSubscriptions(client, charge())).rejects.toThrow('Stripe unavailable');
  });

  it('propagates invoice retrieval failures instead of returning no linkage', async () => {
    retrieve.mockRejectedValueOnce(new Error('Stripe unavailable'));
    await expect(stripeRefundSubscriptions(client, charge({ invoice: 'in_1' }))).rejects.toThrow('Stripe unavailable');
  });

  it('rejects a repeated page cursor instead of silently canceling a subset', async () => {
    list.mockResolvedValue({ data: [payment({ subscription: 'sub_1' })], has_more: true });
    await expect(stripeRefundSubscriptions(client, charge())).rejects.toThrow('pagination did not advance');
    expect(list).toHaveBeenCalledTimes(2);
  });
});

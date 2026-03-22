export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE';

export interface Subscription {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
  boostCount: number;
}

export interface Boost {
  id: string;
  subscriptionId: string;
  guildId: string | null;
  assignedAt: Date | null;
  unassignedAt: Date | null;
}

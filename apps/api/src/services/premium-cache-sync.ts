import { REDIS_CHANNELS } from '@sumirevox/shared';
import { publishEvent } from '../infrastructure/pubsub.js';

export async function publishGuildPremiumInvalidation(
  guildIds: Array<string | null | undefined>,
): Promise<void> {
  const uniqueGuildIds = Array.from(
    new Set(guildIds.filter((guildId): guildId is string => typeof guildId === 'string' && guildId.length > 0)),
  );

  await Promise.all(
    uniqueGuildIds.map((guildId) =>
      publishEvent(REDIS_CHANNELS.GUILD_PREMIUM_UPDATED, JSON.stringify({ guildId })),
    ),
  );
}

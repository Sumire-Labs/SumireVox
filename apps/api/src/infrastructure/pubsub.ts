import { logger } from './logger.js';
import { getRedisPublisher, getRedisSubscriber } from './redis.js';

type PubSubHandler = (message: string) => void;
const PUBLISH_RETRY_DELAYS_MS = [100, 250, 500] as const;

export function setupPubSub(handlers: Partial<Record<string, PubSubHandler>>): void {
  const subscriber = getRedisSubscriber();
  const channels = Object.keys(handlers);

  if (channels.length === 0) return;

  subscriber.subscribe(...channels, (err: Error | null | undefined) => {
    if (err) {
      logger.error({ err }, 'Failed to subscribe to Redis channels');
      return;
    }
    logger.info({ channels }, 'Subscribed to Redis channels');
  });

  subscriber.on('message', (channel: string, message: string) => {
    const handler = handlers[channel];
    if (handler) {
      handler(message);
    }
  });
}

export async function publishEvent(channel: string, message: string): Promise<number> {
  for (let attempt = 1; attempt <= PUBLISH_RETRY_DELAYS_MS.length + 1; attempt++) {
    try {
      return await getRedisPublisher().publish(channel, message);
    } catch (err) {
      const retryDelay = PUBLISH_RETRY_DELAYS_MS[attempt - 1];

      if (retryDelay === undefined) {
        logger.error({ err, channel, attempt }, 'Failed to publish Redis event after retries');
        return 0;
      }

      logger.warn(
        { err, channel, attempt, retryDelay },
        'Failed to publish Redis event, retrying',
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  return 0;
}

export async function cleanupPubSub(): Promise<void> {
  try {
    await getRedisSubscriber().unsubscribe();
  } catch (err) {
    logger.error({ err }, 'Failed to unsubscribe from Redis channels');
  }
}

import { logger } from './logger.js';
import { getRedisPublisher, getRedisSubscriber } from './redis.js';

type PubSubHandler = (message: string) => void;

export function setupPubSub(handlers: Partial<Record<string, PubSubHandler>>): void {
  const subscriber = getRedisSubscriber();
  const channels = Object.keys(handlers);

  if (channels.length === 0) return;

  subscriber.subscribe(...channels, (err) => {
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

export async function publishEvent(channel: string, message: string): Promise<void> {
  try {
    await getRedisPublisher().publish(channel, message);
  } catch (err) {
    logger.error({ err, channel }, 'Failed to publish Redis event');
  }
}

export async function cleanupPubSub(): Promise<void> {
  try {
    await getRedisSubscriber().unsubscribe();
  } catch (err) {
    logger.error({ err }, 'Failed to unsubscribe from Redis channels');
  }
}

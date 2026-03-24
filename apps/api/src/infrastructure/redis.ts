import { Redis } from 'ioredis';
import { config } from './config.js';
import { logger } from './logger.js';

let redisClient: Redis | null = null;
let redisSubscriber: Redis | null = null;
let redisPublisher: Redis | null = null;

function createRedisInstance(name: string): Redis {
  const client = new Redis(config.redisUrl, {
    lazyConnect: false,
    maxRetriesPerRequest: 3,
    retryStrategy: (attempt: number) => attempt * Math.min(attempt * 200, 5000),
  });

  client.on('ready', () => {
    logger.info(`Redis ${name} connected`);
  });

  client.on('error', (err: Error) => {
    logger.error({ err }, `Redis ${name} error`);
  });

  return client;
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = createRedisInstance('client');
  }
  return redisClient;
}

export function getRedisSubscriber(): Redis {
  if (!redisSubscriber) {
    redisSubscriber = createRedisInstance('subscriber');
  }
  return redisSubscriber;
}

export function getRedisPublisher(): Redis {
  if (!redisPublisher) {
    redisPublisher = createRedisInstance('publisher');
  }
  return redisPublisher;
}

export async function disconnectRedis(): Promise<void> {
  await Promise.all(
    [redisClient, redisSubscriber, redisPublisher]
      .filter((instance): instance is Redis => instance !== null)
      .map((instance) => instance.quit()),
  );
  redisClient = null;
  redisSubscriber = null;
  redisPublisher = null;
}

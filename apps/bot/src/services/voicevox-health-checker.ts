import { config } from '../infrastructure/config.js';
import { logger } from '../infrastructure/logger.js';
import { checkHealth } from '../infrastructure/voicevox-client.js';

interface InstanceHealth {
  url: string;
  healthy: boolean;
  consecutiveFailures: number;
  lastCheckedAt: Date | null;
}

const instances: Map<string, InstanceHealth> = new Map(
  config.voicevoxUrls.map((url) => [
    url,
    { url, healthy: true, consecutiveFailures: 0, lastCheckedAt: null },
  ]),
);

let intervalId: ReturnType<typeof setInterval> | null = null;

async function runChecks(): Promise<void> {
  const entries = Array.from(instances.values());
  const results = await Promise.allSettled(
    entries.map((instance) => checkHealth(instance.url)),
  );

  results.forEach((result, i) => {
    const instance = entries[i];
    if (!instance) return;

    const wasHealthy = instance.healthy;
    const isNowHealthy = result.status === 'fulfilled' && result.value === true;

    instance.lastCheckedAt = new Date();

    if (isNowHealthy) {
      if (!wasHealthy) {
        logger.info({ url: instance.url }, 'VOICEVOX instance recovered');
      }
      instance.healthy = true;
      instance.consecutiveFailures = 0;
    } else {
      instance.consecutiveFailures++;
      if (wasHealthy && instance.consecutiveFailures >= 3) {
        instance.healthy = false;
        logger.warn(
          { url: instance.url, consecutiveFailures: instance.consecutiveFailures },
          'VOICEVOX instance marked unhealthy',
        );
      }
    }
  });
}

export function startHealthChecker(): void {
  void runChecks();
  intervalId = setInterval(() => {
    void runChecks();
  }, config.healthCheckIntervalSeconds * 1000);
}

export function stopHealthChecker(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function isHealthy(url: string): boolean {
  return instances.get(url)?.healthy ?? false;
}

export function getHealthyUrls(): string[] {
  return Array.from(instances.values())
    .filter((i) => i.healthy)
    .map((i) => i.url);
}

export function getAllInstanceHealth(): InstanceHealth[] {
  return Array.from(instances.values());
}

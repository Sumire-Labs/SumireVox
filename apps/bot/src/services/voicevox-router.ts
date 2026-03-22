import { getHealthyUrls } from './voicevox-health-checker.js';

let roundRobinIndex = 0;

export function getNextVoicevoxUrl(): string | null {
  const urls = getHealthyUrls();
  if (urls.length === 0) return null;
  const url = urls[roundRobinIndex % urls.length];
  roundRobinIndex++;
  return url ?? null;
}

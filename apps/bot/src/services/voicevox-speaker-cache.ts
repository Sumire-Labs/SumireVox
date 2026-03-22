import type { VoicevoxSpeaker } from '@sumirevox/shared';
import { config } from '../infrastructure/config.js';
import { logger } from '../infrastructure/logger.js';
import { fetchSpeakers } from '../infrastructure/voicevox-client.js';
import { getHealthyUrls } from './voicevox-health-checker.js';

const RETRY_DELAY_MS = 5_000;
const MAX_RETRIES = 3;

let speakers: VoicevoxSpeaker[] = [];

export async function loadSpeakers(): Promise<void> {
  const targetUrl = getHealthyUrls()[0] ?? config.voicevoxUrls[0];

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (!targetUrl) throw new Error('No VOICEVOX URL configured');
      speakers = await fetchSpeakers(targetUrl);
      return;
    } catch (err) {
      logger.warn({ err, attempt, url: targetUrl }, 'Failed to fetch VOICEVOX speakers, retrying...');
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  logger.error('All attempts to fetch VOICEVOX speakers failed. Speaker cache will be empty.');
  speakers = [];
}

export function getSpeakers(): VoicevoxSpeaker[] {
  return speakers;
}

export function getSpeakerStyleName(styleId: number): string | null {
  for (const speaker of speakers) {
    for (const style of speaker.styles) {
      if (style.id === styleId) {
        return `${speaker.name}（${style.name}）`;
      }
    }
  }
  return null;
}

export function getFirstSpeakerId(): number {
  return speakers[0]?.styles[0]?.id ?? config.defaultSpeakerId;
}

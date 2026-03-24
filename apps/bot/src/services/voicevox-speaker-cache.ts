import type { VoicevoxSpeaker } from '@sumirevox/shared';
import { config } from '../infrastructure/config.js';
import { logger } from '../infrastructure/logger.js';
import { fetchSpeakers } from '../infrastructure/voicevox-client.js';
import { getHealthyUrls } from './voicevox-health-checker.js';

const RETRY_DELAY_MS = 5_000;
const MAX_RETRIES = 3;

let speakers: VoicevoxSpeaker[] = [];

export async function loadSpeakers(): Promise<void> {
  const candidates = [...new Set([...getHealthyUrls(), ...config.voicevoxUrls])];

  for (const url of candidates) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        speakers = await fetchSpeakers(url);
        logger.info({ url, count: speakers.length }, 'VOICEVOX speakers loaded');
        return;
      } catch (err) {
        logger.warn({ err, attempt, url }, 'Failed to fetch VOICEVOX speakers');
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
      }
    }
    logger.warn({ url }, 'All retries exhausted for this URL, trying next');
  }

  speakers = [];
  logger.error({ candidates }, 'All VOICEVOX URLs failed — speaker list is empty');
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

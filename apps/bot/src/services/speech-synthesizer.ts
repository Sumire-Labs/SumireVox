import { logger } from '../infrastructure/logger.js';
import {
  createAudioQuery,
  applyVoiceParams,
  synthesize,
} from '../infrastructure/voicevox-client.js';
import { getNextVoicevoxUrl } from './voicevox-router.js';

export async function synthesizeSpeech(
  text: string,
  speakerId: number,
  speedScale: number,
  pitchScale: number,
): Promise<Buffer | null> {
  const url = getNextVoicevoxUrl();
  if (url === null) {
    logger.warn('No healthy VOICEVOX instance available');
    return null;
  }

  try {
    const audioQuery = await createAudioQuery(url, text, speakerId);
    const adjustedQuery = applyVoiceParams(audioQuery, speedScale, pitchScale);
    return await synthesize(url, adjustedQuery, speakerId);
  } catch (err) {
    logger.error({ err, url, speakerId }, 'Speech synthesis failed');
    return null;
  }
}

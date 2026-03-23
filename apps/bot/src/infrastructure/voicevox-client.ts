import type { VoicevoxSpeaker } from '@sumirevox/shared';

const TIMEOUT_AUDIO_QUERY_MS = 10_000;
const TIMEOUT_SYNTHESIS_MS = 30_000;
const TIMEOUT_SPEAKERS_MS = 10_000;
const TIMEOUT_HEALTH_MS = 5_000;

function withTimeout(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export async function createAudioQuery(
  baseUrl: string,
  text: string,
  speakerId: number,
): Promise<unknown> {
  const url = `${baseUrl}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`;
  const response = await fetch(url, {
    method: 'POST',
    signal: withTimeout(TIMEOUT_AUDIO_QUERY_MS),
  });
  if (!response.ok) {
    throw new Error(`audio_query failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function synthesize(
  baseUrl: string,
  audioQuery: unknown,
  speakerId: number,
): Promise<Buffer> {
  const url = `${baseUrl}/synthesis?speaker=${speakerId}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(audioQuery),
    signal: withTimeout(TIMEOUT_SYNTHESIS_MS),
  });
  if (!response.ok) {
    throw new Error(`synthesis failed: ${response.status} ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer);
}

export function applyVoiceParams(
  audioQuery: unknown,
  speedScale: number,
  pitchScale: number,
): unknown {
  return { ...(audioQuery as Record<string, unknown>), speedScale, pitchScale };
}

export async function fetchSpeakers(baseUrl: string): Promise<VoicevoxSpeaker[]> {
  const response = await fetch(`${baseUrl}/speakers`, {
    signal: withTimeout(TIMEOUT_SPEAKERS_MS),
  });
  if (!response.ok) {
    throw new Error(`fetchSpeakers failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<VoicevoxSpeaker[]>;
}

export async function checkHealth(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/version`, {
      signal: withTimeout(TIMEOUT_HEALTH_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

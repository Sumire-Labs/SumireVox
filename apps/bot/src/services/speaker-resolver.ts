import { getUserVoiceSetting } from './user-voice-setting-service.js';
import { getGuildSettings } from './guild-settings-service.js';
import { getFirstSpeakerId } from './voicevox-speaker-cache.js';
import { config } from '../infrastructure/config.js';

export interface ResolvedVoiceParams {
  speakerId: number;
  speedScale: number;
  pitchScale: number;
}

/**
 * 読み上げ時の音声パラメータを解決する
 *
 * 話者のフォールバック順序:
 * 1. ユーザー設定
 * 2. サーバーのデフォルト話者
 * 3. 環境変数 DEFAULT_SPEAKER_ID
 * 4. VOICEVOX 話者一覧の先頭
 *
 * 速度・ピッチはユーザー設定の値を使用する
 */
export async function resolveVoiceParams(
  userId: string,
  guildId: string,
): Promise<ResolvedVoiceParams> {
  const [guildSettings, userSetting] = await Promise.all([
    getGuildSettings(guildId),
    getUserVoiceSetting(userId),
  ]);
  const speakerId =
    userSetting.speakerId ??
    guildSettings.defaultSpeakerId ??
    config.defaultSpeakerId ??
    getFirstSpeakerId();
  return {
    speakerId,
    speedScale: userSetting.speedScale,
    pitchScale: userSetting.pitchScale,
  };
}

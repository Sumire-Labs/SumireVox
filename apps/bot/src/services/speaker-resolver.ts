import { getUserVoiceSetting } from './user-voice-setting-service.js';
import { getGuildSettings } from './guild-settings-service.js';
import { getFirstSpeakerId } from './voicevox-speaker-cache.js';
import { config } from '../infrastructure/config.js';
import { LIMITS } from '@sumirevox/shared';

export interface ResolvedVoiceParams {
  speakerId: number;
  speedScale: number;
  pitchScale: number;
}

/**
 * 読み上げ時の音声パラメータを解決する
 *
 * 話者のフォールバック順序:
 * 1. ユーザー設定 (PREMIUM のみ)
 * 2. サーバーのデフォルト話者
 * 3. 環境変数 DEFAULT_SPEAKER_ID
 * 4. VOICEVOX 話者一覧の先頭
 *
 * 速度・ピッチ:
 * - PREMIUM: ユーザー設定の値
 * - FREE: 固定値 (1.0 / 0.0)
 */
export async function resolveVoiceParams(
  userId: string,
  guildId: string,
  isPremium: boolean,
): Promise<ResolvedVoiceParams> {
  const guildSettings = await getGuildSettings(guildId);

  if (isPremium) {
    const userSetting = await getUserVoiceSetting(userId);
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

  // FREE サーバー: ユーザー設定は適用しない
  const speakerId =
    guildSettings.defaultSpeakerId ??
    config.defaultSpeakerId ??
    getFirstSpeakerId();
  return {
    speakerId,
    speedScale: LIMITS.DEFAULT_SPEED_SCALE,
    pitchScale: LIMITS.DEFAULT_PITCH_SCALE,
  };
}

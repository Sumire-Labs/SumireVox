import { VoiceState } from 'discord.js';
import { getVcSession } from '../services/vc-session-manager.js';
import { getGuildSettings } from '../services/guild-settings-service.js';
import { enqueue } from '../services/speech-queue.js';
import { getDictionaryTrie, trieReplace } from '../services/text-pipeline/index.js';
import {
  checkAutoDisconnect,
  handleAutoJoinVoiceState,
} from '../services/auto-connection-service.js';
import { getClient } from '../infrastructure/discord-client.js';
import { config } from '../infrastructure/config.js';
import { logger } from '../infrastructure/logger.js';

/**
 * voiceStateUpdate イベントのハンドラ
 */
export async function handleVoiceStateUpdate(
  oldState: VoiceState,
  newState: VoiceState,
): Promise<void> {
  const guild = newState.guild;
  const guildId = guild.id;
  const client = getClient();

  const member = newState.member ?? oldState.member;
  // 自 Bot は無視
  if (member?.id === client.user?.id) return;
  // 他 Bot も無視（auto-join の誤発動、Bot同士の join 誘発を防止）
  if (member?.user.bot) return;

  const session = getVcSession(guildId);

  // ==============================
  // 自動接続の処理
  // ==============================
  if (!session) {
    await handleAutoJoinVoiceState(oldState, newState);
    return;
  }

  // ==============================
  // 以下、Bot が VC に接続中の場合の処理
  // ==============================
  const botVoiceChannelId = session.voiceChannelId;

  // ユーザーが Bot のいる VC に参加した場合
  const joinedBotChannel =
    newState.channelId === botVoiceChannelId && oldState.channelId !== botVoiceChannelId;

  // ユーザーが Bot のいる VC から退出した場合
  const leftBotChannel =
    oldState.channelId === botVoiceChannelId && newState.channelId !== botVoiceChannelId;

  // ミュート・画面共有等のイベント（チャンネル変更なし）は無視
  if (!joinedBotChannel && !leftBotChannel) return;

  // ---- 入退室通知 ----
  await handleJoinLeaveNotification(
    guildId,
    newState.member?.displayName ?? oldState.member?.displayName ?? 'ユーザー',
    joinedBotChannel ? 'join' : 'leave',
  );

  // ---- 自動退出タイマー ----
  await checkAutoDisconnect(guildId, guild, botVoiceChannelId);
}

/**
 * 入退室通知の読み上げ
 */
async function handleJoinLeaveNotification(
  guildId: string,
  displayName: string,
  event: 'join' | 'leave',
): Promise<void> {
  try {
    const settings = await getGuildSettings(guildId);
    if (!settings.joinLeaveNotification) return;

    const trie = await getDictionaryTrie(guildId);
    const baseName = trie ? trieReplace(trie, displayName) : displayName;
    const nameWithSuffix = settings.addSanSuffix ? `${baseName}さん` : baseName;
    const templateText = event === 'join' ? 'が参加しました' : 'が退出しました';
    const fullText = `${nameWithSuffix}${templateText}`;

    const speakerId = settings.defaultSpeakerId ?? config.defaultSpeakerId;

    enqueue(
      guildId,
      fullText,
      speakerId,
      1.0, // 入退室通知は固定速度
      0.0, // 入退室通知は固定ピッチ
    );

    logger.debug({ guildId, displayName, event }, 'Join/leave notification enqueued');
  } catch (error) {
    logger.error({ err: error, guildId }, 'Failed to enqueue join/leave notification');
  }
}

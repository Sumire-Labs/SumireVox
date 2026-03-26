import { VoiceState, PermissionFlagsBits } from 'discord.js';
import { getVcSession, createVcSession } from '../services/vc-session-manager.js';
import { getGuildSettings, getInstanceSettings } from '../services/guild-settings-service.js';
import { enqueue, enqueuePreSynthesized } from '../services/speech-queue.js';
import { getPredefinedAudio } from '../services/predefined-audio-cache.js';
import { startDisconnectTimer, cancelDisconnectTimer } from '../services/auto-disconnect-timer.js';
import { canInstanceConnect } from '../services/premium-service.js';
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
    await handleAutoJoin(oldState, newState, guildId);
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
  await handleAutoDisconnect(guildId, botVoiceChannelId, guild);
}

/**
 * 自動接続の処理
 */
async function handleAutoJoin(
  oldState: VoiceState,
  newState: VoiceState,
  guildId: string,
): Promise<void> {
  // ユーザーが VC に参加した場合のみ（退出は無視）
  if (!newState.channelId) return;

  // チャンネル変更なし（ミュート等）は無視
  if (oldState.channelId === newState.channelId) return;

  try {
    const settings = await getGuildSettings(guildId);
    const instanceSettings = getInstanceSettings(settings, config.botInstanceId);

    // このインスタンスの自動接続が OFF
    if (!instanceSettings.autoJoin) return;

    // テキストチャンネルが未設定
    if (!instanceSettings.textChannelId) return;

    // 指定 VC チャンネルがある場合、そのチャンネルへの参加のみ対象
    if (instanceSettings.voiceChannelId && newState.channelId !== instanceSettings.voiceChannelId) return;

    // インスタンス接続制限チェック (2号機以降はブースト数が必要)
    if (config.botInstanceId > 1) {
      const allowed = await canInstanceConnect(guildId, config.botInstanceId);
      if (!allowed) {
        logger.info(
          { guildId, instanceId: config.botInstanceId },
          'Auto-join skipped: insufficient boosts for this instance',
        );
        return;
      }
    }

    const guild = newState.guild;
    const voiceChannel = newState.channel;
    if (!voiceChannel) return;

    // Bot の権限チェック
    const me = guild.members.me;
    if (!me) return;

    const permissions = voiceChannel.permissionsFor(me);
    if (!permissions) return;

    if (
      !permissions.has(PermissionFlagsBits.Connect) ||
      !permissions.has(PermissionFlagsBits.Speak)
    ) {
      logger.warn(
        { guildId, channelId: voiceChannel.id },
        'Auto-join skipped: missing Connect or Speak permission',
      );
      return;
    }

    // VC に接続
    await createVcSession(
      guildId,
      voiceChannel.id,
      instanceSettings.textChannelId,
      guild.voiceAdapterCreator,
    );

    logger.info(
      { guildId, voiceChannelId: voiceChannel.id, textChannelId: instanceSettings.textChannelId },
      'Auto-joined VC',
    );

    // 挨拶の読み上げ
    if (settings.greetingOnJoin) {
      const speakerId = settings.defaultSpeakerId ?? config.defaultSpeakerId;
      const audio = await getPredefinedAudio('接続しました', speakerId, 1.0, 0.0);
      if (audio) {
        enqueuePreSynthesized(guildId, audio);
      }
    }
  } catch (error) {
    logger.error({ err: error, guildId }, 'Auto-join failed');
  }
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

    const nameWithSuffix = settings.addSanSuffix ? `${displayName}さん` : displayName;
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

/**
 * 自動退出タイマーの管理
 * Bot のいる VC に Bot 以外誰もいなくなったらタイマー開始、
 * 誰かが戻ってきたらタイマーキャンセル
 */
async function handleAutoDisconnect(
  guildId: string,
  botVoiceChannelId: string,
  guild: VoiceState['guild'],
): Promise<void> {
  try {
    const voiceChannel = guild.channels.cache.get(botVoiceChannelId);
    if (!voiceChannel || !voiceChannel.isVoiceBased()) return;

    const humanMembers = voiceChannel.members.filter((member) => !member.user.bot);

    if (humanMembers.size === 0) {
      startDisconnectTimer(guildId);
    } else {
      cancelDisconnectTimer(guildId);
    }
  } catch (error) {
    logger.error({ err: error, guildId }, 'Error in auto-disconnect check');
  }
}

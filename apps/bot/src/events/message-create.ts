import { readFile } from 'node:fs/promises';
import { Message } from 'discord.js';
import { getVcSession } from '../services/vc-session-manager.js';
import { getGuildSettings } from '../services/guild-settings-service.js';
import { isGuildPremium } from '../services/premium-service.js';
import { resolveVoiceParams } from '../services/speaker-resolver.js';
import { runPipeline, getDictionaryTrie, PipelineContext } from '../services/text-pipeline/index.js';
import { truncateForSpeech } from '../services/text-pipeline/truncate.js';
import { enqueue, enqueuePreSynthesized } from '../services/speech-queue.js';
import { matchEasterEgg } from '../services/easter-eggs.js';
import { clampReadLength } from '@sumirevox/shared';
import { logger } from '../infrastructure/logger.js';

/**
 * メッセージ受信イベントのハンドラ
 * テキストチャンネルのメッセージを読み上げキューに追加する
 */
export async function handleMessageCreate(message: Message): Promise<void> {
  // 1. 基本フィルタリング
  if (!message.guild) return; // DM は無視
  if (message.author.bot) return; // Bot メッセージは無視
  if (message.webhookId) return; // Webhook メッセージは無視
  if (message.system) return; // システムメッセージは無視

  const guildId = message.guild.id;

  // 2. VC セッションの確認
  const session = getVcSession(guildId);
  if (!session) return; // Bot が VC に接続していない

  // 3. 読み上げ対象チャンネルの確認
  if (message.channelId !== session.textChannelId) return;

  // 4. Embed のみのメッセージは無視
  if (!message.content && message.embeds.length > 0) return;

  try {
    // イースターエッグチェック（テキストパイプラインより前に行う）
    const easterEggFile = matchEasterEgg(message.content);
    if (easterEggFile) {
      const buffer = await readFile(easterEggFile);
      enqueuePreSynthesized(guildId, buffer);
      return;
    }

    const guildSettings = await getGuildSettings(guildId);
    const isPremium = await isGuildPremium(guildId);

    // 5. テキスト前処理
    let processedText = '';
    if (message.content) {
      const dictionaryTrie = await getDictionaryTrie(guildId);
      const repliedUserId = message.reference
        ? (message.mentions.repliedUser?.id ?? null)
        : null;
      const context: PipelineContext = {
        guildSettings,
        guild: message.guild,
        hasReference: !!message.reference,
        repliedUserId,
        dictionaryTrie,
      };
      processedText = runPipeline(message.content, context, isPremium);
    }

    // 6. 名前の読み上げ
    let namePrefix = '';
    if (guildSettings.readUsername) {
      const displayName = message.member?.displayName ?? message.author.displayName;
      const name = guildSettings.addSanSuffix ? `${displayName}さん` : displayName;
      namePrefix = `${name}、`;
    }

    // 7. スタンプ・添付ファイルの読み上げ
    let suffix = '';
    if (guildSettings.readTargetType !== 'text_only') {
      if (
        message.stickers.size > 0 &&
        (guildSettings.readTargetType === 'text_and_sticker' ||
          guildSettings.readTargetType === 'text_sticker_and_attachment')
      ) {
        const stickerNames = message.stickers.map((s) => s.name).join('、');
        suffix += stickerNames;
      }

      if (
        message.attachments.size > 0 &&
        guildSettings.readTargetType === 'text_sticker_and_attachment'
      ) {
        const count = message.attachments.size;
        suffix += `${suffix ? '、' : ''}${count}件の添付ファイル`;
      }
    }

    // 8. 最終テキストの組み立て
    let finalText =
      `${namePrefix}${processedText}${suffix ? (processedText ? '、' : '') + suffix : ''}`.trim();

    // テキストが空の場合はスキップ
    if (!finalText) return;

    // 最終読み上げ文にも上限を適用（prefix/suffix で超過する可能性があるため）
    const effectiveMax = clampReadLength(guildSettings.maxReadLength, isPremium);
    finalText = truncateForSpeech(finalText, effectiveMax, '、以下省略');

    // 9. 音声パラメータの解決
    const voiceParams = await resolveVoiceParams(message.author.id, guildId, isPremium);

    // 10. キューに追加
    enqueue(guildId, finalText, voiceParams.speakerId, voiceParams.speedScale, voiceParams.pitchScale);

    logger.debug(
      {
        guildId,
        channelId: message.channelId,
        userId: message.author.id,
        textLength: finalText.length,
      },
      'Message enqueued for reading',
    );
  } catch (error) {
    logger.error(
      { err: error, guildId, messageId: message.id },
      'Error processing message for reading',
    );
  }
}

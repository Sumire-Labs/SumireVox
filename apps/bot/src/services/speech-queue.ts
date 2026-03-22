import {
  createAudioResource,
  AudioPlayer,
  AudioPlayerStatus,
  StreamType,
} from '@discordjs/voice';
import { Readable } from 'node:stream';
import { Semaphore } from './semaphore.js';
import { synthesizeSpeech } from './speech-synthesizer.js';
import { getConnection } from './vc-session-manager.js';
import { config } from '../infrastructure/config.js';
import { logger } from '../infrastructure/logger.js';
import { LIMITS } from '@sumirevox/shared';

/**
 * キューに追加するメッセージアイテム
 */
export interface QueueItem {
  /** 合成対象のテキスト（前処理済み） */
  text: string;
  /** VOICEVOX 話者ID */
  speakerId: number;
  /** 速度 */
  speedScale: number;
  /** ピッチ */
  pitchScale: number;
  /** 順序保持用のシーケンス番号 */
  sequence: number;
}

/**
 * 合成結果
 */
interface SynthesisResult {
  sequence: number;
  buffer: Buffer | null; // 合成失敗時は null
}

// ギルドごとのキューと状態を管理する Map
interface GuildQueue {
  items: QueueItem[];
  processing: boolean;
  player: AudioPlayer;
  sequenceCounter: number;
  guildSemaphore: Semaphore;
}

const guildQueues = new Map<string, GuildQueue>();

// シャード単位のグローバルセマフォ
// MAX_CONCURRENT_SYNTHESIS_GLOBAL をシャード数で割った値が上限
// シャード数は起動時に決まるため、初期化を遅延する
let shardSemaphore: Semaphore | null = null;

/**
 * シャードセマフォを初期化する
 * bot.ts の ClientReady で呼ぶ
 */
export function initShardSemaphore(totalShards: number): void {
  const perShard = Math.max(1, Math.floor(config.maxConcurrentSynthesisGlobal / totalShards));
  shardSemaphore = new Semaphore(perShard);
  logger.info({ totalShards, perShard }, 'Shard semaphore initialized');
}

/**
 * ギルドの GuildQueue を取得または作成する
 */
function getOrCreateGuildQueue(guildId: string): GuildQueue {
  let gq = guildQueues.get(guildId);
  if (!gq) {
    const player = new AudioPlayer();
    gq = {
      items: [],
      processing: false,
      player,
      sequenceCounter: 0,
      guildSemaphore: new Semaphore(config.maxConcurrentSynthesisPerGuild),
    };
    guildQueues.set(guildId, gq);
  }
  return gq;
}

/**
 * メッセージをキューに追加する
 */
export function enqueue(
  guildId: string,
  text: string,
  speakerId: number,
  speedScale: number,
  pitchScale: number,
): void {
  const gq = getOrCreateGuildQueue(guildId);
  const item: QueueItem = {
    text,
    speakerId,
    speedScale,
    pitchScale,
    sequence: gq.sequenceCounter++,
  };
  gq.items.push(item);
  logger.debug(
    { guildId, sequence: item.sequence, queueLength: gq.items.length },
    'Message enqueued',
  );
  // キュー処理が動いていなければ開始
  if (!gq.processing) {
    processQueue(guildId).catch((error) => {
      logger.error({ err: error, guildId }, 'Queue processing error');
    });
  }
}

// 事前合成済みバッファの保存先
const preSynthesizedBuffers = new Map<string, Buffer>();

/**
 * 事前合成済みの WAV バッファを直接キューに追加する（定型文キャッシュ用）
 */
export function enqueuePreSynthesized(guildId: string, buffer: Buffer): void {
  const gq = getOrCreateGuildQueue(guildId);
  const item: QueueItem = {
    text: '', // ダミー
    speakerId: 0, // ダミー
    speedScale: 1.0,
    pitchScale: 0.0,
    sequence: gq.sequenceCounter++,
  };
  gq.items.push(item);
  preSynthesizedBuffers.set(`${guildId}:${item.sequence}`, buffer);
  if (!gq.processing) {
    processQueue(guildId).catch((error) => {
      logger.error({ err: error, guildId }, 'Queue processing error');
    });
  }
}

/**
 * キューを処理する
 * バッチ単位で先読み合成し、順番に再生する
 */
async function processQueue(guildId: string): Promise<void> {
  const gq = guildQueues.get(guildId);
  if (!gq || gq.processing) return;
  gq.processing = true;
  try {
    while (gq.items.length > 0) {
      // VC 接続が切れていたら停止
      const connection = getConnection(guildId);
      if (!connection) {
        logger.info({ guildId }, 'No voice connection, stopping queue');
        break;
      }
      // バッチを取り出す（最大 PREFETCH_BATCH_SIZE 件）
      const batch = gq.items.splice(0, LIMITS.PREFETCH_BATCH_SIZE);
      // バッチ内のアイテムを並列合成
      const results = await synthesizeBatch(guildId, batch);
      // 順序通りに再生
      for (const result of results) {
        if (!result.buffer) {
          // 合成失敗 → スキップ
          continue;
        }
        // VC 接続が切れていたら停止
        const conn = getConnection(guildId);
        if (!conn) {
          logger.info({ guildId }, 'No voice connection during playback, stopping queue');
          return;
        }
        await playAudio(gq.player, conn, result.buffer);
      }
    }
  } finally {
    gq.processing = false;
  }
}

/**
 * バッチ内のアイテムを並列合成する
 * ギルド単位セマフォ + シャード単位セマフォの2層で制御
 */
async function synthesizeBatch(guildId: string, batch: QueueItem[]): Promise<SynthesisResult[]> {
  const gq = guildQueues.get(guildId);
  if (!gq) return [];

  const promises = batch.map(async (item): Promise<SynthesisResult> => {
    // 事前合成済みバッファがある場合はそれを使用
    const preKey = `${guildId}:${item.sequence}`;
    const preSynthesized = preSynthesizedBuffers.get(preKey);
    if (preSynthesized) {
      preSynthesizedBuffers.delete(preKey);
      return { sequence: item.sequence, buffer: preSynthesized };
    }

    // 2層セマフォ: 両方 acquire してから合成、完了後に両方 release
    await gq.guildSemaphore.acquire();
    if (shardSemaphore) {
      await shardSemaphore.acquire();
    }
    try {
      const buffer = await synthesizeSpeech(
        item.text,
        item.speakerId,
        item.speedScale,
        item.pitchScale,
      );
      return { sequence: item.sequence, buffer };
    } catch (error) {
      logger.error({ err: error, guildId, sequence: item.sequence }, 'Speech synthesis failed');
      return { sequence: item.sequence, buffer: null };
    } finally {
      if (shardSemaphore) {
        shardSemaphore.release();
      }
      gq.guildSemaphore.release();
    }
  });

  // 全ての合成を待つ（Promise.all で並列実行）
  const results = await Promise.all(promises);
  // シーケンス番号でソートして順序を保持
  results.sort((a, b) => a.sequence - b.sequence);
  return results;
}

/**
 * AudioPlayer で音声を再生し、完了を待つ
 */
async function playAudio(
  player: AudioPlayer,
  connection: import('@discordjs/voice').VoiceConnection,
  buffer: Buffer,
): Promise<void> {
  return new Promise<void>((resolve) => {
    try {
      const stream = Readable.from(buffer);
      const resource = createAudioResource(stream, {
        inputType: StreamType.Arbitrary,
      });

      // プレイヤーを接続にサブスクライブ
      connection.subscribe(player);
      player.play(resource);

      const onIdle = (): void => {
        cleanup();
        resolve();
      };

      const onError = (error: Error): void => {
        cleanup();
        logger.error({ err: error }, 'Audio player error');
        resolve(); // エラーでもキューを止めない
      };

      const cleanup = (): void => {
        player.removeListener(AudioPlayerStatus.Idle, onIdle);
        player.removeListener('error', onError);
      };

      player.on(AudioPlayerStatus.Idle, onIdle);
      player.on('error', onError);
    } catch (error) {
      logger.error({ err: error }, 'Failed to play audio');
      resolve(); // エラーでもキューを止めない
    }
  });
}

/**
 * ギルドのキューをクリアする
 */
export function clearQueue(guildId: string): void {
  const gq = guildQueues.get(guildId);
  if (gq) {
    gq.items.length = 0;
    gq.player.stop(true);
    for (const key of preSynthesizedBuffers.keys()) {
      if (key.startsWith(`${guildId}:`)) {
        preSynthesizedBuffers.delete(key);
      }
    }
    logger.debug({ guildId }, 'Queue cleared');
  }
}

/**
 * ギルドのキューを削除する（VC 切断時）
 */
export function deleteGuildQueue(guildId: string): void {
  clearQueue(guildId);
  guildQueues.delete(guildId);
}

/**
 * 全ギルドのキューをクリアする（Graceful Shutdown 用）
 */
export function clearAllQueues(): void {
  for (const guildId of guildQueues.keys()) {
    clearQueue(guildId);
  }
  guildQueues.clear();
  preSynthesizedBuffers.clear();
  logger.info('All queues cleared');
}

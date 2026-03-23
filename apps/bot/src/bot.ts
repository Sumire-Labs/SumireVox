import { Client, GatewayIntentBits, Events } from 'discord.js';
import { config } from './infrastructure/config.js';
import { logger } from './infrastructure/logger.js';
import { getPrisma, disconnectPrisma } from './infrastructure/database.js';
import { disconnectRedis } from './infrastructure/redis.js';
import { setupPubSub, cleanupPubSub } from './infrastructure/pubsub.js';
import { createBotPubSubHandlers } from './services/pubsub-handlers.js';
import { setClient } from './infrastructure/discord-client.js';
import { handleInteractionCreate } from './events/interaction-create.js';
import { handleMessageCreate } from './events/message-create.js';
import { handleVoiceStateUpdate } from './events/voice-state-update.js';
import { registerAllViewHandlers } from './commands/register-view-handlers.js';
import { restoreVcSessions, destroyAllVcSessions } from './services/vc-session-manager.js';
import { loadSpeakers } from './services/voicevox-speaker-cache.js';
import { startHealthChecker, stopHealthChecker } from './services/voicevox-health-checker.js';
import { initShardSemaphore, clearAllQueues } from './services/speech-queue.js';
import { preloadPredefinedAudio } from './services/predefined-audio-cache.js';
import { clearAllDisconnectTimers } from './services/auto-disconnect-timer.js';

async function bootstrap(): Promise<void> {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  setClient(client);

  const shardId = client.shard?.ids[0] ?? 0;
  const childLogger = logger.child({ shardId });

  childLogger.info('Shard bootstrapping...');

  // Prisma 接続確認
  const prisma = getPrisma();
  await prisma.$connect();
  childLogger.info('Database connected');

  // Redis Pub/Sub セットアップ
  setupPubSub(createBotPubSubHandlers());
  childLogger.info('Pub/Sub initialized');

  let memoryInterval: ReturnType<typeof setInterval> | null = null;

  // View ハンドラ登録
  registerAllViewHandlers();

  // イベントハンドラ登録
  client.on(Events.InteractionCreate, handleInteractionCreate);
  client.on(Events.MessageCreate, handleMessageCreate);
  client.on(Events.VoiceStateUpdate, handleVoiceStateUpdate);

  client.on(Events.ClientReady, async (readyClient) => {
    childLogger.info(
      { user: readyClient.user.tag, guildCount: readyClient.guilds.cache.size },
      `Shard ${shardId} ready as ${readyClient.user.tag} (${readyClient.guilds.cache.size} guilds)`,
    );

    // VOICEVOX 話者一覧キャッシュ
    await loadSpeakers();
    childLogger.info('VOICEVOX speakers loaded');

    // シャードセマフォ初期化
    const totalShards = readyClient.shard?.count ?? 1;
    initShardSemaphore(totalShards);

    // VOICEVOX ヘルスチェック開始
    startHealthChecker();
    childLogger.info('VOICEVOX health checker started');

    // 定型文事前合成
    await preloadPredefinedAudio();
    childLogger.info('Predefined audio preloaded');

    // VC セッション復旧
    await restoreVcSessions();

    memoryInterval = setInterval(() => {
      const mem = process.memoryUsage();
      childLogger.info(
        {
          rss: Math.round(mem.rss / 1024 / 1024),
          heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
          external: Math.round(mem.external / 1024 / 1024),
        },
        'Memory usage (MB)',
      );
    }, 60_000);
  });

  client.on(Events.Error, (error) => {
    childLogger.error({ err: error }, 'Discord client error');
  });

  client.on(Events.Warn, (message) => {
    childLogger.warn({ message }, 'Discord client warning');
  });

  // Graceful Shutdown
  const shutdown = async (signal: string): Promise<void> => {
    childLogger.info({ signal }, `Received ${signal}, shutting down...`);

    // ヘルスチェック停止
    stopHealthChecker();

    // メモリ監視インターバル停止
    if (memoryInterval !== null) {
      clearInterval(memoryInterval);
      memoryInterval = null;
    }

    // 読み上げキュー全クリア
    clearAllQueues();

    // 自動退出タイマー全クリア
    clearAllDisconnectTimers();

    // 全 VC セッション破棄
    await destroyAllVcSessions();

    client.destroy();
    childLogger.info('Discord client destroyed');

    await cleanupPubSub();
    childLogger.info('Pub/Sub cleaned up');

    await disconnectRedis();
    childLogger.info('Redis disconnected');

    await disconnectPrisma();
    childLogger.info('Database disconnected');

    childLogger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    childLogger.error({ err: reason }, 'Unhandled rejection');
  });

  process.on('uncaughtException', (error) => {
    childLogger.fatal({ err: error }, 'Uncaught exception');
    process.exit(1);
  });

  // ログイン
  await client.login(config.discordToken);
}

bootstrap().catch((error) => {
  logger.fatal({ err: error }, 'Failed to bootstrap shard');
  process.exit(1);
});

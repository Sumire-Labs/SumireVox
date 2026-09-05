import {
  DEFAULT_BOT_INSTANCE_SETTINGS,
  LIMITS,
  REDIS_KEYS,
  cloneBotInstanceSettings,
  normalizeBotInstanceSettings,
  normalizeAutoJoinSettings,
} from '@sumirevox/shared';
import type {
  AutoJoinChannelPair,
  BotInstance,
  BotInstanceSettings,
  GuildBotInstanceSettingsMap,
  ResolvedBotInstanceSettings,
  AutoJoinSettings,
  ResolvedAutoJoinSettings,
} from '@sumirevox/shared';
import { getPrisma } from '../infrastructure/database.js';
import { getRedisClient } from '../infrastructure/redis.js';
import { invalidateGuildSettingsCache } from '../infrastructure/settings-cache.js';
import { AppError } from '../infrastructure/app-error.js';
import { logger } from '../infrastructure/logger.js';

const ACTIVE_INSTANCE_COUNT_CACHE_KEY = 'bot:instances:active:count';
const ACTIVE_INSTANCE_COUNT_CACHE_TTL = 300;

/**
 * アクティブな Bot インスタンス数を取得（Redis キャッシュ付き）
 */
export async function getActiveInstanceCount(): Promise<number> {
  try {
    const cached = await getRedisClient().get(ACTIVE_INSTANCE_COUNT_CACHE_KEY);
    if (cached !== null) return parseInt(cached, 10);
  } catch {
    // Redis 読み取り失敗時は DB にフォールバック
  }

  const prisma = getPrisma();
  const count = await prisma.botInstance.count({ where: { isActive: true } });

  try {
    await getRedisClient().set(ACTIVE_INSTANCE_COUNT_CACHE_KEY, String(count), 'EX', ACTIVE_INSTANCE_COUNT_CACHE_TTL);
  } catch {
    // キャッシュ書き込み失敗は無視
  }

  return count;
}

/**
 * 全アクティブな Bot インスタンスを取得
 */
export async function getActiveBotInstances(): Promise<BotInstance[]> {
  const prisma = getPrisma();
  const instances = await prisma.botInstance.findMany({
    where: { isActive: true },
    orderBy: { instanceId: 'asc' },
  });
  return instances.map((i) => ({
    instanceId: i.instanceId,
    botUserId: i.botUserId,
    clientId: i.clientId,
    name: i.name,
    isActive: i.isActive,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  }));
}

/**
 * 全 Bot インスタンスを取得（管理者向け）
 */
export async function getAllBotInstances(): Promise<BotInstance[]> {
  const prisma = getPrisma();
  const instances = await prisma.botInstance.findMany({
    orderBy: { instanceId: 'asc' },
  });
  return instances.map((i) => ({
    instanceId: i.instanceId,
    botUserId: i.botUserId,
    clientId: i.clientId,
    name: i.name,
    isActive: i.isActive,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  }));
}

/**
 * 登録済み Bot インスタンスごとの Redis 参加情報をギルド単位にまとめて取得する。
 * Redis の個別セット取得に失敗したインスタンスは、そのインスタンスの参加情報なしとして扱う。
 */
export async function getBotGuildMemberships(instances: BotInstance[]): Promise<Map<string, number[]>> {
  const redis = getRedisClient();
  const guildIdSets = await Promise.all(
    instances.map((instance) =>
      redis.smembers(REDIS_KEYS.BOT_GUILDS(instance.instanceId)).catch(() => [] as string[]),
    ),
  );
  const memberships = new Map<string, number[]>();

  const activeGuildIdSets = await Promise.all(guildIdSets.map(async (guildIds, index) => {
    const instance = instances[index];
    if (!instance) return [] as string[];

    const presence = await Promise.all(guildIds.map(async (guildId) => {
      try {
        const isPresent = await redis.exists(
          REDIS_KEYS.BOT_GUILD_PRESENCE(instance.instanceId, guildId),
        );
        return isPresent === 1 ? guildId : null;
      } catch {
        return null;
      }
    }));
    return presence.filter((guildId): guildId is string => guildId !== null);
  }));

  activeGuildIdSets.forEach((guildIds, index) => {
    const instance = instances[index];
    if (!instance) return;

    guildIds.forEach((guildId) => {
      const currentInstanceIds = memberships.get(guildId) ?? [];
      memberships.set(guildId, [...currentInstanceIds, instance.instanceId]);
    });
  });

  return memberships;
}

/**
 * 特定の Bot インスタンスを取得
 */
export async function getBotInstance(instanceId: number): Promise<BotInstance | null> {
  const prisma = getPrisma();
  const instance = await prisma.botInstance.findUnique({ where: { instanceId } });
  if (!instance) return null;
  return {
    instanceId: instance.instanceId,
    botUserId: instance.botUserId,
    clientId: instance.clientId,
    name: instance.name,
    isActive: instance.isActive,
    createdAt: instance.createdAt,
    updatedAt: instance.updatedAt,
  };
}

/**
 * サーバーが利用可能な Bot インスタンス数を取得（ブーストレベルに基づく）
 *
 * FREE (0 boosts) → 1台
 * 1 boost → 1台（PREMIUM だが追加 Bot なし）
 * 2 boosts → 2台
 * 3+ boosts → 最大 MAX_BOT_INSTANCES 台
 */
export async function getAvailableBotCount(guildId: string): Promise<number> {
  const prisma = getPrisma();

  // manualPremium チェック
  const guildSettings = await prisma.guildSettings.findUnique({ where: { guildId } });
  if (guildSettings?.manualPremium) {
    return LIMITS.MAX_BOT_INSTANCES;
  }

  const boostCount = await prisma.boost.count({
    where: {
      guildId,
      subscription: { status: 'ACTIVE' },
    },
  });

  if (boostCount <= 1) return 1;
  return Math.min(boostCount, LIMITS.MAX_BOT_INSTANCES);
}

/**
 * ギルドのアクティブブースト数を取得
 * manualPremium の場合は MAX_BOT_INSTANCES を返す
 */
export async function getGuildBoostCount(guildId: string): Promise<number> {
  const prisma = getPrisma();
  const guildSettings = await prisma.guildSettings.findUnique({ where: { guildId } });
  if (guildSettings?.manualPremium) return LIMITS.MAX_BOT_INSTANCES;
  return prisma.boost.count({
    where: { guildId, subscription: { status: 'ACTIVE' } },
  });
}

/**
 * サーバーの Bot インスタンス別設定を取得
 */
export async function getGuildBotInstanceSettings(guildId: string): Promise<GuildBotInstanceSettingsMap> {
  const prisma = getPrisma();
  const settings = await prisma.guildSettings.findUnique({ where: { guildId } });
  return ((settings?.botInstanceSettings ?? {}) as unknown) as GuildBotInstanceSettingsMap;
}

export interface GuildBotListItem {
  instanceNumber: number;
  name: string;
  botUserId: string;
  isActive: boolean;
  isInGuild: boolean;
  isAvailable: boolean;
}

export interface GuildBotListResult {
  bots: GuildBotListItem[];
  boostCount: number;
  maxBots: number;
  autoJoinSettings: ResolvedAutoJoinSettings;
  botInstancePriority: number[];
}

export async function getGuildBotList(guildId: string): Promise<GuildBotListResult> {
  const [instances, availableCount, boostCount, settings] = await Promise.all([
    getActiveBotInstances(),
    getAvailableBotCount(guildId),
    getGuildBoostCount(guildId),
    getPrisma().guildSettings.findUnique({ where: { guildId } }),
  ]);

  const membership = await Promise.all(
    instances.map(async (instance) => {
      const isInGuild = await isBotInGuild(instance.instanceId, guildId);
      return {
        instance,
        isInGuild,
      };
    }),
  );
  const joinedIds = membership.filter((item) => item.isInGuild).map((item) => item.instance.instanceId);
  const priority = normalizePriority(settings?.botInstancePriority, joinedIds);
  const availableIds = new Set(priority.slice(0, availableCount));
  const autoJoinSettings = resolveSharedAutoJoinSettings(settings?.autoJoinSettings, settings?.botInstanceSettings);
  const bots = membership.map(({ instance, isInGuild }) => ({
    instanceNumber: instance.instanceId,
    name: instance.name,
    botUserId: instance.botUserId,
    isActive: instance.isActive,
    isInGuild,
    isAvailable: availableIds.has(instance.instanceId),
  }));

  return {
    bots,
    boostCount,
    maxBots: availableCount,
    autoJoinSettings,
    botInstancePriority: priority,
  };
}

export async function updateGuildAutoJoinSettings(
  guildId: string,
  updates: Partial<AutoJoinSettings>,
): Promise<ResolvedAutoJoinSettings> {
  const prisma = getPrisma();
  const current = await prisma.guildSettings.findUnique({ where: { guildId } });
  const existing = resolveSharedAutoJoinSettings(current?.autoJoinSettings, current?.botInstanceSettings);
  const channelPairs = updates.channelPairs === undefined
    ? existing.channelPairs
    : validateChannelPairs(updates.channelPairs);
  const updated = normalizeAutoJoinSettings({
    autoJoin: updates.autoJoin ?? existing.autoJoin,
    channelPairs,
  });
  await prisma.guildSettings.upsert({
    where: { guildId },
    create: { guildId, autoJoinSettings: updated as unknown as object },
    update: { autoJoinSettings: updated as unknown as object },
  });
  await invalidateGuildSettingsCache(guildId);
  logger.info({ guildId, updates }, 'Shared auto-join settings updated');
  return updated;
}

export async function updateGuildBotInstancePriority(
  guildId: string,
  instanceIds: readonly number[],
): Promise<number[]> {
  const instances = await getActiveBotInstances();
  const joined = await Promise.all(instances.map(async (instance) => ({
    id: instance.instanceId,
    joined: await isBotInGuild(instance.instanceId, guildId),
  })));
  const eligibleIds = joined.filter((item) => item.joined).map((item) => item.id);
  const normalized = normalizePriority(instanceIds, eligibleIds);
  const requestedIds = new Set(instanceIds);
  const eligibleIdSet = new Set(eligibleIds);
  const hasExactEligibleIds = requestedIds.size === eligibleIdSet.size &&
    [...requestedIds].every((instanceId) => eligibleIdSet.has(instanceId));
  if (instanceIds.length !== requestedIds.size || !hasExactEligibleIds) {
    throw new AppError('VALIDATION_ERROR', '参加済みで有効なBotを重複なく指定してください。', 400);
  }
  await getPrisma().guildSettings.upsert({
    where: { guildId },
    create: { guildId, botInstancePriority: normalized },
    update: { botInstancePriority: normalized },
  });
  await invalidateGuildSettingsCache(guildId);
  logger.info({ guildId, instanceIds: normalized }, 'Bot instance priority updated');
  return normalized;
}

function resolveSharedAutoJoinSettings(value: unknown, legacyMap: unknown): ResolvedAutoJoinSettings {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return normalizeAutoJoinSettings(value);
  }
  const legacy = legacyMap && typeof legacyMap === 'object' && !Array.isArray(legacyMap)
    ? (legacyMap as Record<string, unknown>)['1']
    : undefined;
  return normalizeAutoJoinSettings(legacy);
}

function normalizePriority(value: unknown, eligibleIds: readonly number[]): number[] {
  const available = new Set(eligibleIds);
  const stored = Array.isArray(value)
    ? value.filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && available.has(id))
    : [];
  const unique = [...new Set(stored)];
  return [...unique, ...[...eligibleIds].sort((left, right) => left - right).filter((id) => !unique.includes(id))];
}

/**
 * 設定コピーの対象として扱える Bot インスタンスを取得する。
 * Boost/Premium による接続可否は設定保存とは別のため、ここでは判定しない。
 */
export async function getCopyableBotInstances(
  guildId: string,
  sourceInstanceId: number,
): Promise<BotInstance[]> {
  const candidates = (await getActiveBotInstances()).filter(
    (instance) => instance.instanceId !== sourceInstanceId,
  );

  const copyableInstances = await Promise.all(
    candidates.map(async (instance) => {
      return (await isBotInGuild(instance.instanceId, guildId)) ? instance : null;
    }),
  );

  return copyableInstances.filter(
    (instance): instance is BotInstance => instance !== null,
  );
}

/**
 * サーバーの特定インスタンスの設定を更新
 */
export async function updateGuildBotInstanceSettings(
  guildId: string,
  instanceId: number,
  settings: Partial<BotInstanceSettings>,
): Promise<ResolvedBotInstanceSettings> {
  const current = await getGuildBotInstanceSettings(guildId);
  const map = getSettingsMap(current);
  const instanceKey = String(instanceId);
  const rawExisting = map[instanceKey] ?? DEFAULT_BOT_INSTANCE_SETTINGS;
  const existing = normalizeBotInstanceSettings(rawExisting);
  const updated = mergeBotInstanceSettings(rawExisting, existing, settings);
  const updatedMap: GuildBotInstanceSettingsMap = {
    ...map,
    [instanceKey]: toPersistedBotInstanceSettings(updated),
  };

  const prisma = getPrisma();
  await prisma.guildSettings.upsert({
    where: { guildId },
    create: { guildId, botInstanceSettings: updatedMap as object },
    update: { botInstanceSettings: updatedMap as object },
  });

  await invalidateGuildSettingsCache(guildId);
  logger.info({ guildId, instanceId, settings }, 'Bot instance settings updated');
  return updated;
}

/**
 * 指定した複数インスタンスへ、自動接続設定だけを完全コピーする。
 * コピー先の既存設定はマージせず、1回の upsert で上書きする。
 */
export async function copyBotInstanceSettings(
  guildId: string,
  sourceInstanceId: number,
  targetInstanceIds: readonly number[],
): Promise<BotInstanceSettings> {
  if (targetInstanceIds.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'コピー先のBotを1つ以上選択してください。', 400);
  }

  if (new Set(targetInstanceIds).size !== targetInstanceIds.length) {
    throw new AppError('VALIDATION_ERROR', 'コピー先のBotを重複して指定できません。', 400);
  }

  if (targetInstanceIds.includes(sourceInstanceId)) {
    throw new AppError('VALIDATION_ERROR', 'コピー元自身には設定をコピーできません。', 400);
  }

  const candidates = await getCopyableBotInstances(guildId, sourceInstanceId);
  const candidateIds = new Set(candidates.map((instance) => instance.instanceId));
  if (targetInstanceIds.some((instanceId) => !candidateIds.has(instanceId))) {
    throw new AppError(
      'VALIDATION_ERROR',
      'コピー先のBotが利用できません。設定画面を開き直してください。',
      400,
    );
  }

  const current = await getGuildBotInstanceSettings(guildId);
  const map = getSettingsMap(current);
  const source = cloneBotInstanceSettings(
    getInstanceSettingsForMap(map, sourceInstanceId),
  );
  const persistedSource = toPersistedBotInstanceSettings(source);
  const updatedMap: GuildBotInstanceSettingsMap = { ...map };

  for (const targetInstanceId of targetInstanceIds) {
    updatedMap[String(targetInstanceId)] = toPersistedBotInstanceSettings(
      cloneBotInstanceSettings(source),
    );
  }

  const prisma = getPrisma();
  await prisma.guildSettings.upsert({
    where: { guildId },
    create: { guildId, botInstanceSettings: updatedMap as object },
    update: { botInstanceSettings: updatedMap as object },
  });

  await invalidateGuildSettingsCache(guildId);
  logger.info(
    { guildId, sourceInstanceId, targetInstanceIds },
    'Bot instance auto-join settings copied',
  );
  return persistedSource;
}

function getSettingsMap(value: GuildBotInstanceSettingsMap | undefined): GuildBotInstanceSettingsMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function getInstanceSettingsForMap(
  map: GuildBotInstanceSettingsMap,
  instanceId: number,
): ResolvedBotInstanceSettings {
  return normalizeBotInstanceSettings(map[String(instanceId)] ?? DEFAULT_BOT_INSTANCE_SETTINGS);
}

function mergeBotInstanceSettings(
  rawExisting: BotInstanceSettings,
  existing: ResolvedBotInstanceSettings,
  updates: Partial<BotInstanceSettings>,
): ResolvedBotInstanceSettings {
  const autoJoin = updates.autoJoin ?? existing.autoJoin;

  if (updates.channelPairs !== undefined) {
    const channelPairs = validateChannelPairs(updates.channelPairs);
    return {
      autoJoin,
      voiceChannelId: channelPairs[0]?.voiceChannelId ?? null,
      textChannelId: channelPairs[0]?.textChannelId ?? null,
      channelPairs,
    };
  }

  const hasLegacyChannelUpdate =
    updates.voiceChannelId !== undefined || updates.textChannelId !== undefined;

  if (Array.isArray(rawExisting.channelPairs) && !hasLegacyChannelUpdate) {
    return { ...existing, autoJoin };
  }

  const voiceChannelId = updates.voiceChannelId !== undefined
    ? updates.voiceChannelId
    : existing.voiceChannelId;
  const textChannelId = updates.textChannelId !== undefined
    ? updates.textChannelId
    : existing.textChannelId;
  const channelPairs = voiceChannelId && textChannelId
    ? Array.isArray(rawExisting.channelPairs)
      ? existing.channelPairs.length > 0
        ? existing.channelPairs.map((pair, index) => (
            index === 0
              ? { voiceChannelId, textChannelId }
              : { ...pair }
          ))
        : [{ voiceChannelId, textChannelId }]
      : [{ voiceChannelId, textChannelId }]
    : [];

  return {
    autoJoin,
    voiceChannelId,
    textChannelId,
    channelPairs,
  };
}

function validateChannelPairs(value: unknown): AutoJoinChannelPair[] {
  if (!Array.isArray(value)) {
    throw new AppError('VALIDATION_ERROR', '自動接続ペアの形式が不正です。', 400);
  }
  if (value.length > LIMITS.MAX_AUTO_JOIN_CHANNEL_PAIRS) {
    throw new AppError(
      'VALIDATION_ERROR',
      `自動接続ペアは${LIMITS.MAX_AUTO_JOIN_CHANNEL_PAIRS}件以内で設定してください。`,
      400,
    );
  }

  const seenVoiceChannelIds = new Set<string>();
  return value.map((pair: unknown, index) => {
    if (!isValidChannelPair(pair)) {
      throw new AppError('VALIDATION_ERROR', `自動接続ペア${index + 1}のVC/TCを確認してください。`, 400);
    }
    if (seenVoiceChannelIds.has(pair.voiceChannelId)) {
      throw new AppError('VALIDATION_ERROR', '同じVCを複数の自動接続ペアに登録できません。', 400);
    }
    seenVoiceChannelIds.add(pair.voiceChannelId);
    return {
      voiceChannelId: pair.voiceChannelId,
      textChannelId: pair.textChannelId,
    };
  });
}

function isValidChannelPair(value: unknown): value is AutoJoinChannelPair {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.voiceChannelId === 'string' &&
    record.voiceChannelId.trim().length > 0 &&
    typeof record.textChannelId === 'string' &&
    record.textChannelId.trim().length > 0
  );
}

function toPersistedBotInstanceSettings(
  settings: ResolvedBotInstanceSettings,
): BotInstanceSettings {
  const firstPair = settings.channelPairs[0];
  return {
    autoJoin: settings.autoJoin,
    voiceChannelId: firstPair?.voiceChannelId ?? settings.voiceChannelId,
    textChannelId: firstPair?.textChannelId ?? settings.textChannelId,
    channelPairs: settings.channelPairs.map((pair) => ({ ...pair })),
  };
}

/**
 * サーバーの Bot 招待 URL を生成
 */
export async function generateBotInviteUrl(instanceId: number, guildId: string): Promise<string> {
  const instance = await getBotInstance(instanceId);
  if (!instance) {
    throw new AppError('NOT_FOUND', 'Bot インスタンスが見つかりません。', 404);
  }

  // Connect, Speak, ViewChannel, SendMessages, ReadMessageHistory, UseVoiceActivity
  const permissions = '36727824';
  return `https://discord.com/api/oauth2/authorize?client_id=${instance.clientId}&permissions=${permissions}&scope=bot&guild_id=${guildId}`;
}

/**
 * Bot がサーバーに参加しているかチェック（Redis Set を参照）
 */
export async function isBotInGuild(instanceId: number, guildId: string): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const result = await redis.exists(REDIS_KEYS.BOT_GUILD_PRESENCE(instanceId, guildId));
    return result === 1;
  } catch {
    return false;
  }
}

/**
 * 複数ギルドに Bot が参加しているかを一括チェック
 * 1つでもアクティブな Bot インスタンスが参加していれば true
 */
export async function getGuildsWithBotStatus(
  guildIds: string[],
  instances: BotInstance[],
): Promise<Map<string, boolean>> {
  const guildStatusMap = new Map<string, boolean>(guildIds.map((guildId) => [guildId, false]));

  if (guildIds.length === 0 || instances.length === 0) {
    return guildStatusMap;
  }

  try {
    const redis = getRedisClient();
    const pipeline = redis.pipeline();

    for (const guildId of guildIds) {
      for (const instance of instances) {
        pipeline.exists(REDIS_KEYS.BOT_GUILD_PRESENCE(instance.instanceId, guildId));
      }
    }

    const results = await pipeline.exec();
    if (!results) {
      return guildStatusMap;
    }

    let resultIndex = 0;
    for (const guildId of guildIds) {
      let botJoined = false;

      for (let instanceIndex = 0; instanceIndex < instances.length; instanceIndex += 1) {
        const [error, result] = results[resultIndex] ?? [];
        resultIndex += 1;

        if (error) {
          continue;
        }

        if (result === 1) {
          botJoined = true;
        }
      }

      guildStatusMap.set(guildId, botJoined);
    }

    return guildStatusMap;
  } catch {
    return guildStatusMap;
  }
}

/**
 * Bot インスタンスのアクティブ状態を更新（管理者向け）
 */
export async function setBotInstanceActive(instanceId: number, isActive: boolean): Promise<BotInstance> {
  const prisma = getPrisma();
  const instance = await prisma.botInstance.update({
    where: { instanceId },
    data: { isActive },
  });

  // アクティブインスタンス数のキャッシュをクリア
  try {
    await getRedisClient().del(ACTIVE_INSTANCE_COUNT_CACHE_KEY);
    await getRedisClient().del('bot:instances:all');
  } catch {
    // キャッシュ削除失敗は無視
  }

  // インスタンスが非アクティブ化された場合、ブースト整合処理を実行
  if (!isActive) {
    const { reconcileBoosts } = await import('./boost-service.js');
    await reconcileBoosts();
  }

  return {
    instanceId: instance.instanceId,
    botUserId: instance.botUserId,
    clientId: instance.clientId,
    name: instance.name,
    isActive: instance.isActive,
    createdAt: instance.createdAt,
    updatedAt: instance.updatedAt,
  };
}

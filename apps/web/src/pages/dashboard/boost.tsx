import { useState, useEffect } from 'react';
import { api, ApiError } from '../../lib/api';
import { useToast, Toast } from '../../components/toast';

interface Guild {
  id: string;
  name: string;
  icon: string | null;
}

interface BoostAllocation {
  guildId: string;
  boostCount: number;
}

interface GuildBoostInfo {
  guildId: string;
  userBoostCount: number;
  totalGuildBoosts: number;
  isManualPremium: boolean;
}

interface BoostData {
  totalBoosts: number;
  usedBoosts: number;
  cooldownBoosts: number;
  availableBoosts: number;
  maxBoostsPerGuild: number;
  allocations: BoostAllocation[];
  guildBoostInfo: GuildBoostInfo[];
  cooldowns: Array<{
    boostId: string;
    unassignedAt: string;
    availableAt: string;
  }>;
  subscription: {
    status: string;
    currentPeriodEnd: string;
    boostCount: number;
  } | null;
  boosts: Array<{
    id: string;
    guildId: string | null;
    assignedAt: string | null;
    unassignedAt: string | null;
    cooldownEndsAt: string | null;
    isOnCooldown: boolean;
  }>;
}

interface BotInstanceInfo {
  instanceNumber: number;
  name: string;
  isInGuild: boolean;
  isAvailable: boolean;
}

interface BotListResponse {
  bots: BotInstanceInfo[];
}

function fetchBotsForGuild(guildId: string): Promise<{ guildId: string; bots: BotInstanceInfo[] } | null> {
  return api.get<BotListResponse>(`/api/guilds/${guildId}/bots`)
    .then((r) => ({ guildId, bots: r.bots }))
    .catch(() => null);
}

export function BoostPage() {
  const [data, setData] = useState<BoostData | null>(null);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);
  const [boostCount, setBoostCount] = useState('1');
  const [showPurchase, setShowPurchase] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [guildBots, setGuildBots] = useState<Map<string, BotInstanceInfo[]>>(new Map());
  const [inviteLoading, setInviteLoading] = useState<Set<string>>(new Set());
  const { toastState, showSaving, showSuccess, showError } = useToast();

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api.get<BoostData>('/api/user/boosts', { signal: controller.signal }),
      api.get<Guild[]>('/api/user/guilds', { signal: controller.signal }),
    ])
      .then(([boostData, guildsData]) => {
        setData(boostData);
        setGuilds(guildsData);

        const boostedGuildIds = guildsData
          .filter((guild) => {
            const info = boostData.guildBoostInfo.find((g) => g.guildId === guild.id);
            return info && (info.totalGuildBoosts > 0 || info.isManualPremium);
          })
          .map((guild) => guild.id);

        if (boostedGuildIds.length > 0) {
          Promise.all(boostedGuildIds.map(fetchBotsForGuild)).then((results) => {
            const entries = results.filter(
              (r): r is { guildId: string; bots: BotInstanceInfo[] } => r !== null,
            );
            if (entries.length > 0) {
              setGuildBots(new Map(entries.map((e) => [e.guildId, e.bots])));
            }
          });
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        showError('データの取得に失敗しました');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const handleCheckout = async () => {
    showSaving('購入処理中...');
    try {
      const result = await api.post<{ url: string }>('/api/user/boosts/checkout', {
        boostCount: parseInt(boostCount, 10),
      });
      window.location.href = result.url;
    } catch (err) {
      if (err instanceof ApiError) showError(err.message);
      else showError();
    }
  };

  const handleSetCount = async (guildId: string, newCount: number) => {
    if (actionLoading) return;
    setActionLoading(guildId);
    showSaving('更新中...');

    // Optimistic update
    const prevData = data;
    if (data) {
      const currentInfo = data.guildBoostInfo.find((g) => g.guildId === guildId);
      const currentCount = currentInfo?.userBoostCount ?? 0;
      const delta = newCount - currentCount;
      const newAllocations = data.allocations
        .filter((a) => a.guildId !== guildId)
        .concat(newCount > 0 ? [{ guildId, boostCount: newCount }] : []);
      const newGuildBoostInfo = data.guildBoostInfo.map((g) =>
        g.guildId !== guildId
          ? g
          : { ...g, userBoostCount: newCount, totalGuildBoosts: g.totalGuildBoosts + delta },
      );
      setData({
        ...data,
        allocations: newAllocations,
        guildBoostInfo: newGuildBoostInfo,
        usedBoosts: data.usedBoosts + delta,
        availableBoosts: data.availableBoosts - delta,
        cooldownBoosts: delta < 0 ? data.cooldownBoosts + Math.abs(delta) : data.cooldownBoosts,
      });
    }

    try {
      const result = await api.post<BoostData>('/api/user/boosts/assign', { guildId, count: newCount });
      setData(result);
      showSuccess('更新しました');

      const guildInfo = result.guildBoostInfo.find((g) => g.guildId === guildId);
      const shouldShowBots = guildInfo && (guildInfo.totalGuildBoosts > 0 || guildInfo.isManualPremium);
      if (shouldShowBots) {
        fetchBotsForGuild(guildId).then((r) => {
          if (r) setGuildBots((prev) => new Map(prev).set(r.guildId, r.bots));
        });
      } else {
        setGuildBots((prev) => {
          const next = new Map(prev);
          next.delete(guildId);
          return next;
        });
      }
    } catch (err) {
      setData(prevData);
      if (err instanceof ApiError) showError(err.message);
      else showError('更新に失敗しました');
    } finally {
      setActionLoading(null);
    }
  };

  const handleInviteBot = async (guildId: string, instanceNumber: number) => {
    const key = `${guildId}:${instanceNumber}`;
    setInviteLoading((prev) => new Set(prev).add(key));
    try {
      const result = await api.get<{ url: string }>(
        `/api/guilds/${guildId}/bots/${instanceNumber}/invite`,
      );
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch {
      // ignore
    } finally {
      setInviteLoading((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const result = await api.post<{ url: string }>('/api/user/billing-portal');
      window.location.href = result.url;
    } catch (err) {
      if (err instanceof ApiError) showError(err.message);
      else showError('ポータルの読み込みに失敗しました');
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center mt-20">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalBoosts = data?.totalBoosts ?? 0;
  const usedBoosts = data?.usedBoosts ?? 0;
  const cooldownBoosts = data?.cooldownBoosts ?? 0;
  const availableBoosts = data?.availableBoosts ?? 0;
  const maxBoostsPerGuild = data?.maxBoostsPerGuild ?? 0;
  const cooldowns = data?.cooldowns ?? [];
  const earliestAvailableAt = cooldowns.length > 0
    ? cooldowns.reduce((min, c) => c.availableAt < min ? c.availableAt : min, cooldowns[0].availableAt)
    : null;
  const guildBoostInfoMap = new Map((data?.guildBoostInfo ?? []).map((g) => [g.guildId, g]));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">ブースト管理</h1>
        <p className="text-gray-400">サーバーにブーストを割り当てて機能を拡張します</p>
      </div>

      {/* ブースト概要 */}
      <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6 flex flex-col gap-5">
        <h2 className="text-lg font-semibold text-white">ブースト概要</h2>
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-gray-500">合計</span>
            <span className="text-2xl font-bold text-white">{totalBoosts}</span>
          </div>
          <div className="w-px h-10 bg-white/10 hidden sm:block" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-gray-500">使用中</span>
            <span className="text-2xl font-bold text-purple-400">{usedBoosts}</span>
          </div>
          <div className="w-px h-10 bg-white/10 hidden sm:block" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-gray-500">クールダウン中</span>
            <span className="text-2xl font-bold text-orange-400">{cooldownBoosts}</span>
          </div>
          <div className="w-px h-10 bg-white/10 hidden sm:block" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-gray-500">未割り当て</span>
            <span className="text-2xl font-bold text-white">{availableBoosts}</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3 flex-wrap">
            {data?.subscription && (
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="text-sm border border-white/10 text-gray-400 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-xl transition-all"
              >
                {portalLoading ? '読み込み中...' : 'カスタマーポータルを開く'}
              </button>
            )}
            <button
              onClick={() => setShowPurchase((v) => !v)}
              className="gradient-bg text-white px-5 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90"
            >
              ブーストを購入
            </button>
          </div>
        </div>
        {cooldownBoosts > 0 && earliestAvailableAt && (
          <p className="text-sm text-orange-400/80">
            ⏳ {cooldownBoosts}ブーストがクールダウン中です（最短解除:{' '}
            {new Date(earliestAvailableAt).toLocaleString('ja-JP', {
              year: 'numeric',
              month: 'numeric',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}）
          </p>
        )}
      </div>

      {/* 購入フォーム */}
      {showPurchase && (
        <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-white">ブーストを購入</h2>
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-400">ブースト数</label>
              <input
                type="number"
                min={1}
                max={10}
                value={boostCount}
                onChange={(e) => setBoostCount(e.target.value)}
                className="w-24 bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500/50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-sm text-gray-400">月額 {parseInt(boostCount, 10) * 300}円</p>
              <button
                onClick={handleCheckout}
                className="gradient-bg text-white px-6 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90"
              >
                購入する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* サーバー一覧 */}
      <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-white">サーバー一覧</h2>

        {totalBoosts === 0 && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-gray-400">ブーストを購入して、サーバーの機能を拡張しましょう</p>
            <button
              onClick={() => setShowPurchase(true)}
              className="gradient-bg text-white px-6 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90"
            >
              ブーストを購入
            </button>
          </div>
        )}

        {guilds.length === 0 && totalBoosts > 0 && (
          <p className="text-gray-500 text-sm py-4 text-center">
            Bot が導入済みのサーバーが見つかりません
          </p>
        )}

        {guilds.length > 0 && (
          <div className="flex flex-col gap-2">
            {guilds.map((guild) => {
              const guildInfo = guildBoostInfoMap.get(guild.id);
              const currentCount = guildInfo?.userBoostCount ?? 0;
              const totalGuildBoosts = guildInfo?.totalGuildBoosts ?? 0;
              const isManualPremium = guildInfo?.isManualPremium ?? false;
              const isLoading = actionLoading === guild.id;
              const isGuildAtMax = maxBoostsPerGuild > 0 && totalGuildBoosts >= maxBoostsPerGuild;
              const canIncrease = availableBoosts > 0 && totalBoosts > 0 && !isGuildAtMax && !isManualPremium;
              const canDecrease = currentCount > 0 && !isManualPremium;

              const bots = guildBots.get(guild.id);
              const visibleBots = bots ? bots.filter((b) => b.isAvailable) : [];

              return (
                <div
                  key={guild.id}
                  className="rounded-xl bg-white/[0.03] border border-white/5"
                >
                  <div className="flex items-center justify-between px-4 py-3">
                    {/* 左側: アイコン + サーバー名 + バッジ */}
                    <div className="flex items-center gap-2 min-w-0">
                      {guild.icon ? (
                        <img
                          src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`}
                          alt=""
                          className="w-8 h-8 rounded-full shrink-0"
                        />
                      ) : (
                        <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm text-gray-400 shrink-0">
                          {guild.name.charAt(0)}
                        </span>
                      )}
                      <span className="font-medium text-white truncate">{guild.name}</span>
                      {isManualPremium && (
                        <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          管理者設定
                        </span>
                      )}
                      {isGuildAtMax && !isManualPremium && (
                        <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30">
                          最大ブースト
                        </span>
                      )}
                    </div>

                    {/* 右側: 全体数 + あなた数 + ボタン群 */}
                    <div className="flex items-center gap-6 shrink-0 ml-4">
                      <span className="text-sm text-gray-400 tabular-nums">
                        全体: <span className="text-gray-200 font-medium">{totalGuildBoosts}</span>
                      </span>
                      <span className="text-sm text-gray-400 tabular-nums">
                        あなた: <span className={`font-medium ${currentCount > 0 ? 'text-purple-400' : 'text-gray-200'}`}>{currentCount}</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSetCount(guild.id, currentCount - 1)}
                          disabled={!canDecrease || isLoading}
                          className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center text-base leading-none"
                          aria-label="ブーストを減らす"
                        >
                          −
                        </button>
                        <span
                          className={`w-6 text-center text-sm font-bold tabular-nums ${
                            currentCount > 0 ? 'text-purple-400' : 'text-gray-400'
                          }`}
                        >
                          {currentCount}
                        </span>
                        <button
                          onClick={() => handleSetCount(guild.id, currentCount + 1)}
                          disabled={!canIncrease || isLoading}
                          className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center text-base leading-none"
                          aria-label="ブーストを増やす"
                        >
                          +
                        </button>
                      </div>
                      {isLoading && (
                        <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                  </div>

                  {/* Bot 招待セクション */}
                  {visibleBots.length > 0 && (
                    <div className="border-t border-white/5 px-4 py-3 flex flex-wrap gap-2">
                      {visibleBots.map((bot) => {
                        const key = `${guild.id}:${bot.instanceNumber}`;
                        const isInviteLoading = inviteLoading.has(key);
                        if (bot.isInGuild) {
                          return (
                            <span
                              key={bot.instanceNumber}
                              className="text-xs text-green-400 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20"
                            >
                              ✓ {bot.name}
                            </span>
                          );
                        }
                        return (
                          <button
                            key={bot.instanceNumber}
                            onClick={() => handleInviteBot(guild.id, bot.instanceNumber)}
                            disabled={isInviteLoading}
                            className="text-xs px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {isInviteLoading ? '...' : `${bot.name} を招待`}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Toast state={toastState} />
    </div>
  );
}

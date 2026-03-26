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

interface BoostData {
  totalBoosts: number;
  usedBoosts: number;
  availableBoosts: number;
  allocations: BoostAllocation[];
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

export function BoostPage() {
  const [data, setData] = useState<BoostData | null>(null);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);
  const [boostCount, setBoostCount] = useState('1');
  const [showPurchase, setShowPurchase] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
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
      const currentCount = data.allocations.find((a) => a.guildId === guildId)?.boostCount ?? 0;
      const delta = newCount - currentCount;
      const newAllocations = data.allocations
        .filter((a) => a.guildId !== guildId)
        .concat(newCount > 0 ? [{ guildId, boostCount: newCount }] : []);
      setData({
        ...data,
        allocations: newAllocations,
        usedBoosts: data.usedBoosts + delta,
        availableBoosts: data.availableBoosts - delta,
      });
    }

    try {
      const result = await api.post<BoostData>('/api/user/boosts/assign', { guildId, count: newCount });
      setData(result);
      showSuccess('更新しました');
    } catch (err) {
      setData(prevData);
      if (err instanceof ApiError) showError(err.message);
      else showError('更新に失敗しました');
    } finally {
      setActionLoading(null);
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
  const availableBoosts = data?.availableBoosts ?? 0;
  const allocationMap = new Map((data?.allocations ?? []).map((a) => [a.guildId, a.boostCount]));

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
              const currentCount = allocationMap.get(guild.id) ?? 0;
              const isLoading = actionLoading === guild.id;
              const canIncrease = availableBoosts > 0 && totalBoosts > 0;
              const canDecrease = currentCount > 0;

              return (
                <div
                  key={guild.id}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5"
                >
                  <div className="flex items-center gap-3 min-w-0">
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
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="text-sm text-gray-500">現在のブースト:</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSetCount(guild.id, currentCount - 1)}
                        disabled={!canDecrease || isLoading}
                        className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center text-base leading-none"
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
                        className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center text-base leading-none"
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
              );
            })}
          </div>
        )}
      </div>

      <Toast state={toastState} />
    </div>
  );
}

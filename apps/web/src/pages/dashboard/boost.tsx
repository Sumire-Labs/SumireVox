import { useState, useEffect } from 'react';
import { Select, ListBox, Spinner } from '@heroui/react';
import { api, ApiError } from '../../lib/api';
import { useToast, Toast } from '../../components/toast';

interface BoostData {
  boosts: Array<{
    id: string;
    guildId: string | null;
    assignedAt: string | null;
    unassignedAt: string | null;
    cooldownEndsAt: string | null;
    isOnCooldown: boolean;
  }>;
  subscription: {
    status: string;
    currentPeriodEnd: string;
    boostCount: number;
  } | null;
}

interface Guild {
  id: string;
  name: string;
  icon: string | null;
}

export function BoostPage() {
  const [data, setData] = useState<BoostData | null>(null);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const guildMap = new Map(guilds.map((g) => [g.id, g]));
  const [loading, setLoading] = useState(true);
  const [boostCount, setBoostCount] = useState('1');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toastState, showSaving, showSuccess, showError } = useToast();

  const fetchData = async () => {
    try {
      const [boostData, guildsData] = await Promise.all([
        api.get<BoostData>('/api/user/boosts'),
        api.get<Guild[]>('/api/user/guilds'),
      ]);
      setData(boostData);
      setGuilds(guildsData);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

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

  const handleAssign = async (boostId: string, guildId: string) => {
    setActionLoading(boostId);
    showSaving('割り当て中...');
    try {
      await api.put(`/api/user/boosts/${boostId}/assign`, { guildId });
      await fetchData();
      showSuccess('割り当てました');
    } catch (err) {
      if (err instanceof ApiError) showError(err.message);
      else showError('割り当てに失敗しました');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnassign = async (boostId: string) => {
    setActionLoading(boostId);
    showSaving('解除中...');
    try {
      await api.put(`/api/user/boosts/${boostId}/unassign`);
      await fetchData();
      showSuccess('割り当てを解除しました');
    } catch (err) {
      if (err instanceof ApiError) showError(err.message);
      else showError('解除に失敗しました');
    } finally {
      setActionLoading(null);
    }
  };

  const [portalLoading, setPortalLoading] = useState(false);

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

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">ブースト管理</h1>
        <p className="text-gray-400">ブーストの購入・割り当て・解約を管理します</p>
      </div>

      {/* 購入 */}
      <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6 flex flex-col gap-5">
        <h2 className="text-lg font-semibold text-white">ブーストを購入</h2>
        <div className="flex items-end gap-4">
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

      {/* ブースト一覧 */}
      {data?.boosts && data.boosts.length > 0 && (
        <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-white">ブースト枠一覧</h2>
          <div className="flex flex-col gap-3">
            {data.boosts.map((boost) => (
              <div
                key={boost.id}
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5"
              >
                <div className="flex items-center gap-3">
                  {boost.guildId ? (
                    <span className="flex items-center gap-2 text-gray-300">
                      {(() => {
                        const guild = guildMap.get(boost.guildId);
                        if (!guild) {
                          return <span className="text-gray-400">不明なサーバー ({boost.guildId})</span>;
                        }
                        return (
                          <>
                            {guild.icon ? (
                              <img
                                src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`}
                                alt=""
                                className="w-6 h-6 rounded-full shrink-0"
                              />
                            ) : (
                              <span className="bg-gray-700 rounded-full w-6 h-6 flex items-center justify-center text-xs text-white shrink-0">
                                {guild.name.charAt(0)}
                              </span>
                            )}
                            <span>{guild.name}</span>
                            <span className="text-xs text-gray-500 ml-2">{guild.id}</span>
                          </>
                        );
                      })()}
                    </span>
                  ) : (
                    <span className="text-gray-500">未割り当て</span>
                  )}
                  {boost.isOnCooldown && boost.cooldownEndsAt && (
                    <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2.5 py-0.5 rounded-full">
                      クールダウン: {new Date(boost.cooldownEndsAt).toLocaleDateString('ja-JP')} まで
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {actionLoading === boost.id ? (
                    <Spinner size="sm" />
                  ) : boost.guildId ? (
                    <button
                      onClick={() => handleUnassign(boost.id)}
                      className="text-sm bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30 px-4 py-1.5 rounded-lg transition-all"
                    >
                      外す
                    </button>
                  ) : !boost.isOnCooldown ? (
                    <Select
                      placeholder="サーバーを選択"
                      onChange={(val) => {
                        if (val) handleAssign(boost.id, val as string);
                      }}
                    >
                      <Select.Trigger className="min-w-[200px] bg-white/5 border border-white/10 text-white rounded-xl px-3 py-1.5 text-sm">
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover className="bg-[#1a1a2e] border border-white/10 rounded-xl">
                        <ListBox>
                          {guilds.map((guild) => (
                            <ListBox.Item key={guild.id} id={guild.id}>
                              <span className="flex items-center gap-2">
                                {guild.icon ? (
                                  <img
                                    src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=32`}
                                    alt=""
                                    className="w-5 h-5 rounded-full"
                                  />
                                ) : (
                                  <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-xs text-gray-400">
                                    {guild.name.charAt(0)}
                                  </span>
                                )}
                                {guild.name}
                              </span>
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* サブスクリプション管理 */}
      {data?.subscription && (
        <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6 flex items-center justify-between gap-4">
          <p className="text-sm text-gray-400">
            サブスクリプションの管理・解約はStripeカスタマーポータルから行えます。
          </p>
          <button
            onClick={handlePortal}
            disabled={portalLoading}
            className="shrink-0 text-sm border border-purple-500/40 text-purple-400 hover:bg-purple-500/10 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2 rounded-xl transition-all"
          >
            {portalLoading ? '読み込み中...' : 'カスタマーポータルを開く'}
          </button>
        </div>
      )}
      <Toast state={toastState} />
    </div>
  );
}

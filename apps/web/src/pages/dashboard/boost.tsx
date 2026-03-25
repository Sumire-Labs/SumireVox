import { useState, useEffect } from 'react';
import { Select, ListBox, Spinner } from '@heroui/react';
import { api, ApiError } from '../../lib/api';

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
  const [loading, setLoading] = useState(true);
  const [boostCount, setBoostCount] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [boostData, guildData] = await Promise.all([
        api.get<BoostData>('/api/user/boosts'),
        api.get<Guild[]>('/api/guilds'),
      ]);
      setData(boostData);
      setGuilds(guildData);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCheckout = async () => {
    setError(null);
    try {
      const result = await api.post<{ url: string }>('/api/user/boosts/checkout', {
        boostCount: parseInt(boostCount, 10),
      });
      window.location.href = result.url;
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const handleAssign = async (boostId: string, guildId: string) => {
    setActionLoading(boostId);
    setError(null);
    try {
      await api.put(`/api/user/boosts/${boostId}/assign`, { guildId });
      await fetchData();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnassign = async (boostId: string) => {
    setActionLoading(boostId);
    setError(null);
    try {
      await api.put(`/api/user/boosts/${boostId}/unassign`);
      await fetchData();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm('サブスクリプションを解約しますか？現在の請求期間の終了まではブーストが有効です。')) return;
    try {
      await api.post('/api/user/subscription/cancel');
      await fetchData();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
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

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

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
                    <span className="text-gray-300">
                      割り当て先: {guilds.find((g) => g.id === boost.guildId)?.name ?? boost.guildId}
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
                              {guild.name}
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

      {/* 解約 */}
      {data?.subscription?.status === 'ACTIVE' && (
        <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6 flex items-center justify-between gap-4">
          <p className="text-sm text-gray-400">
            解約すると、現在の請求期間（{new Date(data.subscription.currentPeriodEnd).toLocaleDateString('ja-JP')}）の終了後にブーストが無効になります。
          </p>
          <button
            onClick={handleCancel}
            className="shrink-0 text-sm bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30 px-5 py-2 rounded-xl transition-all"
          >
            解約する
          </button>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { api } from '../../lib/api';

interface BoostData {
  boosts: Array<{
    id: string;
    guildId: string | null;
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

export function DashboardPage() {
  const [data, setData] = useState<BoostData | null>(null);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const guildMap = new Map(guilds.map((g) => [g.id, g]));
  const [loading, setLoading] = useState(true);

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
        <h1 className="text-3xl font-bold text-white mb-2">マイページ</h1>
        <p className="text-gray-400">サブスクリプションとブースト枠の管理</p>
      </div>

      <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-white">サブスクリプション</h2>
        {data?.subscription ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-gray-400">ステータス:</span>
              <span
                className={`text-sm px-2.5 py-0.5 rounded-full font-medium ${
                  data.subscription.status === 'ACTIVE'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}
              >
                {data.subscription.status}
              </span>
            </div>
            <p className="text-gray-300">ブースト枠: <span className="text-white font-medium">{data.subscription.boostCount}個</span></p>
            <p className="text-gray-300">次回請求日: <span className="text-white font-medium">{new Date(data.subscription.currentPeriodEnd).toLocaleDateString('ja-JP')}</span></p>
          </div>
        ) : (
          <p className="text-gray-500">
            サブスクリプションはありません。
            <Link to="/dashboard/boost" className="text-purple-400 hover:text-purple-300 transition-colors ml-1">
              ブーストを購入する
            </Link>
          </p>
        )}
      </div>

      {data?.boosts && data.boosts.length > 0 && (
        <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-white">ブースト枠</h2>
          <div className="flex flex-col gap-2">
            {data.boosts.map((boost) => (
              <div
                key={boost.id}
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5"
              >
                <div className="flex items-center gap-2">
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
                          </>
                        );
                      })()}
                    </span>
                  ) : (
                    <span className="text-gray-500">未割り当て</span>
                  )}
                  {boost.isOnCooldown && (
                    <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2.5 py-0.5 rounded-full">
                      クールダウン中
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

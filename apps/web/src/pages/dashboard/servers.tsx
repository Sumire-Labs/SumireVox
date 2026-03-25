import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { api } from '../../lib/api';

interface Guild {
  id: string;
  name: string;
  icon: string | null;
}

export function ServersPage() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    api.get<Guild[]>('/api/guilds', { signal: controller.signal })
      .then(setGuilds)
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
        <h1 className="text-3xl font-bold text-white mb-2">サーバー管理</h1>
        <p className="text-gray-400">管理権限のあるサーバーの設定を変更できます</p>
      </div>

      {guilds.length === 0 ? (
        <p className="text-gray-500">管理権限のあるサーバーはありません。</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {guilds.map((guild) => (
            <div
              key={guild.id}
              className="bg-[#12121a] border border-white/5 rounded-2xl p-5 flex flex-col gap-4 hover:border-purple-500/30 transition-all duration-300"
            >
              <div className="flex items-center gap-3">
                {guild.icon ? (
                  <img
                    src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`}
                    alt=""
                    className="w-12 h-12 rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-lg font-bold text-white">
                    {guild.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{guild.name}</p>
                  <p className="text-xs text-gray-500 truncate">{guild.id}</p>
                </div>
              </div>
              <Link
                to={`/dashboard/servers/${guild.id}`}
                className="block text-center text-sm border border-white/20 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl transition-all"
              >
                設定を開く
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

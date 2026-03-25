import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Tabs } from '@heroui/react';
import { api } from '../../lib/api';

interface Guild {
  id: string;
  name: string;
  icon: string | null;
  botJoined: boolean;
}

interface GuildsResponse {
  guilds: Guild[];
  mainBotClientId: string;
}

export function ServersPage() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [mainBotClientId, setMainBotClientId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    api.get<GuildsResponse>('/api/guilds', { signal: controller.signal })
      .then((res) => {
        setGuilds(res.guilds);
        setMainBotClientId(res.mainBotClientId);
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

  const joinedGuilds = guilds.filter((g) => g.botJoined);
  const notJoinedGuilds = guilds.filter((g) => !g.botJoined);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">サーバー管理</h1>
        <p className="text-gray-400">管理権限のあるサーバーの設定を変更できます</p>
      </div>

      <Tabs>
        <Tabs.ListContainer>
          <Tabs.List
            aria-label="サーバーフィルター"
            className="bg-white/5 border border-white/5 rounded-xl"
          >
            <Tabs.Tab id="joined" className="text-gray-400 data-[selected=true]:text-white px-4 py-2 text-sm">
              導入済み
              <span className="ml-1.5 text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full">
                {joinedGuilds.length}
              </span>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="not-joined" className="text-gray-400 data-[selected=true]:text-white px-4 py-2 text-sm">
              未導入
              <span className="ml-1.5 text-xs bg-white/10 text-gray-400 px-1.5 py-0.5 rounded-full">
                {notJoinedGuilds.length}
              </span>
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="joined">
          {joinedGuilds.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Botが参加しているサーバーはありません。</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {joinedGuilds.map((guild) => (
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
        </Tabs.Panel>

        <Tabs.Panel id="not-joined">
          {notJoinedGuilds.length === 0 ? (
            <p className="text-gray-500 text-center py-8">すべてのサーバーにBotが導入されています。</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {notJoinedGuilds.map((guild) => (
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
                  <a
                    href={`https://discord.com/api/oauth2/authorize?client_id=${mainBotClientId}&permissions=36727824&scope=bot&guild_id=${guild.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-sm border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 px-4 py-2 rounded-xl transition-all"
                  >
                    Botを招待
                  </a>
                </div>
              ))}
            </div>
          )}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

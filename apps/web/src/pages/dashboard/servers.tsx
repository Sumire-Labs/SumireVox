import { useState, useEffect } from 'react';
import { Card, CardBody, Spinner } from '@heroui/react';
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
    api.get<Guild[]>('/api/guilds')
      .then(setGuilds)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner size="lg" color="primary" className="mx-auto mt-20" />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">サーバー管理</h1>

      {guilds.length === 0 ? (
        <p className="text-default-500">管理権限のあるサーバーはありません。</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {guilds.map((guild) => (
            <Card key={guild.id} isPressable as={Link} to={`/dashboard/servers/${guild.id}`}>
              <CardBody className="flex flex-row items-center gap-4">
                {guild.icon ? (
                  <img
                    src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`}
                    alt=""
                    className="w-12 h-12 rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-default-200 flex items-center justify-center text-lg font-bold">
                    {guild.name.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-semibold">{guild.name}</p>
                  <p className="text-sm text-default-500">{guild.id}</p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

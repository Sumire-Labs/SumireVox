import { useState, useEffect } from 'react';
import { Switch } from '@heroui/react';
import { api, ApiError } from '../lib/api';

interface BotInstance {
  instanceId: number;
  name: string;
  botUserId: string;
  clientId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function BotInstancesPage() {
  const [instances, setInstances] = useState<BotInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    api.get<BotInstance[]>('/api/admin/bot-instances')
      .then(setInstances)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleToggleActive = async (instanceId: number, isActive: boolean) => {
    setTogglingId(instanceId);
    setErrorMessage(null);
    try {
      const updated = await api.put<BotInstance>(
        `/api/admin/bot-instances/${instanceId}/active`,
        { isActive },
      );
      setInstances((prev) =>
        prev.map((inst) => (inst.instanceId === updated.instanceId ? updated : inst)),
      );
    } catch (err) {
      if (err instanceof ApiError) setErrorMessage(err.message);
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center mt-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Bot インスタンス</h1>
        <p className="text-default-400 text-sm">登録済みの Bot インスタンスの一覧と管理</p>
      </div>

      {errorMessage && (
        <div className="bg-danger-50 border border-danger-200 text-danger text-sm px-4 py-3 rounded-xl">
          {errorMessage}
        </div>
      )}

      {instances.length === 0 ? (
        <p className="text-default-400 text-sm">Bot インスタンスが登録されていません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-divider">
                <th className="text-left py-3 px-4 text-default-400 font-medium">ID</th>
                <th className="text-left py-3 px-4 text-default-400 font-medium">名前</th>
                <th className="text-left py-3 px-4 text-default-400 font-medium">Bot ユーザー ID</th>
                <th className="text-left py-3 px-4 text-default-400 font-medium">クライアント ID</th>
                <th className="text-left py-3 px-4 text-default-400 font-medium">アクティブ</th>
                <th className="text-left py-3 px-4 text-default-400 font-medium">更新日時</th>
              </tr>
            </thead>
            <tbody>
              {instances.map((instance) => (
                <tr key={instance.instanceId} className="border-b border-divider hover:bg-default-50">
                  <td className="py-3 px-4 font-mono text-default-600">#{instance.instanceId}</td>
                  <td className="py-3 px-4 font-medium">{instance.name}</td>
                  <td className="py-3 px-4 font-mono text-default-500">{instance.botUserId}</td>
                  <td className="py-3 px-4 font-mono text-default-500">{instance.clientId}</td>
                  <td className="py-3 px-4">
                    <Switch
                      isSelected={instance.isActive}
                      isDisabled={togglingId === instance.instanceId}
                      size="sm"
                      onChange={(v) => handleToggleActive(instance.instanceId, v)}
                    >
                      {({ isSelected }) => (
                        <Switch.Control className={isSelected ? 'bg-purple-600' : 'bg-white/20'}>
                          <Switch.Thumb />
                        </Switch.Control>
                      )}
                    </Switch>
                  </td>
                  <td className="py-3 px-4 text-default-400">
                    {new Date(instance.updatedAt).toLocaleString('ja-JP')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

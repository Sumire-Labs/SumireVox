import { useState, useEffect } from 'react';
import { Card, CardBody, CardHeader, Button, Input, Chip, Spinner, Select, SelectItem } from '@heroui/react';
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

  if (loading) return <Spinner size="lg" color="primary" className="mx-auto mt-20" />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ブースト管理</h1>

      {error && (
        <Card className="bg-danger-50 border-danger">
          <CardBody><p className="text-danger">{error}</p></CardBody>
        </Card>
      )}

      <Card>
        <CardHeader className="font-semibold">ブーストを購入</CardHeader>
        <CardBody className="flex flex-row items-end gap-4">
          <Input
            type="number"
            label="ブースト数"
            min={1}
            max={10}
            value={boostCount}
            onValueChange={setBoostCount}
            className="max-w-[120px]"
          />
          <div>
            <p className="text-sm text-default-500 mb-1">月額 {parseInt(boostCount, 10) * 300}円</p>
            <Button color="primary" onPress={handleCheckout}>購入する</Button>
          </div>
        </CardBody>
      </Card>

      {data?.boosts && data.boosts.length > 0 && (
        <Card>
          <CardHeader className="font-semibold">ブースト枠一覧</CardHeader>
          <CardBody className="space-y-4">
            {data.boosts.map((boost) => (
              <div key={boost.id} className="flex items-center justify-between p-3 rounded-lg bg-content2">
                <div>
                  {boost.guildId ? (
                    <span>割り当て先: {guilds.find((g) => g.id === boost.guildId)?.name ?? boost.guildId}</span>
                  ) : (
                    <span className="text-default-500">未割り当て</span>
                  )}
                  {boost.isOnCooldown && boost.cooldownEndsAt && (
                    <Chip color="warning" size="sm" className="ml-2">
                      クールダウン: {new Date(boost.cooldownEndsAt).toLocaleDateString('ja-JP')} まで
                    </Chip>
                  )}
                </div>
                <div className="flex gap-2">
                  {boost.guildId ? (
                    <Button
                      size="sm"
                      color="danger"
                      variant="flat"
                      isLoading={actionLoading === boost.id}
                      onPress={() => handleUnassign(boost.id)}
                    >
                      外す
                    </Button>
                  ) : !boost.isOnCooldown ? (
                    <Select
                      size="sm"
                      placeholder="サーバーを選択"
                      className="min-w-[200px]"
                      onChange={(e) => {
                        if (e.target.value) handleAssign(boost.id, e.target.value);
                      }}
                    >
                      {guilds.map((guild) => (
                        <SelectItem key={guild.id}>
                          {guild.name}
                        </SelectItem>
                      ))}
                    </Select>
                  ) : null}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {data?.subscription?.status === 'ACTIVE' && (
        <Card>
          <CardBody className="flex flex-row items-center justify-between">
            <p className="text-sm text-default-500">
              サブスクリプションを解約すると、現在の請求期間（{new Date(data.subscription.currentPeriodEnd).toLocaleDateString('ja-JP')}）の終了後にブーストが無効になります。
            </p>
            <Button color="danger" variant="flat" size="sm" onPress={handleCancel}>
              解約する
            </Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

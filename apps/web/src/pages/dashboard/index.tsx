import { useState, useEffect } from 'react';
import { Card, CardBody, CardHeader, Chip, Spinner } from '@heroui/react';
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

export function DashboardPage() {
  const [data, setData] = useState<BoostData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<BoostData>('/api/user/boosts')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner size="lg" color="primary" className="mx-auto mt-20" />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">マイページ</h1>

      <Card>
        <CardHeader className="font-semibold">サブスクリプション</CardHeader>
        <CardBody>
          {data?.subscription ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span>ステータス:</span>
                <Chip color={data.subscription.status === 'ACTIVE' ? 'success' : 'warning'} size="sm">
                  {data.subscription.status}
                </Chip>
              </div>
              <p>ブースト枠: {data.subscription.boostCount}個</p>
              <p>次回請求日: {new Date(data.subscription.currentPeriodEnd).toLocaleDateString('ja-JP')}</p>
            </div>
          ) : (
            <p className="text-default-500">
              サブスクリプションはありません。
              <Link to="/dashboard/boost" className="text-primary ml-1">ブーストを購入する</Link>
            </p>
          )}
        </CardBody>
      </Card>

      {data?.boosts && data.boosts.length > 0 && (
        <Card>
          <CardHeader className="font-semibold">ブースト枠</CardHeader>
          <CardBody>
            <div className="space-y-2">
              {data.boosts.map((boost) => (
                <div key={boost.id} className="flex items-center justify-between p-2 rounded bg-content2">
                  <span>{boost.guildId ? `サーバー: ${boost.guildId}` : '未割り当て'}</span>
                  {boost.isOnCooldown && (
                    <Chip color="warning" size="sm">クールダウン中</Chip>
                  )}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

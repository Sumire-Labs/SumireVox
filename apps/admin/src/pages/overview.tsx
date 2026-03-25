import { useState, useEffect } from 'react';
import { Card, Spinner } from '@heroui/react';
import { api } from '../lib/api';

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
}

interface ServerItem {
  guildId: string;
  manualPremium: boolean;
  createdAt: string;
}

interface RequestItem {
  id: number;
  status: string;
}

export function OverviewPage() {
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [pendingTotal, setPendingTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<PaginatedResponse<ServerItem>>('/api/admin/servers?perPage=1'),
      api.get<PaginatedResponse<RequestItem>>('/api/admin/dictionary/requests?status=PENDING&perPage=1'),
    ])
      .then(([servers, requests]) => {
        setServerTotal(servers.total);
        setPendingTotal(requests.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <Spinner size="lg" className="text-purple-500" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">概要</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
        <Card>
          <Card.Content className="text-center py-6">
            <p className="text-4xl font-bold text-purple-400">{serverTotal ?? '—'}</p>
            <p className="text-gray-500 mt-2 text-sm">登録サーバー数</p>
          </Card.Content>
        </Card>
        <Card>
          <Card.Content className="text-center py-6">
            <p className="text-4xl font-bold text-yellow-400">{pendingTotal ?? '—'}</p>
            <p className="text-gray-500 mt-2 text-sm">未処理の辞書申請</p>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}

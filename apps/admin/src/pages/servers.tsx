import { useState, useEffect, useCallback } from 'react';
import {
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Pagination, Switch, Spinner,
} from '@heroui/react';
import { api } from '../lib/api';

interface ServerItem {
  guildId: string;
  manualPremium: boolean;
  createdAt: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
}

const PER_PAGE = 20;

export function AdminServersPage() {
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchServers = useCallback((p: number) => {
    setLoading(true);
    api.get<PaginatedResponse<ServerItem>>(`/api/admin/servers?page=${p}&perPage=${PER_PAGE}`)
      .then((res) => {
        setServers(res.items);
        setTotal(res.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchServers(page);
  }, [page, fetchServers]);

  const togglePremium = (guildId: string, current: boolean) => {
    api.put(`/api/admin/servers/${guildId}/premium`, { manualPremium: !current })
      .then(() => {
        setServers((prev) =>
          prev.map((s) => s.guildId === guildId ? { ...s, manualPremium: !current } : s)
        );
      })
      .catch(() => {});
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">サーバー一覧</h1>
      {loading ? (
        <div className="flex justify-center items-center min-h-[40vh]">
          <Spinner size="lg" color="primary" />
        </div>
      ) : (
        <>
          <Table aria-label="サーバー一覧" bottomContent={
            totalPages > 1 ? (
              <div className="flex justify-center">
                <Pagination total={totalPages} page={page} onChange={setPage} color="primary" />
              </div>
            ) : undefined
          }>
            <TableHeader>
              <TableColumn>Guild ID</TableColumn>
              <TableColumn>Manual PREMIUM</TableColumn>
              <TableColumn>作成日時</TableColumn>
            </TableHeader>
            <TableBody emptyContent="サーバーがありません">
              {servers.map((server) => (
                <TableRow key={server.guildId}>
                  <TableCell>
                    <span className="font-mono text-sm">{server.guildId}</span>
                  </TableCell>
                  <TableCell>
                    <Switch
                      isSelected={server.manualPremium}
                      onValueChange={() => togglePremium(server.guildId, server.manualPremium)}
                      color="primary"
                      size="sm"
                    />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-default-500">
                      {new Date(server.createdAt).toLocaleDateString('ja-JP')}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}

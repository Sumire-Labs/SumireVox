import { useState, useEffect, useCallback } from 'react';
import { Switch, Spinner } from '@heroui/react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { useToast, Toast } from '../components/toast';

interface ServerItem {
  guildId: string;
  name: string;
  icon: string | null;
  manualPremium: boolean;
  botJoinedAt: string | null;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
}

const PER_PAGE = 20;

function SimplePagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center gap-3">
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="px-3 py-1.5 text-sm border border-white/10 rounded-lg text-gray-400 hover:text-white hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        ← 前
      </button>
      <span className="text-sm text-gray-400">{page} / {total}</span>
      <button
        disabled={page >= total}
        onClick={() => onChange(page + 1)}
        className="px-3 py-1.5 text-sm border border-white/10 rounded-lg text-gray-400 hover:text-white hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        次 →
      </button>
    </div>
  );
}

export function AdminServersPage() {
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const { toastState, showSaving, showSuccess, showError } = useToast();

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
    showSaving();
    api.put(`/api/admin/servers/${guildId}/premium`, { manualPremium: !current })
      .then(() => {
        setServers((prev) =>
          prev.map((s) => s.guildId === guildId ? { ...s, manualPremium: !current } : s)
        );
        showSuccess();
      })
      .catch(() => showError());
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">サーバー一覧</h1>
      {loading ? (
        <div className="flex justify-center items-center min-h-[40vh]">
          <Spinner size="lg" className="text-purple-500" />
        </div>
      ) : (
        <>
          <div className="bg-[#12121a] border border-white/5 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">サーバー</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Manual PREMIUM</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Bot 導入日時</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {servers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-gray-500">サーバーがありません</td>
                    </tr>
                  ) : servers.map((server) => (
                    <tr key={server.guildId} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/servers/${server.guildId}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                          {server.icon ? (
                            <img
                              src={`https://cdn.discordapp.com/icons/${server.guildId}/${server.icon}.png?size=64`}
                              alt={server.name}
                              className="w-8 h-8 rounded-full flex-shrink-0"
                            />
                          ) : (
                            <div className="bg-gray-700 rounded-full w-8 h-8 flex items-center justify-center text-sm flex-shrink-0">
                              {server.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-white text-sm">{server.name}</div>
                            <div className="font-mono text-xs text-gray-500">{server.guildId}</div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Switch
                          isSelected={server.manualPremium}
                          onChange={() => togglePremium(server.guildId, server.manualPremium)}
                          size="sm"
                        >
                          {({ isSelected }) => (
                            <Switch.Control className={isSelected ? 'bg-purple-500' : 'bg-gray-600'}>
                              <Switch.Thumb />
                            </Switch.Control>
                          )}
                        </Switch>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500">
                          {server.botJoinedAt ? new Date(server.botJoinedAt).toLocaleDateString('ja-JP') : '設定なし'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center mt-4">
              <SimplePagination page={page} total={totalPages} onChange={setPage} />
            </div>
          )}
        </>
      )}
      <Toast state={toastState} />
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { Button, Chip, Select, ListBox, Spinner } from '@heroui/react';
import { api } from '../lib/api';
import { useToast, Toast } from '../components/toast';

type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface RequestItem {
  id: number;
  word: string;
  reading: string;
  reason: string | null;
  requestedBy: string;
  guildId: string;
  status: RequestStatus;
  createdAt: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
}

const PER_PAGE = 20;

const STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING: '未処理',
  APPROVED: '承認',
  REJECTED: '却下',
};

const STATUS_COLORS: Record<RequestStatus, 'warning' | 'success' | 'danger'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

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

export function AdminRequestsPage() {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<RequestStatus>('PENDING');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const { toastState, showSaving, showSuccess, showError } = useToast();

  const fetchItems = useCallback((p: number, status: RequestStatus) => {
    setLoading(true);
    api.get<PaginatedResponse<RequestItem>>(
      `/api/admin/dictionary/requests?status=${status}&page=${p}&perPage=${PER_PAGE}`
    )
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchItems(page, statusFilter);
  }, [page, statusFilter, fetchItems]);

  const handleApprove = (id: number) => {
    setProcessingId(id);
    showSaving();
    api.put(`/api/admin/dictionary/requests/${id}/approve`)
      .then(() => {
        fetchItems(page, statusFilter);
        showSuccess('承認しました');
      })
      .catch(() => showError())
      .finally(() => setProcessingId(null));
  };

  const handleReject = (id: number) => {
    setProcessingId(id);
    showSaving();
    api.put(`/api/admin/dictionary/requests/${id}/reject`)
      .then(() => {
        fetchItems(page, statusFilter);
        showSuccess('却下しました');
      })
      .catch(() => showError())
      .finally(() => setProcessingId(null));
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">申請管理</h1>
        <Select
          aria-label="ステータスフィルター"
          value={statusFilter}
          onChange={(val) => {
            if (val) {
              setStatusFilter(val as RequestStatus);
              setPage(1);
            }
          }}
        >
          <Select.Trigger className="w-36 bg-white/5 border border-white/10 text-white rounded-xl px-3 py-1.5">
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover className="bg-[#1a1a2e] border border-white/10 rounded-xl">
            <ListBox>
              <ListBox.Item id="PENDING">未処理</ListBox.Item>
              <ListBox.Item id="APPROVED">承認済み</ListBox.Item>
              <ListBox.Item id="REJECTED">却下済み</ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">単語</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">読み</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">理由</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">申請者</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">サーバー</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">ステータス</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">申請がありません</td>
                    </tr>
                  ) : items.map((item) => (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-white">{item.word}</td>
                      <td className="px-4 py-3 text-gray-300">{item.reading}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500">{item.reason ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-gray-300">{item.requestedBy}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-gray-300">{item.guildId}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Chip size="sm" color={STATUS_COLORS[item.status]} variant="soft">
                          {STATUS_LABELS[item.status]}
                        </Chip>
                      </td>
                      <td className="px-4 py-3">
                        {item.status === 'PENDING' ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              isPending={processingId === item.id}
                              onPress={() => handleApprove(item.id)}
                              className="text-green-400 border-green-500/30 hover:bg-green-500/10"
                            >
                              承認
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              isPending={processingId === item.id}
                              onPress={() => handleReject(item.id)}
                            >
                              却下
                            </Button>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">—</span>
                        )}
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

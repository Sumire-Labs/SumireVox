import { useState, useEffect, useCallback } from 'react';
import {
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Pagination, Button, Chip, Select, SelectItem, Spinner,
} from '@heroui/react';
import { api } from '../lib/api';

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

export function AdminRequestsPage() {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<RequestStatus>('PENDING');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

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
    api.put(`/api/admin/dictionary/requests/${id}/approve`)
      .then(() => fetchItems(page, statusFilter))
      .catch(() => {})
      .finally(() => setProcessingId(null));
  };

  const handleReject = (id: number) => {
    setProcessingId(id);
    api.put(`/api/admin/dictionary/requests/${id}/reject`)
      .then(() => fetchItems(page, statusFilter))
      .catch(() => {})
      .finally(() => setProcessingId(null));
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">申請管理</h1>
        <Select
          aria-label="ステータスフィルター"
          selectedKeys={[statusFilter]}
          onSelectionChange={(keys) => {
            const val = Array.from(keys)[0] as RequestStatus;
            if (val) {
              setStatusFilter(val);
              setPage(1);
            }
          }}
          className="w-36"
          size="sm"
        >
          <SelectItem key="PENDING">未処理</SelectItem>
          <SelectItem key="APPROVED">承認済み</SelectItem>
          <SelectItem key="REJECTED">却下済み</SelectItem>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center items-center min-h-[40vh]">
          <Spinner size="lg" color="primary" />
        </div>
      ) : (
        <Table aria-label="辞書申請一覧" bottomContent={
          totalPages > 1 ? (
            <div className="flex justify-center">
              <Pagination total={totalPages} page={page} onChange={setPage} color="primary" />
            </div>
          ) : undefined
        }>
          <TableHeader>
            <TableColumn>単語</TableColumn>
            <TableColumn>読み</TableColumn>
            <TableColumn>理由</TableColumn>
            <TableColumn>申請者</TableColumn>
            <TableColumn>サーバー</TableColumn>
            <TableColumn>ステータス</TableColumn>
            <TableColumn>操作</TableColumn>
          </TableHeader>
          <TableBody emptyContent="申請がありません">
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.word}</TableCell>
                <TableCell>{item.reading}</TableCell>
                <TableCell>
                  <span className="text-sm text-default-500">{item.reason ?? '—'}</span>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-sm">{item.requestedBy}</span>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-sm">{item.guildId}</span>
                </TableCell>
                <TableCell>
                  <Chip size="sm" color={STATUS_COLORS[item.status]} variant="flat">
                    {STATUS_LABELS[item.status]}
                  </Chip>
                </TableCell>
                <TableCell>
                  {item.status === 'PENDING' ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        color="success"
                        variant="flat"
                        isLoading={processingId === item.id}
                        onPress={() => handleApprove(item.id)}
                      >
                        承認
                      </Button>
                      <Button
                        size="sm"
                        color="danger"
                        variant="flat"
                        isLoading={processingId === item.id}
                        onPress={() => handleReject(item.id)}
                      >
                        却下
                      </Button>
                    </div>
                  ) : (
                    <span className="text-sm text-default-400">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

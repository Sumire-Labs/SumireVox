import { useCallback, useEffect, useState } from 'react';
import { Button, Chip, Input, Label, ListBox, Modal, Select, Spinner, TextField } from '@heroui/react';
import { api, ApiError } from '../lib/api';
import { Toast, useToast } from '../components/toast';

type AnnouncementType = 'info' | 'update' | 'maintenance' | 'important';

interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  type: AnnouncementType;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
}

interface AnnouncementForm {
  title: string;
  body: string;
  type: AnnouncementType;
  published: boolean;
  publishedAt: string;
}

const PER_PAGE = 20;
const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 20_000;

const TYPE_LABELS: Record<AnnouncementType, string> = {
  info: '通常',
  update: 'アップデート',
  maintenance: 'メンテナンス',
  important: '重要',
};

const TYPE_COLORS: Record<AnnouncementType, 'default' | 'accent' | 'warning' | 'danger'> = {
  info: 'default',
  update: 'accent',
  maintenance: 'warning',
  important: 'danger',
};

const STATUS_LABELS = {
  draft: '下書き',
  published: '公開中',
  scheduled: '予約公開',
} as const;

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function toDateTimeLocal(value: string | null): string {
  const date = value ? new Date(value) : new Date();
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoDate(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getStatus(item: AnnouncementItem): keyof typeof STATUS_LABELS {
  if (!item.published) return 'draft';
  if (item.publishedAt && new Date(item.publishedAt).getTime() > Date.now()) return 'scheduled';
  return 'published';
}

function emptyForm(): AnnouncementForm {
  return {
    title: '',
    body: '',
    type: 'info',
    published: false,
    publishedAt: toDateTimeLocal(null),
  };
}

function SimplePagination({ page, total, onChange }: { page: number; total: number; onChange: (nextPage: number) => void }) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="px-3 py-1.5 text-sm border border-white/10 rounded-lg text-gray-400 hover:text-white hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        ← 前
      </button>
      <span className="text-sm text-gray-400">{page} / {total}</span>
      <button
        type="button"
        disabled={page >= total}
        onClick={() => onChange(page + 1)}
        className="px-3 py-1.5 text-sm border border-white/10 rounded-lg text-gray-400 hover:text-white hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        次 →
      </button>
    </div>
  );
}

export function AdminAnnouncementsPage() {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementItem | null>(null);
  const [form, setForm] = useState<AnnouncementForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const { toastState, showSaving, showSuccess, showError } = useToast();

  const fetchItems = useCallback(async (nextPage: number) => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await api.get<PaginatedResponse<AnnouncementItem>>(
        `/api/admin/announcements?page=${nextPage}&perPage=${PER_PAGE}`,
      );
      setItems(response.items);
      setTotal(response.total);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : 'お知らせの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchItems(page);
  }, [fetchItems, page]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setEditorOpen(true);
  };

  const openEdit = (item: AnnouncementItem) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      body: item.body,
      type: item.type,
      published: item.published,
      publishedAt: toDateTimeLocal(item.publishedAt),
    });
    setFormError(null);
    setEditorOpen(true);
  };

  const handleSave = async () => {
    const title = form.title.trim();
    const body = form.body.trim();
    if (!title || title.length > MAX_TITLE_LENGTH) {
      setFormError(`タイトルは1〜${MAX_TITLE_LENGTH}文字で入力してください。`);
      return;
    }
    if (!body || body.length > MAX_BODY_LENGTH) {
      setFormError(`本文は1〜${MAX_BODY_LENGTH.toLocaleString()}文字で入力してください。`);
      return;
    }

    setSaving(true);
    setFormError(null);
    showSaving();
    const payload = {
      title,
      body,
      type: form.type,
      published: form.published,
      publishedAt: toIsoDate(form.publishedAt),
    };
    try {
      if (editingId) {
        await api.put(`/api/admin/announcements/${editingId}`, payload);
      } else {
        await api.post('/api/admin/announcements', payload);
      }
      setEditorOpen(false);
      await fetchItems(page);
      showSuccess(editingId ? 'お知らせを更新しました' : 'お知らせを作成しました');
    } catch (error) {
      showError(error instanceof ApiError ? error.message : '保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (item: AnnouncementItem) => {
    if (togglingId || saving || deleting) return;
    setTogglingId(item.id);
    showSaving(item.published ? '非公開に変更中…' : '公開中…');
    try {
      await api.put(`/api/admin/announcements/${item.id}`, { published: !item.published });
      await fetchItems(page);
      showSuccess(item.published ? '非公開にしました' : '公開しました');
    } catch (error) {
      showError(error instanceof ApiError ? error.message : '公開状態の変更に失敗しました。');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleting || saving) return;
    setDeleting(true);
    showSaving('削除中…');
    try {
      await api.delete(`/api/admin/announcements/${deleteTarget.id}`);
      setDeleteOpen(false);
      setDeleteTarget(null);
      const nextPage = Math.min(page, Math.max(1, Math.ceil((total - 1) / PER_PAGE)));
      if (nextPage !== page) {
        setPage(nextPage);
      } else {
        await fetchItems(page);
      }
      showSuccess('削除しました');
    } catch (error) {
      showError(error instanceof ApiError ? error.message : '削除に失敗しました。');
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-purple-400 font-semibold mb-1">Content</p>
          <h1 className="text-2xl font-bold">お知らせ管理</h1>
        </div>
        <Button variant="primary" size="sm" onPress={openCreate}>新規作成</Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center min-h-[40vh]">
          <Spinner size="lg" className="text-purple-500" />
        </div>
      ) : loadError ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
          <p className="text-red-300 mb-4">{loadError}</p>
          <Button variant="secondary" size="sm" onPress={() => void fetchItems(page)}>再読み込み</Button>
        </div>
      ) : (
        <>
          <div className="bg-[#12121a] border border-white/5 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">タイトル</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">種類</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">公開状態</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">公開日時</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">更新日時</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                        お知らせがありません。最初のお知らせを作成しましょう。
                      </td>
                    </tr>
                  ) : items.map((item) => {
                    const status = getStatus(item);
                    return (
                      <tr key={item.id} className="hover:bg-white/[0.02] transition-colors align-top">
                        <td className="px-4 py-4 min-w-[220px] max-w-[340px]">
                          <p className="text-white font-medium truncate">{item.title}</p>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.body}</p>
                        </td>
                        <td className="px-4 py-4">
                          <Chip size="sm" color={TYPE_COLORS[item.type]} variant="soft">{TYPE_LABELS[item.type]}</Chip>
                        </td>
                        <td className="px-4 py-4">
                          <Chip size="sm" color={status === 'draft' ? 'default' : status === 'scheduled' ? 'warning' : 'success'} variant="soft">
                            {STATUS_LABELS[status]}
                          </Chip>
                        </td>
                        <td className="px-4 py-4 text-gray-400 whitespace-nowrap">{formatDate(item.publishedAt)}</td>
                        <td className="px-4 py-4 text-gray-400 whitespace-nowrap">{formatDate(item.updatedAt)}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2 min-w-[230px]">
                            <Button size="sm" variant="secondary" onPress={() => openEdit(item)}>編集</Button>
                            <Button
                              size="sm"
                              variant={item.published ? 'secondary' : 'primary'}
                              isPending={togglingId === item.id}
                              onPress={() => void handleTogglePublish(item)}
                            >
                              {item.published ? '非公開' : '公開'}
                            </Button>
                            <Button size="sm" variant="danger" onPress={() => { setDeleteTarget(item); setDeleteOpen(true); }}>削除</Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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

      <Modal>
        <Modal.Backdrop isOpen={editorOpen} onOpenChange={setEditorOpen}>
          <Modal.Container>
            <Modal.Dialog className="bg-[#1a1a2e] border border-white/10 max-w-2xl">
              <Modal.Header>
                <Modal.Heading className="text-white">{editingId ? 'お知らせを編集' : 'お知らせを作成'}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-5 max-h-[70vh] overflow-y-auto">
                <TextField value={form.title} onChange={(value) => setForm((current) => ({ ...current, title: value }))}>
                  <Label className="text-sm text-gray-300">タイトル</Label>
                  <Input
                    maxLength={MAX_TITLE_LENGTH}
                    placeholder="例：新機能のお知らせ"
                    className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50"
                  />
                </TextField>
                <div>
                  <label htmlFor="announcement-body" className="text-sm text-gray-300 block mb-2">本文</label>
                  <textarea
                    id="announcement-body"
                    value={form.body}
                    onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
                    maxLength={MAX_BODY_LENGTH}
                    rows={9}
                    placeholder="お知らせの本文を入力してください。"
                    className="w-full resize-y bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50"
                  />
                  <p className="text-xs text-gray-500 text-right mt-1">{form.body.length.toLocaleString()} / {MAX_BODY_LENGTH.toLocaleString()}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-300 mb-2">種類</p>
                    <Select
                      aria-label="お知らせの種類"
                      value={form.type}
                      onChange={(value) => { if (value) setForm((current) => ({ ...current, type: value as AnnouncementType })); }}
                    >
                      <Select.Trigger className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2">
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover className="bg-[#1a1a2e] border border-white/10 rounded-xl">
                        <ListBox>
                          <ListBox.Item id="info">通常</ListBox.Item>
                          <ListBox.Item id="update">アップデート</ListBox.Item>
                          <ListBox.Item id="maintenance">メンテナンス</ListBox.Item>
                          <ListBox.Item id="important">重要</ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>
                  <div>
                    <p className="text-sm text-gray-300 mb-2">公開状態</p>
                    <Select
                      aria-label="公開状態"
                      value={form.published ? 'published' : 'draft'}
                      onChange={(value) => setForm((current) => ({ ...current, published: value === 'published' }))}
                    >
                      <Select.Trigger className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2">
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover className="bg-[#1a1a2e] border border-white/10 rounded-xl">
                        <ListBox>
                          <ListBox.Item id="draft">下書き</ListBox.Item>
                          <ListBox.Item id="published">公開</ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>
                </div>
                <div>
                  <label htmlFor="announcement-published-at" className="text-sm text-gray-300 block mb-2">公開日時</label>
                  <input
                    id="announcement-published-at"
                    type="datetime-local"
                    value={form.publishedAt}
                    onChange={(event) => setForm((current) => ({ ...current, publishedAt: event.target.value }))}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500/50"
                  />
                  <p className="text-xs text-gray-500 mt-1">公開状態にすると、この日時以降にサイトへ表示されます。</p>
                </div>
                {formError && <p className="text-sm text-red-300">{formError}</p>}
              </Modal.Body>
              <Modal.Footer className="border-t border-white/5">
                <Button variant="secondary" onPress={() => setEditorOpen(false)}>キャンセル</Button>
                <Button variant="primary" isPending={saving} onPress={() => void handleSave()}>{editingId ? '保存' : '作成'}</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal>
        <Modal.Backdrop isOpen={deleteOpen} onOpenChange={setDeleteOpen}>
          <Modal.Container>
            <Modal.Dialog className="bg-[#1a1a2e] border border-white/10">
              <Modal.Header><Modal.Heading className="text-white">削除の確認</Modal.Heading></Modal.Header>
              <Modal.Body>
                <p className="text-gray-300">「{deleteTarget?.title}」を削除しますか？この操作は元に戻せません。</p>
              </Modal.Body>
              <Modal.Footer className="border-t border-white/5">
                <Button variant="secondary" onPress={() => setDeleteOpen(false)}>キャンセル</Button>
                <Button variant="danger" isPending={deleting} onPress={() => void handleDelete()}>削除</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Toast state={toastState} />
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { Button, Modal, TextField, Label, Input, Spinner } from '@heroui/react';
import { api } from '../lib/api';
import { useToast, Toast } from '../components/toast';

interface DictItem {
  word: string;
  reading: string;
  registeredBy: string;
  createdAt: string;
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

export function AdminDictionaryPage() {
  const [items, setItems] = useState<DictItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const { toastState, showSaving, showSuccess, showError } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [addWord, setAddWord] = useState('');
  const [addReading, setAddReading] = useState('');
  const [editTarget, setEditTarget] = useState<DictItem | null>(null);
  const [editReading, setEditReading] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchItems = useCallback((p: number) => {
    setLoading(true);
    api.get<PaginatedResponse<DictItem>>(`/api/admin/dictionary/global?page=${p}&perPage=${PER_PAGE}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchItems(page);
  }, [page, fetchItems]);

  const handleAdd = () => {
    setSubmitting(true);
    showSaving();
    api.post('/api/admin/dictionary/global', { word: addWord, reading: addReading })
      .then(() => {
        setAddWord('');
        setAddReading('');
        setAddOpen(false);
        fetchItems(page);
        showSuccess();
      })
      .catch(() => showError())
      .finally(() => setSubmitting(false));
  };

  const handleEdit = () => {
    if (!editTarget) return;
    setSubmitting(true);
    showSaving();
    api.put(`/api/admin/dictionary/global/${encodeURIComponent(editTarget.word)}`, { reading: editReading })
      .then(() => {
        setEditOpen(false);
        fetchItems(page);
        showSuccess();
      })
      .catch(() => showError())
      .finally(() => setSubmitting(false));
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    showSaving();
    api.delete(`/api/admin/dictionary/global/${encodeURIComponent(deleteTarget)}`)
      .then(() => {
        setDeleteOpen(false);
        fetchItems(page);
        showSuccess('削除しました');
      })
      .catch(() => showError())
      .finally(() => setSubmitting(false));
  };

  const openEdit = (item: DictItem) => {
    setEditTarget(item);
    setEditReading(item.reading);
    setEditOpen(true);
  };

  const openDelete = (word: string) => {
    setDeleteTarget(word);
    setDeleteOpen(true);
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">グローバル辞書</h1>
        <Button variant="primary" size="sm" onPress={() => setAddOpen(true)}>追加</Button>
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">登録者</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">辞書エントリがありません</td>
                    </tr>
                  ) : items.map((item) => (
                    <tr key={item.word} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-white">{item.word}</td>
                      <td className="px-4 py-3 text-gray-300">{item.reading}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500">{item.registeredBy}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onPress={() => openEdit(item)}>編集</Button>
                          <Button size="sm" variant="danger" onPress={() => openDelete(item.word)}>削除</Button>
                        </div>
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

      {/* 追加モーダル */}
      <Modal>
        <Modal.Backdrop isOpen={addOpen} onOpenChange={setAddOpen}>
          <Modal.Container>
            <Modal.Dialog className="bg-[#1a1a2e] border border-white/10">
              <Modal.Header>
                <Modal.Heading className="text-white">辞書エントリを追加</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-4">
                <TextField value={addWord} onChange={setAddWord}>
                  <Label className="text-sm text-gray-300">単語</Label>
                  <Input
                    className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50"
                  />
                </TextField>
                <TextField value={addReading} onChange={setAddReading}>
                  <Label className="text-sm text-gray-300">読み（ひらがな・カタカナ）</Label>
                  <Input
                    className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50"
                  />
                </TextField>
              </Modal.Body>
              <Modal.Footer className="border-t border-white/5">
                <Button variant="secondary" onPress={() => setAddOpen(false)}>キャンセル</Button>
                <Button variant="primary" isPending={submitting} onPress={handleAdd}>追加</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* 編集モーダル */}
      <Modal>
        <Modal.Backdrop isOpen={editOpen} onOpenChange={setEditOpen}>
          <Modal.Container>
            <Modal.Dialog className="bg-[#1a1a2e] border border-white/10">
              <Modal.Header>
                <Modal.Heading className="text-white">読みを編集: {editTarget?.word}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <TextField value={editReading} onChange={setEditReading}>
                  <Label className="text-sm text-gray-300">読み（ひらがな・カタカナ）</Label>
                  <Input
                    className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50"
                  />
                </TextField>
              </Modal.Body>
              <Modal.Footer className="border-t border-white/5">
                <Button variant="secondary" onPress={() => setEditOpen(false)}>キャンセル</Button>
                <Button variant="primary" isPending={submitting} onPress={handleEdit}>保存</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* 削除確認モーダル */}
      <Modal>
        <Modal.Backdrop isOpen={deleteOpen} onOpenChange={setDeleteOpen}>
          <Modal.Container>
            <Modal.Dialog className="bg-[#1a1a2e] border border-white/10">
              <Modal.Header>
                <Modal.Heading className="text-white">削除の確認</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-gray-300">「{deleteTarget}」を辞書から削除しますか？この操作は元に戻せません。</p>
              </Modal.Body>
              <Modal.Footer className="border-t border-white/5">
                <Button variant="secondary" onPress={() => setDeleteOpen(false)}>キャンセル</Button>
                <Button variant="danger" isPending={submitting} onPress={handleDelete}>削除</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Toast state={toastState} />
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import {
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Pagination, Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Input, Spinner, useDisclosure,
} from '@heroui/react';
import { api } from '../lib/api';

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

export function AdminDictionaryPage() {
  const [items, setItems] = useState<DictItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const addModal = useDisclosure();
  const editModal = useDisclosure();
  const deleteModal = useDisclosure();

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
    api.post('/api/admin/dictionary/global', { word: addWord, reading: addReading })
      .then(() => {
        setAddWord('');
        setAddReading('');
        addModal.onClose();
        fetchItems(page);
      })
      .catch(() => {})
      .finally(() => setSubmitting(false));
  };

  const handleEdit = () => {
    if (!editTarget) return;
    setSubmitting(true);
    api.put(`/api/admin/dictionary/global/${encodeURIComponent(editTarget.word)}`, { reading: editReading })
      .then(() => {
        editModal.onClose();
        fetchItems(page);
      })
      .catch(() => {})
      .finally(() => setSubmitting(false));
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    api.delete(`/api/admin/dictionary/global/${encodeURIComponent(deleteTarget)}`)
      .then(() => {
        deleteModal.onClose();
        fetchItems(page);
      })
      .catch(() => {})
      .finally(() => setSubmitting(false));
  };

  const openEdit = (item: DictItem) => {
    setEditTarget(item);
    setEditReading(item.reading);
    editModal.onOpen();
  };

  const openDelete = (word: string) => {
    setDeleteTarget(word);
    deleteModal.onOpen();
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">グローバル辞書</h1>
        <Button color="primary" size="sm" onPress={addModal.onOpen}>追加</Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center min-h-[40vh]">
          <Spinner size="lg" color="primary" />
        </div>
      ) : (
        <Table aria-label="グローバル辞書" bottomContent={
          totalPages > 1 ? (
            <div className="flex justify-center">
              <Pagination total={totalPages} page={page} onChange={setPage} color="primary" />
            </div>
          ) : undefined
        }>
          <TableHeader>
            <TableColumn>単語</TableColumn>
            <TableColumn>読み</TableColumn>
            <TableColumn>登録者</TableColumn>
            <TableColumn>操作</TableColumn>
          </TableHeader>
          <TableBody emptyContent="辞書エントリがありません">
            {items.map((item) => (
              <TableRow key={item.word}>
                <TableCell>{item.word}</TableCell>
                <TableCell>{item.reading}</TableCell>
                <TableCell><span className="text-sm text-default-500">{item.registeredBy}</span></TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" variant="flat" onPress={() => openEdit(item)}>編集</Button>
                    <Button size="sm" variant="flat" color="danger" onPress={() => openDelete(item.word)}>削除</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* 追加モーダル */}
      <Modal isOpen={addModal.isOpen} onOpenChange={addModal.onOpenChange}>
        <ModalContent>
          <ModalHeader>辞書エントリを追加</ModalHeader>
          <ModalBody>
            <Input label="単語" value={addWord} onValueChange={setAddWord} />
            <Input label="読み (ひらがな・カタカナ)" value={addReading} onValueChange={setAddReading} />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={addModal.onClose}>キャンセル</Button>
            <Button color="primary" isLoading={submitting} onPress={handleAdd}>追加</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 編集モーダル */}
      <Modal isOpen={editModal.isOpen} onOpenChange={editModal.onOpenChange}>
        <ModalContent>
          <ModalHeader>読みを編集: {editTarget?.word}</ModalHeader>
          <ModalBody>
            <Input label="読み (ひらがな・カタカナ)" value={editReading} onValueChange={setEditReading} />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={editModal.onClose}>キャンセル</Button>
            <Button color="primary" isLoading={submitting} onPress={handleEdit}>保存</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 削除確認モーダル */}
      <Modal isOpen={deleteModal.isOpen} onOpenChange={deleteModal.onOpenChange}>
        <ModalContent>
          <ModalHeader>削除の確認</ModalHeader>
          <ModalBody>
            <p>「{deleteTarget}」を辞書から削除しますか？この操作は元に戻せません。</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={deleteModal.onClose}>キャンセル</Button>
            <Button color="danger" isLoading={submitting} onPress={handleDelete}>削除</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

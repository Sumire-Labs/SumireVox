import { useState, useEffect, useCallback } from 'react';
import {
  Card, CardBody, CardHeader, Button, Input, Spinner, Pagination,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  useDisclosure, Tabs, Tab, Chip,
} from '@heroui/react';
import { useParams } from 'react-router';
import { api, ApiError } from '../../lib/api';

interface DictEntry {
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

const PER_PAGE = 10;

export function ServerDictionaryPage() {
  const { guildId } = useParams<{ guildId: string }>();

  // Server dictionary state
  const [serverEntries, setServerEntries] = useState<DictEntry[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverPage, setServerPage] = useState(1);
  const [serverLoading, setServerLoading] = useState(true);

  // Global dictionary state
  const [globalEntries, setGlobalEntries] = useState<DictEntry[]>([]);
  const [globalTotal, setGlobalTotal] = useState(0);
  const [globalPage, setGlobalPage] = useState(1);
  const [globalLoading, setGlobalLoading] = useState(false);

  // Add modal state
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [newWord, setNewWord] = useState('');
  const [newReading, setNewReading] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  const fetchServerDict = useCallback(async (page: number) => {
    if (!guildId) return;
    setServerLoading(true);
    try {
      const data = await api.get<PaginatedResponse<DictEntry>>(
        `/api/guilds/${guildId}/dictionary?page=${page}&perPage=${PER_PAGE}`
      );
      setServerEntries(data.items);
      setServerTotal(data.total);
    } catch {
      // ignore
    } finally {
      setServerLoading(false);
    }
  }, [guildId]);

  const fetchGlobalDict = useCallback(async (page: number) => {
    setGlobalLoading(true);
    try {
      const data = await api.get<PaginatedResponse<DictEntry>>(
        `/api/dictionary/global?page=${page}&perPage=${PER_PAGE}`
      );
      setGlobalEntries(data.items);
      setGlobalTotal(data.total);
    } catch {
      // ignore
    } finally {
      setGlobalLoading(false);
    }
  }, []);

  useEffect(() => { fetchServerDict(serverPage); }, [fetchServerDict, serverPage]);

  const handleTabChange = (key: React.Key) => {
    if (key === 'global' && globalEntries.length === 0) {
      fetchGlobalDict(globalPage);
    }
  };

  const handleAdd = async () => {
    if (!guildId) return;
    setAddError(null);
    setAddLoading(true);
    try {
      await api.post(`/api/guilds/${guildId}/dictionary`, { word: newWord, reading: newReading });
      setNewWord('');
      setNewReading('');
      onClose();
      await fetchServerDict(serverPage);
    } catch (err) {
      if (err instanceof ApiError) setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  const confirmDelete = (word: string) => {
    setDeleteTarget(word);
    onDeleteOpen();
  };

  const handleDelete = async () => {
    if (!guildId || !deleteTarget) return;
    setDeleteLoading(true);
    setError(null);
    try {
      await api.delete(`/api/guilds/${guildId}/dictionary/${encodeURIComponent(deleteTarget)}`);
      onDeleteClose();
      setDeleteTarget(null);
      await fetchServerDict(serverPage);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const serverPageCount = Math.ceil(serverTotal / PER_PAGE);
  const globalPageCount = Math.ceil(globalTotal / PER_PAGE);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">辞書管理</h1>

      {error && (
        <Card className="bg-danger-50 border-danger">
          <CardBody><p className="text-danger">{error}</p></CardBody>
        </Card>
      )}

      <Tabs onSelectionChange={handleTabChange}>
        <Tab key="server" title="サーバー辞書">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <span className="font-semibold">
                サーバー辞書
                <Chip size="sm" className="ml-2">{serverTotal}件</Chip>
              </span>
              <Button color="primary" size="sm" onPress={onOpen}>追加</Button>
            </CardHeader>
            <CardBody>
              {serverLoading ? (
                <Spinner size="md" color="primary" className="mx-auto" />
              ) : serverEntries.length === 0 ? (
                <p className="text-default-500 text-center py-4">辞書エントリがありません。</p>
              ) : (
                <div className="space-y-2">
                  {serverEntries.map((entry) => (
                    <div
                      key={entry.word}
                      className="flex items-center justify-between p-3 rounded-lg bg-content2"
                    >
                      <div>
                        <span className="font-medium">{entry.word}</span>
                        <span className="text-default-500 mx-2">→</span>
                        <span>{entry.reading}</span>
                      </div>
                      <Button
                        size="sm"
                        color="danger"
                        variant="flat"
                        onPress={() => confirmDelete(entry.word)}
                      >
                        削除
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {serverPageCount > 1 && (
                <div className="flex justify-center mt-4">
                  <Pagination
                    total={serverPageCount}
                    page={serverPage}
                    onChange={(p) => setServerPage(p)}
                  />
                </div>
              )}
            </CardBody>
          </Card>
        </Tab>

        <Tab key="global" title="グローバル辞書（閲覧のみ）">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <span className="font-semibold">
                グローバル辞書
                <Chip size="sm" className="ml-2">{globalTotal}件</Chip>
              </span>
            </CardHeader>
            <CardBody>
              {globalLoading ? (
                <Spinner size="md" color="primary" className="mx-auto" />
              ) : globalEntries.length === 0 ? (
                <p className="text-default-500 text-center py-4">辞書エントリがありません。</p>
              ) : (
                <div className="space-y-2">
                  {globalEntries.map((entry) => (
                    <div
                      key={entry.word}
                      className="flex items-center p-3 rounded-lg bg-content2"
                    >
                      <span className="font-medium">{entry.word}</span>
                      <span className="text-default-500 mx-2">→</span>
                      <span>{entry.reading}</span>
                    </div>
                  ))}
                </div>
              )}
              {globalPageCount > 1 && (
                <div className="flex justify-center mt-4">
                  <Pagination
                    total={globalPageCount}
                    page={globalPage}
                    onChange={(p) => {
                      setGlobalPage(p);
                      fetchGlobalDict(p);
                    }}
                  />
                </div>
              )}
            </CardBody>
          </Card>
        </Tab>
      </Tabs>

      {/* 追加 Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>辞書エントリを追加</ModalHeader>
          <ModalBody className="space-y-4">
            {addError && <p className="text-danger text-sm">{addError}</p>}
            <Input
              label="単語"
              placeholder="例: VOICEVOX"
              value={newWord}
              onValueChange={setNewWord}
              maxLength={50}
            />
            <Input
              label="読み（ひらがな・カタカナ）"
              placeholder="例: ボイスボックス"
              value={newReading}
              onValueChange={setNewReading}
              maxLength={100}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>キャンセル</Button>
            <Button
              color="primary"
              onPress={handleAdd}
              isLoading={addLoading}
              isDisabled={!newWord.trim() || !newReading.trim()}
            >
              追加
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 削除確認 Modal */}
      <Modal isOpen={isDeleteOpen} onClose={onDeleteClose}>
        <ModalContent>
          <ModalHeader>削除の確認</ModalHeader>
          <ModalBody>
            <p>「{deleteTarget}」を辞書から削除しますか？この操作は取り消せません。</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onDeleteClose}>キャンセル</Button>
            <Button color="danger" onPress={handleDelete} isLoading={deleteLoading}>
              削除する
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

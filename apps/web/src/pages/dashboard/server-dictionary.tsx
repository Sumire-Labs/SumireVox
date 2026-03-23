import { useState, useEffect, useCallback } from 'react';
import {
  Button, Input, Pagination,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  useDisclosure, Tabs, Tab,
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

  const [serverEntries, setServerEntries] = useState<DictEntry[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverPage, setServerPage] = useState(1);
  const [serverLoading, setServerLoading] = useState(true);

  const [globalEntries, setGlobalEntries] = useState<DictEntry[]>([]);
  const [globalTotal, setGlobalTotal] = useState(0);
  const [globalPage, setGlobalPage] = useState(1);
  const [globalLoading, setGlobalLoading] = useState(false);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const [newWord, setNewWord] = useState('');
  const [newReading, setNewReading] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const [deleteLoading, setDeleteLoading] = useState(false);

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
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">辞書管理</h1>
        <p className="text-gray-400">単語の読み方を登録して正しく読み上げさせます</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <Tabs
        onSelectionChange={handleTabChange}
        classNames={{
          tabList: 'bg-white/5 border border-white/5',
          tab: 'text-gray-400 data-[selected=true]:text-white',
          cursor: 'bg-purple-600/40',
        }}
      >
        <Tab key="server" title="サーバー辞書">
          <div className="bg-[#12121a] border border-white/5 rounded-2xl overflow-hidden mt-2">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">サーバー辞書</span>
                <span className="text-xs bg-white/10 text-gray-400 px-2 py-0.5 rounded-full">{serverTotal}件</span>
              </div>
              <button
                onClick={onOpen}
                className="gradient-bg text-white px-4 py-1.5 rounded-xl text-sm font-medium transition-all hover:opacity-90"
              >
                追加
              </button>
            </div>
            <div className="p-4">
              {serverLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : serverEntries.length === 0 ? (
                <p className="text-gray-500 text-center py-8">辞書エントリがありません。</p>
              ) : (
                <div className="flex flex-col">
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-4 px-4 py-2 text-xs text-gray-500 uppercase tracking-wide border-b border-white/5">
                    <span>単語</span>
                    <span>読み</span>
                    <span />
                  </div>
                  {serverEntries.map((entry) => (
                    <div
                      key={entry.word}
                      className="grid grid-cols-[1fr_1fr_auto] gap-4 items-center px-4 py-3 border-b border-white/5 last:border-0"
                    >
                      <span className="text-white font-medium">{entry.word}</span>
                      <span className="text-gray-400">{entry.reading}</span>
                      <button
                        onClick={() => confirmDelete(entry.word)}
                        className="text-xs bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30 px-3 py-1 rounded-lg transition-all"
                      >
                        削除
                      </button>
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
                    classNames={{ cursor: 'bg-purple-600' }}
                  />
                </div>
              )}
            </div>
          </div>
        </Tab>

        <Tab key="global" title="グローバル辞書（閲覧のみ）">
          <div className="bg-[#12121a] border border-white/5 rounded-2xl overflow-hidden mt-2">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-white/5">
              <span className="font-semibold text-white">グローバル辞書</span>
              <span className="text-xs bg-white/10 text-gray-400 px-2 py-0.5 rounded-full">{globalTotal}件</span>
            </div>
            <div className="p-4">
              {globalLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : globalEntries.length === 0 ? (
                <p className="text-gray-500 text-center py-8">辞書エントリがありません。</p>
              ) : (
                <div className="flex flex-col">
                  <div className="grid grid-cols-2 gap-4 px-4 py-2 text-xs text-gray-500 uppercase tracking-wide border-b border-white/5">
                    <span>単語</span>
                    <span>読み</span>
                  </div>
                  {globalEntries.map((entry) => (
                    <div
                      key={entry.word}
                      className="grid grid-cols-2 gap-4 px-4 py-3 border-b border-white/5 last:border-0"
                    >
                      <span className="text-white font-medium">{entry.word}</span>
                      <span className="text-gray-400">{entry.reading}</span>
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
                    classNames={{ cursor: 'bg-purple-600' }}
                  />
                </div>
              )}
            </div>
          </div>
        </Tab>
      </Tabs>

      {/* 追加 Modal */}
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        classNames={{
          base: 'bg-[#1a1a2e] border border-white/10',
          header: 'text-white',
          body: 'text-gray-300',
          footer: 'border-t border-white/5',
        }}
      >
        <ModalContent>
          <ModalHeader>辞書エントリを追加</ModalHeader>
          <ModalBody className="space-y-4">
            {addError && <p className="text-red-400 text-sm">{addError}</p>}
            <Input
              label="単語"
              placeholder="例: VOICEVOX"
              value={newWord}
              onValueChange={setNewWord}
              maxLength={50}
              classNames={{ inputWrapper: 'bg-white/5 border-white/10' }}
            />
            <Input
              label="読み（ひらがな・カタカナ）"
              placeholder="例: ボイスボックス"
              value={newReading}
              onValueChange={setNewReading}
              maxLength={100}
              classNames={{ inputWrapper: 'bg-white/5 border-white/10' }}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose} className="border border-white/20 bg-white/5 text-white">キャンセル</Button>
            <Button
              className="gradient-bg text-white"
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
      <Modal
        isOpen={isDeleteOpen}
        onClose={onDeleteClose}
        classNames={{
          base: 'bg-[#1a1a2e] border border-white/10',
          header: 'text-white',
          body: 'text-gray-300',
          footer: 'border-t border-white/5',
        }}
      >
        <ModalContent>
          <ModalHeader>削除の確認</ModalHeader>
          <ModalBody>
            <p>「{deleteTarget}」を辞書から削除しますか？この操作は取り消せません。</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onDeleteClose} className="border border-white/20 bg-white/5 text-white">キャンセル</Button>
            <Button
              className="bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30"
              onPress={handleDelete}
              isLoading={deleteLoading}
            >
              削除する
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

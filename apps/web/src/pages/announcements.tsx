import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, ArrowRight, Info, Sparkles, Wrench } from 'lucide-react';
import { Spinner } from '@heroui/react';
import { api, ApiError } from '../lib/api';
import { getMarkdownExcerpt } from '../lib/markdown-excerpt';

type AnnouncementType = 'info' | 'update' | 'maintenance' | 'important';

interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  type: AnnouncementType;
  publishedAt: string | null;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
}

const TYPE_LABELS: Record<AnnouncementType, string> = {
  info: '通常',
  update: 'アップデート',
  maintenance: 'メンテナンス',
  important: '重要',
};

const TYPE_STYLES: Record<AnnouncementType, string> = {
  info: 'border-white/10 bg-white/5 text-gray-300',
  update: 'border-blue-400/20 bg-blue-400/10 text-blue-300',
  maintenance: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  important: 'border-red-400/30 bg-red-400/10 text-red-300',
};

function TypeIcon({ type, size = 15 }: { type: AnnouncementType; size?: number }) {
  if (type === 'update') return <Sparkles size={size} />;
  if (type === 'maintenance') return <Wrench size={size} />;
  if (type === 'important') return <AlertTriangle size={size} />;
  return <Info size={size} />;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(value));
}

function getExcerpt(body: string): string {
  return getMarkdownExcerpt(body);
}

function AnnouncementTypeTag({ type }: { type: AnnouncementType }) {
  return (
    <span className={`inline-flex items-center gap-1.5 border rounded-full px-2.5 py-1 text-xs font-medium ${TYPE_STYLES[type]}`}>
      <TypeIcon type={type} />
      {TYPE_LABELS[type]}
    </span>
  );
}

function SimplePagination({ page, total, onChange }: { page: number; total: number; onChange: (nextPage: number) => void }) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-4 pt-8">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="px-4 py-2 text-sm border border-white/10 rounded-lg text-gray-400 hover:text-white hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        ← 前へ
      </button>
      <span className="text-sm text-gray-500">{page} / {total}</span>
      <button
        type="button"
        disabled={page >= total}
        onClick={() => onChange(page + 1)}
        className="px-4 py-2 text-sm border border-white/10 rounded-lg text-gray-400 hover:text-white hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        次へ →
      </button>
    </div>
  );
}

export function AnnouncementsPage() {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<PaginatedResponse<AnnouncementItem>>(
        `/api/announcements?page=${nextPage}&perPage=20`,
      );
      setItems(response.items);
      setTotal(response.total);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'お知らせの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchItems(page);
  }, [fetchItems, page]);

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <section className="relative min-h-[calc(100vh-4rem)] px-4 py-16 md:px-8 md:py-24 overflow-hidden">
      <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full pointer-events-none bg-purple-500/10 blur-[100px]" />
      <div className="relative max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors mb-8">
          ← ホームへ戻る
        </Link>
        <div className="mb-10">
          <p className="text-sm tracking-[0.25em] uppercase text-purple-300 font-medium mb-3">News & Updates</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white">お知らせ</h1>
          <p className="text-gray-400 mt-4">SumireVox の最新情報をお届けします。</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center min-h-64">
            <Spinner size="lg" className="text-purple-500" />
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center">
            <p className="text-red-300 mb-4">{error}</p>
            <button
              type="button"
              onClick={() => void fetchItems(page)}
              className="text-sm text-white border border-white/20 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg transition-colors"
            >
              再読み込み
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-[#12121a] border border-white/5 rounded-2xl p-12 text-center">
            <Info className="mx-auto text-gray-600 mb-4" size={30} />
            <p className="text-gray-400">現在公開されているお知らせはありません。</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              {items.map((item, index) => (
                <Link
                  key={item.id}
                  to={`/announcements/${item.id}`}
                  className={`group block rounded-2xl border p-5 md:p-6 transition-all hover:-translate-y-0.5 hover:border-purple-400/30 hover:bg-white/[0.04] ${
                    item.type === 'important' ? 'border-red-400/25 bg-red-400/[0.04]' : 'border-white/10 bg-[#12121a]'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <AnnouncementTypeTag type={item.type} />
                    {index === 0 && <span className="text-[11px] tracking-wider uppercase text-purple-300 font-semibold">New</span>}
                    <time dateTime={item.publishedAt ?? undefined} className="text-xs text-gray-500 ml-auto">{formatDate(item.publishedAt)}</time>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg md:text-xl font-semibold text-white group-hover:text-purple-200 transition-colors">{item.title}</h2>
                      <p className="text-sm leading-7 text-gray-400 mt-3">{getExcerpt(item.body)}</p>
                    </div>
                    <ArrowRight className="mt-1 shrink-0 text-gray-600 group-hover:text-purple-300 group-hover:translate-x-1 transition-all" size={20} />
                  </div>
                </Link>
              ))}
            </div>
            <SimplePagination page={page} total={totalPages} onChange={setPage} />
          </>
        )}
      </div>
    </section>
  );
}

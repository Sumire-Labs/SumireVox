import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { AlertTriangle, Info, Sparkles, Wrench } from 'lucide-react';
import { Spinner } from '@heroui/react';
import { api, ApiError } from '../lib/api';

type AnnouncementType = 'info' | 'update' | 'maintenance' | 'important';

interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  type: AnnouncementType;
  publishedAt: string | null;
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

function TypeIcon({ type }: { type: AnnouncementType }) {
  if (type === 'update') return <Sparkles size={16} />;
  if (type === 'maintenance') return <Wrench size={16} />;
  if (type === 'important') return <AlertTriangle size={16} />;
  return <Info size={16} />;
}

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

export function AnnouncementDetailPage() {
  const { id } = useParams();
  const [item, setItem] = useState<AnnouncementItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('お知らせが見つかりません。');
      setLoading(false);
      return;
    }
    api.get<AnnouncementItem>(`/api/announcements/${id}`)
      .then(setItem)
      .catch((requestError) => setError(requestError instanceof ApiError ? requestError.message : 'お知らせの取得に失敗しました。'))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <section className="relative min-h-[calc(100vh-4rem)] px-4 py-16 md:px-8 md:py-24 overflow-hidden">
      <div className="absolute top-0 left-1/3 w-96 h-96 rounded-full pointer-events-none bg-blue-500/10 blur-[100px]" />
      <div className="relative max-w-3xl mx-auto">
        <Link to="/announcements" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors mb-8">
          ← お知らせ一覧へ戻る
        </Link>
        {loading ? (
          <div className="flex justify-center items-center min-h-64">
            <Spinner size="lg" className="text-purple-500" />
          </div>
        ) : error || !item ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center">
            <p className="text-red-300">{error ?? 'お知らせが見つかりません。'}</p>
          </div>
        ) : (
          <article className={`rounded-3xl border p-6 md:p-10 ${item.type === 'important' ? 'border-red-400/30 bg-red-400/[0.04]' : 'border-white/10 bg-[#12121a]'}`}>
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className={`inline-flex items-center gap-2 border rounded-full px-3 py-1.5 text-xs font-medium ${TYPE_STYLES[item.type]}`}>
                <TypeIcon type={item.type} />
                {TYPE_LABELS[item.type]}
              </span>
              <time dateTime={item.publishedAt ?? undefined} className="text-sm text-gray-500">{formatDate(item.publishedAt)}</time>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight text-white">{item.title}</h1>
            <div className="border-t border-white/10 my-8" />
            <p className="text-gray-300 leading-8 whitespace-pre-wrap break-words">{item.body}</p>
          </article>
        )}
      </div>
    </section>
  );
}

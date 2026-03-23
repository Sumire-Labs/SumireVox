import { useState, useEffect, type ReactNode } from 'react';
import { Spinner } from '@heroui/react';
import { useAuth } from '../lib/auth-context';
import { api, ApiError } from '../lib/api';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [adminChecked, setAdminChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (loading || !user) return;

    api.get('/api/admin/servers')
      .then(() => setIsAdmin(true))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.code === 'FORBIDDEN') {
          setIsAdmin(false);
        } else {
          setIsAdmin(false);
        }
      })
      .finally(() => setAdminChecked(true));
  }, [loading, user]);

  if (loading || (user && !adminChecked)) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen gap-4">
        <p className="text-lg text-default-500">ログインが必要です</p>
        <a href="/auth/login" className="text-primary hover:underline">
          Discord でログイン
        </a>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen gap-2">
        <p className="text-lg font-semibold">管理者権限がありません</p>
        <p className="text-default-500 text-sm">このページは Bot 管理者のみアクセスできます。</p>
      </div>
    );
  }

  return <>{children}</>;
}

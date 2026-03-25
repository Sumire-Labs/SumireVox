import { Outlet, Link, useLocation } from 'react-router';
import { useAuth } from '../lib/auth-context';

const navItems = [
  { path: '/', label: '概要' },
  { path: '/servers', label: 'サーバー一覧' },
  { path: '/dictionary', label: 'グローバル辞書' },
  { path: '/requests', label: '申請管理' },
  { path: '/bot-instances', label: 'Bot インスタンス' },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b border-white/10 bg-[#0a0a0f]">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl text-purple-400">SumireVox</span>
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Admin</span>
            </div>
            <div className="hidden sm:flex items-center gap-4">
              {navItems.map((item) => {
                const isActive = item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`text-sm transition-colors ${
                      isActive ? 'text-purple-400 font-medium' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">{user?.username}</span>
            <button
              onClick={logout}
              className="text-sm border border-white/20 bg-white/5 hover:bg-white/10 text-white px-4 py-1.5 rounded-lg transition-all"
            >
              ログアウト
            </button>
          </div>
        </div>
      </nav>
      <main className="flex-1 container mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

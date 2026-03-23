import { Outlet, Link, useLocation } from 'react-router';
import { useAuth } from '../lib/auth-context';

const navItems = [
  { path: '/dashboard', label: 'マイページ' },
  { path: '/dashboard/boost', label: 'ブースト管理' },
  { path: '/dashboard/servers', label: 'サーバー管理' },
];

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="font-bold text-lg gradient-text">SumireVox</Link>
            <nav className="hidden sm:flex items-center gap-6">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`text-sm transition-colors ${
                    location.pathname === item.path
                      ? 'text-white font-medium'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
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
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 pt-24">
        <Outlet />
      </main>
    </div>
  );
}

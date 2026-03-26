import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import { Menu, X, ExternalLink } from 'lucide-react';
import { useAuth } from '../lib/auth-context';

const NAV_LINKS = [
  { to: '/', label: 'ホーム' },
  { to: '/commands', label: 'コマンド' },
  { to: '/credits', label: 'クレジット' },
];

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      {/* Navbar */}
      <nav
        className={`fixed top-0 w-full z-50 border-b transition-all duration-300 ${
          scrolled
            ? 'bg-[#0a0a0f]/95 backdrop-blur-xl border-white/10'
            : 'bg-[#0a0a0f]/80 backdrop-blur-xl border-white/5'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="text-xl font-bold gradient-text shrink-0">
            SumireVox
          </Link>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`text-sm transition-colors ${
                  location.pathname === link.to
                    ? 'text-white border-b border-purple-500 pb-0.5'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth area + mobile toggle */}
          <div className="flex items-center gap-3">
            {!loading && (
              user ? (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="hidden sm:flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  {user.avatar ? (
                    <img
                      src={`https://cdn.discordapp.com/avatars/${user.userId}/${user.avatar}.png?size=64`}
                      alt={user.username}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="bg-purple-600 rounded-full w-8 h-8 flex items-center justify-center text-white text-sm">
                      {user.username.charAt(0)}
                    </span>
                  )}
                  <span className="text-sm text-gray-300">{user.username}</span>
                </button>
              ) : (
                <a
                  href="/auth/login"
                  className="gradient-bg text-white text-sm font-medium px-5 py-2 rounded-lg transition-all hover:opacity-90 hidden sm:block"
                >
                  ログイン
                </a>
              )
            )}
            <button
              className="sm:hidden text-gray-400 hover:text-white p-1"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="メニュー"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="sm:hidden bg-[#0a0a0f]/98 backdrop-blur-xl border-t border-white/5 px-4 py-4 flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`text-sm py-2 ${
                  location.pathname === link.to ? 'text-white font-medium' : 'text-gray-400'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {!loading && (
              user ? (
                <button
                  onClick={() => { setMenuOpen(false); navigate('/dashboard'); }}
                  className="flex items-center gap-2 py-2"
                >
                  {user.avatar ? (
                    <img
                      src={`https://cdn.discordapp.com/avatars/${user.userId}/${user.avatar}.png?size=64`}
                      alt={user.username}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="bg-purple-600 rounded-full w-8 h-8 flex items-center justify-center text-white text-sm">
                      {user.username.charAt(0)}
                    </span>
                  )}
                  <span className="text-sm text-gray-300">{user.username}</span>
                </button>
              ) : (
                <a
                  href="/auth/login"
                  className="gradient-bg text-white text-sm font-medium px-5 py-2 rounded-lg text-center"
                >
                  ログイン
                </a>
              )
            )}
          </div>
        )}
      </nav>

      {/* Page content */}
      <main className="flex-1 pt-16">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#0a0a0f]">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-12 grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <span className="text-lg font-bold gradient-text">SumireVox</span>
            <p className="text-sm text-gray-500 leading-relaxed">
              VOICEVOX エンジンを使った Discord 読み上げ Bot
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">リンク</p>
            <div className="flex flex-col gap-2">
              <Link to="/terms" className="text-sm text-gray-500 hover:text-white transition-colors">利用規約</Link>
              <Link to="/privacy" className="text-sm text-gray-500 hover:text-white transition-colors">プライバシーポリシー</Link>
              <Link to="/legal" className="text-sm text-gray-500 hover:text-white transition-colors">特定商取引法に基づく表記</Link>
              <Link to="/credits" className="text-sm text-gray-500 hover:text-white transition-colors">クレジット</Link>
            </div>
          </div>

          {/* External */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">外部リンク</p>
            <div className="flex flex-col gap-2">
              <a
                href="#"
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors"
              >
                <ExternalLink size={13} />
                Discord サポートサーバー
              </a>
              <a
                href="https://voicevox.hiroshiba.jp/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors"
              >
                <ExternalLink size={13} />
                VOICEVOX 公式
              </a>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 md:px-8 pb-6 border-t border-white/5 pt-6">
          <p className="text-xs text-gray-600">© 2025 SumireVox</p>
        </div>
      </footer>
    </div>
  );
}

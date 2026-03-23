import { Outlet, Link, useLocation } from 'react-router';
import { Navbar, NavbarBrand, NavbarContent, NavbarItem, Button } from '@heroui/react';
import { useAuth } from '../lib/auth-context';

const navItems = [
  { path: '/', label: '概要' },
  { path: '/servers', label: 'サーバー一覧' },
  { path: '/dictionary', label: 'グローバル辞書' },
  { path: '/requests', label: '申請管理' },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar maxWidth="xl" isBordered>
        <NavbarBrand>
          <span className="font-bold text-xl text-primary">SumireVox</span>
          <span className="ml-2 text-xs text-default-400 font-medium uppercase tracking-wider">Admin</span>
        </NavbarBrand>
        <NavbarContent className="hidden sm:flex gap-4" justify="center">
          {navItems.map((item) => {
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
            return (
              <NavbarItem key={item.path} isActive={isActive}>
                <Link
                  to={item.path}
                  className={`transition-colors ${
                    isActive ? 'text-primary font-semibold' : 'text-foreground hover:text-primary'
                  }`}
                >
                  {item.label}
                </Link>
              </NavbarItem>
            );
          })}
        </NavbarContent>
        <NavbarContent justify="end">
          <NavbarItem>
            <span className="text-sm text-default-500 mr-2">{user?.username}</span>
            <Button size="sm" variant="flat" onPress={logout}>ログアウト</Button>
          </NavbarItem>
        </NavbarContent>
      </Navbar>
      <main className="flex-1 container mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

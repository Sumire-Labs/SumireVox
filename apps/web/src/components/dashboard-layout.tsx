import { Outlet, Link, useLocation } from 'react-router';
import { Navbar, NavbarBrand, NavbarContent, NavbarItem, Button } from '@heroui/react';
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
    <div className="min-h-screen flex flex-col">
      <Navbar maxWidth="xl" isBordered>
        <NavbarBrand>
          <Link to="/" className="font-bold text-xl text-primary">SumireVox</Link>
        </NavbarBrand>
        <NavbarContent className="hidden sm:flex gap-4" justify="center">
          {navItems.map((item) => (
            <NavbarItem key={item.path} isActive={location.pathname === item.path}>
              <Link
                to={item.path}
                className={`transition-colors ${
                  location.pathname === item.path
                    ? 'text-primary font-semibold'
                    : 'text-foreground hover:text-primary'
                }`}
              >
                {item.label}
              </Link>
            </NavbarItem>
          ))}
        </NavbarContent>
        <NavbarContent justify="end">
          <NavbarItem>
            <span className="text-sm text-default-500 mr-2">{user?.username}</span>
            <Button size="sm" variant="flat" onPress={logout}>ログアウト</Button>
          </NavbarItem>
        </NavbarContent>
      </Navbar>
      <main className="flex-1 container mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

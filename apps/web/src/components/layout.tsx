import { Outlet, Link } from 'react-router';
import { Navbar, NavbarBrand, NavbarContent, NavbarItem, Button } from '@heroui/react';

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar maxWidth="xl" isBordered>
        <NavbarBrand>
          <Link to="/" className="font-bold text-xl text-primary">
            SumireVox
          </Link>
        </NavbarBrand>
        <NavbarContent className="hidden sm:flex gap-4" justify="center">
          <NavbarItem>
            <Link to="/commands" className="text-foreground hover:text-primary transition-colors">
              コマンド
            </Link>
          </NavbarItem>
          <NavbarItem>
            <Link to="/credits" className="text-foreground hover:text-primary transition-colors">
              クレジット
            </Link>
          </NavbarItem>
        </NavbarContent>
        <NavbarContent justify="end">
          <NavbarItem>
            <Button
              as="a"
              href="/auth/login"
              color="primary"
              variant="flat"
              size="sm"
            >
              ログイン
            </Button>
          </NavbarItem>
        </NavbarContent>
      </Navbar>
      <main className="flex-1 container mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-divider py-6 px-4">
        <div className="container mx-auto max-w-5xl flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-default-500">© 2025 SumireVox</p>
          <div className="flex gap-4 text-sm text-default-500">
            <Link to="/terms" className="hover:text-foreground transition-colors">利用規約</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">プライバシーポリシー</Link>
            <Link to="/legal" className="hover:text-foreground transition-colors">特商法表記</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/context/auth-context';
import { ThemeProvider } from 'next-themes';
import Sidebar from './Sidebar';
import UserHeader from './UserHeader';
import { Toaster } from '@/components/ui/sonner';
import PwaInstall from './PwaInstall';
import SettingsApplier from './SettingsApplier';
import LaunchPad from './LaunchPad';
import { Menu } from 'lucide-react';

function isChunkError(msg: string): boolean {
  return (
    /ChunkLoadError/i.test(msg) ||
    /loading chunk/i.test(msg) ||
    /failed to fetch dynamically imported module/i.test(msg) ||
    /importing a module script failed/i.test(msg) ||
    /load failed/i.test(msg)
  );
}

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicPage = pathname === '/login'
    || pathname?.startsWith('/lgpd')
    || pathname?.startsWith('/ponto')
    || pathname?.startsWith('/estoque/coletor')
    || pathname?.startsWith('/esqueci-senha')
    || pathname?.startsWith('/reset-senha')
    || pathname?.startsWith('/trocar-senha')
    || pathname?.startsWith('/pesquisa')
    || pathname?.startsWith('/documentos');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Detecta ChunkLoadError causado por novo deploy e recarrega a página
  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      if (isChunkError(e.message || '')) window.location.reload();
    };
    const handleRejection = (e: PromiseRejectionEvent) => {
      const msg = e.reason?.message || String(e.reason || '');
      if (isChunkError(msg)) window.location.reload();
    };
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  useEffect(() => { setMounted(true); }, []);
  // Fechar drawer ao trocar de página
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  if (!mounted) return <>{children}</>;

  return (
    <AuthProvider>
      <ThemeProvider attribute="class" defaultTheme="light">
        {!isPublicPage && (
          <>
            {/* Backdrop mobile */}
            {mobileOpen && (
              <div
                className="fixed inset-0 bg-black/60 z-40 lg:hidden"
                onClick={() => setMobileOpen(false)}
              />
            )}
            <Sidebar
              isCollapsed={isSidebarCollapsed}
              setIsCollapsed={setIsSidebarCollapsed}
              mobileOpen={mobileOpen}
              setMobileOpen={setMobileOpen}
            />
          </>
        )}

        <main
          className={`flex-1 flex flex-col transition-all duration-300 w-full ${
            !isPublicPage
              ? isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
              : ''
          }`}
        >
          {!isPublicPage && (
            <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center justify-between lg:justify-end gap-3">
              {/* Hamburger visível só no mobile */}
              <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Abrir menu"
              >
                <Menu size={22} />
              </button>
              {/* Logo mobile */}
              <span className="lg:hidden flex-1 text-base font-black italic text-purple-700 dark:text-purple-400 tracking-tight">
                ITP <span className="text-yellow-500">ERP</span>
              </span>
              <UserHeader />
            </header>
          )}
          {/* pb-20 no mobile para não ficar atrás da bottom nav */}
          <div className={`flex-1 ${!isPublicPage ? 'pb-20 lg:pb-0' : ''}`}>{children}</div>
        </main>

        {/* ── Bottom Navigation (mobile only) ──────────────────────────── */}
        {!isPublicPage && <MobileBottomNav />}

        {/* ── LaunchPad flutuante ──────────────────────────────────────── */}
        {!isPublicPage && <LaunchPad />}

        <Toaster
          richColors
          position="top-right"
          expand
          visibleToasts={5}
          toastOptions={{
            style: {
              background: 'hsl(var(--popover, 0 0% 100%))',
              opacity: 1,
              boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
            },
          }}
        />
        <PwaInstall />
        <SettingsApplier />
      </ThemeProvider>
    </AuthProvider>
  );
}

// ── Bottom Navigation Mobile ──────────────────────────────────────────────────
import Link from 'next/link';
import {
  LayoutDashboard, UserPlus, ClipboardList,
  GraduationCap, DollarSign, Package, BarChart2, Heart,
} from 'lucide-react';

const BOTTOM_ITEMS = [
  { name: 'Home',       path: '/dashboard',  icon: LayoutDashboard },
  { name: 'Matrículas', path: '/matriculas', icon: ClipboardList },
  { name: 'Acadêmico',  path: '/academico',  icon: GraduationCap },
  { name: 'Financeiro', path: '/financeiro', icon: DollarSign },
  { name: 'Relatórios', path: '/relatorios', icon: BarChart2 },
];

function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#1a0b2e] border-t border-purple-900/50 flex items-stretch">
      {BOTTOM_ITEMS.map(item => {
        const active = pathname.startsWith(item.path);
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            href={item.path}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${
              active ? 'text-yellow-400' : 'text-purple-300'
            }`}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
            <span className="text-[9px] font-black uppercase tracking-tight leading-none">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

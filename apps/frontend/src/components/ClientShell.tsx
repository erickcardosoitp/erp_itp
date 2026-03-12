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

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicPage = pathname === '/login'
    || pathname?.startsWith('/lgpd')
    || pathname?.startsWith('/estoque/coletor')
    || pathname?.startsWith('/esqueci-senha')
    || pathname?.startsWith('/reset-senha');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <>{children}</>;

  return (
    <AuthProvider>
      <ThemeProvider attribute="class" defaultTheme="light">
        {!isPublicPage && (
          <Sidebar
            isCollapsed={isSidebarCollapsed}
            setIsCollapsed={setIsSidebarCollapsed}
          />
        )}

        <main
          className={`flex-1 flex flex-col transition-all duration-300 w-full ${
            !isPublicPage ? (isSidebarCollapsed ? 'ml-20' : 'ml-64') : ''
          }`}
        >
          {!isPublicPage && (
            <div className="p-4 flex justify-end">
              <UserHeader />
            </div>
          )}
          <div className="flex-1">{children}</div>
        </main>

        <Toaster richColors />
        <PwaInstall />
        <SettingsApplier />
      </ThemeProvider>
    </AuthProvider>
  );
}

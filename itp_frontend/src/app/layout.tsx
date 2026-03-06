'use client';

import { useState, useEffect } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes"; // ✅ Importação do Provedor de Temas
import "./globals.css";
import Sidebar from "../components/Sidebar";
import UserHeader from "../components/UserHeader"; // ✅ Importação do Header de Identidade

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Enquanto não monta, evita flash de conteúdo sem estilo
  if (!mounted) return <html lang="pt-br"><body>{children}</body></html>;

  return (
    <html lang="pt-br" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50 dark:bg-slate-950 flex min-h-screen transition-colors duration-300`}>
        
        {/* ✅ PROVIDER: Envolve toda a aplicação com suporte a temas */}
        <ThemeProvider attribute="class" defaultTheme="light">
          
          {!isLoginPage && (
            <Sidebar 
              isCollapsed={isSidebarCollapsed} 
              setIsCollapsed={setIsSidebarCollapsed} 
            />
          )}

          <main className={`
            flex-1 flex flex-col transition-all duration-300 w-full
            ${!isLoginPage ? (isSidebarCollapsed ? 'ml-20' : 'ml-64') : ''}
          `}>
            
            {/* ✅ HEADER DE IDENTIDADE: Erick Cardoso - ADMIN */}
            {!isLoginPage && (
              <div className="p-4 flex justify-end">
                <UserHeader />
              </div>
            )}

            <div className="flex-1">
              {children}
            </div>
          </main>

        </ThemeProvider>
      </body>
    </html>
  );
}
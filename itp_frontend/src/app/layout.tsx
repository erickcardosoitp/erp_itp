'use client';

import { useState } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { usePathname } from "next/navigation";
import "./globals.css";
import Sidebar from "../components/Sidebar";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  
  // Estado movido para cá para controlar o margin-left do conteúdo principal
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <html lang="pt-br" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 flex`}>
        {!isLoginPage && (
          <Sidebar 
            isCollapsed={isSidebarCollapsed} 
            setIsCollapsed={setIsSidebarCollapsed} 
          />
        )}

        <main className={`
          flex-1 transition-all duration-300
          ${!isLoginPage ? (isSidebarCollapsed ? 'ml-20' : 'ml-64') : ''}
        `}>
          {children}
        </main>
      </body>
    </html>
  );
}
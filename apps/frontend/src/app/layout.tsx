import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientShell from "@/components/ClientShell";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata = {
  title: 'Instituto Tia Pretinha',
  description: 'Sistema de Gestão ERP',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-br" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50 dark:bg-[#1a2030] flex min-h-screen transition-colors duration-300`}>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Kanban, BarChart2, Target } from 'lucide-react';

const NAV = [
  { href: '/captacao/buscar', label: 'Buscar', icon: Search },
  { href: '/captacao/pipeline', label: 'Pipeline', icon: Kanban },
  { href: '/captacao/insights', label: 'Insights', icon: BarChart2 },
];

export default function CaptacaoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 py-4">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-purple-600 text-white">
              <Target size={18} />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 dark:text-white leading-none">Captação</h1>
              <p className="text-[11px] text-slate-400 mt-0.5">Busca inteligente de editais e financiamentos</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 -mb-px">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors
                    ${active
                      ? 'border-purple-600 text-purple-700 dark:text-purple-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                  <Icon size={14} />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { X } from 'lucide-react';

export const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';
export const CNPJ = '11.759.851/0001-39';
export const EMPRESA = 'Instituto Tia Pretinha';
export const ENDERECO = 'Rua Ramiro Monteiro, 130 — Vaz Lobo';

export type MainTab = 'colaboradores' | 'folha' | 'disciplinar' | 'codigos';

export const fmt = {
  data: (iso: string) => iso ? new Date(iso.includes('T') ? iso : iso + 'T12:00:00').toLocaleDateString('pt-BR') : '—',
  hora: (iso: string) => iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—',
  moeda: (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0),
  mes: (ym: string) => {
    if (!ym) return '—';
    const [y, m] = ym.split('-');
    const nomes = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
    return `${nomes[parseInt(m) - 1]}/${y.slice(2)}`;
  },
};

export const hoje = () => new Date().toISOString().split('T')[0];

// UI primitivos
export const ic = 'w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-400';
export const bp = 'bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition disabled:opacity-50';
export const bs = 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-bold px-4 py-2 rounded-xl text-sm transition';
export const bd = 'bg-red-50 hover:bg-red-100 text-red-600 font-bold px-3 py-1.5 rounded-lg text-xs transition';

export function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>{label}</span>;
}

export function Modal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-2xl ${wide ? 'w-full max-w-3xl' : 'w-full max-w-lg'} max-h-[92vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-700">
          <h2 className="font-black text-slate-800 dark:text-white text-lg">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

export function FL({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{label}</label>
      {children}
    </div>
  );
}

export function SubTabs<T extends string>({ tabs, active, setActive }: {
  tabs: readonly { key: T; label: string; icon?: React.ComponentType<any> }[];
  active: T; setActive: (k: T) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-2 mb-5 border-b border-slate-200 dark:border-slate-700 scrollbar-hide">
      {tabs.map(t => {
        const Icon = t.icon;
        return (
          <button key={t.key} onClick={() => setActive(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${active === t.key ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}>
            {Icon && <Icon size={12} />}{t.label}
          </button>
        );
      })}
    </div>
  );
}

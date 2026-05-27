'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Users, FileText, AlertTriangle, Tag } from 'lucide-react';
import { API, MainTab } from './components/shared';
import { ColaboradoresTab } from './components/ColaboradoresTab';
import { FolhaTab } from './components/FolhaTab';
import { DisciplinarTab } from './components/DisciplinarTab';
import { CodigosTab } from './components/CodigosTab';

// ── Tabs config ───────────────────────────────────────────────────────────────

const MAIN_TABS = [
  { key: 'colaboradores' as const, label: 'Colaboradores', icon: Users },
  { key: 'folha' as const, label: 'Folha / RH', icon: FileText },
  { key: 'disciplinar' as const, label: 'Disciplinar', icon: AlertTriangle },
  { key: 'codigos' as const, label: 'Códigos VR', icon: Tag },
];

// ── Página Principal ──────────────────────────────────────────────────────────

export default function GentePage() {
  const [tab, setTab] = useState<MainTab>('colaboradores');
  const [subFolha, setSubFolha] = useState<'recibos' | 'vales' | 'transporte' | 'financeiro'>('recibos');
  const [subDisc, setSubDisc] = useState<'advertencias' | 'suspensoes' | 'faltas'>('advertencias');
  const [reload, setReload] = useState(0);
  const [colaboradores, setColaboradores] = useState<any[]>([]);

  const carregarColaboradores = useCallback(async () => {
    try {
      const r = await fetch(`${API}/gente/colaboradores`, { credentials: 'include', cache: 'no-store' });
      const data = await r.json();
      setColaboradores(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  useEffect(() => { carregarColaboradores(); }, [carregarColaboradores, reload]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white">Gente</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Gestão de pessoas — funcionários e voluntários</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Users size={16} /><span>{colaboradores.length} colaborador{colaboradores.length !== 1 ? 'es' : ''}</span>
        </div>
      </div>

      {/* Tabs principais */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-6 scrollbar-hide">
        {MAIN_TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest whitespace-nowrap transition-all ${tab === t.key ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
              <Icon size={14} />{t.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-6 shadow-sm">

        {tab === 'colaboradores' && (
          <ColaboradoresTab reload={reload} colaboradores={colaboradores} carregarColaboradores={carregarColaboradores} />
        )}

        {tab === 'folha' && (
          <FolhaTab reload={reload} colaboradores={colaboradores} subFolha={subFolha} setSubFolha={setSubFolha} />
        )}

        {tab === 'disciplinar' && (
          <DisciplinarTab reload={reload} colaboradores={colaboradores} subDisc={subDisc} setSubDisc={setSubDisc} />
        )}

        {tab === 'codigos' && <CodigosTab reload={reload} />}
      </div>
    </div>
  );
}

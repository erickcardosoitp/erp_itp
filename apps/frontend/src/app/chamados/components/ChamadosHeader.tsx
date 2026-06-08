'use client';

import React from 'react';
import { Search, BookOpen, Plus, List, LayoutGrid, User, AlertTriangle, X, Globe } from 'lucide-react';
import {
  Stats, LABEL_PRIO, PRIO_DOT, TIPOS_CHAMADO,
} from './_shared';

interface Props {
  stats: Stats | null;
  busca: string;
  onBusca: (v: string) => void;
  filtroStatus: string;
  onFiltroStatus: (v: string) => void;
  filtroPrioridade: string;
  onFiltroPrioridade: (v: string) => void;
  filtroTipo: string;
  onFiltroTipo: (v: string) => void;
  filtroMeus: boolean;
  onFiltroMeus: (v: boolean) => void;
  filtroSLA: boolean;
  onFiltroSLA: (v: boolean) => void;
  filtroSite: boolean;
  onFiltroSite: (v: boolean) => void;
  view: 'table' | 'kanban';
  onView: (v: 'table' | 'kanban') => void;
  onNovo: () => void;
  onKB: () => void;
}

function Chip({
  active, onClick, children, activeClass = 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900',
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  activeClass?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap ${
        active
          ? activeClass
          : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      {children}
    </button>
  );
}

const PRIO_ACTIVE: Record<string, string> = {
  urgente: 'bg-red-600 text-white',
  alta:    'bg-orange-500 text-white',
  normal:  'bg-blue-500 text-white',
  baixa:   'bg-slate-500 text-white',
};

export function ChamadosHeader({
  stats, busca, onBusca,
  filtroStatus, onFiltroStatus,
  filtroPrioridade, onFiltroPrioridade,
  filtroTipo, onFiltroTipo,
  filtroMeus, onFiltroMeus,
  filtroSLA, onFiltroSLA,
  filtroSite, onFiltroSite,
  view, onView, onNovo, onKB,
}: Props) {
  return (
    <div className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 pb-3 pt-4 -mx-4 md:-mx-6 px-4 md:px-6">
      {/* Row 1: search + view toggle + actions */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="relative flex-1 max-w-[280px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={busca}
            onChange={e => onBusca(e.target.value)}
            placeholder="Buscar chamado ou aluno..."
            className="w-full pl-7 pr-7 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-400 dark:text-slate-100"
          />
          {busca && (
            <button onClick={() => onBusca('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
              <X size={11} />
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onKB}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:text-purple-600 hover:border-purple-300 transition-colors"
          >
            <BookOpen size={12} /> Base KB
          </button>

          {/* View toggle */}
          <div className="flex rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              onClick={() => onView('table')}
              title="Tabela"
              className={`p-1.5 transition-colors ${
                view === 'table'
                  ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
                  : 'bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <List size={13} />
            </button>
            <button
              onClick={() => onView('kanban')}
              title="Kanban"
              className={`p-1.5 transition-colors border-l border-slate-200 dark:border-slate-700 ${
                view === 'kanban'
                  ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
                  : 'bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <LayoutGrid size={13} />
            </button>
          </div>

          <button
            onClick={onNovo}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
          >
            <Plus size={12} /> Novo
          </button>
        </div>
      </div>

      {/* Row 2: filter chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Status */}
        <Chip active={filtroStatus === ''} onClick={() => onFiltroStatus('')}>
          Todos
        </Chip>
        <Chip active={filtroStatus === 'aberto'} onClick={() => onFiltroStatus(filtroStatus === 'aberto' ? '' : 'aberto')}>
          Aberto {stats?.abertos ? <span className="opacity-60 font-normal">{stats.abertos}</span> : null}
        </Chip>
        <Chip active={filtroStatus === 'em_andamento'} onClick={() => onFiltroStatus(filtroStatus === 'em_andamento' ? '' : 'em_andamento')}>
          Em andamento {stats?.em_andamento ? <span className="opacity-60 font-normal">{stats.em_andamento}</span> : null}
        </Chip>
        <Chip active={filtroStatus === 'resolvido'} onClick={() => onFiltroStatus(filtroStatus === 'resolvido' ? '' : 'resolvido')}>
          Resolvido {stats?.resolvidos ? <span className="opacity-60 font-normal">{stats.resolvidos}</span> : null}
        </Chip>

        <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

        {/* Priority */}
        {(['urgente', 'alta', 'normal', 'baixa'] as const).map(p => (
          <Chip
            key={p}
            active={filtroPrioridade === p}
            onClick={() => onFiltroPrioridade(filtroPrioridade === p ? '' : p)}
            activeClass={PRIO_ACTIVE[p]}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${filtroPrioridade === p ? 'bg-white' : PRIO_DOT[p]}`} />
            {LABEL_PRIO[p]}
          </Chip>
        ))}

        <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

        {/* Type */}
        <select
          value={filtroTipo}
          onChange={e => onFiltroTipo(e.target.value)}
          className="px-2 py-1 text-[11px] bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-400"
        >
          <option value="">Tipo: Todos</option>
          {TIPOS_CHAMADO.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

        {/* Toggles */}
        <Chip
          active={filtroMeus}
          onClick={() => onFiltroMeus(!filtroMeus)}
          activeClass="bg-purple-600 text-white"
        >
          <User size={10} /> Meus
        </Chip>
        <Chip
          active={filtroSLA}
          onClick={() => onFiltroSLA(!filtroSLA)}
          activeClass="bg-red-600 text-white"
        >
          <AlertTriangle size={10} /> SLA crítico
        </Chip>
        <Chip
          active={filtroSite}
          onClick={() => onFiltroSite(!filtroSite)}
          activeClass="bg-sky-600 text-white"
        >
          <Globe size={10} /> Do site
        </Chip>
      </div>
    </div>
  );
}

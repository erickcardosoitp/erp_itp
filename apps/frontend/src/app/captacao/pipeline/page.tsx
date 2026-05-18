'use client';

import React, { useState } from 'react';
import { Search, Kanban, List, Loader2 } from 'lucide-react';
import type { Opportunity, PipelineStatus } from '../types';
import { PIPELINE_ORDER, STATUS_LABELS, STATUS_COLORS } from '../constants';
import { usePipeline } from '../hooks/usePipeline';
import { KanbanBoard } from '../components/KanbanBoard';
import { OpportunityDrawer } from '../components/OpportunityDrawer';

type ViewMode = 'kanban' | 'lista';

export default function PipelinePage() {
  const [view, setView] = useState<ViewMode>('kanban');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const {
    opportunities,
    total,
    loading,
    filterStatus,
    filterSearch,
    setFilterStatus,
    setFilterSearch,
    moveCard,
    deleteCard,
    updateCard,
    load,
  } = usePipeline();

  const handleOpen = (o: Opportunity) => setSelectedId(o.id);
  const handleClose = () => setSelectedId(null);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            placeholder="Buscar no pipeline..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>

        {/* Status filter */}
        <select
          value={filterStatus ?? ''}
          onChange={e => setFilterStatus((e.target.value as PipelineStatus) || undefined)}
          className="text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
          <option value="">Todos os status</option>
          {PIPELINE_ORDER.map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        {/* View toggle */}
        <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <button
            onClick={() => setView('kanban')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition
              ${view === 'kanban' ? 'bg-purple-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-800'}`}
          >
            <Kanban size={13} />
            Kanban
          </button>
          <button
            onClick={() => setView('lista')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition
              ${view === 'lista' ? 'bg-purple-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-800'}`}
          >
            <List size={13} />
            Lista
          </button>
        </div>

        <span className="text-xs text-slate-400 ml-auto">{total} oportunidade{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={28} className="animate-spin text-purple-400" />
        </div>
      )}

      {/* Kanban view */}
      {!loading && view === 'kanban' && (
        <KanbanBoard
          opportunities={opportunities}
          onMove={(id, status) => moveCard(id, status)}
          onOpen={handleOpen}
          onDelete={deleteCard}
        />
      )}

      {/* Lista view */}
      {!loading && view === 'lista' && (
        <div className="space-y-3">
          {PIPELINE_ORDER.map(status => {
            const items = opportunities.filter(o => o.status === status);
            if (filterStatus && filterStatus !== status) return null;
            const colors = STATUS_COLORS[status];
            return (
              <div key={status} className={`rounded-2xl border-2 ${colors.border} ${colors.bg} overflow-hidden`}>
                <div className={`px-4 py-2 border-b ${colors.border} flex items-center justify-between`}>
                  <span className={`text-xs font-black uppercase tracking-wider ${colors.text}`}>
                    {STATUS_LABELS[status]}
                  </span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                    {items.length}
                  </span>
                </div>
                {items.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic px-4 py-3">Nenhuma oportunidade</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map(o => (
                      <div key={o.id} className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition" onClick={() => handleOpen(o)}>
                        {o.ai_score != null && (
                          <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 w-6 text-center">
                            {o.ai_score}
                          </span>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-slate-800 dark:text-white truncate">{o.title}</p>
                          {o.entity_name && <p className="text-[10px] text-slate-400 truncate">{o.entity_name}</p>}
                        </div>
                        {o.deadline && (
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {new Date(o.deadline).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && opportunities.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Kanban size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-semibold">Pipeline vazio</p>
          <p className="text-xs mt-1">Salve oportunidades da busca para aparecerem aqui</p>
        </div>
      )}

      {/* Drawer */}
      {selectedId && (
        <OpportunityDrawer
          opportunityId={selectedId}
          onClose={handleClose}
          onStatusChange={(id, status) => moveCard(id, status)}
          onDelete={deleteCard}
        />
      )}
    </div>
  );
}

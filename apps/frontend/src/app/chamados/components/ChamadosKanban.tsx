'use client';

import React from 'react';
import { NotebookPen, Edit3, Trash2, User, Tag, Star, Globe } from 'lucide-react';
import {
  Chamado, PRIO_BORDER, PRIO_TEXT, LABEL_PRIO,
  getSLAState, getSLATextClass, fmtRelative,
} from './_shared';

interface Props {
  chamados: Chamado[];
  canWrite: boolean;
  onAtender: (id: string) => void;
  onResolver: (c: Chamado) => void;
  onAcomp: (c: Chamado) => void;
  onEditar: (c: Chamado) => void;
  onDeletar: (id: string) => void;
}

const COLUMNS = [
  { key: 'aberto',       label: 'Aberto' },
  { key: 'em_andamento', label: 'Em andamento' },
  { key: 'resolvido',    label: 'Resolvido' },
] as const;

function SLABar({ chamado }: { chamado: Chamado }) {
  const { pct, colorClass } = getSLAState(chamado);
  return (
    <div className="w-full h-0.5 bg-slate-100 dark:bg-slate-700">
      <div className={`h-full ${colorClass} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function KanbanCard({ c, canWrite, onAtender, onResolver, onAcomp, onEditar, onDeletar }: {
  c: Chamado;
  canWrite: boolean;
  onAtender: (id: string) => void;
  onResolver: (c: Chamado) => void;
  onAcomp: (c: Chamado) => void;
  onEditar: (c: Chamado) => void;
  onDeletar: (id: string) => void;
}) {
  const sla = getSLAState(c);

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 border-l-[3px] ${PRIO_BORDER[c.prioridade] ?? 'border-l-slate-200'} overflow-hidden group`}>
      <div className="p-3">
        {/* Title + priority */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1">
              {c.origem === 'site' && (
                <span title="Vindo do site"><Globe size={9} className="text-sky-500 shrink-0 mt-[3px]" /></span>
              )}
              <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 line-clamp-2 leading-snug">{c.titulo}</p>
            </div>
            {c.aluno_nome && (
              <p className="text-[9px] text-slate-400 flex items-center gap-0.5 mt-1">
                <User size={8} />{c.aluno_nome}
              </p>
            )}
            {c.responsavel_nome && (
              <p className="text-[9px] text-indigo-400 flex items-center gap-0.5 mt-0.5 font-medium">
                <User size={8} />→ {c.responsavel_nome}
              </p>
            )}
          </div>
          <span className={`text-[9px] font-semibold shrink-0 ${PRIO_TEXT[c.prioridade] ?? 'text-slate-400'}`}>
            {LABEL_PRIO[c.prioridade]}
          </span>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-[9px] text-slate-400">{c.tipo}</span>
          {c.fila_nome && (
            <span className="flex items-center gap-0.5 text-[9px] text-purple-400"><Tag size={7} />{c.fila_nome}</span>
          )}
          {c.satisfacao && (
            <span className="flex items-center gap-0.5 text-[9px] text-yellow-500"><Star size={8} fill="currentColor" />{c.satisfacao}</span>
          )}
        </div>

        {/* SLA time + actions */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5">
            <span className={`text-[9px] font-semibold ${getSLATextClass(sla.colorClass)}`}>{sla.label}</span>
            <span className="text-[9px] text-slate-300">·</span>
            <span className="text-[9px] text-slate-400">{fmtRelative(c.abertura ?? c.created_at)}</span>
          </div>
          <div className="flex items-center gap-0.5">
            {c.status !== 'resolvido' && c.status !== 'em_andamento' && (
              <button
                onClick={() => onAtender(c.id)}
                className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-100 dark:bg-amber-950 dark:border-amber-900 dark:text-amber-400 whitespace-nowrap"
              >
                Atender
              </button>
            )}
            {c.status !== 'resolvido' && (
              <button
                onClick={() => onResolver(c)}
                className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100 dark:bg-emerald-950 dark:border-emerald-900 dark:text-emerald-400 whitespace-nowrap"
              >
                Resolver
              </button>
            )}
            <button
              onClick={() => onAcomp(c)}
              className={`p-1 rounded transition-colors ${(c._total_acomp ?? 0) > 0 ? 'text-purple-400' : 'text-slate-300 dark:text-slate-600 hover:text-purple-400'}`}
            >
              <NotebookPen size={10} />
            </button>
            {canWrite && (
              <button
                onClick={() => onEditar(c)}
                className="p-1 rounded text-slate-300 dark:text-slate-600 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Edit3 size={10} />
              </button>
            )}
          </div>
        </div>

        {/* Protocol */}
        {c.protocolo && (
          <p className="font-mono text-[8px] text-slate-300 dark:text-slate-600 mt-1">{c.protocolo}</p>
        )}
      </div>
      {/* SLA bar at bottom */}
      <SLABar chamado={c} />
    </div>
  );
}

export function ChamadosKanban({ chamados, canWrite, onAtender, onResolver, onAcomp, onEditar, onDeletar }: Props) {
  if (chamados.length === 0) {
    return <div className="text-center py-16 text-sm text-slate-400">Nenhum chamado encontrado.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {COLUMNS.map(col => {
        const items = chamados.filter(c => c.status === col.key);
        return (
          <div key={col.key} className="bg-slate-50/50 dark:bg-slate-800/20 rounded-xl p-3 min-h-[200px]">
            <div className="flex items-center justify-between mb-3 px-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {col.label}
              </span>
              {items.length > 0 && (
                <span className="text-[10px] font-semibold text-slate-400 bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded-full border border-slate-100 dark:border-slate-600">
                  {items.length}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {items.length === 0 ? (
                <div className="text-center py-8 text-[10px] text-slate-300 dark:text-slate-600">Vazio</div>
              ) : (
                items.map(c => (
                  <KanbanCard
                    key={c.id}
                    c={c}
                    canWrite={canWrite}
                    onAtender={onAtender}
                    onResolver={onResolver}
                    onAcomp={onAcomp}
                    onEditar={onEditar}
                    onDeletar={onDeletar}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

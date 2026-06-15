'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { NotebookPen, Edit3, User, Tag, Star, Globe, Users, Building2 } from 'lucide-react';
import {
  Chamado, PRIO_BORDER, PRIO_TEXT, PRIO_DOT, LABEL_PRIO, COR_STATUS, LABEL_STATUS,
  getSLAState, getSLATextClass, fmtRelative,
} from './_shared';

interface Props {
  chamados: Chamado[];
  canWrite: boolean;
  onAtender: (id: string) => void;
  onResolver: (c: Chamado) => void;
  onReabrir: (id: string) => void;
  onAcomp: (c: Chamado) => void;
  onEditar: (c: Chamado) => void;
  onDeletar: (id: string) => void;
}

const COLUMNS = [
  { key: 'aberto',       label: 'Aberto',       color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { key: 'em_andamento', label: 'Em andamento',  color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { key: 'resolvido',    label: 'Resolvido',     color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
] as const;

function SLABar({ chamado }: { chamado: Chamado }) {
  const { pct, colorClass } = getSLAState(chamado);
  return (
    <div className="w-full h-0.5 bg-slate-100 dark:bg-slate-700">
      <div className={`h-full ${colorClass} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function KanbanCard({ c, canWrite, onAtender, onResolver, onReabrir, onAcomp, onEditar }: {
  c: Chamado;
  canWrite: boolean;
  onAtender: (id: string) => void;
  onResolver: (c: Chamado) => void;
  onReabrir: (id: string) => void;
  onAcomp: (c: Chamado) => void;
  onEditar: (c: Chamado) => void;
  onDeletar: (id: string) => void;
}) {
  const router = useRouter();
  const sla = getSLAState(c);

  return (
    <div
      onClick={() => router.push(`/chamados/${c.id}`)}
      className={`bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 border-l-[3px] ${PRIO_BORDER[c.prioridade] ?? 'border-l-slate-200'} overflow-hidden group cursor-pointer hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700 transition-all`}
    >
      <div className="p-3 space-y-2">

        {/* Row 1: Tipo + Origem + Prioridade */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide truncate">{c.tipo}</span>
            {c.origem === 'site' && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1 py-0.5 rounded border text-sky-600 bg-sky-50 border-sky-200 shrink-0">
                <Globe size={7} />Site
              </span>
            )}
            {c.fila_nome && (
              <span className="inline-flex items-center gap-0.5 text-[9px] text-purple-500 shrink-0">
                <Tag size={7} /><span className="truncate max-w-[60px]">{c.fila_nome}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIO_DOT[c.prioridade] ?? 'bg-slate-300'}`} />
            <span className={`text-[9px] font-bold ${PRIO_TEXT[c.prioridade] ?? 'text-slate-400'}`}>
              {LABEL_PRIO[c.prioridade]}
            </span>
          </div>
        </div>

        {/* Row 2: Título */}
        <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 line-clamp-2 leading-snug">
          {c.titulo}
        </p>

        {/* Row 3: Aluno + Turma */}
        {(c.aluno_nome || c.turma_nome) && (
          <p className="text-[9px] text-slate-400 flex items-center gap-0.5 truncate">
            <User size={8} className="shrink-0" />
            <span className="truncate">{c.aluno_nome ?? '—'}</span>
            {c.turma_nome && <span className="text-slate-300 dark:text-slate-600 shrink-0 ml-0.5">· {c.turma_nome}</span>}
          </p>
        )}

        {/* Row 4: Responsável */}
        {c.responsavel_nome && (
          <p className="text-[9px] text-indigo-500 dark:text-indigo-400 flex items-center gap-0.5 truncate font-medium">
            <Building2 size={8} className="shrink-0" />{c.responsavel_nome}
          </p>
        )}

        {/* Row 5: Criado por (secundário) */}
        {c.criado_por_nome && (
          <p className="text-[9px] text-slate-300 dark:text-slate-600 flex items-center gap-0.5 truncate">
            <Users size={7} className="shrink-0" />por {c.criado_por_nome}
          </p>
        )}

        {/* Row 6: SLA + Satisfação + Ações */}
        <div className="flex items-center justify-between gap-1 pt-0.5">
          <div className="flex items-center gap-1.5">
            <span className={`text-[9px] font-semibold ${getSLATextClass(sla.colorClass)}`}>{sla.label}</span>
            <span className="text-[9px] text-slate-300">·</span>
            <span className="text-[9px] text-slate-400">{fmtRelative(c.abertura ?? c.created_at)}</span>
            {c.satisfacao && (
              <span className="flex items-center gap-0.5 text-[9px] text-yellow-500 font-semibold ml-1">
                <Star size={8} fill="currentColor" />{c.satisfacao}
              </span>
            )}
          </div>
          {/* Ações — stopPropagation para não abrir o detalhe */}
          <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
            {c.status === 'aberto' && (
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
            {(c.status === 'em_andamento' || c.status === 'resolvido') && (
              <button
                onClick={() => onReabrir(c.id)}
                className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-400 whitespace-nowrap"
              >
                Reabrir
              </button>
            )}
            <button
              onClick={() => onAcomp(c)}
              className={`p-1 rounded transition-colors ${(c._total_acomp ?? 0) > 0 ? 'text-purple-400' : 'text-slate-300 dark:text-slate-600 hover:text-purple-400'}`}
            >
              <NotebookPen size={10} />
              {(c._total_acomp ?? 0) > 0 && (
                <span className="sr-only">{c._total_acomp} acompanhamentos</span>
              )}
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
          <p className="font-mono text-[8px] text-slate-300 dark:text-slate-600">{c.protocolo}</p>
        )}
      </div>

      {/* SLA bar */}
      <SLABar chamado={c} />
    </div>
  );
}

export function ChamadosKanban({ chamados, canWrite, onAtender, onResolver, onReabrir, onAcomp, onEditar, onDeletar }: Props) {
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
              <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${col.color}`}>
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
                    onReabrir={onReabrir}
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

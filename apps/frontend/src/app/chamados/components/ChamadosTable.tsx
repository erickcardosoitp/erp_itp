'use client';

import React, { useState } from 'react';
import { NotebookPen, Edit3, Trash2, ChevronUp, ChevronDown, Star, User, Tag, Globe } from 'lucide-react';
import {
  Chamado, COR_STATUS, PRIO_STRIP_BG, PRIO_TEXT, LABEL_STATUS, LABEL_PRIO,
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

type SortKey = 'titulo' | 'tipo' | 'prioridade' | 'status' | 'abertura';
const PRIO_ORDER = ['urgente', 'alta', 'normal', 'baixa'];

function SLABar({ chamado }: { chamado: Chamado }) {
  const { pct, colorClass } = getSLAState(chamado);
  return (
    <div className="w-full h-0.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
      <div className={`h-full ${colorClass} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function SortBtn({ active, dir, onClick, children }: {
  active: boolean; dir: 'asc' | 'desc'; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 select-none whitespace-nowrap transition-colors"
    >
      {children}
      {active
        ? (dir === 'asc' ? <ChevronUp size={9} className="text-slate-600 dark:text-slate-300" /> : <ChevronDown size={9} className="text-slate-600 dark:text-slate-300" />)
        : <ChevronUp size={9} className="text-slate-300" />
      }
    </button>
  );
}

export function ChamadosTable({ chamados, canWrite, onAtender, onResolver, onAcomp, onEditar, onDeletar }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'abertura', dir: 'desc' });

  const toggleSort = (key: SortKey) =>
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });

  const sorted = [...chamados].sort((a, b) => {
    let cmp = 0;
    if (sort.key === 'prioridade') {
      cmp = PRIO_ORDER.indexOf(a.prioridade) - PRIO_ORDER.indexOf(b.prioridade);
    } else if (sort.key === 'abertura') {
      cmp = new Date(a.abertura ?? a.created_at).getTime() - new Date(b.abertura ?? b.created_at).getTime();
    } else {
      cmp = ((a as any)[sort.key] ?? '').localeCompare((b as any)[sort.key] ?? '');
    }
    return sort.dir === 'asc' ? cmp : -cmp;
  });

  if (chamados.length === 0) {
    return <div className="text-center py-16 text-sm text-slate-400">Nenhum chamado encontrado.</div>;
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 overflow-x-auto">
      <table className="w-full text-xs min-w-[720px]">
        <thead className="bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
          <tr>
            <th className="w-1 p-0" />
            <th className="px-3 py-2 text-left">
              <SortBtn active={sort.key === 'titulo'} dir={sort.dir} onClick={() => toggleSort('titulo')}>Chamado</SortBtn>
            </th>
            <th className="px-3 py-2 text-left">
              <SortBtn active={sort.key === 'tipo'} dir={sort.dir} onClick={() => toggleSort('tipo')}>Tipo</SortBtn>
            </th>
            <th className="px-3 py-2 text-left">
              <SortBtn active={sort.key === 'prioridade'} dir={sort.dir} onClick={() => toggleSort('prioridade')}>Prio.</SortBtn>
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">Fila</th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">SLA</th>
            <th className="px-3 py-2 text-left">
              <SortBtn active={sort.key === 'status'} dir={sort.dir} onClick={() => toggleSort('status')}>Status</SortBtn>
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">Responsável</th>
            <th className="px-3 py-2 text-left">
              <SortBtn active={sort.key === 'abertura'} dir={sort.dir} onClick={() => toggleSort('abertura')}>Abertura</SortBtn>
            </th>
            <th className="px-2 py-2 w-8" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
          {sorted.map(c => {
            const sla = getSLAState(c);
            return (
              <tr key={c.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                {/* Priority strip */}
                <td className="p-0 w-1">
                  <div className={`w-1 h-[42px] ${PRIO_STRIP_BG[c.prioridade] ?? 'bg-slate-200'}`} />
                </td>
                {/* Title */}
                <td className="px-3 py-2.5 max-w-[240px]">
                  <div className="flex items-start gap-1.5">
                    {c.origem === 'site' && <span title="Vindo do site"><Globe size={10} className="text-sky-500 mt-0.5 shrink-0" /></span>}
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-100 truncate leading-snug">{c.titulo}</p>
                      {c.aluno_nome && (
                        <p className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-0.5">
                          <User size={8} />{c.aluno_nome}
                        </p>
                      )}
                      {c.protocolo && (
                        <p className="font-mono text-[9px] text-slate-300 dark:text-slate-600 mt-0.5">{c.protocolo}</p>
                      )}
                    </div>
                  </div>
                </td>
                {/* Tipo */}
                <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">{c.tipo}</td>
                {/* Prioridade */}
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className={`font-semibold ${PRIO_TEXT[c.prioridade] ?? 'text-slate-400'}`}>
                    {LABEL_PRIO[c.prioridade]}
                  </span>
                </td>
                {/* Fila */}
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {c.fila_nome
                    ? <span className="flex items-center gap-1 text-[10px] text-purple-500"><Tag size={9} />{c.fila_nome}</span>
                    : <span className="text-slate-300 dark:text-slate-600">—</span>
                  }
                </td>
                {/* SLA */}
                <td className="px-3 py-2.5 min-w-[80px]">
                  <div className="space-y-1">
                    <SLABar chamado={c} />
                    <span className={`text-[10px] font-semibold ${getSLATextClass(sla.colorClass)}`}>{sla.label}</span>
                  </div>
                </td>
                {/* Status */}
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${COR_STATUS[c.status] ?? ''}`}>
                    {LABEL_STATUS[c.status] ?? c.status}
                  </span>
                </td>
                {/* Responsável */}
                <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap max-w-[130px] truncate">
                  {c.responsavel_nome ?? <span className="text-slate-300 dark:text-slate-600">—</span>}
                </td>
                {/* Abertura */}
                <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap text-[10px]">
                  {fmtRelative(c.abertura ?? c.created_at)}
                </td>
                {/* Actions — visible on row hover */}
                <td className="px-2 py-2.5">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {c.status !== 'resolvido' && c.status !== 'em_andamento' && (
                      <button onClick={() => onAtender(c.id)}
                        className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200 whitespace-nowrap">
                        Atender
                      </button>
                    )}
                    {c.status !== 'resolvido' && (
                      <button onClick={() => onResolver(c)}
                        className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 whitespace-nowrap">
                        Resolver
                      </button>
                    )}
                    <button
                      onClick={() => onAcomp(c)}
                      title={`${c._total_acomp ?? 0} acompanhamentos`}
                      className={`p-1 rounded transition-colors ${(c._total_acomp ?? 0) > 0 ? 'text-purple-500 bg-purple-50' : 'text-slate-400 hover:text-purple-500 hover:bg-purple-50'}`}
                    >
                      <NotebookPen size={11} />
                    </button>
                    {canWrite && (
                      <>
                        <button onClick={() => onEditar(c)} className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                          <Edit3 size={11} />
                        </button>
                        <button onClick={() => onDeletar(c.id)} className="p-1 rounded text-slate-300 hover:text-red-400">
                          <Trash2 size={11} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

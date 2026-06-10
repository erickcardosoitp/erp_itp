'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronUp, ChevronDown, User, Globe, Users } from 'lucide-react';
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

type SortKey = 'titulo' | 'tipo' | 'prioridade' | 'status' | 'abertura' | 'responsavel_nome' | 'updated_at';
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

function DataCell({ iso }: { iso?: string | null }) {
  if (!iso) return <span className="text-slate-300 dark:text-slate-600">—</span>;
  const dt = new Date(iso);
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
        {dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
      </p>
      <p className="text-[10px] text-slate-400">
        {dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </p>
      <p className="text-[9px] text-slate-300 dark:text-slate-600 mt-0.5">{fmtRelative(iso)}</p>
    </div>
  );
}

function OrigemBadge({ origem }: { origem?: string | null }) {
  if (origem === 'site') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded border text-sky-600 bg-sky-50 border-sky-200">
        <Globe size={8} />Site
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded border text-slate-400 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700">
      Interno
    </span>
  );
}

export function ChamadosTable({ chamados, canWrite, onAtender, onResolver, onAcomp, onEditar, onDeletar }: Props) {
  const router = useRouter();
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'abertura', dir: 'desc' });

  const toggleSort = (key: SortKey) =>
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });

  const sorted = [...chamados].sort((a, b) => {
    let cmp = 0;
    if (sort.key === 'prioridade') {
      cmp = PRIO_ORDER.indexOf(a.prioridade) - PRIO_ORDER.indexOf(b.prioridade);
    } else if (sort.key === 'abertura') {
      cmp = new Date(a.abertura ?? a.created_at).getTime() - new Date(b.abertura ?? b.created_at).getTime();
    } else if (sort.key === 'updated_at') {
      cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
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
      <table className="w-full text-xs min-w-[1100px]">
        <thead className="bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
          <tr>
            <th className="w-1 p-0" />
            <th className="px-3 py-2 text-left">
              <SortBtn active={sort.key === 'abertura'} dir={sort.dir} onClick={() => toggleSort('abertura')}>Data Abertura</SortBtn>
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">Origem</th>
            <th className="px-3 py-2 text-left">
              <SortBtn active={sort.key === 'titulo'} dir={sort.dir} onClick={() => toggleSort('titulo')}>Chamado</SortBtn>
            </th>
            <th className="px-3 py-2 text-left">
              <SortBtn active={sort.key === 'tipo'} dir={sort.dir} onClick={() => toggleSort('tipo')}>Tipo</SortBtn>
            </th>
            <th className="px-3 py-2 text-left">
              <SortBtn active={sort.key === 'prioridade'} dir={sort.dir} onClick={() => toggleSort('prioridade')}>Prioridade</SortBtn>
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">SLA</th>
            <th className="px-3 py-2 text-left">
              <SortBtn active={sort.key === 'status'} dir={sort.dir} onClick={() => toggleSort('status')}>Status</SortBtn>
            </th>
            <th className="px-3 py-2 text-left">
              <SortBtn active={sort.key === 'responsavel_nome'} dir={sort.dir} onClick={() => toggleSort('responsavel_nome')}>Responsável</SortBtn>
            </th>
            <th className="px-3 py-2 text-left">
              <SortBtn active={sort.key === 'updated_at'} dir={sort.dir} onClick={() => toggleSort('updated_at')}>Últ. atualização</SortBtn>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
          {sorted.map(c => {
            const sla = getSLAState(c);
            return (
              <tr key={c.id} onClick={() => router.push(`/chamados/${c.id}`)}
                className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer">
                {/* Priority strip */}
                <td className="p-0 w-1">
                  <div className={`w-1 h-[52px] ${PRIO_STRIP_BG[c.prioridade] ?? 'bg-slate-200'}`} />
                </td>

                {/* Data Abertura */}
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <DataCell iso={c.abertura ?? c.created_at} />
                </td>

                {/* Origem */}
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <OrigemBadge origem={c.origem} />
                </td>

                {/* Chamado */}
                <td className="px-3 py-2.5 max-w-[200px]">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 truncate leading-snug" title={c.descricao ?? undefined}>{c.titulo}</p>
                    {c.aluno_nome && (
                      <p className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-0.5 truncate">
                        <User size={8} className="shrink-0" />{c.aluno_nome}
                        {c.turma_nome && <span className="text-slate-300 dark:text-slate-600 ml-1">· {c.turma_nome}</span>}
                      </p>
                    )}
                    {c.criado_por_nome && (
                      <p className="text-[9px] text-slate-300 dark:text-slate-600 flex items-center gap-0.5 mt-0.5 truncate">
                        <Users size={7} className="shrink-0" />por {c.criado_por_nome}
                      </p>
                    )}
                    {c.protocolo && (
                      <p className="font-mono text-[9px] text-slate-300 dark:text-slate-600 mt-0.5">{c.protocolo}</p>
                    )}
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
                <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap max-w-[120px] truncate">
                  {c.responsavel_nome ?? <span className="text-slate-300 dark:text-slate-600">—</span>}
                </td>

                {/* Última atualização */}
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <DataCell iso={c.updated_at} />
                </td>

              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, FileText, RefreshCw, Smartphone } from 'lucide-react';
import api from '@/services/api';
import { CUIDADO_BADGE } from './_shared';

// ─── Local constants and interfaces ──────────────────────────────────────────

const DOCS_LABELS: Record<string, string> = {
  foto_aluno:              'Foto',
  identidade:              'Identidade',
  comprovante_residencia:  'Comp. Residência',
  certidao_nascimento:     'Certidão Nasc.',
  identidade_responsavel:  'Ident. Responsável',
};
const DOCS_OBRIGATORIOS = Object.keys(DOCS_LABELS);

interface AcervoAluno {
  aluno_id: string;
  nome_completo: string;
  inscricao_id: string | null;
  celular: string | null;
  telefone_alternativo: string | null;
  nome_responsavel: string | null;
  email_responsavel: string | null;
  cuidado_especial: string | null;
  turmas: string[];
  docs_presentes: string[];
  docs_faltando: string[];
  completo: boolean;
  lgpd_aceito: boolean;
  data_assinatura_lgpd: string | null;
}

async function exportarAcervoXLSX(alunos: AcervoAluno[]) {
  const rows = alunos.map(a => ({
    Nome:               a.nome_completo,
    Turmas:             a.turmas.join(', '),
    Responsavel:        a.nome_responsavel || '',
    Celular:            a.celular || '',
    Telefone_Alt:       a.telefone_alternativo || '',
    Email_Resp:         a.email_responsavel || '',
    Foto:               a.docs_presentes.includes('foto_aluno') ? 'SIM' : 'NÃO',
    Identidade:         a.docs_presentes.includes('identidade') ? 'SIM' : 'NÃO',
    Comp_Residencia:    a.docs_presentes.includes('comprovante_residencia') ? 'SIM' : 'NÃO',
    Certidao_Nasc:      a.docs_presentes.includes('certidao_nascimento') ? 'SIM' : 'NÃO',
    Ident_Responsavel:  a.docs_presentes.includes('identidade_responsavel') ? 'SIM' : 'NÃO',
    Situacao:           a.completo ? 'COMPLETO' : `FALTANDO: ${a.docs_faltando.map(d => DOCS_LABELS[d] || d).join(', ')}`,
    LGPD_Assinado:      a.lgpd_aceito ? 'SIM' : 'NÃO',
    Data_LGPD:          a.data_assinatura_lgpd ? new Date(a.data_assinatura_lgpd).toLocaleDateString('pt-BR') : '',
  }));

  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Acervo');
  XLSX.writeFile(wb, `acervo_documentos_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function whatsappLink(tel: string | null) {
  if (!tel) return null;
  const n = tel.replace(/\D/g, '');
  if (n.length < 10) return null;
  return `https://wa.me/55${n}`;
}

// ─── AcervoTab ────────────────────────────────────────────────────────────────

export default function AcervoTab() {
  const [dados, setDados] = useState<AcervoAluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'todos' | 'completos' | 'incompletos' | 'lgpd_pendente'>('todos');
  const [busca, setBusca] = useState('');
  const [letraAtiva, setLetraAtiva] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/academico/documentos/acervo');
      setDados(r.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtrados = useMemo(() => {
    return dados.filter(a => {
      if (filtro === 'completos' && !a.completo) return false;
      if (filtro === 'incompletos' && a.completo) return false;
      if (filtro === 'lgpd_pendente' && a.lgpd_aceito) return false;
      if (busca && !a.nome_completo.toLowerCase().includes(busca.toLowerCase())) return false;
      if (letraAtiva) {
        const primeira = a.nome_completo.trim()[0]?.toUpperCase() || '#';
        if (primeira !== letraAtiva) return false;
      }
      return true;
    });
  }, [dados, filtro, busca, letraAtiva]);

  const letras = useMemo(() => {
    const set = new Set(dados.map(a => a.nome_completo.trim()[0]?.toUpperCase() || '#'));
    return Array.from(set).sort();
  }, [dados]);

  const grupos = useMemo(() => {
    const map: Record<string, AcervoAluno[]> = {};
    for (const a of filtrados) {
      const l = a.nome_completo.trim()[0]?.toUpperCase() || '#';
      if (!map[l]) map[l] = [];
      map[l].push(a);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtrados]);

  const stats = useMemo(() => ({
    total: dados.length,
    completos: dados.filter(a => a.completo).length,
    incompletos: dados.filter(a => !a.completo).length,
    lgpd_pendente: dados.filter(a => !a.lgpd_aceito).length,
  }), [dados]);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total de Alunos', val: stats.total,         cls: 'text-purple-600' },
          { label: 'Dossiê Completo', val: stats.completos,     cls: 'text-green-600' },
          { label: 'Docs Faltando',   val: stats.incompletos,   cls: 'text-red-500' },
          { label: 'LGPD Pendente',   val: stats.lgpd_pendente, cls: stats.lgpd_pendente > 0 ? 'text-orange-500' : 'text-green-600' },
        ].map(k => (
          <div key={k.label} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{k.label}</p>
            <p className={`text-3xl font-black ${k.cls}`}>{k.val}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar aluno..."
            className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
        <div className="flex gap-1">
          {(['todos','completos','incompletos','lgpd_pendente'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                ${filtro === f
                  ? f === 'lgpd_pendente' ? 'bg-orange-500 text-white' : 'bg-purple-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-800'}`}>
              {f === 'todos' ? 'Todos' : f === 'completos' ? 'Completos' : f === 'incompletos' ? 'Incompletos' : '⚠ LGPD Pendente'}
            </button>
          ))}
        </div>
        <button onClick={() => { exportarAcervoXLSX(filtrados); }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all ml-auto">
          <FileText size={13} /> Exportar Excel
        </button>
        <button onClick={load} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-purple-100 text-slate-500 hover:text-purple-600 transition-all">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filtro por letra */}
      <div className="flex flex-wrap gap-1">
        <button onClick={() => setLetraAtiva(null)}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all
            ${!letraAtiva ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-800'}`}>
          Todas
        </button>
        {letras.map(l => (
          <button key={l} onClick={() => setLetraAtiva(l === letraAtiva ? null : l)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all
              ${letraAtiva === l ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-800'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-16 text-slate-400 text-sm">Carregando acervo...</div>
      ) : grupos.length === 0 ? (
        <div className="flex justify-center py-16 text-slate-400 text-sm">Nenhum aluno encontrado.</div>
      ) : (
        <div className="space-y-6">
          {grupos.map(([letra, lista]) => (
            <div key={letra}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center text-white font-black text-sm shadow">
                  {letra}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {lista.length} aluno{lista.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-2">
                {lista.map(a => {
                  const wa = whatsappLink(a.celular || a.telefone_alternativo);
                  return (
                    <div key={a.aluno_id}
                      className={`bg-white dark:bg-slate-900 rounded-2xl border shadow-sm p-4 flex flex-wrap gap-4 items-start
                        ${a.completo ? 'border-green-100 dark:border-green-900/30' : 'border-red-100 dark:border-red-900/30'}`}>
                      <div className="flex-1 min-w-[180px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{a.nome_completo}</span>
                          {a.turmas.length > 0 && a.turmas.map(t => (
                            <span key={t} className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                              {t}
                            </span>
                          ))}
                          {a.cuidado_especial && a.cuidado_especial !== 'Não' && (() => {
                            const b = CUIDADO_BADGE[a.cuidado_especial] || { label: 'Cuidado Espec.', color: 'bg-pink-100 text-pink-700 border-pink-200' };
                            return <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${b.color}`}>{b.label}</span>;
                          })()}
                        </div>
                        {a.nome_responsavel && (
                          <p className="text-[10px] text-slate-400 mt-0.5">Resp.: <span className="text-slate-600 dark:text-slate-300">{a.nome_responsavel}</span></p>
                        )}
                        <div className="flex gap-3 mt-1 flex-wrap">
                          {wa && (
                            <a href={wa} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[10px] text-green-600 hover:text-green-700 font-bold transition-colors">
                              <Smartphone size={11} /> WhatsApp
                            </a>
                          )}
                          {a.celular && (
                            <span className="text-[10px] text-slate-400">{a.celular}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-1.5 flex-wrap items-center">
                        {DOCS_OBRIGATORIOS.map(doc => {
                          const ok = a.docs_presentes.includes(doc);
                          return (
                            <span key={doc}
                              title={DOCS_LABELS[doc]}
                              className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide
                                ${ok
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                              {ok ? '✓' : '✗'} {DOCS_LABELS[doc]}
                            </span>
                          );
                        })}
                      </div>

                      <div className="self-center flex flex-col gap-1.5 items-end">
                        <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest
                          ${a.completo
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                          {a.completo ? 'Completo' : `${a.docs_faltando.length} faltando`}
                        </span>
                        <span
                          title={a.lgpd_aceito && a.data_assinatura_lgpd
                            ? `Assinado em ${new Date(a.data_assinatura_lgpd).toLocaleDateString('pt-BR')}`
                            : 'Termo LGPD não assinado pelo responsável'}
                          className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest
                            ${a.lgpd_aceito
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 animate-pulse'}`}>
                          {a.lgpd_aceito ? '✓ LGPD' : '⚠ LGPD Pendente'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

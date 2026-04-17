'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Heart, TrendingUp, DollarSign, Search, X,
  Edit3, Trash2, AlertCircle, RefreshCw, Settings2,
} from 'lucide-react';
import api from '@/services/api';
import { useAuth } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Movimentacao {
  id: string;
  data?: string;
  nome: string;
  competencia?: string;
  tipo_movimentacao?: string;
  descricao?: string;
  plano_contas?: string;
  categoria?: string;
  status?: string;
  valor?: number;
  tipo_pessoa?: string;
  forma_pagamento?: string;
  recorrencia?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function moeda(v?: number | string) {
  if (v == null) return 'R$ 0,00';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dataFmt(d?: string) {
  if (!d) return '–';
  const [year, month, day] = d.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function DoacoesPage() {
  const { user } = useAuth();
  const [lista, setLista] = useState<Movimentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const { canDelete } = usePermissions(user);

  const loadDoacoes = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/financeiro/doacoes');
      setLista(r.data);
    } catch { setErro('Erro ao carregar doações.'); }
    setLoading(false);
  }, []);

  useEffect(() => { setIsMounted(true); loadDoacoes(); }, [loadDoacoes]);

  if (!isMounted) return <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#131b2e]" />;

  // KPIs
  const totalDoacoes = lista.reduce((s, m) => s + Number(m.valor ?? 0), 0);
  const totalConfirmadas = lista.filter(m => m.status === 'Pago' || m.status === 'Confirmado').reduce((s, m) => s + Number(m.valor ?? 0), 0);
  const totalPendentes = lista.filter(m => m.status === 'Pendente').reduce((s, m) => s + Number(m.valor ?? 0), 0);

  const filtrados = lista.filter(m =>
    m.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (m.descricao ?? '').toLowerCase().includes(busca.toLowerCase()) ||
    (m.plano_contas ?? '').toLowerCase().includes(busca.toLowerCase()),
  );

  const podeExcluir = canDelete;

  const handleDeletar = async (id: string) => {
    if (!confirm('Confirmar exclusão desta doação?')) return;
    try { await api.delete(`/financeiro/movimentacoes/${id}`); loadDoacoes(); }
    catch (e: any) { alert(e.response?.data?.message || 'Erro ao excluir.'); }
  };

  const statusCor = (s?: string) => {
    if (s === 'Pago' || s === 'Confirmado') return 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
    if (s === 'Pendente') return 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
    if (s === 'Cancelado') return 'bg-red-50 text-red-500 border-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
    return 'bg-slate-50 text-slate-500 border-slate-100 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600';
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#131b2e] p-4 md:p-8 font-sans antialiased text-slate-900 dark:text-slate-100">
      <div className="max-w-[1600px] mx-auto">

        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">
                Módulo Doações
              </span>
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                <Settings2 size={12} /> Captação e Transparência
              </span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter italic">
              Doações<span className="text-rose-500">.ITP</span>
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              Todas as movimentações financeiras com categoria &quot;Doação&quot;
            </p>
          </div>
          <button onClick={loadDoacoes}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:border-rose-400 hover:text-rose-500 transition-all text-[10px] font-black uppercase tracking-widest shadow-sm">
            <RefreshCw size={13} />
            Atualizar
          </button>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 flex items-center gap-4 shadow-sm">
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-900/30">
              <Heart size={22} className="text-rose-500" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Doações</p>
              <p className="text-xl font-black text-rose-500 tracking-tight">{moeda(totalDoacoes)}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 flex items-center gap-4 shadow-sm">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/30">
              <TrendingUp size={22} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Confirmadas</p>
              <p className="text-xl font-black text-emerald-600 tracking-tight">{moeda(totalConfirmadas)}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 flex items-center gap-4 shadow-sm">
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/30">
              <DollarSign size={22} className="text-amber-500" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pendentes</p>
              <p className="text-xl font-black text-amber-500 tracking-tight">{moeda(totalPendentes)}</p>
            </div>
          </div>
        </div>

        {/* INFO BANNER */}
        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl px-5 py-3 mb-6 flex items-center gap-3">
          <Heart size={16} className="text-rose-500 shrink-0" />
          <p className="text-xs text-rose-700 dark:text-rose-300 font-semibold">
            Este módulo exibe automaticamente todas as movimentações financeiras cadastradas com a categoria <strong>&quot;Doação&quot;</strong>.
            Para criar ou editar doações, acesse o <strong>Módulo Financeiro</strong> e selecione a categoria &quot;Doação&quot;.
          </p>
        </div>

        {/* BUSCA */}
        {erro && (
          <div className="flex items-start gap-2 rounded-xl p-3 border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 mb-4">
            <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-600 dark:text-red-400 font-semibold flex-1">{erro}</p>
            <button onClick={() => setErro('')} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={12} /></button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar doação por nome, descrição ou plano de contas..."
              className="w-full pl-8 pr-3 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-400" />
          </div>
        </div>

        {/* TABELA */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-sm text-slate-400 dark:text-slate-500 font-bold">Carregando...</div>
          ) : filtrados.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400 dark:text-slate-500 font-bold">Nenhuma doação encontrada.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-600">
                  <tr className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                    <th className="text-left px-4 py-4">Data</th>
                    <th className="text-left px-4 py-4">Nome</th>
                    <th className="text-left px-4 py-4">Competência</th>
                    <th className="text-left px-4 py-4">Plano Contas</th>
                    <th className="text-left px-4 py-4">Descrição</th>
                    <th className="text-center px-4 py-4">Status</th>
                    <th className="text-right px-4 py-4">Valor</th>
                    <th className="text-left px-4 py-4">Tipo Pessoa</th>
                    <th className="text-left px-4 py-4">Forma Pgto</th>
                    <th className="text-left px-4 py-4">Recorrência</th>
                    <th className="text-right px-4 py-4">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                  {filtrados.map(m => (
                    <tr key={m.id} className="hover:bg-rose-50/30 dark:hover:bg-rose-900/20 transition-colors">
                      <td className="px-4 py-3 text-xs font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">{dataFmt(m.data)}</td>
                      <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100 text-sm max-w-[160px] truncate">{m.nome}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{m.competencia || '–'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{m.plano_contas || '–'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate">{m.descricao || '–'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${statusCor(m.status)}`}>
                          {m.status || '–'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                        {moeda(m.valor)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{m.tipo_pessoa || '–'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{m.forma_pagamento || '–'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{m.recorrencia || '–'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {podeExcluir && (
                            <button onClick={() => handleDeletar(m.id)} className="p-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"><Trash2 size={11} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

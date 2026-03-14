'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Plus, Search, X,
  Edit3, Trash2, AlertCircle, RefreshCw, Settings2,
} from 'lucide-react';
import api from '@/services/api';
import { useAuth } from '@/context/auth-context';

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

interface LookupItem { id: string; nome: string; ativo?: boolean; }

// ─── Helpers de formatação ────────────────────────────────────────────────────

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

export default function FinanceiroPage() {
  const { user } = useAuth();
  const [lista, setLista] = useState<Movimentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState<{ aberto: boolean; editando: Movimentacao | null }>({ aberto: false, editando: null });
  const [form, setForm] = useState<Partial<Movimentacao>>({ status: 'Pendente' });
  const [salvando, setSalvando] = useState(false);

  // Lookups
  const [tiposMov, setTiposMov] = useState<LookupItem[]>([]);
  const [planos, setPlanos] = useState<LookupItem[]>([]);
  const [categorias, setCategorias] = useState<LookupItem[]>([]);
  const [tiposPessoa, setTiposPessoa] = useState<LookupItem[]>([]);
  const [formasPag, setFormasPag] = useState<LookupItem[]>([]);
  const [recorrencias, setRecorrencias] = useState<LookupItem[]>([]);

  const [isMounted, setIsMounted] = useState(false);

  const loadLookups = useCallback(async () => {
    const endpoints = [
      '/financeiro/tipos-movimentacao',
      '/financeiro/planos-contas',
      '/financeiro/categorias',
      '/financeiro/tipos-pessoa',
      '/financeiro/formas-pagamento',
      '/financeiro/recorrencias',
    ];
    const results = await Promise.allSettled(endpoints.map(e => api.get(e)));
    const get = (i: number) => {
      const r = results[i];
      return r.status === 'fulfilled' && Array.isArray(r.value.data) ? r.value.data.filter((x: LookupItem) => x.ativo !== false) : [];
    };
    setTiposMov(get(0));
    setPlanos(get(1));
    setCategorias(get(2));
    setTiposPessoa(get(3));
    setFormasPag(get(4));
    setRecorrencias(get(5));
  }, []);

  const loadMovimentacoes = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/financeiro/movimentacoes');
      setLista(r.data);
    } catch { setErro('Erro ao carregar movimentações.'); }
    setLoading(false);
  }, []);

  useEffect(() => {
    setIsMounted(true);
    loadLookups();
    loadMovimentacoes();
  }, [loadLookups, loadMovimentacoes]);

  const abrirCriar = () => { setForm({ status: 'Pendente', data: new Date().toISOString().slice(0, 10) }); setModal({ aberto: true, editando: null }); };
  const abrirEditar = (m: Movimentacao) => {
    setForm({
      data: m.data?.slice(0, 10), nome: m.nome, competencia: m.competencia,
      tipo_movimentacao: m.tipo_movimentacao, descricao: m.descricao,
      plano_contas: m.plano_contas, categoria: m.categoria, status: m.status,
      valor: m.valor != null ? String(m.valor) : '', tipo_pessoa: m.tipo_pessoa,
      forma_pagamento: m.forma_pagamento, recorrencia: m.recorrencia,
    });
    setModal({ aberto: true, editando: m });
  };
  const fecharModal = () => { setModal({ aberto: false, editando: null }); setForm({ status: 'Pendente' }); setErro(''); };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault(); setSalvando(true); setErro('');
    try {
      const payload = { ...form, valor: form.valor !== '' && form.valor != null ? parseFloat(String(form.valor).replace(',', '.')) : undefined };
      if (modal.editando) await api.patch(`/financeiro/movimentacoes/${modal.editando.id}`, payload);
      else await api.post('/financeiro/movimentacoes', payload);
      fecharModal(); loadMovimentacoes();
    } catch (e: any) { setErro(e.response?.data?.message || 'Erro ao salvar.'); }
    setSalvando(false);
  };

  const handleDeletar = async (id: string) => {
    if (!confirm('Confirmar exclusão da movimentação?')) return;
    try { await api.delete(`/financeiro/movimentacoes/${id}`); loadMovimentacoes(); }
    catch (e: any) { alert(e.response?.data?.message || 'Erro ao excluir.'); }
  };

  if (!isMounted) return <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#131b2e]" />;

  // KPIs
  const totalEntradas = lista.filter(m => m.tipo_movimentacao === 'Entrada').reduce((s, m) => s + Number(m.valor ?? 0), 0);
  const totalSaidas = lista.filter(m => m.tipo_movimentacao === 'Saída').reduce((s, m) => s + Number(m.valor ?? 0), 0);
  const saldo = totalEntradas - totalSaidas;

  const filtrados = lista.filter(m =>
    m.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (m.descricao ?? '').toLowerCase().includes(busca.toLowerCase()) ||
    (m.categoria ?? '').toLowerCase().includes(busca.toLowerCase()) ||
    (m.plano_contas ?? '').toLowerCase().includes(busca.toLowerCase()),
  );

  const ROLES_PODEM_DELETAR = ['admin', 'prt', 'vp', 'drt', 'adjunto'];
  const podeExcluir = ROLES_PODEM_DELETAR.includes(user?.role ?? '');

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
              <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">
                Módulo Financeiro
              </span>
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                <Settings2 size={12} /> Gestão de Fluxo de Caixa
              </span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter italic">
              Financeiro<span className="text-emerald-600">.ITP</span>
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              Movimentações financeiras centralizadas
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { loadMovimentacoes(); loadLookups(); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-600 transition-all text-[10px] font-black uppercase tracking-widest shadow-sm">
              <RefreshCw size={13} />
              Atualizar
            </button>
            <button onClick={abrirCriar}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 transition-colors shadow-sm">
              <Plus size={14} strokeWidth={3} /> Nova Movimentação
            </button>
          </div>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 flex items-center gap-4 shadow-sm">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/30">
              <TrendingUp size={22} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Entradas</p>
              <p className="text-xl font-black text-emerald-600 tracking-tight">{moeda(totalEntradas)}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 flex items-center gap-4 shadow-sm">
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/30">
              <TrendingDown size={22} className="text-red-500" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Saídas</p>
              <p className="text-xl font-black text-red-500 tracking-tight">{moeda(totalSaidas)}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 flex items-center gap-4 shadow-sm">
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30">
              <DollarSign size={22} className="text-blue-600" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Saldo</p>
              <p className={`text-xl font-black tracking-tight ${saldo >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{moeda(saldo)}</p>
            </div>
          </div>
        </div>

        {/* BARRA DE BUSCA */}
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
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, descrição, categoria ou plano de contas..."
              className="w-full pl-8 pr-3 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
        </div>

        {/* TABELA */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-sm text-slate-400 dark:text-slate-500 font-bold">Carregando...</div>
          ) : filtrados.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400 dark:text-slate-500 font-bold">Nenhuma movimentação encontrada.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-600">
                  <tr className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                    <th className="text-left px-4 py-4">Data</th>
                    <th className="text-left px-4 py-4">Nome</th>
                    <th className="text-left px-4 py-4">Competência</th>
                    <th className="text-left px-4 py-4">Tipo</th>
                    <th className="text-left px-4 py-4">Plano Contas</th>
                    <th className="text-left px-4 py-4">Categoria</th>
                    <th className="text-center px-4 py-4">Status</th>
                    <th className="text-right px-4 py-4">Valor</th>
                    <th className="text-left px-4 py-4">Forma Pgto</th>
                    <th className="text-left px-4 py-4">Recorrência</th>
                    <th className="text-right px-4 py-4">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                  {filtrados.map(m => (
                    <tr key={m.id} className="hover:bg-emerald-50/30 dark:hover:bg-emerald-900/20 transition-colors">
                      <td className="px-4 py-3 text-xs font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">{dataFmt(m.data)}</td>
                      <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100 text-sm max-w-[160px] truncate">{m.nome}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{m.competencia || '–'}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${
                          m.tipo_movimentacao === 'Entrada'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                            : 'bg-red-50 text-red-500 border-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
                        }`}>{m.tipo_movimentacao || '–'}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{m.plano_contas || '–'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{m.categoria || '–'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${statusCor(m.status)}`}>
                          {m.status || '–'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                        {moeda(m.valor)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{m.forma_pagamento || '–'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{m.recorrencia || '–'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => abrirEditar(m)} className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"><Edit3 size={11} /></button>
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

        {/* MODAL */}
        {modal.aberto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-700">
                <h2 className="text-sm font-black uppercase tracking-tight text-slate-800 dark:text-slate-100">
                  {modal.editando ? 'Editar Movimentação' : 'Nova Movimentação'}
                </h2>
                <button onClick={fecharModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="px-6 py-5">
                <form onSubmit={handleSalvar} className="space-y-4">
                  {erro && (
                    <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
                      <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-600 dark:text-red-400 font-semibold">{erro}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FInput label="Nome *" value={form.nome ?? ''} onChange={v => setForm(p => ({ ...p, nome: v }))} required />
                    <FInput label="Data" type="date" value={form.data ?? ''} onChange={v => setForm(p => ({ ...p, data: v }))} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FInput label="Competência" value={form.competencia ?? ''} onChange={v => setForm(p => ({ ...p, competencia: v }))} placeholder="Ex: Jun/2025" />
                    <FInput label="Valor *" type="number" step="0.01" value={form.valor ?? ''} onChange={v => setForm(p => ({ ...p, valor: v }))} placeholder="0.00" required />
                  </div>

                  <FInput label="Descrição" value={form.descricao ?? ''} onChange={v => setForm(p => ({ ...p, descricao: v }))} />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FSelect label="Tipo Movimentação" value={form.tipo_movimentacao ?? ''} onChange={v => setForm(p => ({ ...p, tipo_movimentacao: v }))}>
                      <option value="">Selecione...</option>
                      {tiposMov.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                    </FSelect>
                    <FSelect label="Plano de Contas" value={form.plano_contas ?? ''} onChange={v => setForm(p => ({ ...p, plano_contas: v }))}>
                      <option value="">Selecione...</option>
                      {planos.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                    </FSelect>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FSelect label="Categoria" value={form.categoria ?? ''} onChange={v => setForm(p => ({ ...p, categoria: v }))}>
                      <option value="">Selecione...</option>
                      {categorias.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                    </FSelect>
                    <FSelect label="Status" value={form.status ?? 'Pendente'} onChange={v => setForm(p => ({ ...p, status: v }))}>
                      <option value="Pendente">Pendente</option>
                      <option value="Pago">Pago</option>
                      <option value="Confirmado">Confirmado</option>
                      <option value="Cancelado">Cancelado</option>
                    </FSelect>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <FSelect label="Tipo Pessoa" value={form.tipo_pessoa ?? ''} onChange={v => setForm(p => ({ ...p, tipo_pessoa: v }))}>
                      <option value="">Selecione...</option>
                      {tiposPessoa.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                    </FSelect>
                    <FSelect label="Forma de Pagamento" value={form.forma_pagamento ?? ''} onChange={v => setForm(p => ({ ...p, forma_pagamento: v }))}>
                      <option value="">Selecione...</option>
                      {formasPag.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                    </FSelect>
                    <FSelect label="Recorrência" value={form.recorrencia ?? ''} onChange={v => setForm(p => ({ ...p, recorrencia: v }))}>
                      <option value="">Selecione...</option>
                      {recorrencias.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                    </FSelect>
                  </div>

                  <button type="submit" disabled={salvando}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-colors disabled:opacity-60">
                    {salvando ? 'Salvando...' : modal.editando ? 'Atualizar' : 'Cadastrar'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Sub-Componentes ──────────────────────────────────────────────────────────

function FInput({ label, value, onChange, type = 'text', required, placeholder, step }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; placeholder?: string; step?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required} step={step}
        className="w-full border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-shadow" />
    </div>
  );
}

function FSelect({ label, value, onChange, children, required }: {
  label: string; value: string; onChange: (v: string) => void;
  children: React.ReactNode; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} required={required}
        className="w-full border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-shadow">
        {children}
      </select>
    </div>
  );
}

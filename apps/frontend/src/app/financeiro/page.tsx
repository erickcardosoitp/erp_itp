'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Plus, Search, X,
  Edit3, Trash2, AlertCircle, RefreshCw, Settings2,
  FileBarChart2, ChevronDown, ChevronUp, Upload, CheckCircle2,
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
  usuario_nome?: string;
}

interface LookupItem { id: string; nome: string; ativo?: boolean; }

// Form usa valor como string para permitir digitação com decimais
interface FormMovimentacao extends Omit<Partial<Movimentacao>, 'valor'> {
  valor?: string;
}

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

// ─── Scanner de Código de Barras ──────────────────────────────────────────────

const BANCOS: Record<string, string> = {
  '001': 'Banco do Brasil', '003': 'Banco da Amazônia', '004': 'Banco do Nordeste',
  '033': 'Santander', '041': 'Banrisul', '047': 'Banese', '070': 'BRB',
  '077': 'Banco Inter', '085': 'CECRED', '099': 'Uniprime', '104': 'Caixa Econômica Federal',
  '136': 'Unicred', '197': 'Stone', '208': 'BTG Pactual', '212': 'Banco Original',
  '237': 'Bradesco', '260': 'Nubank', '290': 'PagSeguro', '318': 'Banco BMG',
  '336': 'Banco C6', '341': 'Itaú Unibanco', '364': 'Gerencianet', '403': 'Cora',
  '422': 'Banco Safra', '536': 'Neon', '611': 'Banco Paulista', '623': 'Banco Pan',
  '633': 'Rendimento', '637': 'Sofisa', '655': 'Votorantim', '707': 'Daycoval',
  '745': 'Citibank', '748': 'Sicredi', '756': 'Sicoob',
};

interface BarcodeInfo {
  raw: string;
  banco: string;
  bancoCode: string;
  valor: number | null;
  vencimento: string | null;
  valido: boolean;
}

function parsearCodigoBarras(codigo: string): BarcodeInfo {
  const clean = codigo.replace(/\D/g, '');
  let barcode = clean;

  // Linha digitável (47 dígitos) → código de barras 44 dígitos (padrão FEBRABAN)
  // Estrutura linha digitável: bank(3)+moeda(1)+campoLivre_pt1(5)+check1(1) | campoLivre_pt2(10)+check2(1) | campoLivre_pt3(10)+check3(1) | checkGeral(1) | fator(4) | valor(10)
  // Estrutura barcode 44 dígitos: bank(3)+moeda(1)+checkGeral(1)+fator(4)+valor(10)+campoLivre(25)
  if (clean.length === 47) {
    const banco    = clean.substring(0, 3);
    const moeda    = clean.substring(3, 4);
    const campoLivre = clean.substring(4, 9) + clean.substring(10, 20) + clean.substring(21, 31);
    const checkGeral = clean.substring(32, 33);
    const fator    = clean.substring(33, 37);
    const valor    = clean.substring(37, 47);
    barcode = banco + moeda + checkGeral + fator + valor + campoLivre;
  }

  if (barcode.length !== 44) {
    return { raw: clean, banco: '', bancoCode: '', valor: null, vencimento: null, valido: false };
  }

  // Posições no código de barras 44 dígitos (FEBRABAN):
  // [0-2] banco, [3] moeda, [4] check geral, [5-8] fator vencimento, [9-18] valor, [19-43] campo livre
  const bancoCode = barcode.substring(0, 3);
  const fatorStr  = barcode.substring(5, 9);
  const valorStr  = barcode.substring(9, 19);

  const banco = BANCOS[bancoCode] ?? `Banco ${bancoCode}`;
  const valor = parseInt(valorStr) === 0 ? null : parseInt(valorStr) / 100;

  let vencimento: string | null = null;
  const fator = parseInt(fatorStr);
  if (fator > 0) {
    // Ciclo antigo: base 07/10/1997, fator 9999 esgotou-se em 21/02/2025
    const baseAntiga = new Date('1997-10-07T00:00:00Z');
    baseAntiga.setUTCDate(baseAntiga.getUTCDate() + fator);

    // Novo ciclo BACEN (22/02/2025): fator reinicia em 1000 com nova base
    // Se a data pelo ciclo antigo estiver mais de 2 anos no passado, usar novo ciclo
    const limitePassado = new Date();
    limitePassado.setFullYear(limitePassado.getFullYear() - 2);

    if (baseAntiga < limitePassado) {
      const novaBase = new Date('2025-02-22T00:00:00Z');
      novaBase.setUTCDate(novaBase.getUTCDate() + (fator - 1000));
      vencimento = novaBase.toISOString().slice(0, 10);
    } else {
      vencimento = baseAntiga.toISOString().slice(0, 10);
    }
  }

  return { raw: barcode, banco, bancoCode, valor, vencimento, valido: true };
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function FinanceiroPage() {
  const { user } = useAuth();
  const [lista, setLista] = useState<Movimentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [marcandoPago, setMarcandoPago] = useState<string | null>(null);
  const [modal, setModal] = useState<{ aberto: boolean; editando: Movimentacao | null }>({ aberto: false, editando: null });
  const [form, setForm] = useState<FormMovimentacao>({ status: 'Pendente' });
  const [salvando, setSalvando] = useState(false);

  // Lookups
  const [tiposMov, setTiposMov] = useState<LookupItem[]>([]);
  const [planos, setPlanos] = useState<LookupItem[]>([]);
  const [categorias, setCategorias] = useState<LookupItem[]>([]);
  const [tiposPessoa, setTiposPessoa] = useState<LookupItem[]>([]);
  const [formasPag, setFormasPag] = useState<LookupItem[]>([]);
  const [recorrencias, setRecorrencias] = useState<LookupItem[]>([]);

  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'movimentacoes' | 'boletos'>('movimentacoes');
  const { canDelete, canAccess } = usePermissions(user);

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

  const handleMarcarPago = async (id: string) => {
    setMarcandoPago(id);
    try { await api.patch(`/financeiro/movimentacoes/${id}`, { status: 'Pago' }); loadMovimentacoes(); }
    catch { /* silent */ }
    setMarcandoPago(null);
  };

  const filtrados = lista.filter(m => {
    const texto = busca.toLowerCase();
    if (texto && !m.nome.toLowerCase().includes(texto) && !(m.descricao ?? '').toLowerCase().includes(texto) && !(m.categoria ?? '').toLowerCase().includes(texto)) return false;
    if (filtroTipo && m.tipo_movimentacao !== filtroTipo) return false;
    if (filtroStatus && m.status !== filtroStatus) return false;
    if (filtroMes && m.data && !m.data.startsWith(filtroMes)) return false;
    return true;
  });

  const podeEscrever = canAccess('financeiro', 'incluir');
  const podeEditar   = canAccess('financeiro', 'editar');
  const podeExcluir  = canDelete && canAccess('financeiro', 'excluir');

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
          <div className="flex gap-3 flex-wrap">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
              {([['movimentacoes', 'Movimentações', DollarSign], ['boletos', 'Boletos a Receber', FileBarChart2]] as const).map(([id, label, Icon]) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${activeTab === id ? 'bg-emerald-600 text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
            <button onClick={() => { loadMovimentacoes(); loadLookups(); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-600 transition-all text-[10px] font-black uppercase tracking-widest shadow-sm">
              <RefreshCw size={13} />
              Atualizar
            </button>
            {podeEscrever && activeTab === 'movimentacoes' && (
              <button onClick={abrirCriar}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 transition-colors shadow-sm">
                <Plus size={14} strokeWidth={3} /> Nova Movimentação
              </button>
            )}
          </div>
        </header>

        {activeTab === 'boletos' && <BoletosTab podeEscrever={podeEscrever} podeEditar={podeEditar} podeExcluir={podeExcluir} />}

        {activeTab === 'movimentacoes' && <>
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

        <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm mb-6">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, descrição ou categoria..."
              className="w-full pl-8 pr-3 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
            className="border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400">
            <option value="">Todos os tipos</option>
            <option value="Entrada">Entrada</option>
            <option value="Saída">Saída</option>
          </select>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
            className="border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400">
            <option value="">Todos os status</option>
            <option value="Pendente">Pendente</option>
            <option value="Pago">Pago</option>
            <option value="Confirmado">Confirmado</option>
            <option value="Cancelado">Cancelado</option>
          </select>
          <input type="month" value={filtroMes} onChange={e => setFiltroMes(e.target.value)}
            className="border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          {(busca || filtroTipo || filtroStatus || filtroMes) && (
            <button onClick={() => { setBusca(''); setFiltroTipo(''); setFiltroStatus(''); setFiltroMes(''); }}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-red-500 transition-colors">
              <X size={12} />Limpar filtros
            </button>
          )}
          <span className="text-[10px] text-slate-400 ml-auto">{filtrados.length} de {lista.length}</span>
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
                    <th className="text-left px-4 py-4">Lançado por</th>
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
                      <td className="px-4 py-3 text-xs text-slate-400 max-w-[120px] truncate">{m.usuario_nome || '–'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {podeEditar && m.status === 'Pendente' && (
                            <button onClick={() => handleMarcarPago(m.id)} disabled={marcandoPago === m.id}
                              title="Marcar como Pago"
                              className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 hover:bg-emerald-100 text-[10px] font-black transition-colors disabled:opacity-50">
                              {marcandoPago === m.id ? '...' : '✓ Pago'}
                            </button>
                          )}
                          {podeEditar && (
                            <button onClick={() => abrirEditar(m)} className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"><Edit3 size={11} /></button>
                          )}
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

        </>}

      </div>
    </div>
  );
}

// ─── Boletos a Receber ────────────────────────────────────────────────────────

interface Boleto {
  id: string;
  recebedor: string;
  credor: string;
  cnpj?: string;
  valor: number;
  cod_barras?: string;
  data_emissao: string;
  parcelado: boolean;
  qtd_parcelas: number;
  status: string;
  arquivo_base64?: string;
  arquivo_nome?: string;
  descricao?: string;
  pessoa_nome?: string;
  pessoa_tipo?: string;
  parcelas: BoletoParcela[];
}

interface BoletoParcela {
  id: string;
  boleto_id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  data_pagamento?: string | null;
  pago: boolean;
  movimentacao_id?: string;
  cod_barras?: string | null;
}

function BoletosTab({ podeEscrever, podeEditar, podeExcluir }: { podeEscrever: boolean; podeEditar: boolean; podeExcluir: boolean }) {
  const [boletos, setBoletos] = useState<Boleto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [expandido, setExpandido] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>({ parcelado: false, qtd_parcelas: 1, status: 'Pendente', data_emissao: new Date().toISOString().slice(0, 10), data_vencimento: '' });
  const [parcelas, setParcelas] = useState<{ valor: string; data_vencimento: string; cod_barras: string }[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [pagandoParcela, setPagandoParcela] = useState<string | null>(null);

  // ── Pessoa selector ──
  const [pessoaBusca, setPessoaBusca] = useState('');
  const [pessoaResultados, setPessoaResultados] = useState<any[]>([]);
  const [pessoaBuscando, setPessoaBuscando] = useState(false);

  useEffect(() => {
    if (pessoaBusca.length < 2) { setPessoaResultados([]); return; }
    const t = setTimeout(async () => {
      setPessoaBuscando(true);
      try {
        const r = await api.get(`/financeiro/buscar-pessoa?q=${encodeURIComponent(pessoaBusca)}`);
        setPessoaResultados(Array.isArray(r.data) ? r.data : []);
      } catch { setPessoaResultados([]); }
      setPessoaBuscando(false);
    }, 350);
    return () => clearTimeout(t);
  }, [pessoaBusca]);


  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/financeiro/boletos');
      setBoletos(Array.isArray(r.data) ? r.data : []);
    } catch {}
    setLoading(false);
    // Gera notificações para parcelas a vencer nos próximos 7 dias (fire-and-forget)
    api.post('/financeiro/boletos/alertar-vencimentos', { dias: 7 }).catch(() => {});
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const filtrados = boletos.filter(b => {
    const q = busca.toLowerCase();
    const matchBusca = !q || (b.descricao ?? '').toLowerCase().includes(q) || b.credor.toLowerCase().includes(q) || b.recebedor.toLowerCase().includes(q) || (b.cod_barras ?? '').includes(q);
    const matchStatus = !filtroStatus || b.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  const gerarParcelas = (qtd: number, valorTotal: number, dataEmissao: string) => {
    const valorParcela = Math.round((valorTotal / qtd) * 100) / 100;
    return Array.from({ length: qtd }, (_, i) => {
      const d = new Date(dataEmissao);
      d.setMonth(d.getMonth() + i + 1);
      return { valor: String(valorParcela), data_vencimento: d.toISOString().slice(0, 10), cod_barras: '' };
    });
  };

  const handleQtdParcelas = (qtd: number) => {
    setForm((f: any) => ({ ...f, qtd_parcelas: qtd }));
    if (qtd > 1) setParcelas(gerarParcelas(qtd, parseFloat(form.valor) || 0, form.data_emissao));
    else setParcelas([]);
  };

  const handleArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f: any) => ({ ...f, arquivo_base64: reader.result as string, arquivo_nome: file.name }));
    };
    reader.readAsDataURL(file);
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const valorNum = parseFloat(String(form.valor).replace(',', '.'));
      let parcelasPayload: { valor: number; data_vencimento: string; cod_barras?: string | null }[] = [];
      if (form.parcelado && parcelas.length > 0) {
        parcelasPayload = parcelas.map(p => ({ valor: parseFloat(p.valor), data_vencimento: p.data_vencimento, cod_barras: p.cod_barras || null }));
      } else if (!form.parcelado && form.data_vencimento) {
        // à vista com vencimento extraído do código de barras
        parcelasPayload = [{ valor: valorNum, data_vencimento: form.data_vencimento, cod_barras: form.cod_barras || null }];
      }
      const payload = { ...form, valor: valorNum, parcelas: parcelasPayload };
      await api.post('/financeiro/boletos', payload);
      setModal(false);
      setForm({ parcelado: false, qtd_parcelas: 1, status: 'Pendente', data_emissao: new Date().toISOString().slice(0, 10), data_vencimento: '', pessoa_nome: '', pessoa_tipo: '', cod_barras: '' });
      setParcelas([]);
      setPessoaBusca('');
      carregar();
    } catch {}
    setSalvando(false);
  };

  const deletar = async (id: string) => {
    if (!confirm('Excluir este boleto e suas parcelas?')) return;
    await api.delete(`/financeiro/boletos/${id}`);
    carregar();
  };

  const pagarParcela = async (parcelaId: string, dataPagamento: string) => {
    setPagandoParcela(parcelaId);
    try {
      await api.patch(`/financeiro/boletos/parcelas/${parcelaId}/pagar`, { data_pagamento: dataPagamento });
      carregar();
    } catch {}
    setPagandoParcela(null);
  };

  const totalPendente = boletos.flatMap(b => b.parcelas).filter(p => !p.pago).reduce((s, p) => s + Number(p.valor), 0);
  const totalRecebido = boletos.flatMap(b => b.parcelas).filter(p => p.pago).reduce((s, p) => s + Number(p.valor), 0);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/30"><CheckCircle2 size={22} className="text-emerald-600"/></div>
          <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Recebido</p><p className="text-xl font-black text-emerald-600">{moeda(totalRecebido)}</p></div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/30"><AlertCircle size={22} className="text-amber-500"/></div>
          <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">A Receber</p><p className="text-xl font-black text-amber-500">{moeda(totalPendente)}</p></div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30"><FileBarChart2 size={22} className="text-blue-500"/></div>
          <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Boletos</p><p className="text-xl font-black text-blue-600">{boletos.length}</p></div>
        </div>
      </div>

      {/* Banner: parcelas a vencer em até 7 dias */}
      {(() => {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const limite = new Date(hoje);
        limite.setDate(limite.getDate() + 7);
        const urgentes = boletos.flatMap(b =>
          b.parcelas
            .filter(p => {
              if (p.pago) return false;
              const d = new Date(p.data_vencimento + 'T12:00:00');
              return d >= hoje && d <= limite;
            })
            .map(p => ({ ...p, boleto: b }))
        ).sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
        if (!urgentes.length) return null;
        return (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-600 shrink-0" />
              <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                {urgentes.length} parcela{urgentes.length > 1 ? 's' : ''} a vencer nos próximos 7 dias
              </p>
            </div>
            <div className="space-y-1">
              {urgentes.map(p => {
                const dias = Math.ceil((new Date(p.data_vencimento + 'T12:00:00').getTime() - hoje.getTime()) / 86400000);
                const label = p.boleto.descricao || p.boleto.credor;
                return (
                  <div key={p.id} className="flex items-center justify-between text-xs bg-white dark:bg-slate-800 rounded-xl px-3 py-2 border border-amber-100 dark:border-amber-800">
                    <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[60%]">{label}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-slate-500">{dataFmt(p.data_vencimento)}</span>
                      <span className={`font-bold px-2 py-0.5 rounded-full ${dias === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {dias === 0 ? 'hoje' : `${dias}d`}
                      </span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">{moeda(p.valor)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-3 flex-wrap flex-1">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar credor, recebedor, código de barras..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
          <select
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700"
          >
            <option value="">Todos os status</option>
            <option>Pendente</option>
            <option>Pago</option>
          </select>
        </div>
        {podeEscrever && (
          <button
            onClick={() => setModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors"
          >
            <Plus size={14}/> Novo Boleto
          </button>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center text-slate-400 text-sm">Carregando...</div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center text-slate-400 text-sm">Nenhum boleto encontrado.</div>
      ) : (
        <div className="space-y-3">
          {filtrados.map(b => (
            <div key={b.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
              <div className="p-4 flex flex-wrap gap-4 items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-bold text-slate-800 dark:text-white">{b.descricao || b.credor}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${b.status === 'Pago' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                      {b.status}
                    </span>
                    {b.parcelado && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-xs">{b.qtd_parcelas}× parcelas</span>}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-3">
                    <span>Credor: <strong className="text-slate-700 dark:text-slate-300">{b.credor}</strong></span>
                    <span>Recebedor: <strong className="text-slate-700 dark:text-slate-300">{b.recebedor}</strong></span>
                    {b.cnpj && <span>CNPJ: {b.cnpj}</span>}
                    <span>Emissão: {dataFmt(b.data_emissao)}</span>
                    {b.cod_barras && <span className="font-mono text-[10px]">{b.cod_barras}</span>}
                  </div>
                  {b.pessoa_nome && (
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 font-semibold">{b.pessoa_tipo}</span>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{b.pessoa_nome}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-lg font-black text-emerald-600">{moeda(b.valor)}</div>
                    {b.arquivo_nome && (
                      <a href={b.arquivo_base64} download={b.arquivo_nome} className="text-xs text-blue-500 hover:underline flex items-center gap-1 justify-end mt-0.5">
                        <Upload size={10}/> {b.arquivo_nome}
                      </a>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => setExpandido(expandido === b.id ? null : b.id)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
                    >
                      {expandido === b.id ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                    </button>
                    {podeExcluir && (
                      <button onClick={() => deletar(b.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400"><Trash2 size={14}/></button>
                    )}
                  </div>
                </div>
              </div>

              {/* Parcelas expandidas */}
              {expandido === b.id && (
                <div className="border-t border-slate-100 dark:border-slate-700 p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Parcelas</p>
                  <div className="space-y-2">
                    {b.parcelas.map(p => (
                      <div key={p.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-bold text-slate-500">{p.numero_parcela}/{b.qtd_parcelas}</span>
                          <span className="font-semibold text-slate-800 dark:text-white">{moeda(p.valor)}</span>
                          <span className="text-xs text-slate-500">Venc.: {dataFmt(p.data_vencimento)}</span>
                          {p.pago && p.data_pagamento && <span className="text-xs text-emerald-600">Pago em {dataFmt(p.data_pagamento)}</span>}
                          {p.cod_barras && (
                            <button
                              onClick={() => navigator.clipboard.writeText(p.cod_barras!)}
                              title={p.cod_barras}
                              className="text-[10px] font-mono text-slate-400 hover:text-slate-700 underline underline-offset-2 max-w-[140px] truncate"
                            >
                              {p.cod_barras.length > 20 ? p.cod_barras.slice(0, 20) + '…' : p.cod_barras}
                            </button>
                          )}
                        </div>
                        <div>
                          {p.pago ? (
                            <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold"><CheckCircle2 size={13}/> Pago</span>
                          ) : podeEditar ? (
                            <button
                              disabled={pagandoParcela === p.id}
                              onClick={() => pagarParcela(p.id, new Date().toISOString().slice(0, 10))}
                              className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60"
                            >
                              {pagandoParcela === p.id ? '...' : 'Marcar pago'}
                            </button>
                          ) : (
                            <span className="text-xs text-amber-600 font-semibold">Pendente</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal novo boleto */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Novo Boleto a Receber</h3>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-700"><X size={18}/></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Descrição (título do boleto) *</label>
                <input value={form.descricao ?? ''} onChange={e => setForm((f: any) => ({ ...f, descricao: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-800" placeholder="Ex: Aluguel março, Conta de luz, Fornecedor X..." />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Credor (quem emitiu) *</label>
                <input value={form.credor ?? ''} onChange={e => setForm((f: any) => ({ ...f, credor: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-800" placeholder="Nome do credor" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Recebedor (quem vai pagar) *</label>
                <input value={form.recebedor ?? ''} onChange={e => setForm((f: any) => ({ ...f, recebedor: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-800" placeholder="Instituto Tiapretinha" />
              </div>

              {/* Referência de Pessoa */}
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Referência (Aluno / Funcionário / Candidato / Pessoa)</label>
                {form.pessoa_nome ? (
                  <div className="flex items-center justify-between bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 font-bold">{form.pessoa_tipo}</span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-white">{form.pessoa_nome}</span>
                    </div>
                    <button type="button" onClick={() => { setForm((f: any) => ({ ...f, pessoa_nome: '', pessoa_tipo: '' })); setPessoaBusca(''); }}
                      className="text-slate-400 hover:text-red-500 transition-colors"><X size={14}/></button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input
                      value={pessoaBusca}
                      onChange={e => setPessoaBusca(e.target.value)}
                      placeholder="Buscar por nome ou CPF/CNPJ..."
                      className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-800"
                    />
                    {pessoaBuscando && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">...</span>}
                    {pessoaResultados.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-lg overflow-hidden">
                        {pessoaResultados.map((p, i) => (
                          <button key={i} type="button"
                            onClick={() => {
                              setForm((f: any) => ({ ...f, pessoa_nome: p.nome, pessoa_tipo: p.tipo }));
                              setPessoaBusca('');
                              setPessoaResultados([]);
                            }}
                            className="w-full px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 font-bold shrink-0">{p.tipo}</span>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">{p.nome}</p>
                              {(p.cpf || p.referencia) && <p className="text-[10px] text-slate-400 truncate">{p.referencia ?? p.cpf}</p>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">CNPJ</label>
                <input value={form.cnpj ?? ''} onChange={e => setForm((f: any) => ({ ...f, cnpj: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-800" placeholder="00.000.000/0001-00" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Valor Total (R$) *</label>
                <input type="number" step="0.01" value={form.valor ?? ''} onChange={e => {
                  const val = e.target.value;
                  setForm((f: any) => ({ ...f, valor: val }));
                  if (form.parcelado && form.qtd_parcelas > 1) {
                    const v = parseFloat(val) || 0;
                    const vp = Math.round((v / form.qtd_parcelas) * 100) / 100;
                    setParcelas(prev => prev.map(p => ({ ...p, valor: String(vp) })));
                  }
                }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-800" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Data de Emissão *</label>
                <input type="date" value={form.data_emissao ?? ''} onChange={e => setForm((f: any) => ({ ...f, data_emissao: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-800" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Código de Barras</label>
                <input
                  value={form.cod_barras ?? ''}
                  onChange={e => {
                    const raw = e.target.value;
                    const digits = raw.replace(/\D/g, '');
                    const update: any = { cod_barras: raw };
                    if (digits.length === 44 || digits.length === 47) {
                      const info = parsearCodigoBarras(digits);
                      if (info.valido) {
                        if (info.valor && !form.valor) update.valor = String(info.valor);
                        if (info.vencimento && !form.data_vencimento) update.data_vencimento = info.vencimento;
                        if (info.banco && !form.credor) update.credor = info.banco;
                      }
                    }
                    setForm((f: any) => ({ ...f, ...update }));
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-800 font-mono"
                  placeholder="Bipe o código de barras ou cole os 44/47 dígitos"
                />
                {form.cod_barras && form.cod_barras.replace(/\D/g, '').length >= 44 && (() => {
                  const info = parsearCodigoBarras(form.cod_barras);
                  if (!info.valido) return null;
                  return (
                    <div className="mt-2 flex flex-wrap gap-3 text-xs bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl px-3 py-2">
                      {info.banco && <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{info.banco}</span>}
                      {info.valor !== null && <span className="text-emerald-700 dark:text-emerald-400 font-bold">{moeda(info.valor)}</span>}
                      {info.vencimento && <span className="text-slate-600 dark:text-slate-400">Venc.: <strong>{dataFmt(info.vencimento)}</strong></span>}
                    </div>
                  );
                })()}
              </div>
              {!form.parcelado && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Vencimento (à vista)</label>
                  <input type="date" value={form.data_vencimento ?? ''} onChange={e => setForm((f: any) => ({ ...f, data_vencimento: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-800" />
                </div>
              )}
              <div className="col-span-2 flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.parcelado ?? false} onChange={e => {
                    const checked = e.target.checked;
                    setForm((f: any) => ({ ...f, parcelado: checked }));
                    if (!checked) { setParcelas([]); }
                    else {
                      const qtd = form.qtd_parcelas > 1 ? form.qtd_parcelas : 2;
                      setForm((f: any) => ({ ...f, parcelado: true, qtd_parcelas: qtd }));
                      setParcelas(gerarParcelas(qtd, parseFloat(form.valor) || 0, form.data_emissao));
                    }
                  }}
                    className="rounded border-slate-300" />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Parcelado</span>
                </label>
                {form.parcelado && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">Qtd parcelas:</label>
                    <input type="number" min={2} max={24} value={form.qtd_parcelas ?? 1}
                      onChange={e => handleQtdParcelas(parseInt(e.target.value) || 1)}
                      className="w-16 px-2 py-1 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800" />
                  </div>
                )}
              </div>
              {form.parcelado && parcelas.length > 0 && (
                <div className="col-span-2 space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Parcelas</p>
                  {parcelas.map((p, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2 bg-slate-50 dark:bg-slate-800/50">
                      <p className="text-[10px] font-black text-slate-400 uppercase">Parcela {i + 1}/{parcelas.length}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400">Valor (R$)</label>
                          <input type="number" step="0.01" value={p.valor}
                            onChange={e => setParcelas(prev => prev.map((x, j) => j === i ? { ...x, valor: e.target.value } : x))}
                            className="w-full px-2 py-1 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">Vencimento</label>
                          <input type="date" value={p.data_vencimento}
                            onChange={e => setParcelas(prev => prev.map((x, j) => j === i ? { ...x, data_vencimento: e.target.value } : x))}
                            className="w-full px-2 py-1 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">Código de barras / chave (opcional)</label>
                        <input type="text" value={p.cod_barras} placeholder="Cole o código ou chave PIX desta parcela"
                          onChange={e => setParcelas(prev => prev.map((x, j) => j === i ? { ...x, cod_barras: e.target.value } : x))}
                          className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 font-mono" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Anexar boleto (PDF/imagem)</label>
                <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleArquivo}
                  className="w-full text-sm text-slate-500 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" />
                {form.arquivo_nome && <p className="text-xs text-emerald-600 mt-1">✓ {form.arquivo_nome}</p>}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={salvar} disabled={salvando}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 disabled:opacity-60">
                {salvando ? 'Salvando...' : 'Cadastrar Boleto'}
              </button>
              <button onClick={() => setModal(false)}
                className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
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

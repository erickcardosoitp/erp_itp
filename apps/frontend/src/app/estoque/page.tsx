'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '@/services/api';
import {
  Package, PackagePlus, PackageMinus, AlertTriangle, RefreshCw,
  Plus, Search, Edit2, Trash2, X, CheckCircle2, History,
  ClipboardList, ChevronDown, Link2, Eye, EyeOff,
} from 'lucide-react';

type Produto = {
  id: string; nome: string; categoria: string; unidade_medida: string;
  quantidade_atual: number; estoque_minimo: number; ativo: boolean;
};
type Movimento = {
  id: string; tipo: 'entrada' | 'baixa'; quantidade: number;
  observacao?: string; usuario_nome?: string; createdAt: string;
  produto?: { nome: string; unidade_medida: string };
};

const UN_MEDIDAS = ['un', 'kg', 'g', 'L', 'mL', 'cx', 'pct', 'saco', 'par', 'fardo', 'rolo', 'ds'];
const CATEGORIAS = ['Insumos - Cozinha', 'Insumos - Limpeza', 'Insumos - Material'];

function fmt(n: number | string) {
  const v = Number(n);
  return isNaN(v) ? '0' : v % 1 === 0 ? String(v) : v.toFixed(3).replace(/\.?0+$/, '');
}
function fmtData(s: string) {
  const d = new Date(s);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function emAlerta(p: Produto) {
  return Number(p.estoque_minimo) > 0 && Number(p.quantidade_atual) <= Number(p.estoque_minimo);
}

export default function EstoquePage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<'produtos' | 'movimentos'>('produtos');
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [showInativos, setShowInativos] = useState(false);
  const [mostrarColetor, setMostrarColetor] = useState(false);
  const coletorUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/estoque/coletor?token=${process.env.NEXT_PUBLIC_COLETOR_TOKEN || 'configure-COLETOR_TOKEN'}`
    : '';

  // Modais
  const [modalProduto, setModalProduto] = useState<{ aberto: boolean; editando: Produto | null }>({ aberto: false, editando: null });
  const [modalMov, setModalMov] = useState<{ aberto: boolean; tipo: 'entrada' | 'baixa'; produto: Produto | null }>({ aberto: false, tipo: 'entrada', produto: null });
  const [formProduto, setFormProduto] = useState<any>({ categoria: CATEGORIAS[0], unidade_medida: 'un', estoque_minimo: 0, quantidade_atual: 0 });
  const [formMov, setFormMov] = useState<any>({ quantidade: '', observacao: '' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rP, rM] = await Promise.all([api.get('/estoque/produtos'), api.get('/estoque/movimentos?limit=200')]);
      setProdutos(rP.data);
      setMovimentos(rM.data);
    } catch { /* silencioso */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const categorias = CATEGORIAS;
  const alertas = useMemo(() => produtos.filter(p => p.ativo && emAlerta(p)), [produtos]);

  const produtosFiltrados = useMemo(() => {
    return produtos.filter(p => {
      if (!showInativos && !p.ativo) return false;
      if (filtroCategoria && p.categoria !== filtroCategoria) return false;
      if (busca && !p.nome.toLowerCase().includes(busca.toLowerCase()) && !(p.categoria || '').toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [produtos, busca, filtroCategoria, showInativos]);

  const stats = useMemo(() => ({
    total: produtos.filter(p => p.ativo).length,
    alertas: alertas.length,
    categorias: categorias.length,
    movHoje: movimentos.filter(m => {
      const d = new Date(m.createdAt); const hoje = new Date();
      return d.getDate() === hoje.getDate() && d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
    }).length,
  }), [produtos, alertas, movimentos]);

  // ── Produto CRUD ──────────────────────────────────────────────────────────
  const abrirNovo = () => { setFormProduto({ categoria: CATEGORIAS[0], unidade_medida: 'un', estoque_minimo: 0, quantidade_atual: 0 }); setErro(''); setModalProduto({ aberto: true, editando: null }); };
  const abrirEditar = (p: Produto) => { setFormProduto({ nome: p.nome, categoria: p.categoria, unidade_medida: p.unidade_medida, estoque_minimo: p.estoque_minimo, quantidade_atual: p.quantidade_atual }); setErro(''); setModalProduto({ aberto: true, editando: p }); };

  const salvarProduto = async (e: React.FormEvent) => {
    e.preventDefault(); setSalvando(true); setErro('');
    try {
      if (modalProduto.editando) {
        await api.patch(`/estoque/produtos/${modalProduto.editando.id}`, formProduto);
      } else {
        await api.post('/estoque/produtos', formProduto);
      }
      setModalProduto({ aberto: false, editando: null }); load();
    } catch (err: any) { setErro(err.response?.data?.message || 'Erro ao salvar.'); }
    setSalvando(false);
  };

  const deletarProduto = async (p: Produto) => {
    if (!confirm(`Desativar "${p.nome}"?`)) return;
    try { await api.delete(`/estoque/produtos/${p.id}`); load(); }
    catch (err: any) { alert(err.response?.data?.message || 'Erro.'); }
  };

  // ── Movimentos ────────────────────────────────────────────────────────────
  const abrirMov = (tipo: 'entrada' | 'baixa', produto: Produto) => {
    setFormMov({ quantidade: '', observacao: '' }); setErro('');
    setModalMov({ aberto: true, tipo, produto });
  };

  const salvarMov = async (e: React.FormEvent) => {
    e.preventDefault(); setSalvando(true); setErro('');
    if (!modalMov.produto) return;
    try {
      await api.post(`/estoque/produtos/${modalMov.produto.id}/${modalMov.tipo}`, {
        quantidade: Number(formMov.quantidade),
        observacao: formMov.observacao,
      });
      setModalMov({ aberto: false, tipo: 'entrada', produto: null }); load();
    } catch (err: any) { setErro(err.response?.data?.message || 'Erro ao registrar movimento.'); }
    setSalvando(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#131b2e] p-6 font-sans antialiased text-slate-900 dark:text-slate-100">
      <div className="max-w-[1400px] mx-auto space-y-6">

        {/* HEADER */}
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic text-slate-900 dark:text-white">
              Estoque<span className="text-green-600">.ITP</span>
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Controle de Produtos e Movimentações</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setMostrarColetor(v => !v)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-black text-[10px] uppercase hover:border-green-400 hover:text-green-600 transition-all">
              <Link2 size={13} /> Link Coletor
            </button>
            <button onClick={load} disabled={loading}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-green-600 hover:border-green-400 transition-all disabled:opacity-60">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={abrirNovo}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-black text-xs uppercase tracking-widest transition-all shadow-sm">
              <Plus size={14} /> Novo Produto
            </button>
          </div>
        </div>

        {/* LINK COLETOR */}
        {mostrarColetor && (
          <div className="bg-white dark:bg-slate-800 border border-green-200 dark:border-green-700/40 rounded-2xl p-4 flex flex-wrap items-center gap-3">
            <Link2 size={16} className="text-green-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black uppercase tracking-widest text-green-600 mb-1">Link da Tela de Coletor</p>
              <p className="font-mono text-xs text-slate-600 dark:text-slate-300 break-all">{coletorUrl}</p>
            </div>
            <button onClick={() => { navigator.clipboard.writeText(coletorUrl); }}
              className="px-3 py-1.5 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-green-700 transition-colors flex-shrink-0">
              Copiar
            </button>
            <p className="w-full text-[9px] text-slate-400">
              ⚙️ Configure a variável <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">COLETOR_TOKEN</code> no backend (Vercel) e <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">NEXT_PUBLIC_COLETOR_TOKEN</code> no frontend para gerar o link correto.
            </p>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KPICard label="Produtos Ativos" value={stats.total} icon={<Package size={18} />} color="bg-green-600" />
          <KPICard label="Categorias" value={stats.categorias} icon={<ClipboardList size={18} />} color="bg-blue-600" />
          <KPICard label="Em Alerta" value={stats.alertas} icon={<AlertTriangle size={18} />} color={stats.alertas > 0 ? 'bg-red-500' : 'bg-slate-400'} />
          <KPICard label="Mov. Hoje" value={stats.movHoje} icon={<History size={18} />} color="bg-violet-600" />
        </div>

        {/* ALERTAS DE ESTOQUE MÍNIMO */}
        {alertas.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-red-600" />
              <span className="text-[10px] font-black uppercase tracking-widest text-red-600">
                {alertas.length} produto{alertas.length > 1 ? 's' : ''} abaixo do estoque mínimo
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {alertas.map(p => (
                <div key={p.id} className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-700/50 rounded-xl px-3 py-1.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{p.nome}</span>
                  <span className="text-[10px] font-mono text-red-600 font-black">{fmt(p.quantidade_atual)} / {fmt(p.estoque_minimo)} {p.unidade_medida}</span>
                  <button onClick={() => abrirMov('entrada', p)} title="Registrar Entrada"
                    className="text-green-600 hover:text-green-700 transition-colors">
                    <PackagePlus size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABAS */}
        <div className="flex gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl p-1 w-fit">
          {(['produtos', 'movimentos'] as const).map(tab => (
            <button key={tab} onClick={() => setAba(tab)}
              className={`px-5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${aba === tab ? 'bg-green-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {tab === 'produtos' ? '📦 Produtos' : '📋 Movimentos'}
            </button>
          ))}
        </div>

        {/* ABA: PRODUTOS */}
        {aba === 'produtos' && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            {/* Filtros */}
            <div className="flex flex-wrap gap-3 p-4 border-b border-slate-100 dark:border-slate-700">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto..."
                  className="w-full pl-8 pr-3 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}
                className="border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-green-400">
                <option value="">Todas as categorias</option>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-500 dark:text-slate-400">
                <input type="checkbox" checked={showInativos} onChange={e => setShowInativos(e.target.checked)} className="rounded" />
                Mostrar inativos
              </label>
            </div>
            {/* Tabela */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-600">
                    <th className="px-5 py-4">Produto</th>
                    <th className="px-5 py-4">Categoria</th>
                    <th className="px-5 py-4 text-center">Un.</th>
                    <th className="px-5 py-4 text-center">Qtd Atual</th>
                    <th className="px-5 py-4 text-center">Mínimo</th>
                    <th className="px-5 py-4 text-center">Status</th>
                    <th className="px-5 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                  {loading ? (
                    <tr><td colSpan={7} className="py-10 text-center text-slate-400 text-xs animate-pulse font-black italic uppercase">Carregando...</td></tr>
                  ) : produtosFiltrados.length === 0 ? (
                    <tr><td colSpan={7} className="py-10 text-center text-slate-400 text-xs font-bold italic">Nenhum produto encontrado.</td></tr>
                  ) : produtosFiltrados.map(p => {
                    const alerta = p.ativo && emAlerta(p);
                    const semMinimo = Number(p.estoque_minimo) === 0;
                    return (
                      <tr key={p.id} className={`transition-colors ${alerta ? 'bg-red-50/40 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20' : 'hover:bg-slate-50/50 dark:hover:bg-slate-700/30'} ${!p.ativo ? 'opacity-50' : ''}`}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            {alerta && <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />}
                            <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{p.nome}</span>
                            {!p.ativo && <span className="text-[9px] font-black text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-md uppercase">Inativo</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">{p.categoria}</td>
                        <td className="px-5 py-3.5 text-center">
                          <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md">{p.unidade_medida}</span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={`font-mono font-black text-sm ${alerta ? 'text-red-600' : 'text-slate-800 dark:text-slate-100'}`}>{fmt(p.quantidade_atual)}</span>
                        </td>
                        <td className="px-5 py-3.5 text-center font-mono text-xs text-slate-400">{semMinimo ? '—' : fmt(p.estoque_minimo)}</td>
                        <td className="px-5 py-3.5 text-center">
                          {!p.ativo ? (
                            <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-400">Inativo</span>
                          ) : semMinimo ? (
                            <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase bg-blue-50 dark:bg-blue-900/30 text-blue-500">Sem mínimo</span>
                          ) : alerta ? (
                            <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase bg-red-100 dark:bg-red-900/40 text-red-600">⚠ Alerta</span>
                          ) : (
                            <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase bg-green-100 dark:bg-green-900/30 text-green-600">✓ OK</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => abrirMov('entrada', p)} title="Registrar Entrada"
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] font-black uppercase transition-colors">
                              <PackagePlus size={11} /> Entrada
                            </button>
                            <button onClick={() => abrirMov('baixa', p)} title="Registrar Baixa"
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[10px] font-black uppercase transition-colors">
                              <PackageMinus size={11} /> Baixa
                            </button>
                            <button onClick={() => abrirEditar(p)} title="Editar"
                              className="p-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg transition-colors">
                              <Edit2 size={11} />
                            </button>
                            <button onClick={() => deletarProduto(p)} title="Desativar"
                              className="p-1.5 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-500 rounded-lg transition-colors">
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ABA: MOVIMENTOS */}
        {aba === 'movimentos' && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-600">
                    <th className="px-5 py-4">Produto</th>
                    <th className="px-5 py-4 text-center">Tipo</th>
                    <th className="px-5 py-4 text-center">Quantidade</th>
                    <th className="px-5 py-4">Observação</th>
                    <th className="px-5 py-4">Usuário</th>
                    <th className="px-5 py-4 text-right">Data/Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                  {loading ? (
                    <tr><td colSpan={6} className="py-10 text-center text-slate-400 text-xs animate-pulse font-black italic uppercase">Carregando...</td></tr>
                  ) : movimentos.length === 0 ? (
                    <tr><td colSpan={6} className="py-10 text-center text-slate-400 text-xs italic">Nenhuma movimentação registrada.</td></tr>
                  ) : movimentos.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-5 py-3 font-bold text-sm text-slate-800 dark:text-slate-100">{m.produto?.nome || '—'}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase ${m.tipo === 'entrada' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'}`}>
                          {m.tipo === 'entrada' ? '▲ Entrada' : '▼ Baixa'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center font-mono font-black text-sm">
                        <span className={m.tipo === 'entrada' ? 'text-green-600' : 'text-orange-600'}>
                          {m.tipo === 'entrada' ? '+' : '-'}{fmt(m.quantidade)}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">{m.produto?.unidade_medida}</span>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500 max-w-[200px] truncate">{m.observacao || '—'}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">{m.usuario_nome || '—'}</td>
                      <td className="px-5 py-3 text-right font-mono text-[11px] text-slate-500">{fmtData(m.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* MODAL: Criar / Editar Produto */}
      {modalProduto.aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-green-600 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package size={18} className="text-white" />
                <p className="text-sm font-black text-white">{modalProduto.editando ? 'Editar Produto' : 'Novo Produto'}</p>
              </div>
              <button onClick={() => setModalProduto({ aberto: false, editando: null })} className="text-white/70 hover:text-white"><X size={16} /></button>
            </div>
            <form onSubmit={salvarProduto} className="px-6 py-5 space-y-4">
              {erro && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700/50 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl px-3 py-2">{erro}</div>}
              <FInput label="Nome *" value={formProduto.nome ?? ''} onChange={v => setFormProduto((p: any) => ({ ...p, nome: v }))} required />
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Categoria</label>
                <select value={formProduto.categoria ?? CATEGORIAS[0]} onChange={e => setFormProduto((p: any) => ({ ...p, categoria: e.target.value }))}
                  className="w-full border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-400">
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Un. Medida</label>
                  <select value={formProduto.unidade_medida ?? 'un'} onChange={e => setFormProduto((p: any) => ({ ...p, unidade_medida: e.target.value }))}
                    className="w-full border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-400">
                    {UN_MEDIDAS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <FInput label="Estoque Mínimo" type="number" step="0.001" value={String(formProduto.estoque_minimo ?? 0)} onChange={v => setFormProduto((p: any) => ({ ...p, estoque_minimo: v }))} />
              </div>
              {!modalProduto.editando && (
                <FInput label="Quantidade Inicial" type="number" step="0.001" value={String(formProduto.quantidade_atual ?? 0)} onChange={v => setFormProduto((p: any) => ({ ...p, quantidade_atual: v }))} />
              )}
              <button type="submit" disabled={salvando}
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-colors flex items-center justify-center gap-2">
                {salvando ? <><RefreshCw size={13} className="animate-spin" /> Salvando...</> : <><CheckCircle2 size={13} /> {modalProduto.editando ? 'Salvar' : 'Criar Produto'}</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Entrada / Baixa */}
      {modalMov.aberto && modalMov.produto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className={`px-6 py-4 flex items-center justify-between ${modalMov.tipo === 'entrada' ? 'bg-green-600' : 'bg-orange-500'}`}>
              <div className="flex items-center gap-3">
                {modalMov.tipo === 'entrada' ? <PackagePlus size={18} className="text-white" /> : <PackageMinus size={18} className="text-white" />}
                <div>
                  <p className="text-[9px] font-black text-white/80 uppercase tracking-widest">{modalMov.tipo === 'entrada' ? 'Registrar Entrada' : 'Registrar Baixa'}</p>
                  <p className="text-sm font-black text-white truncate max-w-[240px]">{modalMov.produto.nome}</p>
                </div>
              </div>
              <button onClick={() => setModalMov({ aberto: false, tipo: 'entrada', produto: null })} className="text-white/70 hover:text-white"><X size={16} /></button>
            </div>
            <form onSubmit={salvarMov} className="px-6 py-5 space-y-4">
              {erro && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700/50 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl px-3 py-2">{erro}</div>}
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 flex gap-4 text-xs">
                <div><p className="text-[9px] font-black uppercase text-slate-400">Categoria</p><p className="font-bold text-slate-700 dark:text-slate-200">{modalMov.produto.categoria}</p></div>
                <div><p className="text-[9px] font-black uppercase text-slate-400">Disponível</p><p className="font-mono font-black text-slate-800 dark:text-slate-100">{fmt(modalMov.produto.quantidade_atual)} {modalMov.produto.unidade_medida}</p></div>
                {Number(modalMov.produto.estoque_minimo) > 0 && (
                  <div><p className="text-[9px] font-black uppercase text-slate-400">Mínimo</p><p className="font-mono text-slate-600 dark:text-slate-300">{fmt(modalMov.produto.estoque_minimo)}</p></div>
                )}
              </div>
              <FInput
                label={`Quantidade (${modalMov.produto.unidade_medida}) *`}
                type="number" step="0.001"
                value={formMov.quantidade}
                onChange={v => setFormMov((p: any) => ({ ...p, quantidade: v }))}
                required placeholder="0"
              />
              <FInput label="Observação" value={formMov.observacao} onChange={v => setFormMov((p: any) => ({ ...p, observacao: v }))} placeholder="Opcional" />
              <button type="submit" disabled={salvando}
                className={`w-full py-2.5 disabled:opacity-60 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-colors flex items-center justify-center gap-2 ${modalMov.tipo === 'entrada' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-500 hover:bg-orange-600'}`}>
                {salvando ? <><RefreshCw size={13} className="animate-spin" /> Registrando...</> : <><CheckCircle2 size={13} /> Confirmar</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-5 flex items-center gap-4">
      <div className={`${color} p-3 rounded-xl text-white flex items-center justify-center`}>{icon}</div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tighter">{value}</p>
      </div>
    </div>
  );
}

function FInput({ label, value, onChange, type = 'text', required, placeholder, step }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; placeholder?: string; step?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">{label}</label>
      <input type={type} step={step} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required}
        className="w-full border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-400 transition-shadow" />
    </div>
  );
}

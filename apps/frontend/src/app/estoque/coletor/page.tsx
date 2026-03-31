'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PackageMinus, RefreshCw, CheckCircle2, AlertTriangle, X, WifiOff, Loader2, Search } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.itp.institutotiapretinha.org/api';

type Produto = {
  id: string; nome: string; categoria: string;
  unidade_medida: string; quantidade_atual: number; estoque_minimo: number;
};

function fmt(n: number | string) {
  const v = Number(n);
  return isNaN(v) ? '0' : v % 1 === 0 ? String(v) : v.toFixed(3).replace(/\.?0+$/, '');
}

function emAlerta(p: Produto) {
  return Number(p.estoque_minimo) > 0 && Number(p.quantidade_atual) <= Number(p.estoque_minimo);
}

export default function ColetorPage() {
  const [token, setToken] = useState('');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const [tokenInvalido, setTokenInvalido] = useState(false);
  const [selecionado, setSelecionado] = useState<Produto | null>(null);
  const [quantidade, setQuantidade] = useState('');
  const [observacao, setObservacao] = useState('');
  const [registrando, setRegistrando] = useState(false);
  const [sucesso, setSucesso] = useState<{ nome: string; qtd: string; un: string } | null>(null);
  const [erro, setErro] = useState('');
  const [operador, setOperador] = useState('');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token') || '';
    const op = localStorage.getItem('coletor_operador') || '';
    setToken(t);
    setOperador(op);
    if (t) fetchProdutos(t);
  }, []);

  const fetchProdutos = useCallback(async (t: string) => {
    setLoading(true);
    setTokenInvalido(false);
    try {
      const r = await fetch(`${API_BASE}/estoque/coletor/produtos?token=${encodeURIComponent(t)}`);
      if (r.status === 401 || r.status === 403) { setTokenInvalido(true); return; }
      if (!r.ok) throw new Error('Erro ao carregar');
      setProdutos(await r.json());
    } catch {
      setTokenInvalido(true);
    }
    setLoading(false);
  }, []);

  const salvarOperador = (nome: string) => {
    setOperador(nome);
    if (typeof window !== 'undefined') localStorage.setItem('coletor_operador', nome);
  };

  const abrirBaixa = (p: Produto) => {
    setSelecionado(p); setQuantidade(''); setObservacao(''); setErro(''); setSucesso(null);
  };

  const confirmarBaixa = async () => {
    if (!selecionado || !quantidade) return;
    setRegistrando(true); setErro('');
    try {
      const r = await fetch(`${API_BASE}/estoque/coletor/baixa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token, produto_id: selecionado.id,
          quantidade: Number(quantidade),
          observacao: observacao || undefined,
          operador: operador || 'Coletor',
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Erro ao registrar.');
      setSucesso({ nome: selecionado.nome, qtd: quantidade, un: selecionado.unidade_medida });
      setSelecionado(null);
      // Atualiza estoque visualmente
      setProdutos(prev => prev.map(p => p.id === data.produto?.id ? { ...p, quantidade_atual: data.produto.quantidade_atual } : p));
    } catch (e: any) { setErro(e.message || 'Erro.'); }
    setRegistrando(false);
  };

  const produtosFiltrados = useMemo(() => {
    if (!busca.trim()) return produtos;
    const q = busca.toLowerCase();
    return produtos.filter(p => p.nome.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q));
  }, [produtos, busca]);

  function nivelEstoque(p: Produto): { pct: number; cor: string } {
    const min = Number(p.estoque_minimo);
    const atual = Number(p.quantidade_atual);
    if (min <= 0) return { pct: 100, cor: 'bg-green-500' };
    const pct = Math.min(100, Math.round((atual / (min * 2)) * 100));
    if (atual <= 0) return { pct: 0, cor: 'bg-red-600' };
    if (atual <= min) return { pct, cor: 'bg-red-500' };
    if (atual <= min * 1.5) return { pct, cor: 'bg-amber-400' };
    return { pct, cor: 'bg-green-500' };
  }

  // ── ESTADO: Token inválido ────────────────────────────────────────────────
  if (tokenInvalido || (!loading && !token)) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <WifiOff size={48} className="text-red-500 mx-auto" />
          <p className="text-white font-black text-xl uppercase tracking-wide">Acesso Inválido</p>
          <p className="text-slate-400 text-sm">O link do coletor é inválido ou expirou.<br />Solicite um novo link ao administrador.</p>
        </div>
      </div>
    );
  }

  // ── ESTADO: Carregando ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 size={32} className="text-green-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans antialiased">
      {/* HEADER */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-green-400">ITP — Coletor de Estoque</p>
          <p className="text-xs font-bold text-slate-300">{produtos.length} produto{produtos.length !== 1 ? 's' : ''} carregado{produtos.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchProdutos(token)} title="Atualizar"
            className="p-2 bg-slate-700 rounded-xl text-slate-400 hover:text-green-400 transition-colors">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* OPERADOR + BUSCA */}
      <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700/50 space-y-2">
        <div className="flex items-center gap-3 max-w-sm mx-auto">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">Operador</label>
          <input value={operador} onChange={e => salvarOperador(e.target.value)} placeholder="Seu nome..."
            className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div className="flex items-center gap-2 max-w-sm mx-auto bg-slate-700 border border-slate-600 rounded-xl px-3 py-1.5">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto..."
            className="flex-1 bg-transparent text-white text-sm font-bold focus:outline-none placeholder:text-slate-500" />
          {busca && <button onClick={() => setBusca('')} className="text-slate-400 hover:text-white"><X size={12} /></button>}
        </div>
      </div>

      {/* ALERTA GERAL */}
      {produtos.some(emAlerta) && (
        <div className="mx-4 mt-4 bg-red-900/40 border border-red-700/50 rounded-2xl p-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
          <p className="text-sm font-black text-red-300">
            {produtos.filter(emAlerta).length} produto{produtos.filter(emAlerta).length > 1 ? 's' : ''} abaixo do estoque mínimo!
          </p>
        </div>
      )}
      {busca && produtosFiltrados.length === 0 && (
        <p className="text-center text-slate-500 text-sm font-bold py-8">Nenhum produto encontrado para &ldquo;{busca}&rdquo;.</p>
      )}

      {/* SUCESSO FLASH */}
      {sucesso && (
        <div className="mx-4 mt-4 bg-green-800/40 border border-green-600/50 rounded-2xl p-3 flex items-center gap-3">
          <CheckCircle2 size={20} className="text-green-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-black text-green-300">Baixa registrada!</p>
            <p className="text-xs text-green-400">{sucesso.qtd} {sucesso.un} de <strong>{sucesso.nome}</strong></p>
          </div>
          <button onClick={() => setSucesso(null)} className="ml-auto text-green-500 hover:text-green-300"><X size={14} /></button>
        </div>
      )}

      {/* LISTA DE PRODUTOS */}
      <div className="p-4 space-y-2 max-w-lg mx-auto">
        {[...new Set(produtosFiltrados.map(p => p.categoria))].sort().map(cat => (
          <div key={cat} className="space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 pt-3 pb-1 px-1 border-b border-slate-700/50">
              {cat} <span className="text-slate-600 normal-case font-bold">({produtosFiltrados.filter(p => p.categoria === cat).length})</span>
            </p>
            {produtosFiltrados.filter(p => p.categoria === cat).map(p => {
              const alerta = emAlerta(p);
              const { pct, cor } = nivelEstoque(p);
              return (
                <button key={p.id} onClick={() => abrirBaixa(p)}
                  className={`w-full p-4 rounded-2xl border transition-all active:scale-[0.98] text-left ${alerta ? 'bg-red-900/30 border-red-700/50 hover:bg-red-900/50' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {alerta && <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />}
                      <p className="font-black text-base text-white truncate">{p.nome}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className={`font-mono font-black text-xl ${alerta ? 'text-red-400' : 'text-green-400'}`}>{fmt(p.quantidade_atual)}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{p.unidade_medida}</p>
                    </div>
                  </div>
                  {Number(p.estoque_minimo) > 0 && (
                    <div>
                      <div className="w-full bg-slate-700 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full transition-all ${cor}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[9px] text-slate-500 font-mono mt-0.5">mín: {fmt(p.estoque_minimo)} {p.unidade_medida}</p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* MODAL: Registrar Baixa */}
      {selecionado && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-800 w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl p-6 space-y-5 border border-slate-700">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-orange-400">Registrar Baixa</p>
                <p className="text-xl font-black text-white mt-0.5">{selecionado.nome}</p>
                <p className="text-sm text-slate-400 font-mono mt-1">
                  Disponível: <span className={`font-black ${emAlerta(selecionado) ? 'text-red-400' : 'text-green-400'}`}>{fmt(selecionado.quantidade_atual)} {selecionado.unidade_medida}</span>
                </p>
              </div>
              <button onClick={() => setSelecionado(null)} className="text-slate-500 hover:text-white transition-colors mt-1">
                <X size={20} />
              </button>
            </div>

            {erro && (
              <div className="bg-red-900/40 border border-red-700/50 text-red-300 text-sm font-bold rounded-xl px-4 py-2">{erro}</div>
            )}

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                Quantidade ({selecionado.unidade_medida}) *
              </label>
              <input type="number" step="0.001" inputMode="decimal"
                value={quantidade} onChange={e => setQuantidade(e.target.value)}
                placeholder="0" autoFocus
                className="w-full bg-slate-700 border border-slate-600 text-white text-2xl font-black font-mono rounded-2xl px-4 py-4 text-center focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Observação</label>
              <input type="text" value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Opcional"
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setSelecionado(null)}
                className="flex-1 py-3.5 rounded-2xl border border-slate-600 text-slate-400 font-black text-sm uppercase hover:bg-slate-700 transition-colors">
                Cancelar
              </button>
              <button onClick={confirmarBaixa} disabled={registrando || !quantidade || Number(quantidade) <= 0}
                className="flex-1 py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm uppercase transition-colors flex items-center justify-center gap-2">
                {registrando
                  ? <><Loader2 size={16} className="animate-spin" /> Registrando...</>
                  : <><PackageMinus size={16} /> Confirmar Baixa</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

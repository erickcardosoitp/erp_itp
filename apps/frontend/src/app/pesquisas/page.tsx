'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import { Plus, X, Trash2, StopCircle, RefreshCw, BarChart2, Copy, Check, ChevronDown, ChevronUp, Star, AlertTriangle } from 'lucide-react';

type TipoPergunta = 'nota' | 'texto' | 'multipla_escolha' | 'checkbox';
interface Pergunta { id: string; texto: string; tipo: TipoPergunta; opcoes?: string[]; }
interface Pesquisa {
  id: string; titulo: string; tipo: string; categoria?: string; perguntas: Pergunta[];
  data_limite?: string; status: string; link_unico: string;
  criado_por_nome?: string; created_at: string; total_respostas: number; expirada?: boolean;
}
interface RespostaItem { id: string; created_at: string; expurgado: boolean; respostas: { pergunta_id: string; nota?: number; texto?: string; opcoes_selecionadas?: string[] }[]; }
interface StatPergunta {
  id: string; texto: string; tipo: TipoPergunta;
  media?: number; total_respostas: number;
  distribuicao?: { nota: number; total: number }[];
  textos?: string[];
  contagem?: Record<string, number>;
  opcoes?: string[];
}

const TIPOS = ['Academica', 'Interna', 'Programa'];
const TIPO_LABELS: Record<string, string> = { Academica: 'Acadêmica', Interna: 'Interna', Programa: 'Programa' };
const CATEGORIAS = ['Academico', 'Financeiro', 'Estoque', 'Matriculas', 'Institucional', 'Operacional'];
const CAT_LABELS: Record<string, string> = { Academico: 'Acadêmico', Financeiro: 'Financeiro', Estoque: 'Estoque', Matriculas: 'Matrículas', Institucional: 'Institucional', Operacional: 'Operacional' };
const EXTERNAL_URL = 'https://itp.institutotiapretinha.org';

function gerarId() { return Math.random().toString(36).substring(2, 10); }

function CopiarLink({ link }: { link: string }) {
  const [copiado, setCopiado] = useState(false);
  const url = `${EXTERNAL_URL}/pesquisa/${link}`;
  const copiar = () => {
    navigator.clipboard.writeText(url).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); });
  };
  return (
    <div className="flex items-center gap-2 bg-purple-50 rounded-xl px-3 py-2 mt-2">
      <span className="text-[10px] text-purple-700 font-mono flex-1 truncate">{url}</span>
      <button onClick={copiar} className="shrink-0 text-purple-500 hover:text-purple-700">
        {copiado ? <Check size={13}/> : <Copy size={13}/>}
      </button>
    </div>
  );
}

export default function PesquisasPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [pesquisas, setPesquisas] = useState<Pesquisa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Record<string, { stats: StatPergunta[]; total_respostas: number; respostas: RespostaItem[] }>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Form
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState('Academica');
  const [categoria, setCategoria] = useState('Academico');
  const [dataLimite, setDataLimite] = useState('');
  const [perguntas, setPerguntas] = useState<Pergunta[]>([
    { id: gerarId(), texto: '', tipo: 'nota' },
  ]);

  const role = user?.role?.toLowerCase() ?? '';
  const podeGerenciar = ['drt', 'vp', 'prt', 'admin'].includes(role);
  const podeReiniciar = ['prt', 'admin'].includes(role);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/pesquisas'); setPesquisas(r.data); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!podeGerenciar) { router.push('/dashboard'); return; }
    load();
  }, [podeGerenciar, load, router]);

  const adicionarPergunta = () => {
    setPerguntas(p => [...p, { id: gerarId(), texto: '', tipo: 'nota' }]);
  };

  const removerPergunta = (id: string) => {
    setPerguntas(p => p.filter(q => q.id !== id));
  };

  const setTipoPergunta = (id: string, t: TipoPergunta) => {
    setPerguntas(pqs => pqs.map(q => q.id === id ? { ...q, tipo: t, opcoes: (t === 'multipla_escolha' || t === 'checkbox') ? (q.opcoes?.length ? q.opcoes : ['']) : undefined } : q));
  };

  const adicionarOpcao = (perguntaId: string) => {
    setPerguntas(pqs => pqs.map(q => q.id === perguntaId ? { ...q, opcoes: [...(q.opcoes || []), ''] } : q));
  };

  const setOpcao = (perguntaId: string, idx: number, valor: string) => {
    setPerguntas(pqs => pqs.map(q => q.id === perguntaId ? { ...q, opcoes: (q.opcoes || []).map((o, i) => i === idx ? valor : o) } : q));
  };

  const removerOpcao = (perguntaId: string, idx: number) => {
    setPerguntas(pqs => pqs.map(q => q.id === perguntaId ? { ...q, opcoes: (q.opcoes || []).filter((_, i) => i !== idx) } : q));
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) { setErro('Título é obrigatório'); return; }
    if (perguntas.some(p => !p.texto.trim())) { setErro('Preencha o texto de todas as perguntas'); return; }
    if (perguntas.some(p => (p.tipo === 'multipla_escolha' || p.tipo === 'checkbox') && (!p.opcoes?.length || p.opcoes.some(o => !o.trim())))) {
      setErro('Preencha todas as opções das perguntas de múltipla escolha'); return;
    }
    setSalvando(true); setErro(null);
    try {
      await api.post('/pesquisas', { titulo, tipo, categoria, perguntas, data_limite: dataLimite || undefined });
      setShowForm(false); setTitulo(''); setTipo('Academica'); setCategoria('Academico'); setDataLimite('');
      setPerguntas([{ id: gerarId(), texto: '', tipo: 'nota' }]);
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao criar pesquisa';
      setErro(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally { setSalvando(false); }
  };

  const encerrar = async (id: string) => {
    if (!confirm('Encerrar esta pesquisa?')) return;
    try { await api.patch(`/pesquisas/${id}/encerrar`); await load(); } catch {}
  };

  const reiniciar = async (id: string) => {
    if (!confirm('Reabrir esta pesquisa?')) return;
    try { await api.patch(`/pesquisas/${id}/reiniciar`); await load(); } catch {}
  };

  const deletar = async (id: string) => {
    if (!confirm('Excluir esta pesquisa e todas as respostas?')) return;
    try { await api.delete(`/pesquisas/${id}`); await load(); } catch {}
  };

  const verResultados = async (id: string) => {
    if (expandida === id) { setExpandida(null); return; }
    setExpandida(id);
    if (!resultados[id]) {
      try {
        const r = await api.get(`/pesquisas/${id}/resultados`);
        setResultados(prev => ({ ...prev, [id]: { stats: r.data.stats, total_respostas: r.data.total_respostas, respostas: r.data.respostas } }));
      } catch {}
    }
  };

  const toggleExpurgar = async (pesquisaId: string, respostaId: string, expurgado: boolean) => {
    try {
      await api.patch(`/pesquisas/respostas/${respostaId}/expurgar`, { expurgado });
      // Atualiza localmente
      setResultados(prev => ({
        ...prev,
        [pesquisaId]: {
          ...prev[pesquisaId],
          respostas: prev[pesquisaId].respostas.map(r => r.id === respostaId ? { ...r, expurgado } : r),
        },
      }));
    } catch {}
  };

  const statusBadge = (p: Pesquisa) => {
    if (p.status === 'encerrada' || p.expirada) {
      return <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-red-100 text-red-600">{p.status === 'encerrada' ? 'Encerrada' : 'Expirada'}</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-green-100 text-green-700">Aberta</span>;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">Pesquisas de Satisfação</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Anônimas · Apenas administradores criam</p>
          </div>
          {podeGerenciar && (
            <button onClick={() => { setShowForm(v => !v); setErro(null); }}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl font-black text-xs uppercase hover:bg-purple-700">
              {showForm ? <X size={14}/> : <Plus size={14}/>}
              {showForm ? 'Cancelar' : 'Nova Pesquisa'}
            </button>
          )}
        </div>

        {/* Formulário de criação */}
        {showForm && (
          <form onSubmit={salvar} className="bg-white rounded-3xl border border-slate-100 shadow p-6 space-y-5">
            <h2 className="text-xs font-black uppercase text-slate-700">Nova Pesquisa</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400">Título *</label>
                <input value={titulo} onChange={e => setTitulo(e.target.value)} required placeholder="Ex: Pesquisa de Satisfação 2026"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400">Tipo *</label>
                <select value={tipo} onChange={e => setTipo(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                  {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400">Categoria (Módulo)</label>
                <select value={categoria} onChange={e => setCategoria(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                  {CATEGORIAS.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400">Prazo (até)</label>
                <input type="datetime-local" value={dataLimite} onChange={e => setDataLimite(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
            </div>

            {/* Perguntas */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-black uppercase text-slate-400">Perguntas</label>
                <button type="button" onClick={adicionarPergunta}
                  className="flex items-center gap-1 text-[9px] font-black uppercase text-purple-600 hover:text-purple-800">
                  <Plus size={11}/> Adicionar
                </button>
              </div>
              {perguntas.map((p, i) => (
                <div key={p.id} className="border border-slate-100 rounded-xl p-3 space-y-2">
                  <div className="flex gap-2 items-start">
                    <input value={p.texto} onChange={e => setPerguntas(pqs => pqs.map(q => q.id === p.id ? { ...q, texto: e.target.value } : q))}
                      placeholder={`Pergunta ${i + 1}...`} required
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400" />
                    <select value={p.tipo} onChange={e => setTipoPergunta(p.id, e.target.value as TipoPergunta)}
                      className="border border-slate-200 rounded-xl px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white shrink-0">
                      <option value="nota">⭐ Nota (1–5)</option>
                      <option value="texto">✏ Texto</option>
                      <option value="multipla_escolha">◉ Múltipla Escolha</option>
                      <option value="checkbox">☑ Checkbox</option>
                    </select>
                    {perguntas.length > 1 && (
                      <button type="button" onClick={() => removerPergunta(p.id)}
                        className="text-red-400 hover:text-red-600 mt-2"><X size={14}/></button>
                    )}
                  </div>
                  {/* Opções para multipla_escolha e checkbox */}
                  {(p.tipo === 'multipla_escolha' || p.tipo === 'checkbox') && (
                    <div className="pl-2 space-y-1.5">
                      <span className="text-[9px] font-black uppercase text-slate-400">Opções</span>
                      {(p.opcoes || []).map((opc, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input value={opc} onChange={e => setOpcao(p.id, idx, e.target.value)} placeholder={`Opção ${idx + 1}`} required
                            className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400" />
                          {(p.opcoes || []).length > 1 && (
                            <button type="button" onClick={() => removerOpcao(p.id, idx)} className="text-red-400 hover:text-red-600"><X size={11}/></button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={() => adicionarOpcao(p.id)}
                        className="text-[9px] font-black uppercase text-purple-500 hover:text-purple-700 flex items-center gap-1">
                        <Plus size={10}/> Opção
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {erro && <p className="text-[11px] text-red-600 font-bold bg-red-50 rounded-xl px-4 py-2">⚠ {erro}</p>}

            <button type="submit" disabled={salvando}
              className="w-full bg-purple-600 text-white py-2.5 rounded-xl font-black text-xs uppercase disabled:opacity-50 hover:bg-purple-700">
              {salvando ? 'Criando...' : 'Criar Pesquisa'}
            </button>
          </form>
        )}

        {/* Lista de pesquisas */}
        {loading ? (
          <div className="text-center py-12 text-sm text-slate-400">Carregando...</div>
        ) : pesquisas.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 shadow">
            <BarChart2 size={40} className="mx-auto mb-3 text-slate-200"/>
            <p className="text-sm text-slate-400">Nenhuma pesquisa criada ainda.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pesquisas.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm text-slate-800 truncate">{p.titulo}</span>
                      <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{TIPO_LABELS[p.tipo] || p.tipo}</span>
                      {p.categoria && <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-600">{CAT_LABELS[p.categoria] || p.categoria}</span>}
                      {statusBadge(p)}
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-3 flex-wrap">
                      <span>{p.total_respostas} resposta{p.total_respostas !== 1 ? 's' : ''}</span>
                      {p.data_limite && <span>Prazo: {new Date(p.data_limite).toLocaleDateString('pt-BR')}</span>}
                      <span>Por: {p.criado_por_nome || '–'}</span>
                    </div>
                    <CopiarLink link={p.link_unico} />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    <button onClick={() => verResultados(p.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase bg-purple-50 text-purple-600 hover:bg-purple-100">
                      <BarChart2 size={11}/>
                      {expandida === p.id ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
                    </button>
                    {(p.status === 'aberta' && !p.expirada) && (
                      <button onClick={() => encerrar(p.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase bg-red-50 text-red-500 hover:bg-red-100">
                        <StopCircle size={11}/> Encerrar
                      </button>
                    )}
                    {(p.status === 'encerrada' || p.expirada) && podeReiniciar && (
                      <button onClick={() => reiniciar(p.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase bg-green-50 text-green-600 hover:bg-green-100">
                        <RefreshCw size={11}/> Reabrir
                      </button>
                    )}
                    {podeReiniciar && (
                      <button onClick={() => deletar(p.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase bg-red-50 text-red-400 hover:bg-red-100">
                        <Trash2 size={11}/>
                      </button>
                    )}
                  </div>
                </div>

                {/* Resultados expandidos */}
                {expandida === p.id && (
                  <div className="border-t border-slate-50 px-5 py-4 bg-slate-50/50 space-y-5">
                    {!resultados[p.id] ? (
                      <p className="text-xs text-slate-400 text-center py-4">Carregando resultados...</p>
                    ) : resultados[p.id].total_respostas === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">Nenhuma resposta ainda.</p>
                    ) : (
                      <>
                        {/* Estatísticas por pergunta */}
                        <div className="space-y-4">
                          {resultados[p.id].stats.map(s => (
                            <div key={s.id} className="space-y-2">
                              <p className="text-[11px] font-black text-slate-700">{s.texto}</p>
                              {s.tipo === 'nota' && s.distribuicao ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    {[1,2,3,4,5].map(n => <Star key={n} size={14} className={n <= Math.round(s.media || 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}/>)}
                                    <span className="text-xs font-black text-slate-600">{s.media?.toFixed(1)} / 5</span>
                                    <span className="text-[9px] text-slate-400">({s.total_respostas} votos)</span>
                                  </div>
                                  <div className="flex gap-2 flex-wrap">
                                    {s.distribuicao.map(d => (
                                      <div key={d.nota} className="flex items-center gap-1 text-[9px] text-slate-500">
                                        <span className="font-black">{d.nota}★</span>
                                        <span>— {d.total}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : s.tipo === 'texto' && s.textos ? (
                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                  {s.textos.map((t, i) => (
                                    <p key={i} className="text-[11px] text-slate-600 bg-white rounded-lg px-3 py-1.5 border border-slate-100">&quot;{t}&quot;</p>
                                  ))}
                                </div>
                              ) : (s.tipo === 'multipla_escolha' || s.tipo === 'checkbox') && s.contagem ? (
                                <div className="space-y-1">
                                  {Object.entries(s.contagem).map(([opc, cnt]) => {
                                    const pct = s.total_respostas > 0 ? Math.round((cnt / s.total_respostas) * 100) : 0;
                                    return (
                                      <div key={opc} className="flex items-center gap-2">
                                        <span className="text-[10px] text-slate-600 w-32 truncate">{opc}</span>
                                        <div className="flex-1 bg-slate-100 rounded-full h-2">
                                          <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${pct}%` }}/>
                                        </div>
                                        <span className="text-[9px] font-black text-slate-500 w-8 text-right">{cnt}</span>
                                      </div>
                                    );
                                  })}
                                  <p className="text-[9px] text-slate-400">{s.total_respostas} resposta{s.total_respostas !== 1 ? 's' : ''}</p>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>

                        {/* Respostas individuais com expurgação */}
                        <div className="mt-4 space-y-2">
                          <p className="text-[9px] font-black uppercase text-slate-400">Respostas individuais (expurgação)</p>
                          <div className="space-y-1.5 max-h-64 overflow-y-auto">
                            {resultados[p.id].respostas.map((r, idx) => (
                              <div key={r.id} className={`flex items-center gap-3 px-3 py-2 rounded-xl border text-[10px] ${r.expurgado ? 'bg-red-50 border-red-100 opacity-60' : 'bg-white border-slate-100'}`}>
                                <span className="text-slate-400 shrink-0 font-mono">#{idx + 1}</span>
                                <span className="text-slate-500 shrink-0">{new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
                                <div className="flex-1 flex gap-2 flex-wrap">
                                  {r.respostas.map(rp => {
                                    const perg = p.perguntas?.find(pq => pq.id === rp.pergunta_id);
                                    if (!perg) return null;
                                    if (rp.nota != null) return <span key={rp.pergunta_id} className="text-amber-600 font-black">{rp.nota}★</span>;
                                    if (rp.texto) return <span key={rp.pergunta_id} className="text-slate-500 truncate max-w-[120px]">&quot;{rp.texto}&quot;</span>;
                                    if (rp.opcoes_selecionadas?.length) return <span key={rp.pergunta_id} className="text-purple-600">{rp.opcoes_selecionadas.join(', ')}</span>;
                                    return null;
                                  })}
                                </div>
                                {r.expurgado && <span className="shrink-0 text-[8px] font-black uppercase text-red-500 flex items-center gap-0.5"><AlertTriangle size={9}/> Expurgado</span>}
                                <button
                                  onClick={() => toggleExpurgar(p.id, r.id, !r.expurgado)}
                                  className={`shrink-0 text-[8px] font-black uppercase px-2 py-0.5 rounded-lg ${r.expurgado ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}>
                                  {r.expurgado ? 'Incluir' : 'Expurgar'}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

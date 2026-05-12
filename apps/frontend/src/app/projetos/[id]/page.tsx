'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Users, ClipboardCheck, Printer,
  X, Edit3, Trash2, AlertTriangle, Search,
} from 'lucide-react';
import api from '@/services/api';
import { toast } from 'sonner';

interface Equipe { id: string; nome: string; cor: string; faixa_min?: number; faixa_max?: number; }
interface Inscricao {
  id: string; tipo: string; nome_completo: string; data_nascimento?: string;
  nome_responsavel?: string; telefone_responsavel?: string;
  cuidado_especial?: string; detalhes_cuidado?: string;
  status: string; equipe_id?: string; equipe?: Equipe; aluno_id?: string;
}
interface Presenca { id: string; inscricao_id: string; data: string; presente: boolean; hora_entrada?: string; hora_saida?: string; }
interface Projeto { id: string; nome: string; data_inicio: string; data_fim: string; pulseira_largura_mm: number; pulseira_altura_mm: number; }

type Tab = 'inscritos' | 'equipes' | 'presenca';

function fmtDate(v?: string) {
  if (!v) return '—';
  const d = new Date(v + 'T12:00:00');
  return d.toLocaleDateString('pt-BR');
}

function calcIdade(dob?: string) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

export default function ProjetoDashboard() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hoje = new Date().toISOString().slice(0, 10);

  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [inscritos, setInscritos] = useState<Inscricao[]>([]);
  const [presencas, setPresencas] = useState<Presenca[]>([]);
  const [tab, setTab] = useState<Tab>('inscritos');
  const [dataPresenca, setDataPresenca] = useState(hoje);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);

  // Modais
  const [modalInscricao, setModalInscricao] = useState(false);
  const [modalEquipe, setModalEquipe] = useState<{ open: boolean; editando: Equipe | null }>({ open: false, editando: null });
  const [formInscricao, setFormInscricao] = useState<Partial<Inscricao>>({});
  const [formEquipe, setFormEquipe] = useState<Partial<Equipe>>({});
  const [salvando, setSalvando] = useState(false);
  const [buscaAluno, setBuscaAluno] = useState('');
  const [resultadosAluno, setResultadosAluno] = useState<any[]>([]);
  const [buscandoAluno, setBuscandoAluno] = useState(false);
  const [alunoSelecionado, setAlunoSelecionado] = useState<any>(null);
  const [modoExterno, setModoExterno] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rp, re, ri] = await Promise.all([
        api.get(`/projetos/${id}`),
        api.get(`/projetos/${id}/equipes`),
        api.get(`/projetos/${id}/inscricoes`),
      ]);
      setProjeto(rp.data);
      setEquipes(re.data);
      setInscritos(ri.data);
    } catch { toast.error('Erro ao carregar projeto'); }
    finally { setLoading(false); }
  }, [id]);

  const loadPresencas = useCallback(async () => {
    const r = await api.get(`/projetos/${id}/presencas`, { params: { data: dataPresenca } });
    setPresencas(r.data);
  }, [id, dataPresenca]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'presenca') loadPresencas(); }, [tab, dataPresenca, loadPresencas]);

  // Busca aluno existente
  useEffect(() => {
    if (buscaAluno.length < 3) { setResultadosAluno([]); return; }
    const t = setTimeout(async () => {
      setBuscandoAluno(true);
      try {
        const r = await api.get('/academico/alunos', { params: { nome: buscaAluno } });
        setResultadosAluno(r.data?.alunos || r.data || []);
      } catch { setResultadosAluno([]); }
      finally { setBuscandoAluno(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [buscaAluno]);

  const salvarInscricao = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      await api.post(`/projetos/${id}/inscricoes`, formInscricao);
      setModalInscricao(false);
      setFormInscricao({});
      setBuscaAluno('');
      setResultadosAluno([]);
      setAlunoSelecionado(null);
      setModoExterno(false);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao inscrever');
    } finally { setSalvando(false); }
  };

  const salvarEquipe = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      if (modalEquipe.editando) await api.patch(`/projetos/${id}/equipes/${modalEquipe.editando.id}`, formEquipe);
      else await api.post(`/projetos/${id}/equipes`, formEquipe);
      setModalEquipe({ open: false, editando: null });
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao salvar equipe');
    } finally { setSalvando(false); }
  };

  const removerInscricao = async (ins: Inscricao) => {
    if (!confirm(`Remover "${ins.nome_completo}" do projeto?`)) return;
    await api.delete(`/projetos/${id}/inscricoes/${ins.id}`);
    await load();
  };

  const removerEquipe = async (eq: Equipe) => {
    if (!confirm(`Remover equipe "${eq.nome}"?`)) return;
    await api.delete(`/projetos/${id}/equipes/${eq.id}`);
    await load();
  };

  const togglePresenca = async (ins: Inscricao) => {
    const atual = presencas.find(p => p.inscricao_id === ins.id);
    const presente = !atual?.presente;
    await api.post(`/projetos/${id}/presencas/${ins.id}/${dataPresenca}`, {
      presente,
      equipe_id: ins.equipe_id,
      hora_entrada: presente ? new Date().toTimeString().slice(0, 8) : null,
    });
    await loadPresencas();
  };

  const inscritosFiltrados = inscritos.filter(i =>
    i.nome_completo.toLowerCase().includes(busca.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center min-h-screen text-slate-400">Carregando...</div>;
  if (!projeto) return <div className="flex items-center justify-center min-h-screen text-red-400">Projeto não encontrado</div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-700 via-purple-600 to-indigo-700 px-6 pt-6 pb-8">
        <button onClick={() => router.push('/projetos')} className="flex items-center gap-1.5 text-purple-200 hover:text-white text-xs font-bold mb-4 transition-colors">
          <ArrowLeft size={13}/> Projetos
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-white font-black text-2xl tracking-tight">{projeto.nome}</h1>
            <p className="text-purple-200 text-xs mt-1">{fmtDate(projeto.data_inicio)} → {fmtDate(projeto.data_fim)}</p>
          </div>
          <button onClick={() => router.push(`/projetos/${id}/pulseiras`)}
            className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/20 text-white px-3 py-2 rounded-xl text-xs font-black uppercase transition-all">
            <Printer size={13}/> Pulseiras
          </button>
        </div>
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { label: 'Inscritos', val: inscritos.length },
            { label: 'Equipes', val: equipes.length },
            { label: 'Hoje presentes', val: presencas.filter(p => p.presente).length },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-white">{s.val}</p>
              <p className="text-[9px] font-bold text-purple-200 uppercase tracking-wider mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4">
        <div className="flex gap-1 max-w-4xl mx-auto py-2">
          {([
            { id: 'inscritos', label: 'Inscritos', Icon: Users },
            { id: 'equipes', label: 'Equipes', Icon: Users },
            { id: 'presenca', label: 'Presença', Icon: ClipboardCheck },
          ] as { id: Tab; label: string; Icon: any }[]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                ${tab === t.id ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}>
              <t.Icon size={12}/>{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">

        {/* ── TAB INSCRITOS ────────────────────────────────────────────────── */}
        {tab === 'inscritos' && (
          <>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar inscrito..."
                  className="w-full pl-8 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
              <button onClick={() => { setFormInscricao({}); setBuscaAluno(''); setResultadosAluno([]); setAlunoSelecionado(null); setModoExterno(false); setModalInscricao(true); }}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase">
                <Plus size={13}/> Inscrever
              </button>
            </div>

            <div className="space-y-2">
              {inscritosFiltrados.map(ins => (
                <InscritoCard key={ins.id} ins={ins} equipes={equipes}
                  onDelete={() => removerInscricao(ins)}
                  onChangeEquipe={async (equipe_id) => {
                    await api.patch(`/projetos/${id}/inscricoes/${ins.id}`, { equipe_id });
                    await load();
                  }} />
              ))}
              {inscritosFiltrados.length === 0 && (
                <div className="py-12 text-center text-slate-400 text-sm">Nenhum inscrito encontrado.</div>
              )}
            </div>
          </>
        )}

        {/* ── TAB EQUIPES ──────────────────────────────────────────────────── */}
        {tab === 'equipes' && (
          <>
            <div className="flex justify-end">
              <button onClick={() => { setFormEquipe({ cor: '#7c3aed' }); setModalEquipe({ open: true, editando: null }); }}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase">
                <Plus size={13}/> Nova Equipe
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {equipes.map(eq => {
                const membros = inscritos.filter(i => i.equipe_id === eq.id);
                return (
                  <div key={eq.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: eq.cor }}/>
                      <span className="font-black text-sm text-slate-800 dark:text-slate-100">{eq.nome}</span>
                      {(eq.faixa_min || eq.faixa_max) && (
                        <span className="text-[9px] font-black text-slate-400 ml-auto">{eq.faixa_min ?? '?'}–{eq.faixa_max ?? '?'} anos</span>
                      )}
                      <div className="flex gap-1 ml-auto">
                        <button onClick={() => { setFormEquipe({ ...eq }); setModalEquipe({ open: true, editando: eq }); }}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"><Edit3 size={12}/></button>
                        <button onClick={() => removerEquipe(eq)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500"><Trash2 size={12}/></button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">{membros.length} {membros.length === 1 ? 'membro' : 'membros'}</p>
                    <div className="mt-2 space-y-1">
                      {membros.slice(0, 5).map(m => (
                        <div key={m.id} className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-[8px] font-black text-purple-600">
                            {m.nome_completo[0]}
                          </div>
                          <span className="text-[11px] text-slate-700 dark:text-slate-300 truncate">{m.nome_completo}</span>
                        </div>
                      ))}
                      {membros.length > 5 && <p className="text-[10px] text-slate-400">+{membros.length - 5} mais</p>}
                    </div>
                  </div>
                );
              })}
              {equipes.length === 0 && (
                <div className="col-span-2 py-12 text-center text-slate-400 text-sm">Nenhuma equipe cadastrada.</div>
              )}
            </div>
          </>
        )}

        {/* ── TAB PRESENÇA ─────────────────────────────────────────────────── */}
        {tab === 'presenca' && (
          <>
            <div className="flex items-center gap-3">
              <label className="text-[10px] font-black uppercase text-slate-500">Data</label>
              <input type="date" value={dataPresenca} onChange={e => setDataPresenca(e.target.value)}
                className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400"/>
              <span className="text-xs text-slate-400">{presencas.filter(p => p.presente).length} / {inscritos.length} presentes</span>
            </div>
            <div className="space-y-2">
              {inscritos.map(ins => {
                const p = presencas.find(p => p.inscricao_id === ins.id);
                const eq = equipes.find(e => e.id === ins.equipe_id);
                return (
                  <div key={ins.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all
                    ${p?.presente ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-purple-200'}`}
                    onClick={() => togglePresenca(ins)}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors
                      ${p?.presente ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                      {p?.presente && <span className="text-white text-[10px] font-black">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{ins.nome_completo}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {eq && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full text-white" style={{ background: eq.cor }}>{eq.nome}</span>}
                        {p?.hora_entrada && <span className="text-[9px] text-slate-400">entrada {p.hora_entrada.slice(0,5)}</span>}
                        {p?.hora_saida && <span className="text-[9px] text-slate-400">saída {p.hora_saida.slice(0,5)}</span>}
                        {ins.cuidado_especial && ins.cuidado_especial !== 'Não' && (
                          <span className="flex items-center gap-0.5 text-[9px] font-black text-red-600 dark:text-red-400">
                            <AlertTriangle size={8}/> {ins.cuidado_especial}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Modal Inscrição */}
      {modalInscricao && (
        <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900">
              <h3 className="font-black text-sm uppercase tracking-tight text-slate-800 dark:text-slate-100">Inscrever Participante</h3>
              <button onClick={() => setModalInscricao(false)} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"><X size={16}/></button>
            </div>
            <form onSubmit={salvarInscricao} className="p-6 space-y-4">

              {/* Modo toggle: aluno regular × externo */}
              {!alunoSelecionado && (
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => { setModoExterno(false); setFormInscricao({}); }}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                      ${!modoExterno ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                    Aluno do ITP
                  </button>
                  <button type="button"
                    onClick={() => { setModoExterno(true); setBuscaAluno(''); setResultadosAluno([]); setFormInscricao({ tipo: 'externo' }); }}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                      ${modoExterno ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                    Externo
                  </button>
                </div>
              )}

              {/* ── MODO ALUNO ITP ──────────────────────────────────────────── */}
              {!modoExterno && !alunoSelecionado && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input value={buscaAluno} onChange={e => setBuscaAluno(e.target.value)}
                      placeholder="Buscar aluno pelo nome..."
                      autoFocus
                      className="w-full pl-9 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  </div>
                  {buscandoAluno && <p className="text-xs text-slate-400 px-1">Buscando...</p>}
                  {resultadosAluno.length > 0 && (
                    <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                      {resultadosAluno.map((a: any) => (
                        <button key={a.id} type="button"
                          onClick={() => {
                            const dados = {
                              aluno_id: a.id, tipo: 'regular',
                              nome_completo: a.nome_completo,
                              data_nascimento: a.data_nascimento,
                              nome_responsavel: a.nome_responsavel,
                              telefone_responsavel: a.telefone_alternativo,
                            };
                            setAlunoSelecionado(a);
                            setFormInscricao(dados);
                            setResultadosAluno([]);
                          }}
                          className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0">
                          <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-sm font-black text-purple-600 shrink-0">
                            {a.nome_completo[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{a.nome_completo}</p>
                            <p className="text-[10px] text-slate-400">{a.numero_matricula}</p>
                          </div>
                          {a.data_nascimento && (
                            <span className="text-[10px] text-slate-400 shrink-0">{calcIdade(a.data_nascimento)} anos</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {buscaAluno.length >= 3 && !buscandoAluno && resultadosAluno.length === 0 && (
                    <p className="text-xs text-slate-400 px-1">Nenhum aluno encontrado.</p>
                  )}
                </div>
              )}

              {/* ── ALUNO SELECIONADO — card read-only ──────────────────────── */}
              {alunoSelecionado && (
                <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/40 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-base font-black text-green-700 dark:text-green-400 shrink-0">
                        {alunoSelecionado.nome_completo[0]}
                      </div>
                      <div>
                        <p className="font-black text-sm text-slate-800 dark:text-slate-100">{alunoSelecionado.nome_completo}</p>
                        <p className="text-[10px] text-slate-500">{alunoSelecionado.numero_matricula}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => { setAlunoSelecionado(null); setFormInscricao({}); setBuscaAluno(''); }}
                      className="p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 shrink-0">
                      <X size={14}/>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {alunoSelecionado.data_nascimento && (
                      <div className="bg-white dark:bg-slate-900/50 rounded-xl px-3 py-2">
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Idade</p>
                        <p className="font-bold text-slate-700 dark:text-slate-300 mt-0.5">{calcIdade(alunoSelecionado.data_nascimento)} anos</p>
                      </div>
                    )}
                    {alunoSelecionado.nome_responsavel && (
                      <div className="bg-white dark:bg-slate-900/50 rounded-xl px-3 py-2">
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Responsável</p>
                        <p className="font-bold text-slate-700 dark:text-slate-300 mt-0.5 truncate">{alunoSelecionado.nome_responsavel}</p>
                      </div>
                    )}
                    {(alunoSelecionado.telefone_alternativo || alunoSelecionado.telefone_responsavel) && (
                      <div className="bg-white dark:bg-slate-900/50 rounded-xl px-3 py-2 col-span-2">
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Telefone</p>
                        <p className="font-bold text-slate-700 dark:text-slate-300 mt-0.5">{alunoSelecionado.telefone_alternativo || alunoSelecionado.telefone_responsavel}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── MODO EXTERNO — campos manuais ──────────────────────────── */}
              {modoExterno && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Nome Completo *</label>
                    <input required value={formInscricao.nome_completo ?? ''} onChange={e => setFormInscricao(p => ({ ...p, nome_completo: e.target.value }))}
                      autoFocus
                      className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Nascimento</label>
                      <input type="date" value={formInscricao.data_nascimento ?? ''} onChange={e => setFormInscricao(p => ({ ...p, data_nascimento: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Responsável</label>
                      <input value={formInscricao.nome_responsavel ?? ''} onChange={e => setFormInscricao(p => ({ ...p, nome_responsavel: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Telefone Responsável</label>
                    <input value={formInscricao.telefone_responsavel ?? ''} onChange={e => setFormInscricao(p => ({ ...p, telefone_responsavel: e.target.value }))}
                      className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  </div>
                </div>
              )}

              {/* Campos comuns (equipe + cuidado) — só mostra se aluno selecionado ou modo externo */}
              {(alunoSelecionado || modoExterno) && (
                <>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Equipe</label>
                    <select value={formInscricao.equipe_id ?? ''} onChange={e => setFormInscricao(p => ({ ...p, equipe_id: e.target.value || undefined }))}
                      className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400">
                      <option value="">Sem equipe</option>
                      {equipes.map(eq => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Cuidado Especial</label>
                    <input value={formInscricao.cuidado_especial ?? ''} onChange={e => setFormInscricao(p => ({ ...p, cuidado_especial: e.target.value }))}
                      placeholder="ex: Alérgico a glúten, TEA..."
                      className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalInscricao(false)}
                  className="px-4 py-2 rounded-xl text-xs font-black uppercase text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
                <button type="submit"
                  disabled={salvando || (!alunoSelecionado && !modoExterno) || (modoExterno && !formInscricao.nome_completo)}
                  className="px-5 py-2 rounded-xl text-xs font-black uppercase bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Inscrever'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Equipe */}
      {modalEquipe.open && (
        <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-sm uppercase tracking-tight text-slate-800 dark:text-slate-100">
                {modalEquipe.editando ? 'Editar Equipe' : 'Nova Equipe'}
              </h3>
              <button onClick={() => setModalEquipe({ open: false, editando: null })} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"><X size={16}/></button>
            </div>
            <form onSubmit={salvarEquipe} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Nome *</label>
                <input required value={formEquipe.nome ?? ''} onChange={e => setFormEquipe(p => ({ ...p, nome: e.target.value }))}
                  className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Cor</label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={formEquipe.cor ?? '#7c3aed'} onChange={e => setFormEquipe(p => ({ ...p, cor: e.target.value }))}
                    className="w-10 h-10 rounded-xl border border-slate-200 cursor-pointer" />
                  <span className="text-sm text-slate-500 font-mono">{formEquipe.cor}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Idade mín.</label>
                  <input type="number" min={0} max={99} value={formEquipe.faixa_min ?? ''} onChange={e => setFormEquipe(p => ({ ...p, faixa_min: +e.target.value || undefined }))}
                    className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Idade máx.</label>
                  <input type="number" min={0} max={99} value={formEquipe.faixa_max ?? ''} onChange={e => setFormEquipe(p => ({ ...p, faixa_max: +e.target.value || undefined }))}
                    className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalEquipe({ open: false, editando: null })}
                  className="px-4 py-2 rounded-xl text-xs font-black uppercase text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
                <button type="submit" disabled={salvando}
                  className="px-5 py-2 rounded-xl text-xs font-black uppercase bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function InscritoCard({ ins, equipes, onDelete, onChangeEquipe }: {
  ins: Inscricao; equipes: Equipe[];
  onDelete: () => void; onChangeEquipe: (id: string) => void;
}) {
  const eq = equipes.find(e => e.id === ins.equipe_id);
  const idade = calcIdade(ins.data_nascimento);
  const temCuidado = ins.cuidado_especial && ins.cuidado_especial !== 'Não';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0 text-sm font-black text-purple-600">
        {ins.nome_completo[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{ins.nome_completo}</span>
          {idade !== null && <span className="text-[9px] text-slate-400">{idade} anos</span>}
          {temCuidado && (
            <span className="flex items-center gap-0.5 text-[9px] font-black bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full">
              <AlertTriangle size={8}/> {ins.cuidado_especial}
            </span>
          )}
          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${ins.tipo === 'regular' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-500'}`}>
            {ins.tipo}
          </span>
        </div>
        {ins.nome_responsavel && (
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">Resp: {ins.nome_responsavel} {ins.telefone_responsavel ? `· ${ins.telefone_responsavel}` : ''}</p>
        )}
      </div>
      <select value={ins.equipe_id ?? ''} onChange={e => onChangeEquipe(e.target.value)}
        className="text-[10px] font-black border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-400 shrink-0"
        style={eq ? { borderColor: eq.cor, color: eq.cor } : {}}>
        <option value="">Sem equipe</option>
        {equipes.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
      </select>
      <button onClick={onDelete} className="p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-300 hover:text-red-500 shrink-0">
        <Trash2 size={13}/>
      </button>
    </div>
  );
}

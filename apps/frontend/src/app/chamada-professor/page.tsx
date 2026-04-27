'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  GraduationCap, Search, ChevronRight, Check, X, RefreshCw,
  ClipboardCheck, Users, ArrowLeft, Phone, UserCircle, ChevronDown,
  UserPlus, BookOpen, AlertCircle, Loader2, CheckCircle2,
} from 'lucide-react';

const BACKEND = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api');
const TOKEN   = process.env.NEXT_PUBLIC_CHAMADA_TOKEN || 'itp-chamada-2026';

type Step = 'login' | 'turmas' | 'chamada' | 'sucesso';
type ChamadaTab = 'chamada' | 'fichas' | 'incluir_aluno';

interface Turma    { id: string; nome: string; cor?: string; turno?: string; curso_nome?: string; }
interface Professor { id: string; nome: string; }
interface AlunoRow {
  id: string;
  nome_completo: string;
  numero_matricula?: string | null;
  celular?: string | null;
  telefone_alternativo?: string | null;
  nome_responsavel?: string | null;
  email_responsavel?: string | null;
  cpf_responsavel?: string | null;
  data_nascimento?: string | null;
}
interface AlunoSearchResult {
  id: string;
  nome_completo: string;
  numero_matricula?: string | null;
  celular?: string | null;
  data_nascimento?: string | null;
}
interface Registro { aluno_id: string; presente: boolean; }

function calcIdade(dataNasc?: string | null) {
  if (!dataNasc) return null;
  const hoje = new Date();
  const nasc = new Date(dataNasc + (dataNasc.length === 10 ? 'T12:00:00' : ''));
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

function fmtCPF(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
          .replace(/(\d{3})(\d{3})(\d{3})$/, '$1.$2.$3')
          .replace(/(\d{3})(\d{3})$/, '$1.$2')
          .replace(/(\d{3})$/, '$1');
}

function today() { return new Date().toISOString().split('T')[0]; }

function Avatar({ nome, size = 'md' }: { nome: string; size?: 'sm' | 'md' | 'lg' }) {
  const szClass = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm';
  return (
    <div className={`${szClass} rounded-full bg-purple-600/30 border border-purple-500/30 flex items-center justify-center shrink-0 font-black text-purple-300 uppercase`}>
      {nome[0] || '?'}
    </div>
  );
}

export default function ChamadaProfessorPage() {
  const [step, setStep]                     = useState<Step>('login');
  const [cpf, setCpf]                       = useState('');
  const [buscando, setBuscando]             = useState(false);
  const [erroLogin, setErroLogin]           = useState<string | null>(null);
  const [professor, setProfessor]           = useState<Professor | null>(null);
  const [turmas, setTurmas]                 = useState<Turma[]>([]);
  const [turmaEscolhida, setTurmaEscolhida] = useState<Turma | null>(null);
  const [data, setData]                     = useState(today());
  const [tema, setTema]                     = useState('');
  const [conteudo, setConteudo]             = useState('');
  const [alunos, setAlunos]                 = useState<AlunoRow[]>([]);
  const [registros, setRegistros]           = useState<Registro[]>([]);
  const [loadingAlunos, setLoadingAlunos]   = useState(false);
  const [salvando, setSalvando]             = useState(false);
  const [erroSalvar, setErroSalvar]         = useState<string | null>(null);
  const [chamadaTab, setChamadaTab]         = useState<ChamadaTab>('chamada');
  const [fichaAberta, setFichaAberta]       = useState<string | null>(null);

  // Incluir Aluno
  const [incluirNome, setIncluirNome]                   = useState('');
  const [incluirResultados, setIncluirResultados]       = useState<AlunoSearchResult[]>([]);
  const [incluirBuscando, setIncluirBuscando]           = useState(false);
  const [incluirSelecionado, setIncluirSelecionado]     = useState<AlunoSearchResult | null>(null);
  const [incluirConfirmando, setIncluirConfirmando]     = useState(false);
  const [incluirErro, setIncluirErro]                   = useState<string | null>(null);
  const [incluirSucesso, setIncluirSucesso]             = useState<{ nome: string; isencoes: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buscarProfessor = useCallback(async () => {
    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo.length < 11) { setErroLogin('Digite um CPF válido (11 dígitos).'); return; }
    setBuscando(true); setErroLogin(null);
    try {
      const res = await fetch(`${BACKEND}/academico/chamada/professor-turmas?cpf=${cpfLimpo}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Professor não encontrado com este CPF.');
      }
      const body = await res.json();
      setProfessor(body.professor);
      setTurmas(body.turmas || []);
      setStep('turmas');
    } catch (e: any) {
      setErroLogin(e.message || 'Erro ao buscar professor.');
    } finally {
      setBuscando(false);
    }
  }, [cpf]);

  const recarregarAlunos = useCallback(async (turmaId: string) => {
    setLoadingAlunos(true);
    try {
      const res = await fetch(`${BACKEND}/academico/chamada/alunos?token=${TOKEN}&turma_id=${turmaId}`);
      const body = await res.json();
      const lista: AlunoRow[] = Array.isArray(body.alunos) ? body.alunos : [];
      setAlunos(lista);
      setRegistros(prev => {
        const prevMap = Object.fromEntries(prev.map(r => [r.aluno_id, r.presente]));
        return lista.map(a => ({ aluno_id: a.id, presente: prevMap[a.id] ?? true }));
      });
    } catch {
      setAlunos([]);
    } finally {
      setLoadingAlunos(false);
    }
  }, []);

  const escolherTurma = useCallback(async (t: Turma) => {
    setTurmaEscolhida(t);
    setAlunos([]);
    setFichaAberta(null);
    setChamadaTab('chamada');
    setIncluirNome('');
    setIncluirResultados([]);
    setIncluirSelecionado(null);
    setIncluirSucesso(null);
    setIncluirErro(null);
    setStep('chamada');
    setLoadingAlunos(true);
    try {
      const res = await fetch(`${BACKEND}/academico/chamada/alunos?token=${TOKEN}&turma_id=${t.id}`);
      const body = await res.json();
      const lista: AlunoRow[] = Array.isArray(body.alunos) ? body.alunos : [];
      setAlunos(lista);
      setRegistros(lista.map(a => ({ aluno_id: a.id, presente: true })));
    } catch {
      setAlunos([]);
    } finally {
      setLoadingAlunos(false);
    }
  }, []);

  const togglePresenca = (alunoId: string) => {
    setRegistros(prev => prev.map(r => r.aluno_id === alunoId ? { ...r, presente: !r.presente } : r));
  };

  const salvar = useCallback(async () => {
    if (!turmaEscolhida || !professor) return;
    if (!tema.trim()) { setErroSalvar('Informe o tema da aula.'); return; }
    setSalvando(true); setErroSalvar(null);
    try {
      const res = await fetch(`${BACKEND}/academico/chamada`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: TOKEN, turma_id: turmaEscolhida.id, data,
          tema_aula: tema, conteudo_abordado: conteudo,
          professor_nome: professor.nome, registros,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Erro ao salvar chamada.');
      }
      setStep('sucesso');
    } catch (e: any) {
      setErroSalvar(e.message || 'Erro ao salvar chamada.');
    } finally {
      setSalvando(false);
    }
  }, [turmaEscolhida, professor, tema, conteudo, data, registros]);

  // Busca de alunos existentes (debounced)
  const onIncluirNomeChange = (v: string) => {
    setIncluirNome(v);
    setIncluirSelecionado(null);
    setIncluirSucesso(null);
    setIncluirErro(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.trim().length < 2) { setIncluirResultados([]); return; }
    debounceRef.current = setTimeout(async () => {
      setIncluirBuscando(true);
      try {
        const res = await fetch(`${BACKEND}/academico/chamada/buscar-alunos?token=${TOKEN}&nome=${encodeURIComponent(v.trim())}`);
        const body = await res.json();
        setIncluirResultados(Array.isArray(body.alunos) ? body.alunos : []);
      } catch {
        setIncluirResultados([]);
      } finally {
        setIncluirBuscando(false);
      }
    }, 350);
  };

  const confirmarInclusao = useCallback(async () => {
    if (!incluirSelecionado || !turmaEscolhida) return;
    setIncluirConfirmando(true); setIncluirErro(null);
    try {
      const res = await fetch(`${BACKEND}/academico/chamada/incluir-aluno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TOKEN, turma_id: turmaEscolhida.id, aluno_id: incluirSelecionado.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Erro ao incluir aluno.');
      setIncluirSucesso({ nome: incluirSelecionado.nome_completo, isencoes: body.isencoes_retroativas ?? 0 });
      setIncluirNome('');
      setIncluirResultados([]);
      setIncluirSelecionado(null);
      await recarregarAlunos(turmaEscolhida.id);
    } catch (e: any) {
      setIncluirErro(e.message || 'Erro ao incluir aluno.');
    } finally {
      setIncluirConfirmando(false);
    }
  }, [incluirSelecionado, turmaEscolhida, recarregarAlunos]);

  const presentes = registros.filter(r => r.presente).length;
  const ausentes  = registros.length - presentes;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex flex-col items-center justify-start p-4 pt-8 pb-12">
      <div className="w-full max-w-md">

        {/* Logo / Topo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-purple-600/20 border border-purple-500/30 rounded-2xl mb-3 backdrop-blur">
            <GraduationCap className="text-purple-400" size={26} />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">
            Chamada <span className="text-purple-400">ITP</span>
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">Portal do Professor</p>
        </div>

        {/* ── LOGIN ── */}
        {step === 'login' && (
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-3xl p-6 space-y-5">
            <div>
              <h2 className="text-white font-black text-lg">Identificação</h2>
              <p className="text-slate-400 text-sm mt-0.5">Digite seu CPF para acessar suas turmas.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">CPF do Professor</label>
              <input
                value={cpf}
                onChange={e => { setCpf(fmtCPF(e.target.value)); setErroLogin(null); }}
                onKeyDown={e => e.key === 'Enter' && buscarProfessor()}
                placeholder="000.000.000-00"
                inputMode="numeric"
                className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-2xl px-4 py-3.5 text-lg font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            {erroLogin && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
                <AlertCircle size={15} className="shrink-0 mt-0.5"/>
                <span>{erroLogin}</span>
              </div>
            )}
            <button
              onClick={buscarProfessor}
              disabled={buscando || cpf.replace(/\D/g, '').length < 11}
              className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 disabled:opacity-40 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest transition-all active:scale-[0.98]">
              {buscando ? <><Loader2 size={16} className="animate-spin"/> Buscando...</> : <><Search size={15}/> Entrar</>}
            </button>
          </div>
        )}

        {/* ── TURMAS ── */}
        {step === 'turmas' && professor && (
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-3xl overflow-hidden">
            <div className="px-5 pt-5 pb-4 border-b border-white/10">
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Professor</p>
              <h2 className="text-white font-black text-lg mt-0.5">{professor.nome}</h2>
              <p className="text-slate-400 text-xs mt-1">Selecione a turma para iniciar a chamada.</p>
            </div>
            {turmas.length === 0 ? (
              <div className="py-16 text-center px-6 space-y-3">
                <Users size={32} className="text-slate-600 mx-auto"/>
                <p className="text-slate-400 text-sm">Nenhuma turma ativa vinculada.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {turmas.map(t => (
                  <button key={t.id} onClick={() => escolherTurma(t)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/5 active:bg-white/10 transition-colors text-left group">
                    <span className="w-4 h-4 rounded-full shrink-0 shadow-lg" style={{ backgroundColor: t.cor || '#7c3aed' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-black text-sm">{t.nome}</div>
                      <div className="text-slate-500 text-xs mt-0.5 flex items-center gap-1.5">
                        {t.curso_nome && <span>{t.curso_nome}</span>}
                        {t.turno && <><span>·</span><span>{t.turno}</span></>}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-600 group-hover:text-purple-400 transition-colors shrink-0"/>
                  </button>
                ))}
              </div>
            )}
            <div className="px-5 py-4 border-t border-white/10">
              <button onClick={() => setStep('login')} className="text-slate-500 text-xs hover:text-white flex items-center gap-1.5 transition-colors">
                <ArrowLeft size={12}/> Trocar CPF
              </button>
            </div>
          </div>
        )}

        {/* ── CHAMADA ── */}
        {step === 'chamada' && turmaEscolhida && professor && (
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-3xl overflow-hidden">

            {/* Header turma */}
            <div className="px-5 pt-5 pb-4 border-b border-white/10">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-3.5 h-3.5 rounded-full shrink-0 shadow" style={{ backgroundColor: turmaEscolhida.cor || '#7c3aed' }}/>
                  <div className="min-w-0">
                    <h2 className="text-white font-black text-base truncate">{turmaEscolhida.nome}</h2>
                    <p className="text-slate-500 text-xs truncate">{professor.nome}</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-1.5 text-center">
                    <div className="text-green-400 font-black text-xl leading-none">{presentes}</div>
                    <div className="text-green-600 text-[9px] uppercase font-black">Pres</div>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-1.5 text-center">
                    <div className="text-red-400 font-black text-xl leading-none">{ausentes}</div>
                    <div className="text-red-600 text-[9px] uppercase font-black">Aus</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/10 bg-white/3">
              {([
                { id: 'chamada',       label: 'Chamada',  Icon: ClipboardCheck },
                { id: 'fichas',        label: 'Fichas',   Icon: Users },
                { id: 'incluir_aluno', label: 'Incluir',  Icon: UserPlus },
              ] as { id: ChamadaTab; label: string; Icon: any }[]).map(({ id, label, Icon }) => (
                <button key={id} onClick={() => { setChamadaTab(id); setIncluirErro(null); }}
                  className={`flex-1 py-3.5 text-[10px] font-black uppercase tracking-wider transition-colors flex flex-col items-center gap-1
                    ${chamadaTab === id
                      ? id === 'incluir_aluno'
                        ? 'text-emerald-400 border-b-2 border-emerald-400'
                        : 'text-purple-400 border-b-2 border-purple-400'
                      : 'text-slate-500 hover:text-slate-300'}`}>
                  <Icon size={16}/>
                  {label}
                </button>
              ))}
            </div>

            {/* Tab: Chamada */}
            {chamadaTab === 'chamada' && (
              <>
                <div className="px-5 py-4 space-y-3 border-b border-white/10">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Data</label>
                      <input type="date" value={data} onChange={e => setData(e.target.value)}
                        className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 [color-scheme:dark]"/>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Tema *</label>
                      <input value={tema} onChange={e => setTema(e.target.value)} placeholder="Tema da aula..."
                        className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"/>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Conteúdo</label>
                    <textarea value={conteudo} onChange={e => setConteudo(e.target.value)} rows={2} placeholder="Descreva o conteúdo da aula..."
                      className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"/>
                  </div>
                </div>

                {/* Lista de alunos */}
                <div className="max-h-[45vh] overflow-y-auto">
                  {loadingAlunos ? (
                    <div className="py-12 flex flex-col items-center gap-3 text-slate-500">
                      <Loader2 size={24} className="animate-spin"/>
                      <span className="text-sm">Carregando alunos...</span>
                    </div>
                  ) : alunos.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-sm">Nenhum aluno nesta turma.</div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {alunos.map(a => {
                        const reg = registros.find(r => r.aluno_id === a.id);
                        const presente = reg?.presente ?? true;
                        return (
                          <button key={a.id} onClick={() => togglePresenca(a.id)}
                            className={`w-full flex items-center gap-3 px-5 py-4 transition-all text-left active:scale-[0.98]
                              ${presente ? 'hover:bg-green-500/5' : 'bg-red-500/5 hover:bg-red-500/8 opacity-70'}`}>
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-black transition-all
                              ${presente ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-slate-500'}`}>
                              {presente ? <Check size={16}/> : (a.nome_completo[0] || '?').toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm font-bold truncate transition-colors ${presente ? 'text-white' : 'text-slate-500'}`}>
                                {a.nome_completo}
                              </div>
                              {a.celular && <div className="text-slate-600 text-xs">{a.celular}</div>}
                            </div>
                            <div className={`w-7 h-7 rounded-full border-2 shrink-0 flex items-center justify-center transition-all
                              ${presente ? 'bg-green-500 border-green-500' : 'bg-transparent border-slate-700'}`}>
                              {presente && <Check size={12} className="text-white"/>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="px-5 py-4 border-t border-white/10 space-y-3">
                  {erroSalvar && (
                    <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl px-4 py-3">
                      <AlertCircle size={13} className="shrink-0 mt-0.5"/>{erroSalvar}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button onClick={() => setStep('turmas')}
                      className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-white/20 text-slate-400 hover:text-white hover:border-white/40 text-xs font-black uppercase transition-all">
                      <ArrowLeft size={13}/> Voltar
                    </button>
                    <button onClick={salvar} disabled={salvando || alunos.length === 0}
                      className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 disabled:opacity-40 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider transition-all active:scale-[0.98]">
                      {salvando ? <><Loader2 size={13} className="animate-spin"/> Salvando...</> : <><ClipboardCheck size={13}/> Salvar Chamada</>}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Tab: Fichas */}
            {chamadaTab === 'fichas' && (
              <div className="max-h-[65vh] overflow-y-auto">
                {loadingAlunos ? (
                  <div className="py-12 flex flex-col items-center gap-3 text-slate-500">
                    <Loader2 size={24} className="animate-spin"/>
                    <span className="text-sm">Carregando...</span>
                  </div>
                ) : alunos.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-sm">Nenhum aluno nesta turma.</div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {alunos.map(a => {
                      const idade = calcIdade(a.data_nascimento);
                      const aberta = fichaAberta === a.id;
                      return (
                        <div key={a.id}>
                          <button onClick={() => setFichaAberta(aberta ? null : a.id)}
                            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/5 active:bg-white/10 transition-colors text-left">
                            <Avatar nome={a.nome_completo} size="md"/>
                            <div className="flex-1 min-w-0">
                              <div className="text-white text-sm font-bold truncate">{a.nome_completo}</div>
                              <div className="text-slate-500 text-xs flex items-center gap-2 mt-0.5">
                                {idade !== null && <span>{idade} anos</span>}
                                {a.celular && <span className="flex items-center gap-1"><Phone size={9}/>{a.celular}</span>}
                              </div>
                            </div>
                            <ChevronDown size={15} className={`text-slate-600 transition-transform shrink-0 ${aberta ? 'rotate-180' : ''}`}/>
                          </button>
                          {aberta && (
                            <div className="px-5 pb-5 space-y-3 bg-white/3">
                              <div className="grid grid-cols-2 gap-3 pt-2">
                                {a.celular && (
                                  <div>
                                    <p className="text-[9px] font-black uppercase text-slate-600 tracking-widest">Celular</p>
                                    <p className="text-slate-200 text-xs font-semibold mt-0.5">{a.celular}</p>
                                  </div>
                                )}
                                {a.telefone_alternativo && (
                                  <div>
                                    <p className="text-[9px] font-black uppercase text-slate-600 tracking-widest">Alternativo</p>
                                    <p className="text-slate-200 text-xs font-semibold mt-0.5">{a.telefone_alternativo}</p>
                                  </div>
                                )}
                                {a.data_nascimento && (
                                  <div>
                                    <p className="text-[9px] font-black uppercase text-slate-600 tracking-widest">Nascimento</p>
                                    <p className="text-slate-200 text-xs font-semibold mt-0.5">
                                      {new Date(a.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                                      {idade !== null && <span className="text-slate-500 ml-1">({idade} anos)</span>}
                                    </p>
                                  </div>
                                )}
                              </div>
                              {a.nome_responsavel && (
                                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-3">
                                  <p className="text-[9px] font-black uppercase text-purple-500 tracking-widest mb-1.5 flex items-center gap-1">
                                    <UserCircle size={10}/> Responsável
                                  </p>
                                  <p className="text-white text-xs font-bold">{a.nome_responsavel}</p>
                                  {a.email_responsavel && <p className="text-slate-400 text-xs mt-0.5">{a.email_responsavel}</p>}
                                </div>
                              )}
                              {!a.celular && !a.telefone_alternativo && !a.nome_responsavel && (
                                <p className="text-slate-600 text-xs italic">Sem contatos cadastrados.</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="px-5 py-4 border-t border-white/10">
                  <button onClick={() => setStep('turmas')} className="text-slate-500 text-xs hover:text-white flex items-center gap-1.5 transition-colors">
                    <ArrowLeft size={12}/> Voltar às turmas
                  </button>
                </div>
              </div>
            )}

            {/* Tab: Incluir Aluno */}
            {chamadaTab === 'incluir_aluno' && (
              <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
                {/* Cabeçalho explicativo */}
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3.5 flex gap-3">
                  <UserPlus size={18} className="text-emerald-400 shrink-0 mt-0.5"/>
                  <div>
                    <p className="text-emerald-400 font-black text-sm">Incluir Aluno na Turma</p>
                    <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                      Busque um aluno já cadastrado no sistema. Chamadas anteriores serão marcadas como <strong className="text-slate-300">Isento</strong> automaticamente.
                    </p>
                  </div>
                </div>

                {/* Sucesso */}
                {incluirSucesso && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-4 py-5 text-center space-y-2">
                    <CheckCircle2 size={32} className="text-emerald-400 mx-auto"/>
                    <p className="text-white font-black text-sm">{incluirSucesso.nome} incluído!</p>
                    {incluirSucesso.isencoes > 0 && (
                      <p className="text-slate-400 text-xs">
                        {incluirSucesso.isencoes} chamada{incluirSucesso.isencoes !== 1 ? 's' : ''} anterior{incluirSucesso.isencoes !== 1 ? 'es marcadas' : ' marcada'} como Isento.
                      </p>
                    )}
                    <button
                      onClick={() => setIncluirSucesso(null)}
                      className="mt-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all active:scale-[0.98]">
                      Incluir outro aluno
                    </button>
                  </div>
                )}

                {!incluirSucesso && (
                  <>
                    {/* Campo de busca */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Nome do Aluno</label>
                      <div className="relative">
                        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"/>
                        <input
                          value={incluirNome}
                          onChange={e => onIncluirNomeChange(e.target.value)}
                          placeholder="Digite o nome para buscar..."
                          className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-600 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        {incluirBuscando && (
                          <Loader2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 animate-spin"/>
                        )}
                      </div>
                    </div>

                    {/* Erro */}
                    {incluirErro && (
                      <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl px-4 py-3">
                        <AlertCircle size={13} className="shrink-0 mt-0.5"/>{incluirErro}
                      </div>
                    )}

                    {/* Aluno selecionado — confirmação */}
                    {incluirSelecionado && (
                      <div className="bg-white/5 border border-emerald-500/30 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <Avatar nome={incluirSelecionado.nome_completo} size="lg"/>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-black text-sm truncate">{incluirSelecionado.nome_completo}</p>
                            {incluirSelecionado.numero_matricula && (
                              <p className="text-slate-500 text-xs mt-0.5">{incluirSelecionado.numero_matricula}</p>
                            )}
                            {incluirSelecionado.celular && (
                              <p className="text-slate-500 text-xs flex items-center gap-1 mt-0.5">
                                <Phone size={9}/>{incluirSelecionado.celular}
                              </p>
                            )}
                          </div>
                          <button onClick={() => setIncluirSelecionado(null)} className="text-slate-500 hover:text-white p-1 transition-colors">
                            <X size={16}/>
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setIncluirSelecionado(null)}
                            className="flex-1 py-2.5 rounded-xl border border-white/20 text-slate-400 hover:text-white text-xs font-black uppercase transition-all">
                            Cancelar
                          </button>
                          <button onClick={confirmarInclusao} disabled={incluirConfirmando}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black uppercase transition-all active:scale-[0.98]">
                            {incluirConfirmando ? <><Loader2 size={12} className="animate-spin"/> Incluindo...</> : <><Check size={12}/> Confirmar</>}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Resultados da busca */}
                    {!incluirSelecionado && incluirResultados.length > 0 && (
                      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                        <p className="px-4 py-2 text-[10px] font-black uppercase text-slate-500 tracking-widest border-b border-white/10">
                          {incluirResultados.length} resultado{incluirResultados.length !== 1 ? 's' : ''}
                        </p>
                        <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
                          {incluirResultados.map(a => (
                            <button key={a.id} onClick={() => setIncluirSelecionado(a)}
                              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-emerald-500/5 active:bg-emerald-500/10 transition-colors text-left">
                              <Avatar nome={a.nome_completo} size="sm"/>
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-bold truncate">{a.nome_completo}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {a.numero_matricula && <span className="text-slate-500 text-xs">{a.numero_matricula}</span>}
                                  {a.celular && <span className="text-slate-600 text-xs flex items-center gap-0.5"><Phone size={9}/>{a.celular}</span>}
                                  {a.data_nascimento && <span className="text-slate-600 text-xs">{calcIdade(a.data_nascimento)} anos</span>}
                                </div>
                              </div>
                              <ChevronRight size={14} className="text-slate-600 shrink-0"/>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {!incluirSelecionado && !incluirBuscando && incluirNome.trim().length >= 2 && incluirResultados.length === 0 && (
                      <div className="text-center py-6 text-slate-500 text-sm space-y-1">
                        <BookOpen size={24} className="mx-auto text-slate-700"/>
                        <p>Nenhum aluno encontrado.</p>
                        <p className="text-xs">Verifique o nome ou cadastre no sistema.</p>
                      </div>
                    )}

                    {!incluirSelecionado && incluirNome.trim().length < 2 && (
                      <p className="text-center text-slate-600 text-xs py-4">Digite pelo menos 2 caracteres para buscar.</p>
                    )}
                  </>
                )}
              </div>
            )}

          </div>
        )}

        {/* ── SUCESSO ── */}
        {step === 'sucesso' && (
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-3xl p-8 text-center space-y-5">
            <div className="w-20 h-20 bg-green-500/10 border-2 border-green-500/30 rounded-full flex items-center justify-center mx-auto">
              <Check size={36} className="text-green-400"/>
            </div>
            <div>
              <h2 className="text-white font-black text-xl">Chamada Registrada!</h2>
              <p className="text-slate-400 text-sm mt-2">
                <strong className="text-white">{turmaEscolhida?.nome}</strong> — {presentes} presente{presentes !== 1 ? 's' : ''} / {ausentes} ausente{ausentes !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => { setTema(''); setConteudo(''); setData(today()); setRegistros([]); setStep('turmas'); }}
                className="w-full py-4 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-black rounded-2xl text-sm uppercase tracking-wider transition-all active:scale-[0.98]">
                Nova Chamada
              </button>
              <button onClick={() => { setCpf(''); setProfessor(null); setTurmas([]); setStep('login'); }}
                className="text-slate-500 text-xs hover:text-slate-300 py-2 transition-colors">
                Trocar professor
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

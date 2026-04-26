'use client';

import React, { useState, useCallback } from 'react';
import { GraduationCap, Search, ChevronRight, Check, X, RefreshCw, ClipboardCheck, Users, ArrowLeft } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';

type Step = 'login' | 'turmas' | 'chamada' | 'sucesso';

interface Turma { id: string; nome: string; cor?: string; turno?: string; curso_nome?: string; }
interface Professor { id: string; nome: string; }
interface AlunoRow { id: string; nome_completo: string; celular?: string; foto_url?: string; }
interface Registro { aluno_id: string; presente: boolean; }

const TOKEN = process.env.NEXT_PUBLIC_CHAMADA_TOKEN || 'itp-chamada-2026';

function fmtCPF(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
          .replace(/(\d{3})(\d{3})(\d{3})$/, '$1.$2.$3')
          .replace(/(\d{3})(\d{3})$/, '$1.$2')
          .replace(/(\d{3})$/, '$1');
}

function today() {
  return new Date().toISOString().split('T')[0];
}

export default function ChamadaProfessorPage() {
  const [step, setStep] = useState<Step>('login');
  const [cpf, setCpf] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [erroLogin, setErroLogin] = useState<string | null>(null);
  const [professor, setProfessor] = useState<Professor | null>(null);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmaEscolhida, setTurmaEscolhida] = useState<Turma | null>(null);
  const [data, setData] = useState(today());
  const [tema, setTema] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [alunos, setAlunos] = useState<AlunoRow[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loadingAlunos, setLoadingAlunos] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const buscarProfessor = useCallback(async () => {
    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo.length < 11) { setErroLogin('Digite um CPF válido (11 dígitos).'); return; }
    setBuscando(true); setErroLogin(null);
    try {
      const res = await fetch(`${API}/api/academico/chamada/professor-turmas?cpf=${cpfLimpo}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Professor não encontrado com este CPF.');
      }
      const data = await res.json();
      setProfessor(data.professor);
      setTurmas(data.turmas || []);
      setStep('turmas');
    } catch (e: any) {
      setErroLogin(e.message || 'Erro ao buscar professor.');
    } finally {
      setBuscando(false);
    }
  }, [cpf]);

  const escolherTurma = useCallback(async (t: Turma) => {
    setTurmaEscolhida(t);
    setAlunos([]);
    setLoadingAlunos(true);
    setStep('chamada');
    try {
      const res = await fetch(`${API}/api/academico/chamada/alunos?token=${TOKEN}&turma_id=${t.id}`);
      const d = await res.json();
      const lista: AlunoRow[] = Array.isArray(d.alunos) ? d.alunos : [];
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
      const res = await fetch(`${API}/api/academico/chamada`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: TOKEN,
          turma_id: turmaEscolhida.id,
          data,
          tema_aula: tema,
          conteudo_abordado: conteudo,
          professor_nome: professor.nome,
          registros,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || 'Erro ao salvar chamada.');
      }
      setStep('sucesso');
    } catch (e: any) {
      setErroSalvar(e.message || 'Erro ao salvar chamada.');
    } finally {
      setSalvando(false);
    }
  }, [turmaEscolhida, professor, tema, conteudo, data, registros]);

  const presentes = registros.filter(r => r.presente).length;
  const ausentes = registros.length - presentes;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600/20 border border-purple-500/30 rounded-2xl mb-4 backdrop-blur">
            <GraduationCap className="text-purple-400" size={28} />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Chamada <span className="text-purple-400">ITP</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Portal do Professor</p>
        </div>

        {/* ── STEP: Login ── */}
        {step === 'login' && (
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-3xl p-8 space-y-5">
            <div>
              <h2 className="text-white font-black text-lg">Identificação</h2>
              <p className="text-slate-400 text-sm mt-1">Digite seu CPF para acessar suas turmas.</p>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">CPF do Professor</label>
              <input
                value={cpf}
                onChange={e => { setCpf(fmtCPF(e.target.value)); setErroLogin(null); }}
                onKeyDown={e => e.key === 'Enter' && buscarProfessor()}
                placeholder="000.000.000-00"
                className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-2xl px-4 py-3 text-base font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            {erroLogin && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium rounded-xl px-4 py-3">
                <X size={14} className="shrink-0 mt-0.5"/>
                <span>{erroLogin}</span>
              </div>
            )}
            <button
              onClick={buscarProfessor}
              disabled={buscando || cpf.replace(/\D/g, '').length < 11}
              className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-black py-3 rounded-2xl text-sm uppercase tracking-widest transition-all active:scale-95">
              {buscando ? <><RefreshCw size={15} className="animate-spin"/> Buscando...</> : <><Search size={15}/> Entrar</>}
            </button>
          </div>
        )}

        {/* ── STEP: Escolher Turma ── */}
        {step === 'turmas' && professor && (
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-3xl overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-white/10">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Professor</p>
              <h2 className="text-white font-black text-xl">{professor.nome}</h2>
              <p className="text-slate-400 text-sm mt-1">Selecione a turma para iniciar a chamada.</p>
            </div>
            {turmas.length === 0 ? (
              <div className="py-16 text-center px-6 space-y-3">
                <Users size={32} className="text-slate-600 mx-auto"/>
                <p className="text-slate-400 text-sm font-bold">Nenhuma turma ativa vinculada a este professor.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {turmas.map(t => (
                  <button key={t.id} onClick={() => escolherTurma(t)}
                    className="w-full flex items-center gap-4 px-6 py-4 hover:bg-white/10 transition-colors text-left group">
                    <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: t.cor || '#7c3aed' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-black text-sm">{t.nome}</div>
                      <div className="text-slate-400 text-xs mt-0.5 flex items-center gap-2">
                        {t.curso_nome && <span>{t.curso_nome}</span>}
                        {t.turno && <span>· {t.turno}</span>}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-500 group-hover:text-purple-400 transition-colors shrink-0"/>
                  </button>
                ))}
              </div>
            )}
            <div className="px-6 pb-5 pt-3 border-t border-white/10">
              <button onClick={() => setStep('login')} className="text-slate-400 text-xs hover:text-white flex items-center gap-1.5">
                <ArrowLeft size={12}/> Trocar CPF
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: Chamada ── */}
        {step === 'chamada' && turmaEscolhida && professor && (
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-3xl overflow-hidden space-y-0">
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-white/10 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: turmaEscolhida.cor || '#7c3aed' }}/>
                  <h2 className="text-white font-black">{turmaEscolhida.nome}</h2>
                </div>
                <p className="text-slate-400 text-xs">{professor.nome}</p>
              </div>
              <div className="flex gap-3 text-center shrink-0">
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-1.5">
                  <div className="text-green-400 font-black text-lg leading-none">{presentes}</div>
                  <div className="text-green-500/60 text-[9px] uppercase font-black mt-0.5">Pres.</div>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-1.5">
                  <div className="text-red-400 font-black text-lg leading-none">{ausentes}</div>
                  <div className="text-red-500/60 text-[9px] uppercase font-black mt-0.5">Aus.</div>
                </div>
              </div>
            </div>

            {/* Dados da aula */}
            <div className="px-6 py-4 space-y-3 border-b border-white/10">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400">Data</label>
                  <input type="date" value={data} onChange={e => setData(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"/>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400">Tema da Aula *</label>
                  <input value={tema} onChange={e => setTema(e.target.value)} placeholder="Ex: Introdução..."
                    className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"/>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400">Conteúdo Abordado</label>
                <textarea value={conteudo} onChange={e => setConteudo(e.target.value)} rows={2} placeholder="Descreva o conteúdo da aula..."
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"/>
              </div>
            </div>

            {/* Lista de alunos */}
            <div className="max-h-64 overflow-y-auto">
              {loadingAlunos ? (
                <div className="py-10 text-center text-slate-400 text-sm">Carregando alunos...</div>
              ) : alunos.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm">Nenhum aluno encontrado nesta turma.</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {alunos.map(a => {
                    const reg = registros.find(r => r.aluno_id === a.id);
                    const presente = reg?.presente ?? true;
                    return (
                      <button key={a.id} onClick={() => togglePresenca(a.id)}
                        className={`w-full flex items-center gap-3 px-6 py-3 transition-colors text-left ${presente ? 'hover:bg-green-500/5' : 'hover:bg-red-500/5 opacity-60'}`}>
                        {a.foto_url
                          ? <img src={a.foto_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 border border-white/20"/>
                          : <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-xs font-black text-white/60">{(a.nome_completo[0] || '?').toUpperCase()}</div>}
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-bold truncate">{a.nome_completo}</div>
                          {a.celular && <div className="text-slate-500 text-xs">{a.celular}</div>}
                        </div>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${presente ? 'bg-green-500 border-green-500' : 'bg-transparent border-slate-600'}`}>
                          {presente && <Check size={13} className="text-white"/>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/10 space-y-3">
              {erroSalvar && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-xl px-4 py-3">
                  <X size={12} className="shrink-0 mt-0.5"/>{erroSalvar}
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setStep('turmas')} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/20 text-slate-400 hover:text-white text-xs font-black uppercase">
                  <ArrowLeft size={12}/> Voltar
                </button>
                <button onClick={salvar} disabled={salvando || alunos.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95">
                  {salvando ? <><RefreshCw size={13} className="animate-spin"/> Salvando...</> : <><ClipboardCheck size={13}/> Salvar Chamada</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP: Sucesso ── */}
        {step === 'sucesso' && (
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-3xl p-10 text-center space-y-5">
            <div className="w-20 h-20 bg-green-500/10 border-2 border-green-500/30 rounded-full flex items-center justify-center mx-auto">
              <Check size={36} className="text-green-400"/>
            </div>
            <div>
              <h2 className="text-white font-black text-xl">Chamada Registrada!</h2>
              <p className="text-slate-400 text-sm mt-2">
                Turma <strong className="text-white">{turmaEscolhida?.nome}</strong> — {presentes}P / {ausentes}A
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setTema(''); setConteudo(''); setData(today()); setRegistros([]); setStep('turmas'); }}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-2xl text-sm uppercase tracking-wider">
                Nova Chamada
              </button>
              <button onClick={() => { setCpf(''); setProfessor(null); setTurmas([]); setStep('login'); }}
                className="text-slate-500 text-xs hover:text-slate-300 py-2">Trocar professor</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

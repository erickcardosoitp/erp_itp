'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Rocket, X, ClipboardCheck, Package,
  ChevronRight, CheckSquare, Square,
  Loader2, CheckCircle2, QrCode, ArrowLeft,
  BookOpen, CalendarDays, Clock,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import api from '@/services/api';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Turma {
  id: string;
  nome: string;
  turno?: string;
  hora_inicio?: string;
  hora_fim?: string;
}

interface Aluno {
  id: string;
  nome_completo: string;
  numero_matricula?: string;
}

type Etapa = 'menu' | 'chamada-form' | 'chamada-lista' | 'chamada-ok' | 'qrcode';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function temPermissao(user: any, modulo: string): boolean {
  if (!user) return false;
  if (user.role?.toLowerCase() === 'admin') return true;
  const mv = user.grupo?.grupo_permissoes?.modulos_visiveis;
  if (mv?.[modulo]) return true;
  // Por cargo
  const r = user.role?.toLowerCase();
  if (modulo === 'academico') return ['prof', 'monitor', 'drt', 'adjunto', 'vp'].includes(r);
  if (modulo === 'estoque')   return ['cozinha', 'assist', 'drt', 'adjunto', 'vp'].includes(r);
  return false;
}

const hojeISO = () => new Date().toISOString().slice(0, 10);
const fmtData  = (v: string) => { const [y,m,d] = v.split('-'); return `${d}/${m}/${y}`; };

// ─── Componente ──────────────────────────────────────────────────────────────

export default function LaunchPad() {
  const { user } = useAuth();
  const [aberto, setAberto]   = useState(false);
  const [etapa, setEtapa]     = useState<Etapa>('menu');
  const wrapperRef            = useRef<HTMLDivElement>(null);

  // ── Turmas ──
  const [turmas, setTurmas]               = useState<Turma[]>([]);
  const [carregandoTurmas, setCarregandoTurmas] = useState(false);

  // ── Formulário chamada ──
  const [form, setForm] = useState({
    turma_id:          '',
    data:              hojeISO(),
    hora_inicio:       '',
    hora_fim:          '',
    tema_aula:         '',
    conteudo_abordado: '',
  });

  // ── Chamada lista ──
  const [alunos, setAlunos]               = useState<Aluno[]>([]);
  const [presenca, setPresenca]           = useState<Record<string, boolean>>({});
  const [carregandoAlunos, setCarregandoAlunos] = useState(false);
  const [salvando, setSalvando]           = useState(false);
  const [erroModal, setErroModal]         = useState('');
  const [resultOk, setResultOk]           = useState<{ presentes: number; ausentes: number } | null>(null);

  // ── URL para QR code ──
  const loginUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/login`
    : '';

  // Fechar ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    if (aberto) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [aberto]);

  const podeChamada = temPermissao(user, 'academico');
  const podeEstoque = temPermissao(user, 'estoque');

  if (!podeChamada && !podeEstoque) return null;

  // ── Abrir / fechar ──
  const abrir = async () => {
    setAberto(true);
    setEtapa('menu');
    setErroModal('');
    if (podeChamada && !turmas.length) {
      setCarregandoTurmas(true);
      try {
        const r = await api.get('/academico/turmas');
        setTurmas(r.data.filter((t: any) => t.ativo !== false));
      } catch { /* silencioso */ }
      setCarregandoTurmas(false);
    }
  };
  const fechar = () => { setAberto(false); resetChamada(); };

  const resetChamada = () => {
    setEtapa('menu');
    setForm({ turma_id: '', data: hojeISO(), hora_inicio: '', hora_fim: '', tema_aula: '', conteudo_abordado: '' });
    setAlunos([]); setPresenca({}); setErroModal(''); setResultOk(null);
  };

  // ── Preencher horários ao selecionar turma ──
  const onTurmaChange = (id: string) => {
    const t = turmas.find(x => x.id === id);
    setForm(p => ({
      ...p,
      turma_id:    id,
      hora_inicio: t?.hora_inicio || '',
      hora_fim:    t?.hora_fim    || '',
    }));
  };

  // ── Avançar para lista de alunos ──
  const avancarLista = async () => {
    setErroModal('');
    if (!form.turma_id)       { setErroModal('Selecione uma turma.');     return; }
    if (!form.tema_aula.trim()) { setErroModal('Informe o tema da aula.'); return; }
    setCarregandoAlunos(true);
    try {
      const r = await api.get('/academico/alunos', { params: { turma_id: form.turma_id } });
      if (!r.data.length) { setErroModal('Nenhum aluno ativo nesta turma.'); setCarregandoAlunos(false); return; }
      setAlunos(r.data);
      const init: Record<string, boolean> = {};
      r.data.forEach((a: Aluno) => { init[a.id] = true; });
      setPresenca(init);
      setEtapa('chamada-lista');
    } catch { setErroModal('Erro ao carregar alunos.'); }
    setCarregandoAlunos(false);
  };

  // ── Salvar chamada ──
  const salvarChamada = async () => {
    setSalvando(true); setErroModal('');
    try {
      await api.post('/academico/presenca/sessoes', {
        turma_id:          form.turma_id,
        data:              form.data,
        hora_inicio:       form.hora_inicio || undefined,
        hora_fim:          form.hora_fim    || undefined,
        tema_aula:         form.tema_aula,
        conteudo_abordado: form.conteudo_abordado || undefined,
        registros:         alunos.map(a => ({ aluno_id: a.id, presente: presenca[a.id] ?? true })),
      });
      const pres = alunos.filter(a => presenca[a.id]).length;
      setResultOk({ presentes: pres, ausentes: alunos.length - pres });
      setEtapa('chamada-ok');
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Erro ao salvar.';
      setErroModal(Array.isArray(msg) ? msg.join(', ') : msg);
    }
    setSalvando(false);
  };

  const nomeTurma = turmas.find(t => t.id === form.turma_id)?.nome || '';
  const presentes = alunos.filter(a => presenca[a.id]).length;
  const ausentes  = alunos.length - presentes;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div ref={wrapperRef} className="fixed bottom-6 right-5 z-[200] flex flex-col items-end gap-3">

      {/* ── Painel ── */}
      {aberto && (
        <div className="bg-[#1a0b2e] border border-purple-800/60 rounded-3xl shadow-2xl w-[340px] sm:w-[380px] max-h-[calc(100vh-100px)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-purple-900/50 shrink-0">
            {etapa === 'menu' && (
              <>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-purple-400">Lançamento Rápido</p>
                  <p className="text-sm font-black text-white">O que deseja lançar?</p>
                </div>
                <button onClick={fechar} className="p-1.5 rounded-xl hover:bg-purple-900/40 text-purple-400"><X size={16}/></button>
              </>
            )}
            {etapa === 'chamada-form' && (
              <>
                <div className="flex items-center gap-2">
                  <button onClick={() => setEtapa('menu')} className="p-1 rounded-lg hover:bg-purple-900/40 text-purple-400"><ArrowLeft size={15}/></button>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-purple-400">Realizar Chamada</p>
                    <p className="text-xs font-black text-white">Dados da Aula</p>
                  </div>
                </div>
                <button onClick={fechar} className="p-1.5 rounded-xl hover:bg-purple-900/40 text-purple-400"><X size={16}/></button>
              </>
            )}
            {etapa === 'chamada-lista' && (
              <>
                <div className="flex items-center gap-2">
                  <button onClick={() => setEtapa('chamada-form')} className="p-1 rounded-lg hover:bg-purple-900/40 text-purple-400"><ArrowLeft size={15}/></button>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-purple-400">{nomeTurma}</p>
                    <p className="text-xs font-black text-white">{fmtData(form.data)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-green-800/50 text-green-300 text-[9px] font-black px-2 py-0.5 rounded-full">{presentes}P</span>
                  <span className="bg-red-800/50 text-red-300 text-[9px] font-black px-2 py-0.5 rounded-full">{ausentes}F</span>
                  <button onClick={fechar} className="p-1.5 rounded-xl hover:bg-purple-900/40 text-purple-400"><X size={16}/></button>
                </div>
              </>
            )}
            {(etapa === 'chamada-ok' || etapa === 'qrcode') && (
              <>
                <p className="text-sm font-black text-white">{etapa === 'qrcode' ? 'QR Code de Acesso' : 'Chamada Confirmada!'}</p>
                <button onClick={fechar} className="p-1.5 rounded-xl hover:bg-purple-900/40 text-purple-400"><X size={16}/></button>
              </>
            )}
          </div>

          {/* Barra de progresso */}
          {(etapa === 'chamada-form' || etapa === 'chamada-lista') && (
            <div className="flex px-5 pt-3 pb-0 gap-2 shrink-0">
              {[1, 2].map(n => (
                <div key={n} className={`flex-1 h-1 rounded-full transition-colors ${
                  (etapa === 'chamada-form' && n === 1) || etapa === 'chamada-lista' ? 'bg-purple-500' : 'bg-purple-900/40'
                }`} />
              ))}
            </div>
          )}

          {/* Conteúdo scrollável */}
          <div className="flex-1 overflow-y-auto">

            {/* ── MENU ── */}
            {etapa === 'menu' && (
              <div className="p-4 space-y-2">
                {podeChamada && (
                  <button
                    onClick={() => setEtapa('chamada-form')}
                    className="w-full flex items-center gap-4 bg-purple-900/40 hover:bg-purple-800/50 border border-purple-700/40 rounded-2xl px-4 py-4 text-left transition-all group"
                  >
                    <div className="bg-purple-600 p-2.5 rounded-xl shrink-0 group-hover:bg-purple-500 transition-colors">
                      <ClipboardCheck size={20} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-white">Realizar Chamada</p>
                      <p className="text-[10px] text-purple-400 mt-0.5">Lançar presença da turma</p>
                    </div>
                    <ChevronRight size={16} className="text-purple-500 shrink-0" />
                  </button>
                )}
                {podeEstoque && (
                  <a
                    href={`/estoque/coletor?token=${process.env.NEXT_PUBLIC_COLETOR_TOKEN || 'itp-coletor-2026'}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center gap-4 bg-emerald-900/30 hover:bg-emerald-800/40 border border-emerald-700/30 rounded-2xl px-4 py-4 text-left transition-all group"
                  >
                    <div className="bg-emerald-600 p-2.5 rounded-xl shrink-0 group-hover:bg-emerald-500 transition-colors">
                      <Package size={20} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-white">Lançar Estoque</p>
                      <p className="text-[10px] text-emerald-400 mt-0.5">Registrar baixa de produtos</p>
                    </div>
                    <ChevronRight size={16} className="text-emerald-600 shrink-0" />
                  </a>
                )}
                <button
                  onClick={() => setEtapa('qrcode')}
                  className="w-full flex items-center gap-4 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/40 rounded-2xl px-4 py-4 text-left transition-all group"
                >
                  <div className="bg-slate-600 p-2.5 rounded-xl shrink-0 group-hover:bg-slate-500 transition-colors">
                    <QrCode size={20} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white">QR Code de Acesso</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Para fixar nas salas de aula</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-500 shrink-0" />
                </button>
              </div>
            )}

            {/* ── FORMULÁRIO CHAMADA ── */}
            {etapa === 'chamada-form' && (
              <div className="p-4 space-y-3">
                {erroModal && (
                  <div className="bg-red-900/40 border border-red-700/50 rounded-xl px-3 py-2.5 text-xs font-bold text-red-300">
                    ⚠ {erroModal}
                  </div>
                )}

                {/* Turma */}
                <div className="space-y-1">
                  <label className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-purple-400">
                    <BookOpen size={10}/> Turma *
                  </label>
                  {carregandoTurmas ? (
                    <div className="flex items-center gap-2 px-3 py-2">
                      <Loader2 size={14} className="animate-spin text-purple-400"/>
                      <span className="text-xs text-purple-400">Carregando...</span>
                    </div>
                  ) : (
                    <select
                      value={form.turma_id}
                      onChange={e => onTurmaChange(e.target.value)}
                      className="w-full bg-purple-950/60 border border-purple-700/50 text-white rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Selecione a turma...</option>
                      {turmas.map(t => (
                        <option key={t.id} value={t.id}>{t.nome}{t.turno ? ` (${t.turno})` : ''}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Data */}
                <div className="space-y-1">
                  <label className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-purple-400">
                    <CalendarDays size={10}/> Data da Aula
                  </label>
                  <input
                    type="date"
                    value={form.data}
                    onChange={e => setForm(p => ({ ...p, data: e.target.value }))}
                    className="w-full bg-purple-950/60 border border-purple-700/50 text-white rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Horários */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-purple-400">
                      <Clock size={10}/> Início
                    </label>
                    <input
                      type="time"
                      value={form.hora_inicio}
                      onChange={e => setForm(p => ({ ...p, hora_inicio: e.target.value }))}
                      className="w-full bg-purple-950/60 border border-purple-700/50 text-white rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-purple-400">
                      <Clock size={10}/> Fim
                    </label>
                    <input
                      type="time"
                      value={form.hora_fim}
                      onChange={e => setForm(p => ({ ...p, hora_fim: e.target.value }))}
                      className="w-full bg-purple-950/60 border border-purple-700/50 text-white rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {/* Tema */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-purple-400">Tema da Aula *</label>
                  <input
                    type="text"
                    value={form.tema_aula}
                    onChange={e => setForm(p => ({ ...p, tema_aula: e.target.value }))}
                    placeholder="Ex: Matemática Básica, Leitura..."
                    className="w-full bg-purple-950/60 border border-purple-700/50 text-white rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-purple-700"
                  />
                </div>

                {/* Conteúdo */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-purple-400">Conteúdo Abordado</label>
                  <textarea
                    value={form.conteudo_abordado}
                    onChange={e => setForm(p => ({ ...p, conteudo_abordado: e.target.value }))}
                    placeholder="Atividades e tópicos realizados..."
                    rows={3}
                    className="w-full bg-purple-950/60 border border-purple-700/50 text-white rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-purple-700 resize-none"
                  />
                </div>

                <button
                  onClick={avancarLista}
                  disabled={carregandoAlunos}
                  className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {carregandoAlunos
                    ? <><Loader2 size={15} className="animate-spin"/> Carregando alunos...</>
                    : <>Iniciar Chamada <ChevronRight size={15}/></>}
                </button>
              </div>
            )}

            {/* ── LISTA DE CHAMADA ── */}
            {etapa === 'chamada-lista' && (
              <div className="p-4 space-y-3">
                {erroModal && (
                  <div className="bg-red-900/40 border border-red-700/50 rounded-xl px-3 py-2.5 text-xs font-bold text-red-300">
                    ⚠ {erroModal}
                  </div>
                )}

                {/* Resumo */}
                <div className="bg-purple-900/30 border border-purple-800/40 rounded-xl px-3 py-2.5 text-xs space-y-0.5">
                  <p className="font-black text-white">{form.tema_aula}</p>
                  {form.hora_inicio && (
                    <p className="text-purple-300">{form.hora_inicio}{form.hora_fim ? ` → ${form.hora_fim}` : ''}</p>
                  )}
                </div>

                {/* Controles */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setPresenca(Object.fromEntries(alunos.map(a => [a.id, true])))}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[9px] font-black uppercase bg-green-900/40 border border-green-700/40 text-green-300 hover:bg-green-800/40 transition-colors"
                  >
                    <CheckSquare size={11}/> Todos Presentes
                  </button>
                  <button
                    onClick={() => setPresenca(Object.fromEntries(alunos.map(a => [a.id, false])))}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[9px] font-black uppercase bg-red-900/30 border border-red-700/30 text-red-300 hover:bg-red-800/30 transition-colors"
                  >
                    <Square size={11}/> Todos Ausentes
                  </button>
                </div>

                {/* Alunos */}
                <div className="space-y-1">
                  {alunos.map(a => {
                    const presente = presenca[a.id] ?? true;
                    return (
                      <button
                        key={a.id}
                        onClick={() => setPresenca(p => ({ ...p, [a.id]: !p[a.id] }))}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left border ${
                          presente
                            ? 'bg-green-900/25 border-green-700/30 hover:bg-green-800/35'
                            : 'bg-red-900/20 border-red-700/25 hover:bg-red-800/30'
                        }`}
                      >
                        <div className={`shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center text-xs font-black transition-all ${
                          presente ? 'bg-green-500 border-green-500 text-white' : 'bg-transparent border-red-500 text-red-400'
                        }`}>
                          {presente ? '✓' : '✗'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white truncate">{a.nome_completo}</p>
                          {a.numero_matricula && <p className="text-[9px] text-purple-400">{a.numero_matricula}</p>}
                        </div>
                        <span className={`shrink-0 text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          presente ? 'bg-green-800/50 text-green-300' : 'bg-red-800/40 text-red-300'
                        }`}>
                          {presente ? 'P' : 'F'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── CHAMADA OK ── */}
            {etapa === 'chamada-ok' && resultOk && (
              <div className="p-6 text-center space-y-4">
                <CheckCircle2 size={52} className="text-green-400 mx-auto" />
                <div>
                  <p className="text-white font-black text-lg">Chamada Salva!</p>
                  <p className="text-purple-300 text-xs mt-1">{nomeTurma} — {fmtData(form.data)}</p>
                  <p className="text-purple-300 text-xs">{form.tema_aula}</p>
                </div>
                <div className="flex justify-center gap-3">
                  <span className="bg-green-800/50 text-green-300 text-xs font-black px-3 py-1.5 rounded-full">{resultOk.presentes} presentes</span>
                  <span className="bg-red-800/50 text-red-300 text-xs font-black px-3 py-1.5 rounded-full">{resultOk.ausentes} ausentes</span>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={resetChamada} className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-black text-xs uppercase">
                    Nova Chamada
                  </button>
                  <button onClick={fechar} className="flex-1 py-2.5 bg-purple-900/40 hover:bg-purple-800/40 text-purple-300 rounded-xl font-black text-xs uppercase border border-purple-700/40">
                    Fechar
                  </button>
                </div>
              </div>
            )}

            {/* ── QR CODE ── */}
            {etapa === 'qrcode' && (
              <div className="p-5 text-center space-y-4">
                <p className="text-[10px] text-purple-400 font-black uppercase tracking-widest">
                  Imprima e fixe na sala de aula
                </p>
                <div className="bg-white p-4 rounded-2xl inline-block mx-auto">
                  <QRCodeSVG value={loginUrl} size={180} level="M" />
                </div>
                <p className="text-xs text-purple-300 font-bold break-all px-2">{loginUrl}</p>
                <p className="text-[10px] text-purple-500 px-3">
                  O professor escaneia o código, faz login e usa o botão{' '}
                  <span className="text-purple-300 font-black">🚀 Lançamento</span> para realizar a chamada.
                </p>
                <button
                  onClick={() => { if (typeof window !== 'undefined') window.print(); }}
                  className="w-full py-2.5 bg-purple-900/40 hover:bg-purple-800/50 border border-purple-700/40 text-purple-300 rounded-xl font-black text-xs uppercase transition-colors"
                >
                  Imprimir QR Code
                </button>
              </div>
            )}
          </div>

          {/* Rodapé fixo — botão Confirmar na lista */}
          {etapa === 'chamada-lista' && (
            <div className="shrink-0 px-4 pb-4 pt-2 border-t border-purple-900/50">
              <button
                onClick={salvarChamada}
                disabled={salvando || !alunos.length}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {salvando
                  ? <><Loader2 size={15} className="animate-spin"/> Salvando...</>
                  : <><ClipboardCheck size={15}/> Confirmar Chamada ({alunos.length} alunos)</>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Botão FAB ── */}
      <button
        onClick={aberto ? fechar : abrir}
        className={`w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center transition-all duration-200 ${
          aberto
            ? 'bg-purple-700 hover:bg-purple-600 rotate-12'
            : 'bg-purple-600 hover:bg-purple-500'
        } text-white shadow-purple-900/60`}
        aria-label="Lançamento rápido"
        title="Lançamento Rápido"
      >
        {aberto ? <X size={22} /> : <Rocket size={22} />}
      </button>
    </div>
  );
}

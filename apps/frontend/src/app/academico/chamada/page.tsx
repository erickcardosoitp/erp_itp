'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckSquare, Square, CheckCircle2,
  WifiOff, Loader2, Users, BookOpen, X,
  ClipboardCheck, Printer, CalendarDays,
} from 'lucide-react';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'https://api.itp.institutotiapretinha.org/api';

type Aluno = { id: string; nome_completo: string; numero_matricula?: string };
type Turma = { id: string; nome: string; turno?: string };

export default function ChamadaPage() {
  const [token, setToken]               = useState('');
  const [turmaId, setTurmaId]           = useState('');
  const [data, setData]                 = useState('');
  const [temaParam, setTemaParam]       = useState('');
  const [conteudoParam, setConteudoParam] = useState('');

  const [turma, setTurma]               = useState<Turma | null>(null);
  const [alunos, setAlunos]             = useState<Aluno[]>([]);
  const [presenca, setPresenca]         = useState<Record<string, boolean>>({});

  const [loading, setLoading]           = useState(false);
  const [tokenInvalido, setTokenInvalido] = useState(false);
  const [professorNome, setProfessorNome] = useState('');
  const [temaAula, setTemaAula]         = useState('');
  const [conteudo, setConteudo]         = useState('');
  const [salvando, setSalvando]         = useState(false);
  const [salvo, setSalvo]               = useState(false);
  const [erro, setErro]                 = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    const t      = p.get('token') || '';
    const tid    = p.get('turma_id') || '';
    const dt     = p.get('data') || new Date().toISOString().slice(0, 10);
    const tema   = p.get('tema_aula') || '';
    const ctd    = p.get('conteudo_abordado') || '';
    const prof   = localStorage.getItem('chamada_professor') || '';
    setToken(t); setTurmaId(tid); setData(dt);
    setTemaParam(tema); setConteudoParam(ctd);
    setTemaAula(tema); setConteudo(ctd);
    setProfessorNome(prof);
    if (t && tid) fetchAlunos(t, tid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAlunos = useCallback(async (t: string, tid: string) => {
    setLoading(true); setTokenInvalido(false);
    try {
      const r = await fetch(
        `${API_BASE}/academico/chamada/alunos?token=${encodeURIComponent(t)}&turma_id=${encodeURIComponent(tid)}`,
      );
      if (r.status === 401 || r.status === 403) { setTokenInvalido(true); return; }
      if (!r.ok) throw new Error('Erro ao carregar alunos');
      const data: { turma: Turma; alunos: Aluno[] } = await r.json();
      setTurma(data.turma);
      setAlunos(data.alunos);
      // Por padrão todos Presentes
      const init: Record<string, boolean> = {};
      data.alunos.forEach(a => { init[a.id] = true; });
      setPresenca(init);
    } catch {
      setTokenInvalido(true);
    }
    setLoading(false);
  }, []);

  const salvarProfessor = (nome: string) => {
    setProfessorNome(nome);
    if (typeof window !== 'undefined') localStorage.setItem('chamada_professor', nome);
  };

  const toggle = (id: string) => setPresenca(p => ({ ...p, [id]: !p[id] }));

  const salvarChamada = async () => {
    if (!temaAula.trim()) { setErro('Informe o tema da aula.'); return; }
    setSalvando(true); setErro('');
    try {
      const r = await fetch(`${API_BASE}/academico/chamada`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          turma_id: turmaId,
          data,
          tema_aula: temaAula,
          conteudo_abordado: conteudo,
          professor_nome: professorNome || 'Professor (link)',
          registros: alunos.map(a => ({ aluno_id: a.id, presente: presenca[a.id] ?? true })),
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.message || 'Erro ao salvar');
      setSalvo(true);
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar chamada.');
    }
    setSalvando(false);
  };

  const presentes = alunos.filter(a => presenca[a.id]).length;
  const ausentes  = alunos.length - presentes;

  const fmtData = (v: string) => {
    if (!v) return '';
    const [y, m, d] = v.split('-');
    return `${d}/${m}/${y}`;
  };

  // ── Token inválido ────────────────────────────────────────────────────────
  if (tokenInvalido || (!loading && !token)) {
    return (
      <div className="min-h-screen bg-[#1a0b2e] flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <WifiOff size={48} className="text-purple-400 mx-auto" />
          <p className="text-white font-black text-xl uppercase tracking-wide">Link Inválido</p>
          <p className="text-purple-300 text-sm">
            O link de chamada é inválido ou expirou.<br />
            Solicite um novo link ao coordenador.
          </p>
        </div>
      </div>
    );
  }

  // ── Carregando ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a0b2e] flex items-center justify-center">
        <Loader2 size={32} className="text-purple-400 animate-spin" />
      </div>
    );
  }

  // ── Chamada salva com sucesso ─────────────────────────────────────────────
  if (salvo) {
    return (
      <div className="min-h-screen bg-[#1a0b2e] flex items-center justify-center p-6">
        <div className="text-center space-y-5 max-w-sm">
          <CheckCircle2 size={64} className="text-green-400 mx-auto" />
          <p className="text-white font-black text-2xl uppercase tracking-tight">Chamada Salva!</p>
          <div className="bg-purple-900/50 rounded-2xl p-4 space-y-1.5 text-left">
            <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Resumo</p>
            <p className="text-sm text-white font-bold">{turma?.nome}</p>
            <p className="text-xs text-purple-300">{fmtData(data)} — {temaAula}</p>
            <div className="flex gap-3 mt-2">
              <span className="bg-green-800/60 text-green-300 text-[10px] font-black px-3 py-1 rounded-full uppercase">{presentes} presentes</span>
              <span className="bg-red-800/60 text-red-300 text-[10px] font-black px-3 py-1 rounded-full uppercase">{ausentes} ausentes</span>
            </div>
          </div>
          <p className="text-purple-400 text-xs">Você pode fechar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a0b2e] text-white font-sans antialiased pb-24">

      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-[#1a0b2e]/95 backdrop-blur border-b border-purple-900/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-purple-400">ITP — Lista de Chamada</p>
            <p className="text-sm font-black text-white leading-tight">{turma?.nome}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-purple-300">{fmtData(data)}</p>
            <div className="flex gap-2 mt-0.5 justify-end">
              <span className="bg-green-800/50 text-green-300 text-[9px] font-black px-2 py-0.5 rounded-full">{presentes}P</span>
              <span className="bg-red-800/50 text-red-300 text-[9px] font-black px-2 py-0.5 rounded-full">{ausentes}F</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-lg mx-auto">

        {/* ── Info da aula ── */}
        <div className="bg-purple-900/30 border border-purple-800/50 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <BookOpen size={14} className="text-purple-400 shrink-0" />
            <p className="text-[10px] font-black uppercase text-purple-400 tracking-widest">Dados da Aula</p>
          </div>
          <div className="space-y-2">
            <div>
              <label className="text-[9px] font-black uppercase text-purple-400 mb-1 flex items-center gap-1">
                <CalendarDays size={10} /> Data da Aula
              </label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                className="w-full bg-purple-950/60 border border-purple-700/50 text-white rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-purple-400 mb-1 block">Professor(a)</label>
              <input
                value={professorNome}
                onChange={e => salvarProfessor(e.target.value)}
                placeholder="Seu nome..."
                className="w-full bg-purple-950/60 border border-purple-700/50 text-white rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-purple-600"
              />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-purple-400 mb-1 block">Tema da Aula *</label>
              <input
                value={temaAula}
                onChange={e => setTemaAula(e.target.value)}
                placeholder="Ex: Matemática Básica, Leitura..."
                className="w-full bg-purple-950/60 border border-purple-700/50 text-white rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-purple-600"
              />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-purple-400 mb-1 block">Conteúdo (opcional)</label>
              <textarea
                value={conteudo}
                onChange={e => setConteudo(e.target.value)}
                placeholder="Atividades, exercícios realizados..."
                rows={2}
                className="w-full bg-purple-950/60 border border-purple-700/50 text-white rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-purple-600 resize-none"
              />
            </div>
          </div>
        </div>

        {/* ── Controles rápidos ── */}
        <div className="flex gap-2">
          <button
            onClick={() => setPresenca(Object.fromEntries(alunos.map(a => [a.id, true])))}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase bg-green-800/40 border border-green-700/50 text-green-300 hover:bg-green-700/40 transition-colors"
          >
            <CheckSquare size={13} /> Todos Presentes
          </button>
          <button
            onClick={() => setPresenca(Object.fromEntries(alunos.map(a => [a.id, false])))}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase bg-red-800/40 border border-red-700/50 text-red-300 hover:bg-red-700/40 transition-colors"
          >
            <Square size={13} /> Todos Ausentes
          </button>
        </div>

        {/* ── Barra de presença ── */}
        {alunos.length > 0 && (
          <div className="bg-purple-900/20 border border-purple-800/40 rounded-2xl p-3">
            <div className="flex justify-between text-[10px] font-black mb-1.5">
              <span className="text-green-400">{presentes} presentes ({Math.round((presentes / alunos.length) * 100)}%)</span>
              <span className="text-red-400">{ausentes} faltas</span>
            </div>
            <div className="w-full bg-purple-900/60 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-green-500 transition-all"
                style={{ width: `${Math.round((presentes / alunos.length) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Lista de alunos ── */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 px-1 mb-2">
            <Users size={13} className="text-purple-400" />
            <p className="text-[10px] font-black uppercase text-purple-400 tracking-widest">{alunos.length} aluno{alunos.length !== 1 ? 's' : ''}</p>
            <p className="text-[9px] text-purple-500 ml-auto">Toque para alternar</p>
          </div>

          {alunos.length === 0 && (
            <div className="text-center py-10 text-purple-500 text-sm">
              Nenhum aluno ativo nesta turma.
            </div>
          )}

          {alunos.map((a, i) => {
            const presente = presenca[a.id] ?? true;
            return (
              <button
                key={a.id}
                onClick={() => toggle(a.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left border ${
                  presente
                    ? 'bg-green-900/30 border-green-700/40 hover:bg-green-800/40'
                    : 'bg-red-900/20 border-red-700/30 hover:bg-red-800/30'
                }`}
              >
                {/* Checkbox visual */}
                <div className={`shrink-0 w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all font-black text-sm ${
                  presente
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'bg-transparent border-red-500 text-red-500'
                }`}>
                  {presente ? '✓' : '✗'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{a.nome_completo}</p>
                  {a.numero_matricula && (
                    <p className="text-[9px] text-purple-400 mt-0.5">{a.numero_matricula}</p>
                  )}
                </div>
                <span className={`shrink-0 text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${
                  presente
                    ? 'bg-green-700/60 text-green-200'
                    : 'bg-red-700/50 text-red-200'
                }`}>
                  {presente ? 'Presente' : 'Falta'}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Erro ── */}
        {erro && (
          <div className="bg-red-900/40 border border-red-700/50 rounded-xl px-4 py-3 flex items-center gap-2">
            <X size={14} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-300 font-bold">{erro}</p>
          </div>
        )}
      </div>

      {/* ── Bottom Bar – Salvar + Imprimir ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#1a0b2e]/95 backdrop-blur border-t border-purple-900/50 p-4">
        <div className="max-w-lg mx-auto flex gap-2">
          <button
            onClick={() => window.print()}
            title="Imprimir lista"
            className="px-4 py-4 rounded-2xl bg-purple-900/60 border border-purple-700/50 text-purple-300 hover:bg-purple-800/60 transition-colors shrink-0"
          >
            <Printer size={18} />
          </button>
          <button
            onClick={salvarChamada}
            disabled={salvando || alunos.length === 0}
            className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm uppercase tracking-widest py-4 rounded-2xl transition-all shadow-lg shadow-purple-900/50"
          >
            {salvando ? (
              <><Loader2 size={18} className="animate-spin" /> Salvando...</>
            ) : (
              <><ClipboardCheck size={18} /> Confirmar Chamada</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

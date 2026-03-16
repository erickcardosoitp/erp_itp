'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardCheck, CheckSquare, Square, ChevronLeft,
  RefreshCw, Users, BookOpen, CheckCircle2,
} from 'lucide-react';
import api from '@/services/api';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface Turma { id: string; nome: string; curso_id?: string; }
interface AlunoItem {
  id: string;
  nome_completo: string;
  numero_matricula?: string | null;
  is_candidato?: boolean;
  inscricao_id?: number;
}

// ─── Componente ──────────────────────────────────────────────────────────────
export default function ChamadaPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // → Se não autenticado, vai para login com callbackUrl
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?callbackUrl=/chamada');
    }
  }, [authLoading, user, router]);

  const [turmas, setTurmas]           = useState<Turma[]>([]);
  const [alunos, setAlunos]           = useState<AlunoItem[]>([]);
  const [presenca, setPresenca]       = useState<Record<string, boolean>>({});
  const [carregandoTurmas, setCarregandoTurmas] = useState(false);
  const [carregandoAlunos, setCarregandoAlunos] = useState(false);
  const [salvando, setSalvando]       = useState(false);
  const [resultado, setResultado]     = useState<{ presentes: number; ausentes: number; data: string } | null>(null);
  const [erro, setErro]               = useState<string | null>(null);

  // Formulário
  const hoje = typeof window !== 'undefined' ? new Date().toISOString().slice(0, 10) : '';
  const [turmaId, setTurmaId]         = useState('');
  const [data, setData]               = useState(hoje);
  const [temaAula, setTemaAula]       = useState('');
  const [conteudo, setConteudo]       = useState('');

  // Carregar turmas ao montar
  const carregarTurmas = useCallback(async () => {
    setCarregandoTurmas(true);
    try {
      const r = await api.get('/academico/turmas');
      setTurmas(r.data ?? []);
    } catch { /* silencioso */ }
    setCarregandoTurmas(false);
  }, []);

  useEffect(() => { if (user) carregarTurmas(); }, [user, carregarTurmas]);

  // Carregar alunos quando turmaId mudar
  const carregarAlunos = useCallback(async (tid: string) => {
    if (!tid) { setAlunos([]); setPresenca({}); return; }
    setCarregandoAlunos(true);
    setErro(null);
    try {
      const r = await api.get('/academico/alunos', { params: { turma_id: tid } });
      const lista: AlunoItem[] = r.data ?? [];
      setAlunos(lista);
      const init: Record<string, boolean> = {};
      lista.forEach(a => { init[a.id] = true; });
      setPresenca(init);
    } catch { setErro('Erro ao carregar alunos da turma.'); }
    setCarregandoAlunos(false);
  }, []);

  useEffect(() => { carregarAlunos(turmaId); }, [turmaId, carregarAlunos]);

  const togglePresenca = (id: string) =>
    setPresenca(p => ({ ...p, [id]: !p[id] }));

  const marcarTodos = (v: boolean) => {
    const next: Record<string, boolean> = {};
    alunos.forEach(a => { next[a.id] = v; });
    setPresenca(next);
  };

  const presentes = alunos.filter(a => presenca[a.id]).length;
  const ausentes  = alunos.length - presentes;

  const salvar = async () => {
    setErro(null);
    if (!turmaId)          { setErro('Selecione uma turma.');        return; }
    if (!data)             { setErro('Informe a data da aula.');     return; }
    if (!temaAula.trim())  { setErro('Informe o tema da aula.');     return; }
    if (!alunos.length)    { setErro('Nenhum aluno na turma selecionada.'); return; }

    setSalvando(true);
    try {
      await api.post('/academico/presenca/sessoes', {
        turma_id:          turmaId,
        data,
        tema_aula:         temaAula,
        conteudo_abordado: conteudo,
        registros: alunos.map(a => ({
          aluno_id:      a.is_candidato ? null : a.id,
          inscricao_id:  a.inscricao_id ?? null,
          pessoa_nome:   a.is_candidato ? a.nome_completo : null,
          presente:      presenca[a.id] ?? true,
        })),
      });
      setResultado({ presentes, ausentes, data });
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Erro ao salvar chamada.';
      setErro(Array.isArray(msg) ? msg.join(', ') : msg);
    }
    setSalvando(false);
  };

  const novaLista = () => {
    setResultado(null);
    setTurmaId(''); setData(hoje); setTemaAula(''); setConteudo('');
    setAlunos([]); setPresenca({}); setErro(null);
  };

  const fmtData = (v: string) => {
    if (!v) return '–';
    const [y, m, d] = v.split('-');
    return `${d}/${m}/${y}`;
  };

  // ─── Tela de sucesso ─────────────────────────────────────────────────────
  if (resultado) {
    return (
      <div className="min-h-screen bg-[#1a0b2e] flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-green-500/30">
            <CheckCircle2 size={44} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white mb-1">Chamada Registrada!</h1>
            <p className="text-purple-300 text-sm">{fmtData(resultado.data)}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-900/30 border border-green-500/20 rounded-2xl p-4">
              <p className="text-3xl font-black text-green-400">{resultado.presentes}</p>
              <p className="text-[10px] font-black uppercase text-green-300/60 mt-1">Presentes</p>
            </div>
            <div className="bg-red-900/30 border border-red-500/20 rounded-2xl p-4">
              <p className="text-3xl font-black text-red-400">{resultado.ausentes}</p>
              <p className="text-[10px] font-black uppercase text-red-300/60 mt-1">Ausentes</p>
            </div>
          </div>
          <div className="space-y-3">
            <button onClick={novaLista}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black text-sm uppercase tracking-widest py-4 rounded-2xl transition-colors">
              Nova Chamada
            </button>
            <button onClick={() => router.push('/academico')}
              className="w-full bg-white/10 hover:bg-white/20 text-white font-black text-sm uppercase tracking-widest py-4 rounded-2xl transition-colors">
              Ver Histórico
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Carregando auth ──────────────────────────────────────────────────────
  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#1a0b2e] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Formulário ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#1a0b2e] pb-10">
      {/* Cabeçalho */}
      <div className="sticky top-0 z-10 bg-[#1a0b2e]/95 backdrop-blur-sm border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl text-purple-300 hover:bg-white/10 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-black text-sm uppercase tracking-tight leading-none">Lista de Presença</h1>
          <p className="text-purple-400 text-[10px] mt-0.5 truncate">{user.nome || user.email}</p>
        </div>
        <div className="shrink-0">
          <ClipboardCheck size={22} className="text-purple-400" />
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-lg mx-auto">
        {/* Erro */}
        {erro && (
          <div className="bg-red-900/30 border border-red-500/30 text-red-300 text-xs font-bold rounded-2xl px-4 py-3">
            ⚠ {erro}
          </div>
        )}

        {/* Dados da aula */}
        <section className="bg-white/5 border border-white/10 rounded-3xl p-4 space-y-3">
          <h2 className="text-[10px] font-black uppercase text-purple-300 tracking-widest flex items-center gap-2">
            <BookOpen size={12} /> Dados da Aula
          </h2>

          {/* Turma */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-white/50">Turma *</label>
            <select
              value={turmaId}
              onChange={e => setTurmaId(e.target.value)}
              className="w-full bg-white/10 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="" className="bg-[#1a0b2e]">
                {carregandoTurmas ? 'Carregando...' : 'Selecione a turma...'}
              </option>
              {turmas.map(t => (
                <option key={t.id} value={t.id} className="bg-[#1a0b2e]">{t.nome}</option>
              ))}
            </select>
          </div>

          {/* Data */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-white/50">Data da Aula *</label>
            <input
              type="date"
              value={data}
              onChange={e => setData(e.target.value)}
              className="w-full bg-white/10 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Tema */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-white/50">Tema da Aula *</label>
            <input
              type="text"
              value={temaAula}
              onChange={e => setTemaAula(e.target.value)}
              placeholder="Ex: Introdução ao Circo Social"
              className="w-full bg-white/10 border border-white/10 text-white placeholder-white/25 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Conteúdo */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-white/50">Conteúdo Abordado</label>
            <textarea
              rows={2}
              value={conteudo}
              onChange={e => setConteudo(e.target.value)}
              placeholder="Descreva os conteúdos trabalhados..."
              className="w-full bg-white/10 border border-white/10 text-white placeholder-white/25 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>
        </section>

        {/* Chamada */}
        {turmaId && (
          <section className="bg-white/5 border border-white/10 rounded-3xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-black uppercase text-purple-300 tracking-widest flex items-center gap-2">
                <Users size={12} /> Chamada
                {carregandoAlunos && <RefreshCw size={10} className="animate-spin text-purple-400" />}
              </h2>
              {alunos.length > 0 && (
                <div className="flex gap-1">
                  <button onClick={() => marcarTodos(true)}
                    className="text-[9px] font-black uppercase text-green-400 hover:text-green-300 px-2 py-1 bg-green-900/30 rounded-lg">
                    Todos
                  </button>
                  <button onClick={() => marcarTodos(false)}
                    className="text-[9px] font-black uppercase text-red-400 hover:text-red-300 px-2 py-1 bg-red-900/30 rounded-lg">
                    Nenhum
                  </button>
                </div>
              )}
            </div>

            {/* Contadores */}
            {alunos.length > 0 && (
              <div className="flex gap-2 text-[9px] font-black uppercase">
                <span className="bg-green-900/30 text-green-400 px-3 py-1 rounded-full">{presentes} presentes</span>
                <span className="bg-red-900/30 text-red-400 px-3 py-1 rounded-full">{ausentes} ausentes</span>
              </div>
            )}

            {/* Lista de alunos */}
            {carregandoAlunos ? (
              <p className="text-white/40 text-xs text-center py-4">Carregando alunos...</p>
            ) : alunos.length === 0 ? (
              <p className="text-white/40 text-xs text-center py-4">Nenhum aluno ativo nesta turma.</p>
            ) : (
              <div className="space-y-1.5">
                {alunos.map(a => {
                  const presente = presenca[a.id] ?? true;
                  return (
                    <button
                      key={a.id}
                      onClick={() => togglePresenca(a.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                        presente
                          ? 'bg-green-900/30 border border-green-500/20'
                          : 'bg-white/5 border border-white/5'
                      }`}
                    >
                      {presente
                        ? <CheckSquare size={18} className="text-green-400 shrink-0" />
                        : <Square size={18} className="text-white/30 shrink-0" />
                      }
                      <span className={`flex-1 text-sm font-bold truncate ${presente ? 'text-white' : 'text-white/40'}`}>
                        {a.nome_completo}
                      </span>
                      {a.is_candidato && (
                        <span className="shrink-0 text-[8px] font-black bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded-full uppercase">
                          Candidato
                        </span>
                      )}
                      {a.numero_matricula && !a.is_candidato && (
                        <span className="shrink-0 text-[9px] text-white/30 font-bold">
                          {a.numero_matricula}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Botão salvar */}
        <button
          onClick={salvar}
          disabled={salvando || !turmaId || !data || !temaAula.trim()}
          className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-black text-sm uppercase tracking-widest py-4 rounded-2xl transition-colors shadow-xl shadow-purple-900/50"
        >
          {salvando ? 'Salvando...' : 'Registrar Presença'}
        </button>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search, X, AlertTriangle, ChevronDown, Smartphone,
  AlertCircle, UserPlus,
} from 'lucide-react';
import api from '@/services/api';
import { toast } from 'sonner';
import DossieCandidato from '@/components/DossieCandidato';
import { Curso, Turma, Aluno } from './_types';
import {
  calcularIdade, fmtDate, CUIDADO_BADGE,
  Modal, FieldInput,
} from './_shared';

// ─── KpisTurmas ───────────────────────────────────────────────────────────────

function KpisTurmas({ alunos, turmas }: { alunos: Aluno[]; turmas: Turma[] }) {
  const ativos = alunos.filter(a => a.ativo !== false);
  const semTurma = ativos.filter(a => !a.turmas || a.turmas.length === 0);
  const multTurma = ativos.filter(a => (a.turmas || []).length > 1);

  const turmaMap = turmas.map(t => ({
    ...t,
    total: ativos.filter(a => (a.turmas || []).some((ta: any) => ta.id === t.id)).length,
  })).sort((a, b) => b.total - a.total);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-2xl font-black text-purple-700">{ativos.length}</p>
          <p className="text-[9px] font-black uppercase text-slate-400">Ativos</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-black text-amber-500">{semTurma.length}</p>
          <p className="text-[9px] font-black uppercase text-slate-400">Sem Turma</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-black text-blue-600">{multTurma.length}</p>
          <p className="text-[9px] font-black uppercase text-slate-400">Múltiplas Turmas</p>
        </div>
      </div>
      {turmaMap.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
          {turmaMap.slice(0, 8).map(t => (
            <span key={t.id} className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: t.cor || '#7c3aed' }}>
              {t.nome} ({t.total})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AlunosTab ────────────────────────────────────────────────────────────────

export default function AlunosTab({ cursos, turmas, podeEditar }: {
  cursos: Curso[];
  turmas: Turma[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [inativandoId, setInativandoId] = useState<string | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [inputNome, setInputNome] = useState('');
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroCursoNome, setFiltroCursoNome] = useState('');
  const [filtroTurmaId, setFiltroTurmaId] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroTurno, setFiltroTurno] = useState('');
  const [filtroSexo, setFiltroSexo] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [erroLoad, setErroLoad] = useState<string | null>(null);
  const [dossieAberto, setDossieAberto] = useState<{ inscricao: any; fichaData: any } | null>(null);
  const [fichaErro, setFichaErro] = useState<string | null>(null);
  const [fichaLoading, setFichaLoading] = useState(false);
  const [pendentes, setPendentes] = useState<any[]>([]);
  const [showPendentes, setShowPendentes] = useState(true);
  const [duplicados, setDuplicados] = useState<{ por_cpf: any[]; por_nome: any[]; total: number } | null>(null);
  const [showDuplicados, setShowDuplicados] = useState(false);
  const [inativandoDupId, setInativandoDupId] = useState<string | null>(null);

  // ── Cadastro Rápido ───────────────────────────────────────────────────────
  const [showCadastroRapido, setShowCadastroRapido] = useState(false);
  const [formRapido, setFormRapido] = useState<{ nome_completo: string; data_nascimento: string; cpf: string; celular: string; nome_responsavel: string }>({ nome_completo: '', data_nascimento: '', cpf: '', celular: '', nome_responsavel: '' });
  const [salvandoRapido, setSalvandoRapido] = useState(false);
  const [erroRapido, setErroRapido] = useState<string | null>(null);
  const [sucessoRapido, setSucessoRapido] = useState<string | null>(null);

  const menorDeIdade = formRapido.data_nascimento ? calcularIdade(formRapido.data_nascimento) < 18 : false;

  const turmasDoCurso = turmas.filter(t => {
    if (!filtroCursoNome) return false;
    const curso = cursos.find(c => c.nome === filtroCursoNome);
    return curso ? t.curso_id === curso.id : false;
  });

  // Debounce do campo nome
  useEffect(() => {
    const t = setTimeout(() => setFiltroNome(inputNome), 400);
    return () => clearTimeout(t);
  }, [inputNome]);

  const load = useCallback(async () => {
    setLoading(true);
    setErroLoad(null);
    try {
      const params: Record<string, string> = {};
      if (filtroNome)      params.nome     = filtroNome;
      if (filtroCursoNome) params.curso    = filtroCursoNome;
      if (filtroTurmaId)   params.turma_id = filtroTurmaId;
      if (filtroStatus)    params.status   = filtroStatus;
      if (filtroTurno)     params.turno    = filtroTurno;
      if (filtroSexo)      params.sexo     = filtroSexo;
      if (filtroCidade)    params.cidade   = filtroCidade;
      const r = await api.get('/academico/alunos', { params });
      setAlunos(r.data);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao carregar alunos.';
      setErroLoad(Array.isArray(msg) ? msg.join(', ') : msg);
    }
    setLoading(false);
  }, [filtroNome, filtroCursoNome, filtroTurmaId, filtroStatus, filtroTurno, filtroSexo, filtroCidade]);

  useEffect(() => { load(); }, [load]);

  // Auto-abre ficha quando URL contém ?aluno=<uuid>
  useEffect(() => {
    const alunoId = searchParams.get('aluno');
    if (!alunoId || alunos.length === 0) return;
    verFicha(alunoId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, alunos.length > 0 ? 'loaded' : 'loading']);

  useEffect(() => {
    api.get('/academico/alunos/pendentes').then(r => setPendentes(r.data)).catch(() => {});
    api.get('/academico/alunos/duplicados').then(r => setDuplicados(r.data)).catch(() => {});
  }, []);

  const verFicha = async (id: string) => {
    setFichaErro(null);
    setFichaLoading(true);
    try {
      const fichaResp = await api.get(`/academico/alunos/${id}/ficha`);
      const fichaData = fichaResp.data;
      let inscricao: any;
      if (fichaData.inscricao_id) {
        try {
          const inscResp = await api.get(`/matriculas/inscricao/${fichaData.inscricao_id}`);
          inscricao = inscResp.data;
        } catch {
          inscricao = null;
        }
      }
      if (!inscricao) {
        const a = fichaData.aluno;
        inscricao = {
          id: null,
          nome_completo: a.nome_completo,
          cpf: a.cpf,
          email: a.email,
          celular: a.celular,
          data_nascimento: a.data_nascimento,
          idade: a.idade,
          sexo: a.sexo,
          escolaridade: a.escolaridade,
          turno_escolar: a.turno_escolar,
          logradouro: a.logradouro,
          numero: a.numero,
          complemento: a.complemento,
          cidade: a.cidade,
          bairro: a.bairro,
          estado_uf: a.estado_uf,
          cep: a.cep,
          maior_18_anos: a.maior_18_anos,
          nome_responsavel: a.nome_responsavel,
          email_responsavel: a.email_responsavel,
          grau_parentesco: a.grau_parentesco,
          cpf_responsavel: a.cpf_responsavel,
          telefone_alternativo: a.telefone_alternativo,
          possui_alergias: a.possui_alergias,
          cuidado_especial: a.cuidado_especial,
          detalhes_cuidado: a.detalhes_cuidado,
          uso_medicamento: a.uso_medicamento,
          auto_declaracao: (a as any).auto_declaracao ?? fichaData.auto_declaracao,
          orientacao_sexual: (a as any).orientacao_sexual,
          cursos_desejados: a.cursos_matriculados,
          lgpd_aceito: a.lgpd_aceito,
          autoriza_imagem: a.autoriza_imagem,
          status_matricula: 'Matriculado',
          _sintetico: true,
        };
      }
      setDossieAberto({ inscricao, fichaData });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao carregar ficha do aluno.';
      setFichaErro(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setFichaLoading(false);
    }
  };

  const camposFaltando = (aluno: Partial<Aluno>): string[] => {
    const faltam: string[] = [];
    if (!aluno.cep?.trim()) faltam.push('CEP');
    if (!aluno.celular?.trim()) faltam.push('Celular');
    const menor = aluno.maior_18_anos === false ||
      (aluno.data_nascimento ? new Date().getFullYear() - new Date(aluno.data_nascimento).getFullYear() < 18 : false);
    if (menor && !aluno.telefone_alternativo?.trim()) faltam.push('Tel. Responsável');
    return faltam;
  };

  const inativarAluno = async (a: Aluno) => {
    const acao = a.ativo ? 'inativar' : 'reativar';
    if (!confirm(`Deseja ${acao} o aluno "${a.nome_completo}"?`)) return;
    setInativandoId(a.id);
    try {
      if (a.ativo) {
        await api.delete(`/academico/alunos/${a.id}`);
      } else {
        await api.patch(`/academico/alunos/${a.id}`, { ativo: true });
      }
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || `Erro ao ${acao} aluno.`;
      alert(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setInativandoId(null);
    }
  };

  const abrirCadastroRapido = () => {
    setFormRapido({ nome_completo: '', data_nascimento: '', cpf: '', celular: '', nome_responsavel: '' });
    setErroRapido(null); setSucessoRapido(null);
    setShowCadastroRapido(true);
  };

  const salvarCadastroRapido = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRapido.nome_completo.trim()) { setErroRapido('Nome é obrigatório.'); return; }
    setSalvandoRapido(true); setErroRapido(null); setSucessoRapido(null);
    try {
      const r = await api.post('/academico/alunos', {
        nome_completo:    formRapido.nome_completo.trim(),
        data_nascimento:  formRapido.data_nascimento || undefined,
        cpf:              formRapido.cpf.trim() || undefined,
        celular:          formRapido.celular.trim() || undefined,
        nome_responsavel: menorDeIdade ? formRapido.nome_responsavel.trim() || undefined : undefined,
      });
      setSucessoRapido(`Aluno "${r.data?.nome_completo || formRapido.nome_completo}" cadastrado! Matrícula: ${r.data?.numero_matricula || '–'}`);
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao cadastrar.';
      setErroRapido(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSalvandoRapido(false);
    }
  };

  return (
    <div className="space-y-4">

      {/* ── Matrículas Pendentes ─────────────────────────────────────────────── */}
      {pendentes.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/40 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowPendentes(p => !p)}
            className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-orange-100/50 dark:hover:bg-orange-900/20 transition-colors"
          >
            <AlertTriangle size={16} className="text-orange-500 shrink-0" />
            <span className="font-black text-orange-700 dark:text-orange-400 text-sm uppercase tracking-wide flex-1">
              Matrículas Pendentes
            </span>
            <span className="bg-orange-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">{pendentes.length}</span>
            <ChevronDown size={14} className={`text-orange-400 transition-transform ${showPendentes ? 'rotate-180' : ''}`} />
          </button>
          {showPendentes && (
            <div className="border-t border-orange-200 dark:border-orange-800/40 divide-y divide-orange-100 dark:divide-orange-900/30">
              {pendentes.map((p: any) => {
                const idade = p.data_nascimento ? (() => {
                  const hoje = new Date();
                  const nasc = new Date(p.data_nascimento + 'T12:00:00');
                  let i = hoje.getFullYear() - nasc.getFullYear();
                  const m = hoje.getMonth() - nasc.getMonth();
                  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) i--;
                  return i;
                })() : null;
                const wa = p.celular ? `https://wa.me/55${p.celular.replace(/\D/g, '')}` : null;
                return (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-3 flex-wrap">
                    <div className="w-8 h-8 rounded-full bg-orange-200 dark:bg-orange-800 flex items-center justify-center text-orange-700 dark:text-orange-300 font-black text-sm shrink-0">
                      {(p.nome_completo[0] || '?').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-[140px]">
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{p.nome_completo}</p>
                      <p className="text-[10px] text-slate-400 flex items-center gap-2">
                        <span className="font-mono">{p.numero_matricula}</span>
                        {idade !== null && <span>· {idade} anos</span>}
                        {p.nome_responsavel && <span>· Resp: {p.nome_responsavel}</span>}
                      </p>
                    </div>
                    <div className="flex gap-2 items-center">
                      {wa && (
                        <a href={wa} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] font-bold text-green-600 hover:text-green-700 bg-green-50 dark:bg-green-900/20 px-2.5 py-1.5 rounded-lg">
                          <Smartphone size={11}/> WhatsApp
                        </a>
                      )}
                      <button onClick={() => verFicha(p.id)}
                        className="text-[10px] font-black uppercase px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-colors">
                        Ver Ficha
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Cadastros Duplicados ─────────────────────────────────────────────── */}
      {duplicados && duplicados.total > 0 && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40 rounded-2xl overflow-hidden">
          <button onClick={() => setShowDuplicados(v => !v)}
            className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-red-100/50 dark:hover:bg-red-900/20 transition-colors">
            <AlertCircle size={14} className="text-red-500 shrink-0" />
            <span className="font-black text-xs uppercase text-red-700 dark:text-red-300 flex-1">Cadastros Duplicados</span>
            <span className="bg-red-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">{duplicados.total}</span>
            <ChevronDown size={14} className={`text-red-400 transition-transform ${showDuplicados ? 'rotate-180' : ''}`} />
          </button>
          {showDuplicados && (
            <div className="border-t border-red-200 dark:border-red-800/40 divide-y divide-red-100 dark:divide-red-900/30">
              {[...duplicados.por_cpf, ...duplicados.por_nome].map((grupo: any, gi: number) => (
                <div key={gi} className="px-5 py-3">
                  <p className="text-[10px] font-bold text-red-500 uppercase mb-2">
                    {grupo.tipo === 'cpf' ? `CPF duplicado: ${grupo.chave}` : `Nome/Data: ${grupo.chave}`}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {(grupo.alunos as any[]).map((a: any) => (
                      <div key={a.id} className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl px-3 py-2 border border-red-100 dark:border-red-900/30">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{a.nome}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{a.matricula} · {a.ativo ? 'Ativo' : 'Inativo'}</p>
                        </div>
                        <button onClick={() => verFicha(a.id)}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          Ver ficha
                        </button>
                        {podeEditar && a.ativo && (
                          <button disabled={inativandoDupId === a.id}
                            onClick={async () => {
                              if (!confirm(`Inativar ${a.nome}?`)) return;
                              setInativandoDupId(a.id);
                              try {
                                await api.delete(`/academico/alunos/${a.id}`);
                                toast.success('Aluno inativado.');
                                const r = await api.get('/academico/alunos/duplicados');
                                setDuplicados(r.data);
                              } catch (e: any) {
                                toast.error(e?.response?.data?.message || 'Erro ao inativar.');
                              } finally { setInativandoDupId(null); }
                            }}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 whitespace-nowrap disabled:opacity-50">
                            {inativandoDupId === a.id ? '...' : 'Inativar'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <KpisTurmas alunos={alunos} turmas={turmas} />
      <div className="flex flex-wrap gap-3 items-end bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
        <div className="flex-1 min-w-[180px]">
          <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Nome</label>
          <div className="relative">
            <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={inputNome} onChange={e => setInputNome(e.target.value)} placeholder="Buscar aluno..."
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>
        </div>
        <div className="min-w-[120px]">
          <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Status</label>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
            <option value="">Ativos</option>
          </select>
        </div>
        <div className="min-w-[140px]">
          <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Curso</label>
          <select value={filtroCursoNome} onChange={e => { setFiltroCursoNome(e.target.value); setFiltroTurmaId(''); }}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
            <option value="">Todos</option>
            {cursos.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </select>
        </div>
        {filtroCursoNome && turmasDoCurso.length > 0 && (
          <div className="min-w-[140px]">
            <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Turma</label>
            <select value={filtroTurmaId} onChange={e => setFiltroTurmaId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
              <option value="">Todas</option>
              {turmasDoCurso.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
        )}
        <div className="min-w-[120px]">
          <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Turno</label>
          <select value={filtroTurno} onChange={e => setFiltroTurno(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
            <option value="">Todos</option>
            <option value="Manhã">Manhã</option>
            <option value="Tarde">Tarde</option>
            <option value="Noite">Noite</option>
            <option value="Integral">Integral</option>
            <option value="Não estuda no momento">Não estuda no momento</option>
          </select>
        </div>
        <div className="min-w-[110px]">
          <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Sexo</label>
          <select value={filtroSexo} onChange={e => setFiltroSexo(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
            <option value="">Todos</option>
            <option value="Masculino">Masculino</option>
            <option value="Feminino">Feminino</option>
            <option value="Outro">Outro</option>
          </select>
        </div>
        <div className="min-w-[140px]">
          <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Cidade</label>
          <input value={filtroCidade} onChange={e => setFiltroCidade(e.target.value)} placeholder="Cidade..."
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400" />
        </div>
        <button onClick={() => { setInputNome(''); setFiltroNome(''); setFiltroCursoNome(''); setFiltroTurmaId(''); setFiltroStatus(''); setFiltroTurno(''); setFiltroSexo(''); setFiltroCidade(''); }}
          className="text-[10px] font-black uppercase text-red-400 hover:text-red-600 flex items-center gap-1">
          <X size={11}/> Limpar
        </button>
        <button onClick={abrirCadastroRapido}
          className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase hover:bg-green-700 ml-auto">
          <UserPlus size={12}/> Cadastro Rápido
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-20 text-center text-sm text-slate-400">Carregando...</div>
      ) : erroLoad ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-12 text-center space-y-2">
          <div className="text-red-500 text-sm font-bold">Erro ao carregar alunos</div>
          <div className="text-slate-400 text-xs max-w-md mx-auto">{erroLoad}</div>
          <button onClick={load} className="mt-2 text-xs text-purple-600 underline">Tentar novamente</button>
        </div>
      ) : alunos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-20 text-center text-sm text-slate-400">Nenhum aluno encontrado.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {alunos.map((a) => {
            const faltam = camposFaltando(a);
            const cuidadoBadge = a.cuidado_especial && a.cuidado_especial !== 'Não'
              ? (CUIDADO_BADGE[a.cuidado_especial] || { label: 'Cuidado Espec.', color: 'bg-pink-100 text-pink-700 border-pink-200' })
              : null;
            const turmasVisiveis = (a.turmas || []).slice(0, 3);
            const turmasExtras = (a.turmas || []).length - 3;
            const iniciais = (a.nome_completo || '?').split(' ').filter(Boolean).slice(0, 2).map((n: string) => n[0]).join('').toUpperCase();
            return (
              <div key={a.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-purple-200 transition-all duration-200 flex flex-col overflow-hidden">
                <div className={`h-1.5 w-full ${a.ativo ? 'bg-gradient-to-r from-purple-500 to-violet-400' : 'bg-slate-200'}`} />
                <div className="p-4 flex-1 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0">
                      {a.foto_url
                        ? <img src={a.foto_url} alt="" className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow-md" />
                        : <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center border-2 border-white shadow-md">
                            <span className="text-base font-black text-white">{iniciais}</span>
                          </div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-slate-800 leading-snug truncate">{a.nome_completo}</p>
                      {a.numero_matricula && (
                        <p className="text-xs font-mono text-purple-600 font-semibold mt-0.5">{a.numero_matricula}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${a.ativo ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-500 border-red-200'}`}>
                          {a.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                        {faltam.length > 0 && (
                          <span title={`Faltando: ${faltam.join(', ')}`} className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200 cursor-help">
                            ⚠ incompleto
                          </span>
                        )}
                        {cuidadoBadge && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cuidadoBadge.color}`}>{cuidadoBadge.label}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {(a.celular || a.email) && (
                      <p className="text-xs text-slate-500 truncate">{a.celular || a.email}</p>
                    )}
                    {a.cpf && (
                      <p className="text-xs font-mono text-slate-400">{a.cpf}</p>
                    )}
                    {a.data_matricula && (
                      <p className="text-[11px] text-slate-400">Matrícula: {fmtDate(a.data_matricula)}</p>
                    )}
                  </div>
                  {turmasVisiveis.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {turmasVisiveis.map((t: any) => (
                        <span key={t.id} className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white shadow-sm ring-1 ring-black/10"
                          style={{ backgroundColor: t.cor || '#7c3aed', opacity: t.status !== 'ativo' ? 0.55 : 1 }}>
                          {t.nome}
                        </span>
                      ))}
                      {turmasExtras > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">+{turmasExtras}</span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-300 italic">Sem turma vinculada</p>
                  )}
                </div>
                <div className="px-4 pb-4 flex gap-2">
                  <button onClick={() => verFicha(a.id)} disabled={fichaLoading}
                    className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 shadow-sm">
                    {fichaLoading ? 'Abrindo...' : 'Ver Ficha'}
                  </button>
                  {podeEditar && (
                    <button onClick={() => inativarAluno(a)} disabled={inativandoId === a.id}
                      title="Inativar aluno"
                      className="px-3 py-2 border border-red-200 text-red-500 hover:bg-red-50 rounded-xl text-xs font-bold transition-colors disabled:opacity-50">
                      {inativandoId === a.id ? '...' : 'Inativar'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {fichaErro && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[400] bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-3">
          ⚠ {fichaErro}
          <button onClick={() => setFichaErro(null)} className="ml-2 underline text-white/80 text-xs">Fechar</button>
        </div>
      )}

      {dossieAberto && (
        <DossieCandidato
          aluno={dossieAberto.inscricao}
          fichaData={dossieAberto.fichaData}
          onClose={() => setDossieAberto(null)}
          onSuccess={() => load()}
          onVerInscricao={dossieAberto.fichaData?.inscricao_id
            ? () => router.push(`/matriculas?inscricao=${dossieAberto.fichaData.inscricao_id}`)
            : undefined}
        />
      )}

      {showCadastroRapido && (
        <Modal title="Cadastro Rápido de Aluno" onClose={() => setShowCadastroRapido(false)}>
          <form onSubmit={salvarCadastroRapido} className="space-y-3">
            <FieldInput label="Nome Completo *" value={formRapido.nome_completo} onChange={v => setFormRapido(p => ({ ...p, nome_completo: v }))} required />
            <FieldInput label="Data de Nascimento" type="date" value={formRapido.data_nascimento} onChange={v => setFormRapido(p => ({ ...p, data_nascimento: v }))} />
            {menorDeIdade && (
              <FieldInput label="Nome do Responsável" value={formRapido.nome_responsavel} onChange={v => setFormRapido(p => ({ ...p, nome_responsavel: v }))} />
            )}
            <div className="grid grid-cols-2 gap-3">
              <FieldInput label="CPF" value={formRapido.cpf} onChange={v => setFormRapido(p => ({ ...p, cpf: v }))} />
              <FieldInput label="Telefone" value={formRapido.celular} onChange={v => setFormRapido(p => ({ ...p, celular: v }))} />
            </div>
            {erroRapido && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold rounded-xl px-4 py-2.5">⚠ {erroRapido}</div>
            )}
            {sucessoRapido && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-[11px] font-bold rounded-xl px-4 py-2.5">✓ {sucessoRapido}</div>
            )}
            <div className="flex gap-2">
              {!sucessoRapido ? (
                <button type="submit" disabled={salvandoRapido}
                  className="flex-1 bg-green-600 text-white py-2.5 rounded-xl font-black text-xs uppercase disabled:opacity-50 hover:bg-green-700">
                  {salvandoRapido ? 'Cadastrando...' : 'Cadastrar'}
                </button>
              ) : (
                <button type="button" onClick={() => { setShowCadastroRapido(false); }}
                  className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl font-black text-xs uppercase hover:bg-purple-700">
                  Fechar
                </button>
              )}
              {sucessoRapido && (
                <button type="button" onClick={() => { setFormRapido({ nome_completo: '', data_nascimento: '', cpf: '', celular: '', nome_responsavel: '' }); setErroRapido(null); setSucessoRapido(null); }}
                  className="flex-1 bg-green-600 text-white py-2.5 rounded-xl font-black text-xs uppercase hover:bg-green-700">
                  + Outro
                </button>
              )}
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Edit3, Users, UserPlus, UserMinus,
  RefreshCw, X, Search, Check, Eye, ChevronDown, ChevronUp, ClipboardCheck, AlertCircle,
} from 'lucide-react';
import api from '@/services/api';
import { Curso, Professor, Aluno, Turma, GradeCard, PresencaSessao } from './_types';
import { CORES_CARD, Modal, FieldInput, FieldSelect } from './_shared';

// ── Local interfaces ──────────────────────────────────────────────────────────
interface UsuarioProf { id: string; nome: string; email?: string; grupo_nome?: string; }
interface HorarioDia { ativo: boolean; hora_inicio: string; hora_fim: string; }

const DIAS_GRADE = [
  { idx: 1, label: 'Segunda' }, { idx: 2, label: 'Terça' }, { idx: 3, label: 'Quarta' },
  { idx: 4, label: 'Quinta' }, { idx: 5, label: 'Sexta' },
];

function calcularTurno(horaInicio: string): string {
  if (!horaInicio) return '';
  const h = parseInt(horaInicio.split(':')[0], 10);
  if (h >= 6 && h < 12) return 'Manhã';
  if (h >= 12 && h < 18) return 'Tarde';
  return 'Noite';
}

export default function TurmasTab({ cursos, professores, alunos }: { cursos: Curso[]; professores: Professor[]; alunos: Aluno[] }) {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Turma | null>(null);
  const [form, setForm] = useState<Partial<Turma>>({ ano: '2026' });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [horariosDia, setHorariosDia] = useState<Record<number, HorarioDia>>({});
  const [gradeCardsTurma, setGradeCardsTurma] = useState<GradeCard[]>([]);
  const [gradeLoaded, setGradeLoaded] = useState(false);
  const [showIncluir, setShowIncluir] = useState(false);
  const [incluirAlunoId, setIncluirAlunoId] = useState('');
  const [incluirTurmaId, setIncluirTurmaId] = useState('');
  const [incluirSalvando, setIncluirSalvando] = useState(false);
  const [incluirErro, setIncluirErro] = useState<string | null>(null);
  const [incluirSucesso, setIncluirSucesso] = useState<string | null>(null);
  const [buscarAluno, setBuscarAluno] = useState('');
  const [usuariosProfessores, setUsuariosProfessores] = useState<UsuarioProf[]>([]);
  const [funcionarios, setFuncionarios] = useState<{ id: string; nome: string; cargo?: string }[]>([]);
  const [showAtribuirProf, setShowAtribuirProf] = useState(false);
  const [turmaAtribuir, setTurmaAtribuir] = useState<Turma | null>(null);
  const [profSelecionadoId, setProfSelecionadoId] = useState('');
  const [atribuindoProf, setAtribuindoProf] = useState(false);
  const [erroAtribuir, setErroAtribuir] = useState<string | null>(null);
  const [showAlunosTurma, setShowAlunosTurma] = useState(false);
  const [turmaSelecionada, setTurmaSelecionada] = useState<Turma | null>(null);
  const [alunosDaTurma, setAlunosDaTurma] = useState<any[]>([]);
  const [loadingAlunosTurma, setLoadingAlunosTurma] = useState(false);
  const [removendoAlunoId, setRemovendoAlunoId] = useState<string | null>(null);
  const [showHistPresenca, setShowHistPresenca] = useState(false);
  const [turmaPresenca, setTurmaPresenca] = useState<Turma | null>(null);
  const [sessoesPresenca, setSessoesPresenca] = useState<PresencaSessao[]>([]);
  const [loadingPresenca, setLoadingPresenca] = useState(false);
  const [sessaoExpandidaT, setSessaoExpandidaT] = useState<string | null>(null);
  const [detalhesSessaoT, setDetalhesSessaoT] = useState<Record<string, any[]>>({});

  const load = useCallback(async () => {
    try { const r = await api.get('/academico/turmas'); setTurmas(r.data); } catch {}
  }, []);

  useEffect(() => {
    api.get('/academico/usuarios-professores')
      .then(r => setUsuariosProfessores(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
    api.get('/funcionarios')
      .then(r => setFuncionarios(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const abrir = async (t?: Turma) => {
    setErro(null);
    setHorariosDia({});
    setGradeCardsTurma([]);
    setGradeLoaded(false);
    if (t) {
      setEditando(t);
      setForm({ ...t, cor: t.cor || '#7c3aed' });
      try {
        const r = await api.get('/academico/grade');
        const cards: GradeCard[] = (r.data as GradeCard[]).filter(g => g.turma_id === t.id);
        setGradeCardsTurma(cards);
        const horarios: Record<number, HorarioDia> = {};
        for (const c of cards) {
          horarios[c.dia_semana] = {
            ativo: true,
            hora_inicio: (c.horario_inicio || '').substring(0, 5),
            hora_fim:    (c.horario_fim || '').substring(0, 5),
          };
        }
        setHorariosDia(horarios);
        setGradeLoaded(true);
      } catch {}
    } else {
      setEditando(null);
      setForm({ ano: new Date().getFullYear().toString(), cor: '#7c3aed' });
      setGradeLoaded(true);
    }
    setShowModal(true);
  };

  const setFormCurso = (cursoId: string) => {
    const curso = cursos.find(c => c.id === cursoId);
    setForm(p => ({
      ...p,
      curso_id: cursoId,
      nome: curso ? curso.nome : p.nome,
    }));
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      let turmaId: string;
      if (editando) {
        await api.patch(`/academico/turmas/${editando.id}`, form);
        turmaId = editando.id;
        if (gradeLoaded) {
          const diasAtivos = Object.entries(horariosDia).filter(([, v]) => v.ativo && v.hora_inicio && v.hora_fim);
          await Promise.all(diasAtivos.map(([dia, h]) =>
            api.post('/academico/grade', {
              turma_id: turmaId,
              dia_semana: parseInt(dia),
              horario_inicio: h.hora_inicio.length === 5 ? h.hora_inicio + ':00' : h.hora_inicio,
              horario_fim:    h.hora_fim.length    === 5 ? h.hora_fim    + ':00' : h.hora_fim,
            })
          ));
          await Promise.all(gradeCardsTurma.map(g => api.delete(`/academico/grade/${g.id}`).catch(() => {})));
        }
      } else {
        const r = await api.post('/academico/turmas', form);
        turmaId = r.data.id;
        const diasAtivos = Object.entries(horariosDia).filter(([, v]) => v.ativo && v.hora_inicio && v.hora_fim);
        await Promise.all(diasAtivos.map(([dia, h]) =>
          api.post('/academico/grade', {
            turma_id: turmaId,
            dia_semana: parseInt(dia),
            horario_inicio: h.hora_inicio.length === 5 ? h.hora_inicio + ':00' : h.hora_inicio,
            horario_fim:    h.hora_fim.length    === 5 ? h.hora_fim    + ':00' : h.hora_fim,
          })
        ));
      }
      setShowModal(false); await load();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Erro desconhecido ao salvar turma.';
      setErro(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSalvando(false);
    }
  };

  const deletar = async (id: string) => {
    if (!confirm('Excluir turma?')) return;
    try { await api.delete(`/academico/turmas/${id}`); await load(); }
    catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Erro ao excluir.';
      alert(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  };

  const abrirIncluir = (turmaIdPreSel?: string) => {
    setIncluirAlunoId(''); setIncluirTurmaId(turmaIdPreSel || '');
    setIncluirErro(null); setIncluirSucesso(null);
    setBuscarAluno('');
    setShowIncluir(true);
  };

  const confirmarInclusao = async () => {
    if (!incluirAlunoId || !incluirTurmaId) return;
    setIncluirSalvando(true); setIncluirErro(null); setIncluirSucesso(null);
    try {
      await api.post('/academico/turma-alunos/incluir', { aluno_id: incluirAlunoId, turma_id: incluirTurmaId });
      const nomeA = alunos.find(a => a.id === incluirAlunoId)?.nome_completo || 'Aluno';
      const nomeT = turmas.find(t => t.id === incluirTurmaId)?.nome || 'Turma';
      setIncluirSucesso(`${nomeA} adicionado(a) à turma ${nomeT} com sucesso!`);
      setIncluirAlunoId(''); setIncluirTurmaId('');
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao incluir aluno na turma.';
      setIncluirErro(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIncluirSalvando(false);
    }
  };

  const nomeCurso = (id?: string) => cursos.find(c => c.id === id)?.nome || '–';
  const nomeProf  = (id?: string) => {
    if (!id) return '–';
    return professores.find(p => p.id === id)?.nome
      || usuariosProfessores.find(u => u.id === id)?.nome
      || funcionarios.find(f => f.id === id)?.nome
      || '–';
  };

  const opcoesProf = (() => {
    const mapa = new Map<string, string>();
    funcionarios.forEach(f => mapa.set(f.id, f.nome + (f.cargo ? ` — ${f.cargo}` : '')));
    professores.filter(p => p.ativo !== false).forEach(p => { if (!mapa.has(p.id)) mapa.set(p.id, p.nome); });
    usuariosProfessores.forEach(u => { if (!mapa.has(u.id)) mapa.set(u.id, u.nome + (u.email ? ` (${u.email})` : '')); });
    return Array.from(mapa.entries()).map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  })();

  const abrirAtribuirProf = (t: Turma) => {
    setTurmaAtribuir(t);
    setProfSelecionadoId(t.professor_id || '');
    setErroAtribuir(null);
    setShowAtribuirProf(true);
  };

  const confirmarAtribuirProf = async () => {
    if (!turmaAtribuir) return;
    setAtribuindoProf(true); setErroAtribuir(null);
    try {
      await api.patch(`/academico/turmas/${turmaAtribuir.id}`, { professor_id: profSelecionadoId || null });
      setShowAtribuirProf(false);
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao atribuir professor.';
      setErroAtribuir(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setAtribuindoProf(false);
    }
  };

  const abrirAlunosTurma = async (t: Turma) => {
    setTurmaSelecionada(t);
    setAlunosDaTurma([]);
    setLoadingAlunosTurma(true);
    setShowAlunosTurma(true);
    try {
      const r = await api.get(`/academico/turma-alunos/${t.id}`);
      setAlunosDaTurma(Array.isArray(r.data) ? r.data : []);
    } catch { setAlunosDaTurma([]); }
    setLoadingAlunosTurma(false);
  };

  const retirarAlunoDaTurma = async (a: any) => {
    if (!turmaSelecionada) return;
    if (!confirm(`Retirar ${a.nome_completo} da turma? O aluno voltará para o backlog.`)) return;
    setRemovendoAlunoId(a.id);
    try {
      await api.patch('/academico/turma-alunos/remover', { aluno_id: a.id, turma_id: turmaSelecionada.id });
      setAlunosDaTurma(prev => prev.filter(x => x.id !== a.id));
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Erro ao retirar aluno da turma.');
    } finally {
      setRemovendoAlunoId(null);
    }
  };

  const abrirHistPresenca = async (t: Turma) => {
    setTurmaPresenca(t);
    setSessoesPresenca([]);
    setSessaoExpandidaT(null);
    setDetalhesSessaoT({});
    setLoadingPresenca(true);
    setShowHistPresenca(true);
    try {
      const r = await api.get('/academico/presenca/sessoes', { params: { turma_id: t.id } });
      setSessoesPresenca(r.data);
    } catch { setSessoesPresenca([]); }
    setLoadingPresenca(false);
  };

  const toggleDetalhesT = async (sessaoId: string) => {
    if (sessaoExpandidaT === sessaoId) { setSessaoExpandidaT(null); return; }
    setSessaoExpandidaT(sessaoId);
    if (!detalhesSessaoT[sessaoId]) {
      try {
        const r = await api.get(`/academico/presenca/sessoes/${sessaoId}/registros`);
        setDetalhesSessaoT(p => ({ ...p, [sessaoId]: r.data }));
      } catch { setDetalhesSessaoT(p => ({ ...p, [sessaoId]: [] })); }
    }
  };

  const fmtDataT = (v: string) => {
    if (!v) return '–';
    const [y, m, d] = v.split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h2 className="text-lg font-black uppercase tracking-tight text-slate-800">Turmas</h2>
        <div className="flex gap-2">
          <button onClick={() => abrirIncluir()} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase hover:bg-indigo-700">
            <UserPlus size={14}/> Incluir Aluno em Turma
          </button>
          <button onClick={() => abrir()} className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase hover:bg-purple-700">
            <Plus size={14}/> Nova Turma
          </button>
        </div>
      </div>
      <div className="bg-white rounded-3xl border border-slate-100 shadow overflow-hidden">
        {turmas.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">Nenhuma turma cadastrada.</div>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-[9px] font-black uppercase text-slate-400">
                <th className="text-left px-4 py-3">Turma</th>
                <th className="text-left px-4 py-3">Curso</th>
                <th className="text-left px-4 py-3">Professor</th>
                <th className="text-left px-4 py-3">Turno</th>
                <th className="text-left px-4 py-3">Ano</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-center px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {turmas.map((t, i) => (
                <tr key={t.id} className={`border-b border-slate-50 hover:bg-purple-50/30 ${i % 2 === 0 ? '' : 'bg-slate-50/20'}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.cor || '#7c3aed' }} />
                      <span className="font-bold text-slate-800">{t.nome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{nomeCurso(t.curso_id)}</td>
                  <td className="px-4 py-3 text-slate-600">{nomeProf(t.professor_id)}</td>
                  <td className="px-4 py-3 text-slate-500">{t.turno || '–'}</td>
                  <td className="px-4 py-3 text-slate-500">{t.ano}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${t.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {t.ativo ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-1 flex-wrap">
                      <button onClick={() => abrirAlunosTurma(t)} title="Ver Alunos da Turma"
                        className="p-1.5 rounded-lg hover:bg-green-50 text-green-600"><Users size={12}/></button>
                      <button onClick={() => abrirHistPresenca(t)} title="Histórico de Presença"
                        className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-400"><ClipboardCheck size={12}/></button>
                      <button onClick={() => abrirAtribuirProf(t)} title="Atribuir Professor"
                        className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-400"><UserPlus size={12}/></button>
                      <button onClick={() => abrir(t)} title="Editar" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Edit3 size={12}/></button>
                      <button onClick={() => deletar(t.id)} title="Excluir" className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={12}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <Modal title={editando ? 'Editar Turma' : 'Nova Turma'} onClose={() => setShowModal(false)}>
          <form onSubmit={salvar} className="space-y-3">
            {cursos.length > 0 && (
              <FieldSelect label="Curso *" value={form.curso_id ?? ''} onChange={setFormCurso}
                options={cursos.filter(c => c.status === 'Ativo' || !c.status).map(c => ({ value: c.id, label: `${c.sigla} – ${c.nome}` }))} />
            )}
            <FieldInput label="Nome da Turma *" value={form.nome} onChange={v => setForm(p => ({ ...p, nome: v }))} required />
            {opcoesProf.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500">Professor / Responsável</label>
                <select value={form.professor_id ?? ''} onChange={e => setForm(p => ({ ...p, professor_id: e.target.value || undefined }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                  <option value="">— Sem professor —</option>
                  {opcoesProf.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500">Turno</label>
              <div className="flex gap-2">
                {['Manhã', 'Tarde', 'Noite', 'Integral'].map(t => (
                  <button key={t} type="button"
                    onClick={() => setForm(p => ({ ...p, turno: t }))}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${
                      form.turno === t
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-purple-300'
                    }`}>{t}</button>
                ))}
              </div>
            </div>
            <FieldInput label="Ano" value={form.ano} onChange={v => setForm(p => ({ ...p, ano: v }))} />
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-500">Cor da Turma</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.cor || '#7c3aed'}
                  onChange={e => setForm(p => ({ ...p, cor: e.target.value }))}
                  className="w-10 h-10 rounded-xl cursor-pointer border border-slate-200 p-0.5 bg-white"
                  title="Escolher cor personalizada"
                />
                <div className="flex gap-1.5 flex-wrap">
                  {CORES_CARD.map(c => (
                    <button key={c} type="button" onClick={() => setForm(p => ({ ...p, cor: c }))}
                      className={`w-6 h-6 rounded-lg transition-all ${form.cor === c ? 'ring-2 ring-offset-1 ring-slate-800 scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <p className="text-[9px] text-slate-400">Clique no quadrado colorido para escolher qualquer cor</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-500">Horários por Dia da Semana</label>
              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                {DIAS_GRADE.map(({ idx, label }) => {
                  const dia = horariosDia[idx];
                  const ativo = dia?.ativo || false;
                  return (
                    <div key={idx} className={`flex items-center gap-3 px-3 py-2 transition-colors ${ativo ? 'bg-purple-50/60' : ''}`}>
                      <button type="button"
                        onClick={() => setHorariosDia(p => ({
                          ...p,
                          [idx]: { ativo: !ativo, hora_inicio: dia?.hora_inicio || '', hora_fim: dia?.hora_fim || '' }
                        }))}
                        className={`w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 transition-all ${ativo ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 bg-white'}`}>
                        {ativo && <Check size={11}/>}
                      </button>
                      <span className={`text-[10px] font-black uppercase w-16 shrink-0 ${ativo ? 'text-purple-700' : 'text-slate-400'}`}>{label}</span>
                      {ativo ? (
                        <>
                          <input type="time" value={dia?.hora_inicio || ''}
                            onChange={e => setHorariosDia(p => ({ ...p, [idx]: { ...p[idx], hora_inicio: e.target.value } }))}
                            className="flex-1 border border-slate-200 rounded-xl px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400" />
                          <span className="text-slate-400 text-xs shrink-0">–</span>
                          <input type="time" value={dia?.hora_fim || ''}
                            onChange={e => setHorariosDia(p => ({ ...p, [idx]: { ...p[idx], hora_fim: e.target.value } }))}
                            className="flex-1 border border-slate-200 rounded-xl px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400" />
                        </>
                      ) : (
                        <span className="text-[9px] text-slate-300 italic">Sem aula</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold rounded-xl px-4 py-2.5 uppercase tracking-wide">
                ⚠ {erro}
              </div>
            )}
            <button type="submit" disabled={salvando} className="w-full bg-purple-600 text-white py-2.5 rounded-xl font-black text-xs uppercase disabled:opacity-50">
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </form>
        </Modal>
      )}

      {showIncluir && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowIncluir(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-slate-100">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                      <UserPlus size={16} className="text-indigo-600"/>
                    </div>
                    <h2 className="font-black text-slate-800 text-base">Incluir Aluno em Turma</h2>
                  </div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide ml-10">Selecione o aluno e a turma de destino</p>
                </div>
                <button onClick={() => setShowIncluir(false)} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                  <X size={16}/>
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {alunos.filter(a => a.ativo === true).length === 0 ? (
                <div className="py-10 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <UserPlus size={20} className="text-slate-300"/>
                  </div>
                  <p className="text-sm font-bold text-slate-400">Nenhum aluno ativo encontrado.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Aluno</label>
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                      <input
                        value={buscarAluno}
                        onChange={e => { setBuscarAluno(e.target.value); setIncluirAlunoId(''); }}
                        placeholder="Buscar por nome ou matrícula..."
                        className="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-shadow"
                      />
                    </div>
                    {buscarAluno.length > 0 && (
                      <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm max-h-44 overflow-y-auto">
                        {alunos
                          .filter(a => a.ativo === true && (
                            a.nome_completo.toLowerCase().includes(buscarAluno.toLowerCase()) ||
                            (a.numero_matricula || '').toLowerCase().includes(buscarAluno.toLowerCase())
                          ))
                          .slice(0, 10)
                          .map(a => (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => { setIncluirAlunoId(a.id); setBuscarAluno(a.nome_completo); }}
                              className={`w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors border-b border-slate-50 last:border-0 ${incluirAlunoId === a.id ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                            >
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${incluirAlunoId === a.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                {(a.nome_completo[0] || '?').toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-800 truncate">{a.nome_completo}</p>
                                {a.numero_matricula && <p className="text-[9px] font-mono text-slate-400">{a.numero_matricula}</p>}
                              </div>
                              {incluirAlunoId === a.id && <Check size={12} className="text-indigo-600 shrink-0"/>}
                            </button>
                          ))}
                        {alunos.filter(a => a.ativo === true && (
                          a.nome_completo.toLowerCase().includes(buscarAluno.toLowerCase()) ||
                          (a.numero_matricula || '').toLowerCase().includes(buscarAluno.toLowerCase())
                        )).length === 0 && (
                          <p className="text-xs text-slate-400 text-center py-4">Nenhum aluno encontrado.</p>
                        )}
                      </div>
                    )}
                    {incluirAlunoId && (
                      <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[9px] font-black text-white shrink-0">
                          {(alunos.find(a => a.id === incluirAlunoId)?.nome_completo[0] || '?').toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-indigo-800 truncate">{alunos.find(a => a.id === incluirAlunoId)?.nome_completo}</p>
                          <p className="text-[9px] text-indigo-400 font-mono">{alunos.find(a => a.id === incluirAlunoId)?.numero_matricula || ''}</p>
                        </div>
                        <Check size={13} className="text-indigo-500 shrink-0"/>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Turma de Destino</label>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                      {turmas.filter(t => t.ativo !== false).map(t => {
                        const selecionada = incluirTurmaId === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setIncluirTurmaId(t.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-left ${
                              selecionada
                                ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                                : 'border-slate-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/30'
                            }`}
                          >
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.cor || '#7c3aed' }}/>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-black truncate ${selecionada ? 'text-indigo-800' : 'text-slate-700'}`}>{t.nome}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {t.turno && <span className="text-[9px] font-bold text-slate-400 uppercase">{t.turno}</span>}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className={`flex items-center gap-1 text-[10px] font-black ${selecionada ? 'text-indigo-600' : 'text-slate-500'}`}>
                                <Users size={10}/>
                                <span>{t.total_alunos ?? 0} aluno(s)</span>
                              </div>
                            </div>
                            {selecionada && <div className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center shrink-0"><Check size={9} className="text-white"/></div>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {incluirErro && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold rounded-xl px-4 py-3">
                      <AlertCircle size={14} className="shrink-0"/>
                      {incluirErro}
                    </div>
                  )}
                  {incluirSucesso && (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-[11px] font-bold rounded-xl px-4 py-3">
                      <Check size={14} className="shrink-0"/>
                      {incluirSucesso}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-6 pb-6 pt-1 flex gap-3">
              <button onClick={() => setShowIncluir(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 font-black text-xs uppercase text-slate-500 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button
                disabled={!incluirAlunoId || !incluirTurmaId || incluirSalvando}
                onClick={confirmarInclusao}
                className="flex-2 flex-[2] flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl font-black text-xs uppercase disabled:opacity-40 hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200">
                {incluirSalvando ? (
                  <><RefreshCw size={13} className="animate-spin"/> Incluindo...</>
                ) : (
                  <><UserPlus size={13}/> Confirmar Inclusão</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAlunosTurma && turmaSelecionada && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAlunosTurma(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className="w-4 h-4 rounded-full" style={{ backgroundColor: turmaSelecionada.cor || '#7c3aed' }} />
                <div>
                  <h2 className="font-black text-slate-800 text-base">{turmaSelecionada.nome}</h2>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">
                    {loadingAlunosTurma ? 'Carregando...' : `${alunosDaTurma.length} aluno(s) matriculado(s)`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowAlunosTurma(false); setIncluirTurmaId(turmaSelecionada.id); setIncluirAlunoId(''); setIncluirErro(null); setIncluirSucesso(null); setBuscarAluno(''); setShowIncluir(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase hover:bg-indigo-700">
                  <UserPlus size={11}/> Adicionar Aluno
                </button>
                <button onClick={() => setShowAlunosTurma(false)} className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100"><X size={16}/></button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {loadingAlunosTurma ? (
                <div className="py-16 text-center text-sm text-slate-400">Carregando alunos...</div>
              ) : alunosDaTurma.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto"><Users size={22} className="text-slate-300"/></div>
                  <p className="text-sm font-bold text-slate-400">Nenhum aluno matriculado nesta turma.</p>
                  <button
                    onClick={() => { setShowAlunosTurma(false); setIncluirTurmaId(turmaSelecionada.id); setIncluirAlunoId(''); setIncluirErro(null); setIncluirSucesso(null); setBuscarAluno(''); setShowIncluir(true); }}
                    className="text-xs font-black text-indigo-600 underline">Adicionar primeiro aluno</button>
                </div>
              ) : (
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                    <tr className="text-[9px] font-black uppercase text-slate-400">
                      <th className="text-left px-5 py-3">Aluno</th>
                      <th className="text-left px-4 py-3">Matrícula</th>
                      <th className="text-left px-4 py-3">CPF</th>
                      <th className="text-left px-4 py-3">Contato</th>
                      <th className="text-left px-4 py-3">Vinculado em</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {alunosDaTurma.map((a: any, i: number) => (
                      <tr key={a.vinculo_id || a.id} className={`border-b border-slate-50 hover:bg-indigo-50/30 ${i % 2 === 0 ? '' : 'bg-slate-50/20'}`}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            {a.foto_url
                              ? <img src={a.foto_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-100"/>
                              : <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 text-[10px] font-black text-indigo-600">{(a.nome_completo?.[0] || '?').toUpperCase()}</div>}
                            <div>
                              <div className="font-bold text-slate-800">{a.nome_completo}</div>
                              <div className={`text-[8px] font-black uppercase ${a.ativo ? 'text-green-600' : 'text-red-400'}`}>{a.ativo ? 'Ativo' : 'Inativo'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-purple-700 font-bold text-[10px]">{a.numero_matricula || '–'}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-[10px]">{a.cpf || '–'}</td>
                        <td className="px-4 py-3 text-slate-500 text-[10px]">{a.celular || a.email || '–'}</td>
                        <td className="px-4 py-3 text-slate-400 text-[10px]">{a.vinculado_em ? new Date(a.vinculado_em).toLocaleDateString('pt-BR') : '–'}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => retirarAlunoDaTurma(a)}
                            disabled={removendoAlunoId === a.id}
                            title="Retirar da turma"
                            className="flex items-center gap-1 px-2 py-1 text-[9px] font-black uppercase text-red-600 bg-red-50 hover:bg-red-100 rounded-lg disabled:opacity-40 transition-colors">
                            {removendoAlunoId === a.id ? '...' : <><UserMinus size={10}/> Retirar</>}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {showAtribuirProf && turmaAtribuir && (
        <Modal title={`Atribuir Professor — ${turmaAtribuir.nome}`} onClose={() => setShowAtribuirProf(false)}>
          <div className="space-y-4">
            {opcoesProf.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Nenhum funcionário ou professor encontrado.</p>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Professor / Funcionário</label>
                  <select value={profSelecionadoId} onChange={e => setProfSelecionadoId(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                    <option value="">— Nenhum —</option>
                    {opcoesProf.map(o => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </div>
                {erroAtribuir && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold rounded-xl px-4 py-2.5">⚠ {erroAtribuir}</div>
                )}
                <button onClick={confirmarAtribuirProf} disabled={atribuindoProf}
                  className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-black text-xs uppercase disabled:opacity-50 hover:bg-indigo-700">
                  {atribuindoProf ? 'Salvando...' : 'Confirmar Atribuição'}
                </button>
              </>
            )}
          </div>
        </Modal>
      )}

      {showHistPresenca && turmaPresenca && (
        <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-5 border-b shrink-0">
              <div>
                <h3 className="font-black text-sm uppercase tracking-tight text-slate-800">Presença — {turmaPresenca.nome}</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase mt-0.5">{sessoesPresenca.length} aula{sessoesPresenca.length !== 1 ? 's' : ''} registrada{sessoesPresenca.length !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => setShowHistPresenca(false)} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400"><X size={16}/></button>
            </div>
            <div className="overflow-y-auto flex-1">
              {loadingPresenca ? (
                <div className="py-12 text-center text-sm text-slate-400">Carregando...</div>
              ) : sessoesPresenca.length === 0 ? (
                <div className="py-16 text-center">
                  <ClipboardCheck size={36} className="mx-auto mb-3 text-slate-200" />
                  <p className="text-sm text-slate-400">Nenhuma aula registrada para esta turma.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {sessoesPresenca.map(s => (
                    <div key={s.id}>
                      <div className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-purple-50/20">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-slate-800">{fmtDataT(s.data)}</span>
                          </div>
                          {s.tema_aula && <p className="text-[11px] font-bold text-slate-600 mt-0.5">{s.tema_aula}</p>}
                          {s.usuario_nome && <p className="text-[9px] text-slate-400 mt-0.5">Por: {s.usuario_nome}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="bg-green-100 text-green-700 text-[9px] font-black px-2 py-0.5 rounded-full">{s.total_presentes} pres.</span>
                          <span className="bg-red-100 text-red-600 text-[9px] font-black px-2 py-0.5 rounded-full">{s.total_ausentes} aus.</span>
                          <button onClick={() => toggleDetalhesT(s.id)}
                            className="flex items-center gap-1 text-[9px] font-black uppercase text-slate-500 hover:text-purple-600 border border-slate-200 px-2.5 py-1 rounded-lg">
                            <Eye size={10}/> {sessaoExpandidaT === s.id ? 'Fechar' : 'Ver'}
                            {sessaoExpandidaT === s.id ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}
                          </button>
                        </div>
                      </div>
                      {sessaoExpandidaT === s.id && (
                        <div className="bg-slate-50/60 border-t border-slate-100 px-6 py-3">
                          {!detalhesSessaoT[s.id] ? (
                            <p className="text-xs text-slate-400">Carregando...</p>
                          ) : detalhesSessaoT[s.id].length === 0 ? (
                            <p className="text-xs text-slate-400">Sem registros.</p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {detalhesSessaoT[s.id].map((r: any) => (
                                <div key={r.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${r.descricao === 'Presente' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                  <div className={`w-2 h-2 rounded-full shrink-0 ${r.descricao === 'Presente' ? 'bg-green-500' : 'bg-red-400'}`} />
                                  <span className="truncate">{r.aluno_nome || r.aluno_id}</span>
                                  <span className="shrink-0 text-[9px] uppercase">{r.descricao}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

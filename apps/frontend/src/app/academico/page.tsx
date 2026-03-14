'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap, Users, BookOpen, LayoutGrid, History,
  Plus, Trash2, Search, X, ClipboardList,
  Edit3, Coffee, UserPlus, RefreshCw, ClipboardCheck, CheckSquare, Square,
  ChevronDown, ChevronUp, FileText, Eye,
} from 'lucide-react';
import api from '@/services/api';
import { useAuth } from '@/context/auth-context';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Curso { id: string; nome: string; sigla: string; status: string; periodo?: string; }
interface Professor { id: string; nome: string; especialidade?: string; email?: string; ativo?: boolean; }
interface Turma { id: string; nome: string; curso_id?: string; professor_id?: string; turno?: string; ano?: string; max_alunos?: number; ativo?: boolean; hora_inicio?: string; hora_fim?: string; }
interface TurmaAlunoRecord { id: string; turma_id: string | null; aluno_id: string; status: string; created_at: string; }
interface GradeCard { id: string; dia_semana: number; horario_inicio: string; horario_fim: string; nome_curso?: string; nome_professor?: string; turma_id?: string; sala?: string; cor?: string; }
interface DiarioEntry { id: string; tipo: string; titulo?: string; descricao?: string; aluno_id?: string; aluno_nome?: string; turma_id?: string; data: string; usuario_nome?: string; created_at: string; }
interface Aluno { id: string; nome_completo: string; numero_matricula?: string; cpf?: string; celular?: string; email?: string; sexo?: string; data_nascimento?: string; cidade?: string; bairro?: string; cursos_matriculados?: string; turno_escolar?: string; ativo?: boolean; data_matricula?: string; }
interface PresencaSessao { id: string; turma_id: string; turma_nome?: string; data: string; tema_aula?: string; conteudo_abordado?: string; usuario_nome?: string; total_presentes: number; total_ausentes: number; created_at: string; }

// ─── Constantes ───────────────────────────────────────────────────────────────

const DIAS_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const HORARIOS: Array<{ label: string; value?: string; lanche?: boolean }> = [
  { label: '8:30',   value: '08:30' },
  { label: '9:00',   value: '09:00' },
  { label: '9:30',   value: '09:30' },
  { label: 'LANCHE', lanche: true },
  { label: '10:00',  value: '10:00' },
  { label: '10:30',  value: '10:30' },
  { label: '11:00',  value: '11:00' },
  { label: '14:30',  value: '14:30' },
  { label: '15:00',  value: '15:00' },
  { label: '15:30',  value: '15:30' },
  { label: '16:00',  value: '16:00' },
  { label: '16:30',  value: '16:30' },
  { label: 'LANCHE', lanche: true },
  { label: '17:00',  value: '17:00' },
  { label: '17:30',  value: '17:30' },
  { label: '18:00',  value: '18:00' },
  { label: '18:30',  value: '18:30' },
  { label: '19:00',  value: '19:00' },
  { label: '19:30',  value: '19:30' },
  { label: '20:00',  value: '20:00' },
  { label: '20:30',  value: '20:30' },
  { label: '21:00',  value: '21:00' },
];

const GRUPOS_EDITOR = ['ADMIN', 'PRT', 'VP', 'DRT', 'DRT ADJ'];

const CORES_CARD = [
  '#7c3aed', '#0891b2', '#16a34a', '#d97706',
  '#dc2626', '#db2777', '#0284c7', '#059669',
];

const TIPOS_DIARIO = ['Avaliação', 'Presença', 'Incidente', 'Observação', 'Comunicado'];

function fmtDate(v?: string | null) {
  if (!v) return '---';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v;
  const s = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v + 'T12:00:00' : v;
  const d = new Date(s);
  return isNaN(d.getTime()) ? '---' : d.toLocaleDateString('pt-BR');
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function TabBtn({ id, active, set, label, Icon }: { id: string; active: string; set: (id: string) => void; label: string; Icon: any }) {
  return (
    <button
      onClick={() => set(id)}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap
        ${active === id ? 'bg-white text-purple-700 shadow' : 'text-slate-500 hover:text-slate-800'}`}
    >
      <Icon size={13} />{label}
    </button>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b">
          <h3 className="font-black text-sm uppercase tracking-tight text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400"><X size={16}/></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function FieldInput({ label, value, onChange, type = 'text', required = false }: { label: string; value?: any; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-black uppercase text-slate-500">{label}{required && ' *'}</label>
      <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} required={required}
        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
    </div>
  );
}

function FieldSelect({ label, value, onChange, options, required = false }: { label: string; value?: any; onChange: (v: string) => void; options: Array<{value: string; label: string} | string>; required?: boolean }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-black uppercase text-slate-500">{label}{required && ' *'}</label>
      <select value={value ?? ''} onChange={e => onChange(e.target.value)} required={required}
        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
        <option value="">Selecione...</option>
        {options.map((o) => {
          const val = typeof o === 'string' ? o : o.value;
          const lbl = typeof o === 'string' ? o : o.label;
          return <option key={val} value={val}>{lbl}</option>;
        })}
      </select>
    </div>
  );
}

// ─── Tab: Grade ───────────────────────────────────────────────────────────────

function GradeTab({ podeEditar, turmas }: { podeEditar: boolean; turmas: Turma[] }) {
  const [grade, setGrade] = useState<GradeCard[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [dragCard, setDragCard] = useState<GradeCard | null>(null);
  const [form, setForm] = useState<Partial<GradeCard>>({ cor: '#7c3aed' });
  const [erroGrade, setErroGrade] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { const r = await api.get('/academico/grade'); setGrade(r.data); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const cardsAt = (dia: number, hora: string) =>
    grade.filter(g => g.dia_semana === dia && g.horario_inicio === hora + ':00');

  const handleDrop = async (e: React.DragEvent, dia: number, hora: string) => {
    e.preventDefault();
    if (!dragCard || !podeEditar) return;
    try {
      await api.patch(`/academico/grade/${dragCard.id}`, { dia_semana: dia, horario_inicio: hora + ':00' });
      await load();
    } catch {}
    setDragCard(null);
  };

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroGrade(null);
    if (!form.turma_id) { setErroGrade('Selecione uma turma para continuar.'); return; }
    try {
      await api.post('/academico/grade', {
        ...form,
        horario_inicio: form.horario_inicio ? form.horario_inicio + ':00' : undefined,
        horario_fim:    form.horario_fim    ? form.horario_fim    + ':00' : undefined,
      });
      setShowModal(false); setForm({ cor: '#7c3aed' }); await load();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Erro ao salvar horário.';
      setErroGrade(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  };

  const handleDeletar = async (id: string) => {
    if (!confirm('Remover este horário?')) return;
    try { await api.delete(`/academico/grade/${id}`); await load(); } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-black uppercase tracking-tight text-slate-800">Grade Horária Semanal</h2>
        {podeEditar && (
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase hover:bg-purple-700 transition-colors">
            <Plus size={14}/> Adicionar Horário
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Header dias */}
          <div className="grid border-b border-slate-100" style={{ gridTemplateColumns: '80px repeat(6, 1fr)' }}>
            <div className="p-3 border-r border-slate-50" />
            {DIAS_SEMANA.map(d => (
              <div key={d} className="p-3 text-center text-[10px] font-black uppercase text-slate-400 border-r border-slate-50 last:border-0">{d}</div>
            ))}
          </div>
          {/* Linhas de horário */}
          {HORARIOS.map((h, idx) => {
            if (h.lanche) {
              return (
                <div key={`lanche-${idx}`} className="grid border-b border-slate-50 bg-amber-50/60" style={{ gridTemplateColumns: '80px repeat(6, 1fr)' }}>
                  <div className="p-2 flex items-center justify-center gap-1 border-r border-slate-100">
                    <Coffee size={10} className="text-amber-500" />
                    <span className="text-[9px] font-black uppercase text-amber-500">Lanche</span>
                  </div>
                  {Array.from({ length: 6 }).map((_, di) => (
                    <div key={di} className="p-2 border-r border-slate-50 last:border-0 bg-amber-50/40" />
                  ))}
                </div>
              );
            }
            const hora = h.value!;
            return (
              <div key={hora} className="grid border-b border-slate-50 hover:bg-slate-50/40 transition-colors" style={{ gridTemplateColumns: '80px repeat(6, 1fr)' }}>
                <div className="p-2 flex items-center justify-center border-r border-slate-100">
                  <span className="text-[10px] font-black text-slate-400">{h.label}</span>
                </div>
                {DIAS_SEMANA.map((_, di) => {
                  const diaNum = di + 1;
                  const cards = cardsAt(diaNum, hora);
                  return (
                    <div key={di} className="p-1 min-h-[44px] border-r border-slate-50 last:border-0"
                      onDragOver={e => { if (podeEditar) e.preventDefault(); }}
                      onDrop={e => handleDrop(e, diaNum, hora)}>
                      {cards.map(card => (
                        <div key={card.id} draggable={podeEditar}
                          onDragStart={() => setDragCard(card)}
                          onDragEnd={() => setDragCard(null)}
                          className="rounded-lg p-1.5 mb-1 text-white text-[9px] font-bold cursor-grab active:cursor-grabbing shadow-sm relative group/card"
                          style={{ backgroundColor: card.cor || '#7c3aed' }}>
                          {podeEditar && (
                            <button onClick={() => handleDeletar(card.id)}
                              className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
                              <X size={9}/>
                            </button>
                          )}
                          <div className="font-black leading-tight truncate">{card.nome_curso || '–'}</div>
                          <div className="opacity-80 text-[8px] truncate">{card.nome_professor || ''}</div>
                          <div className="opacity-70 text-[8px]">{card.horario_inicio?.slice(0,5)} – {card.horario_fim?.slice(0,5)}</div>
                          {card.sala && <div className="opacity-60 text-[8px]">Sala: {card.sala}</div>}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {!podeEditar && (
        <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest">
          Visualização apenas · Edição restrita a ADMIN / PRT / VP / DRT
        </p>
      )}

      {showModal && (
        <Modal title="Adicionar Horário na Grade" onClose={() => { setShowModal(false); setForm({ cor: '#7c3aed' }); setErroGrade(null); }}>
          <form onSubmit={handleCriar} className="space-y-3">
            <FieldSelect label="Turma *" value={form.turma_id ?? ''}
              onChange={v => setForm(p => ({ ...p, turma_id: v }))}
              options={turmas.map(t => ({ value: t.id, label: t.nome }))} required />
            <FieldSelect label="Dia da Semana" value={String(form.dia_semana ?? '')}
              onChange={v => setForm(p => ({ ...p, dia_semana: Number(v) }))}
              options={DIAS_SEMANA.map((d, i) => ({ value: String(i+1), label: d }))} required />
            <div className="grid grid-cols-2 gap-3">
              <FieldSelect label="Hora Início" value={form.horario_inicio}
                onChange={v => setForm(p => ({ ...p, horario_inicio: v }))}
                options={HORARIOS.filter(h => h.value).map(h => ({ value: h.value!, label: h.label }))} required />
              <FieldSelect label="Hora Fim" value={form.horario_fim}
                onChange={v => setForm(p => ({ ...p, horario_fim: v }))}
                options={HORARIOS.filter(h => h.value).map(h => ({ value: h.value!, label: h.label }))} required />
            </div>
            <FieldInput label="Sala (opcional)" value={form.sala} onChange={v => setForm(p => ({ ...p, sala: v }))} />
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500">Cor do Card</label>
              <div className="flex gap-2 flex-wrap">
                {CORES_CARD.map(c => (
                  <button key={c} type="button" onClick={() => setForm(p => ({ ...p, cor: c }))}
                    className={`w-7 h-7 rounded-lg transition-all ${form.cor === c ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : ''}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            {erroGrade && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold rounded-xl px-4 py-2.5 uppercase tracking-wide">
                ⚠ {erroGrade}
              </div>
            )}
            <button type="submit" className="w-full bg-purple-600 text-white py-2.5 rounded-xl font-black text-xs uppercase hover:bg-purple-700">
              Confirmar
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Tab: Alunos ──────────────────────────────────────────────────────────────

function AlunosTab({ cursos, turmas }: { cursos: Curso[]; turmas: Turma[] }) {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroCursoNome, setFiltroCursoNome] = useState('');
  const [filtroTurmaId, setFiltroTurmaId] = useState('');
  const [fichaAluno, setFichaAluno] = useState<any>(null);

  const turmasDoCurso = turmas.filter(t => {
    if (!filtroCursoNome) return false;
    const curso = cursos.find(c => c.nome === filtroCursoNome);
    return curso ? t.curso_id === curso.id : false;
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filtroNome)      params.nome     = filtroNome;
      if (filtroCursoNome) params.curso    = filtroCursoNome;
      if (filtroTurmaId)   params.turma_id = filtroTurmaId;
      const r = await api.get('/academico/alunos', { params });
      setAlunos(r.data);
    } catch {}
    setLoading(false);
  }, [filtroNome, filtroCursoNome, filtroTurmaId]);

  useEffect(() => { load(); }, [load]);

  const verFicha = async (id: string) => {
    try { const r = await api.get(`/academico/alunos/${id}/ficha`); setFichaAluno(r.data); } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
        <div className="flex-1 min-w-[180px]">
          <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Nome</label>
          <div className="relative">
            <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={filtroNome} onChange={e => setFiltroNome(e.target.value)} placeholder="Buscar aluno..."
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>
        </div>
        <div className="min-w-[160px]">
          <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Curso</label>
          <select value={filtroCursoNome} onChange={e => { setFiltroCursoNome(e.target.value); setFiltroTurmaId(''); }}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
            <option value="">Todos os cursos</option>
            {cursos.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </select>
        </div>
        {filtroCursoNome && turmasDoCurso.length > 0 && (
          <div className="min-w-[160px]">
            <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Turma</label>
            <select value={filtroTurmaId} onChange={e => setFiltroTurmaId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
              <option value="">Todas as turmas</option>
              {turmasDoCurso.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
        )}
        <button onClick={() => { setFiltroNome(''); setFiltroCursoNome(''); setFiltroTurmaId(''); }}
          className="text-[10px] font-black uppercase text-red-400 hover:text-red-600 flex items-center gap-1">
          <X size={11}/> Limpar
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-400">Carregando...</div>
        ) : alunos.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">Nenhum aluno encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-[9px] font-black uppercase text-slate-400">
                  <th className="text-left px-4 py-3">Aluno</th>
                  <th className="text-left px-4 py-3">Matrícula</th>
                  <th className="text-left px-4 py-3">CPF</th>
                  <th className="text-left px-4 py-3">Cursos</th>
                  <th className="text-left px-4 py-3">Turno</th>
                  <th className="text-left px-4 py-3">Data Matr.</th>
                  <th className="text-center px-4 py-3">Ficha</th>
                </tr>
              </thead>
              <tbody>
                {alunos.map((a, i) => (
                  <tr key={a.id} className={`border-b border-slate-50 hover:bg-purple-50/30 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{a.nome_completo}</div>
                      <div className="text-[9px] text-slate-400">{a.celular || a.email || '–'}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-purple-700 font-bold">{a.numero_matricula || '–'}</td>
                    <td className="px-4 py-3 text-slate-500">{a.cpf || '–'}</td>
                    <td className="px-4 py-3 max-w-[160px] truncate text-slate-600">{a.cursos_matriculados || '–'}</td>
                    <td className="px-4 py-3 text-slate-500">{a.turno_escolar || '–'}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(a.data_matricula)}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => verFicha(a.id)}
                        className="bg-purple-100 text-purple-700 px-3 py-1 rounded-lg text-[9px] font-black uppercase hover:bg-purple-200 transition-colors">
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {fichaAluno && (
        <Modal title={`Ficha: ${fichaAluno.aluno?.nome_completo}`} onClose={() => setFichaAluno(null)}>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <section>
              <h4 className="text-[9px] font-black uppercase text-purple-600 mb-2 tracking-widest">Dados Pessoais</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {([['Matrícula', fichaAluno.aluno?.numero_matricula],
                  ['CPF', fichaAluno.aluno?.cpf],
                  ['Celular', fichaAluno.aluno?.celular],
                  ['E-mail', fichaAluno.aluno?.email],
                  ['Nascimento', fmtDate(fichaAluno.aluno?.data_nascimento)],
                  ['Sexo', fichaAluno.aluno?.sexo],
                  ['Cidade', fichaAluno.aluno?.cidade],
                  ['Bairro', fichaAluno.aluno?.bairro],
                  ['Turno', fichaAluno.aluno?.turno_escolar],
                  ['Cursos', fichaAluno.aluno?.cursos_matriculados],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="bg-slate-50 rounded-xl p-2">
                    <span className="text-[8px] font-black uppercase text-slate-400 block">{k}</span>
                    <span className="font-bold text-slate-700 truncate block">{v || '–'}</span>
                  </div>
                ))}
              </div>
            </section>
            {fichaAluno.historico?.length > 0 && (
              <section>
                <h4 className="text-[9px] font-black uppercase text-purple-600 mb-2 tracking-widest">Histórico Diário</h4>
                <div className="space-y-1.5">
                  {fichaAluno.historico.map((h: DiarioEntry) => (
                    <div key={h.id} className="flex gap-2 bg-slate-50 rounded-xl p-2">
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-purple-100 text-purple-700 uppercase self-start whitespace-nowrap">{h.tipo}</span>
                      <div>
                        {h.titulo && <div className="text-xs font-bold text-slate-700">{h.titulo}</div>}
                        {h.descricao && <div className="text-[10px] text-slate-500">{h.descricao}</div>}
                        <div className="text-[9px] text-slate-400 mt-0.5">{fmtDate(h.data)} · {h.usuario_nome}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Tab: Cursos ──────────────────────────────────────────────────────────────

function CursosTab() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Curso | null>(null);
  const [form, setForm] = useState<Partial<Curso>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get('/academico/cursos'); setCursos(r.data); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const abrir = (c?: Curso) => { setEditando(c || null); setForm(c ? { ...c } : {}); setErro(null); setShowModal(true); };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      if (editando) await api.patch(`/academico/cursos/${editando.id}`, form);
      else await api.post('/academico/cursos', form);
      setShowModal(false); await load();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Erro desconhecido ao salvar curso.';
      setErro(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSalvando(false);
    }
  };

  const deletar = async (id: string) => {
    if (!confirm('Excluir curso?')) return;
    try { await api.delete(`/academico/cursos/${id}`); await load(); }
    catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Erro ao excluir.';
      alert(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-black uppercase tracking-tight text-slate-800">Cursos Oferecidos</h2>
        <button onClick={() => abrir()} className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase hover:bg-purple-700">
          <Plus size={14}/> Novo Curso
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cursos.map(c => (
          <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 uppercase">{c.sigla}</span>
              <div className="flex gap-1">
                <button onClick={() => abrir(c)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Edit3 size={12}/></button>
                <button onClick={() => deletar(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={12}/></button>
              </div>
            </div>
            <h3 className="font-black text-sm text-slate-800 leading-tight">{c.nome}</h3>
            <div className="mt-2 flex gap-2 flex-wrap">
              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${c.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{c.status || 'Ativo'}</span>
              {c.periodo && <span className="text-[8px] font-bold text-slate-400">{c.periodo}</span>}

            </div>
          </div>
        ))}
        {cursos.length === 0 && <div className="col-span-full py-16 text-center text-sm text-slate-400">Nenhum curso cadastrado ainda.</div>}
      </div>

      {showModal && (
        <Modal title={editando ? 'Editar Curso' : 'Novo Curso'} onClose={() => setShowModal(false)}>
          <form onSubmit={salvar} className="space-y-3">
            <FieldInput label="Nome do Curso" value={form.nome} onChange={v => setForm(p => ({ ...p, nome: v }))} required />
            <FieldInput label="Sigla" value={form.sigla} onChange={v => setForm(p => ({ ...p, sigla: v.toUpperCase() }))} required />
            <FieldInput label="Período (ex: 2026.1)" value={form.periodo} onChange={v => setForm(p => ({ ...p, periodo: v }))} />
            <FieldSelect label="Status" value={form.status ?? ''} onChange={v => setForm(p => ({ ...p, status: v }))}
              options={['Ativo', 'Inativo', 'Em breve']} />
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
    </div>
  );
}

// ─── Tab: Turmas ──────────────────────────────────────────────────────────────

function calcularTurno(horaInicio: string): string {
  if (!horaInicio) return '';
  const h = parseInt(horaInicio.split(':')[0], 10);
  if (h >= 6 && h < 12) return 'Manhã';
  if (h >= 12 && h < 18) return 'Tarde';
  return 'Noite';
}

function TurmasTab({ cursos, professores, alunos }: { cursos: Curso[]; professores: Professor[]; alunos: Aluno[] }) {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Turma | null>(null);
  const [form, setForm] = useState<Partial<Turma>>({ ano: '2026' });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [showBacklog, setShowBacklog] = useState(false);
  const [backlog, setBacklog] = useState<TurmaAlunoRecord[]>([]);
  const [backlogAlunoId, setBacklogAlunoId] = useState('');
  const [backlogTurmaId, setBacklogTurmaId] = useState('');
  const [backlogLoading, setBacklogLoading] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get('/academico/turmas'); setTurmas(r.data); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const abrir = (t?: Turma) => {
    setErro(null);
    if (t) {
      setEditando(t);
      setForm({ ...t });
    } else {
      setEditando(null);
      setForm({ ano: new Date().getFullYear().toString() });
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

  const setFormHoraInicio = (v: string) => {
    const turno = calcularTurno(v);
    setForm(p => ({ ...p, hora_inicio: v, turno: turno || p.turno }));
  };

  const setFormHoraFim = (v: string) => {
    setForm(p => {
      const turno = p.hora_inicio ? calcularTurno(p.hora_inicio) : p.turno;
      return { ...p, hora_fim: v, turno: turno || p.turno };
    });
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      if (editando) await api.patch(`/academico/turmas/${editando.id}`, form);
      else await api.post('/academico/turmas', form);
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

  const abrirBacklog = async () => {
    setBacklogAlunoId(''); setBacklogTurmaId('');
    setShowBacklog(true); setBacklogLoading(true);
    try { const r = await api.get('/academico/turma-alunos/backlog'); setBacklog(r.data); } catch {}
    setBacklogLoading(false);
  };

  const confirmarInclusao = async () => {
    if (!backlogAlunoId || !backlogTurmaId) return;
    try {
      await api.post('/academico/turma-alunos/incluir', { aluno_id: backlogAlunoId, turma_id: backlogTurmaId });
      setShowBacklog(false); setBacklog([]);
    } catch {}
  };

  const nomeAluno = (id: string) => alunos.find(a => a.id === id)?.nome_completo || id;
  const nomeCurso = (id?: string) => cursos.find(c => c.id === id)?.nome || '–';
  const nomeProf  = (id?: string) => professores.find(p => p.id === id)?.nome || '–';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h2 className="text-lg font-black uppercase tracking-tight text-slate-800">Turmas</h2>
        <div className="flex gap-2">
          <button onClick={abrirBacklog} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase hover:bg-indigo-700">
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
                <th className="text-left px-4 py-3">Horário</th>
                <th className="text-left px-4 py-3">Ano</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-center px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {turmas.map((t, i) => (
                <tr key={t.id} className={`border-b border-slate-50 hover:bg-purple-50/30 ${i % 2 === 0 ? '' : 'bg-slate-50/20'}`}>
                  <td className="px-4 py-3 font-bold text-slate-800">{t.nome}</td>
                  <td className="px-4 py-3 text-slate-600">{nomeCurso(t.curso_id)}</td>
                  <td className="px-4 py-3 text-slate-600">{nomeProf(t.professor_id)}</td>
                  <td className="px-4 py-3 text-slate-500">{t.turno || '–'}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {t.hora_inicio && t.hora_fim ? `${t.hora_inicio} – ${t.hora_fim}` : t.hora_inicio || '–'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{t.ano}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${t.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {t.ativo ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-1">
                      <button onClick={() => abrir(t)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Edit3 size={12}/></button>
                      <button onClick={() => deletar(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={12}/></button>
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
            {/* 1. Curso primeiro — auto-preenche o nome */}
            {cursos.length > 0 && (
              <FieldSelect label="Curso *" value={form.curso_id ?? ''} onChange={setFormCurso}
                options={cursos.filter(c => c.status === 'Ativo' || !c.status).map(c => ({ value: c.id, label: `${c.sigla} – ${c.nome}` }))} />
            )}
            {/* 2. Nome já vem preenchido mas pode editar */}
            <FieldInput label="Nome da Turma *" value={form.nome} onChange={v => setForm(p => ({ ...p, nome: v }))} required />
            {professores.length > 0 && (
              <FieldSelect label="Professor" value={form.professor_id ?? ''} onChange={v => setForm(p => ({ ...p, professor_id: v }))}
                options={professores.filter(p => p.ativo !== false).map(p => ({ value: p.id, label: p.nome }))} />
            )}
            {/* 3. Horários — turno calculado automaticamente */}
            <div className="grid grid-cols-2 gap-3">
              <FieldInput label="Hora Início" type="time" value={form.hora_inicio} onChange={setFormHoraInicio} />
              <FieldInput label="Hora Fim" type="time" value={form.hora_fim} onChange={setFormHoraFim} />
            </div>
            {/* 4. Turno preenchido automaticamente (editável) */}
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

      {showBacklog && (
        <Modal title="Incluir Aluno em Turma" onClose={() => setShowBacklog(false)}>
          <div className="space-y-4">
            {backlogLoading ? (
              <p className="text-sm text-slate-400 text-center py-6">Carregando backlog...</p>
            ) : backlog.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Nenhum aluno no backlog.</p>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Aluno (backlog)</label>
                  <select value={backlogAlunoId} onChange={e => setBacklogAlunoId(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                    <option value="">Selecione o aluno...</option>
                    {backlog.map(b => (
                      <option key={b.id} value={b.aluno_id}>{nomeAluno(b.aluno_id)}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Turma de destino</label>
                  <select value={backlogTurmaId} onChange={e => setBacklogTurmaId(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                    <option value="">Selecione a turma...</option>
                    {turmas.filter(t => t.ativo !== false).map(t => (
                      <option key={t.id} value={t.id}>{t.nome}{t.turno ? ` (${t.turno})` : ''}</option>
                    ))}
                  </select>
                </div>
                <button disabled={!backlogAlunoId || !backlogTurmaId}
                  onClick={confirmarInclusao}
                  className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-black text-xs uppercase disabled:opacity-40 hover:bg-indigo-700">
                  Confirmar
                </button>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Tab: Diário ──────────────────────────────────────────────────────────────

function DiarioTab({ turmas, alunos }: { turmas: Turma[]; alunos: Aluno[] }) {
  const [registros, setRegistros] = useState<DiarioEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [form, setForm] = useState<Partial<DiarioEntry>>({ data: new Date().toISOString().slice(0,10) });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filtroTipo) params.tipo = filtroTipo;
      const r = await api.get('/academico/diario', { params });
      setRegistros(r.data);
    } catch {}
    setLoading(false);
  }, [filtroTipo]);
  useEffect(() => { load(); }, [load]);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api.post('/academico/diario', form); setShowModal(false); setForm({ data: new Date().toISOString().slice(0,10) }); await load(); } catch {}
  };

  const deletar = async (id: string) => {
    if (!confirm('Excluir registro?')) return;
    try { await api.delete(`/academico/diario/${id}`); await load(); } catch {}
  };

  const corTipo: Record<string, string> = {
    'Avaliação':  'bg-blue-100 text-blue-700',
    'Presença':   'bg-green-100 text-green-700',
    'Incidente':  'bg-red-100 text-red-700',
    'Observação': 'bg-amber-100 text-amber-700',
    'Comunicado': 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-black uppercase tracking-tight text-slate-800">Diário Acadêmico</h2>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
            <option value="">Todos os tipos</option>
            {TIPOS_DIARIO.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase hover:bg-purple-700">
          <Plus size={14}/> Novo Registro
        </button>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-400">Carregando...</div>
        ) : registros.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">Nenhum registro encontrado.</div>
        ) : registros.map(r => (
          <div key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex gap-4 hover:shadow-md transition-shadow">
            <div className="shrink-0 flex flex-col items-center gap-1">
              <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${corTipo[r.tipo] || 'bg-slate-100 text-slate-600'}`}>{r.tipo}</span>
              <span className="text-[9px] text-slate-400 font-bold">{fmtDate(r.data)}</span>
            </div>
            <div className="flex-1 min-w-0">
              {r.titulo && <h4 className="font-black text-sm text-slate-800 leading-tight">{r.titulo}</h4>}
              {r.descricao && <p className="text-xs text-slate-600 mt-0.5">{r.descricao}</p>}
              {r.usuario_nome && <p className="text-[9px] text-slate-400 mt-1">Por: {r.usuario_nome}</p>}
            </div>
            <button onClick={() => deletar(r.id)} className="shrink-0 p-1.5 rounded-lg hover:bg-red-50 text-red-300 hover:text-red-500 transition-colors">
              <Trash2 size={13}/>
            </button>
          </div>
        ))}
      </div>

      {showModal && (
        <Modal title="Novo Registro no Diário" onClose={() => { setShowModal(false); setForm({ data: new Date().toISOString().slice(0,10) }); }}>
          <form onSubmit={salvar} className="space-y-3">
            <FieldSelect label="Tipo" value={form.tipo ?? ''} onChange={v => setForm(p => ({ ...p, tipo: v }))} options={TIPOS_DIARIO} required />
            <FieldInput label="Data" type="date" value={form.data} onChange={v => setForm(p => ({ ...p, data: v }))} required />
            <FieldInput label="Título (opcional)" value={form.titulo} onChange={v => setForm(p => ({ ...p, titulo: v }))} />
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500">Descrição</label>
              <textarea value={form.descricao ?? ''} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} rows={3}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none" />
            </div>
            {alunos.length > 0 && (
              <FieldSelect label="Aluno (opcional)" value={form.aluno_id ?? ''} onChange={v => setForm(p => ({ ...p, aluno_id: v }))}
                options={alunos.map(a => ({ value: a.id, label: a.nome_completo }))} />
            )}
            {turmas.length > 0 && (
              <FieldSelect label="Turma (opcional)" value={form.turma_id ?? ''} onChange={v => setForm(p => ({ ...p, turma_id: v }))}
                options={turmas.map(t => ({ value: t.id, label: t.nome }))} />
            )}
            <button type="submit" className="w-full bg-purple-600 text-white py-2.5 rounded-xl font-black text-xs uppercase">Salvar Registro</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Tab: Presença ───────────────────────────────────────────────────────────

function PresencaTab({ turmas, podeEditar }: { turmas: Turma[]; podeEditar: boolean }) {
  // ─── Filtros do histórico ───────────────────────────────────────────────
  const [filtroTurma, setFiltroTurma] = useState('');
  const [filtroDataIni, setFiltroDataIni] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [sessoes, setSessoes] = useState<PresencaSessao[]>([]);
  const [carregandoHist, setCarregandoHist] = useState(false);
  const [sessaoExpandida, setSessaoExpandida] = useState<string | null>(null);
  const [detalhesSessao, setDetalhesSessao] = useState<Record<string, any[]>>({});

  // ─── Modal nova lista ────────────────────────────────────────────────────
  const [etapa, setEtapa] = useState<1 | 2>(1);
  const [showModal, setShowModal] = useState(false);
  const [formSessao, setFormSessao] = useState<{
    turma_id: string; data: string; tema_aula: string; conteudo_abordado: string;
  }>({ turma_id: '', data: new Date().toISOString().slice(0, 10), tema_aula: '', conteudo_abordado: '' });
  const [alunosSessao, setAlunosSessao] = useState<Aluno[]>([]);
  const [presenca, setPresenca] = useState<Record<string, boolean>>({});
  const [carregandoAlunos, setCarregandoAlunos] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);

  const carregarHistorico = useCallback(async () => {
    setCarregandoHist(true);
    try {
      const params: any = {};
      if (filtroTurma)   params.turma_id  = filtroTurma;
      if (filtroDataIni) params.data_ini  = filtroDataIni;
      if (filtroDataFim) params.data_fim  = filtroDataFim;
      const r = await api.get('/academico/presenca/sessoes', { params });
      setSessoes(r.data);
    } catch { /* silencioso */ }
    setCarregandoHist(false);
  }, [filtroTurma, filtroDataIni, filtroDataFim]);

  useEffect(() => { carregarHistorico(); }, [carregarHistorico]);

  const toggleDetalhes = async (sessaoId: string) => {
    if (sessaoExpandida === sessaoId) { setSessaoExpandida(null); return; }
    setSessaoExpandida(sessaoId);
    if (!detalhesSessao[sessaoId]) {
      try {
        const r = await api.get(`/academico/presenca/sessoes/${sessaoId}/registros`);
        setDetalhesSessao(p => ({ ...p, [sessaoId]: r.data }));
      } catch { setDetalhesSessao(p => ({ ...p, [sessaoId]: [] })); }
    }
  };

  const abrirNovaLista = () => {
    setFormSessao({ turma_id: '', data: new Date().toISOString().slice(0, 10), tema_aula: '', conteudo_abordado: '' });
    setAlunosSessao([]); setPresenca({}); setErroModal(null); setEtapa(1);
    setShowModal(true);
  };

  const avancarParaChamada = async () => {
    setErroModal(null);
    if (!formSessao.turma_id) { setErroModal('Selecione uma turma.'); return; }
    if (!formSessao.data) { setErroModal('Informe a data da aula.'); return; }
    if (!formSessao.tema_aula.trim()) { setErroModal('Informe o tema da aula.'); return; }
    setCarregandoAlunos(true);
    try {
      const r = await api.get('/academico/alunos', { params: { turma_id: formSessao.turma_id } });
      if (!r.data.length) { setErroModal('Nenhum aluno ativo nesta turma.'); setCarregandoAlunos(false); return; }
      setAlunosSessao(r.data);
      const init: Record<string, boolean> = {};
      r.data.forEach((a: Aluno) => { init[a.id] = true; });
      setPresenca(init);
      setEtapa(2);
    } catch { setErroModal('Erro ao carregar alunos da turma.'); }
    setCarregandoAlunos(false);
  };

  const salvarLista = async () => {
    setSalvando(true); setErroModal(null);
    try {
      await api.post('/academico/presenca/sessoes', {
        turma_id:          formSessao.turma_id,
        data:              formSessao.data,
        tema_aula:         formSessao.tema_aula,
        conteudo_abordado: formSessao.conteudo_abordado,
        registros: alunosSessao.map(a => ({ aluno_id: a.id, presente: presenca[a.id] ?? true })),
      });
      setShowModal(false);
      carregarHistorico();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Erro ao salvar.';
      setErroModal(Array.isArray(msg) ? msg.join(', ') : msg);
    }
    setSalvando(false);
  };

  const presentes = alunosSessao.filter(a => presenca[a.id]).length;
  const ausentes  = alunosSessao.length - presentes;

  const fmtData = (v: string) => {
    if (!v) return '–';
    const [y, m, d] = v.split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="space-y-4">
      {/* ─── Cabeçalho ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
        <div className="flex-1 min-w-[180px]">
          <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Turma</label>
          <select value={filtroTurma} onChange={e => setFiltroTurma(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
            <option value="">Todas as turmas</option>
            {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
        <div className="min-w-[140px]">
          <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Data Início</label>
          <input type="date" value={filtroDataIni} onChange={e => setFiltroDataIni(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400" />
        </div>
        <div className="min-w-[140px]">
          <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Data Fim</label>
          <input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400" />
        </div>
        <button onClick={carregarHistorico} disabled={carregandoHist}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-black uppercase disabled:opacity-50 transition-colors">
          <RefreshCw size={12} className={carregandoHist ? 'animate-spin' : ''} /> Atualizar
        </button>
        {podeEditar && (
          <button onClick={abrirNovaLista}
            className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2 rounded-xl font-black text-[10px] uppercase hover:bg-purple-700 transition-colors">
            <ClipboardCheck size={13}/> Nova Lista de Presença
          </button>
        )}
      </div>

      {/* ─── Histórico de Aulas ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Histórico de Aulas Registradas</h2>
          <span className="text-[9px] font-black text-slate-400">{sessoes.length} registro{sessoes.length !== 1 ? 's' : ''}</span>
        </div>

        {carregandoHist ? (
          <div className="py-12 text-center text-sm text-slate-400">Carregando...</div>
        ) : sessoes.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardCheck size={40} className="mx-auto mb-3 text-slate-200" />
            <p className="text-sm text-slate-400 font-bold">Nenhuma aula registrada ainda.</p>
            {podeEditar && <p className="text-xs text-slate-300 mt-1">Clique em &quot;Nova Lista de Presença&quot; para começar.</p>}
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {sessoes.map(s => (
              <div key={s.id}>
                <div className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-purple-50/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-slate-800">{fmtData(s.data)}</span>
                      <span className="text-[9px] font-black bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full uppercase">{s.turma_nome || '–'}</span>
                    </div>
                    {s.tema_aula && (
                      <p className="text-[11px] font-bold text-slate-600 mt-0.5 flex items-center gap-1">
                        <FileText size={10} className="text-purple-400 shrink-0" />
                        {s.tema_aula}
                      </p>
                    )}
                    {s.conteudo_abordado && (
                      <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{s.conteudo_abordado}</p>
                    )}
                    {s.usuario_nome && (
                      <p className="text-[9px] text-slate-400 mt-0.5">Registrado por: {s.usuario_nome}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="bg-green-100 text-green-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">{s.total_presentes} pres.</span>
                    <span className="bg-red-100 text-red-600 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">{s.total_ausentes} aus.</span>
                    <button onClick={() => toggleDetalhes(s.id)}
                      className="flex items-center gap-1 text-[9px] font-black uppercase text-slate-500 hover:text-purple-600 border border-slate-200 hover:border-purple-300 px-2.5 py-1 rounded-lg transition-colors">
                      <Eye size={10}/> {sessaoExpandida === s.id ? 'Fechar' : 'Ver Chamada'}
                      {sessaoExpandida === s.id ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}
                    </button>
                  </div>
                </div>
                {sessaoExpandida === s.id && (
                  <div className="bg-slate-50/60 border-t border-slate-100 px-6 py-3">
                    {s.conteudo_abordado && (
                      <div className="mb-3 bg-purple-50 border border-purple-100 rounded-xl p-3">
                        <p className="text-[9px] font-black uppercase text-purple-500 mb-1">Conteúdo Abordado</p>
                        <p className="text-xs text-slate-700">{s.conteudo_abordado}</p>
                      </div>
                    )}
                    {!detalhesSessao[s.id] ? (
                      <p className="text-xs text-slate-400">Carregando...</p>
                    ) : detalhesSessao[s.id].length === 0 ? (
                      <p className="text-xs text-slate-400">Nenhum registro encontrado.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                        {detalhesSessao[s.id].map((r: any) => (
                          <div key={r.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${
                            r.descricao === 'Presente' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                          }`}>
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

      {/* ─── Modal Nova Lista de Presença ───────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center p-5 border-b shrink-0">
              <div>
                <h3 className="font-black text-sm uppercase tracking-tight text-slate-800">Nova Lista de Presença</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase mt-0.5">
                  Etapa {etapa} de 2 — {etapa === 1 ? 'Dados da Aula' : 'Chamada dos Alunos'}
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400"><X size={16}/></button>
            </div>

            {/* Indicador de etapas */}
            <div className="flex px-5 pt-4 gap-2 shrink-0">
              {[1, 2].map(n => (
                <div key={n} className={`flex-1 h-1.5 rounded-full transition-colors ${etapa >= n ? 'bg-purple-600' : 'bg-slate-200'}`} />
              ))}
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {erroModal && (
                <div className="mb-3 bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold rounded-xl px-4 py-2.5 uppercase tracking-wide">
                  ⚠ {erroModal}
                </div>
              )}

              {/* ─── Etapa 1: Dados da Aula ──────────────────────────────── */}
              {etapa === 1 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-500">Turma *</label>
                      <select value={formSessao.turma_id} onChange={e => setFormSessao(p => ({ ...p, turma_id: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                        <option value="">Selecione...</option>
                        {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}{t.turno ? ` (${t.turno})` : ''}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-500">Data da Aula *</label>
                      <input type="date" value={formSessao.data} onChange={e => setFormSessao(p => ({ ...p, data: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500">Tema da Aula *</label>
                    <input type="text" value={formSessao.tema_aula}
                      onChange={e => setFormSessao(p => ({ ...p, tema_aula: e.target.value }))}
                      placeholder="Ex: Introdução à Programação, Matemática Básica..."
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500">Conteúdo Abordado</label>
                    <textarea value={formSessao.conteudo_abordado}
                      onChange={e => setFormSessao(p => ({ ...p, conteudo_abordado: e.target.value }))}
                      placeholder="Descreva os tópicos, atividades e exercícios realizados na aula..."
                      rows={4}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none" />
                  </div>
                  <button onClick={avancarParaChamada} disabled={carregandoAlunos}
                    className="w-full bg-purple-600 text-white py-2.5 rounded-xl font-black text-xs uppercase hover:bg-purple-700 disabled:opacity-50">
                    {carregandoAlunos ? 'Carregando alunos...' : 'Iniciar Chamada →'}
                  </button>
                </div>
              )}

              {/* ─── Etapa 2: Chamada ────────────────────────────────────── */}
              {etapa === 2 && (
                <div className="space-y-3">
                  {/* Resumo da sessão */}
                  <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3 text-xs space-y-0.5">
                    <p className="font-black text-purple-700 uppercase text-[10px]">{turmas.find(t => t.id === formSessao.turma_id)?.nome} · {fmtData(formSessao.data)}</p>
                    <p className="text-slate-600"><span className="font-black">Tema:</span> {formSessao.tema_aula}</p>
                  </div>

                  {/* Controles */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <span className="bg-green-100 text-green-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">{presentes} pres.</span>
                      <span className="bg-red-100 text-red-600 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">{ausentes} aus.</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setPresenca(Object.fromEntries(alunosSessao.map(a => [a.id, true])))}
                        className="flex items-center gap-1 text-[9px] font-black uppercase text-green-600 border border-green-200 px-2.5 py-1 rounded-lg hover:bg-green-50">
                        <CheckSquare size={10}/> Todos Presentes
                      </button>
                      <button onClick={() => setPresenca(Object.fromEntries(alunosSessao.map(a => [a.id, false])))}
                        className="flex items-center gap-1 text-[9px] font-black uppercase text-red-500 border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-50">
                        <Square size={10}/> Todos Ausentes
                      </button>
                    </div>
                  </div>

                  {/* Lista de alunos */}
                  <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-50">
                    {alunosSessao.map((a, i) => (
                      <button key={a.id} type="button"
                        onClick={() => setPresenca(p => ({ ...p, [a.id]: !p[a.id] }))}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-purple-50/40 transition-colors text-left ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                        <div className={`shrink-0 w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${
                          presenca[a.id] ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-slate-300'
                        }`}>
                          {presenca[a.id] && <CheckSquare size={13}/>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{a.nome_completo}</p>
                          <p className="text-[9px] text-slate-400">{a.numero_matricula || '–'}</p>
                        </div>
                        <span className={`shrink-0 text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          presenca[a.id] ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                        }`}>
                          {presenca[a.id] ? 'Presente' : 'Ausente'}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setEtapa(1)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-black text-xs uppercase hover:bg-slate-50">
                      ← Voltar
                    </button>
                    <button onClick={salvarLista} disabled={salvando}
                      className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl font-black text-xs uppercase hover:bg-purple-700 disabled:opacity-50">
                      {salvando ? 'Salvando...' : 'Confirmar Presença'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AcademicoPage() {
  const [activeTab, setActiveTab] = useState('grade');
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  const podeEditar = GRUPOS_EDITOR.map(g => g.toLowerCase()).includes((user?.role ?? '').toLowerCase());

  const loadBase = useCallback(async () => {
    setRefreshing(true);
    try {
      const [rc, rp, rt, ra] = await Promise.all([
        api.get('/academico/cursos'),
        api.get('/academico/professores'),
        api.get('/academico/turmas'),
        api.get('/academico/alunos'),
      ]);
      setCursos(rc.data);
      setProfessores(rp.data);
      setTurmas(rt.data);
      setAlunos(ra.data);
    } catch {}
    setRefreshing(false);
  }, []);

  useEffect(() => {
    setIsMounted(true);
    loadBase();
  }, [loadBase]);

  if (!isMounted) return null;

  const TABS = [
    { id: 'grade',    label: 'Grade',    Icon: LayoutGrid },
    { id: 'alunos',   label: 'Alunos',   Icon: Users },
    { id: 'presenca', label: 'Presença', Icon: ClipboardCheck },
    { id: 'cursos',   label: 'Cursos',   Icon: BookOpen },
    { id: 'turmas',   label: 'Turmas',   Icon: ClipboardList },
    { id: 'diario',   label: 'Diário',   Icon: History },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#131b2e] p-4 md:p-6 lg:p-8 font-sans antialiased text-slate-900 dark:text-slate-100">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <header className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-purple-600 p-3 rounded-2xl shadow-lg">
              <GraduationCap className="text-white" size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter italic text-slate-900 dark:text-white">
                Acadêmico<span className="text-purple-400">.ITP</span>
              </h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                Gestão Educacional e Grade Curricular
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadBase}
              disabled={refreshing}
              title="Atualizar dados"
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-slate-500 dark:text-slate-300 hover:text-purple-600 transition-all disabled:opacity-60"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <nav className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-1 overflow-x-auto">
              {TABS.map(t => <TabBtn key={t.id} id={t.id} active={activeTab} set={setActiveTab} label={t.label} Icon={t.Icon} />)}
            </nav>
          </div>
        </header>
        <main>
          {activeTab === 'grade'    && <GradeTab podeEditar={podeEditar} turmas={turmas} />}
          {activeTab === 'alunos'   && <AlunosTab cursos={cursos} turmas={turmas} />}
          {activeTab === 'presenca' && <PresencaTab turmas={turmas} podeEditar={podeEditar} />}
          {activeTab === 'cursos'   && <CursosTab />}
          {activeTab === 'turmas'   && <TurmasTab cursos={cursos} professores={professores} alunos={alunos} />}
          {activeTab === 'diario'   && <DiarioTab turmas={turmas} alunos={alunos} />}
        </main>
      </div>
    </div>
  );
}


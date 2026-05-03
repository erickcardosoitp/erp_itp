'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import DossieCandidato from '@/components/DossieCandidato';
import {
  GraduationCap, Users, BookOpen, LayoutGrid, History,
  Plus, Trash2, Search, X, ClipboardList, AlertCircle,
  Edit3, Coffee, UserPlus, RefreshCw, ClipboardCheck, CheckSquare, Square,
  ChevronDown, ChevronUp, FileText, Eye, Smartphone, Copy, Check, Save,
  Clock, User, Calendar, MapPin, Mail, Shield, ShieldCheck, AlertTriangle,
  Heart, Phone, BadgeCheck, Activity, TrendingDown, TrendingUp, Star, Zap,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts';
import api from '@/services/api';
import { useAuth } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Curso { id: string; nome: string; sigla: string; status: string; periodo?: string; }
interface Professor { id: string; nome: string; especialidade?: string; email?: string; ativo?: boolean; }
interface Turma { id: string; nome: string; curso_id?: string; professor_id?: string; turno?: string; ano?: string; max_alunos?: number; ativo?: boolean; cor?: string; total_alunos?: number; }
interface TurmaAlunoRecord { id: string; turma_id: string | null; aluno_id: string; status: string; created_at: string; }
interface GradeCard { id: string; dia_semana: number; horario_inicio: string; horario_fim: string; nome_turma?: string; nome_curso?: string; nome_professor?: string; turma_id?: string; sala?: string; cor?: string; }
interface DiarioEntry { id: string; tipo: string; titulo?: string; descricao?: string; aluno_id?: string; aluno_nome?: string; turma_id?: string; data: string; usuario_nome?: string; created_at: string; }
interface TurmaAluno { id: string; nome: string; cor?: string; status: string; }
interface Aluno {
  id: string; nome_completo: string; numero_matricula?: string; cpf?: string; celular?: string; email?: string;
  sexo?: string; data_nascimento?: string; idade?: number; escolaridade?: string; turno_escolar?: string;
  cidade?: string; bairro?: string; logradouro?: string; numero?: string; complemento?: string; estado_uf?: string; cep?: string;
  cursos_matriculados?: string; ativo?: boolean; data_matricula?: string; lgpd_aceito?: boolean; autoriza_imagem?: boolean;
  maior_18_anos?: boolean; nome_responsavel?: string; email_responsavel?: string; grau_parentesco?: string; cpf_responsavel?: string; telefone_alternativo?: string;
  possui_alergias?: string; cuidado_especial?: string; detalhes_cuidado?: string; uso_medicamento?: string;
  turmas?: TurmaAluno[]; foto_url?: string | null;
  turma_nome?: string | null; turma_status?: string;
}
interface PresencaSessao { id: string; turma_id: string; turma_nome?: string; data: string; tema_aula?: string; conteudo_abordado?: string; usuario_nome?: string; total_presentes: number; total_ausentes: number; created_at: string; }

// ─── Constantes ───────────────────────────────────────────────────────────────

const DIAS_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];

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

// Permissão de edição controlada via usePermissions (grupo_permissoes ou role level)

const CORES_CARD = [
  '#7c3aed', '#6d28d9', '#4f46e5', '#0284c7',
  '#0891b2', '#0d9488', '#059669', '#16a34a',
  '#65a30d', '#d97706', '#ea580c', '#dc2626',
  '#db2777', '#9333ea', '#475569', '#1e293b',
];

const TIPOS_DIARIO = ['Avaliação', 'Lista de Chamada', 'Incidente', 'Observação', 'Comunicado'];

const OPCOES_CUIDADO_ESPECIAL = [
  'Não',
  'PCD – Pessoa com Deficiência',
  'Transtorno do Espectro Autista (TEA)',
  'TDAH – Déficit de Atenção e Hiperatividade',
  'Deficiência Visual',
  'Deficiência Auditiva',
  'Deficiência Física / Motora',
  'Deficiência Intelectual',
  'Altas Habilidades / Superdotação',
  'Outro',
];

const CUIDADO_BADGE: Record<string, { label: string; color: string }> = {
  'PCD – Pessoa com Deficiência':               { label: 'PCD',        color: 'bg-blue-100 text-blue-700 border-blue-200' },
  'Transtorno do Espectro Autista (TEA)':        { label: 'TEA',        color: 'bg-purple-100 text-purple-700 border-purple-200' },
  'TDAH – Déficit de Atenção e Hiperatividade':  { label: 'TDAH',       color: 'bg-orange-100 text-orange-700 border-orange-200' },
  'Deficiência Visual':                          { label: 'Def. Visual',    color: 'bg-slate-100 text-slate-700 border-slate-200' },
  'Deficiência Auditiva':                        { label: 'Def. Auditiva',  color: 'bg-slate-100 text-slate-700 border-slate-200' },
  'Deficiência Física / Motora':                 { label: 'Def. Física',    color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  'Deficiência Intelectual':                     { label: 'Def. Intelectual', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  'Altas Habilidades / Superdotação':            { label: 'Superdotação', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  'Outro':                                       { label: 'Cuidado Espec.', color: 'bg-pink-100 text-pink-700 border-pink-200' },
};

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
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-5 border-b shrink-0">
          <h3 className="font-black text-sm uppercase tracking-tight text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400"><X size={16}/></button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
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

// ─── KpiCard (Grade) ──────────────────────────────────────────────────────────

const KPI_GRADE_COLORS: Record<string, { accent: string; bg: string; text: string; sub: string; dot: string }> = {
  purple: { accent: 'bg-purple-500', bg: 'bg-white', text: 'text-slate-800',  sub: 'text-slate-400', dot: 'bg-purple-500' },
  blue:   { accent: 'bg-blue-500',   bg: 'bg-white', text: 'text-slate-800',  sub: 'text-slate-400', dot: 'bg-blue-500'   },
  green:  { accent: 'bg-emerald-500',bg: 'bg-white', text: 'text-slate-800',  sub: 'text-slate-400', dot: 'bg-emerald-500'},
  amber:  { accent: 'bg-amber-400',  bg: 'bg-white', text: 'text-slate-800',  sub: 'text-slate-400', dot: 'bg-amber-400'  },
  red:    { accent: 'bg-red-500',    bg: 'bg-white', text: 'text-slate-800',  sub: 'text-slate-400', dot: 'bg-red-500'    },
};

function KpiGrade({ label, value, sub, color, isText }: {
  label: string; value: number | string; sub: string; color: string; isText?: boolean;
}) {
  const c = KPI_GRADE_COLORS[color] ?? KPI_GRADE_COLORS.purple;
  return (
    <div className={`${c.bg} border border-slate-100 rounded-2xl p-4 flex flex-col gap-1.5 min-w-0 overflow-hidden relative shadow-sm`}>
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${c.accent} rounded-l-2xl`} />
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 pl-2">{label}</span>
      <span className={`font-black ${c.text} leading-none truncate pl-2 ${isText ? 'text-base' : 'text-[2rem]'}`}>{value}</span>
      <span className="text-[10px] font-medium text-slate-400 truncate pl-2 flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />{sub}
      </span>
    </div>
  );
}

// ─── Tab: Grade ───────────────────────────────────────────────────────────────

const GRADE_ROW_H  = 56;
const GRADE_HEAD_H = 56;

function timeToMinsGrade(t: string) {
  const [h, m] = (t || '00:00').split(':').map(Number);
  return h * 60 + m;
}

/** Agrupa cards sobrepostos e retorna col/cols para posicionamento lado a lado. */
function computeCardLayout(cards: GradeCard[]): Map<string, { col: number; cols: number }> {
  const result = new Map<string, { col: number; cols: number }>();
  if (!cards.length) return result;

  const sorted = [...cards]
    .filter(c => c.horario_inicio)
    .sort((a, b) => timeToMinsGrade(a.horario_inicio) - timeToMinsGrade(b.horario_inicio));

  // Agrupa em clusters: cards que se sobrepõem com qualquer card do cluster
  const clusters: { cards: GradeCard[]; maxEnd: number }[] = [];
  for (const card of sorted) {
    const start = timeToMinsGrade(card.horario_inicio);
    const end   = card.horario_fim ? timeToMinsGrade(card.horario_fim) : start + 60;
    const cluster = [...clusters].reverse().find(c => c.maxEnd > start);
    if (cluster) { cluster.cards.push(card); cluster.maxEnd = Math.max(cluster.maxEnd, end); }
    else clusters.push({ cards: [card], maxEnd: end });
  }

  // Distribui colunas dentro de cada cluster (greedy)
  for (const { cards: cc } of clusters) {
    const colEnds: number[] = [];
    for (const card of cc) {
      const start = timeToMinsGrade(card.horario_inicio);
      const end   = card.horario_fim ? timeToMinsGrade(card.horario_fim) : start + 60;
      let col = colEnds.findIndex(e => e <= start);
      if (col === -1) col = colEnds.length;
      colEnds[col] = end;
      result.set(card.id, { col, cols: cc.length });
    }
  }
  return result;
}

/**
 * Converte um horário (HH:MM ou HH:MM:SS) em pixels Y dentro da grade.
 * Interpola para horários que não estejam exatamente no array HORARIOS.
 */
function timeToPixelGrade(t: string): number {
  const targetMins = timeToMinsGrade((t || '').slice(0, 5));
  const knownSlots = HORARIOS
    .map((h, idx) => h.value ? { mins: timeToMinsGrade(h.value), idx } : null)
    .filter(Boolean) as { mins: number; idx: number }[];

  const exact = knownSlots.find(s => s.mins === targetMins);
  if (exact) return exact.idx * GRADE_ROW_H;

  const prev = [...knownSlots].reverse().find(s => s.mins < targetMins);
  const next = knownSlots.find(s => s.mins > targetMins);

  if (!prev) return 0;
  if (!next) return (prev.idx + 1) * GRADE_ROW_H;

  const frac = (targetMins - prev.mins) / (next.mins - prev.mins);
  return (prev.idx + frac * (next.idx - prev.idx)) * GRADE_ROW_H;
}

function GradeTab({ podeEditar, turmas }: { podeEditar: boolean; turmas: Turma[] }) {
  const [grade, setGrade] = useState<GradeCard[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [dragCard, setDragCard] = useState<GradeCard | null>(null);
  const [form, setForm] = useState<Partial<GradeCard>>({ cor: '#7c3aed' });
  const [erroGrade, setErroGrade] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/academico/grade');
      setGrade(r.data);
      setErroGrade(null);
    } catch (e: any) {
      setErroGrade(e?.response?.data?.message || e?.message || 'Erro ao carregar grade horária.');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // ── Tempo atual ────────────────────────────────────────────────────────────
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const jsDow = now.getDay(); // 0=Dom … 6=Sáb
  const todayDia = jsDow >= 1 && jsDow <= 6 ? jsDow : 0;

  const slotsComValor = HORARIOS.filter(h => h.value);
  let currentRowIdx = -1;
  let slotFraction = 0;
  for (let i = 0; i < slotsComValor.length; i++) {
    const start = timeToMinsGrade(slotsComValor[i].value!);
    const end = i + 1 < slotsComValor.length ? timeToMinsGrade(slotsComValor[i + 1].value!) : start + 30;
    if (currentMins >= start && currentMins < end) {
      currentRowIdx = HORARIOS.findIndex(h => h.value === slotsComValor[i].value);
      slotFraction = (currentMins - start) / (end - start);
      break;
    }
  }
  const lineTop = currentRowIdx >= 0 ? GRADE_HEAD_H + currentRowIdx * GRADE_ROW_H + slotFraction * GRADE_ROW_H : -1;

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const professoresArr = [...new Set(grade.map(g => g.nome_professor).filter(Boolean) as string[])];
  const aulasHoje = grade.filter(g => g.dia_semana === todayDia);
  const aulaAgora = grade.filter(g =>
    g.dia_semana === todayDia && g.horario_inicio && g.horario_fim &&
    timeToMinsGrade(g.horario_inicio) <= currentMins &&
    timeToMinsGrade(g.horario_fim) > currentMins
  );
  const proxAula = grade
    .filter(g => g.dia_semana === todayDia && g.horario_inicio && timeToMinsGrade(g.horario_inicio) > currentMins)
    .sort((a, b) => timeToMinsGrade(a.horario_inicio!) - timeToMinsGrade(b.horario_inicio!))[0];

  const profSubtext = professoresArr.length
    ? professoresArr.slice(0, 2).join(', ') + (professoresArr.length > 2 ? ` +${professoresArr.length - 2}` : '')
    : 'nenhum cadastrado';

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
    <div className="space-y-5">

      {/* ── Erro de carregamento ─────────────────────────────────────────── */}
      {erroGrade && grade.length === 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-2xl px-4 py-3 flex items-center gap-2">
          <X size={14} className="shrink-0"/> Erro ao carregar grade: {erroGrade}
        </div>
      )}

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiGrade label="Aulas na Semana" value={grade.length} sub="horários cadastrados" color="purple" />
        <KpiGrade label="Professores" value={professoresArr.length} sub={profSubtext} color="blue" />
        <KpiGrade label="Aulas Hoje" value={aulasHoje.length} sub={todayDia >= 1 ? DIAS_SEMANA[todayDia - 1] : 'Sem aula hoje'} color="green" />
        <KpiGrade
          label={aulaAgora.length ? 'Em Aula Agora' : 'Próxima Aula'}
          value={aulaAgora.length ? (aulaAgora[0].nome_turma || '–') : (proxAula?.nome_turma ?? '–')}
          sub={aulaAgora.length ? (aulaAgora[0].nome_professor || aulaAgora[0].horario_inicio?.slice(0,5) || '') : proxAula ? proxAula.horario_inicio?.slice(0,5) ?? '' : 'Nenhuma hoje'}
          color={aulaAgora.length ? 'red' : 'amber'} isText
        />
      </div>

      {/* ── Cabeçalho da seção ────────────────────────────────────────────── */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-black text-slate-800 tracking-tight">Grade Horária Semanal</h2>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">
            {grade.length === 0 ? 'Nenhum horário cadastrado ainda' : `${grade.length} aula${grade.length !== 1 ? 's' : ''} distribuídas na semana`}
          </p>
        </div>
        {podeEditar && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase hover:bg-purple-700 active:scale-95 transition-all shadow-sm shadow-purple-200">
            <Plus size={14}/> Adicionar Horário
          </button>
        )}
      </div>

      {/* ── Grade principal ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[820px] relative">

            {/* Indicador de hora atual */}
            {lineTop >= 0 && todayDia >= 1 && (
              <div className="absolute left-0 right-0 z-20 pointer-events-none"
                style={{ top: `${lineTop}px` }}>
                <div className="flex items-center">
                  <div className="flex items-center justify-end pr-2" style={{ width: 68, flexShrink: 0 }}>
                    <span className="text-[9px] font-black text-red-500 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full leading-none whitespace-nowrap">
                      {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-red-500 ring-4 ring-red-100 shrink-0 -ml-1 z-10" />
                  <div className="flex-1 h-px bg-red-400" style={{ backgroundImage: 'repeating-linear-gradient(90deg,#f87171 0,#f87171 6px,transparent 6px,transparent 12px)' }} />
                </div>
              </div>
            )}

            <div className="flex">
              {/* Coluna de horários */}
              <div style={{ width: 68, flexShrink: 0 }} className="border-r border-slate-100">
                <div style={{ height: GRADE_HEAD_H }}
                  className="border-b border-slate-100 flex items-center justify-center bg-slate-50">
                  <Clock size={12} className="text-slate-300" />
                </div>
                {HORARIOS.map((h, idx) => {
                  const isCurrentRow = idx === currentRowIdx && todayDia >= 1;
                  return (
                    <div key={idx}
                      style={{ height: GRADE_ROW_H }}
                      className={`border-b border-slate-100 flex items-center justify-end pr-3 transition-colors
                        ${h.lanche ? 'bg-amber-50/70' : isCurrentRow ? 'bg-red-50/40' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                      {h.lanche
                        ? <Coffee size={11} className="text-amber-300" />
                        : <span className={`text-[10px] tabular-nums font-semibold ${isCurrentRow ? 'text-red-500 font-black' : 'text-slate-300'}`}>{h.label}</span>}
                    </div>
                  );
                })}
              </div>

              {/* Colunas dos dias */}
              {DIAS_SEMANA.map((d, di) => {
                const diaNum = di + 1;
                const isToday = diaNum === todayDia;
                const cardsForDay = grade.filter(g => g.dia_semana === diaNum);
                const totalBodyH = HORARIOS.length * GRADE_ROW_H;

                return (
                  <div key={d} className="flex-1 border-r border-slate-100 last:border-0 flex flex-col min-w-0">
                    {/* Cabeçalho do dia */}
                    <div style={{ height: GRADE_HEAD_H }}
                      className={`border-b flex flex-col items-center justify-center shrink-0 gap-0.5 transition-colors
                        ${isToday
                          ? 'bg-gradient-to-b from-purple-600 to-purple-700 border-purple-700'
                          : 'bg-slate-50 border-slate-100'}`}>
                      <span className={`text-[11px] font-black uppercase tracking-widest ${isToday ? 'text-white' : 'text-slate-500'}`}>{d.slice(0,3)}</span>
                      {isToday
                        ? <span className="text-[8px] font-black text-purple-200 uppercase tracking-wider">Hoje</span>
                        : cardsForDay.length > 0
                          ? <span className="text-[8px] font-semibold text-slate-400">{cardsForDay.length} aula{cardsForDay.length > 1 ? 's' : ''}</span>
                          : <span className="text-[8px] text-slate-200">—</span>}
                    </div>

                    {/* Corpo com drop zones e cards */}
                    <div className="relative" style={{ height: totalBodyH }}>
                      {HORARIOS.map((h, idx) => (
                        <div key={idx}
                          style={{ position: 'absolute', top: idx * GRADE_ROW_H, height: GRADE_ROW_H, left: 0, right: 0 }}
                          className={`border-b border-slate-100/70 transition-colors group/slot
                            ${h.lanche ? 'bg-amber-50/50' : isToday ? (idx % 2 === 0 ? 'bg-purple-50/20' : 'bg-purple-50/10') : (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30')}
                            ${podeEditar && !h.lanche ? 'hover:bg-purple-50/40' : ''}`}
                          onDragOver={e => { if (podeEditar && !h.lanche) e.preventDefault(); }}
                          onDrop={e => { if (!h.lanche && h.value) handleDrop(e, diaNum, h.value); }}
                        />
                      ))}

                      {(() => {
                        const validCards = cardsForDay.filter(c => c.horario_inicio);
                        const layout = computeCardLayout(validCards);
                        return validCards.map(card => {
                          const topY  = timeToPixelGrade(card.horario_inicio!);
                          const endY  = card.horario_fim ? timeToPixelGrade(card.horario_fim) : topY + GRADE_ROW_H;
                          const top   = topY + 3;
                          const height = Math.max(endY - topY, GRADE_ROW_H - 6) - 6;
                          const isDragging = dragCard?.id === card.id;
                          const { col, cols } = layout.get(card.id) ?? { col: 0, cols: 1 };
                          const GAP = 3;
                          const colW = `calc(${100 / cols}% - ${GAP * (1 + 1 / cols)}px)`;
                          const leftPx = `calc(${(col / cols) * 100}% + ${GAP}px)`;
                          return (
                            <div key={card.id}
                              draggable={podeEditar}
                              onDragStart={() => setDragCard(card)}
                              onDragEnd={() => setDragCard(null)}
                              title={`${card.nome_turma || card.nome_curso || ''}${card.nome_professor ? ' · ' + card.nome_professor : ''}${card.sala ? ' · Sala ' + card.sala : ''}`}
                              className={`absolute rounded-xl text-white z-10 group/card overflow-hidden transition-all duration-150
                                ${isDragging ? 'opacity-40 scale-95' : 'hover:z-50 hover:shadow-xl hover:scale-[1.02] hover:-translate-y-0.5 shadow-md shadow-black/10'}`}
                              style={{
                                top, height,
                                left: leftPx,
                                width: colW,
                                backgroundColor: card.cor || '#7c3aed',
                                cursor: podeEditar ? 'grab' : 'default',
                                backgroundImage: `linear-gradient(160deg, color-mix(in srgb, ${card.cor || '#7c3aed'} 80%, white) 0%, ${card.cor || '#7c3aed'} 60%)`,
                              }}>
                              <div className="absolute inset-x-0 top-0 h-px bg-white/30" />
                              {podeEditar && (
                                <button onClick={() => handleDeletar(card.id)}
                                  className="absolute top-1 right-1 bg-black/20 hover:bg-black/40 rounded-full p-0.5 opacity-0 group-hover/card:opacity-100 transition-all z-20">
                                  <X size={8}/>
                                </button>
                              )}
                              <div className="p-1.5 h-full flex flex-col gap-0.5 overflow-hidden">
                                <div className={`font-black leading-tight drop-shadow-sm ${cols > 1 ? 'text-[9px] line-clamp-1' : 'text-[10px] line-clamp-2'}`}>
                                  {card.nome_turma || card.nome_curso || '–'}
                                </div>
                                <div className="text-[8px] font-semibold text-white/75 tabular-nums flex items-center gap-0.5 mt-0.5">
                                  <Clock size={6} className="shrink-0 opacity-70"/>
                                  {card.horario_inicio?.slice(0,5)}–{card.horario_fim?.slice(0,5)}
                                </div>
                                {card.nome_professor && (
                                  <div className={`text-white/80 truncate flex items-center gap-0.5 mt-0.5 ${cols > 1 ? 'text-[7px]' : 'text-[8px]'}`}>
                                    <User size={6} className="shrink-0 opacity-60"/>
                                    {card.nome_professor}
                                  </div>
                                )}
                                {card.sala && cols === 1 && height > 50 && (
                                  <div className="text-[8px] text-white/60 truncate flex items-center gap-0.5">
                                    <MapPin size={6} className="shrink-0 opacity-60"/>
                                    {card.sala}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Legenda de turmas ─────────────────────────────────────────────── */}
      {grade.length > 0 && (() => {
        const turmasNaGrade = [...new Map(
          grade.filter(g => g.turma_id && (g.nome_turma || g.nome_curso))
            .map(g => [g.turma_id, { id: g.turma_id!, nome: g.nome_turma || g.nome_curso!, cor: g.cor || '#7c3aed' }])
        ).values()];
        if (!turmasNaGrade.length) return null;
        return (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[9px] font-black uppercase text-slate-300 tracking-widest shrink-0">Turmas</span>
            {turmasNaGrade.map(t => (
              <div key={t.id} className="flex items-center gap-2 bg-white border border-slate-100 rounded-full px-3 py-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.cor }} />
                <span className="text-[10px] font-bold text-slate-600">{t.nome}</span>
              </div>
            ))}
          </div>
        );
      })()}

      {grade.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Calendar size={28} className="text-slate-300" />
          </div>
          <p className="text-slate-500 font-bold text-sm">Nenhum horário cadastrado</p>
          <p className="text-slate-400 text-xs mt-1">
            {podeEditar ? 'Clique em "Adicionar Horário" para montar a grade semanal.' : 'A grade ainda não foi configurada.'}
          </p>
        </div>
      )}

      {!podeEditar && grade.length > 0 && (
        <p className="text-[10px] text-center text-slate-300 font-medium">
          Visualização apenas — edição restrita a ADMIN / PRT / VP / DRT
        </p>
      )}

      {/* ── Modal: Adicionar Horário ──────────────────────────────────────── */}
      {showModal && (
        <Modal title="Adicionar Horário na Grade" onClose={() => { setShowModal(false); setForm({ cor: '#7c3aed' }); setErroGrade(null); }}>
          <form onSubmit={handleCriar} className="space-y-4">
            <FieldSelect label="Turma *" value={form.turma_id ?? ''}
              onChange={v => {
                const t = turmas.find(t => t.id === v);
                setForm(p => ({ ...p, turma_id: v, cor: t?.cor || p.cor || '#7c3aed' }));
              }}
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

            {/* Preview da duração */}
            {form.horario_inicio && form.horario_fim && (
              <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
                <Clock size={12} className="text-purple-400 shrink-0" />
                <span className="text-[11px] font-bold text-purple-700">
                  {form.horario_inicio} → {form.horario_fim}
                  {' · '}
                  {(() => {
                    const [h1, m1] = form.horario_inicio.split(':').map(Number);
                    const [h2, m2] = form.horario_fim.split(':').map(Number);
                    const mins = (h2*60+m2) - (h1*60+m1);
                    return mins > 0 ? `${mins} min` : '–';
                  })()}
                </span>
              </div>
            )}

            <FieldInput label="Sala (opcional)" value={form.sala} onChange={v => setForm(p => ({ ...p, sala: v }))} />

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 block">Cor do Card</label>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl border-2 border-slate-200 shadow-sm shrink-0 overflow-hidden">
                  <input type="color" value={form.cor || '#7c3aed'}
                    onChange={e => setForm(p => ({ ...p, cor: e.target.value }))}
                    className="w-14 h-14 -ml-2 -mt-2 cursor-pointer border-0" />
                </div>
                <div className="flex gap-1.5 flex-wrap flex-1">
                  {CORES_CARD.map(c => (
                    <button key={c} type="button" onClick={() => setForm(p => ({ ...p, cor: c }))}
                      className={`w-6 h-6 rounded-lg transition-all shadow-sm ${form.cor === c ? 'ring-2 ring-offset-2 ring-slate-700 scale-110' : 'hover:scale-110 hover:shadow-md'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>

            {/* Preview do card */}
            {form.turma_id && (
              <div className="rounded-xl p-3 text-white text-[11px] font-black shadow-sm"
                style={{ backgroundColor: form.cor || '#7c3aed' }}>
                {turmas.find(t => t.id === form.turma_id)?.nome || 'Turma'}
                {form.horario_inicio && <span className="font-semibold opacity-75 ml-2">{form.horario_inicio}–{form.horario_fim}</span>}
              </div>
            )}

            {erroGrade && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-[11px] font-bold rounded-xl px-4 py-3 flex items-center gap-2">
                <X size={12} className="shrink-0" /> {erroGrade}
              </div>
            )}

            <button type="submit"
              className="w-full bg-purple-600 text-white py-3 rounded-xl font-black text-xs uppercase hover:bg-purple-700 active:scale-[0.98] transition-all shadow-sm">
              Confirmar
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Tab: Alunos ──────────────────────────────────────────────────────────────

function calcularIdade(dataNasc: string): number {
  if (!dataNasc) return 99;
  const d = new Date(dataNasc.includes('T') ? dataNasc : dataNasc + 'T12:00:00');
  if (isNaN(d.getTime())) return 99;
  const hoje = new Date();
  let idade = hoje.getFullYear() - d.getFullYear();
  const m = hoje.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) idade--;
  return idade;
}

function KpisTurmas({ alunos, turmas }: { alunos: Aluno[]; turmas: Turma[] }) {
  const [open, setOpen] = useState(true);
  const [presencaMap, setPresencaMap] = useState<Record<string, number>>({});

  // Computa contagem de alunos por turma a partir dos dados já carregados
  const stats = useMemo(() => {
    const map: Record<string, { total: number; turma: Turma }> = {};
    for (const t of turmas) {
      if (t.ativo !== false) map[t.id] = { total: 0, turma: t };
    }
    for (const a of alunos) {
      if (!a.ativo) continue;
      for (const ta of (a.turmas || [])) {
        if (ta.status === 'ativo' && map[ta.id]) map[ta.id].total++;
      }
    }
    return Object.values(map).filter(s => s.total > 0).sort((a, b) => a.turma.nome.localeCompare(b.turma.nome));
  }, [alunos, turmas]);

  // Busca % presença do backend (opcional — não bloqueia renderização)
  useEffect(() => {
    api.get('/academico/alunos/kpis')
      .then(r => {
        if (!Array.isArray(r.data)) return;
        const m: Record<string, number> = {};
        r.data.forEach((k: any) => { if (k.presenca_pct !== null) m[k.turma_id] = k.presenca_pct; });
        setPresencaMap(m);
      })
      .catch(() => {});
  }, []);

  if (!stats.length) return null;

  const totalAlunos = stats.reduce((s, k) => s + k.total, 0);
  const maxAlunos   = Math.max(...stats.map(k => k.total), 1);
  const pcts        = Object.values(presencaMap);
  const mediaPresenca = pcts.length ? Math.round(pcts.reduce((s, v) => s + v, 0) / pcts.length) : null;

  return (
    <div className="mb-4">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:bg-slate-50 transition-colors mb-2">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Visão por Turma</span>
          <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-black">{stats.length} turmas · {totalAlunos} alunos</span>
          {mediaPresenca !== null && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${mediaPresenca >= 75 ? 'bg-green-50 text-green-700' : mediaPresenca >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'}`}>
              {mediaPresenca}% presença média
            </span>
          )}
        </div>
        <span className="text-slate-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {stats.map(({ total, turma }) => {
            const pct   = presencaMap[turma.id] ?? null;
            const cor   = turma.cor || '#6d28d9';
            const presColor = pct === null ? 'text-slate-400' : pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500';
            const barW  = Math.round(100 * total / maxAlunos);
            return (
              <div key={turma.id} className="bg-white border border-slate-100 rounded-2xl p-3 shadow-sm flex flex-col gap-2.5 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cor }} />
                  <span className="font-black text-slate-800 text-[10px] truncate leading-tight">{turma.nome}</span>
                </div>
                {turma.turno && <span className="text-[9px] text-slate-400 -mt-1">{turma.turno}</span>}

                {/* Barra de alunos relativa ao maior valor entre turmas */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] text-slate-400">Alunos</span>
                    <span className="text-[11px] font-black text-slate-700">{total}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${barW}%`, backgroundColor: cor }} />
                  </div>
                </div>

                {/* % presença (quando disponível) */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] text-slate-400">Presença 28d</span>
                    <span className={`text-[11px] font-black ${presColor}`}>{pct !== null ? `${pct}%` : '—'}</span>
                  </div>
                  {pct !== null && (
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pct >= 75 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444' }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AlunosTab({ cursos, turmas, podeEditar }: { cursos: Curso[]; turmas: Turma[]; podeEditar: boolean }) {
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
  const [fichaAluno, setFichaAluno] = useState<any>(null);
  const [fichaAba, setFichaAba] = useState<'dados' | 'presenca'>('dados');
  const [dossieCandidato, setDossieCandidato] = useState<any>(null);
  const [fichaErro, setFichaErro] = useState<string | null>(null);
  const [fichaLoading, setFichaLoading] = useState(false);
  const [fichaEditando, setFichaEditando] = useState(false);
  const [fichaForm, setFichaForm] = useState<Partial<Aluno>>({});
  const [fichaEditSalvando, setFichaEditSalvando] = useState(false);
  const [fichaEditErro, setFichaEditErro] = useState<string | null>(null);
  const [buscandoCepFicha, setBuscandoCepFicha] = useState(false);
  const [pendentes, setPendentes] = useState<any[]>([]);
  const [showPendentes, setShowPendentes] = useState(true);

  const buscarCepFicha = useCallback(async (cep: string) => {
    const limpo = cep.replace(/\D/g, '');
    if (limpo.length !== 8) return;
    setBuscandoCepFicha(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setFichaForm(p => ({
          ...p,
          logradouro: data.logradouro || p.logradouro,
          bairro:     data.bairro     || p.bairro,
          cidade:     data.localidade || p.cidade,
          estado_uf:  data.uf         || p.estado_uf,
        }));
      }
    } catch { /* silencia erros de rede */ }
    finally { setBuscandoCepFicha(false); }
  }, []);

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

  // Debounce do campo nome: só dispara a busca 400ms após o usuário parar de digitar
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

  useEffect(() => {
    api.get('/academico/alunos/pendentes').then(r => setPendentes(r.data)).catch(() => {});
  }, []);

  const verFicha = async (id: string) => {
    setFichaErro(null);
    setFichaEditando(false);
    setFichaEditErro(null);
    setFichaLoading(true);
    try {
      const r = await api.get(`/academico/alunos/${id}/ficha`);
      setFichaAba('dados');
      setFichaAluno(r.data);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao carregar ficha do aluno.';
      setFichaErro(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setFichaLoading(false);
    }
  };

  // Retorna lista de campos obrigatórios faltando para o aluno
  const camposFaltando = (aluno: Partial<Aluno>): string[] => {
    const faltam: string[] = [];
    if (!aluno.cep?.trim()) faltam.push('CEP');
    if (!aluno.celular?.trim()) faltam.push('Celular');
    const menor = aluno.maior_18_anos === false ||
      (aluno.data_nascimento ? new Date().getFullYear() - new Date(aluno.data_nascimento).getFullYear() < 18 : false);
    if (menor && !aluno.telefone_alternativo?.trim()) faltam.push('Tel. Responsável');
    return faltam;
  };

  const salvarFicha = async () => {
    if (!fichaAluno?.aluno?.id) return;
    // Aviso sobre campos obrigatórios (não bloqueia — permite salvar dados parciais)
    const faltam = camposFaltando(fichaForm);
    if (faltam.length > 0) {
      setFichaEditErro(`Atenção: campos obrigatórios não preenchidos — ${faltam.join(', ')}. Salvo mesmo assim, mas complete o quanto antes.`);
    } else {
      setFichaEditErro(null);
    }
    setFichaEditSalvando(true);
    try {
      await api.patch(`/academico/alunos/${fichaAluno.aluno.id}`, fichaForm);
      const r = await api.get(`/academico/alunos/${fichaAluno.aluno.id}/ficha`);
      setFichaAluno(r.data);
      if (!faltam.length) setFichaEditando(false);
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao salvar.';
      setFichaEditErro(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setFichaEditSalvando(false);
    }
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

  const excluirAlunoPermanente = async (a: Aluno) => {
    if (!confirm(`Excluir permanentemente "${a.nome_completo}"? Esta ação não pode ser desfeita.`)) return;
    setExcluindoId(a.id);
    try {
      await api.delete(`/academico/alunos/${a.id}/permanente`);
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao excluir aluno.';
      alert(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setExcluindoId(null);
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

      <div className="bg-white rounded-3xl border border-slate-100 shadow overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-400">Carregando...</div>
        ) : erroLoad ? (
          <div className="py-12 text-center space-y-2">
            <div className="text-red-500 text-sm font-bold">Erro ao carregar alunos</div>
            <div className="text-slate-400 text-xs max-w-md mx-auto">{erroLoad}</div>
            <button onClick={load} className="mt-2 text-xs text-purple-600 underline">Tentar novamente</button>
          </div>
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
                  <th className="text-left px-4 py-3">Turmas</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Data Matr.</th>
                  <th className="text-center px-4 py-3">Ficha</th>
                  {podeEditar && <th className="text-center px-4 py-3">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {alunos.map((a, i) => (
                  <tr key={a.id} className={`border-b border-slate-50 hover:bg-purple-50/30 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {a.foto_url
                          ? <img src={a.foto_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-100 shadow-sm" />
                          : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center shrink-0 text-[11px] font-black text-purple-600">
                              {(a.nome_completo[0] || '?').toUpperCase()}
                            </div>
                        }
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-800">{a.nome_completo}</span>
                            {camposFaltando(a).length > 0 && (
                              <span title={`Faltando: ${camposFaltando(a).join(', ')}`}
                                className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full border bg-amber-100 text-amber-700 border-amber-200 cursor-help">
                                ⚠ incompleto
                              </span>
                            )}
                            {a.cuidado_especial && a.cuidado_especial !== 'Não' && (() => {
                              const b = CUIDADO_BADGE[a.cuidado_especial] || { label: 'Cuidado Espec.', color: 'bg-pink-100 text-pink-700 border-pink-200' };
                              return <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full border ${b.color}`}>{b.label}</span>;
                            })()}
                          </div>
                          <div className="text-[9px] text-slate-400">{a.celular || a.email || '–'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-purple-700 font-bold text-[10px]">{a.numero_matricula || '–'}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[10px]">{a.cpf || '–'}</td>
                    <td className="px-4 py-3 max-w-[220px]">
                      {(a.turmas && a.turmas.length > 0) ? (
                        <div className="flex flex-wrap gap-1">
                          {(() => {
                            const todas = a.turmas;
                            const visiveis = todas.slice(0, 3);
                            const extras = todas.length - 3;
                            return (<>
                              {visiveis.map((t: any) => (
                                <span key={t.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black text-white shadow-sm"
                                  style={{ backgroundColor: t.cor || '#6d28d9', opacity: t.status !== 'ativo' ? 0.6 : 1 }}>
                                  {t.nome}
                                </span>
                              ))}
                              {extras > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-500">+{extras}</span>
                              )}
                            </>);
                          })()}
                        </div>
                      ) : (
                        <span className="text-slate-300 text-[10px]">Sem turma</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${a.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'}`}>
                        {a.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-[10px]">{fmtDate(a.data_matricula)}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => verFicha(a.id)} disabled={fichaLoading}
                        className="bg-purple-100 text-purple-700 px-3 py-1 rounded-lg text-[9px] font-black uppercase hover:bg-purple-200 transition-colors disabled:opacity-50">
                        {fichaLoading ? '...' : 'Ver'}
                      </button>
                    </td>
                    {podeEditar && (
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => inativarAluno(a)}
                            disabled={inativandoId === a.id}
                            title="Inativar aluno"
                            className="px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-colors disabled:opacity-50 bg-red-50 text-red-500 hover:bg-red-100">
                            {inativandoId === a.id ? '...' : 'Inativar'}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Erro ao carregar ficha */}
      {fichaErro && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[400] bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-3">
          ⚠ {fichaErro}
          <button onClick={() => setFichaErro(null)} className="ml-2 underline text-white/80 text-xs">Fechar</button>
        </div>
      )}

      {dossieCandidato && (
        <DossieCandidato
          aluno={dossieCandidato}
          onClose={() => setDossieCandidato(null)}
          onSuccess={() => { setDossieCandidato(null); load(); }}
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

      {fichaAluno && (() => {
        const a = fichaAluno.aluno;
        const idade = a?.data_nascimento ? calcularIdade(a.data_nascimento) : null;
        const wa = a?.celular ? `https://wa.me/55${a.celular.replace(/\D/g, '')}` : null;
        const waResp = a?.telefone_alternativo ? `https://wa.me/55${a.telefone_alternativo.replace(/\D/g, '')}` : null;
        const lgpdOk = a?.lgpd_aceito;
        return (
          <div className="fixed inset-0 z-[300] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3">
            <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl flex flex-col overflow-hidden max-h-[95vh]">

              {/* ── HERO HEADER ─────────────────────────────────────────────── */}
              <div className="relative bg-gradient-to-br from-purple-700 via-purple-600 to-indigo-700 px-6 pt-6 pb-8 shrink-0">
                <button
                  onClick={() => { setFichaAluno(null); setFichaEditando(false); }}
                  className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all">
                  <X size={16}/>
                </button>

                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="shrink-0">
                    {fichaAluno.foto_url
                      ? <img src={fichaAluno.foto_url} alt="" className="w-20 h-20 rounded-2xl object-cover border-4 border-white/30 shadow-xl" />
                      : <div className="w-20 h-20 rounded-2xl bg-white/20 border-4 border-white/25 flex items-center justify-center text-4xl font-black text-white shadow-xl">
                          {(a?.nome_completo || '?')[0].toUpperCase()}
                        </div>
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 pt-1">
                    <h2 className="text-white font-black text-xl leading-tight tracking-tight">{a?.nome_completo}</h2>
                    <p className="text-purple-200 font-mono text-xs mt-0.5">{a?.numero_matricula || '–'}</p>
                    <div className="flex gap-1.5 mt-2 flex-wrap items-center">
                      {(fichaAluno.turmasDoAluno || []).filter((t: any) => t.status === 'ativo' && t.turma_id).map((t: any) => (
                        <span key={t.id} className="text-[9px] font-black text-white px-2.5 py-1 rounded-full shadow-sm border border-white/20"
                          style={{ backgroundColor: (t.turma_cor || '#4f46e5') + 'cc' }}>
                          {t.turma_nome}
                        </span>
                      ))}
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border ${a?.ativo ? 'bg-green-500/20 border-green-400/40 text-green-200' : 'bg-slate-500/20 border-slate-400/40 text-slate-300'}`}>
                        {a?.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                      {idade !== null && idade < 99 && (
                        <span className="text-[9px] font-black px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-200">{idade} anos</span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-1.5 shrink-0 pt-1">
                    {fichaAluno.inscricao_id && !fichaEditando && (
                      <button
                        onClick={() => { api.get(`/matriculas/inscricao/${fichaAluno.inscricao_id}`).then(r => { setFichaAluno(null); setDossieCandidato(r.data); }).catch(() => alert('Não foi possível carregar o dossier.')); }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl text-[9px] font-black uppercase border border-white/20 transition-all">
                        <FileText size={11}/> Dossier
                      </button>
                    )}
                    {fichaEditando ? (
                      <>
                        <button onClick={() => { setFichaEditando(false); setFichaEditErro(null); }}
                          className="px-3 py-2 rounded-xl text-[9px] font-black uppercase bg-white/10 hover:bg-white/20 text-white/70 border border-white/20">
                          Cancelar
                        </button>
                        <button onClick={salvarFicha} disabled={fichaEditSalvando}
                          className="flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-400 text-white rounded-xl text-[9px] font-black uppercase disabled:opacity-50 border border-green-400/50">
                          <Save size={11}/> {fichaEditSalvando ? 'Salvando...' : 'Salvar'}
                        </button>
                      </>
                    ) : (
                      <button onClick={() => { setFichaForm({ ...a }); setFichaEditErro(null); setFichaEditando(true); }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl text-[9px] font-black uppercase border border-white/20 transition-all">
                        <Edit3 size={11}/> Editar
                      </button>
                    )}
                  </div>
                </div>

                {/* Contact quick bar */}
                {!fichaEditando && (
                  <div className="flex gap-2 mt-4 flex-wrap">
                    {wa && (
                      <a href={wa} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 border border-green-400/30 text-green-200 rounded-xl text-[10px] font-bold transition-all">
                        <Smartphone size={11}/> {a?.celular}
                      </a>
                    )}
                    {a?.email && (
                      <a href={`mailto:${a.email}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-purple-200 rounded-xl text-[10px] font-bold transition-all">
                        <Mail size={11}/> {a.email}
                      </a>
                    )}
                    {!wa && !a?.email && (
                      <span className="text-purple-300/60 text-[10px] italic">Sem contatos cadastrados</span>
                    )}
                  </div>
                )}
              </div>

              {/* ── OVERLAP STRIP ────────────────────────────────────────────── */}
              <div className="shrink-0 -mt-4 px-5 z-10 space-y-2">

                {/* Alerta de dados obrigatórios faltando */}
                {!fichaEditando && (() => {
                  const faltam = camposFaltando(fichaAluno.aluno);
                  if (!faltam.length) return null;
                  return (
                    <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-2xl px-4 py-3 shadow-sm">
                      <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5"/>
                      <div>
                        <p className="text-amber-700 dark:text-amber-400 font-black text-xs uppercase tracking-wide">Cadastro incompleto</p>
                        <p className="text-amber-600 text-[10px] mt-0.5">
                          Preencha: <span className="font-black">{faltam.join(' · ')}</span>
                        </p>
                      </div>
                      <button onClick={() => { setFichaForm({ ...fichaAluno.aluno }); setFichaEditando(true); }}
                        className="ml-auto text-[9px] font-black uppercase px-2.5 py-1 rounded-lg bg-amber-200 text-amber-800 hover:bg-amber-300 transition-colors shrink-0">
                        Completar
                      </button>
                    </div>
                  );
                })()}

                {/* LGPD alert */}
                {!lgpdOk && !fichaEditando && (
                  <div className="flex items-center gap-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700/40 rounded-2xl px-4 py-3 shadow-sm">
                    <AlertTriangle size={16} className="text-orange-500 shrink-0 animate-pulse"/>
                    <div className="flex-1">
                      <p className="text-orange-700 dark:text-orange-400 font-black text-xs uppercase tracking-wide">Termo LGPD Pendente</p>
                      <p className="text-orange-500 text-[10px]">O responsável ainda não assinou o termo de consentimento.</p>
                    </div>
                  </div>
                )}
                {lgpdOk && !fichaEditando && (
                  <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-2xl px-4 py-3 shadow-sm">
                    <ShieldCheck size={16} className="text-blue-500 shrink-0"/>
                    <p className="text-blue-700 dark:text-blue-400 font-black text-xs">Termo LGPD assinado</p>
                  </div>
                )}

                {/* Tabs */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl gap-1 shadow-sm">
                  {(['dados', 'presenca'] as const).map(aba => (
                    <button key={aba} onClick={() => setFichaAba(aba)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                        fichaAba === aba ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                      }`}>
                      {aba === 'dados' ? <><User size={11}/> Cadastro</> : <><ClipboardCheck size={11}/> Presença ({fichaAluno.totalPresencas ?? 0}P/{fichaAluno.totalFaltas ?? 0}F)</>}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── CONTENT ──────────────────────────────────────────────────── */}
              <div className="overflow-y-auto flex-1 px-5 pb-5 pt-3 space-y-4">

                {fichaAba === 'dados' && fichaEditando && (
                  <div className="space-y-4">
                    {fichaEditErro && (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold rounded-xl px-4 py-2.5">⚠ {fichaEditErro}</div>
                    )}
                    <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
                      <h4 className="text-[9px] font-black uppercase text-purple-600 mb-3 tracking-widest flex items-center gap-2"><User size={11}/> Identificação</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2 space-y-1">
                          <label className="text-[9px] font-black uppercase text-slate-400">Nome Completo</label>
                          <input value={fichaForm.nome_completo || ''} onChange={e => setFichaForm(p => ({ ...p, nome_completo: e.target.value }))}
                            className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 dark:bg-slate-700 dark:text-white" />
                        </div>
                        {([['CPF', 'cpf'], ['E-mail', 'email']] as [string, keyof Aluno][]).map(([label, field]) => (
                          <div key={field} className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-400">{label}</label>
                            <input value={(fichaForm[field] as string) || ''} onChange={e => setFichaForm(p => ({ ...p, [field]: e.target.value }))}
                              className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 dark:bg-slate-700 dark:text-white" />
                          </div>
                        ))}
                        <div className="space-y-1">
                          <label className={`text-[9px] font-black uppercase ${!fichaForm.celular?.trim() ? 'text-rose-500' : 'text-slate-400'}`}>
                            Celular {!fichaForm.celular?.trim() && <span className="normal-case">— obrigatório</span>}
                          </label>
                          <input value={(fichaForm.celular as string) || ''} onChange={e => setFichaForm(p => ({ ...p, celular: e.target.value }))}
                            className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 dark:bg-slate-700 dark:text-white ${!fichaForm.celular?.trim() ? 'border-rose-300 bg-rose-50/50' : 'border-slate-200 dark:border-slate-600'}`} />
                        </div>
                        {(() => {
                          const menor = fichaForm.maior_18_anos === false ||
                            (fichaForm.data_nascimento ? new Date().getFullYear() - new Date(fichaForm.data_nascimento).getFullYear() < 18 : false);
                          const obrig = menor && !fichaForm.telefone_alternativo?.trim();
                          return (
                            <div className="space-y-1">
                              <label className={`text-[9px] font-black uppercase ${obrig ? 'text-rose-500' : 'text-slate-400'}`}>
                                Tel. Responsável {obrig && <span className="normal-case">— obrigatório (menor)</span>}
                              </label>
                              <input value={(fichaForm.telefone_alternativo as string) || ''} onChange={e => setFichaForm(p => ({ ...p, telefone_alternativo: e.target.value }))}
                                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 dark:bg-slate-700 dark:text-white ${obrig ? 'border-rose-300 bg-rose-50/50' : 'border-slate-200 dark:border-slate-600'}`} />
                            </div>
                          );
                        })()}
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-slate-400">Nascimento</label>
                          <input type="date" value={fichaForm.data_nascimento || ''} onChange={e => setFichaForm(p => ({ ...p, data_nascimento: e.target.value }))}
                            className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 dark:bg-slate-700 dark:text-white" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-slate-400">Sexo</label>
                          <select value={fichaForm.sexo || ''} onChange={e => setFichaForm(p => ({ ...p, sexo: e.target.value }))}
                            className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white dark:bg-slate-700 dark:text-white">
                            <option value="">—</option>
                            {['Masculino', 'Feminino', 'Outro', 'Prefiro não informar'].map(o => <option key={o}>{o}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-slate-400">Escolaridade</label>
                          <select value={fichaForm.escolaridade || ''} onChange={e => setFichaForm(p => ({ ...p, escolaridade: e.target.value }))}
                            className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white dark:bg-slate-700 dark:text-white">
                            <option value="">—</option>
                            {['Fund. Incompleto', 'Fund. Completo', 'Médio Incompleto', 'Médio Completo', 'Superior Incompleto', 'Superior Completo'].map(o => <option key={o}>{o}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-slate-400">Turno Escolar</label>
                          <select value={fichaForm.turno_escolar || ''} onChange={e => setFichaForm(p => ({ ...p, turno_escolar: e.target.value }))}
                            className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white dark:bg-slate-700 dark:text-white">
                            <option value="">—</option>
                            {['Manhã', 'Tarde', 'Noite', 'Integral', 'Não estuda'].map(o => <option key={o}>{o}</option>)}
                          </select>
                        </div>
                      </div>
                    </section>

                    <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
                      <h4 className="text-[9px] font-black uppercase text-purple-600 mb-3 tracking-widest flex items-center gap-2">
                        <MapPin size={11}/> Endereço
                        {buscandoCepFicha && <span className="text-[8px] font-black text-green-600 animate-pulse normal-case ml-1">Buscando CEP...</span>}
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className={`text-[9px] font-black uppercase ${!fichaForm.cep?.trim() ? 'text-rose-500' : 'text-slate-400'}`}>
                            CEP {!fichaForm.cep?.trim() && <span className="normal-case">— obrigatório</span>}
                          </label>
                          <input value={fichaForm.cep || ''} placeholder="00000-000"
                            onChange={e => { setFichaForm(p => ({ ...p, cep: e.target.value })); if (e.target.value.replace(/\D/g, '').length === 8) buscarCepFicha(e.target.value); }}
                            onBlur={e => buscarCepFicha(e.target.value)}
                            className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 dark:bg-slate-700 dark:text-white ${!fichaForm.cep?.trim() ? 'border-rose-300 bg-rose-50/50' : 'border-slate-200 dark:border-slate-600'}`} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-slate-400">Número</label>
                          <input value={fichaForm.numero || ''} onChange={e => setFichaForm(p => ({ ...p, numero: e.target.value }))}
                            className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 dark:bg-slate-700 dark:text-white" />
                        </div>
                        {([['Logradouro', 'logradouro'], ['Complemento', 'complemento'], ['Bairro', 'bairro'], ['Cidade', 'cidade'], ['Estado (UF)', 'estado_uf']] as [string, keyof Aluno][]).map(([label, field]) => (
                          <div key={field} className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-400">{label}</label>
                            <input value={(fichaForm[field] as string) || ''} onChange={e => setFichaForm(p => ({ ...p, [field]: e.target.value }))}
                              className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 dark:bg-slate-700 dark:text-white" />
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
                      <h4 className="text-[9px] font-black uppercase text-purple-600 mb-3 tracking-widest flex items-center gap-2"><Users size={11}/> Responsável</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {([['Nome', 'nome_responsavel'], ['Parentesco', 'grau_parentesco'], ['E-mail', 'email_responsavel'], ['CPF', 'cpf_responsavel']] as [string, keyof Aluno][]).map(([label, field]) => (
                          <div key={field} className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-400">{label}</label>
                            <input value={(fichaForm[field] as string) || ''} onChange={e => setFichaForm(p => ({ ...p, [field]: e.target.value }))}
                              className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 dark:bg-slate-700 dark:text-white" />
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="bg-white dark:bg-slate-800 rounded-2xl border border-amber-100 dark:border-amber-900/30 p-4">
                      <h4 className="text-[9px] font-black uppercase text-amber-600 mb-3 tracking-widest flex items-center gap-2"><Heart size={11}/> Saúde / Cuidados</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {([['Alergias', 'possui_alergias'], ['Medicamentos', 'uso_medicamento']] as [string, keyof Aluno][]).map(([label, field]) => (
                          <div key={field} className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-400">{label}</label>
                            <input value={(fichaForm[field] as string) || ''} onChange={e => setFichaForm(p => ({ ...p, [field]: e.target.value }))}
                              className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 dark:bg-slate-700 dark:text-white" />
                          </div>
                        ))}
                        <div className="col-span-2 space-y-1">
                          <label className="text-[9px] font-black uppercase text-slate-400">Necessidade de Cuidado Especial</label>
                          <select value={fichaForm.cuidado_especial || 'Não'} onChange={e => setFichaForm(p => ({ ...p, cuidado_especial: e.target.value }))}
                            className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white dark:bg-slate-700 dark:text-white">
                            {OPCOES_CUIDADO_ESPECIAL.map(o => <option key={o}>{o}</option>)}
                          </select>
                        </div>
                        <div className="col-span-2 space-y-1">
                          <label className="text-[9px] font-black uppercase text-slate-400">Detalhes do Cuidado</label>
                          <textarea rows={2} value={fichaForm.detalhes_cuidado || ''} onChange={e => setFichaForm(p => ({ ...p, detalhes_cuidado: e.target.value }))}
                            className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none dark:bg-slate-700 dark:text-white" />
                        </div>
                      </div>
                    </section>
                  </div>
                )}

                {fichaAba === 'dados' && !fichaEditando && (
                  <div className="space-y-4">

                    {/* Dados Pessoais */}
                    <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
                      <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest flex items-center gap-2"><User size={12} className="text-purple-500"/> Dados Pessoais</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {([
                          { label: 'CPF',           value: a?.cpf,              icon: BadgeCheck },
                          { label: 'Celular',       value: a?.celular,          icon: Phone },
                          { label: 'E-mail',        value: a?.email,            icon: Mail },
                          { label: 'Nascimento',    value: fmtDate(a?.data_nascimento), icon: Calendar },
                          { label: 'Sexo',          value: a?.sexo,             icon: User },
                          { label: 'Escolaridade',  value: a?.escolaridade,     icon: BookOpen },
                          { label: 'Turno Escolar', value: a?.turno_escolar,    icon: Clock },
                          { label: 'Tel. Alternativo', value: a?.telefone_alternativo, icon: Phone },
                        ]).map(({ label, value, icon: Icon }) => (
                          <div key={label} className="space-y-0.5">
                            <span className="flex items-center gap-1 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                              <Icon size={9} className="text-purple-400"/>{label}
                            </span>
                            <span className="block font-bold text-slate-800 dark:text-slate-100 text-xs truncate">{value || <span className="text-slate-300 dark:text-slate-600 font-normal">—</span>}</span>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* Turmas */}
                    {(fichaAluno.turmasDoAluno || []).length > 0 && (
                      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest flex items-center gap-2"><ClipboardList size={12} className="text-indigo-500"/> Turmas</h4>
                        <div className="flex flex-wrap gap-2">
                          {(fichaAluno.turmasDoAluno as any[]).map((t: any) => (
                            <div key={t.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold ${t.status === 'ativo' ? 'border-indigo-100 dark:border-indigo-900/40 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300' : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-400'}`}>
                              {t.turma_id && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.turma_cor || '#6d28d9' }} />}
                              <span>{t.turma_nome || 'Backlog'}</span>
                              {t.turno && <span className="text-[9px] text-slate-400 font-medium">· {t.turno}</span>}
                              <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${t.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{t.status}</span>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Responsável */}
                    {a?.nome_responsavel && (
                      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-purple-100 dark:border-purple-900/30 p-4">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest flex items-center gap-2"><Users size={12} className="text-purple-500"/> Responsável</h4>
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                            <User size={18} className="text-purple-500"/>
                          </div>
                          <div className="flex-1 space-y-1">
                            <p className="font-black text-slate-800 dark:text-slate-100 text-sm">{a.nome_responsavel}</p>
                            {a.grau_parentesco && <p className="text-[10px] text-slate-400">{a.grau_parentesco}</p>}
                            <div className="flex gap-2 flex-wrap mt-2">
                              {waResp && (
                                <a href={waResp} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 text-green-700 dark:text-green-400 rounded-lg text-[10px] font-bold">
                                  <Smartphone size={10}/> {a.telefone_alternativo}
                                </a>
                              )}
                              {a.email_responsavel && (
                                <a href={`mailto:${a.email_responsavel}`}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold">
                                  <Mail size={10}/> {a.email_responsavel}
                                </a>
                              )}
                              {a.cpf_responsavel && (
                                <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 rounded-lg text-[10px] font-mono">
                                  CPF: {a.cpf_responsavel}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </section>
                    )}

                    {/* Endereço */}
                    {(a?.cidade || a?.logradouro || a?.cep) && (
                      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest flex items-center gap-2"><MapPin size={12} className="text-purple-500"/> Endereço</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {([['Logradouro', a?.logradouro ? `${a.logradouro}${a?.numero ? ', ' + a.numero : ''}` : undefined], ['Bairro', a?.bairro], ['Cidade', a?.cidade], ['Estado', a?.estado_uf], ['CEP', a?.cep], ['Complemento', a?.complemento]] as [string, string | undefined][]).map(([k, v]) => v ? (
                            <div key={k} className="space-y-0.5">
                              <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">{k}</span>
                              <span className="font-bold text-slate-800 dark:text-slate-100 text-xs">{v}</span>
                            </div>
                          ) : null)}
                        </div>
                      </section>
                    )}

                    {/* Saúde */}
                    {(a?.possui_alergias || (a?.cuidado_especial && a.cuidado_especial !== 'Não') || a?.uso_medicamento) && (
                      <section className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-200 dark:border-amber-800/40 p-4">
                        <h4 className="text-[10px] font-black uppercase text-amber-600 mb-3 tracking-widest flex items-center gap-2"><Heart size={12}/> Saúde / Cuidados</h4>
                        <div className="space-y-2.5">
                          {a?.cuidado_especial && a.cuidado_especial !== 'Não' && (() => {
                            const b = CUIDADO_BADGE[a.cuidado_especial] || { label: a.cuidado_especial, color: 'bg-pink-100 text-pink-700 border-pink-200' };
                            return (
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black uppercase text-amber-500 w-24 shrink-0">Cuidado</span>
                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${b.color}`}>{b.label}</span>
                                <span className="text-xs text-amber-700 dark:text-amber-300 font-medium hidden sm:block">{a.cuidado_especial}</span>
                              </div>
                            );
                          })()}
                          {a?.possui_alergias && <div className="flex gap-2"><span className="text-[9px] font-black uppercase text-amber-500 w-24 shrink-0 pt-0.5">Alergias</span><span className="text-amber-800 dark:text-amber-300 text-xs font-bold">{a.possui_alergias}</span></div>}
                          {a?.uso_medicamento && <div className="flex gap-2"><span className="text-[9px] font-black uppercase text-amber-500 w-24 shrink-0 pt-0.5">Medicamento</span><span className="text-amber-800 dark:text-amber-300 text-xs font-bold">{a.uso_medicamento}</span></div>}
                          {a?.detalhes_cuidado && <div className="flex gap-2"><span className="text-[9px] font-black uppercase text-amber-500 w-24 shrink-0 pt-0.5">Detalhes</span><span className="text-amber-700 dark:text-amber-400 text-xs">{a.detalhes_cuidado}</span></div>}
                        </div>
                      </section>
                    )}

                    {/* Dossier link */}
                    {fichaAluno.inscricao_id && (
                      <button
                        onClick={() => { api.get(`/matriculas/inscricao/${fichaAluno.inscricao_id}`).then(r => { setFichaAluno(null); setDossieCandidato(r.data); }).catch(() => alert('Não foi possível carregar o dossier.')); }}
                        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-purple-200 dark:border-purple-800/50 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/10 rounded-2xl text-xs font-black uppercase tracking-widest transition-all">
                        <FileText size={14}/> Abrir Dossier Completo & Documentos
                      </button>
                    )}
                  </div>
                )}

                {fichaAba === 'presenca' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Presenças', val: fichaAluno.totalPresencas ?? 0, cls: 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30 text-green-700 dark:text-green-400' },
                        { label: 'Faltas',    val: fichaAluno.totalFaltas ?? 0,    cls: 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400' },
                        { label: '% Freq.',
                          val: fichaAluno.totalPresencas + fichaAluno.totalFaltas > 0
                            ? `${Math.round((fichaAluno.totalPresencas / (fichaAluno.totalPresencas + fichaAluno.totalFaltas)) * 100)}%`
                            : '0%',
                          cls: 'bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/30 text-purple-700 dark:text-purple-400' },
                      ].map(k => (
                        <div key={k.label} className={`border rounded-2xl p-4 text-center ${k.cls}`}>
                          <span className="text-[9px] font-black uppercase tracking-widest opacity-70 block">{k.label}</span>
                          <span className="font-black text-2xl">{k.val}</span>
                        </div>
                      ))}
                    </div>

                    {fichaAluno.frequencia?.length > 0 ? (
                      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest">Registro por Aula</h4>
                        <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                          {fichaAluno.frequencia.map((f: any) => (
                            <div key={f.id} className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold ${f.descricao === 'Presente' ? 'bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400'}`}>
                              <div className={`w-2 h-2 rounded-full shrink-0 ${f.descricao === 'Presente' ? 'bg-green-500' : 'bg-red-400'}`} />
                              <span className="flex-1 truncate">{fmtDate(f.data)}</span>
                              <span className="shrink-0 text-[9px] uppercase font-black opacity-70">{f.descricao}</span>
                              {f.turma_id && turmas.find((t: Turma) => t.id === f.turma_id) && (
                                <span className="shrink-0 text-[8px] font-bold text-slate-400">{turmas.find((t: Turma) => t.id === f.turma_id)?.nome}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
                    ) : (
                      <div className="py-12 text-center text-sm text-slate-400">Nenhum registro de presença encontrado.</div>
                    )}

                    {fichaAluno.historico?.filter((h: any) => h.tipo !== 'Presença').length > 0 && (
                      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest">Outros Registros</h4>
                        <div className="space-y-1.5">
                          {fichaAluno.historico.filter((h: any) => h.tipo !== 'Presença').map((h: DiarioEntry) => (
                            <div key={h.id} className="flex gap-2 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-2.5">
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 uppercase self-start whitespace-nowrap">{h.tipo}</span>
                              <div>
                                {h.titulo && <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{h.titulo}</div>}
                                {h.descricao && <div className="text-[10px] text-slate-500">{h.descricao}</div>}
                                <div className="text-[9px] text-slate-400 mt-0.5">{fmtDate(h.data)} · {h.usuario_nome}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
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

interface UsuarioProf { id: string; nome: string; email?: string; grupo_nome?: string; }
interface HorarioDia { ativo: boolean; hora_inicio: string; hora_fim: string; }
const DIAS_GRADE = [
  { idx: 1, label: 'Segunda' }, { idx: 2, label: 'Terça' }, { idx: 3, label: 'Quarta' },
  { idx: 4, label: 'Quinta' }, { idx: 5, label: 'Sexta' },
];

function TurmasTab({ cursos, professores, alunos }: { cursos: Curso[]; professores: Professor[]; alunos: Aluno[] }) {
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

  // ── Usuários com grupo Professor ─────────────────────────────────────────────
  const [usuariosProfessores, setUsuariosProfessores] = useState<UsuarioProf[]>([]);
  // ── Funcionários cadastrados ──────────────────────────────────────────────────
  const [funcionarios, setFuncionarios] = useState<{ id: string; nome: string; cargo?: string }[]>([]);
  // ── Atribuir professor a turma (inline) ──────────────────────────────────────
  const [showAtribuirProf, setShowAtribuirProf] = useState(false);
  const [turmaAtribuir, setTurmaAtribuir] = useState<Turma | null>(null);
  const [profSelecionadoId, setProfSelecionadoId] = useState('');
  const [atribuindoProf, setAtribuindoProf] = useState(false);
  const [erroAtribuir, setErroAtribuir] = useState<string | null>(null);
  // ── Alunos da turma ──────────────────────────────────────────────────────────
  const [showAlunosTurma, setShowAlunosTurma] = useState(false);
  const [turmaSelecionada, setTurmaSelecionada] = useState<Turma | null>(null);
  const [alunosDaTurma, setAlunosDaTurma] = useState<any[]>([]);
  const [loadingAlunosTurma, setLoadingAlunosTurma] = useState(false);
  // ── Histórico de presença por turma ──────────────────────────────────────────
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
          // Cria novos cards primeiro — se falhar, os antigos permanecem intactos
          await Promise.all(diasAtivos.map(([dia, h]) =>
            api.post('/academico/grade', {
              turma_id: turmaId,
              dia_semana: parseInt(dia),
              horario_inicio: h.hora_inicio.length === 5 ? h.hora_inicio + ':00' : h.hora_inicio,
              horario_fim:    h.hora_fim.length    === 5 ? h.hora_fim    + ':00' : h.hora_fim,
            })
          ));
          // Só apaga os antigos após criação bem-sucedida
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

  const nomeAluno = (id: string) => alunos.find(a => a.id === id)?.nome_completo || id;
  const nomeCurso = (id?: string) => cursos.find(c => c.id === id)?.nome || '–';
  const nomeProf  = (id?: string) => {
    if (!id) return '–';
    return professores.find(p => p.id === id)?.nome
      || usuariosProfessores.find(u => u.id === id)?.nome
      || funcionarios.find(f => f.id === id)?.nome
      || '–';
  };

  // Lista unificada para o select de professor (sem duplicatas por ID)
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

            {/* ── Horários por Dia da Semana ── */}
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
            {/* Header */}
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

            {/* Body */}
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
                  {/* Busca + seleção de aluno */}
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
                    {/* Lista de alunos filtrada */}
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
                    {/* Badge do aluno selecionado */}
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

                  {/* Turma de destino */}
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

            {/* Footer */}
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

      {/* ── Modal: Alunos da Turma ──────────── */}
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Atribuir Professor ──────────── */}
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

      {/* ── Modal: Histórico de Presença da Turma ────────────────────────── */}
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
    'Avaliação':       'bg-blue-100 text-blue-700',
    'Lista de Chamada':'bg-green-100 text-green-700',
    'Incidente':       'bg-red-100 text-red-700',
    'Observação':      'bg-amber-100 text-amber-700',
    'Comunicado':      'bg-purple-100 text-purple-700',
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

// ─── Relatórios de Presença ───────────────────────────────────────────────────

function RelatoriosPresencaSubTab({ turmas }: { turmas: Turma[] }) {
  const [turmaId, setTurmaId]   = useState('');
  const [dataIni, setDataIni]   = useState('');
  const [dataFim, setDataFim]   = useState('');
  const [dados, setDados]       = useState<any>(null);
  const [loading, setLoading]   = useState(false);

  const aplicarPreset = (dias: number) => {
    const fim = new Date();
    const ini = new Date(); ini.setDate(ini.getDate() - dias);
    setDataIni(ini.toISOString().slice(0, 10));
    setDataFim(fim.toISOString().slice(0, 10));
  };

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (turmaId) params.turma_id = turmaId;
      if (dataIni) params.data_ini = dataIni;
      if (dataFim) params.data_fim = dataFim;
      const r = await api.get('/academico/presenca/relatorio', { params });
      setDados(r.data);
    } catch { /* silencioso */ }
    setLoading(false);
  }, [turmaId, dataIni, dataFim]);

  useEffect(() => { carregar(); }, [carregar]);

  const exportarCSV = () => {
    if (!dados?.tendencia?.length) return;
    const linhas = [['Data', 'Presentes', 'Ausentes', 'Taxa (%)']];
    dados.tendencia.forEach((t: any) => {
      const total = t.presentes + t.ausentes;
      const taxa  = total > 0 ? Math.round(t.presentes / total * 100) : 0;
      linhas.push([t.data, t.presentes, t.ausentes, taxa]);
    });
    const csv  = linhas.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'relatorio-presenca.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const kpi = dados?.kpi ?? {};

  const porTurmaData = (dados?.por_turma ?? []).map((t: any) => ({
    nome:     (t.turma_nome || '–').slice(0, 22),
    presentes: t.presentes,
    ausentes:  t.ausentes,
    sessoes:   t.sessoes,
    taxa:      t.presentes + t.ausentes > 0 ? Math.round(t.presentes / (t.presentes + t.ausentes) * 100) : 0,
  }));

  const tendenciaData = (dados?.tendencia ?? []).map((t: any) => {
    const [, m, d] = (t.data || '').split('-');
    const total = t.presentes + t.ausentes;
    return { ...t, label: `${d}/${m}`, taxa: total > 0 ? Math.round(t.presentes / total * 100) : 0 };
  });

  const taxaColor = (v: number) => v >= 75 ? 'text-green-600 bg-green-50' : v >= 50 ? 'text-amber-600 bg-amber-50' : 'text-red-500 bg-red-50';

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Turma</label>
            <select value={turmaId} onChange={e => setTurmaId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
              <option value="">Todas as turmas</option>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">De</label>
            <input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>
          <div>
            <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Até</label>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>
          <div className="flex gap-1 flex-wrap">
            {[{ label: '7d', dias: 7 }, { label: '30d', dias: 30 }, { label: '90d', dias: 90 }, { label: '6m', dias: 180 }].map(p => (
              <button key={p.label} onClick={() => aplicarPreset(p.dias)}
                className="px-2.5 py-2 rounded-xl border border-slate-200 text-[9px] font-black uppercase hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-colors">
                {p.label}
              </button>
            ))}
            <button onClick={() => { setDataIni(''); setDataFim(''); }}
              className="px-2.5 py-2 rounded-xl border border-slate-200 text-[9px] font-black uppercase text-slate-400 hover:bg-slate-100 transition-colors">
              Tudo
            </button>
          </div>
          <button onClick={carregar} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-black uppercase disabled:opacity-50">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
          <button onClick={exportarCSV} disabled={!dados}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-[10px] font-black uppercase disabled:opacity-30 transition-colors">
            <FileText size={12} /> Exportar CSV
          </button>
        </div>
      </div>

      {loading && (
        <div className="py-12 text-center text-sm text-slate-400">
          <RefreshCw size={24} className="animate-spin mx-auto mb-3 text-slate-300" /> Calculando...
        </div>
      )}

      {dados && !loading && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Sessões Registradas', value: kpi.total_sessoes ?? 0, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-100' },
              { label: 'Taxa de Presença',    value: `${kpi.taxa_presenca ?? 0}%`, color: (kpi.taxa_presenca ?? 0) >= 75 ? 'text-green-700' : 'text-amber-600', bg: 'bg-white border-slate-100' },
              { label: 'Total Presentes',     value: (kpi.total_presentes ?? 0).toLocaleString(), color: 'text-green-700', bg: 'bg-green-50 border-green-100' },
              { label: 'Total Ausentes',      value: (kpi.total_ausentes ?? 0).toLocaleString(),  color: 'text-red-600',   bg: 'bg-red-50 border-red-100' },
            ].map(k => (
              <div key={k.label} className={`${k.bg} rounded-2xl p-4 border shadow-sm`}>
                <p className="text-[9px] font-black uppercase text-slate-400 mb-1">{k.label}</p>
                <p className={`text-3xl font-black ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Presença por Turma */}
            {porTurmaData.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-4">Presença por Turma</h3>
                <ResponsiveContainer width="100%" height={Math.max(180, porTurmaData.length * 36)}>
                  <BarChart data={porTurmaData} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <XAxis type="number" tick={{ fontSize: 9 }} />
                    <YAxis dataKey="nome" type="category" tick={{ fontSize: 9 }} width={90} />
                    <Tooltip
                      formatter={(v: any, name: string) => [v, name === 'presentes' ? 'Presentes' : 'Ausentes']}
                      contentStyle={{ fontSize: 11, borderRadius: 10 }}
                    />
                    <Bar dataKey="presentes" fill="#22c55e" radius={[0, 4, 4, 0]} name="presentes" stackId="a" />
                    <Bar dataKey="ausentes"  fill="#ef4444" radius={[0, 4, 4, 0]} name="ausentes"  stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tendência de Presença */}
            {tendenciaData.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-4">Tendência de Presença (%)</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={tendenciaData} margin={{ right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={Math.ceil(tendenciaData.length / 10)} />
                    <YAxis tick={{ fontSize: 9 }} domain={[0, 100]} unit="%" />
                    <Tooltip formatter={(v: any) => [`${v}%`, 'Taxa Presença']} contentStyle={{ fontSize: 11, borderRadius: 10 }} />
                    <Line type="monotone" dataKey="taxa" stroke="#7c3aed" strokeWidth={2.5} dot={tendenciaData.length < 30} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Tabela resumo por turma */}
          {porTurmaData.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Resumo por Turma</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {['Turma', 'Sessões', 'Presentes', 'Ausentes', 'Taxa'].map(h => (
                        <th key={h} className={`px-4 py-2.5 text-[9px] font-black uppercase text-slate-400 ${h === 'Turma' ? 'text-left' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {porTurmaData.map((t: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-2.5 font-bold text-slate-800">{t.nome}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{t.sessoes}</td>
                        <td className="px-4 py-2.5 text-right text-green-700 font-bold">{t.presentes}</td>
                        <td className="px-4 py-2.5 text-right text-red-600 font-bold">{t.ausentes}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`font-black text-[10px] px-2 py-0.5 rounded-full ${taxaColor(t.taxa)}`}>{t.taxa}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top faltas */}
          {dados.top_faltas?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Alunos com Mais Faltas</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {dados.top_faltas.map((a: any, i: number) => {
                  const taxa = a.total_registros > 0 ? Math.round(a.total_presentes / a.total_registros * 100) : 0;
                  return (
                    <div key={i} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50/50 transition-colors">
                      <span className="text-[9px] font-black text-slate-300 w-5 shrink-0 text-center">{i + 1}</span>
                      <span className="flex-1 text-xs font-bold text-slate-800 truncate">{a.aluno_nome}</span>
                      <span className="text-red-600 font-black text-xs shrink-0">{a.total_faltas} falta{a.total_faltas !== 1 ? 's' : ''}</span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ${taxaColor(taxa)}`}>{taxa}% presença</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {porTurmaData.length === 0 && tendenciaData.length === 0 && (
            <div className="py-16 text-center">
              <Activity size={40} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-bold text-slate-400">Nenhum dado encontrado para o período selecionado.</p>
              <p className="text-xs text-slate-300 mt-1">Tente selecionar um intervalo diferente ou &quot;Tudo&quot;.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Por Aluno ────────────────────────────────────────────────────────────────

function PorAlunoSubTab({ turmas }: { turmas: Turma[] }) {
  const [turmaFiltro, setTurmaFiltro] = useState('');
  const [busca, setBusca]             = useState('');
  const [listaAlunos, setListaAlunos] = useState<Aluno[]>([]);
  const [alunoSel, setAlunoSel]       = useState<Aluno | null>(null);
  const [dataIni, setDataIni]         = useState('');
  const [dataFim, setDataFim]         = useState('');
  const [dados, setDados]             = useState<any>(null);
  const [loadingLista, setLoadingLista] = useState(false);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);

  // Carrega lista de alunos sempre que turma ou busca mudar
  const carregarLista = useCallback(async () => {
    const params: any = {};
    if (turmaFiltro) params.turma_id = turmaFiltro;
    if (busca.trim().length >= 2) params.nome = busca.trim();
    // Sem filtro algum → limpa lista mas não faz request
    if (!turmaFiltro && busca.trim().length < 2) { setListaAlunos([]); return; }
    setLoadingLista(true);
    try {
      const r = await api.get('/academico/alunos', { params });
      setListaAlunos(r.data as Aluno[]);
    } catch { /* silencioso */ }
    setLoadingLista(false);
  }, [turmaFiltro, busca]);

  useEffect(() => {
    if (turmaFiltro) {
      // Turma selecionada → carrega imediatamente
      carregarLista();
    } else {
      // Só busca por nome → debounce 300ms
      const t = setTimeout(carregarLista, 300);
      return () => clearTimeout(t);
    }
  }, [turmaFiltro, busca, carregarLista]);

  const selecionarAluno = (a: Aluno) => { setAlunoSel(a); setDados(null); };

  const carregarRelatorio = useCallback(async () => {
    if (!alunoSel) return;
    setLoadingRelatorio(true);
    try {
      const params: any = {};
      if (dataIni) params.data_ini = dataIni;
      if (dataFim) params.data_fim = dataFim;
      const r = await api.get(`/academico/presenca/relatorio/aluno/${alunoSel.id}`, { params });
      setDados(r.data);
    } catch { /* silencioso */ }
    setLoadingRelatorio(false);
  }, [alunoSel, dataIni, dataFim]);

  useEffect(() => { if (alunoSel) carregarRelatorio(); }, [carregarRelatorio]);

  const fmtData = (v: string) => {
    if (!v) return '–';
    const [, m, d] = v.split('-');
    return `${d}/${m}`;
  };

  const taxaColor  = (v: number) => v >= 75 ? 'text-green-600 bg-green-50' : v >= 50 ? 'text-amber-600 bg-amber-50' : 'text-red-500 bg-red-50';
  const taxaBorder = (v: number) => v >= 75 ? 'border-green-200' : v >= 50 ? 'border-amber-200' : 'border-red-200';

  const listaBuscada = busca.trim().length >= 2 || turmaFiltro ? listaAlunos : [];
  const semFiltro    = !turmaFiltro && busca.trim().length < 2;

  return (
    <div className="space-y-4">
      {/* ── Filtros ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          {/* Turma */}
          <div className="flex-1 min-w-[180px]">
            <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Filtrar por Turma</label>
            <select value={turmaFiltro} onChange={e => { setTurmaFiltro(e.target.value); setAlunoSel(null); setDados(null); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
              <option value="">Todas as turmas</option>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          {/* Busca por nome */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Buscar por Nome</label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={busca}
                onChange={e => { setBusca(e.target.value); setAlunoSel(null); setDados(null); }}
                placeholder="Nome do aluno..."
                className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              {loadingLista && <RefreshCw size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />}
            </div>
          </div>
        </div>

        {/* Filtros de período — só mostram quando um aluno está selecionado */}
        {alunoSel && (
          <div className="flex flex-wrap items-end gap-3 pt-1 border-t border-slate-100">
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Período — De</label>
              <input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Até</label>
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <button onClick={carregarRelatorio} disabled={loadingRelatorio}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-black uppercase disabled:opacity-40">
              <RefreshCw size={12} className={loadingRelatorio ? 'animate-spin' : ''} /> Atualizar
            </button>
            <button onClick={() => { setAlunoSel(null); setDados(null); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-slate-500 text-[10px] font-black uppercase hover:bg-slate-50">
              <X size={12} /> Trocar aluno
            </button>
          </div>
        )}
      </div>

      {/* ── Lista de alunos (quando nenhum selecionado) ── */}
      {!alunoSel && (
        <>
          {semFiltro && (
            <div className="py-14 text-center">
              <Users size={40} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-bold text-slate-400">Selecione uma turma ou busque por nome.</p>
              <p className="text-xs text-slate-300 mt-1">Depois clique no aluno para ver o relatório de presença.</p>
            </div>
          )}

          {!semFiltro && loadingLista && (
            <div className="py-10 text-center text-sm text-slate-400">
              <RefreshCw size={22} className="animate-spin mx-auto mb-2 text-slate-300" /> Carregando alunos...
            </div>
          )}

          {!semFiltro && !loadingLista && listaBuscada.length === 0 && (
            <div className="py-10 text-center text-sm text-slate-400">Nenhum aluno encontrado.</div>
          )}

          {!semFiltro && !loadingLista && listaBuscada.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                  {turmaFiltro ? turmas.find(t => t.id === turmaFiltro)?.nome ?? 'Turma' : 'Resultados da Busca'}
                </h3>
                <span className="text-[9px] text-slate-400">{listaBuscada.length} aluno{listaBuscada.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-slate-50 max-h-[480px] overflow-y-auto">
                {listaBuscada.map(a => (
                  <button key={a.id} onClick={() => selecionarAluno(a)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-purple-50/60 transition-colors text-left group">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center font-black text-purple-600 text-xs shrink-0 group-hover:bg-purple-200 transition-colors">
                      {(a.nome_completo || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate group-hover:text-purple-700">{a.nome_completo}</p>
                      {a.turma_nome && <p className="text-[9px] text-slate-400">{a.turma_nome}</p>}
                    </div>
                    <ChevronDown size={13} className="text-slate-300 group-hover:text-purple-400 rotate-[-90deg] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Relatório do aluno selecionado ── */}
      {alunoSel && loadingRelatorio && (
        <div className="py-12 text-center text-sm text-slate-400">
          <RefreshCw size={24} className="animate-spin mx-auto mb-3 text-slate-300" /> Carregando...
        </div>
      )}

      {alunoSel && dados && !loadingRelatorio && (
        <>
          {/* Cabeçalho */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center font-black text-purple-600 text-sm shrink-0">
              {alunoSel.nome_completo[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-slate-800 text-sm truncate">{alunoSel.nome_completo}</p>
              <p className="text-[10px] text-slate-400">{alunoSel.turma_nome || 'Sem turma atribuída'}</p>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: 'Total Aulas',   value: dados.kpi.total ?? 0,        color: 'text-slate-700',  bg: 'bg-white border-slate-100' },
              { label: 'Presenças',     value: dados.kpi.presentes ?? 0,    color: 'text-green-700',  bg: 'bg-green-50 border-green-100' },
              { label: 'Faltas',        value: dados.kpi.faltas ?? 0,       color: 'text-red-600',    bg: 'bg-red-50 border-red-100' },
              { label: 'Justificadas',  value: dados.kpi.justificadas ?? 0, color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-100' },
              { label: 'Taxa Presença', value: `${dados.kpi.taxa ?? 0}%`,
                color: (dados.kpi.taxa ?? 0) >= 75 ? 'text-green-700' : (dados.kpi.taxa ?? 0) >= 50 ? 'text-amber-600' : 'text-red-600',
                bg: `bg-white border ${taxaBorder(dados.kpi.taxa ?? 0)}` },
            ].map(k => (
              <div key={k.label} className={`${k.bg} rounded-2xl p-4 border shadow-sm`}>
                <p className="text-[9px] font-black uppercase text-slate-400 mb-1">{k.label}</p>
                <p className={`text-3xl font-black ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Gráfico mensal */}
          {dados.tendencia_mensal?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-4">Presença por Mês</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dados.tendencia_mensal} margin={{ right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="mes" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10 }} />
                  <Legend wrapperStyle={{ fontSize: 9 }} />
                  <Bar dataKey="presentes" fill="#22c55e" name="Presenças" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="faltas"    fill="#ef4444" name="Faltas"    radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Histórico detalhado */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Histórico Detalhado</h3>
              <span className="text-[9px] text-slate-400">{dados.registros.length} registro{dados.registros.length !== 1 ? 's' : ''}</span>
            </div>
            {dados.registros.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">Nenhum registro no período.</div>
            ) : (
              <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto">
                {dados.registros.map((r: any) => {
                  const corBadge = r.descricao === 'Presente'
                    ? 'bg-green-100 text-green-700'
                    : r.isento ? 'bg-slate-100 text-slate-500'
                    : r.justificada ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-600';
                  return (
                    <div key={r.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50/50 transition-colors">
                      <span className="text-xs font-black text-slate-700 w-16 shrink-0">{fmtData(r.data)}</span>
                      <span className="flex-1 text-xs text-slate-600 truncate min-w-0">{r.tema_aula || '–'}</span>
                      <span className="text-[9px] text-slate-400 shrink-0 hidden sm:block truncate max-w-[110px]">{r.turma_nome}</span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ${corBadge}`}>
                        {r.descricao === 'Falta Justificada' ? 'Justificada' : r.descricao}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab: Presença ───────────────────────────────────────────────────────────

function PresencaTab({ turmas, podeEditar }: { turmas: Turma[]; podeEditar: boolean }) {
  const { user } = useAuth();
  const { canAccess } = usePermissions(user);
  const podeIncluir = podeEditar || canAccess('academico', 'incluir');
  const podeEditarSessao = ['admin', 'prt'].includes(user?.role ?? '') || podeEditar;
  const [subTab, setSubTab] = useState<'historico' | 'relatorios' | 'por-aluno'>('historico');

  // ─── Filtros do histórico ───────────────────────────────────────────────
  const [filtroTurma, setFiltroTurma] = useState('');
  const [filtroDataIni, setFiltroDataIni] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [sessoes, setSessoes] = useState<PresencaSessao[]>([]);
  const [carregandoHist, setCarregandoHist] = useState(false);
  const [sessaoExpandida, setSessaoExpandida] = useState<string | null>(null);
  const [detalhesSessao, setDetalhesSessao] = useState<Record<string, any[]>>({});
  const [modoEdicaoSessao, setModoEdicaoSessao] = useState<string | null>(null);

  // ─── Edição de registro individual ──────────────────────────────────────
  const [salvandoRegistro, setSalvandoRegistro] = useState<string | null>(null);

  const editarRegistro = async (sessaoId: string, registroId: string, descricao: string) => {
    setSalvandoRegistro(registroId);
    try {
      await api.patch(`/academico/presenca/registros/${registroId}`, { descricao });
      const r = await api.get(`/academico/presenca/sessoes/${sessaoId}/registros`);
      setDetalhesSessao(p => ({ ...p, [sessaoId]: r.data }));
      await carregarHistorico();
    } catch {}
    setSalvandoRegistro(null);
  };

  // ─── Modal editar sessão ─────────────────────────────────────────────────
  const [sessaoEditando, setSessaoEditando] = useState<PresencaSessao | null>(null);
  const [formEdicao, setFormEdicao] = useState<{ data: string; tema_aula: string; conteudo_abordado: string }>({ data: '', tema_aula: '', conteudo_abordado: '' });
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);

  // ─── Modal nova lista ────────────────────────────────────────────────────
  const [etapa, setEtapa] = useState<1 | 2>(1);
  const [showModal, setShowModal] = useState(false);
  const [formSessao, setFormSessao] = useState<{
    turma_id: string; data: string; tema_aula: string; conteudo_abordado: string;
  }>({ turma_id: '', data: new Date().toISOString().slice(0, 10), tema_aula: '', conteudo_abordado: '' });
  const [alunosSessao, setAlunosSessao] = useState<Aluno[]>([]);
  const [presenca, setPresenca] = useState<Record<string, boolean>>({});
  const [isento, setIsento] = useState<Record<string, boolean>>({});
  const [justificada, setJustificada] = useState<Record<string, boolean>>({});
  const [carregandoAlunos, setCarregandoAlunos] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);

  const [linkCopiado, setLinkCopiado] = useState(false);

  // ─── Feriados ────────────────────────────────────────────────────────────
  const [feriados, setFeriados] = useState<Record<string, string>>({});
  useEffect(() => {
    const ano = new Date().getFullYear();
    api.get('/academico/feriados', { params: { ano } })
      .then(r => {
        const map: Record<string, string> = {};
        (r.data ?? []).forEach((f: any) => { map[f.data] = f.descricao; });
        setFeriados(map);
      })
      .catch(() => {});
  }, []);

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
    setAlunosSessao([]); setPresenca({}); setIsento({}); setJustificada({}); setErroModal(null); setEtapa(1);
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

  // ─── FIX #2: gerarLinkChamada agora usa linkCopiado corretamente ─────────
  // ─── FIX #3: botão de link envolvido em podeEditar (ver JSX abaixo) ──────
  const gerarLinkChamada = () => {
    if (!formSessao.turma_id)         { setErroModal('Selecione uma turma.');     return; }
    if (!formSessao.data)             { setErroModal('Informe a data da aula.'); return; }
    if (!formSessao.tema_aula.trim()) { setErroModal('Informe o tema da aula.'); return; }
    const chamadaToken = process.env.NEXT_PUBLIC_CHAMADA_TOKEN || 'itp-chamada-2026';
    const url = `${window.location.origin}/academico/chamada?token=${chamadaToken}&turma_id=${formSessao.turma_id}&data=${formSessao.data}&tema_aula=${encodeURIComponent(formSessao.tema_aula)}&conteudo_abordado=${encodeURIComponent(formSessao.conteudo_abordado)}`;
    navigator.clipboard.writeText(url).catch(() => window.open(url, '_blank'));
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 3000);
  };

  const salvarLista = async () => {
    setSalvando(true); setErroModal(null);
    try {
      await api.post('/academico/presenca/sessoes', {
        turma_id:          formSessao.turma_id,
        data:              formSessao.data,
        tema_aula:         formSessao.tema_aula,
        conteudo_abordado: formSessao.conteudo_abordado,
        registros: alunosSessao.map(a => ({ aluno_id: a.id, presente: presenca[a.id] ?? true, isento: isento[a.id] ?? false, justificada: justificada[a.id] ?? false })),
      });
      setShowModal(false);
      carregarHistorico();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Erro ao salvar.';
      setErroModal(Array.isArray(msg) ? msg.join(', ') : msg);
    }
    setSalvando(false);
  };

  const abrirEdicao = (s: PresencaSessao) => {
    setFormEdicao({ data: s.data, tema_aula: s.tema_aula ?? '', conteudo_abordado: s.conteudo_abordado ?? '' });
    setErroEdicao(null);
    setSessaoEditando(s);
  };

  const salvarEdicao = async () => {
    if (!sessaoEditando) return;
    if (!formEdicao.data) { setErroEdicao('Informe a data da aula.'); return; }
    if (!formEdicao.tema_aula.trim()) { setErroEdicao('Informe o tema da aula.'); return; }
    setSalvandoEdicao(true); setErroEdicao(null);
    try {
      await api.patch(`/academico/presenca/sessoes/${sessaoEditando.id}`, formEdicao);
      setSessaoEditando(null);
      carregarHistorico();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Erro ao salvar.';
      setErroEdicao(Array.isArray(msg) ? msg.join(', ') : msg);
    }
    setSalvandoEdicao(false);
  };

  const presentes    = alunosSessao.filter(a => !isento[a.id] && !justificada[a.id] && presenca[a.id]).length;
  const ausentes     = alunosSessao.filter(a => !isento[a.id] && !justificada[a.id] && !presenca[a.id]).length;
  const isentos      = alunosSessao.filter(a => isento[a.id]).length;
  const justificados = alunosSessao.filter(a => justificada[a.id]).length;

  const fmtData = (v: string) => {
    if (!v) return '–';
    const [y, m, d] = v.split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="space-y-4">
      {/* ─── Sub-tabs ─────────────────────────────────────────────────────── */}
      <div className="flex bg-white border border-slate-100 shadow-sm rounded-2xl p-1.5 gap-1">
        {([
          { id: 'historico',  label: 'Histórico',  Icon: History  },
          { id: 'relatorios', label: 'Relatórios', Icon: Activity },
          { id: 'por-aluno',  label: 'Por Aluno',  Icon: User     },
        ] as const).map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setSubTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
              subTab === id ? 'bg-purple-600 text-white shadow' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}>
            <Icon size={11} /> {label}
          </button>
        ))}
      </div>

      {subTab === 'relatorios' && <RelatoriosPresencaSubTab turmas={turmas} />}
      {subTab === 'por-aluno'  && <PorAlunoSubTab turmas={turmas} />}

      {subTab === 'historico' && (<>
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
        {/* FIX #3: botão já estava protegido por podeEditar — mantido */}
        <a href="/chamada-professor" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-colors">
          <Smartphone size={13}/> Portal do Professor
        </a>
        {podeIncluir && (
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
            {podeIncluir && <p className="text-xs text-slate-300 mt-1">Clique em &quot;Nova Lista de Presença&quot; para começar.</p>}
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
                    {podeEditarSessao && (
                      <button onClick={() => abrirEdicao(s)}
                        title="Editar data / tema"
                        className="flex items-center gap-1 text-[9px] font-black uppercase text-slate-400 hover:text-amber-600 border border-slate-200 hover:border-amber-300 hover:bg-amber-50 px-2.5 py-1 rounded-lg transition-colors">
                        <Edit3 size={10}/> Editar
                      </button>
                    )}
                  </div>
                </div>
                {sessaoExpandida === s.id && (
                  <div className="bg-slate-50/60 border-t border-slate-100 px-6 py-3 space-y-3">
                    {s.conteudo_abordado && (
                      <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                        <p className="text-[9px] font-black uppercase text-purple-500 mb-1">Conteúdo Abordado</p>
                        <p className="text-xs text-slate-700">{s.conteudo_abordado}</p>
                      </div>
                    )}

                    {/* Barra de edição — só admin/prt */}
                    {podeEditarSessao && detalhesSessao[s.id]?.length > 0 && (
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                          {detalhesSessao[s.id].length} aluno{detalhesSessao[s.id].length !== 1 ? 's' : ''}
                        </p>
                        <button
                          onClick={() => setModoEdicaoSessao(modoEdicaoSessao === s.id ? null : s.id)}
                          className={`flex items-center gap-1.5 text-[9px] font-black uppercase px-3 py-1.5 rounded-lg border transition-all ${
                            modoEdicaoSessao === s.id
                              ? 'bg-amber-100 border-amber-300 text-amber-700'
                              : 'border-slate-200 text-slate-500 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700'
                          }`}>
                          <Edit3 size={10}/>
                          {modoEdicaoSessao === s.id ? 'Sair da edição' : 'Corrigir Presenças'}
                        </button>
                      </div>
                    )}

                    {!detalhesSessao[s.id] ? (
                      <p className="text-xs text-slate-400">Carregando...</p>
                    ) : detalhesSessao[s.id].length === 0 ? (
                      <p className="text-xs text-slate-400">Nenhum registro encontrado.</p>
                    ) : modoEdicaoSessao === s.id ? (
                      /* ── Modo edição ── */
                      <div className="space-y-1.5">
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center gap-2">
                          <Edit3 size={11} className="text-amber-600 shrink-0"/>
                          <p className="text-[10px] font-black text-amber-700">Modo edição — clique no status para alterar. Salva automaticamente.</p>
                        </div>
                        {detalhesSessao[s.id].map((r: any) => {
                          const isSaving = salvandoRegistro === r.id;
                          const statuses = [
                            { key: 'Presente',         label: 'Presente',    cls: 'bg-green-500 text-white border-green-500',   idle: 'border-slate-200 text-slate-400 hover:border-green-400 hover:bg-green-50 hover:text-green-700' },
                            { key: 'Falta',            label: 'Falta',       cls: 'bg-red-500 text-white border-red-500',       idle: 'border-slate-200 text-slate-400 hover:border-red-400 hover:bg-red-50 hover:text-red-600' },
                            { key: 'Falta Justificada',label: 'Justificada', cls: 'bg-amber-500 text-white border-amber-500',   idle: 'border-slate-200 text-slate-400 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-600' },
                            { key: 'Isento',           label: 'Isento',      cls: 'bg-slate-400 text-white border-slate-400',   idle: 'border-slate-200 text-slate-400 hover:border-slate-400 hover:bg-slate-100' },
                          ];
                          return (
                            <div key={r.id} className={`flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-slate-100 shadow-sm ${isSaving ? 'opacity-50' : ''}`}>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-800 truncate">{r.aluno_nome || r.aluno_id}</p>
                              </div>
                              <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                                {statuses.map(st => (
                                  <button key={st.key}
                                    disabled={isSaving || r.descricao === st.key}
                                    onClick={() => editarRegistro(s.id, r.id, st.key)}
                                    className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border transition-all ${
                                      r.descricao === st.key ? st.cls : st.idle
                                    } disabled:cursor-default`}>
                                    {st.label}
                                  </button>
                                ))}
                              </div>
                              {isSaving && <RefreshCw size={11} className="text-slate-400 animate-spin shrink-0"/>}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* ── Modo visualização ── */
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                        {detalhesSessao[s.id].map((r: any) => {
                          const cor = r.descricao === 'Presente' ? 'bg-green-50 text-green-700 border-green-100'
                            : r.isento ? 'bg-slate-50 text-slate-500 border-slate-200'
                            : r.justificada ? 'bg-amber-50 text-amber-700 border-amber-100'
                            : 'bg-red-50 text-red-600 border-red-100';
                          const dot = r.descricao === 'Presente' ? 'bg-green-500'
                            : r.isento ? 'bg-slate-400'
                            : r.justificada ? 'bg-amber-400'
                            : 'bg-red-400';
                          return (
                            <div key={r.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border ${cor}`}>
                              <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                              <span className="truncate flex-1">{r.aluno_nome || r.aluno_id}</span>
                              <span className="shrink-0 text-[9px] uppercase">{r.descricao}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      </>)}

      {/* ─── Modal Nova Lista de Presença ───────────────────────────────────── */}
      {/* ─── Modal Editar Sessão ────────────────────────────────────────────── */}
      {sessaoEditando && (
        <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b">
              <div>
                <h3 className="font-black text-sm uppercase tracking-tight text-slate-800">Editar Lista de Presença</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase mt-0.5">{sessaoEditando.turma_nome || '–'}</p>
              </div>
              <button onClick={() => setSessaoEditando(null)} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400"><X size={16}/></button>
            </div>
            <div className="p-5 space-y-3">
              {erroEdicao && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold rounded-xl px-4 py-2.5 uppercase tracking-wide">
                  ⚠ {erroEdicao}
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500">Data da Aula *</label>
                <input type="date" value={formEdicao.data} onChange={e => setFormEdicao(p => ({ ...p, data: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500">Tema da Aula *</label>
                <input type="text" value={formEdicao.tema_aula} onChange={e => setFormEdicao(p => ({ ...p, tema_aula: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500">Conteúdo Abordado</label>
                <textarea value={formEdicao.conteudo_abordado} onChange={e => setFormEdicao(p => ({ ...p, conteudo_abordado: e.target.value }))}
                  rows={3} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setSessaoEditando(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-black text-xs uppercase hover:bg-slate-50">
                  Cancelar
                </button>
                <button onClick={salvarEdicao} disabled={salvandoEdicao}
                  className="flex-1 bg-amber-500 text-white py-2.5 rounded-xl font-black text-xs uppercase hover:bg-amber-600 disabled:opacity-50">
                  {salvandoEdicao ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${feriados[formSessao.data] ? 'border-amber-400 focus:ring-amber-400 bg-amber-50' : 'border-slate-200 focus:ring-purple-400'}`} />
                      {feriados[formSessao.data] && (
                        <p className="text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 mt-1">
                          <AlertTriangle size={11} className="shrink-0" />
                          Feriado: {feriados[formSessao.data]} — Confirme se houve aula neste dia.
                        </p>
                      )}
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
                  <div className="flex flex-col gap-2">
                    <button onClick={avancarParaChamada} disabled={carregandoAlunos}
                      className="w-full bg-purple-600 text-white py-2.5 rounded-xl font-black text-xs uppercase hover:bg-purple-700 disabled:opacity-50">
                      {carregandoAlunos ? 'Carregando alunos...' : 'Iniciar Chamada →'}
                    </button>
                    {podeIncluir && (
                      <button onClick={gerarLinkChamada}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs uppercase border transition-all ${
                          linkCopiado
                            ? 'bg-green-50 border-green-300 text-green-700'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-600'
                        }`}>
                        {linkCopiado
                          ? <><Check size={13}/> Link copiado!</>
                          : <><Smartphone size={13}/> <Copy size={11}/> Abrir Chamada no Celular</>}
                      </button>
                    )}
                  </div>
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
                      {justificados > 0 && <span className="bg-amber-100 text-amber-600 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">{justificados} justif.</span>}
                      {isentos > 0 && <span className="bg-slate-100 text-slate-500 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">{isentos} isentos</span>}
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
                    {alunosSessao.map((a, i) => {
                      const exempto = isento[a.id] ?? false;
                      const justif  = justificada[a.id] ?? false;
                      const presente = presenca[a.id] ?? true;
                      const especial = exempto || justif;
                      return (
                        <div key={a.id}
                          className={`w-full flex items-center gap-2 px-4 py-2.5 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/30'} ${especial ? 'opacity-60' : ''}`}>
                          {/* Toggle presença — desabilitado se isento ou justificada */}
                          <button type="button" disabled={especial}
                            onClick={() => setPresenca(p => ({ ...p, [a.id]: !p[a.id] }))}
                            className={`shrink-0 w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${
                              especial ? 'bg-slate-100 border-slate-200' :
                              presente ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-slate-300'
                            }`}>
                            {!especial && presente && <CheckSquare size={13}/>}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{a.nome_completo}</p>
                            <p className="text-[9px] text-slate-400">{a.numero_matricula || '–'}</p>
                          </div>
                          {/* Badge de status */}
                          <span className={`shrink-0 text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            exempto  ? 'bg-slate-100 text-slate-400' :
                            justif   ? 'bg-amber-100 text-amber-600' :
                            presente ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                          }`}>
                            {exempto ? 'Isento' : justif ? 'Justificada' : presente ? 'Presente' : 'Ausente'}
                          </span>
                          {/* Botão falta justificada */}
                          <button type="button"
                            onClick={() => { setJustificada(p => ({ ...p, [a.id]: !p[a.id] })); if (!justif) setIsento(p => ({ ...p, [a.id]: false })); }}
                            className={`shrink-0 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border transition-all ${
                              justif
                                ? 'bg-amber-200 border-amber-300 text-amber-700'
                                : 'border-slate-200 text-slate-400 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600'
                            }`}
                            title="Falta com justificativa">
                            {justif ? '✕ justif.' : 'justif.'}
                          </button>
                          {/* Botão isento */}
                          <button type="button"
                            onClick={() => { setIsento(p => ({ ...p, [a.id]: !p[a.id] })); if (!exempto) setJustificada(p => ({ ...p, [a.id]: false })); }}
                            className={`shrink-0 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border transition-all ${
                              exempto
                                ? 'bg-slate-200 border-slate-300 text-slate-600'
                                : 'border-slate-200 text-slate-400 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-600'
                            }`}
                            title="Isento — aluno ainda não era matriculado nesta data">
                            {exempto ? '✕ isento' : 'isento'}
                          </button>
                        </div>
                      );
                    })}
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

// ─── Monitoramento ────────────────────────────────────────────────────────────

// Bairros da região de Madureira com posições relativas (x%, y%) no mapa
interface AlunoMapa { id: string; nome: string; foto_url: string | null; }
interface EnderecoGrupo { logradouro: string; bairro: string; cidade: string; cep?: string; tem_cep?: boolean; total: number; alunos: AlunoMapa[]; }

function MapaLeaflet({ enderecos, totalAlunos }: { enderecos: EnderecoGrupo[]; totalAlunos?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const [geocodedCount, setGeocodedCount] = useState(0);
  const totalToGeocode = enderecos.length;
  const alunosNoMapa   = enderecos.reduce((s, e) => s + (e.total || 0), 0);
  const semEndereco    = totalAlunos != null ? Math.max(0, totalAlunos - alunosNoMapa) : 0;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Leaflet CSS
    if (!document.querySelector('#leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css'; link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Custom styles
    if (!document.querySelector('#itp-map-css')) {
      const s = document.createElement('style'); s.id = 'itp-map-css';
      s.innerHTML = `
        .itp-label { background:#7c3aed;color:#fff;font-size:11px;font-weight:900;
          padding:2px 7px;border-radius:20px;white-space:nowrap;
          box-shadow:0 2px 6px rgba(124,58,237,.4);border:1.5px solid #5b21b6;pointer-events:none; }
        .itp-popup .leaflet-popup-content-wrapper { border-radius:12px;padding:0;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.15); }
        .itp-popup .leaflet-popup-content { margin:0; }
        .itp-popup .leaflet-popup-tip-container { display:none; }
        .itp-av { width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid #e2e8f0;flex-shrink:0; }
        .itp-ini { width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#4f46e5);
          display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:900;flex-shrink:0; }
      `;
      document.head.appendChild(s);
    }

    import('leaflet').then((L: any) => {
      delete L.Icon.Default.prototype._getIconUrl;

      const map = L.map(containerRef.current!, { center: [-22.8783, -43.3364], zoom: 14 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 19,
      }).addTo(map);
      mapRef.current = { map, L };

      const CACHE_KEY = 'itp_geo_v4'; // bump: agora agrupa por CEP
      let cache: Record<string, any> = {};
      try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch {}
      const saveCache = () => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {} };

      const API_BASE = (typeof window !== 'undefined' ? (window as any).__NEXT_PUBLIC_API_BASE_URL : '') || '';

      const buildPopupHtml = (e: EnderecoGrupo) => {
        const lista = (e.alunos || []).slice(0, 8);
        const resto = (e.alunos || []).slice(8);
        const avatares = lista.map(a => {
          const src = a.foto_url ? (a.foto_url.startsWith('http') ? a.foto_url : `${API_BASE}${a.foto_url}`) : null;
          const ini = (a.nome || '?').trim()[0].toUpperCase();
          return src
            ? `<img class="itp-av" src="${src}" alt="${a.nome}" title="${a.nome}" onerror="this.outerHTML='<div class=itp-ini title=\'${a.nome}\'>${ini}</div>'">`
            : `<div class="itp-ini" title="${a.nome}">${ini}</div>`;
        }).join('');
        return `
          <div style="font-family:system-ui,sans-serif;padding:14px 16px;min-width:200px;max-width:280px">
            <div style="font-size:12px;font-weight:900;color:#1e293b;margin-bottom:2px">${e.logradouro || e.bairro}</div>
            <div style="font-size:10px;color:#64748b;margin-bottom:10px">${e.bairro}${e.cidade !== 'Rio de Janeiro' ? ' · ' + e.cidade : ''}</div>
            <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px">${avatares}</div>
            ${resto.length ? `<div style="font-size:9px;color:#94a3b8;margin-top:4px">+${resto.length} mais: ${resto.map(a => a.nome.split(' ')[0]).join(', ')}</div>` : ''}
            <div style="margin-top:8px;padding-top:6px;border-top:1px solid #f1f5f9;font-size:11px;font-weight:900;color:#7c3aed">${e.total} aluno${e.total > 1 ? 's' : ''} nesta rua</div>
          </div>`;
      };

      const midOfLine = (coords: any[]): [number, number] => {
        const pts: [number,number][] = [];
        const collect = (c: any) => {
          if (typeof c[0] === 'number') pts.push(c as [number,number]);
          else c.forEach(collect);
        };
        coords.forEach(collect);
        const mid = pts[Math.floor(pts.length / 2)] || [0, 0];
        return [mid[1], mid[0]]; // [lat, lng]
      };

      const drawLine = (e: EnderecoGrupo, geom: any) => {
        const weight = 5 + Math.min(e.total - 1, 8);
        const popup  = L.popup({ className: 'itp-popup', closeButton: true, autoPan: true }).setContent(buildPopupHtml(e));
        const layer  = L.geoJSON(geom, {
          style: { color: '#7c3aed', weight, opacity: 0.75, lineCap: 'round', lineJoin: 'round' },
        }).addTo(map);

        layer.on('mouseover', (ev: any) => {
          layer.setStyle({ color: '#4f46e5', weight: weight + 3 });
          popup.setLatLng(ev.latlng).openOn(map);
        });
        layer.on('mouseout', () => { layer.setStyle({ color: '#7c3aed', weight }); map.closePopup(); });
        layer.on('click',     (ev: any) => { popup.setLatLng(ev.latlng).openOn(map); });

        // Count label at midpoint
        const coords = geom.type === 'MultiLineString' ? geom.coordinates.flat(1) : geom.coordinates;
        const mid = midOfLine(coords);
        L.marker(mid, {
          icon: L.divIcon({ html: `<div class="itp-label">${e.total}</div>`, className: '', iconAnchor: [0, 0] }),
          interactive: false,
        }).addTo(map);
      };

      const drawCircle = (e: EnderecoGrupo, lat: number, lng: number) => {
        const popup = L.popup({ className: 'itp-popup', closeButton: true }).setContent(buildPopupHtml(e));
        const c = L.circleMarker([lat, lng], {
          radius: 10 + Math.min(e.total * 2, 18),
          fillColor: '#7c3aed', color: '#4c1d95', weight: 2, fillOpacity: 0.7,
        }).addTo(map);
        c.on('mouseover', (ev: any) => { popup.setLatLng(ev.latlng).openOn(map); });
        c.on('mouseout',  ()         => { map.closePopup(); });
        c.on('click',     (ev: any) => { popup.setLatLng(ev.latlng).openOn(map); });
        L.marker([lat, lng], {
          icon: L.divIcon({ html: `<div class="itp-label">${e.total}</div>`, className: '', iconAnchor: [-4, 20] }),
          interactive: false,
        }).addTo(map);
      };

      let queued = 0;
      enderecos.forEach(e => {
        // Chave de cache: CEP tem prioridade sobre endereço textual
        const cepLimpo = (e.cep || '').replace(/\D/g, '');
        const key = cepLimpo.length === 8 ? `cep:${cepLimpo}` : `${e.logradouro}|${e.bairro}|${e.cidade}`;
        const hit = cache[key];
        if (hit) {
          if (hit.type === 'line') drawLine(e, hit.geom);
          else drawCircle(e, hit.lat, hit.lng);
          setGeocodedCount(c => c + 1);
          return;
        }
        queued++;
        setTimeout(async () => {
          try {
            let feat: any = null;
            if (cepLimpo.length === 8) {
              // Estratégia 1: ViaCEP para lat/lng precisos
              try {
                const vr = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
                const vd = await vr.json();
                if (!vd.erro && vd.logradouro) {
                  // Geocodifica o endereço completo retornado pelo ViaCEP — mais preciso
                  const addr = [vd.logradouro, vd.bairro, vd.localidade, vd.uf, 'Brasil'].filter(Boolean).join(', ');
                  const nr = await fetch(`https://nominatim.openstreetmap.org/search?format=geojson&polygon_geojson=1&limit=1&q=${encodeURIComponent(addr)}`);
                  const nd = await nr.json();
                  feat = nd.features?.[0];
                }
              } catch {}
              // Fallback: buscar diretamente pelo CEP no Nominatim
              if (!feat) {
                const nr = await fetch(`https://nominatim.openstreetmap.org/search?format=geojson&polygon_geojson=1&limit=1&postalcode=${cepLimpo}&countrycodes=br`);
                const nd = await nr.json();
                feat = nd.features?.[0];
              }
            } else {
              // Sem CEP: endereço textual
              const q = [e.logradouro, e.bairro, e.cidade, 'RJ', 'Brasil'].filter(Boolean).join(', ');
              const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=geojson&polygon_geojson=1&limit=1&q=${encodeURIComponent(q)}`);
              const data = await resp.json();
              feat = data.features?.[0];
            }
            if (feat) {
              const geom = feat.geometry;
              if (geom?.type === 'LineString' || geom?.type === 'MultiLineString') {
                cache[key] = { type: 'line', geom };
                saveCache();
                drawLine(e, geom);
              } else {
                const bb = feat.bbox || [0, 0, 0, 0];
                const lat = (bb[1] + bb[3]) / 2, lng = (bb[0] + bb[2]) / 2;
                cache[key] = { type: 'circle', lat, lng };
                saveCache();
                drawCircle(e, lat, lng);
              }
            }
          } catch {}
          setGeocodedCount(c => c + 1);
        }, queued * 1400); // 1.4s gap — respeita rate limit Nominatim (1 req/s)
      });
    });

    return () => { if (mapRef.current) { mapRef.current.map.remove(); mapRef.current = null; } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = totalToGeocode > 0 ? Math.round((geocodedCount / totalToGeocode) * 100) : 100;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-purple-600" />
          <p className="text-sm font-black tracking-tight text-slate-700 dark:text-slate-200">
            Distribuição Geográfica de Alunos
          </p>
          <span className="text-[10px] font-bold text-slate-400 hidden sm:inline">· passe o mouse para ver alunos</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-full">
            {alunosNoMapa} aluno{alunosNoMapa !== 1 ? 's' : ''} · {enderecos.length} rua{enderecos.length !== 1 ? 's' : ''}
          </span>
          {semEndereco > 0 && (
            <span className="text-[10px] font-black bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-full" title="Alunos sem rua/bairro cadastrado não aparecem no mapa">
              {semEndereco} sem endereço
            </span>
          )}
          {pct < 100 && (
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[9px] text-slate-400 font-bold">{pct}%</span>
            </div>
          )}
        </div>
      </div>
      <div ref={containerRef} style={{ height: 520, borderRadius: 12, overflow: 'hidden', zIndex: 0 }} />
      <p className="text-[9px] text-slate-400 mt-2 text-right">© OpenStreetMap · Nominatim</p>
    </div>
  );
}

function MonitoramentoTab() {
  const [dados, setDados] = useState<any>(null);
  const [mapa, setMapa] = useState<EnderecoGrupo[]>([]);
  const [turmasSemSessao, setTurmasSemSessao] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, rm, rts] = await Promise.allSettled([
        api.get('/academico/monitoramento'),
        api.get('/academico/monitoramento/mapa'),
        api.get('/academico/presenca/turmas-sem-sessao', { params: { dias: 7 } }),
      ]);
      if (r.status === 'fulfilled') setDados(r.value.data);
      if (rm.status === 'fulfilled') setMapa(rm.value.data ?? []);
      if (rts.status === 'fulfilled') setTurmasSemSessao(rts.value.data ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // useMemo deve vir antes de qualquer early return para não violar rules-of-hooks
  const turmasPresencaKpis = useMemo(() => {
    const tps: any[] = dados?.turmas_presenca ?? [];
    if (!tps.length) return null;
    const comDados = tps.filter((t: any) => t.total_computados > 0);
    if (!comDados.length) return null;
    const medias = comDados.map((t: any) => Math.round(100 * t.presencas / t.total_computados));
    const media = Math.round(medias.reduce((s: number, v: number) => s + v, 0) / medias.length);
    const baixa = comDados.filter((t: any) => Math.round(100 * t.presencas / t.total_computados) < 75).length;
    const melhor = comDados.reduce((a: any, b: any) => (b.presencas / b.total_computados > a.presencas / a.total_computados ? b : a));
    return { media, baixa, totalTurmas: tps.length, melhor };
  }, [dados]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
      <Activity size={32} className="animate-pulse text-purple-400" />
      <p className="text-sm font-bold">Carregando monitoramento...</p>
    </div>
  );

  if (!dados) return (
    <div className="flex justify-center py-16 text-slate-400 text-sm">Erro ao carregar dados.</div>
  );

  const { resumo, top_faltas, top_presencas, turmas_presenca, faltas_frequentes, diario_por_tipo } = dados;

  const kpis = [
    { label: 'Alunos Ativos',    value: resumo.total_alunos,   icon: Users,         color: 'bg-purple-600',  text: 'text-purple-600' },
    { label: 'Taxa de Presença', value: resumo.taxa_presenca != null ? `${resumo.taxa_presenca}%` : '–', icon: TrendingUp, color: 'bg-emerald-600', text: 'text-emerald-600' },
    { label: 'Total de Faltas',  value: resumo.total_faltas,   icon: TrendingDown,  color: 'bg-rose-600',    text: 'text-rose-600' },
    { label: 'Sessões Registradas', value: resumo.total_sessoes, icon: ClipboardCheck, color: 'bg-blue-600', text: 'text-blue-600' },
    { label: 'Registros Diário', value: resumo.total_diario,   icon: History,       color: 'bg-amber-600',   text: 'text-amber-600' },
    { label: 'Justificadas',     value: resumo.total_justificadas, icon: ShieldCheck, color: 'bg-teal-600',  text: 'text-teal-600' },
  ];

  return (
    <div className="space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className={`w-8 h-8 rounded-xl ${k.color} flex items-center justify-center mb-3`}>
              <k.icon size={15} className="text-white" />
            </div>
            <p className={`text-2xl font-black ${k.text}`}>{String(k.value)}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* KPIs de presença por turma */}
      {turmasPresencaKpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center mb-3"><Activity size={15} className="text-white" /></div>
            <p className={`text-2xl font-black ${turmasPresencaKpis.media >= 75 ? 'text-indigo-600' : turmasPresencaKpis.media >= 50 ? 'text-amber-500' : 'text-rose-600'}`}>{turmasPresencaKpis.media}%</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Presença Média por Turma</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className={`w-8 h-8 rounded-xl ${turmasPresencaKpis.baixa > 0 ? 'bg-rose-600' : 'bg-emerald-600'} flex items-center justify-center mb-3`}><TrendingDown size={15} className="text-white" /></div>
            <p className={`text-2xl font-black ${turmasPresencaKpis.baixa > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{turmasPresencaKpis.baixa}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Turmas com Presença &lt; 75%</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className={`w-8 h-8 rounded-xl ${turmasSemSessao.length > 0 ? 'bg-amber-500' : 'bg-emerald-600'} flex items-center justify-center mb-3`}><Clock size={15} className="text-white" /></div>
            <p className={`text-2xl font-black ${turmasSemSessao.length > 0 ? 'text-amber-500' : 'text-emerald-600'}`}>{turmasSemSessao.length}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Turmas sem Chamada (7d)</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center mb-3"><Star size={15} className="text-white" /></div>
            <p className="text-sm font-black text-emerald-600 leading-tight">{turmasPresencaKpis.melhor.turma_nome}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Melhor Presença</p>
          </div>
        </div>
      )}

      {/* Alerta turmas sem sessão */}
      {turmasSemSessao.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={13} className="text-amber-600" />
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">
              Turmas sem chamada nos últimos 7 dias
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {turmasSemSessao.map((t: any) => (
              <span key={t.turma_id} className="text-[10px] font-bold px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full border border-amber-200">
                {t.turma_nome}
                {t.dias_sem_sessao != null && <span className="text-amber-500 ml-1">({t.dias_sem_sessao}d)</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* MAPA — destaque principal, full width */}
      <MapaLeaflet enderecos={mapa} totalAlunos={resumo.total_alunos} />

      {/* Diário por tipo — barras horizontais lado a lado */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
          <History size={13} className="text-purple-600"/> Registros no Diário
        </p>
        {diario_por_tipo.length === 0 ? (
          <p className="text-xs text-slate-400">Sem registros.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {diario_por_tipo.map((d: any) => {
              const colors: Record<string, { bar: string; bg: string; text: string }> = {
                'Avaliação':        { bar: 'bg-blue-500',  bg: 'bg-blue-50 dark:bg-blue-900/20',   text: 'text-blue-600' },
                'Incidente':        { bar: 'bg-rose-500',  bg: 'bg-rose-50 dark:bg-rose-900/20',   text: 'text-rose-600' },
                'Observação':       { bar: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600' },
                'Comunicado':       { bar: 'bg-teal-500',  bg: 'bg-teal-50 dark:bg-teal-900/20',   text: 'text-teal-600' },
                'Lista de Chamada': { bar: 'bg-green-500', bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600' },
              };
              const c = colors[d.tipo] || { bar: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-600' };
              const total = diario_por_tipo.reduce((s: number, x: any) => s + x.total, 0) || 1;
              const pct = Math.round(100 * d.total / total);
              return (
                <div key={d.tipo} className={`${c.bg} rounded-xl p-3`}>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{d.tipo}</p>
                  <p className={`text-2xl font-black mt-1 ${c.text}`}>{d.total}</p>
                  <div className="h-1.5 bg-white/60 dark:bg-slate-800 rounded-full overflow-hidden mt-2">
                    <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1 font-bold">{pct}% do total</p>
                </div>
              );
            })}
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
          <div><span className="text-[9px] text-slate-400 uppercase font-black">Presenças</span><p className="text-lg font-black text-green-600">{resumo.total_presentes}</p></div>
          <div><span className="text-[9px] text-slate-400 uppercase font-black">Faltas</span><p className="text-lg font-black text-red-500">{resumo.total_faltas}</p></div>
          <div><span className="text-[9px] text-slate-400 uppercase font-black">Justificadas</span><p className="text-lg font-black text-amber-500">{resumo.total_justificadas}</p></div>
          <div><span className="text-[9px] text-slate-400 uppercase font-black">Isentos</span><p className="text-lg font-black text-slate-500">{resumo.total_isentos}</p></div>
        </div>
      </div>

      {/* Top faltas + Top presença */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top faltas */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
            <TrendingDown size={13} className="text-rose-500"/> Top Alunos — Mais Faltas
          </p>
          {top_faltas.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">Nenhuma falta registrada ainda.</p>
          ) : (
            <div className="space-y-3">
              {top_faltas.slice(0, 8).map((a: any, i: number) => {
                const turmas: { turma_nome: string; faltas: number; total_aulas: number }[] =
                  Array.isArray(a.turmas_detalhe) ? a.turmas_detalhe : [];
                return (
                  <div key={a.aluno_id} className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white ${i === 0 ? 'bg-rose-500' : i < 3 ? 'bg-orange-400' : 'bg-slate-400'}`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{a.nome_completo}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${i === 0 ? 'bg-rose-500' : i < 3 ? 'bg-orange-400' : 'bg-slate-400'}`}
                              style={{ width: `${Math.round(100 * a.faltas / (top_faltas[0]?.faltas || 1))}%` }} />
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-xs font-black text-rose-600">{a.faltas}</span>
                        <span className="text-[9px] text-slate-400 ml-0.5">falta{a.faltas !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    {turmas.length > 0 && (
                      <div className="ml-8 flex flex-wrap gap-1">
                        {turmas.map(t => (
                          <span key={t.turma_nome} className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800">
                            {t.turma_nome} <span className="opacity-70">({t.faltas}/{t.total_aulas})</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top presença */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
            <Star size={13} className="text-emerald-500"/> Top Alunos — Maior Presença
          </p>
          {top_presencas.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">Nenhuma presença registrada ainda.</p>
          ) : (
            <div className="space-y-2">
              {top_presencas.slice(0, 8).map((a: any, i: number) => (
                <div key={a.aluno_id} className="flex items-center gap-3">
                  <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white ${i === 0 ? 'bg-emerald-500' : i < 3 ? 'bg-teal-400' : 'bg-slate-400'}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{a.nome_completo}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${i === 0 ? 'bg-emerald-500' : i < 3 ? 'bg-teal-400' : 'bg-slate-400'}`}
                          style={{ width: `${a.pct_presenca}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-xs font-black text-emerald-600">{a.pct_presenca}%</span>
                    <span className="text-[9px] text-slate-400 ml-0.5">({a.presencas})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Presença por turma */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Zap size={13} className="text-amber-500"/> Presença por Turma
          </p>
          <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">últimos 90 dias</span>
        </div>
        {turmas_presenca.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">Nenhuma chamada registrada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left py-2 pr-4 text-[9px] font-black uppercase text-slate-400">Turma</th>
                  <th className="text-center py-2 px-2 text-[9px] font-black uppercase text-slate-400">Alunos</th>
                  <th className="text-center py-2 px-2 text-[9px] font-black uppercase text-slate-400">Sessões</th>
                  <th className="text-center py-2 px-2 text-[9px] font-black uppercase text-green-600">Presenças</th>
                  <th className="text-center py-2 px-2 text-[9px] font-black uppercase text-rose-500">Faltas</th>
                  <th className="text-left py-2 pl-4 text-[9px] font-black uppercase text-slate-400">Taxa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {turmas_presenca.map((t: any) => {
                  const pct = t.total_computados > 0 ? Math.round(100 * t.presencas / t.total_computados) : null;
                  return (
                    <tr key={t.turma_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.turma_cor || '#6d28d9' }} />
                          <span className="font-bold text-slate-800 dark:text-slate-200">{t.turma_nome}</span>
                        </div>
                      </td>
                      <td className="text-center py-2.5 px-2 text-slate-500">{t.total_alunos}</td>
                      <td className="text-center py-2.5 px-2 text-slate-400">{t.total_sessoes ?? '–'}</td>
                      <td className="text-center py-2.5 px-2 text-emerald-600 font-bold">{t.presencas}</td>
                      <td className="text-center py-2.5 px-2 text-rose-500 font-bold">{t.faltas}</td>
                      <td className="py-2.5 pl-4">
                        {pct === null ? <span className="text-slate-400 text-[10px]">–</span> : (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden max-w-[80px]">
                              <div className={`h-full rounded-full ${pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                style={{ width: `${pct}%` }} />
                            </div>
                            <span className={`font-black text-[10px] ${pct >= 75 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                              {pct}%
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Faltas Frequentes — alerta crítico ao final, requer ação */}
      {faltas_frequentes.length > 0 && (
        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-rose-600" />
              <p className="text-[10px] font-black uppercase tracking-widest text-rose-600">
                Alunos com Faltas Frequentes — últimos 60 dias
              </p>
            </div>
            <span className="text-[10px] font-black bg-rose-600 text-white px-2.5 py-1 rounded-full">
              {faltas_frequentes.length} aluno{faltas_frequentes.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {faltas_frequentes.map((a: any) => {
              const turmas: { turma_nome: string; faltas: number; total_aulas: number }[] =
                Array.isArray(a.turmas_detalhe) ? a.turmas_detalhe : [];
              return (
                <div key={a.aluno_id} className="bg-white dark:bg-slate-900 rounded-xl px-4 py-3 border border-rose-100 dark:border-rose-900">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{a.nome_completo}</p>
                      <p className="text-[9px] text-slate-400">{a.numero_matricula || '–'}</p>
                    </div>
                    {a.celular && (
                      <a href={`https://wa.me/55${a.celular.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                        className="text-[9px] font-black uppercase px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors shrink-0">
                        WhatsApp
                      </a>
                    )}
                  </div>
                  {turmas.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {turmas.map(t => (
                        <span key={t.turma_nome} className="inline-flex items-center gap-1 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 text-[10px] font-black px-2.5 py-1 rounded-full">
                          {t.turma_nome}
                          <span className="opacity-60">({t.faltas}/{t.total_aulas})</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Botão atualizar */}
      <div className="flex justify-end">
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase text-slate-500 hover:text-purple-600 hover:border-purple-300 transition-all">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Atualizar dados
        </button>
      </div>
    </div>
  );
}

// ─── Acervo de Documentos ─────────────────────────────────────────────────────

const DOCS_LABELS: Record<string, string> = {
  foto_aluno:              'Foto',
  identidade:              'Identidade',
  comprovante_residencia:  'Comp. Residência',
  certidao_nascimento:     'Certidão Nasc.',
  identidade_responsavel:  'Ident. Responsável',
};
const DOCS_OBRIGATORIOS = Object.keys(DOCS_LABELS);

interface AcervoAluno {
  aluno_id: string;
  nome_completo: string;
  inscricao_id: string | null;
  celular: string | null;
  telefone_alternativo: string | null;
  nome_responsavel: string | null;
  email_responsavel: string | null;
  cuidado_especial: string | null;
  turmas: string[];
  docs_presentes: string[];
  docs_faltando: string[];
  completo: boolean;
  lgpd_aceito: boolean;
  data_assinatura_lgpd: string | null;
}

async function exportarAcervoXLSX(alunos: AcervoAluno[]) {
  const rows = alunos.map(a => ({
    Nome:               a.nome_completo,
    Turmas:             a.turmas.join(', '),
    Responsavel:        a.nome_responsavel || '',
    Celular:            a.celular || '',
    Telefone_Alt:       a.telefone_alternativo || '',
    Email_Resp:         a.email_responsavel || '',
    Foto:               a.docs_presentes.includes('foto_aluno') ? 'SIM' : 'NÃO',
    Identidade:         a.docs_presentes.includes('identidade') ? 'SIM' : 'NÃO',
    Comp_Residencia:    a.docs_presentes.includes('comprovante_residencia') ? 'SIM' : 'NÃO',
    Certidao_Nasc:      a.docs_presentes.includes('certidao_nascimento') ? 'SIM' : 'NÃO',
    Ident_Responsavel:  a.docs_presentes.includes('identidade_responsavel') ? 'SIM' : 'NÃO',
    Situacao:           a.completo ? 'COMPLETO' : `FALTANDO: ${a.docs_faltando.map(d => DOCS_LABELS[d] || d).join(', ')}`,
    LGPD_Assinado:      a.lgpd_aceito ? 'SIM' : 'NÃO',
    Data_LGPD:          a.data_assinatura_lgpd ? new Date(a.data_assinatura_lgpd).toLocaleDateString('pt-BR') : '',
  }));

  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Acervo');
  XLSX.writeFile(wb, `acervo_documentos_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function whatsappLink(tel: string | null) {
  if (!tel) return null;
  const n = tel.replace(/\D/g, '');
  if (n.length < 10) return null;
  return `https://wa.me/55${n}`;
}

function AcervoTab() {
  const [dados, setDados] = useState<AcervoAluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'todos' | 'completos' | 'incompletos' | 'lgpd_pendente'>('todos');
  const [busca, setBusca] = useState('');
  const [letraAtiva, setLetraAtiva] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/academico/documentos/acervo');
      setDados(r.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtrados = useMemo(() => {
    return dados.filter(a => {
      if (filtro === 'completos' && !a.completo) return false;
      if (filtro === 'incompletos' && a.completo) return false;
      if (filtro === 'lgpd_pendente' && a.lgpd_aceito) return false;
      if (busca && !a.nome_completo.toLowerCase().includes(busca.toLowerCase())) return false;
      if (letraAtiva) {
        const primeira = a.nome_completo.trim()[0]?.toUpperCase() || '#';
        if (primeira !== letraAtiva) return false;
      }
      return true;
    });
  }, [dados, filtro, busca, letraAtiva]);

  const letras = useMemo(() => {
    const set = new Set(dados.map(a => a.nome_completo.trim()[0]?.toUpperCase() || '#'));
    return Array.from(set).sort();
  }, [dados]);

  const grupos = useMemo(() => {
    const map: Record<string, AcervoAluno[]> = {};
    for (const a of filtrados) {
      const l = a.nome_completo.trim()[0]?.toUpperCase() || '#';
      if (!map[l]) map[l] = [];
      map[l].push(a);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtrados]);

  const stats = useMemo(() => ({
    total: dados.length,
    completos: dados.filter(a => a.completo).length,
    incompletos: dados.filter(a => !a.completo).length,
    lgpd_pendente: dados.filter(a => !a.lgpd_aceito).length,
  }), [dados]);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total de Alunos', val: stats.total,         cls: 'text-purple-600' },
          { label: 'Dossiê Completo', val: stats.completos,     cls: 'text-green-600' },
          { label: 'Docs Faltando',   val: stats.incompletos,   cls: 'text-red-500' },
          { label: 'LGPD Pendente',   val: stats.lgpd_pendente, cls: stats.lgpd_pendente > 0 ? 'text-orange-500' : 'text-green-600' },
        ].map(k => (
          <div key={k.label} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{k.label}</p>
            <p className={`text-3xl font-black ${k.cls}`}>{k.val}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar aluno..."
            className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
        <div className="flex gap-1">
          {(['todos','completos','incompletos','lgpd_pendente'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                ${filtro === f
                  ? f === 'lgpd_pendente' ? 'bg-orange-500 text-white' : 'bg-purple-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-800'}`}>
              {f === 'todos' ? 'Todos' : f === 'completos' ? 'Completos' : f === 'incompletos' ? 'Incompletos' : '⚠ LGPD Pendente'}
            </button>
          ))}
        </div>
        <button onClick={() => { exportarAcervoXLSX(filtrados); }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all ml-auto">
          <FileText size={13} /> Exportar Excel
        </button>
        <button onClick={load} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-purple-100 text-slate-500 hover:text-purple-600 transition-all">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filtro por letra */}
      <div className="flex flex-wrap gap-1">
        <button onClick={() => setLetraAtiva(null)}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all
            ${!letraAtiva ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-800'}`}>
          Todas
        </button>
        {letras.map(l => (
          <button key={l} onClick={() => setLetraAtiva(l === letraAtiva ? null : l)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all
              ${letraAtiva === l ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-800'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-16 text-slate-400 text-sm">Carregando acervo...</div>
      ) : grupos.length === 0 ? (
        <div className="flex justify-center py-16 text-slate-400 text-sm">Nenhum aluno encontrado.</div>
      ) : (
        <div className="space-y-6">
          {grupos.map(([letra, lista]) => (
            <div key={letra}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center text-white font-black text-sm shadow">
                  {letra}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {lista.length} aluno{lista.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-2">
                {lista.map(a => {
                  const wa = whatsappLink(a.celular || a.telefone_alternativo);
                  return (
                    <div key={a.aluno_id}
                      className={`bg-white dark:bg-slate-900 rounded-2xl border shadow-sm p-4 flex flex-wrap gap-4 items-start
                        ${a.completo ? 'border-green-100 dark:border-green-900/30' : 'border-red-100 dark:border-red-900/30'}`}>
                      {/* Nome + turmas */}
                      <div className="flex-1 min-w-[180px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{a.nome_completo}</span>
                          {a.turmas.length > 0 && a.turmas.map(t => (
                            <span key={t} className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                              {t}
                            </span>
                          ))}
                          {a.cuidado_especial && a.cuidado_especial !== 'Não' && (() => {
                            const b = CUIDADO_BADGE[a.cuidado_especial] || { label: 'Cuidado Espec.', color: 'bg-pink-100 text-pink-700 border-pink-200' };
                            return <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${b.color}`}>{b.label}</span>;
                          })()}
                        </div>
                        {a.nome_responsavel && (
                          <p className="text-[10px] text-slate-400 mt-0.5">Resp.: <span className="text-slate-600 dark:text-slate-300">{a.nome_responsavel}</span></p>
                        )}
                        <div className="flex gap-3 mt-1 flex-wrap">
                          {wa && (
                            <a href={wa} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[10px] text-green-600 hover:text-green-700 font-bold transition-colors">
                              <Smartphone size={11} /> WhatsApp
                            </a>
                          )}
                          {a.celular && (
                            <span className="text-[10px] text-slate-400">{a.celular}</span>
                          )}
                        </div>
                      </div>

                      {/* Docs status */}
                      <div className="flex gap-1.5 flex-wrap items-center">
                        {DOCS_OBRIGATORIOS.map(doc => {
                          const ok = a.docs_presentes.includes(doc);
                          return (
                            <span key={doc}
                              title={DOCS_LABELS[doc]}
                              className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide
                                ${ok
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                              {ok ? '✓' : '✗'} {DOCS_LABELS[doc]}
                            </span>
                          );
                        })}
                      </div>

                      {/* Badge status + LGPD */}
                      <div className="self-center flex flex-col gap-1.5 items-end">
                        <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest
                          ${a.completo
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                          {a.completo ? 'Completo' : `${a.docs_faltando.length} faltando`}
                        </span>
                        <span
                          title={a.lgpd_aceito && a.data_assinatura_lgpd
                            ? `Assinado em ${new Date(a.data_assinatura_lgpd).toLocaleDateString('pt-BR')}`
                            : 'Termo LGPD não assinado pelo responsável'}
                          className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest
                            ${a.lgpd_aceito
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 animate-pulse'}`}>
                          {a.lgpd_aceito ? '✓ LGPD' : '⚠ LGPD Pendente'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Chamados ─────────────────────────────────────────────────────────────────

interface Chamado {
  id: string; titulo: string; descricao?: string | null; tipo: string;
  status: string; prioridade: string; aluno_id?: string | null; aluno_nome?: string | null;
  turma_id?: string | null; turma_nome?: string | null; responsavel_nome?: string | null;
  criado_por_nome?: string | null; observacoes?: string | null; data_resolucao?: string | null;
  created_at: string; updated_at: string;
}

const COR_STATUS: Record<string, string> = {
  aberto:       'bg-blue-100 text-blue-700 border-blue-200',
  em_andamento: 'bg-amber-100 text-amber-700 border-amber-200',
  resolvido:    'bg-green-100 text-green-700 border-green-200',
};
const COR_PRIORIDADE: Record<string, string> = {
  baixa:   'border-l-slate-300',
  normal:  'border-l-blue-400',
  alta:    'border-l-orange-400',
  urgente: 'border-l-red-500',
};
const LABEL_STATUS: Record<string, string> = { aberto: 'Aberto', em_andamento: 'Em andamento', resolvido: 'Resolvido' };
const LABEL_PRIO: Record<string, string> = { baixa: 'Baixa', normal: 'Normal', alta: 'Alta', urgente: 'Urgente' };

const TIPOS_CHAMADO = ['Social', 'Acadêmico', 'Saúde', 'Família', 'Financeiro', 'Outro'];
const STATUS_CHAMADO = ['aberto', 'em_andamento', 'resolvido'];
const PRIO_CHAMADO = ['baixa', 'normal', 'alta', 'urgente'];

function ChamadosTab({ alunos, turmas, podeEditar }: { alunos: Aluno[]; turmas: Turma[]; podeEditar: boolean }) {
  const { user } = useAuth();
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [stats, setStats] = useState<{ abertos: number; em_andamento: number; resolvidos: number; urgentes: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [busca, setBusca] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Chamado | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [alunoSearch, setAlunoSearch] = useState('');
  const [form, setForm] = useState({
    titulo: '', descricao: '', tipo: 'Social', prioridade: 'normal', status: 'aberto',
    aluno_id: '', aluno_nome: '', turma_id: '', turma_nome: '', responsavel_nome: '', observacoes: '',
  });

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filtroStatus) params.status = filtroStatus;
      if (filtroTipo) params.tipo = filtroTipo;
      const [rc, rs] = await Promise.all([
        api.get('/academico/chamados', { params }),
        api.get('/academico/chamados/stats'),
      ]);
      setChamados(rc.data);
      setStats(rs.data);
    } catch {}
    setLoading(false);
  }, [filtroStatus, filtroTipo]);

  useEffect(() => { carregar(); }, [carregar]);

  const alunosFiltrados = useMemo(() => {
    if (!alunoSearch.trim()) return alunos.slice(0, 8);
    const s = alunoSearch.toLowerCase();
    return alunos.filter(a => a.nome_completo.toLowerCase().includes(s)).slice(0, 8);
  }, [alunoSearch, alunos]);

  const chamadosFiltrados = useMemo(() => {
    if (!busca.trim()) return chamados;
    const s = busca.toLowerCase();
    return chamados.filter(c =>
      c.titulo.toLowerCase().includes(s) ||
      (c.aluno_nome ?? '').toLowerCase().includes(s) ||
      (c.responsavel_nome ?? '').toLowerCase().includes(s)
    );
  }, [chamados, busca]);

  function abrirNovo() {
    setEditando(null);
    setAlunoSearch('');
    setForm({ titulo: '', descricao: '', tipo: 'Social', prioridade: 'normal', status: 'aberto', aluno_id: '', aluno_nome: '', turma_id: '', turma_nome: '', responsavel_nome: '', observacoes: '' });
    setShowModal(true);
  }

  function abrirEditar(c: Chamado) {
    setEditando(c);
    setAlunoSearch(c.aluno_nome ?? '');
    setForm({
      titulo: c.titulo, descricao: c.descricao ?? '', tipo: c.tipo, prioridade: c.prioridade,
      status: c.status, aluno_id: c.aluno_id ?? '', aluno_nome: c.aluno_nome ?? '',
      turma_id: c.turma_id ?? '', turma_nome: c.turma_nome ?? '',
      responsavel_nome: c.responsavel_nome ?? '', observacoes: c.observacoes ?? '',
    });
    setShowModal(true);
  }

  async function salvar() {
    if (!form.titulo.trim()) return;
    setSalvando(true);
    try {
      const payload = {
        ...form,
        criado_por_nome: editando ? undefined : (user?.nome || user?.email),
      };
      if (editando) await api.patch(`/academico/chamados/${editando.id}`, payload);
      else await api.post('/academico/chamados', payload);
      setShowModal(false);
      carregar();
    } catch {}
    setSalvando(false);
  }

  async function mudarStatus(id: string, status: string) {
    try { await api.patch(`/academico/chamados/${id}`, { status }); carregar(); } catch {}
  }

  async function deletar(id: string) {
    if (!confirm('Excluir este chamado?')) return;
    try { await api.delete(`/academico/chamados/${id}`); carregar(); } catch {}
  }

  const upd = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Abertos', val: stats.abertos, color: 'text-blue-600 bg-blue-50 border-blue-100' },
            { label: 'Em andamento', val: stats.em_andamento, color: 'text-amber-600 bg-amber-50 border-amber-100' },
            { label: 'Resolvidos', val: stats.resolvidos, color: 'text-green-600 bg-green-50 border-green-100' },
            { label: 'Urgentes', val: stats.urgentes, color: 'text-red-600 bg-red-50 border-red-100' },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.color}`}>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{s.label}</p>
              <p className="text-3xl font-black mt-1">{s.val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Controles */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar chamado ou aluno..."
                className="pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl w-52 focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
              className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none">
              <option value="">Todos os status</option>
              {STATUS_CHAMADO.map(s => <option key={s} value={s}>{LABEL_STATUS[s]}</option>)}
            </select>
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
              className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none">
              <option value="">Todos os tipos</option>
              {TIPOS_CHAMADO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button onClick={abrirNovo}
            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black px-4 py-2 rounded-xl transition-colors">
            <Plus size={13} /> Novo Chamado
          </button>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Carregando...</div>
      ) : chamadosFiltrados.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">Nenhum chamado encontrado.</div>
      ) : (
        <div className="space-y-3">
          {chamadosFiltrados.map(c => (
            <div key={c.id} className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 border-l-4 ${COR_PRIORIDADE[c.prioridade] ?? 'border-l-slate-300'} shadow-sm`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${COR_STATUS[c.status] ?? ''}`}>
                      {LABEL_STATUS[c.status] ?? c.status}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{c.tipo}</span>
                    <span className="text-[10px] font-bold text-slate-400">·</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{LABEL_PRIO[c.prioridade] ?? c.prioridade}</span>
                  </div>
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">{c.titulo}</h4>
                  {c.descricao && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{c.descricao}</p>}
                  <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-slate-400">
                    {c.aluno_nome && <span className="flex items-center gap-1"><User size={10} />{c.aluno_nome}</span>}
                    {c.turma_nome && <span className="flex items-center gap-1"><Users size={10} />{c.turma_nome}</span>}
                    {c.responsavel_nome && <span className="flex items-center gap-1"><Shield size={10} />{c.responsavel_nome}</span>}
                    <span className="flex items-center gap-1"><Calendar size={10} />{fmtDate(c.created_at)}</span>
                    {c.data_resolucao && <span className="flex items-center gap-1 text-green-500"><CheckSquare size={10} />Resolvido em {fmtDate(c.data_resolucao)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {c.status !== 'em_andamento' && c.status !== 'resolvido' && (
                    <button onClick={() => mudarStatus(c.id, 'em_andamento')} title="Iniciar atendimento"
                      className="text-[10px] font-black px-2 py-1 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200 transition-colors">
                      Atender
                    </button>
                  )}
                  {c.status !== 'resolvido' && (
                    <button onClick={() => mudarStatus(c.id, 'resolvido')} title="Marcar como resolvido"
                      className="text-[10px] font-black px-2 py-1 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 border border-green-200 transition-colors">
                      Resolver
                    </button>
                  )}
                  {podeEditar && (
                    <button onClick={() => abrirEditar(c)} title="Editar"
                      className="p-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-purple-50 hover:text-purple-600 border border-slate-200 transition-colors">
                      <Edit3 size={12} />
                    </button>
                  )}
                  {podeEditar && (
                    <button onClick={() => deletar(c.id)} title="Excluir"
                      className="p-1.5 rounded-lg bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 border border-slate-200 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
              {c.observacoes && (
                <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700">
                  <span className="font-black text-[10px] uppercase text-slate-400 block mb-1">Observações</span>
                  {c.observacoes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <Modal title={editando ? 'Editar Chamado' : 'Novo Chamado'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <FieldInput label="Título *" value={form.titulo} onChange={v => upd('titulo', v)} required />
            <div className="grid grid-cols-2 gap-3">
              <FieldSelect label="Tipo" value={form.tipo} onChange={v => upd('tipo', v)}
                options={TIPOS_CHAMADO.map(t => ({ value: t, label: t }))} />
              <FieldSelect label="Prioridade" value={form.prioridade} onChange={v => upd('prioridade', v)}
                options={PRIO_CHAMADO.map(p => ({ value: p, label: LABEL_PRIO[p] }))} />
            </div>
            {editando && (
              <FieldSelect label="Status" value={form.status} onChange={v => upd('status', v)}
                options={STATUS_CHAMADO.map(s => ({ value: s, label: LABEL_STATUS[s] }))} />
            )}
            {/* Busca de aluno */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500">Aluno (opcional)</label>
              <input value={alunoSearch} onChange={e => setAlunoSearch(e.target.value)} placeholder="Buscar aluno..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
              {alunoSearch.trim() && (
                <div className="border border-slate-200 rounded-xl overflow-hidden mt-1 max-h-40 overflow-y-auto">
                  {alunosFiltrados.map(a => (
                    <button key={a.id} onClick={() => {
                      const turma = turmas.find(t => a.turmas?.some((ta: any) => ta.id === t.id));
                      upd('aluno_id', a.id); upd('aluno_nome', a.nome_completo);
                      if (turma) { upd('turma_id', turma.id); upd('turma_nome', turma.nome); }
                      setAlunoSearch(a.nome_completo);
                    }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-purple-50 border-b border-slate-100 last:border-0">
                      <span className="font-bold">{a.nome_completo}</span>
                      {a.turma_nome && <span className="text-slate-400 ml-2">· {a.turma_nome}</span>}
                    </button>
                  ))}
                </div>
              )}
              {form.aluno_id && (
                <p className="text-[10px] text-purple-600 font-bold">Vinculado: {form.aluno_nome}</p>
              )}
            </div>
            <FieldInput label="Responsável pelo atendimento" value={form.responsavel_nome} onChange={v => upd('responsavel_nome', v)} />
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500">Descrição</label>
              <textarea value={form.descricao} onChange={e => upd('descricao', e.target.value)} rows={3}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500">Observações / Histórico</label>
              <textarea value={form.observacoes} onChange={e => upd('observacoes', e.target.value)} rows={3}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none" />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-black rounded-xl border border-slate-200 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando || !form.titulo.trim()}
                className="px-4 py-2 text-xs font-black rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60 transition-colors">
                {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Criar Chamado'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Controles Tab ────────────────────────────────────────────────────────────

interface ControleFutebol {
  id: string;
  aluno_id: string;
  aluno_nome?: string;
  aluno_data_nascimento?: string;
  aluno_celular?: string;
  responsavel_nome?: string;
  responsavel_telefone?: string;
  tamanho_camisa?: string;
  tamanho_short?: string;
  numero_chuteira?: string;
  estoque_uniforme_id?: string;
  estoque_chuteira_id?: string;
  uniforme_recebido: boolean;
  chuteira_recebida: boolean;
  status: string;
  observacoes?: string;
  docs_ok?: boolean;
  docs_total_obrig?: number;
  docs_enviados?: number;
  lgpd_aceito?: boolean;
  uniforme_nome?: string;
  chuteira_nome?: string;
}

interface EstoqueProduto { id: string; nome: string; categoria: string; quantidade_atual: number; }

const STATUS_FUTEBOL = ['Pendente', 'Separado', 'Enviado', 'Entregue'];
const STATUS_COLORS: Record<string, string> = {
  Pendente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  Separado: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  Enviado: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  Entregue: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

function ControlesTab({ podeEditar }: { podeEditar: boolean }) {
  const [controles, setControles] = useState<ControleFutebol[]>([]);
  const [estoqueProdutos, setEstoqueProdutos] = useState<EstoqueProduto[]>([]);
  const [alunos, setAlunosCtrl] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [modal, setModal] = useState<{ aberto: boolean; item: ControleFutebol | null }>({ aberto: false, item: null });
  const [form, setForm] = useState<Partial<ControleFutebol>>({});
  const [salvando, setSalvando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [rc, re, ra] = await Promise.all([
        api.get('/academico/controle-futebol'),
        api.get('/academico/estoque-produtos'),
        api.get('/academico/alunos'),
      ]);
      setControles(Array.isArray(rc.data) ? rc.data : []);
      setEstoqueProdutos(Array.isArray(re.data) ? re.data : []);
      setAlunosCtrl(Array.isArray(ra.data) ? ra.data : []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const filtrados = controles.filter(c => {
    const q = busca.toLowerCase();
    const matchBusca = !q || (c.aluno_nome ?? '').toLowerCase().includes(q) || (c.responsavel_nome ?? '').toLowerCase().includes(q);
    const matchStatus = !filtroStatus || c.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  const abrirCriar = () => { setForm({}); setModal({ aberto: true, item: null }); };
  const abrirEditar = (c: ControleFutebol) => { setForm({ ...c }); setModal({ aberto: true, item: c }); };

  const salvar = async () => {
    setSalvando('form');
    try {
      if (modal.item) {
        await api.patch(`/academico/controle-futebol/${modal.item.id}`, form);
      } else {
        await api.post('/academico/controle-futebol', form);
      }
      setModal({ aberto: false, item: null });
      carregar();
    } catch {}
    setSalvando(null);
  };

  const deletar = async (id: string) => {
    if (!confirm('Remover este controle?')) return;
    await api.delete(`/academico/controle-futebol/${id}`);
    carregar();
  };

  const toggleField = async (c: ControleFutebol, field: 'uniforme_recebido' | 'chuteira_recebida') => {
    if (!podeEditar) return;
    const novoval = !c[field];
    setSalvando(c.id + field);
    try {
      await api.patch(`/academico/controle-futebol/${c.id}`, {
        [field]: novoval,
        estoque_uniforme_id: c.estoque_uniforme_id,
        estoque_chuteira_id: c.estoque_chuteira_id,
      });
      carregar();
    } catch {}
    setSalvando(null);
  };

  const mudarStatus = async (c: ControleFutebol, novoStatus: string) => {
    if (!podeEditar) return;
    setSalvando(c.id + 'status');
    try {
      await api.patch(`/academico/controle-futebol/${c.id}`, { status: novoStatus });
      setControles(prev => prev.map(x => x.id === c.id ? { ...x, status: novoStatus } : x));
    } catch {}
    setSalvando(null);
  };

  const stats = {
    total: controles.length,
    uniforme: controles.filter(c => c.uniforme_recebido).length,
    chuteira: controles.filter(c => c.chuteira_recebida).length,
    docsOk: controles.filter(c => c.docs_ok).length,
    entregues: controles.filter(c => c.status === 'Entregue').length,
  };

  return (
    <div className="space-y-6">
      {/* Sub-navegação */}
      <div className="flex gap-2 bg-white dark:bg-slate-900 rounded-2xl p-1.5 border border-slate-100 dark:border-slate-800 w-fit">
        <button className="px-4 py-1.5 rounded-xl bg-green-600 text-white text-sm font-bold flex items-center gap-2">
          <Star size={14} /> Futebol
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total', valor: stats.total, cor: 'blue' },
          { label: 'Uniforme OK', valor: stats.uniforme, cor: 'green' },
          { label: 'Chuteira OK', valor: stats.chuteira, cor: 'yellow' },
          { label: 'Docs OK', valor: stats.docsOk, cor: 'purple' },
          { label: 'Entregues', valor: stats.entregues, cor: 'emerald' },
        ].map(k => (
          <div key={k.label} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 text-center">
            <div className="text-2xl font-black text-slate-800 dark:text-white">{k.valor}</div>
            <div className="text-xs text-slate-500 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Controles + filtros */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="p-4 flex flex-wrap gap-3 items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex gap-2 flex-wrap flex-1">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar aluno ou responsável..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <select
              value={filtroStatus}
              onChange={e => setFiltroStatus(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800"
            >
              <option value="">Todos os status</option>
              {STATUS_FUTEBOL.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          {podeEditar && (
            <button
              onClick={abrirCriar}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              <Plus size={14} /> Adicionar
            </button>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Nenhum registro encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">Aluno</th>
                  <th className="px-4 py-3 text-left">Idade</th>
                  <th className="px-4 py-3 text-left">Responsável</th>
                  <th className="px-4 py-3 text-center">Docs</th>
                  <th className="px-4 py-3 text-center">Tam. Camisa</th>
                  <th className="px-4 py-3 text-center">Tam. Short</th>
                  <th className="px-4 py-3 text-center">Chuteira</th>
                  <th className="px-4 py-3 text-center">Uniforme</th>
                  <th className="px-4 py-3 text-center">Chuteira</th>
                  <th className="px-4 py-3 text-center">Status Galo</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtrados.map(c => {
                  const idade = c.aluno_data_nascimento ? calcularIdade(c.aluno_data_nascimento) : null;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                        {c.aluno_nome ?? '—'}
                        {c.aluno_celular && <div className="text-xs text-slate-400">{c.aluno_celular}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{idade ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700 dark:text-slate-300">{c.responsavel_nome ?? '—'}</div>
                        {c.responsavel_telefone && <div className="text-xs text-slate-400">{c.responsavel_telefone}</div>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.docs_ok
                          ? <span className="inline-flex items-center gap-1 text-green-600 font-semibold text-xs"><ShieldCheck size={12}/>OK</span>
                          : <span className="inline-flex items-center gap-1 text-red-500 text-xs"><AlertTriangle size={12}/>{c.docs_enviados ?? 0}/{c.docs_total_obrig ?? 0}</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">{c.tamanho_camisa ?? '—'}</td>
                      <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">{c.tamanho_short ?? '—'}</td>
                      <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">{c.numero_chuteira ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          disabled={!podeEditar || salvando === c.id + 'uniforme_recebido'}
                          onClick={() => toggleField(c, 'uniforme_recebido')}
                          className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-colors ${c.uniforme_recebido ? 'bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-slate-100 border-slate-300 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}
                        >
                          {c.uniforme_recebido ? '✓ Sim' : 'Não'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          disabled={!podeEditar || salvando === c.id + 'chuteira_recebida'}
                          onClick={() => toggleField(c, 'chuteira_recebida')}
                          className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-colors ${c.chuteira_recebida ? 'bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-slate-100 border-slate-300 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}
                        >
                          {c.chuteira_recebida ? '✓ Sim' : 'Não'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {podeEditar ? (
                          <select
                            value={c.status}
                            disabled={salvando === c.id + 'status'}
                            onChange={e => mudarStatus(c, e.target.value)}
                            className={`px-2 py-1 rounded-lg text-xs font-semibold border-0 ${STATUS_COLORS[c.status] ?? 'bg-slate-100'}`}
                          >
                            {STATUS_FUTEBOL.map(s => <option key={s}>{s}</option>)}
                          </select>
                        ) : (
                          <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${STATUS_COLORS[c.status] ?? 'bg-slate-100'}`}>{c.status}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1">
                          {podeEditar && (
                            <>
                              <button onClick={() => abrirEditar(c)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500"><Edit3 size={13}/></button>
                              <button onClick={() => deletar(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"><Trash2 size={13}/></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal criar/editar */}
      {modal.aberto && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                {modal.item ? 'Editar Controle' : 'Novo Controle — Futebol'}
              </h3>
              <button onClick={() => setModal({ aberto: false, item: null })} className="text-slate-400 hover:text-slate-700"><X size={18}/></button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {!modal.item && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Aluno *</label>
                  <select
                    value={form.aluno_id ?? ''}
                    onChange={e => setForm(f => ({ ...f, aluno_id: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="">Selecione...</option>
                    {alunos.map(a => <option key={a.id} value={a.id}>{a.nome_completo}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Tam. Camisa</label>
                  <input value={form.tamanho_camisa ?? ''} onChange={e => setForm(f => ({ ...f, tamanho_camisa: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800" placeholder="P, M, G..." />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Tam. Short</label>
                  <input value={form.tamanho_short ?? ''} onChange={e => setForm(f => ({ ...f, tamanho_short: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800" placeholder="P, M, G..." />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Nº Chuteira</label>
                  <input value={form.numero_chuteira ?? ''} onChange={e => setForm(f => ({ ...f, numero_chuteira: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800" placeholder="36, 37..." />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Item de Estoque — Uniforme</label>
                <select
                  value={form.estoque_uniforme_id ?? ''}
                  onChange={e => setForm(f => ({ ...f, estoque_uniforme_id: e.target.value || undefined }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800"
                >
                  <option value="">Nenhum</option>
                  {estoqueProdutos.map(p => <option key={p.id} value={p.id}>{p.nome} (qtd: {p.quantidade_atual})</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Item de Estoque — Chuteira</label>
                <select
                  value={form.estoque_chuteira_id ?? ''}
                  onChange={e => setForm(f => ({ ...f, estoque_chuteira_id: e.target.value || undefined }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800"
                >
                  <option value="">Nenhum</option>
                  {estoqueProdutos.map(p => <option key={p.id} value={p.id}>{p.nome} (qtd: {p.quantidade_atual})</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Status Galo</label>
                <select
                  value={form.status ?? 'Pendente'}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800"
                >
                  {STATUS_FUTEBOL.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Observações</label>
                <textarea
                  value={form.observacoes ?? ''}
                  onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={salvar}
                disabled={salvando === 'form'}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700 disabled:opacity-60"
              >
                {salvando === 'form' ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                onClick={() => setModal({ aberto: false, item: null })}
                className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AcademicoPage() {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'grade';
    const VALID = ['grade','alunos','presenca','cursos','turmas','diario','acervo','chamados','monitoramento'];
    const tab = new URLSearchParams(window.location.search).get('tab') ?? 'grade';
    return VALID.includes(tab) ? tab : 'grade';
  });
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const { canWrite: podeEditar } = usePermissions(user);

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
    { id: 'diario',        label: 'Diário',        Icon: History },
    { id: 'acervo',        label: 'Acervo',        Icon: FileText },
    { id: 'chamados',      label: 'Chamados',      Icon: AlertCircle },
    { id: 'monitoramento', label: 'Monitoramento', Icon: Activity },
    { id: 'controles',     label: 'Controles',     Icon: Shield },
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
          {activeTab === 'alunos'   && <AlunosTab cursos={cursos} turmas={turmas} podeEditar={podeEditar} />}
          {activeTab === 'presenca' && <PresencaTab turmas={turmas} podeEditar={podeEditar} />}
          {activeTab === 'cursos'   && <CursosTab />}
          {activeTab === 'turmas'   && <TurmasTab cursos={cursos} professores={professores} alunos={alunos} />}
          {activeTab === 'diario'   && <DiarioTab turmas={turmas} alunos={alunos} />}
          {activeTab === 'acervo'        && <AcervoTab />}
          {activeTab === 'chamados'      && <ChamadosTab alunos={alunos} turmas={turmas} podeEditar={podeEditar} />}
          {activeTab === 'monitoramento' && <MonitoramentoTab />}
          {activeTab === 'controles'     && <ControlesTab podeEditar={podeEditar} />}
        </main>
      </div>
    </div>
  );
}
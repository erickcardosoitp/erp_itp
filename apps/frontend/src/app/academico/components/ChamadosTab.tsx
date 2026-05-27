'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Edit3, Trash2, Search, User, Users, Shield, Calendar, CheckSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { useAuth } from '@/context/auth-context';
import { Aluno, Turma } from './_types';
import { Modal, FieldInput, FieldSelect, fmtDate } from './_shared';

// ─── Local interfaces and constants ──────────────────────────────────────────

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

// ─── ChamadosTab ──────────────────────────────────────────────────────────────

export default function ChamadosTab({ alunos, turmas, podeEditar }: { alunos: Aluno[]; turmas: Turma[]; podeEditar: boolean }) {
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
    if (!form.titulo.trim()) { toast.error('Título é obrigatório.'); return; }
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
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Erro ao salvar chamado.';
      toast.error(msg);
    }
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

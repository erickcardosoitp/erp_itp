'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FolderOpen, Calendar, Edit3, Trash2, X } from 'lucide-react';
import api from '@/services/api';
import { toast } from 'sonner';

interface Projeto {
  id: string;
  nome: string;
  descricao?: string;
  data_inicio: string;
  data_fim: string;
  pulseira_largura_mm: number;
  pulseira_altura_mm: number;
  ativo: boolean;
  createdAt: string;
}

function fmtDate(v?: string) {
  if (!v) return '—';
  const d = new Date(v + 'T12:00:00');
  return d.toLocaleDateString('pt-BR');
}

function isAtivo(p: Projeto) {
  const hoje = new Date().toISOString().slice(0, 10);
  return p.ativo && p.data_fim >= hoje;
}

export default function ProjetosPage() {
  const router = useRouter();
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; editando: Projeto | null }>({ open: false, editando: null });
  const [form, setForm] = useState<Partial<Projeto>>({});
  const [salvando, setSalvando] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/projetos');
      setProjetos(r.data);
    } catch { toast.error('Erro ao carregar projetos'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const abrir = (p?: Projeto) => {
    setForm(p ? { ...p } : { ativo: true });
    setModal({ open: true, editando: p || null });
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      if (modal.editando) await api.patch(`/projetos/${modal.editando.id}`, form);
      else await api.post('/projetos', form);
      setModal({ open: false, editando: null });
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao salvar');
    } finally { setSalvando(false); }
  };

  const remover = async (p: Projeto) => {
    if (!confirm(`Excluir "${p.nome}"? Todos os inscritos e presenças serão removidos.`)) return;
    try {
      await api.delete(`/projetos/${p.id}`);
      await load();
    } catch { toast.error('Erro ao excluir projeto'); }
  };

  const ativos = projetos.filter(isAtivo);
  const encerrados = projetos.filter(p => !isAtivo(p));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Projetos</h1>
            <p className="text-xs text-slate-400 mt-0.5">Colônia de Férias e projetos sazonais</p>
          </div>
          <button onClick={() => abrir()}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase transition-colors">
            <Plus size={14}/> Novo Projeto
          </button>
        </div>

        {loading && <div className="text-center py-16 text-slate-400 text-sm">Carregando...</div>}

        {/* Ativos */}
        {ativos.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Em andamento</h2>
            {ativos.map(p => (
              <ProjetoCard key={p.id} p={p} onEdit={() => abrir(p)} onDelete={() => remover(p)} onOpen={() => router.push(`/projetos/${p.id}`)} />
            ))}
          </section>
        )}

        {/* Encerrados */}
        {encerrados.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Encerrados</h2>
            {encerrados.map(p => (
              <ProjetoCard key={p.id} p={p} onEdit={() => abrir(p)} onDelete={() => remover(p)} onOpen={() => router.push(`/projetos/${p.id}`)} encerrado />
            ))}
          </section>
        )}

        {!loading && projetos.length === 0 && (
          <div className="text-center py-20">
            <FolderOpen size={40} className="mx-auto text-slate-300 mb-3"/>
            <p className="text-slate-400 text-sm">Nenhum projeto cadastrado.</p>
            <button onClick={() => abrir()} className="mt-4 text-purple-600 font-bold text-sm hover:underline">
              Criar primeiro projeto
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-sm uppercase tracking-tight text-slate-800 dark:text-slate-100">
                {modal.editando ? 'Editar Projeto' : 'Novo Projeto'}
              </h3>
              <button onClick={() => setModal({ open: false, editando: null })} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                <X size={16}/>
              </button>
            </div>
            <form onSubmit={salvar} className="p-6 space-y-4">
              <Field label="Nome *">
                <input required value={form.nome ?? ''} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  placeholder="ex: Colônia de Férias Jul/2026" />
              </Field>
              <Field label="Descrição">
                <textarea value={form.descricao ?? ''} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                  rows={2} className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Data Início *">
                  <input required type="date" value={form.data_inicio ?? ''} onChange={e => setForm(p => ({ ...p, data_inicio: e.target.value }))}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </Field>
                <Field label="Data Fim *">
                  <input required type="date" value={form.data_fim ?? ''} onChange={e => setForm(p => ({ ...p, data_fim: e.target.value }))}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </Field>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModal({ open: false, editando: null })}
                  className="px-4 py-2 rounded-xl text-xs font-black uppercase text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando}
                  className="px-5 py-2 rounded-xl text-xs font-black uppercase bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{label}</label>
      {children}
    </div>
  );
}

function ProjetoCard({ p, onEdit, onDelete, onOpen, encerrado }: {
  p: Projeto; onEdit: () => void; onDelete: () => void; onOpen: () => void; encerrado?: boolean;
}) {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border shadow-sm flex items-center gap-4 px-5 py-4 cursor-pointer hover:shadow-md transition-shadow
      ${encerrado ? 'border-slate-100 dark:border-slate-800 opacity-60' : 'border-purple-100 dark:border-purple-900/40'}`}
      onClick={onOpen}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
        ${encerrado ? 'bg-slate-100 dark:bg-slate-800' : 'bg-purple-100 dark:bg-purple-900/30'}`}>
        <FolderOpen size={18} className={encerrado ? 'text-slate-400' : 'text-purple-600'}/>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-black text-sm text-slate-800 dark:text-slate-100 truncate">{p.nome}</p>
        <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
          <Calendar size={9}/> {fmtDate(p.data_inicio)} → {fmtDate(p.data_fim)}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
        <button onClick={onEdit} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600">
          <Edit3 size={14}/>
        </button>
        <button onClick={onDelete} className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500">
          <Trash2 size={14}/>
        </button>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit3, Trash2 } from 'lucide-react';
import api from '@/services/api';
import { Curso } from './_types';
import { Modal, FieldInput, FieldSelect } from './_shared';

export default function CursosTab() {
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

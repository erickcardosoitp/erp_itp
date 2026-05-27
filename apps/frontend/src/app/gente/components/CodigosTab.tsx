'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { API, fmt, ic, bp, bs, bd, Badge, Modal, FL } from './shared';

export interface CodigosTabProps {
  reload: number;
}

export function CodigosTab({ reload }: CodigosTabProps) {
  const [codigos, setCodigos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ valor_base: 0, ativo: true });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`${API}/gente/codigos-ajuda`, { credentials: 'include' });
    const codData = await r.json();
    setCodigos(Array.isArray(codData) ? codData : []);
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar, reload]);

  const salvar = async () => {
    setSalvando(true);
    try {
      const url = editando ? `${API}/gente/codigos-ajuda/${editando.id}` : `${API}/gente/codigos-ajuda`;
      const method = editando ? 'PATCH' : 'POST';
      const r = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      toast.success('Salvo!'); setModalAberto(false); carregar();
    } catch (e: any) { toast.error(e.message); }
    setSalvando(false);
  };

  const deletar = async (id: string) => {
    if (!confirm('Excluir código?')) return;
    await fetch(`${API}/gente/codigos-ajuda/${id}`, { method: 'DELETE', credentials: 'include' });
    toast.success('Excluído.'); carregar();
  };

  return (
    <div>
      <div className="flex justify-end mb-5">
        <button onClick={() => { setEditando(null); setForm({ valor_base: 0, ativo: true }); setModalAberto(true); }} className={bp}>
          <Plus size={14} className="inline mr-1" />Novo Código
        </button>
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        Os códigos seguem a taxonomia <strong>VRxxx</strong> (ex: VR001, VR002). O código é gerado automaticamente.
      </div>
      {loading ? <div className="text-center py-12 text-slate-400">Carregando...</div> : codigos.length === 0
        ? <div className="text-center py-12 text-slate-400">Nenhum código cadastrado.</div>
        : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>{['Código', 'Descrição', 'Valor Base', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {codigos.map(c => (
                  <tr key={c.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono font-bold text-purple-600">{c.codigo}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">{c.descricao}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{fmt.moeda(c.valor_base)}</td>
                    <td className="px-4 py-3">
                      <Badge label={c.ativo ? 'Ativo' : 'Inativo'} color={c.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'} />
                    </td>
                    <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => { setEditando(c); setForm({ ...c }); setModalAberto(true); }} className="p-1.5 text-slate-400 hover:text-purple-600 transition"><Edit2 size={14} /></button>
                      <button onClick={() => deletar(c.id)} className={bd}><Trash2 size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      {modalAberto && (
        <Modal title={editando ? 'Editar Código' : 'Novo Código VR'} onClose={() => setModalAberto(false)}>
          <div className="space-y-4">
            {!editando && <p className="text-xs text-slate-500 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl px-3 py-2">O código será gerado automaticamente (VR001, VR002...).</p>}
            <FL label="Descrição"><input type="text" value={form.descricao || ''} onChange={e => setForm((f: any) => ({ ...f, descricao: e.target.value }))} className={ic} placeholder="Ex: REEMBOLSO TRANSPORTE" /></FL>
            <FL label="Valor Base (R$)"><input type="number" step="0.01" min="0" placeholder="0,00" value={form.valor_base ?? ''} onChange={e => setForm((f: any) => ({ ...f, valor_base: e.target.value === '' ? 0 : Number(e.target.value) }))} className={ic} /></FL>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="ativo_cod" checked={!!form.ativo} onChange={e => setForm((f: any) => ({ ...f, ativo: e.target.checked }))} className="w-4 h-4" />
              <label htmlFor="ativo_cod" className="text-sm text-slate-700 dark:text-slate-300">Ativo</label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModalAberto(false)} className={bs}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} className={bp}>{salvando ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

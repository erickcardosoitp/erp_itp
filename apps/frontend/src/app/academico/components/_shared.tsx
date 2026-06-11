'use client';

import React from 'react';
import { X } from 'lucide-react';

// ─── Constantes compartilhadas ────────────────────────────────────────────────

export const DIAS_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];

export const HORARIOS: Array<{ label: string; value?: string; lanche?: boolean }> = [
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

export const CORES_CARD = [
  '#7c3aed', '#6d28d9', '#4f46e5', '#0284c7',
  '#0891b2', '#0d9488', '#059669', '#16a34a',
  '#65a30d', '#d97706', '#ea580c', '#dc2626',
  '#db2777', '#9333ea', '#475569', '#1e293b',
];

export const TIPOS_DIARIO = ['Avaliação', 'Lista de Chamada', 'Incidente', 'Observação', 'Comunicado'];

export const OPCOES_CUIDADO_ESPECIAL = [
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

export const CUIDADO_BADGE: Record<string, { label: string; color: string }> = {
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

// ─── Helpers compartilhados ───────────────────────────────────────────────────

export function fmtDate(v?: string | null) {
  if (!v) return '---';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v;
  const s = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v + 'T12:00:00' : v;
  const d = new Date(s);
  return isNaN(d.getTime()) ? '---' : d.toLocaleDateString('pt-BR');
}

export function calcularIdade(dataNasc: string): number {
  if (!dataNasc) return 99;
  const d = new Date(dataNasc.includes('T') ? dataNasc : dataNasc + 'T12:00:00');
  if (isNaN(d.getTime())) return 99;
  const hoje = new Date();
  let idade = hoje.getFullYear() - d.getFullYear();
  const m = hoje.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) idade--;
  return idade;
}

// ─── Componentes UI compartilhados ────────────────────────────────────────────

export function TabBtn({ id, active, set, label, Icon }: { id: string; active: string; set: (id: string) => void; label: string; Icon: any }) {
  return (
    <button
      onClick={() => set(id)}
      title={label}
      className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap
        ${active === id ? 'bg-white text-purple-700 shadow' : 'text-slate-500 hover:text-slate-800'}`}
    >
      <Icon size={13} /><span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
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

export function FieldInput({ label, value, onChange, type = 'text', required = false }: { label: string; value?: any; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-black uppercase text-slate-500">{label}{required && ' *'}</label>
      <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} required={required}
        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
    </div>
  );
}

export function FieldSelect({ label, value, onChange, options, required = false }: { label: string; value?: any; onChange: (v: string) => void; options: Array<{value: string; label: string} | string>; required?: boolean }) {
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

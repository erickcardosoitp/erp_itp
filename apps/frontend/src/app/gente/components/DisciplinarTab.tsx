'use client';

import React from 'react';
import { AlertTriangle, PauseCircle, Calendar, Edit2, Trash2, Paperclip, X } from 'lucide-react';
import { fmt, hoje, ic, bd, Badge, FL, SubTabs } from './shared';
import { GenericTab } from './FolhaTab';

// ── Sub-tabs config ────────────────────────────────────────────────────────────

const SUB_DISCIPLINAR = [
  { key: 'advertencias' as const, label: 'Advertências', icon: AlertTriangle },
  { key: 'suspensoes' as const, label: 'Suspensões', icon: PauseCircle },
  { key: 'faltas' as const, label: 'Faltas', icon: Calendar },
] as const;

// ── Campos específicos ─────────────────────────────────────────────────────────

const CamposAdvertencia = ({ form, setForm }: any) => (
  <>
    <FL label="Data"><input type="date" value={form.data || hoje()} onChange={e => setForm((f: any) => ({ ...f, data: e.target.value }))} className={ic} /></FL>
    <FL label="Motivo"><input type="text" value={form.motivo || ''} onChange={e => setForm((f: any) => ({ ...f, motivo: e.target.value }))} className={ic} /></FL>
    <FL label="Nível"><select value={form.nivel || 'escrita'} onChange={e => setForm((f: any) => ({ ...f, nivel: e.target.value }))} className={ic}>
      <option value="verbal">Verbal</option><option value="escrita">Escrita</option><option value="grave">Grave</option>
    </select></FL>
    <FL label="Valor do Desconto (R$)"><input type="number" min="0" step="0.01" placeholder="0,00 — deixe vazio para sem desconto" value={form.valor_desconto || ''} onChange={e => setForm((f: any) => ({ ...f, valor_desconto: e.target.value ? Number(e.target.value) : null }))} className={ic} /></FL>
    <FL label="Descrição"><textarea value={form.descricao || ''} onChange={e => setForm((f: any) => ({ ...f, descricao: e.target.value }))} className={`${ic} h-20 resize-none`} /></FL>
  </>
);

const CamposSuspensao = ({ form, setForm }: any) => (
  <>
    <div className="grid grid-cols-2 gap-3">
      <FL label="Início"><input type="date" value={form.data_inicio || hoje()} onChange={e => setForm((f: any) => ({ ...f, data_inicio: e.target.value }))} className={ic} /></FL>
      <FL label="Fim"><input type="date" value={form.data_fim || hoje()} onChange={e => setForm((f: any) => ({ ...f, data_fim: e.target.value }))} className={ic} /></FL>
    </div>
    <FL label="Motivo"><textarea value={form.motivo || ''} onChange={e => setForm((f: any) => ({ ...f, motivo: e.target.value }))} className={`${ic} h-20 resize-none`} /></FL>
    <div className="flex items-center gap-2"><input type="checkbox" id="cdesc" checked={form.com_desconto !== false} onChange={e => setForm((f: any) => ({ ...f, com_desconto: e.target.checked }))} className="w-4 h-4" /><label htmlFor="cdesc" className="text-sm">Com desconto salarial</label></div>
  </>
);

const CamposFalta = ({ form, setForm }: any) => {
  const tipo = form.tipo || 'falta';

  const handleAnexo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f: any) => ({ ...f, anexo: reader.result as string, anexo_nome: file.name }));
    reader.readAsDataURL(file);
  };

  return (
    <>
      <FL label="Tipo">
        <select value={tipo} onChange={e => setForm((f: any) => ({
          ...f,
          tipo: e.target.value,
          com_desconto: e.target.value !== 'falta' ? false : f.com_desconto,
          data_fim: e.target.value !== 'falta' ? (f.data_fim || f.data || hoje()) : f.data_fim,
        }))} className={ic}>
          <option value="falta">Falta</option>
          <option value="atestado">Atestado médico</option>
          <option value="afastamento">Afastamento</option>
        </select>
      </FL>
      {tipo === 'falta' ? (
        <FL label="Data"><input type="date" value={form.data || hoje()} onChange={e => setForm((f: any) => ({ ...f, data: e.target.value }))} className={ic} /></FL>
      ) : (
        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-3 space-y-3">
          <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Período de afastamento</p>
          <div className="grid grid-cols-2 gap-3">
            <FL label="Data início *"><input type="date" value={form.data || hoje()} onChange={e => setForm((f: any) => ({ ...f, data: e.target.value, data_fim: !f.data_fim ? e.target.value : f.data_fim }))} className={ic} /></FL>
            <FL label="Data fim *"><input type="date" value={form.data_fim || ''} onChange={e => setForm((f: any) => ({ ...f, data_fim: e.target.value }))} className={`${ic} ${!form.data_fim ? 'border-red-400 ring-1 ring-red-300' : ''}`} /></FL>
          </div>
          {form.data && form.data_fim && form.data_fim < form.data && (
            <p className="text-xs text-red-600">⚠️ Data fim não pode ser anterior à data início.</p>
          )}
          {tipo === 'atestado' && (
            <div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Anexar atestado (PDF, imagem)</p>
              {form.anexo_nome
                ? <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300 bg-white dark:bg-blue-900/30 rounded-lg px-3 py-2 border border-blue-200 dark:border-blue-700">
                    <Paperclip size={12} />
                    <span className="truncate flex-1">{form.anexo_nome}</span>
                    <button type="button" onClick={() => setForm((f: any) => ({ ...f, anexo: null, anexo_nome: null }))} className="text-red-500 hover:text-red-700 shrink-0"><X size={12} /></button>
                  </div>
                : <label className="cursor-pointer flex items-center gap-2 text-xs text-slate-500 hover:text-blue-600 transition border border-dashed border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2">
                    <Paperclip size={12} /><span>Clique para anexar</span>
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleAnexo} />
                  </label>}
            </div>
          )}
        </div>
      )}
      <FL label="Motivo"><input type="text" value={form.motivo || ''} onChange={e => setForm((f: any) => ({ ...f, motivo: e.target.value }))} className={ic} /></FL>
      <div className="flex gap-4">
        <div className="flex items-center gap-2"><input type="checkbox" id="just" checked={!!form.justificada} onChange={e => setForm((f: any) => ({ ...f, justificada: e.target.checked }))} className="w-4 h-4" /><label htmlFor="just" className="text-sm">Justificada</label></div>
        {tipo === 'falta' && <div className="flex items-center gap-2"><input type="checkbox" id="fdesc" checked={form.com_desconto !== false} onChange={e => setForm((f: any) => ({ ...f, com_desconto: e.target.checked, percentual_desconto: e.target.checked ? (f.percentual_desconto ?? 100) : null }))} className="w-4 h-4" /><label htmlFor="fdesc" className="text-sm">Com desconto</label></div>}
      </div>
      {tipo === 'falta' && form.com_desconto !== false && (
        <FL label="Percentual de desconto (%)">
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={100} step={1}
              value={form.percentual_desconto ?? 100}
              onChange={e => setForm((f: any) => ({ ...f, percentual_desconto: Number(e.target.value) }))}
              className={`${ic} flex-1`} />
            <span className="text-sm text-slate-500 dark:text-slate-400 shrink-0">%</span>
          </div>
        </FL>
      )}
      {tipo !== 'falta' && <p className="text-xs text-purple-600 dark:text-purple-400">Atestados e afastamentos não impactam o banco de horas.</p>}
    </>
  );
};

// ── Linhas ─────────────────────────────────────────────────────────────────────

const LinhaAdvertencia = ({ item, onEdit, onDel, colaboradores }: any) => {
  const nome = colaboradores.find((c: any) => c.id === item.colaborador_id)?.funcionario?.nome ?? '—';
  const cor: Record<string, string> = { verbal: 'bg-blue-100 text-blue-700', escrita: 'bg-orange-100 text-orange-700', grave: 'bg-red-100 text-red-700' };
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0"><div className="font-semibold truncate">{nome}</div><div className="text-xs text-slate-500">{fmt.data(item.data)} · {item.motivo}</div></div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge label={item.nivel} color={cor[item.nivel] || ''} />
        {item.valor_desconto ? <span className="text-xs font-semibold text-red-600">-R$ {Number(item.valor_desconto).toFixed(2)}</span> : null}
        <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-purple-600"><Edit2 size={13} /></button>
        <button onClick={onDel} className={bd}><Trash2 size={12} /></button>
      </div>
    </div>
  );
};

const LinhaSuspensao = ({ item, onEdit, onDel, colaboradores }: any) => {
  const nome = colaboradores.find((c: any) => c.id === item.colaborador_id)?.funcionario?.nome ?? '—';
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0"><div className="font-semibold truncate">{nome}</div><div className="text-xs text-slate-500">{fmt.data(item.data_inicio)} → {fmt.data(item.data_fim)} · {item.motivo}</div></div>
      <div className="flex items-center gap-2 shrink-0">
        {item.com_desconto && <Badge label="C/ Desconto" color="bg-red-100 text-red-600" />}
        <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-purple-600"><Edit2 size={13} /></button>
        <button onClick={onDel} className={bd}><Trash2 size={12} /></button>
      </div>
    </div>
  );
};

const LinhaFalta = ({ item, onEdit, onDel, colaboradores }: any) => {
  const nome = colaboradores.find((c: any) => c.id === item.colaborador_id)?.funcionario?.nome ?? '—';
  const tipo = item.tipo || 'falta';
  const tipoLabel: Record<string, string> = { falta: 'Falta', atestado: 'Atestado', afastamento: 'Afastamento' };
  const tipoColor: Record<string, string> = { falta: 'bg-orange-100 text-orange-700', atestado: 'bg-blue-100 text-blue-700', afastamento: 'bg-purple-100 text-purple-700' };
  // Para atestado/afastamento, sempre mostra início → fim explicitamente
  const dataFimStr = item.data_fim ? String(item.data_fim).slice(0, 10) : null;
  const dataStr = item.data ? String(item.data).slice(0, 10) : null;
  const periodo = tipo !== 'falta'
    ? `${fmt.data(dataStr ?? '')} → ${fmt.data(dataFimStr ?? dataStr ?? '')} ${!dataFimStr ? '⚠️ sem data fim' : ''}`
    : fmt.data(dataStr ?? '');

  const baixarAnexo = () => {
    if (!item.anexo) return;
    const a = document.createElement('a');
    a.href = item.anexo;
    a.download = item.anexo_nome || 'atestado';
    a.click();
  };

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="font-semibold truncate">{nome}</div>
        <div className="text-xs text-slate-500">{periodo} · {item.motivo || 'Sem motivo'}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge label={tipoLabel[tipo]} color={tipoColor[tipo]} />
        <Badge label={item.justificada ? 'Justificada' : 'Injustificada'} color={item.justificada ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'} />
        {tipo === 'falta' && item.com_desconto && <Badge label={item.percentual_desconto != null && item.percentual_desconto !== 100 ? `Desconto ${item.percentual_desconto}%` : 'Desconto 100%'} color="bg-red-100 text-red-600" />}
        {item.anexo && (
          <button onClick={baixarAnexo} title={item.anexo_nome || 'Baixar atestado'} className="p-1.5 text-blue-500 hover:text-blue-700"><Paperclip size={13} /></button>
        )}
        <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-purple-600"><Edit2 size={13} /></button>
        <button onClick={onDel} className={bd}><Trash2 size={12} /></button>
      </div>
    </div>
  );
};

// ── DisciplinarTab ─────────────────────────────────────────────────────────────

export interface DisciplinarTabProps {
  reload: number;
  colaboradores: any[];
  subDisc: typeof SUB_DISCIPLINAR[number]['key'];
  setSubDisc: (k: typeof SUB_DISCIPLINAR[number]['key']) => void;
}

export function DisciplinarTab({ reload, colaboradores, subDisc, setSubDisc }: DisciplinarTabProps) {
  return (
    <>
      <SubTabs tabs={SUB_DISCIPLINAR} active={subDisc} setActive={setSubDisc} />
      {subDisc === 'advertencias' && (
        <GenericTab
          endpoint="advertencias"
          titulo="Advertência"
          reload={reload}
          colaboradores={colaboradores}
          CamposComp={CamposAdvertencia}
          renderLinha={(i, e, d) => <LinhaAdvertencia key={i.id} item={i} onEdit={e} onDel={d} colaboradores={colaboradores} />}
        />
      )}
      {subDisc === 'suspensoes' && (
        <GenericTab
          endpoint="suspensoes"
          titulo="Suspensão"
          reload={reload}
          colaboradores={colaboradores}
          CamposComp={CamposSuspensao}
          renderLinha={(i, e, d) => <LinhaSuspensao key={i.id} item={i} onEdit={e} onDel={d} colaboradores={colaboradores} />}
        />
      )}
      {subDisc === 'faltas' && (
        <GenericTab
          endpoint="faltas"
          titulo="Falta"
          reload={reload}
          colaboradores={colaboradores}
          CamposComp={CamposFalta}
          renderLinha={(i, e, d) => <LinhaFalta key={i.id} item={i} onEdit={e} onDel={d} colaboradores={colaboradores} />}
        />
      )}
    </>
  );
}

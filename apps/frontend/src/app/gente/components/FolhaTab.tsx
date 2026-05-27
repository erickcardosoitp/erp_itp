'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  FileText, Wallet, Plus, RefreshCw, Edit2, Trash2,
  Calculator, Printer, Check, DollarSign, Bus, Receipt, Paperclip, X,
} from 'lucide-react';
import { API, CNPJ, EMPRESA, ENDERECO, fmt, hoje, ic, bp, bs, bd, Badge, Modal, FL, SubTabs } from './shared';

// ── Recibo PDF helpers ────────────────────────────────────────────────────────

const S = {
  bk: '1px solid black',
  gr: '1px solid #eee',
};

function ViaRecibo({ recibo, mesRef, proventos, descontos, totalProv, totalDesc, liquido, codigo, via }: any) {
  const LINHAS_MIN = 8;
  const isEmpregado = via.includes('EMPREGADO');
  const nomeLabel = isEmpregado ? 'NOME DO VOLUNTÁRIO' : 'NOME DO FUNCIONÁRIO';
  const n = (v: number) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  return (
    <div style={{ display: 'flex', border: S.bk, fontFamily: 'Arial, sans-serif', fontSize: '10px', pageBreakInside: 'avoid' }}>
      {/* Conteúdo principal */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Cabeçalho */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: S.bk }}>
          <div style={{ padding: '5px 7px', borderRight: S.bk }}>
            <div style={{ fontSize: '9px', fontWeight: 900 }}>EMPREGADOR &nbsp;<strong>{EMPRESA.toUpperCase()}</strong></div>
            <div style={{ fontSize: '8px', marginTop: '3px' }}>
              <div><span style={{ color: '#777' }}>Nome &nbsp;</span><strong>{EMPRESA}</strong></div>
              <div><span style={{ color: '#777' }}>Endereço &nbsp;</span>{ENDERECO}</div>
              <div><span style={{ color: '#777' }}>CNPJ &nbsp;</span><span style={{ fontFamily: 'monospace' }}>{CNPJ}</span></div>
            </div>
          </div>
          <div style={{ padding: '5px 7px', textAlign: 'right' }}>
            <div style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.1 }}>Recibo de Reembolso de Despesas</div>
            <div style={{ fontSize: '7px', color: '#888', marginTop: '5px' }}>Referente ao Mês / Ano</div>
            <div style={{ fontSize: '22px', fontWeight: 900, marginTop: '1px' }}>{mesRef}</div>
          </div>
        </div>

        {/* Identificação */}
        <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr', borderBottom: S.bk }}>
          <div style={{ padding: '3px 7px', borderRight: S.bk }}>
            <div style={{ fontSize: '7px', color: '#777', textTransform: 'uppercase' }}>Código</div>
            <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{codigo}</div>
          </div>
          <div style={{ padding: '3px 7px', borderRight: S.bk }}>
            <div style={{ fontSize: '7px', color: '#777', textTransform: 'uppercase' }}>{nomeLabel}</div>
            <div style={{ fontWeight: 'bold' }}>{recibo.funcionario?.nome ?? '—'}</div>
          </div>
          <div style={{ padding: '3px 7px' }}>
            <div style={{ fontSize: '7px', color: '#777', textTransform: 'uppercase' }}>Função</div>
            <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{recibo.funcionario?.cargo ?? '—'}</div>
          </div>
        </div>

        {/* Tabela */}
        <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: S.bk }}>
          <thead>
            <tr style={{ borderBottom: S.bk, background: '#f5f5f5' }}>
              {(['Código', 'Descrição', 'Referência', 'Proventos', 'Descontos'] as const).map((h, i) => (
                <th key={h} style={{ borderRight: i < 4 ? S.bk : undefined, padding: '2px 6px', textAlign: i >= 2 ? 'right' : 'left', fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', width: i === 0 ? 60 : i === 2 ? 68 : i >= 3 ? 80 : undefined }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {proventos.map((p: any, i: number) => (
              <tr key={i} style={{ borderBottom: S.gr }}>
                <td style={{ borderRight: S.bk, padding: '2px 6px', fontFamily: 'monospace', fontWeight: 'bold' }}>{p.codigo}</td>
                <td style={{ borderRight: S.bk, padding: '2px 6px' }}>{p.descricao}</td>
                <td style={{ borderRight: S.bk, padding: '2px 6px', textAlign: 'right' }}>{p.referencia || mesRef}</td>
                <td style={{ borderRight: S.bk, padding: '2px 6px', textAlign: 'right' }}>{n(p.valor)}</td>
                <td style={{ padding: '2px 6px' }}></td>
              </tr>
            ))}
            {descontos.map((d: any, i: number) => (
              <tr key={`d${i}`} style={{ borderBottom: S.gr }}>
                <td style={{ borderRight: S.bk, padding: '2px 6px', fontFamily: 'monospace', fontWeight: 'bold' }}>{d.codigo}</td>
                <td style={{ borderRight: S.bk, padding: '2px 6px' }}>{d.descricao}</td>
                <td style={{ borderRight: S.bk, padding: '2px 6px', textAlign: 'right' }}>{d.referencia || mesRef}</td>
                <td style={{ borderRight: S.bk, padding: '2px 6px' }}></td>
                <td style={{ padding: '2px 6px', textAlign: 'right' }}>{n(d.valor)}</td>
              </tr>
            ))}
            {Array.from({ length: Math.max(0, LINHAS_MIN - proventos.length - descontos.length) }).map((_, i) => (
              <tr key={`e${i}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                {[0, 1, 2, 3, 4].map(c => <td key={c} style={{ borderRight: c < 4 ? S.bk : undefined, padding: '7px 6px' }}></td>)}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mensagens + Totais */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', borderBottom: S.bk }}>
          <div style={{ padding: '4px 7px', borderRight: S.bk }}>
            <div style={{ fontSize: '8px', color: '#777', fontWeight: 'bold', textTransform: 'uppercase' }}>Mensagens</div>
          </div>
          <div style={{ padding: '4px 8px', minWidth: '190px' }}>
            {[['Total dos Vencimentos', n(totalProv)], ['Total dos Descontos', n(totalDesc)]].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '2px', marginBottom: '2px', borderBottom: S.gr }}>
                <span style={{ fontSize: '8px', color: '#777' }}>{label}</span>
                <span style={{ fontWeight: 'bold', fontSize: '9px', marginLeft: '8px' }}>{val}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '8px', fontWeight: 'bold' }}>Líquido a Receber {'→'}</span>
              <span style={{ fontWeight: 900, fontSize: '12px', marginLeft: '8px' }}>{n(liquido)}</span>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '4px 7px' }}>
          <div>
            <div style={{ fontSize: '8px', color: '#777' }}>Reembolso Base</div>
            <div style={{ fontWeight: 'bold', fontSize: '11px' }}>{n(liquido)}</div>
          </div>
          <div style={{ fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', color: '#555' }}>{via}</div>
        </div>
      </div>

      {/* Sidebar: declaração rotacionada */}
      <div style={{ width: '30px', borderLeft: S.bk, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '4px 0' }}>
          <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: '6.5px', whiteSpace: 'nowrap', letterSpacing: '0.4px' }}>
            DECLARO TER RECEBIDO A IMPORTÂNCIA LÍQUIDA DISCRIMINADA NESTE RECIBO.
          </span>
        </div>
        <div style={{ borderTop: S.bk, padding: '3px 2px', textAlign: 'center' }}>
          <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: '7px', fontWeight: 'bold' }}>DATA</span>
          <div style={{ borderTop: S.bk, marginTop: '3px', height: 0 }}></div>
        </div>
      </div>

      {/* Sidebar: assinatura */}
      <div style={{ width: '22px', borderLeft: S.bk, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: '6.5px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
          ASSINATURA DO VOLUNTÁRIO
        </span>
      </div>
    </div>
  );
}

function ReciboImpresso({ recibo, onClose }: { recibo: any; onClose: () => void }) {
  const mesRef = fmt.mes(recibo.mes_referencia ?? '');
  const proventos: any[] = recibo.proventos ?? [];
  const descontos: any[] = recibo.descontos ?? [];
  const totalProv = Number(recibo.totalProventos ?? 0);
  const totalDesc = Number(recibo.totalDescontos ?? 0);
  const liquido = Number(recibo.liquido ?? recibo.valor ?? 0);
  const codigo = recibo.codigo_colaborador ?? '00001';
  const viaProps = { recibo, mesRef, proventos, descontos, totalProv, totalDesc, liquido, codigo };

  return (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white print:hidden">
        <h2 className="font-bold text-slate-700">Recibo de Reembolso de Despesas — {recibo.funcionario?.nome ?? ''}</h2>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className={bp}><Printer size={14} className="inline mr-1" />Imprimir</button>
          <button onClick={onClose} className={bs}>Fechar</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 print:p-0">
        <div id="recibo-print" className="max-w-[820px] mx-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
          <ViaRecibo {...viaProps} via="1ª VIA - EMPREGADOR" />
          <div style={{ textAlign: 'center', padding: '4px 0', fontSize: '9px', color: '#aaa', letterSpacing: '2px' }}>
            ................................................................................................................................................
          </div>
          <ViaRecibo {...viaProps} via="2ª VIA - EMPREGADO" />
        </div>
      </div>
      <style>{`@media print { .print\\:hidden { display: none !important; } body { margin: 0; } #recibo-print { max-width: 100% !important; } }`}</style>
    </div>
  );
}

// ── PreviewRecibo ─────────────────────────────────────────────────────────────

function PreviewRecibo({ preview, onConfirmar, onClose, confirmando }: { preview: any; onConfirmar: () => void; onClose: () => void; confirmando: boolean }) {
  const prov: any[] = preview.proventos ?? [];
  const desc: any[] = preview.descontos ?? [];
  return (
    <Modal title={`Preview — ${preview.funcionario?.nome ?? '—'}`} onClose={onClose} wide>
      <div className="space-y-4">
        {preview.recibo_existente && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg px-3 py-2 text-xs text-yellow-700 dark:text-yellow-300">
            ⚠️ Já existe um recibo para este mês (status: <strong>{preview.recibo_existente.status}</strong>). Confirmar irá sobrescrevê-lo.
          </div>
        )}
        <div className="text-xs text-slate-500">{fmt.mes(preview.mes_referencia)} · {preview.funcionario?.cargo ?? '—'} · {preview.funcionario?.matricula ?? '—'}</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Proventos */}
          <div className="rounded-lg border border-green-200 dark:border-green-800 overflow-hidden">
            <div className="bg-green-50 dark:bg-green-900/30 px-3 py-2 text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wider">Proventos</div>
            {prov.length === 0
              ? <p className="px-3 py-3 text-xs text-slate-400">Nenhum provento</p>
              : prov.map((p, i) => (
                <div key={i} className="flex justify-between px-3 py-2 border-t border-green-100 dark:border-green-900 text-sm">
                  <span className="text-slate-700 dark:text-slate-300">{p.descricao}</span>
                  <span className="font-semibold text-green-700 dark:text-green-300">{fmt.moeda(p.valor)}</span>
                </div>
              ))}
            <div className="flex justify-between px-3 py-2 bg-green-100 dark:bg-green-900/50 text-sm font-bold border-t border-green-200 dark:border-green-800">
              <span>Total Proventos</span><span className="text-green-700 dark:text-green-300">{fmt.moeda(preview.totalProventos)}</span>
            </div>
          </div>

          {/* Descontos */}
          <div className="rounded-lg border border-red-200 dark:border-red-800 overflow-hidden">
            <div className="bg-red-50 dark:bg-red-900/30 px-3 py-2 text-xs font-bold text-red-700 dark:text-red-300 uppercase tracking-wider">Descontos</div>
            {desc.length === 0
              ? <p className="px-3 py-3 text-xs text-slate-400">Nenhum desconto</p>
              : desc.map((d, i) => (
                <div key={i} className="flex justify-between px-3 py-2 border-t border-red-100 dark:border-red-900 text-sm">
                  <span className="text-slate-700 dark:text-slate-300">{d.descricao}</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">− {fmt.moeda(d.valor)}</span>
                </div>
              ))}
            <div className="flex justify-between px-3 py-2 bg-red-100 dark:bg-red-900/50 text-sm font-bold border-t border-red-200 dark:border-red-800">
              <span>Total Descontos</span><span className="text-red-600 dark:text-red-400">{fmt.moeda(preview.totalDescontos)}</span>
            </div>
          </div>
        </div>

        {/* Líquido */}
        <div className="flex justify-between items-center rounded-xl bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 px-4 py-3">
          <span className="font-bold text-slate-700 dark:text-white">Valor Líquido</span>
          <span className="text-xl font-black text-purple-700 dark:text-purple-300">{fmt.moeda(preview.liquido)}</span>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className={bs}>Cancelar</button>
          <button onClick={onConfirmar} disabled={confirmando} className={bp}>
            {confirmando ? 'Gerando...' : '✓ Confirmar e Gerar Recibo'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── RecibosTab ────────────────────────────────────────────────────────────────

function RecibosTab({ reload, colaboradores }: { reload: number; colaboradores: any[] }) {
  const [recibos, setRecibos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCol, setFiltroCol] = useState('');
  const [filtroMes, setFiltroMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [calculando, setCalculando] = useState(false);
  const [mesCalculo, setMesCalculo] = useState(() => new Date().toISOString().slice(0, 7));
  const [reciboImpresso, setReciboImpresso] = useState<any | null>(null);
  const [carregandoRecibo, setCarregandoRecibo] = useState<string | null>(null);

  const [modalNovo, setModalNovo] = useState(false);
  const [novoColId, setNovoColId] = useState('');
  const [novoMes, setNovoMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [preview, setPreview] = useState<any | null>(null);
  const [carregandoPreview, setCarregandoPreview] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (filtroCol) p.set('colaborador_id', filtroCol);
    if (filtroMes) p.set('mes_referencia', filtroMes);
    const r = await fetch(`${API}/gente/recibos?${p.toString()}`, { credentials: 'include' });
    const recData = await r.json();
    setRecibos(Array.isArray(recData) ? recData : []);
    setLoading(false);
  }, [filtroCol, filtroMes]);

  useEffect(() => { carregar(); }, [carregar, reload]);

  const calcularFolha = async () => {
    if (!confirm(`Calcular folha de ${fmt.mes(mesCalculo)} para todos os colaboradores?\nRecibos existentes para o mesmo mês serão sobrescritos.`)) return;
    setCalculando(true);
    try {
      const r = await fetch(`${API}/gente/folha/calcular`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes_referencia: mesCalculo }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      const data = await r.json();
      toast.success(`Folha calculada! ${data.total_colaboradores} colaborador(es) processado(s).`);
      carregar();
    } catch (e: any) { toast.error(e.message || 'Erro ao calcular folha.'); }
    setCalculando(false);
  };

  const buscarPreview = async () => {
    if (!novoColId) { toast.error('Selecione um colaborador.'); return; }
    setCarregandoPreview(true);
    try {
      const r = await fetch(`${API}/gente/folha/preview?colaborador_id=${novoColId}&mes_referencia=${novoMes}`, { credentials: 'include' });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      setPreview(await r.json());
    } catch (e: any) { toast.error(e.message || 'Erro ao buscar preview.'); }
    setCarregandoPreview(false);
  };

  const confirmarRecibo = async () => {
    setConfirmando(true);
    try {
      const r = await fetch(`${API}/gente/folha/calcular-um`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colaborador_id: novoColId, mes_referencia: novoMes }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      toast.success('Recibo gerado com sucesso!');
      setPreview(null); setModalNovo(false); carregar();
    } catch (e: any) { toast.error(e.message || 'Erro ao gerar recibo.'); }
    setConfirmando(false);
  };

  const abrirRecibo = async (id: string) => {
    setCarregandoRecibo(id);
    try {
      const r = await fetch(`${API}/gente/recibos/${id}/completo`, { credentials: 'include' });
      const data = await r.json();
      setReciboImpresso(data);
    } catch { toast.error('Erro ao carregar recibo.'); }
    setCarregandoRecibo(null);
  };

  const deletar = async (id: string) => {
    if (!confirm('Excluir recibo?')) return;
    await fetch(`${API}/gente/recibos/${id}`, { method: 'DELETE', credentials: 'include' });
    toast.success('Excluído.'); carregar();
  };

  const marcarPago = async (id: string) => {
    await fetch(`${API}/gente/recibos/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'pago', data_pagamento: hoje() }) });
    toast.success('Marcado como pago!'); carregar();
  };

  const nomePorColaboradorId = (id: string) => colaboradores.find(c => c.id === id)?.funcionario?.nome ?? '—';

  return (
    <div>
      {reciboImpresso && <ReciboImpresso recibo={reciboImpresso} onClose={() => setReciboImpresso(null)} />}
      {preview && <PreviewRecibo preview={preview} onConfirmar={confirmarRecibo} onClose={() => setPreview(null)} confirmando={confirmando} />}

      {/* Modal: Novo Recibo */}
      {modalNovo && (
        <Modal title="Gerar Recibo por Funcionário" onClose={() => setModalNovo(false)}>
          <div className="space-y-4">
            <FL label="Funcionário">
              <select value={novoColId} onChange={e => { setNovoColId(e.target.value); setPreview(null); }} className={ic}>
                <option value="">Selecione...</option>
                {colaboradores.map(c => <option key={c.id} value={c.id}>{c.funcionario?.nome ?? c.id}</option>)}
              </select>
            </FL>
            <FL label="Mês de referência">
              <input type="month" value={novoMes} onChange={e => { setNovoMes(e.target.value); setPreview(null); }} className={ic} />
            </FL>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModalNovo(false)} className={bs}>Cancelar</button>
              <button onClick={buscarPreview} disabled={carregandoPreview || !novoColId} className={bp}>
                {carregandoPreview ? 'Calculando...' : <><Calculator size={13} className="inline mr-1" />Calcular e Gerar</>}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-5 flex-wrap">
        <input type="month" value={filtroMes} onChange={e => setFiltroMes(e.target.value)} className={`${ic} w-38`} title="Filtrar por mês" />
        <select value={filtroCol} onChange={e => setFiltroCol(e.target.value)} className={`${ic} flex-1`}>
          <option value="">Todos colaboradores</option>
          {colaboradores.map(c => <option key={c.id} value={c.id}>{c.funcionario?.nome ?? c.id}</option>)}
        </select>
        <button onClick={carregar} className={bs}><RefreshCw size={14} /></button>
        <button onClick={() => { setModalNovo(true); setNovoColId(filtroCol); setPreview(null); }} className={bp}>
          <Plus size={14} className="inline mr-1" />Recibo Individual
        </button>
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-3 py-2">
          <Calculator size={16} className="text-amber-600" />
          <input type="month" value={mesCalculo} onChange={e => setMesCalculo(e.target.value)} className="bg-transparent text-sm font-bold text-amber-700 dark:text-amber-300 focus:outline-none" />
          <button onClick={calcularFolha} disabled={calculando} className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition disabled:opacity-50">
            {calculando ? 'Calculando...' : 'Calcular Folha Geral'}
          </button>
        </div>
      </div>

      {loading ? <div className="text-center py-12 text-slate-400">Carregando...</div> : recibos.length === 0
        ? <div className="text-center py-12 text-slate-400">Nenhum recibo. Use &quot;Recibo Individual&quot; ou &quot;Calcular Folha Geral&quot;.</div>
        : (
          <div className="space-y-2">
            {recibos.map(r => (
              <div key={r.id} className="border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800 dark:text-white">{nomePorColaboradorId(r.colaborador_id)}</div>
                  <div className="text-xs text-slate-500">{fmt.mes(r.mes_referencia)} · {r.descricao}</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-700 dark:text-white">{fmt.moeda(r.valor)}</span>
                  <Badge label={r.status === 'pago' ? '✓ Pago' : 'Pendente'} color={r.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'} />
                  {r.status !== 'pago' && (
                    <button onClick={() => marcarPago(r.id)} className="bg-green-50 hover:bg-green-100 text-green-700 font-bold px-2 py-1 rounded-lg text-xs transition">
                      <Check size={11} className="inline" /> Pago
                    </button>
                  )}
                  <button onClick={() => abrirRecibo(r.id)} disabled={carregandoRecibo === r.id} className="bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold px-2 py-1 rounded-lg text-xs transition">
                    {carregandoRecibo === r.id ? '...' : <><Printer size={11} className="inline mr-1" />Recibo</>}
                  </button>
                  <button onClick={() => deletar(r.id)} className={bd}><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

// ── GenericTab ────────────────────────────────────────────────────────────────

export function GenericTab({ endpoint, titulo, reload, colaboradores, CamposComp, renderLinha }: {
  endpoint: string; titulo: string; reload: number; colaboradores: any[];
  CamposComp: React.ComponentType<{ form: any; setForm: any }>;
  renderLinha: (item: any, onEdit: () => void, onDel: () => void) => React.ReactNode;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCol, setFiltroCol] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ data: hoje() });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const params = filtroCol ? `?colaborador_id=${filtroCol}` : '';
    const r = await fetch(`${API}/gente/${endpoint}${params}`, { credentials: 'include' });
    const itemData = await r.json();
    setItems(Array.isArray(itemData) ? itemData : []);
    setLoading(false);
  }, [endpoint, filtroCol]);

  useEffect(() => { carregar(); }, [carregar, reload]);

  const salvar = async () => {
    if (!form.colaborador_id) { toast.error('Selecione um colaborador.'); return; }
    if (endpoint === 'faltas' && (form.tipo === 'atestado' || form.tipo === 'afastamento') && !form.data_fim) {
      toast.error('Informe a data fim do período do atestado/afastamento.'); return;
    }
    if (endpoint === 'vales' && !editando && !form.ficha_url) {
      toast.error('Anexe a ficha de solicitação de vale (URL obrigatória).'); return;
    }
    setSalvando(true);
    try {
      const url = editando ? `${API}/gente/${endpoint}/${editando.id}` : `${API}/gente/${endpoint}`;
      const r = await fetch(url, { method: editando ? 'PATCH' : 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      toast.success('Salvo!'); setModalAberto(false); carregar();
    } catch (e: any) { toast.error(e.message); }
    setSalvando(false);
  };

  const deletar = async (id: string) => {
    if (!confirm('Confirmar exclusão?')) return;
    await fetch(`${API}/gente/${endpoint}/${id}`, { method: 'DELETE', credentials: 'include' });
    toast.success('Excluído.'); carregar();
  };

  const abrirEditar = (item: any) => { setEditando(item); setForm({ ...item }); setModalAberto(true); };

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <select value={filtroCol} onChange={e => setFiltroCol(e.target.value)} className={`${ic} flex-1`}>
          <option value="">Todos colaboradores</option>
          {colaboradores.map(c => <option key={c.id} value={c.id}>{c.funcionario?.nome ?? c.id}</option>)}
        </select>
        <button onClick={carregar} className={bs}><RefreshCw size={14} /></button>
        <button onClick={() => { setEditando(null); setForm({ data: hoje(), colaborador_id: filtroCol || '' }); setModalAberto(true); }} className={bp}>
          <Plus size={14} className="inline mr-1" />{titulo}
        </button>
      </div>
      {loading ? <div className="text-center py-12 text-slate-400">Carregando...</div> : items.length === 0
        ? <div className="text-center py-12 text-slate-400">Nenhum registro.</div>
        : <div className="space-y-2">{items.map(item => renderLinha(item, () => abrirEditar(item), () => deletar(item.id)))}</div>}
      {modalAberto && (
        <Modal title={editando ? `Editar ${titulo}` : `Novo(a) ${titulo}`} onClose={() => setModalAberto(false)}>
          <div className="space-y-4">
            <FL label="Colaborador">
              <select value={form.colaborador_id || ''} onChange={e => setForm((f: any) => ({ ...f, colaborador_id: e.target.value }))} className={ic}>
                <option value="">Selecione...</option>
                {colaboradores.map(c => <option key={c.id} value={c.id}>{c.funcionario?.nome ?? c.id}</option>)}
              </select>
            </FL>
            <CamposComp form={form} setForm={setForm} />
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

// ── Campos específicos ────────────────────────────────────────────────────────

const CamposVale = ({ form, setForm }: any) => (
  <>
    <div className="grid grid-cols-2 gap-3">
      <FL label="Tipo"><select value={form.tipo || 'outro'} onChange={e => setForm((f: any) => ({ ...f, tipo: e.target.value }))} className={ic}>
        <option value="alimentacao">Alimentação</option><option value="transporte">Transporte</option>
        <option value="adiantamento">Adiantamento</option><option value="outro">Outro</option>
      </select></FL>
      <FL label="Valor"><input type="number" step="0.01" value={form.valor || ''} onChange={e => setForm((f: any) => ({ ...f, valor: e.target.value }))} className={ic} /></FL>
    </div>
    <FL label="Data"><input type="date" value={form.data || hoje()} onChange={e => setForm((f: any) => ({ ...f, data: e.target.value }))} className={ic} /></FL>
    <FL label="Descrição"><input type="text" value={form.descricao || ''} onChange={e => setForm((f: any) => ({ ...f, descricao: e.target.value }))} className={ic} /></FL>
    <FL label={<span>Ficha de Solicitação <span className="text-red-500 font-black">*</span></span>}>
      <input
        type="url"
        placeholder="URL da ficha (Google Drive, OneDrive...)"
        value={form.ficha_url || ''}
        onChange={e => setForm((f: any) => ({ ...f, ficha_url: e.target.value }))}
        className={`${ic} ${!form.ficha_url ? 'border-red-300 dark:border-red-700 ring-1 ring-red-200' : ''}`}
      />
      <p className="text-[10px] text-slate-400 mt-0.5">Faça upload da ficha no Google Drive e cole o link aqui.</p>
    </FL>
    <div className="flex items-center gap-2"><input type="checkbox" id="desc" checked={!!form.descontado} onChange={e => setForm((f: any) => ({ ...f, descontado: e.target.checked }))} className="w-4 h-4" /><label htmlFor="desc" className="text-sm text-slate-700 dark:text-slate-300">Já descontado</label></div>
  </>
);

// ── Linhas ────────────────────────────────────────────────────────────────────

const LinhaVale = ({ item, onEdit, onDel, colaboradores }: any) => {
  const nome = colaboradores.find((c: any) => c.id === item.colaborador_id)?.funcionario?.nome ?? '—';
  const tipoLabel: Record<string, string> = { alimentacao: '🍽️', transporte: '🚌', adiantamento: '💵', outro: '📦' };
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0"><div className="font-semibold truncate">{nome}</div><div className="text-xs text-slate-500">{tipoLabel[item.tipo] || ''} {item.tipo?.toUpperCase()} · {fmt.data(item.data)}</div></div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="font-bold">{fmt.moeda(item.valor)}</span>
        {item.descontado && <Badge label="Descontado" color="bg-slate-100 text-slate-500" />}
        <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-purple-600"><Edit2 size={13} /></button>
        <button onClick={onDel} className={bd}><Trash2 size={12} /></button>
      </div>
    </div>
  );
};

// ── RecibosPassagemModal ──────────────────────────────────────────────────────

function RecibosPassagemModal({ colaborador, mes, feriadosMes, diasPagosIniciais, assinadoInicial, onClose, onSaved, onAssinadoChange }: {
  colaborador: any;
  mes: string;
  feriadosMes: Set<string>;
  diasPagosIniciais: Set<string>;
  assinadoInicial: boolean;
  onClose: () => void;
  onSaved: (novaSet: Set<string>) => void;
  onAssinadoChange: (assinado: boolean) => void;
}) {
  const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  const diasBloqueados = assinadoInicial ? new Set(diasPagosIniciais) : new Set<string>();
  const [diasPagos, setDiasPagos] = useState<Set<string>>(assinadoInicial ? new Set() : new Set(diasPagosIniciais));
  const [salvando, setSalvando] = useState(false);
  const [assinado, setAssinado] = useState(assinadoInicial);
  const [togglingAssinado, setTogglingAssinado] = useState(false);

  const diasTrabalho = (() => {
    if (!colaborador || !mes) return [];
    const mapa: Record<string, number> = { dom:0, seg:1, ter:2, qua:3, qui:4, sex:5, sab:6 };
    const diasSem = new Set((colaborador.dias_trabalho ?? []).map((d: string) => mapa[d]).filter((n: number) => n !== undefined));
    const [ano, m] = mes.split('-').map(Number);
    const total = new Date(ano, m, 0).getDate();
    const result: { iso: string; label: string; diaSem: string; diaSemIdx: number }[] = [];
    const nomesDia = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    for (let d = 1; d <= total; d++) {
      const iso = `${ano}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dObj = new Date(ano, m-1, d);
      if (diasSem.has(dObj.getDay()) && !feriadosMes.has(iso)) {
        result.push({ iso, label: `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}`, diaSem: nomesDia[dObj.getDay()], diaSemIdx: dObj.getDay() });
      }
    }
    return result;
  })();

  const toggleDia = (iso: string) => {
    if (diasBloqueados.has(iso)) return;
    setDiasPagos(prev => {
      const n = new Set(prev);
      n.has(iso) ? n.delete(iso) : n.add(iso);
      return n;
    });
  };

  const marcarTodos = () => setDiasPagos(new Set(diasTrabalho.filter(d => !diasBloqueados.has(d.iso)).map(d => d.iso)));
  const desmarcarTodos = () => setDiasPagos(new Set());

  const vp = Number(colaborador.valor_passagem) || 0;
  const totalDiasPagos = diasBloqueados.size + diasPagos.size;
  const totalPago = diasPagos.size * vp;
  const totalDevido = diasTrabalho.length * vp;
  const progresso = diasTrabalho.length === 0 ? 0 : Math.round((totalDiasPagos / diasTrabalho.length) * 100);

  const fmtMes = (m: string) => {
    const [ano, mm] = m.split('-');
    const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${nomes[parseInt(mm)-1]}/${ano}`;
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const todosOsDias = new Set([...diasBloqueados, ...diasPagos]);
      const dias = Array.from(todosOsDias).map(data => ({ data, valor: vp, status: 'pago' }));
      const r = await fetch(`${API_URL}/gente/passagens/lote`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colaborador_id: colaborador.id, funcionario_id: colaborador.funcionario_id, mes, dias }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      toast.success('Registro salvo!');
      onSaved(todosOsDias);
    } catch (e: any) { toast.error(e.message); }
    setSalvando(false);
  };

  const toggleAssinado = async () => {
    setTogglingAssinado(true);
    try {
      const novoStatus = !assinado;
      const r = await fetch(`${API_URL}/gente/passagens/assinaturas`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colaborador_id: colaborador.id, mes_referencia: mes, assinado: novoStatus }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      setAssinado(novoStatus);
      onAssinadoChange(novoStatus);
      toast.success(novoStatus ? 'Recibo marcado como assinado!' : 'Assinatura removida.');
    } catch (e: any) { toast.error(e.message); }
    setTogglingAssinado(false);
  };

  const gerarPdf = async () => {
    if (diasPagos.size === 0) return;
    const { jsPDF } = await import('jspdf');
    const nome = colaborador.funcionario?.nome ?? '—';
    const cargo = colaborador.funcionario?.cargo ?? '—';
    const [ano, m] = mes.split('-').map(Number);
    const nomesMes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const periodoLabel = `${nomesMes[m-1]}/${ano}`;

    const diasOrdenados = diasTrabalho.filter(d => diasPagos.has(d.iso));
    const total = diasOrdenados.length * vp;
    const totalStr = `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits:2 })}`;
    const vpStr = `R$ ${vp.toLocaleString('pt-BR', { minimumFractionDigits:2 })}`;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PW = 210; const PH = 297; const ML = 14; const MR = 14;
    const HALF = PH / 2;

    const drawVia = (yBase: number, via: string) => {
      doc.setFillColor(30,58,95);
      doc.rect(0, yBase, PW, 15, 'F');
      doc.setTextColor(255,255,255);
      doc.setFont('helvetica','bold'); doc.setFontSize(11);
      doc.text('INSTITUTO TIA PRETINHA', ML, yBase + 7);
      doc.setFont('helvetica','normal'); doc.setFontSize(6.5);
      doc.text(`CNPJ ${CNPJ}  ·  ${ENDERECO}`, ML, yBase + 12);
      doc.setFontSize(9); doc.setFont('helvetica','bold');
      doc.text('RECIBO DE PASSAGEM', PW - MR, yBase + 7, { align:'right' });
      doc.setFontSize(6.5); doc.setFont('helvetica','normal');
      doc.text(`Referência: ${periodoLabel}  ·  ${via}`, PW - MR, yBase + 12, { align:'right' });

      let y = yBase + 21;
      doc.setTextColor(20,20,20);
      doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
      doc.setDrawColor(220,220,220); doc.setLineWidth(0.3);
      doc.rect(ML, y, PW - ML - MR, 15);

      doc.text('Funcionário(a):', ML + 2, y + 5);
      doc.setFont('helvetica','bold'); doc.text(nome, ML + 27, y + 5);
      doc.setFont('helvetica','normal'); doc.text('Cargo:', ML + 2, y + 10);
      doc.setFont('helvetica','bold'); doc.text(cargo, ML + 27, y + 10);
      doc.setFont('helvetica','normal'); doc.text('Valor diário:', ML + 2, y + 14.5);
      doc.setFont('helvetica','bold'); doc.text(vpStr, ML + 27, y + 14.5);

      const rx = PW / 2 + 3;
      doc.setFont('helvetica','normal'); doc.text('Dias pagos:', rx, y + 5);
      doc.setFont('helvetica','bold'); doc.text(`${diasOrdenados.length} de ${diasTrabalho.length}`, rx + 22, y + 5);
      doc.setFont('helvetica','normal'); doc.text('Período:', rx, y + 10);
      doc.setFont('helvetica','bold'); doc.text(periodoLabel, rx + 22, y + 10);
      doc.setFont('helvetica','normal'); doc.text('Total recebido:', rx, y + 14.5);
      doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(30,58,95);
      doc.text(totalStr, rx + 22, y + 14.5);

      y += 21;
      doc.setTextColor(20,20,20); doc.setFontSize(7.5); doc.setFont('helvetica','bold');
      doc.text('Detalhamento dos dias pagos', ML, y);
      y += 2;
      doc.setLineWidth(0.2); doc.setDrawColor(200,200,200);
      doc.line(ML, y, PW - MR, y);
      y += 4;

      const COLS = 3;
      const colW = (PW - ML - MR) / COLS;
      doc.setFillColor(245,245,245); doc.setDrawColor(245,245,245);
      doc.rect(ML, y - 3, PW - ML - MR, 5, 'F');
      doc.setDrawColor(200,200,200); doc.setTextColor(80,80,80);
      doc.setFontSize(6.5); doc.setFont('helvetica','bold');
      for (let i = 0; i < COLS; i++) {
        doc.text('#',     ML + i*colW + 1,  y);
        doc.text('Data',  ML + i*colW + 6,  y);
        doc.text('Dia',   ML + i*colW + 20, y);
        doc.text('Valor', ML + i*colW + colW - 16, y);
      }
      doc.setTextColor(20,20,20); doc.setFont('helvetica','normal');
      y += 3;

      const linhasMax = Math.ceil(diasOrdenados.length / COLS);
      for (let row = 0; row < linhasMax; row++) {
        for (let c = 0; c < COLS; c++) {
          const idx = row * COLS + c;
          if (idx >= diasOrdenados.length) continue;
          const d = diasOrdenados[idx];
          const xCol = ML + c * colW;
          doc.text(String(idx + 1).padStart(2,'0'), xCol + 1,  y);
          doc.text(d.label,  xCol + 6,  y);
          doc.text(d.diaSem, xCol + 20, y);
          doc.text(vpStr,    xCol + colW - 16, y);
        }
        y += 4;
      }

      y += 2;
      doc.setLineWidth(0.3); doc.setDrawColor(180,180,180);
      doc.line(ML, y, PW - MR, y);
      y += 5;
      doc.setFont('helvetica','bold'); doc.setFontSize(8);
      doc.text(`TOTAL GERAL (${diasOrdenados.length} dias):`, ML, y);
      doc.setTextColor(30,58,95);
      doc.text(totalStr, PW - MR, y, { align:'right' });
      doc.setTextColor(20,20,20);

      y += 7;
      doc.setFont('helvetica','normal'); doc.setFontSize(6.5);
      const decl = `Declaro que recebi do Instituto Tia Pretinha a quantia acima discriminada, referente ao auxílio passagem dos dias listados, dando plena e geral quitação.`;
      const linhas = doc.splitTextToSize(decl, PW - ML - MR);
      doc.text(linhas, ML, y);
      y += linhas.length * 3.2 + 4;
      doc.text(`Rio de Janeiro, _____ de ____________________ de ${ano}.`, ML, y);

      y += 9;
      doc.setLineWidth(0.3); doc.setDrawColor(150,150,150);
      doc.line(ML + 2, y, ML + 68, y);
      doc.line(PW - MR - 68, y, PW - MR - 2, y);
      doc.setFontSize(6.5);
      doc.text('Assinatura do(a) Funcionário(a)', ML + 2, y + 4);
      doc.text('Assinatura da Administração', PW - MR - 68, y + 4);
      doc.setFontSize(6);
      doc.text(nome, ML + 2, y + 8);
    };

    drawVia(0, '1ª via');

    doc.setDrawColor(160,160,160); doc.setLineWidth(0.2);
    for (let x = 5; x < PW - 5; x += 4) doc.line(x, HALF, x + 2, HALF);
    doc.setFontSize(6); doc.setTextColor(160,160,160);
    doc.text('✂  recorte aqui', PW / 2, HALF - 1, { align:'center' });

    drawVia(HALF + 1, '2ª via');

    doc.save(`recibo_passagem_${nome.replace(/\s+/g,'_')}_${mes}.pdf`);
  };

  return (
    <Modal title={`Pagamento de Passagem — ${colaborador.funcionario?.nome ?? ''}`} onClose={onClose} wide>
      <div className="space-y-5">
        {/* Resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase text-slate-400">Período</div>
            <div className="text-sm font-black text-slate-800 dark:text-white">{fmtMes(mes)}</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase text-slate-400">Valor diário</div>
            <div className="text-sm font-black text-slate-800 dark:text-white">{vp.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })}</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase text-green-600 dark:text-green-400">{diasBloqueados.size > 0 ? 'Novo recibo' : 'Total pago'}</div>
            <div className="text-sm font-black text-green-700 dark:text-green-300">{totalPago.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })}</div>
            {diasBloqueados.size > 0 && (
              <div className="text-[9px] text-slate-400 mt-0.5">{diasBloqueados.size} dia{diasBloqueados.size !== 1 ? 's' : ''} já assinado{diasBloqueados.size !== 1 ? 's' : ''}</div>
            )}
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400">Total devido</div>
            <div className="text-sm font-black text-blue-700 dark:text-blue-300">{totalDevido.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })}</div>
          </div>
        </div>

        {/* Barra progresso */}
        <div>
          <div className="flex justify-between text-xs font-bold mb-1.5">
            <span className="text-slate-500 dark:text-slate-400">{totalDiasPagos} de {diasTrabalho.length} dias pagos</span>
            <span className="text-green-600 dark:text-green-400">{progresso}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all"
              style={{ width: `${progresso}%` }} />
          </div>
        </div>

        {/* Ações marcar/limpar */}
        {diasTrabalho.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button onClick={marcarTodos} className="text-xs font-bold px-3 py-2 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 transition">
              Marcar todos
            </button>
            <button onClick={desmarcarTodos} className="text-xs font-bold px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition">
              Limpar
            </button>
          </div>
        )}

        {/* Grade de dias */}
        {diasTrabalho.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 dark:bg-slate-800 rounded-xl">
            Nenhum dia de trabalho configurado para {fmtMes(mes)}.
            <div className="text-xs mt-1">Configure os dias da semana na lista acima.</div>
          </div>
        ) : (
          <div className="grid grid-cols-5 sm:grid-cols-7 gap-1.5">
            {diasTrabalho.map(d => {
              const bloqueado = diasBloqueados.has(d.iso);
              const pago = diasPagos.has(d.iso);
              return (
                <button
                  key={d.iso}
                  onClick={() => toggleDia(d.iso)}
                  disabled={bloqueado}
                  title={bloqueado ? 'Já pago e assinado' : undefined}
                  className={`flex flex-col items-center justify-center rounded-xl py-2.5 px-1 border-2 text-[11px] font-bold transition-all ${
                    bloqueado
                      ? 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-70'
                      : pago
                        ? 'bg-green-600 border-green-600 text-white shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-green-400'
                  }`}
                >
                  <span className="text-[9px] font-normal opacity-70">{d.diaSem}</span>
                  <span className="text-sm">{d.label.slice(0,2)}</span>
                  {bloqueado && <span className="text-[7px] opacity-60">✓</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Ações principais */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={toggleAssinado}
            disabled={togglingAssinado}
            className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl border-2 transition disabled:opacity-40 ${
              assinado
                ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-emerald-400'
            }`}
          >
            {togglingAssinado ? '...' : assinado ? '✓ Assinado' : 'Marcar como assinado'}
          </button>
          <div className="flex flex-wrap gap-2">
            <button onClick={onClose} className={bs}>Fechar</button>
            <button
              onClick={salvar}
              disabled={salvando}
              className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
            >
              {salvando ? 'Salvando...' : 'Salvar Registro'}
            </button>
            <button
              onClick={gerarPdf}
              disabled={diasPagos.size === 0}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
            >
              <Receipt size={13} />Gerar Recibo PDF
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── TransporteTab ─────────────────────────────────────────────────────────────

function TransporteTab({ colaboradores, reload }: { colaboradores: any[]; reload: number }) {
  const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  const DIAS_SEMANA_OPT = [
    { key: 'dom', label: 'D' }, { key: 'seg', label: 'S' }, { key: 'ter', label: 'T' },
    { key: 'qua', label: 'Q' }, { key: 'qui', label: 'Q' }, { key: 'sex', label: 'S' }, { key: 'sab', label: 'S' },
  ];
  const [valores, setValores] = useState<Record<string, string>>({});
  const [diasEdit, setDiasEdit] = useState<Record<string, string[]>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [comprovante, setComprovante] = useState<any | null>(null);
  const [feriadosMes, setFeriadosMes] = useState<Set<string>>(new Set());
  const [pagamentosPorCol, setPagamentosPorCol] = useState<Record<string, Set<string>>>({});
  const [assinaturasPorCol, setAssinaturasPorCol] = useState<Record<string, boolean>>({});
  const [carregandoPassagens, setCarregandoPassagens] = useState(false);
  const [modalRecibo, setModalRecibo] = useState<any | null>(null);

  useEffect(() => {
    const initVal: Record<string, string> = {};
    const initDias: Record<string, string[]> = {};
    colaboradores.forEach(c => {
      initVal[c.id] = c.valor_passagem != null ? String(c.valor_passagem) : '';
      initDias[c.id] = Array.isArray(c.dias_trabalho) ? c.dias_trabalho : [];
    });
    setValores(initVal);
    setDiasEdit(initDias);
  }, [colaboradores, reload]);

  useEffect(() => {
    if (!mes) return;
    const ano = mes.split('-')[0];
    fetch(`${API_URL}/gente/feriados?ano=${ano}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((rows: any[]) => {
        const s = new Set<string>(rows.map(f => String(f.data).slice(0, 10)));
        setFeriadosMes(s);
      })
      .catch(() => {});
  }, [mes]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mes || colaboradores.length === 0) return;
    let cancelado = false;
    setCarregandoPassagens(true);
    Promise.all([
      Promise.all(
        colaboradores.map(c =>
          fetch(`${API_URL}/gente/passagens?colaborador_id=${c.id}&mes=${mes}`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : [])
            .then((rows: any[]) => [c.id, new Set<string>(rows.map((r: any) => String(r.data).slice(0,10)))] as const)
            .catch(() => [c.id, new Set<string>()] as const)
        )
      ),
      fetch(`${API_URL}/gente/passagens/assinaturas?mes=${mes}`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : [])
        .catch(() => []),
    ]).then(([pares, assinaturas]) => {
      if (cancelado) return;
      const map: Record<string, Set<string>> = {};
      pares.forEach(([id, set]) => { map[id] = set; });
      setPagamentosPorCol(map);
      const aMap: Record<string, boolean> = {};
      (assinaturas as any[]).forEach((a: any) => { aMap[a.colaborador_id] = !!a.assinado; });
      setAssinaturasPorCol(aMap);
      setCarregandoPassagens(false);
    });
    return () => { cancelado = true; };
  }, [colaboradores, mes]); // eslint-disable-line react-hooks/exhaustive-deps

  function diasNoMes(diasSemana: string[], mesRef: string): number {
    const mapa: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };
    const [ano, m] = mesRef.split('-').map(Number);
    const alvos = new Set((diasSemana ?? []).map((d: string) => mapa[d]).filter((n: number) => n !== undefined));
    const total = new Date(ano, m, 0).getDate();
    let count = 0;
    for (let d = 1; d <= total; d++) {
      const iso = `${ano}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (alvos.has(new Date(ano, m - 1, d).getDay()) && !feriadosMes.has(iso)) count++;
    }
    return count;
  }

  const fmtMes = (m: string) => {
    const [ano, mes] = m.split('-');
    const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${nomes[parseInt(mes)-1]}/${ano}`;
  };

  const salvar = async (colId: string) => {
    setSalvando(colId);
    try {
      const r = await fetch(`${API_URL}/gente/colaboradores/${colId}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valor_passagem: valores[colId] === '' ? null : Number(valores[colId]),
          dias_trabalho: diasEdit[colId] ?? [],
        }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      toast.success('Transporte salvo!');
    } catch (e: any) { toast.error(e.message); }
    setSalvando(null);
  };

  const toggleDia = (colId: string, dia: string) => {
    setDiasEdit(prev => {
      const atual = prev[colId] ?? [];
      return { ...prev, [colId]: atual.includes(dia) ? atual.filter(d => d !== dia) : [...atual, dia] };
    });
  };

  const ativos = colaboradores.filter(c => c.ativo !== false)
    .sort((a: any, b: any) => (a.funcionario?.nome ?? '').localeCompare(b.funcionario?.nome ?? '', 'pt-BR'));

  const totalGeralVT = ativos.reduce((s, c) => {
    const vp = parseFloat(valores[c.id] ?? '') || 0;
    return s + vp * diasNoMes(c.dias_trabalho ?? [], mes);
  }, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-2.5 flex-1">
          <Bus size={15} className="text-blue-500 shrink-0" />
          <span>Valor do bilhete único intermunicipal (ida+volta). O total por colaborador é calculado pelos dias configurados em Ponto.</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500">Mês:</label>
          <input type="month" value={mes} onChange={e => setMes(e.target.value)}
            className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-400" />
        </div>
      </div>

      {totalGeralVT > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-blue-500 font-bold uppercase tracking-wide">Total VT — {fmtMes(mes)}</div>
            <div className="text-2xl font-black text-blue-700 dark:text-blue-300">{totalGeralVT.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
          </div>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition">
            <Bus size={13} />Comprovante Geral
          </button>
        </div>
      )}

      <div className="space-y-2">
        {ativos.map((c: any) => {
          const vp = parseFloat(valores[c.id] ?? '') || 0;
          const diasCol = diasEdit[c.id] ?? c.dias_trabalho ?? [];
          const dias = diasNoMes(diasCol, mes);
          const totalMes = vp * dias;
          const pagSet = pagamentosPorCol[c.id] ?? new Set<string>();
          const diasPagos = pagSet.size;
          const valorPago = diasPagos * vp;
          const progresso = dias > 0 ? Math.round((diasPagos / dias) * 100) : 0;
          return (
            <div key={c.id} className="border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-purple-700 dark:text-purple-300 font-black text-sm shrink-0">
                  {c.funcionario?.nome?.charAt(0) ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800 dark:text-white text-sm truncate">{c.funcionario?.nome ?? '—'}</div>
                  <div className="text-xs text-slate-400">
                    {c.tipo === 'voluntario' ? 'Voluntário' : 'Funcionário'} · {dias} dias em {fmtMes(mes)}
                    {c.funcionario?.cargo && <span className="ml-1">· {c.funcionario.cargo}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {totalMes > 0 && (
                    <div className="text-right text-xs text-slate-500 dark:text-slate-400 w-20 hidden sm:block">
                      <div>Total/mês</div>
                      <div className="font-bold text-blue-600 dark:text-blue-300">{totalMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                    </div>
                  )}
                  <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
                    <span className="px-2 text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 border-r border-slate-300 dark:border-slate-600">R$</span>
                    <input
                      type="number" step="0.01" min="0" placeholder="0,00"
                      value={valores[c.id] ?? ''}
                      onChange={e => setValores(v => ({ ...v, [c.id]: e.target.value }))}
                      className="w-24 px-2 py-1.5 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none"
                    />
                  </div>
                  <button onClick={() => salvar(c.id)} disabled={salvando === c.id}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-50">
                    {salvando === c.id ? '...' : 'Salvar'}
                  </button>
                  {totalMes > 0 && vp > 0 && (
                    <button onClick={() => setModalRecibo(c)}
                      disabled={carregandoPassagens}
                      className="bg-green-100 dark:bg-green-900/30 hover:bg-green-200 text-green-700 dark:text-green-300 text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1 disabled:opacity-50">
                      <Receipt size={11} />{carregandoPassagens ? '...' : 'Pagamentos'}
                    </button>
                  )}
                  {assinaturasPorCol[c.id] && (
                    <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 px-2 py-1 rounded-lg">
                      ✓ Assinado
                    </span>
                  )}
                </div>
              </div>
              {/* Seleção de dias da semana */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide w-20">Dias VT:</span>
                <div className="flex gap-1">
                  {DIAS_SEMANA_OPT.map((d, i) => {
                    const ativo = (diasEdit[c.id] ?? c.dias_trabalho ?? []).includes(d.key);
                    return (
                      <button key={`${d.key}-${i}`} type="button" onClick={() => toggleDia(c.id, d.key)}
                        className={`w-7 h-7 rounded-full text-[10px] font-black transition ${ativo ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200'}`}>
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                <span className="text-[10px] text-slate-400">{dias} dias em {fmtMes(mes)}</span>
              </div>
              {/* Progresso de pagamento */}
              {totalMes > 0 && vp > 0 && (
                <div className="pt-1">
                  <div className="flex justify-between items-center text-[10px] font-bold mb-1">
                    <span className="text-slate-500 dark:text-slate-400">
                      Pago: <span className="text-green-600 dark:text-green-400">{diasPagos}/{dias} dias</span>
                      <span className="ml-2 text-slate-600 dark:text-slate-300">
                        {valorPago.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })}
                        {' '}de{' '}
                        {totalMes.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })}
                      </span>
                    </span>
                    <span className={progresso === 100 ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}>
                      {progresso}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className={`h-full transition-all ${progresso === 100 ? 'bg-green-500' : 'bg-gradient-to-r from-green-400 to-emerald-500'}`}
                      style={{ width: `${progresso}%` }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {ativos.length === 0 && <div className="text-center py-10 text-slate-400 text-sm">Nenhum colaborador ativo.</div>}
      </div>

      {/* Modal de Registro de Pagamentos */}
      {modalRecibo && (
        <RecibosPassagemModal
          colaborador={modalRecibo}
          mes={mes}
          feriadosMes={feriadosMes}
          diasPagosIniciais={pagamentosPorCol[modalRecibo.id] ?? new Set()}
          assinadoInicial={assinaturasPorCol[modalRecibo.id] ?? false}
          onClose={() => setModalRecibo(null)}
          onSaved={(novaSet) => {
            setPagamentosPorCol(prev => ({ ...prev, [modalRecibo.id]: novaSet }));
          }}
          onAssinadoChange={(val) => {
            setAssinaturasPorCol(prev => ({ ...prev, [modalRecibo.id]: val }));
          }}
        />
      )}

      {/* Modal Comprovante VT */}
      {comprovante && (
        <Modal title="Comprovante de Vale Transporte" onClose={() => setComprovante(null)}>
          <div className="space-y-4">
            <div id="comprovante-vt" className="border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-4 text-sm">
              <div className="text-center border-b border-slate-200 pb-4">
                <div className="font-black text-lg text-slate-800 dark:text-white">INSTITUTO TIAPRETINHA</div>
                <div className="text-xs text-slate-500">Comprovante de Vale Transporte — {fmtMes(comprovante.mes)}</div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-400 text-xs block">Colaborador</span><span className="font-bold">{comprovante.col.funcionario?.nome}</span></div>
                <div><span className="text-slate-400 text-xs block">Cargo</span><span className="font-bold">{comprovante.col.funcionario?.cargo ?? '—'}</span></div>
                <div><span className="text-slate-400 text-xs block">Valor da Passagem (ida+volta)</span><span className="font-bold">{comprovante.vp.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                <div><span className="text-slate-400 text-xs block">Dias Trabalhados</span><span className="font-bold">{comprovante.dias}</span></div>
                <div className="col-span-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  <span className="text-slate-400 text-xs block">Valor Total a Receber</span>
                  <span className="font-black text-xl text-blue-700 dark:text-blue-300">{comprovante.totalMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-700 space-y-8">
                <div className="grid grid-cols-3 gap-4 text-center text-xs">
                  {['Colaborador', 'Administração', 'Presidente'].map(label => (
                    <div key={label}>
                      <div className="border-b border-slate-400 dark:border-slate-500 pb-6 mb-2"></div>
                      <span className="text-slate-500">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setComprovante(null)} className={bs}>Fechar</button>
              <button onClick={() => window.print()}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition">
                <Bus size={14} />Imprimir Comprovante
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── FinanceiroTab ─────────────────────────────────────────────────────────────

function FinanceiroTab({ reload }: { reload: number }) {
  const mesAtual = new Date().toISOString().slice(0, 7);
  const [mes, setMes] = useState(mesAtual);
  const [dados, setDados] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/gente/financeiro/resumo?mes=${mes}`, { credentials: 'include' });
      setDados(await r.json());
    } catch { toast.error('Erro ao carregar resumo financeiro.'); }
    setLoading(false);
  }, [mes]);

  useEffect(() => { carregar(); }, [carregar, reload]);

  const cols: any[] = dados?.colaboradores ?? [];
  const totais = dados?.totais ?? { total_folha: 0, total_vales: 0, total_outros_descontos: 0, total_liquido: 0 };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <input type="month" value={mes} onChange={e => setMes(e.target.value)}
          className={`${ic} w-40`} />
        <button onClick={carregar} className={bs}><RefreshCw size={14} /></button>
        <span className="text-sm text-slate-500">Visão financeira de {fmt.mes(mes)}</span>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Folha', val: totais.total_folha, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
          { label: 'Vales Pendentes', val: totais.total_vales, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
          { label: 'Outros Descontos', val: totais.total_outros_descontos, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
          { label: 'Líquido a Pagar', val: totais.total_liquido, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-2xl p-4`}>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{c.label}</div>
            <div className={`text-xl font-black ${c.color}`}>{fmt.moeda(c.val)}</div>
          </div>
        ))}
      </div>

      {loading
        ? <div className="text-center py-12 text-slate-400">Carregando...</div>
        : cols.length === 0
          ? <div className="text-center py-12 text-slate-400">Nenhum colaborador ativo.</div>
          : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    {['Colaborador', 'VR / Benefícios', 'Total Proventos', 'Vales Pendentes', 'Outros Descontos', 'Líquido', 'Recibo'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cols.map((c: any) => (
                    <tr key={c.colaborador_id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {c.foto
                            ? <img src={c.foto} alt="" className="w-7 h-9 rounded object-cover border border-slate-200" />
                            : <div className="w-7 h-9 rounded bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-purple-700 font-black text-xs">{c.nome?.charAt(0)}</div>}
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-white">{c.nome}</div>
                            <div className="text-xs text-slate-400">{c.cargo}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{fmt.moeda(c.total_vr)}</td>
                      <td className="px-4 py-3 font-bold text-purple-700 dark:text-purple-300">{fmt.moeda(c.total_proventos)}</td>
                      <td className="px-4 py-3">
                        {c.qtd_vales_pendentes > 0
                          ? <span className="text-red-600 font-semibold">{fmt.moeda(c.vales_pendentes)} <span className="text-xs text-red-400">({c.qtd_vales_pendentes})</span></span>
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {c.qtd_outros_descontos > 0
                          ? <span className="text-orange-600 font-semibold">{fmt.moeda(c.outros_descontos)} <span className="text-xs text-orange-400">({c.qtd_outros_descontos})</span></span>
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 font-black">
                        <span className="text-emerald-600 dark:text-emerald-400">{fmt.moeda(c.liquido)}</span>
                        {c.pagamento_isento && <span className="ml-1 text-[10px] font-bold text-orange-500 bg-orange-50 border border-orange-200 rounded px-1">Isento</span>}
                      </td>
                      <td className="px-4 py-3">
                        {c.recibo_status
                          ? <Badge label={c.recibo_status === 'pago' ? '✓ Pago' : 'Pendente'} color={c.recibo_status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'} />
                          : <span className="text-xs text-slate-400">Sem recibo</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
    </div>
  );
}

// ── Sub-tabs config ───────────────────────────────────────────────────────────

const SUB_FOLHA = [
  { key: 'recibos' as const, label: 'Recibos / Folha', icon: FileText },
  { key: 'vales' as const, label: 'Vales', icon: Wallet },
  { key: 'transporte' as const, label: 'Transporte', icon: Bus },
  { key: 'financeiro' as const, label: 'Financeiro', icon: DollarSign },
] as const;

// ── FolhaTab (exported) ───────────────────────────────────────────────────────

export interface FolhaTabProps {
  reload: number;
  colaboradores: any[];
  subFolha: typeof SUB_FOLHA[number]['key'];
  setSubFolha: (k: typeof SUB_FOLHA[number]['key']) => void;
}

export function FolhaTab({ reload, colaboradores, subFolha, setSubFolha }: FolhaTabProps) {
  return (
    <>
      <SubTabs tabs={SUB_FOLHA} active={subFolha} setActive={setSubFolha} />
      {subFolha === 'recibos' && <RecibosTab reload={reload} colaboradores={colaboradores} />}
      {subFolha === 'vales' && <GenericTab endpoint="vales" titulo="Vale" reload={reload} colaboradores={colaboradores} CamposComp={CamposVale} renderLinha={(i, e, d) => <LinhaVale key={i.id} item={i} onEdit={e} onDel={d} colaboradores={colaboradores} />} />}
      {subFolha === 'transporte' && <TransporteTab reload={reload} colaboradores={colaboradores} />}
      {subFolha === 'financeiro' && <FinanceiroTab reload={reload} />}
    </>
  );
}

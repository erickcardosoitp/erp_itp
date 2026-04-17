'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Users, Clock, FileText, Wallet, AlertTriangle,
  PauseCircle, Calendar, Plus, Search, X, Edit2,
  Trash2, Check, ExternalLink, ChevronDown, ChevronUp,
  RefreshCw, MapPin,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';

type Tab = 'colaboradores' | 'ponto' | 'recibos' | 'vales' | 'advertencias' | 'suspensoes' | 'faltas';

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtData(iso: string) {
  if (!iso) return '—';
  return new Date(iso.includes('T') ? iso : iso + 'T00:00:00').toLocaleDateString('pt-BR');
}
function fmtHora(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function fmtMoeda(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0);
}
function hoje() {
  return new Date().toISOString().split('T')[0];
}

// ── Componentes auxiliares ────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>
      {label}
    </span>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-700">
          <h2 className="font-black text-slate-800 dark:text-white text-lg">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-400';
const selectCls = inputCls;
const btnPrimary = 'bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition disabled:opacity-50';
const btnSecondary = 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-bold px-4 py-2 rounded-xl text-sm transition';
const btnDanger = 'bg-red-50 hover:bg-red-100 text-red-600 font-bold px-3 py-1.5 rounded-lg text-xs transition';

// ── Colaboradores Tab ─────────────────────────────────────────────────────

function ColaboradoresTab({ reload }: { reload: number }) {
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [detalhe, setDetalhe] = useState<any | null>(null);
  const [funcionariosDisp, setFuncionariosDisp] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    tipo: 'funcionario', dias_trabalho: ['seg', 'ter', 'qua', 'qui', 'sex'],
    horario_entrada: '08:00', horario_saida: '17:00', raio_metros: 200,
  });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/gente/colaboradores`, { credentials: 'include' });
      const data = await res.json();
      setColaboradores(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar, reload]);

  const abrirModal = async (col?: any) => {
    const res = await fetch(`${API}/gente/colaboradores/funcionarios-disponiveis`, { credentials: 'include' });
    const disps = await res.json();
    setFuncionariosDisp(Array.isArray(disps) ? disps : []);
    if (col) {
      setEditando(col);
      setForm({ ...col, dias_trabalho: col.dias_trabalho || ['seg', 'ter', 'qua', 'qui', 'sex'] });
    } else {
      setEditando(null);
      setForm({ tipo: 'funcionario', dias_trabalho: ['seg', 'ter', 'qua', 'qui', 'sex'], horario_entrada: '08:00', horario_saida: '17:00', raio_metros: 200 });
    }
    setModalAberto(true);
  };

  const salvar = async () => {
    if (!editando && !form.funcionario_id) { toast.error('Selecione um funcionário.'); return; }
    setSalvando(true);
    try {
      const url = editando ? `${API}/gente/colaboradores/${editando.id}` : `${API}/gente/colaboradores`;
      const method = editando ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(form) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      toast.success(editando ? 'Colaborador atualizado!' : 'Colaborador adicionado!');
      setModalAberto(false);
      carregar();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (id: string) => {
    if (!confirm('Desativar este colaborador?')) return;
    await fetch(`${API}/gente/colaboradores/${id}`, { method: 'DELETE', credentials: 'include' });
    toast.success('Colaborador desativado.');
    carregar();
  };

  const toggleDia = (dia: string) => {
    setForm((f: any) => {
      const dias = f.dias_trabalho || [];
      return { ...f, dias_trabalho: dias.includes(dia) ? dias.filter((d: string) => d !== dia) : [...dias, dia] };
    });
  };

  const DIAS = [
    { k: 'seg', l: 'S' }, { k: 'ter', l: 'T' }, { k: 'qua', l: 'Q' },
    { k: 'qui', l: 'Q' }, { k: 'sex', l: 'S' }, { k: 'sab', l: 'S' }, { k: 'dom', l: 'D' },
  ];

  const usarGeoPropria = () => {
    if (!navigator.geolocation) { toast.error('Geolocalização não disponível.'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setForm((f: any) => ({ ...f, latitude_permitida: pos.coords.latitude, longitude_permitida: pos.coords.longitude }));
        toast.success('Localização capturada!');
      },
      () => toast.error('Não foi possível obter localização.'),
      { enableHighAccuracy: true },
    );
  };

  const filtrados = colaboradores.filter(c =>
    !busca || c.funcionario?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    c.funcionario?.cargo?.toLowerCase().includes(busca.toLowerCase()),
  );

  const PONTO_URL = `${typeof window !== 'undefined' ? window.location.origin : ''}/ponto?token=itp-ponto-2026`;

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar colaborador..." className={`${inputCls} pl-9`} />
        </div>
        <button onClick={() => abrirModal()} className={btnPrimary}>
          <Plus size={16} className="inline mr-1" />Adicionar
        </button>
        <a href={PONTO_URL} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition">
          <ExternalLink size={14} />Link Ponto
        </a>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Carregando...</div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-12 text-slate-400">Nenhum colaborador cadastrado.</div>
      ) : (
        <div className="space-y-2">
          {filtrados.map(c => (
            <div key={c.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-purple-700 dark:text-purple-300 font-black">
                    {c.funcionario?.nome?.charAt(0) ?? '?'}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 dark:text-white">{c.funcionario?.nome ?? '—'}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{c.funcionario?.cargo ?? ''}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    label={c.tipo === 'voluntario' ? 'Voluntário' : 'Funcionário'}
                    color={c.tipo === 'voluntario' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'}
                  />
                  {c.horario_entrada && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                      {c.horario_entrada} → {c.horario_saida}
                    </span>
                  )}
                  <button onClick={() => abrirModal(c)} className="p-1.5 text-slate-400 hover:text-purple-600 transition"><Edit2 size={14} /></button>
                  <button onClick={() => setDetalhe(detalhe?.id === c.id ? null : c)} className="p-1.5 text-slate-400 hover:text-blue-500 transition">
                    {detalhe?.id === c.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <button onClick={() => remover(c.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition"><Trash2 size={14} /></button>
                </div>
              </div>
              {detalhe?.id === c.id && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div><span className="text-slate-400 block">Tipo</span><span className="font-semibold">{c.tipo}</span></div>
                  <div><span className="text-slate-400 block">Horário</span><span className="font-semibold">{c.horario_entrada || '—'} → {c.horario_saida || '—'}</span></div>
                  <div><span className="text-slate-400 block">Geofence</span><span className="font-semibold">{c.latitude_permitida ? `${Number(c.latitude_permitida).toFixed(4)}, ${Number(c.longitude_permitida).toFixed(4)}` : '—'}</span></div>
                  <div><span className="text-slate-400 block">Raio</span><span className="font-semibold">{c.raio_metros ?? 200}m</span></div>
                  <div className="col-span-2"><span className="text-slate-400 block">Dias</span><span className="font-semibold">{(c.dias_trabalho || []).join(', ') || '—'}</span></div>
                  <div><span className="text-slate-400 block">CPF</span><span className="font-semibold">{c.funcionario?.cpf || '—'}</span></div>
                  <div><span className="text-slate-400 block">Matrícula</span><span className="font-semibold">{c.funcionario?.matricula || '—'}</span></div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modalAberto && (
        <Modal title={editando ? 'Editar Colaborador' : 'Novo Colaborador'} onClose={() => setModalAberto(false)}>
          <div className="space-y-4">
            {!editando && (
              <FormField label="Funcionário">
                <select value={form.funcionario_id || ''} onChange={e => setForm((f: any) => ({ ...f, funcionario_id: e.target.value }))} className={selectCls}>
                  <option value="">Selecione...</option>
                  {funcionariosDisp.map(f => (
                    <option key={f.id} value={f.id}>{f.nome} {f.cargo ? `— ${f.cargo}` : ''}</option>
                  ))}
                </select>
              </FormField>
            )}
            <FormField label="Tipo">
              <select value={form.tipo} onChange={e => setForm((f: any) => ({ ...f, tipo: e.target.value }))} className={selectCls}>
                <option value="funcionario">Funcionário</option>
                <option value="voluntario">Voluntário</option>
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Entrada">
                <input type="time" value={form.horario_entrada || ''} onChange={e => setForm((f: any) => ({ ...f, horario_entrada: e.target.value }))} className={inputCls} />
              </FormField>
              <FormField label="Saída">
                <input type="time" value={form.horario_saida || ''} onChange={e => setForm((f: any) => ({ ...f, horario_saida: e.target.value }))} className={inputCls} />
              </FormField>
            </div>
            <FormField label="Dias de trabalho">
              <div className="flex gap-2 flex-wrap">
                {[
                  { k: 'seg', l: 'Seg' }, { k: 'ter', l: 'Ter' }, { k: 'qua', l: 'Qua' },
                  { k: 'qui', l: 'Qui' }, { k: 'sex', l: 'Sex' }, { k: 'sab', l: 'Sáb' }, { k: 'dom', l: 'Dom' },
                ].map(d => (
                  <button key={d.k} type="button" onClick={() => toggleDia(d.k)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                      (form.dias_trabalho || []).includes(d.k)
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>{d.l}</button>
                ))}
              </div>
            </FormField>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Geolocalização permitida</label>
                <button type="button" onClick={usarGeoPropria} className="text-xs text-purple-600 flex items-center gap-1 hover:underline">
                  <MapPin size={12} />Usar localização atual
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" step="any" placeholder="Latitude" value={form.latitude_permitida || ''} onChange={e => setForm((f: any) => ({ ...f, latitude_permitida: e.target.value }))} className={inputCls} />
                <input type="number" step="any" placeholder="Longitude" value={form.longitude_permitida || ''} onChange={e => setForm((f: any) => ({ ...f, longitude_permitida: e.target.value }))} className={inputCls} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Raio (metros):</span>
                <input type="number" value={form.raio_metros || 200} onChange={e => setForm((f: any) => ({ ...f, raio_metros: Number(e.target.value) }))} className={`${inputCls} w-24`} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModalAberto(false)} className={btnSecondary}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} className={btnPrimary}>{salvando ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Ponto Tab ─────────────────────────────────────────────────────────────

function PontoTab({ reload }: { reload: number }) {
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [filtroColaborador, setFiltroColaborador] = useState('');
  const [filtroInicio, setFiltroInicio] = useState('');
  const [filtroFim, setFiltroFim] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState<any>({ tipo: 'entrada', data_hora: new Date().toISOString().slice(0, 16) });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroColaborador) params.set('colaborador_id', filtroColaborador);
      if (filtroInicio) params.set('data_inicio', filtroInicio);
      if (filtroFim) params.set('data_fim', filtroFim);
      const res = await fetch(`${API}/gente/ponto?${params}`, { credentials: 'include' });
      const data = await res.json();
      setRegistros(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [filtroColaborador, filtroInicio, filtroFim]);

  const carregarColaboradores = useCallback(async () => {
    const res = await fetch(`${API}/gente/colaboradores`, { credentials: 'include' });
    const data = await res.json();
    setColaboradores(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { carregar(); carregarColaboradores(); }, [carregar, carregarColaboradores, reload]);

  const salvar = async () => {
    if (!form.colaborador_id) { toast.error('Selecione um colaborador.'); return; }
    setSalvando(true);
    try {
      const res = await fetch(`${API}/gente/ponto`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, data_hora: new Date(form.data_hora).toISOString() }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      toast.success('Ponto registrado!');
      setModalAberto(false);
      carregar();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao registrar.');
    } finally {
      setSalvando(false);
    }
  };

  const deletar = async (id: string) => {
    if (!confirm('Excluir este registro?')) return;
    await fetch(`${API}/gente/ponto/${id}`, { method: 'DELETE', credentials: 'include' });
    toast.success('Registro excluído.');
    carregar();
  };

  const PONTO_URL = `${typeof window !== 'undefined' ? window.location.origin : ''}/ponto?token=itp-ponto-2026`;

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <select value={filtroColaborador} onChange={e => setFiltroColaborador(e.target.value)} className={`${selectCls} flex-1`}>
          <option value="">Todos colaboradores</option>
          {colaboradores.map(c => <option key={c.id} value={c.id}>{c.funcionario?.nome ?? c.id}</option>)}
        </select>
        <input type="date" value={filtroInicio} onChange={e => setFiltroInicio(e.target.value)} className={`${inputCls} w-36`} />
        <input type="date" value={filtroFim} onChange={e => setFiltroFim(e.target.value)} className={`${inputCls} w-36`} />
        <button onClick={carregar} className={btnSecondary}><RefreshCw size={14} /></button>
        <button onClick={() => setModalAberto(true)} className={btnPrimary}><Plus size={16} className="inline mr-1" />Registrar</button>
        <a href={PONTO_URL} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition whitespace-nowrap">
          <ExternalLink size={14} />Link Externo
        </a>
      </div>
      {loading ? <div className="text-center py-12 text-slate-400">Carregando...</div> : registros.length === 0 ? (
        <div className="text-center py-12 text-slate-400">Nenhum registro de ponto.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                {['Colaborador', 'Tipo', 'Data/Hora', 'Localização', 'Distância', 'Por', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {registros.map(r => (
                <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">{r.colaborador_nome || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge
                      label={r.tipo === 'entrada' ? '✅ Entrada' : '🔴 Saída'}
                      color={r.tipo === 'entrada' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {fmtData(r.data_hora)} {fmtHora(r.data_hora)}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {r.latitude ? `${Number(r.latitude).toFixed(4)}, ${Number(r.longitude).toFixed(4)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.distancia_metros != null ? (
                      <span className={r.dentro_area ? 'text-green-600' : 'text-red-500'}>
                        {r.distancia_metros}m {r.dentro_area ? '✓' : '⚠️'}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{r.registrado_por || '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => deletar(r.id)} className={btnDanger}><Trash2 size={12} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modalAberto && (
        <Modal title="Registrar Ponto" onClose={() => setModalAberto(false)}>
          <div className="space-y-4">
            <FormField label="Colaborador">
              <select value={form.colaborador_id || ''} onChange={e => setForm((f: any) => ({ ...f, colaborador_id: e.target.value }))} className={selectCls}>
                <option value="">Selecione...</option>
                {colaboradores.map(c => <option key={c.id} value={c.id}>{c.funcionario?.nome ?? c.id}</option>)}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Tipo">
                <select value={form.tipo} onChange={e => setForm((f: any) => ({ ...f, tipo: e.target.value }))} className={selectCls}>
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                </select>
              </FormField>
              <FormField label="Data/Hora">
                <input type="datetime-local" value={form.data_hora} onChange={e => setForm((f: any) => ({ ...f, data_hora: e.target.value }))} className={inputCls} />
              </FormField>
            </div>
            <FormField label="Observação">
              <input type="text" value={form.observacao || ''} onChange={e => setForm((f: any) => ({ ...f, observacao: e.target.value }))} className={inputCls} placeholder="Opcional" />
            </FormField>
            <div className="flex justify-end gap-2">
              <button onClick={() => setModalAberto(false)} className={btnSecondary}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} className={btnPrimary}>{salvando ? 'Salvando...' : 'Registrar'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Tab genérica de registros (Recibos, Vales, Advertências, Suspensões, Faltas) ──

function GenericTab({
  endpoint, titulo, reload, colaboradores, campos, renderLinha,
}: {
  endpoint: string; titulo: string; reload: number;
  colaboradores: any[];
  campos: React.ReactNode;
  renderLinha: (item: any, onDel: () => void) => React.ReactNode;
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
    try {
      const params = filtroCol ? `?colaborador_id=${filtroCol}` : '';
      const res = await fetch(`${API}/gente/${endpoint}${params}`, { credentials: 'include' });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  }, [endpoint, filtroCol]);

  useEffect(() => { carregar(); }, [carregar, reload]);

  const abrirModal = (item?: any) => {
    setEditando(item ?? null);
    setForm(item ? { ...item } : { data: hoje(), colaborador_id: filtroCol || '' });
    setModalAberto(true);
  };

  const salvar = async () => {
    if (!form.colaborador_id) { toast.error('Selecione um colaborador.'); return; }
    setSalvando(true);
    try {
      const url = editando ? `${API}/gente/${endpoint}/${editando.id}` : `${API}/gente/${endpoint}`;
      const method = editando ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      toast.success('Salvo com sucesso!');
      setModalAberto(false);
      carregar();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar.');
    } finally { setSalvando(false); }
  };

  const deletar = async (id: string) => {
    if (!confirm('Confirmar exclusão?')) return;
    await fetch(`${API}/gente/${endpoint}/${id}`, { method: 'DELETE', credentials: 'include' });
    toast.success('Excluído.');
    carregar();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <select value={filtroCol} onChange={e => setFiltroCol(e.target.value)} className={`${selectCls} flex-1`}>
          <option value="">Todos colaboradores</option>
          {colaboradores.map(c => <option key={c.id} value={c.id}>{c.funcionario?.nome ?? c.id}</option>)}
        </select>
        <button onClick={carregar} className={btnSecondary}><RefreshCw size={14} /></button>
        <button onClick={() => abrirModal()} className={btnPrimary}><Plus size={16} className="inline mr-1" />{titulo}</button>
      </div>
      {loading ? <div className="text-center py-12 text-slate-400">Carregando...</div> : items.length === 0 ? (
        <div className="text-center py-12 text-slate-400">Nenhum registro encontrado.</div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id}>
              {renderLinha(item, () => deletar(item.id))}
            </div>
          ))}
        </div>
      )}
      {modalAberto && (
        <Modal title={editando ? `Editar ${titulo}` : `Novo(a) ${titulo}`} onClose={() => setModalAberto(false)}>
          <div className="space-y-4">
            <FormField label="Colaborador">
              <select value={form.colaborador_id || ''} onChange={e => setForm((f: any) => ({ ...f, colaborador_id: e.target.value }))} className={selectCls}>
                <option value="">Selecione...</option>
                {colaboradores.map(c => <option key={c.id} value={c.id}>{c.funcionario?.nome ?? c.id}</option>)}
              </select>
            </FormField>
            {React.isValidElement(campos)
              ? React.cloneElement(campos as React.ReactElement<any>, { form, setForm, colaboradores })
              : campos}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModalAberto(false)} className={btnSecondary}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} className={btnPrimary}>{salvando ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Campos específicos de cada tab ────────────────────────────────────────

function CamposRecibo({ form, setForm }: any) {
  return <>
    <div className="grid grid-cols-2 gap-3">
      <FormField label="Mês referência">
        <input type="month" value={form.mes_referencia || ''} onChange={e => setForm((f: any) => ({ ...f, mes_referencia: e.target.value }))} className={inputCls} />
      </FormField>
      <FormField label="Valor">
        <input type="number" step="0.01" value={form.valor || ''} onChange={e => setForm((f: any) => ({ ...f, valor: e.target.value }))} className={inputCls} placeholder="R$ 0,00" />
      </FormField>
    </div>
    <FormField label="Descrição">
      <input type="text" value={form.descricao || ''} onChange={e => setForm((f: any) => ({ ...f, descricao: e.target.value }))} className={inputCls} />
    </FormField>
    <div className="grid grid-cols-2 gap-3">
      <FormField label="Data pagamento">
        <input type="date" value={form.data_pagamento || ''} onChange={e => setForm((f: any) => ({ ...f, data_pagamento: e.target.value }))} className={inputCls} />
      </FormField>
      <FormField label="Status">
        <select value={form.status || 'pendente'} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))} className={selectCls}>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
        </select>
      </FormField>
    </div>
    <FormField label="Observação">
      <input type="text" value={form.observacao || ''} onChange={e => setForm((f: any) => ({ ...f, observacao: e.target.value }))} className={inputCls} />
    </FormField>
  </>;
}

function CamposVale({ form, setForm }: any) {
  return <>
    <div className="grid grid-cols-2 gap-3">
      <FormField label="Tipo">
        <select value={form.tipo || 'outro'} onChange={e => setForm((f: any) => ({ ...f, tipo: e.target.value }))} className={selectCls}>
          <option value="alimentacao">Alimentação</option>
          <option value="transporte">Transporte</option>
          <option value="adiantamento">Adiantamento</option>
          <option value="outro">Outro</option>
        </select>
      </FormField>
      <FormField label="Valor">
        <input type="number" step="0.01" value={form.valor || ''} onChange={e => setForm((f: any) => ({ ...f, valor: e.target.value }))} className={inputCls} placeholder="R$ 0,00" />
      </FormField>
    </div>
    <FormField label="Data">
      <input type="date" value={form.data || hoje()} onChange={e => setForm((f: any) => ({ ...f, data: e.target.value }))} className={inputCls} />
    </FormField>
    <FormField label="Descrição">
      <input type="text" value={form.descricao || ''} onChange={e => setForm((f: any) => ({ ...f, descricao: e.target.value }))} className={inputCls} />
    </FormField>
    <div className="flex items-center gap-2">
      <input type="checkbox" id="descontado" checked={!!form.descontado} onChange={e => setForm((f: any) => ({ ...f, descontado: e.target.checked }))} className="w-4 h-4" />
      <label htmlFor="descontado" className="text-sm text-slate-700 dark:text-slate-300">Já descontado</label>
    </div>
  </>;
}

function CamposAdvertencia({ form, setForm }: any) {
  return <>
    <FormField label="Data">
      <input type="date" value={form.data || hoje()} onChange={e => setForm((f: any) => ({ ...f, data: e.target.value }))} className={inputCls} />
    </FormField>
    <FormField label="Motivo">
      <input type="text" value={form.motivo || ''} onChange={e => setForm((f: any) => ({ ...f, motivo: e.target.value }))} className={inputCls} />
    </FormField>
    <FormField label="Nível">
      <select value={form.nivel || 'escrita'} onChange={e => setForm((f: any) => ({ ...f, nivel: e.target.value }))} className={selectCls}>
        <option value="verbal">Verbal</option>
        <option value="escrita">Escrita</option>
        <option value="grave">Grave</option>
      </select>
    </FormField>
    <FormField label="Descrição">
      <textarea value={form.descricao || ''} onChange={e => setForm((f: any) => ({ ...f, descricao: e.target.value }))} className={`${inputCls} h-20 resize-none`} />
    </FormField>
  </>;
}

function CamposSuspensao({ form, setForm }: any) {
  return <>
    <div className="grid grid-cols-2 gap-3">
      <FormField label="Início">
        <input type="date" value={form.data_inicio || hoje()} onChange={e => setForm((f: any) => ({ ...f, data_inicio: e.target.value }))} className={inputCls} />
      </FormField>
      <FormField label="Fim">
        <input type="date" value={form.data_fim || hoje()} onChange={e => setForm((f: any) => ({ ...f, data_fim: e.target.value }))} className={inputCls} />
      </FormField>
    </div>
    <FormField label="Motivo">
      <textarea value={form.motivo || ''} onChange={e => setForm((f: any) => ({ ...f, motivo: e.target.value }))} className={`${inputCls} h-20 resize-none`} />
    </FormField>
    <div className="flex items-center gap-2">
      <input type="checkbox" id="com_desconto" checked={form.com_desconto !== false} onChange={e => setForm((f: any) => ({ ...f, com_desconto: e.target.checked }))} className="w-4 h-4" />
      <label htmlFor="com_desconto" className="text-sm text-slate-700 dark:text-slate-300">Com desconto salarial</label>
    </div>
  </>;
}

function CamposFalta({ form, setForm }: any) {
  return <>
    <FormField label="Data">
      <input type="date" value={form.data || hoje()} onChange={e => setForm((f: any) => ({ ...f, data: e.target.value }))} className={inputCls} />
    </FormField>
    <FormField label="Motivo">
      <input type="text" value={form.motivo || ''} onChange={e => setForm((f: any) => ({ ...f, motivo: e.target.value }))} className={inputCls} />
    </FormField>
    <FormField label="Observação">
      <input type="text" value={form.observacao || ''} onChange={e => setForm((f: any) => ({ ...f, observacao: e.target.value }))} className={inputCls} />
    </FormField>
    <div className="flex gap-4">
      <div className="flex items-center gap-2">
        <input type="checkbox" id="justificada" checked={!!form.justificada} onChange={e => setForm((f: any) => ({ ...f, justificada: e.target.checked }))} className="w-4 h-4" />
        <label htmlFor="justificada" className="text-sm text-slate-700 dark:text-slate-300">Justificada</label>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="com_desconto_falta" checked={form.com_desconto !== false} onChange={e => setForm((f: any) => ({ ...f, com_desconto: e.target.checked }))} className="w-4 h-4" />
        <label htmlFor="com_desconto_falta" className="text-sm text-slate-700 dark:text-slate-300">Com desconto</label>
      </div>
    </div>
  </>;
}

// ── Linhas de cada tab ────────────────────────────────────────────────────

function LinhaRecibo({ item, onDel, colaboradores }: any) {
  const nome = colaboradores.find((c: any) => c.id === item.colaborador_id)?.funcionario?.nome ?? '—';
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="font-semibold text-slate-800 dark:text-white truncate">{nome}</div>
        <div className="text-xs text-slate-500">{item.mes_referencia} · {item.descricao || 'Sem descrição'}</div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="font-bold text-slate-700 dark:text-white">{fmtMoeda(item.valor)}</span>
        <Badge label={item.status === 'pago' ? '✓ Pago' : 'Pendente'} color={item.status === 'pago' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'} />
        <button onClick={onDel} className={btnDanger}><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

function LinhaVale({ item, onDel, colaboradores }: any) {
  const nome = colaboradores.find((c: any) => c.id === item.colaborador_id)?.funcionario?.nome ?? '—';
  const tipoLabel: Record<string, string> = { alimentacao: '🍽️ Alimentação', transporte: '🚌 Transporte', adiantamento: '💵 Adiantamento', outro: '📦 Outro' };
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="font-semibold text-slate-800 dark:text-white truncate">{nome}</div>
        <div className="text-xs text-slate-500">{tipoLabel[item.tipo] || item.tipo} · {fmtData(item.data)}</div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="font-bold text-slate-700 dark:text-white">{fmtMoeda(item.valor)}</span>
        {item.descontado && <Badge label="Descontado" color="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" />}
        <button onClick={onDel} className={btnDanger}><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

function LinhaAdvertencia({ item, onDel, colaboradores }: any) {
  const nome = colaboradores.find((c: any) => c.id === item.colaborador_id)?.funcionario?.nome ?? '—';
  const nivelColor: Record<string, string> = {
    verbal: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    escrita: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    grave: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  };
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="font-semibold text-slate-800 dark:text-white truncate">{nome}</div>
        <div className="text-xs text-slate-500">{fmtData(item.data)} · {item.motivo}</div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Badge label={item.nivel.charAt(0).toUpperCase() + item.nivel.slice(1)} color={nivelColor[item.nivel] || ''} />
        <button onClick={onDel} className={btnDanger}><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

function LinhaSuspensao({ item, onDel, colaboradores }: any) {
  const nome = colaboradores.find((c: any) => c.id === item.colaborador_id)?.funcionario?.nome ?? '—';
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="font-semibold text-slate-800 dark:text-white truncate">{nome}</div>
        <div className="text-xs text-slate-500">{fmtData(item.data_inicio)} → {fmtData(item.data_fim)} · {item.motivo}</div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {item.com_desconto && <Badge label="Com desconto" color="bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300" />}
        <button onClick={onDel} className={btnDanger}><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

function LinhaFalta({ item, onDel, colaboradores }: any) {
  const nome = colaboradores.find((c: any) => c.id === item.colaborador_id)?.funcionario?.nome ?? '—';
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="font-semibold text-slate-800 dark:text-white truncate">{nome}</div>
        <div className="text-xs text-slate-500">{fmtData(item.data)} · {item.motivo || 'Sem motivo'}</div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Badge label={item.justificada ? 'Justificada' : 'Injustificada'} color={item.justificada ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'} />
        {item.com_desconto && <Badge label="Desconto" color="bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300" />}
        <button onClick={onDel} className={btnDanger}><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; icon: React.ComponentType<any> }[] = [
  { key: 'colaboradores', label: 'Colaboradores', icon: Users },
  { key: 'ponto', label: 'Ponto', icon: Clock },
  { key: 'recibos', label: 'Recibos', icon: FileText },
  { key: 'vales', label: 'Vales', icon: Wallet },
  { key: 'advertencias', label: 'Advertências', icon: AlertTriangle },
  { key: 'suspensoes', label: 'Suspensões', icon: PauseCircle },
  { key: 'faltas', label: 'Faltas', icon: Calendar },
];

export default function GentePage() {
  const [tab, setTab] = useState<Tab>('colaboradores');
  const [reload, setReload] = useState(0);
  const [colaboradores, setColaboradores] = useState<any[]>([]);

  const carregarColaboradores = useCallback(async () => {
    try {
      const res = await fetch(`${API}/gente/colaboradores`, { credentials: 'include' });
      const data = await res.json();
      setColaboradores(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  useEffect(() => { carregarColaboradores(); }, [carregarColaboradores, reload]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white">Gente</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Gestão de pessoas — funcionários e voluntários</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Users size={16} />
          <span>{colaboradores.length} colaborador{colaboradores.length !== 1 ? 'es' : ''}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-6 scrollbar-hide">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest whitespace-nowrap transition-all ${
                tab === t.key
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Conteúdo */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-6 shadow-sm">
        {tab === 'colaboradores' && <ColaboradoresTab reload={reload} />}
        {tab === 'ponto' && <PontoTab reload={reload} />}
        {tab === 'recibos' && (
          <GenericTab
            endpoint="recibos" titulo="Recibo" reload={reload} colaboradores={colaboradores}
            campos={<CamposRecibo />}
            renderLinha={(item, onDel) => <LinhaRecibo item={item} onDel={onDel} colaboradores={colaboradores} />}
          />
        )}
        {tab === 'vales' && (
          <GenericTab
            endpoint="vales" titulo="Vale" reload={reload} colaboradores={colaboradores}
            campos={<CamposVale />}
            renderLinha={(item, onDel) => <LinhaVale item={item} onDel={onDel} colaboradores={colaboradores} />}
          />
        )}
        {tab === 'advertencias' && (
          <GenericTab
            endpoint="advertencias" titulo="Advertência" reload={reload} colaboradores={colaboradores}
            campos={<CamposAdvertencia />}
            renderLinha={(item, onDel) => <LinhaAdvertencia item={item} onDel={onDel} colaboradores={colaboradores} />}
          />
        )}
        {tab === 'suspensoes' && (
          <GenericTab
            endpoint="suspensoes" titulo="Suspensão" reload={reload} colaboradores={colaboradores}
            campos={<CamposSuspensao />}
            renderLinha={(item, onDel) => <LinhaSuspensao item={item} onDel={onDel} colaboradores={colaboradores} />}
          />
        )}
        {tab === 'faltas' && (
          <GenericTab
            endpoint="faltas" titulo="Falta" reload={reload} colaboradores={colaboradores}
            campos={<CamposFalta />}
            renderLinha={(item, onDel) => <LinhaFalta item={item} onDel={onDel} colaboradores={colaboradores} />}
          />
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  Users, Clock, FileText, Wallet, AlertTriangle,
  PauseCircle, Calendar, Plus, Search, X, Edit2,
  Trash2, ExternalLink, ChevronDown, ChevronUp,
  RefreshCw, MapPin, Tag, Calculator, Printer,
  Check, Upload, User,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';
const CNPJ = '11.759.851/0001-39';
const EMPRESA = 'Instituto Tia Pretinha';
const ENDERECO = 'Rua Ramiro Monteiro, 130 — Vaz Lobo';

type Tab = 'colaboradores' | 'ponto' | 'codigos' | 'recibos' | 'vales' | 'advertencias' | 'suspensoes' | 'faltas';

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = {
  data: (iso: string) => iso ? new Date(iso.includes('T') ? iso : iso + 'T12:00:00').toLocaleDateString('pt-BR') : '—',
  hora: (iso: string) => iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—',
  moeda: (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0),
  mes: (ym: string) => { // YYYY-MM → MAR/26
    if (!ym) return '—';
    const [y, m] = ym.split('-');
    const nomes = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
    return `${nomes[parseInt(m) - 1]}/${y.slice(2)}`;
  },
};

const hoje = () => new Date().toISOString().split('T')[0];

// ── UI primitivos ─────────────────────────────────────────────────────────────

const ic = 'w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-400';
const bp = 'bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition disabled:opacity-50';
const bs = 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-bold px-4 py-2 rounded-xl text-sm transition';
const bd = 'bg-red-50 hover:bg-red-100 text-red-600 font-bold px-3 py-1.5 rounded-lg text-xs transition';

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>{label}</span>;
}

function Modal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-2xl ${wide ? 'w-full max-w-3xl' : 'w-full max-w-lg'} max-h-[92vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-700">
          <h2 className="font-black text-slate-800 dark:text-white text-lg">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

function FL({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{label}</label>
      {children}
    </div>
  );
}

// ── Tab: Colaboradores ────────────────────────────────────────────────────────

function ColaboradoresTab({ reload, colaboradores, carregarColaboradores }: { reload: number; colaboradores: any[]; carregarColaboradores: () => void }) {
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<'vincular' | 'novo' | 'codigos' | 'editar-cadastro' | null>(null);
  const [editando, setEditando] = useState<any | null>(null);
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const [funcionariosDisp, setFuncionariosDisp] = useState<any[]>([]);
  const [codigos, setCodigos] = useState<any[]>([]);
  const [codigosCol, setCodigosCol] = useState<any[]>([]);
  const [colSelecionado, setColSelecionado] = useState<any | null>(null);
  const [salvando, setSalvando] = useState(false);
  const fotoRef = useRef<HTMLInputElement>(null);
  const [uploadandoFoto, setUploadandoFoto] = useState<string | null>(null);
  const [valoresCustom, setValoresCustom] = useState<Record<string, number>>({});

  const [form, setForm] = useState<any>({
    tipo: 'voluntario', dias_trabalho: ['seg', 'ter', 'qua', 'qui', 'sex'],
    horario_entrada: '08:00', horario_saida: '17:00',
  });
  const [formFunc, setFormFunc] = useState<any>({ pais: 'Brasil' });

  const carregarDisp = async () => {
    const r = await fetch(`${API}/gente/colaboradores/funcionarios-disponiveis`, { credentials: 'include' });
    setFuncionariosDisp(await r.json());
  };

  const carregarCodigos = async () => {
    const r = await fetch(`${API}/gente/codigos-ajuda`, { credentials: 'include' });
    setCodigos(Array.isArray(await r.clone().json()) ? await r.json() : []);
  };

  useEffect(() => { carregarCodigos(); }, [reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrirCodigosColaborador = async (col: any) => {
    setColSelecionado(col);
    const r = await fetch(`${API}/gente/colaboradores/${col.id}/codigos`, { credentials: 'include' });
    setCodigosCol(await r.json());
    setValoresCustom({});
    setModal('codigos');
  };

  const salvarEdicaoCadastro = async () => {
    if (!colSelecionado?.id) return;
    setSalvando(true);
    try {
      const r = await fetch(`${API}/gente/colaboradores/${colSelecionado.id}/funcionario`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formFunc),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      toast.success('Cadastro atualizado!'); setModal(null); carregarColaboradores();
    } catch (e: any) { toast.error(e.message); }
    setSalvando(false);
  };

  const atribuirCodigo = async (codigo_id: string) => {
    if (!colSelecionado) return;
    const valor = valoresCustom[codigo_id];
    const r = await fetch(`${API}/gente/colaboradores/${colSelecionado.id}/codigos`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo_id, valor_personalizado: valor }),
    });
    if (r.ok) { toast.success('Código atribuído!'); abrirCodigosColaborador(colSelecionado); }
    else toast.error('Erro ao atribuir código.');
  };

  const removerCodigoCol = async (id: string) => {
    await fetch(`${API}/gente/colaborador-codigos/${id}`, { method: 'DELETE', credentials: 'include' });
    toast.success('Removido.'); abrirCodigosColaborador(colSelecionado);
  };

  const salvarVincular = async () => {
    if (!form.funcionario_id) { toast.error('Selecione um funcionário.'); return; }
    setSalvando(true);
    try {
      const url = editando ? `${API}/gente/colaboradores/${editando.id}` : `${API}/gente/colaboradores`;
      const method = editando ? 'PATCH' : 'POST';
      const r = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      toast.success('Salvo!'); setModal(null); carregarColaboradores();
    } catch (e: any) { toast.error(e.message); }
    setSalvando(false);
  };

  const salvarNovoFuncionario = async () => {
    if (!formFunc.nome) { toast.error('Nome é obrigatório.'); return; }
    setSalvando(true);
    try {
      const r = await fetch(`${API}/gente/colaboradores/novo-funcionario`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funcionario: formFunc, colaborador: form }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      toast.success('Funcionário e colaborador criados!'); setModal(null); carregarColaboradores();
    } catch (e: any) { toast.error(e.message); }
    setSalvando(false);
  };

  const handleFoto = async (e: React.ChangeEvent<HTMLInputElement>, funcId: string, colId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadandoFoto(colId);
    const fd = new FormData(); fd.append('foto', file);
    try {
      const r = await fetch(`${API.replace('/api', '')}/api/funcionarios/${funcId}/foto`, {
        method: 'PATCH', credentials: 'include', body: fd,
      });
      if (r.ok) { toast.success('Foto atualizada!'); carregarColaboradores(); }
      else toast.error('Erro ao enviar foto.');
    } finally { setUploadandoFoto(null); }
  };

  const remover = async (id: string) => {
    if (!confirm('Desativar colaborador?')) return;
    await fetch(`${API}/gente/colaboradores/${id}`, { method: 'DELETE', credentials: 'include' });
    toast.success('Desativado.'); carregarColaboradores();
  };

  const DIAS_OPT = [
    { k: 'seg', l: 'Seg' }, { k: 'ter', l: 'Ter' }, { k: 'qua', l: 'Qua' },
    { k: 'qui', l: 'Qui' }, { k: 'sex', l: 'Sex' }, { k: 'sab', l: 'Sáb' }, { k: 'dom', l: 'Dom' },
  ];
  const toggleDia = (dia: string) =>
    setForm((f: any) => ({ ...f, dias_trabalho: (f.dias_trabalho || []).includes(dia) ? f.dias_trabalho.filter((d: string) => d !== dia) : [...(f.dias_trabalho || []), dia] }));

  const usarGeo = () => {
    navigator.geolocation?.getCurrentPosition(pos => {
      setForm((f: any) => ({ ...f, latitude_permitida: pos.coords.latitude, longitude_permitida: pos.coords.longitude }));
      toast.success('Localização capturada!');
    }, () => toast.error('Não foi possível obter localização.'), { enableHighAccuracy: true });
  };

  const filtrados = colaboradores.filter(c =>
    !busca || c.funcionario?.nome?.toLowerCase().includes(busca.toLowerCase()) || c.funcionario?.cargo?.toLowerCase().includes(busca.toLowerCase()));

  const PONTO_URL = typeof window !== 'undefined' ? `${window.location.origin}/ponto?token=itp-ponto-2026` : '';

  const formHorarioJSX = (
    <div className="space-y-3">
      <FL label="Tipo">
        <select value={form.tipo} onChange={e => setForm((f: any) => ({ ...f, tipo: e.target.value }))} className={ic}>
          <option value="voluntario">Voluntário</option>
          <option value="funcionario">Funcionário</option>
        </select>
      </FL>
      <FL label="Salário / Reembolso Base (R$)">
        <input type="number" step="0.01" min="0" placeholder="0,00"
          value={form.salario_base ?? ''}
          onChange={e => setForm((f: any) => ({ ...f, salario_base: e.target.value === '' ? null : Number(e.target.value) }))}
          className={ic} />
      </FL>
      <div className="grid grid-cols-2 gap-3">
        <FL label="Entrada"><input type="time" value={form.horario_entrada || ''} onChange={e => setForm((f: any) => ({ ...f, horario_entrada: e.target.value }))} className={ic} /></FL>
        <FL label="Saída"><input type="time" value={form.horario_saida || ''} onChange={e => setForm((f: any) => ({ ...f, horario_saida: e.target.value }))} className={ic} /></FL>
      </div>
      <FL label="Dias de trabalho">
        <div className="flex gap-2 flex-wrap">
          {DIAS_OPT.map(d => (
            <button key={d.k} type="button" onClick={() => toggleDia(d.k)}
              className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${(form.dias_trabalho || []).includes(d.k) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>{d.l}</button>
          ))}
        </div>
      </FL>
      <FL label="Geolocalização permitida">
        <div className="flex gap-2 items-center mb-2">
          <button type="button" onClick={usarGeo} className="text-xs text-purple-600 flex items-center gap-1 hover:underline"><MapPin size={12} />Usar localização atual</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="number" step="any" placeholder="Latitude" value={form.latitude_permitida || ''} onChange={e => setForm((f: any) => ({ ...f, latitude_permitida: e.target.value }))} className={ic} />
          <input type="number" step="any" placeholder="Longitude" value={form.longitude_permitida || ''} onChange={e => setForm((f: any) => ({ ...f, longitude_permitida: e.target.value }))} className={ic} />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-slate-500">Raio (m):</span>
          <input type="number" value={form.raio_metros || 100} onChange={e => setForm((f: any) => ({ ...f, raio_metros: Number(e.target.value) }))} className={`${ic} w-24`} />
        </div>
      </FL>
    </div>
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..." className={`${ic} pl-9`} />
        </div>
        <button onClick={() => { carregarDisp(); setEditando(null); setForm({ tipo: 'voluntario', dias_trabalho: ['seg','ter','qua','qui','sex'], horario_entrada: '08:00', horario_saida: '17:00', latitude_permitida: -22.8597901, longitude_permitida: -43.3308139, raio_metros: 100 }); setModal('vincular'); }} className={bs}>
          <Plus size={14} className="inline mr-1" />Vincular Existente
        </button>
        <button onClick={() => { setFormFunc({ pais: 'Brasil' }); setForm({ tipo: 'voluntario', dias_trabalho: ['seg','ter','qua','qui','sex'], horario_entrada: '08:00', horario_saida: '17:00', latitude_permitida: -22.8597901, longitude_permitida: -43.3308139, raio_metros: 100 }); setModal('novo'); }} className={bp}>
          <Plus size={14} className="inline mr-1" />Novo Colaborador
        </button>
        <a href={PONTO_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition">
          <ExternalLink size={14} />Link Ponto
        </a>
      </div>

      {filtrados.length === 0
        ? <div className="text-center py-12 text-slate-400">Nenhum colaborador cadastrado.</div>
        : (
          <div className="space-y-2">
            {filtrados.map(c => (
              <div key={c.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {c.funcionario?.foto
                        ? <img src={c.funcionario.foto} alt="" className="w-12 h-16 rounded-xl object-cover border border-slate-200" />
                        : <div className="w-12 h-16 rounded-xl bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-purple-700 dark:text-purple-300 font-black text-lg">{c.funcionario?.nome?.charAt(0) ?? '?'}</div>}
                      <label className="absolute -bottom-1 -right-1 cursor-pointer bg-purple-600 text-white rounded-full p-0.5 shadow">
                        {uploadandoFoto === c.id ? <RefreshCw size={10} className="animate-spin" /> : <Upload size={10} />}
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleFoto(e, c.funcionario?.id, c.id)} />
                      </label>
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 dark:text-white">{c.funcionario?.nome ?? '—'}</div>
                      <div className="text-xs text-slate-500">{c.funcionario?.cargo ?? ''}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{c.funcionario?.matricula ?? ''}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <Badge label={c.tipo === 'voluntario' ? 'Voluntário' : 'Funcionário'} color={c.tipo === 'voluntario' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'} />
                    {c.horario_entrada && <span className="text-xs text-slate-400 hidden sm:block">{c.horario_entrada}→{c.horario_saida}</span>}
                    <button onClick={() => abrirCodigosColaborador(c)} className="p-1.5 text-slate-400 hover:text-emerald-600 transition" title="Códigos VR"><Tag size={14} /></button>
                    <button onClick={() => { setColSelecionado(c); setFormFunc({ ...c.funcionario }); setModal('editar-cadastro'); }} className="p-1.5 text-slate-400 hover:text-blue-500 transition" title="Editar Cadastro"><User size={14} /></button>
                    <button onClick={() => { setEditando(c); setForm({ ...c }); carregarDisp(); setModal('vincular'); }} className="p-1.5 text-slate-400 hover:text-purple-600 transition" title="Editar Ponto/Horário"><Edit2 size={14} /></button>
                    <button onClick={() => setDetalhe(detalhe === c.id ? null : c.id)} className="p-1.5 text-slate-400 hover:text-blue-500 transition">
                      {detalhe === c.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button onClick={() => remover(c.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition"><Trash2 size={14} /></button>
                  </div>
                </div>
                {detalhe === c.id && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div><span className="text-slate-400 block">CPF</span><span className="font-semibold">{c.funcionario?.cpf || '—'}</span></div>
                    <div><span className="text-slate-400 block">Estado Civil</span><span className="font-semibold">{c.funcionario?.estado_civil || '—'}</span></div>
                    <div><span className="text-slate-400 block">RG</span><span className="font-semibold">{c.funcionario?.rg || '—'}</span></div>
                    <div><span className="text-slate-400 block">Celular</span><span className="font-semibold">{c.funcionario?.celular || '—'}</span></div>
                    <div><span className="text-slate-400 block">Salário Base</span><span className="font-semibold">{c.salario_base ? fmt.moeda(c.salario_base) : '—'}</span></div>
                    <div><span className="text-slate-400 block">Horário</span><span className="font-semibold">{c.horario_entrada || '—'} → {c.horario_saida || '—'}</span></div>
                    <div><span className="text-slate-400 block">Dias</span><span className="font-semibold">{(c.dias_trabalho || []).join(', ') || '—'}</span></div>
                    <div><span className="text-slate-400 block">Geofence</span><span className="font-semibold">{c.latitude_permitida ? `${Number(c.latitude_permitida).toFixed(4)},${Number(c.longitude_permitida).toFixed(4)}` : '—'}</span></div>
                    <div><span className="text-slate-400 block">Raio</span><span className="font-semibold">{c.raio_metros ?? 100}m</span></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      {/* Modal: Vincular existente */}
      {modal === 'vincular' && (
        <Modal title={editando ? 'Editar Colaborador' : 'Vincular Funcionário'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            {!editando && (
              <FL label="Funcionário">
                <select value={form.funcionario_id || ''} onChange={e => setForm((f: any) => ({ ...f, funcionario_id: e.target.value }))} className={ic}>
                  <option value="">Selecione...</option>
                  {funcionariosDisp.map(f => <option key={f.id} value={f.id}>{f.nome}{f.cargo ? ` — ${f.cargo}` : ''}</option>)}
                </select>
              </FL>
            )}
            {formHorarioJSX}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModal(null)} className={bs}>Cancelar</button>
              <button onClick={salvarVincular} disabled={salvando} className={bp}>{salvando ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Novo Funcionário */}
      {modal === 'novo' && (
        <Modal title="Novo Colaborador" onClose={() => setModal(null)} wide>
          <div className="space-y-4">
            <p className="text-xs text-slate-500 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl px-4 py-3">
              Cria um novo funcionário no Cadastro Básico e já o vincula ao módulo Gente.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><FL label="Nome Completo *"><input type="text" value={formFunc.nome || ''} onChange={e => setFormFunc((f: any) => ({ ...f, nome: e.target.value }))} className={ic} /></FL></div>
              <FL label="Cargo / Função"><input type="text" value={formFunc.cargo || ''} onChange={e => setFormFunc((f: any) => ({ ...f, cargo: e.target.value }))} className={ic} /></FL>
              <FL label="CPF"><input type="text" value={formFunc.cpf || ''} onChange={e => setFormFunc((f: any) => ({ ...f, cpf: e.target.value }))} className={ic} /></FL>
              <FL label="RG"><input type="text" value={formFunc.rg || ''} onChange={e => setFormFunc((f: any) => ({ ...f, rg: e.target.value }))} className={ic} /></FL>
              <FL label="Estado Civil">
                <select value={formFunc.estado_civil || ''} onChange={e => setFormFunc((f: any) => ({ ...f, estado_civil: e.target.value }))} className={ic}>
                  <option value="">Selecione...</option>
                  {['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável'].map(v => <option key={v}>{v}</option>)}
                </select>
              </FL>
              <FL label="Celular"><input type="text" value={formFunc.celular || ''} onChange={e => setFormFunc((f: any) => ({ ...f, celular: e.target.value }))} className={ic} /></FL>
              <FL label="Data de Nascimento"><input type="date" value={formFunc.data_nascimento || ''} onChange={e => setFormFunc((f: any) => ({ ...f, data_nascimento: e.target.value }))} className={ic} /></FL>
              <FL label="CEP"><input type="text" value={formFunc.cep || ''} onChange={async e => {
                const cep = e.target.value.replace(/\D/g, '');
                setFormFunc((f: any) => ({ ...f, cep: e.target.value }));
                if (cep.length === 8) {
                  const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                  const d = await r.json();
                  if (!d.erro) setFormFunc((f: any) => ({ ...f, logradouro: d.logradouro, bairro: d.bairro, cidade: d.localidade, estado: d.uf }));
                }
              }} className={ic} /></FL>
              <FL label="Logradouro"><input type="text" value={formFunc.logradouro || ''} onChange={e => setFormFunc((f: any) => ({ ...f, logradouro: e.target.value }))} className={ic} /></FL>
              <FL label="Número"><input type="text" value={formFunc.numero_residencia || ''} onChange={e => setFormFunc((f: any) => ({ ...f, numero_residencia: e.target.value }))} className={ic} /></FL>
              <FL label="Bairro"><input type="text" value={formFunc.bairro || ''} onChange={e => setFormFunc((f: any) => ({ ...f, bairro: e.target.value }))} className={ic} /></FL>
              <FL label="Cidade"><input type="text" value={formFunc.cidade || ''} onChange={e => setFormFunc((f: any) => ({ ...f, cidade: e.target.value }))} className={ic} /></FL>
            </div>
            <div className="border-t dark:border-slate-700 pt-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Configuração de Ponto</p>
              {formHorarioJSX}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModal(null)} className={bs}>Cancelar</button>
              <button onClick={salvarNovoFuncionario} disabled={salvando} className={bp}>{salvando ? 'Criando...' : 'Criar Colaborador'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Códigos VR do colaborador */}
      {modal === 'codigos' && colSelecionado && (
        <Modal title={`Códigos VR — ${colSelecionado.funcionario?.nome ?? ''}`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <p className="text-xs text-slate-500">Gerencie os proventos de ajuda de custo deste colaborador.</p>
            {codigosCol.length > 0 ? (
              <div className="space-y-2">
                {codigosCol.map((cc: any) => (
                  <div key={cc.id} className="flex items-center justify-between border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-purple-600">{cc.codigo?.codigo}</span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-white ml-2">{cc.codigo?.descricao}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700 dark:text-white text-sm">{fmt.moeda(cc.valor_efetivo)}</span>
                      <button onClick={() => removerCodigoCol(cc.id)} className={bd}><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-slate-400 text-sm text-center py-4">Nenhum código atribuído.</p>}
            <div className="border-t dark:border-slate-700 pt-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Adicionar código</p>
              {codigos.filter(c => c.ativo && !codigosCol.some((cc: any) => cc.codigo_id === c.id)).length === 0
                ? <p className="text-slate-400 text-sm text-center py-3">Todos os códigos já foram atribuídos.</p>
                : codigos.filter(c => c.ativo && !codigosCol.some((cc: any) => cc.codigo_id === c.id)).map(c => (
                <div key={c.id} className="flex items-center gap-2 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-xs font-bold text-slate-500">{c.codigo}</span>
                    <span className="text-sm text-slate-700 dark:text-slate-300 ml-2">{c.descricao}</span>
                    <span className="text-xs text-slate-400 ml-1">(base: {fmt.moeda(c.valor_base)})</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-slate-500">R$</span>
                    <input
                      type="number" step="0.01" min="0"
                      value={valoresCustom[c.id] ?? c.valor_base ?? 0}
                      onChange={e => setValoresCustom(v => ({ ...v, [c.id]: Number(e.target.value) }))}
                      className="w-24 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                    <button onClick={() => atribuirCodigo(c.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition">
                      <Plus size={12} className="inline" /> Adicionar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Editar Cadastro do Funcionário */}
      {modal === 'editar-cadastro' && colSelecionado && (
        <Modal title={`Editar Cadastro — ${colSelecionado.funcionario?.nome ?? ''}`} onClose={() => setModal(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><FL label="Nome Completo *"><input type="text" value={formFunc.nome || ''} onChange={e => setFormFunc((f: any) => ({ ...f, nome: e.target.value }))} className={ic} /></FL></div>
              <FL label="Cargo / Função"><input type="text" value={formFunc.cargo || ''} onChange={e => setFormFunc((f: any) => ({ ...f, cargo: e.target.value }))} className={ic} /></FL>
              <FL label="CPF"><input type="text" value={formFunc.cpf || ''} onChange={e => setFormFunc((f: any) => ({ ...f, cpf: e.target.value }))} className={ic} /></FL>
              <FL label="RG"><input type="text" value={formFunc.rg || ''} onChange={e => setFormFunc((f: any) => ({ ...f, rg: e.target.value }))} className={ic} /></FL>
              <FL label="Órgão Emissor RG"><input type="text" value={formFunc.orgao_emissor_rg || ''} onChange={e => setFormFunc((f: any) => ({ ...f, orgao_emissor_rg: e.target.value }))} className={ic} /></FL>
              <FL label="Estado Civil">
                <select value={formFunc.estado_civil || ''} onChange={e => setFormFunc((f: any) => ({ ...f, estado_civil: e.target.value }))} className={ic}>
                  <option value="">Selecione...</option>
                  {['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável'].map(v => <option key={v}>{v}</option>)}
                </select>
              </FL>
              <FL label="Celular"><input type="text" value={formFunc.celular || ''} onChange={e => setFormFunc((f: any) => ({ ...f, celular: e.target.value }))} className={ic} /></FL>
              <FL label="Email"><input type="email" value={formFunc.email || ''} onChange={e => setFormFunc((f: any) => ({ ...f, email: e.target.value }))} className={ic} /></FL>
              <FL label="Data de Nascimento"><input type="date" value={formFunc.data_nascimento || ''} onChange={e => setFormFunc((f: any) => ({ ...f, data_nascimento: e.target.value }))} className={ic} /></FL>
              <FL label="CEP"><input type="text" value={formFunc.cep || ''} onChange={async e => {
                const cep = e.target.value.replace(/\D/g, '');
                setFormFunc((f: any) => ({ ...f, cep: e.target.value }));
                if (cep.length === 8) {
                  const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                  const d = await r.json();
                  if (!d.erro) setFormFunc((f: any) => ({ ...f, logradouro: d.logradouro, bairro: d.bairro, cidade: d.localidade, estado: d.uf }));
                }
              }} className={ic} /></FL>
              <FL label="Logradouro"><input type="text" value={formFunc.logradouro || ''} onChange={e => setFormFunc((f: any) => ({ ...f, logradouro: e.target.value }))} className={ic} /></FL>
              <FL label="Número"><input type="text" value={formFunc.numero_residencia || ''} onChange={e => setFormFunc((f: any) => ({ ...f, numero_residencia: e.target.value }))} className={ic} /></FL>
              <FL label="Complemento"><input type="text" value={formFunc.complemento || ''} onChange={e => setFormFunc((f: any) => ({ ...f, complemento: e.target.value }))} className={ic} /></FL>
              <FL label="Bairro"><input type="text" value={formFunc.bairro || ''} onChange={e => setFormFunc((f: any) => ({ ...f, bairro: e.target.value }))} className={ic} /></FL>
              <FL label="Cidade"><input type="text" value={formFunc.cidade || ''} onChange={e => setFormFunc((f: any) => ({ ...f, cidade: e.target.value }))} className={ic} /></FL>
              <FL label="País"><input type="text" value={formFunc.pais || 'Brasil'} onChange={e => setFormFunc((f: any) => ({ ...f, pais: e.target.value }))} className={ic} /></FL>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModal(null)} className={bs}>Cancelar</button>
              <button onClick={salvarEdicaoCadastro} disabled={salvando} className={bp}>{salvando ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Tab: Códigos VR ───────────────────────────────────────────────────────────

function CodigosTab({ reload }: { reload: number }) {
  const [codigos, setCodigos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ valor_base: 0, ativo: true });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`${API}/gente/codigos-ajuda`, { credentials: 'include' });
    setCodigos(Array.isArray(await r.json()) ? await r.clone().json() : []);
    const r2 = await fetch(`${API}/gente/codigos-ajuda`, { credentials: 'include' });
    setCodigos(await r2.json());
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

// ── Recibo PDF ────────────────────────────────────────────────────────────────

function ReciboImpresso({ recibo, onClose }: { recibo: any; onClose: () => void }) {
  const mesRef = fmt.mes(recibo.mes_referencia ?? '');
  const proventos: any[] = recibo.proventos ?? [];
  const descontos: any[] = recibo.descontos ?? [];
  const totalProv = recibo.totalProventos ?? 0;
  const totalDesc = recibo.totalDescontos ?? 0;
  const liquido = recibo.liquido ?? recibo.valor ?? 0;
  const LINHAS_MIN = 8;

  return (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white print:hidden">
        <h2 className="font-bold text-slate-700">Recibo de Reembolso de Despesas</h2>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className={bp}><Printer size={14} className="inline mr-1" />Imprimir</button>
          <button onClick={onClose} className={bs}>Fechar</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 print:p-0">
        {/* Recibo – segue layout do modelo */}
        <div id="recibo-print" className="max-w-[800px] mx-auto border border-black text-[11px] font-sans" style={{ fontFamily: 'Arial, sans-serif' }}>
          {/* Cabeçalho */}
          <div className="grid grid-cols-2 border-b border-black">
            <div className="p-2 border-r border-black space-y-0.5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Empregador</div>
              <div className="flex gap-4">
                <div><div className="text-[9px] text-slate-500">Nome</div><div className="font-bold">{EMPRESA}</div></div>
              </div>
              <div className="flex gap-4">
                <div><div className="text-[9px] text-slate-500">Endereço</div><div>{ENDERECO}</div></div>
              </div>
              <div><div className="text-[9px] text-slate-500">CNPJ</div><div className="font-mono">{CNPJ}</div></div>
            </div>
            <div className="p-2 text-right">
              <div className="text-base font-black uppercase">Recibo de Reembolso de Despesas</div>
              <div className="text-[9px] text-slate-500 mt-1">Referente ao Mês / Ano</div>
              <div className="text-xl font-black mt-1">{mesRef}</div>
            </div>
          </div>

          {/* Identificação do colaborador */}
          <div className="grid grid-cols-3 border-b border-black">
            <div className="p-2 border-r border-black">
              <div className="text-[9px] text-slate-500 uppercase">Código</div>
              <div className="font-bold">{recibo.codigo_colaborador ?? '00001'}</div>
            </div>
            <div className="p-2 border-r border-black">
              <div className="text-[9px] text-slate-500 uppercase">Nome do Voluntário</div>
              <div className="font-bold">{recibo.funcionario?.nome ?? '—'}</div>
            </div>
            <div className="p-2">
              <div className="text-[9px] text-slate-500 uppercase">Função</div>
              <div className="font-bold uppercase">{recibo.funcionario?.cargo ?? '—'}</div>
            </div>
          </div>

          {/* Tabela de proventos e descontos */}
          <table className="w-full border-b border-black">
            <thead>
              <tr className="border-b border-black bg-slate-50">
                <th className="border-r border-black px-2 py-1 text-left text-[9px] uppercase w-16">Código</th>
                <th className="border-r border-black px-2 py-1 text-left text-[9px] uppercase">Descrição</th>
                <th className="border-r border-black px-2 py-1 text-center text-[9px] uppercase w-20">Referência</th>
                <th className="border-r border-black px-2 py-1 text-right text-[9px] uppercase w-24">Proventos</th>
                <th className="px-2 py-1 text-right text-[9px] uppercase w-24">Descontos</th>
              </tr>
            </thead>
            <tbody>
              {proventos.map((p: any, i: number) => (
                <tr key={i} className="border-b border-slate-200">
                  <td className="border-r border-black px-2 py-1 font-mono font-bold text-blue-700">{p.codigo}</td>
                  <td className="border-r border-black px-2 py-1 font-semibold">{p.descricao}</td>
                  <td className="border-r border-black px-2 py-1 text-center text-blue-700 font-bold">{p.referencia || mesRef}</td>
                  <td className="border-r border-black px-2 py-1 text-right">{Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="px-2 py-1 text-right"></td>
                </tr>
              ))}
              {descontos.map((d: any, i: number) => (
                <tr key={`d${i}`} className="border-b border-slate-200">
                  <td className="border-r border-black px-2 py-1 font-mono font-bold text-red-700">{d.codigo}</td>
                  <td className="border-r border-black px-2 py-1">{d.descricao}</td>
                  <td className="border-r border-black px-2 py-1 text-center">{d.referencia || mesRef}</td>
                  <td className="border-r border-black px-2 py-1 text-right"></td>
                  <td className="px-2 py-1 text-right">{Number(d.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
              {/* Linhas vazias */}
              {Array.from({ length: Math.max(0, LINHAS_MIN - proventos.length - descontos.length) }).map((_, i) => (
                <tr key={`e${i}`} className="border-b border-slate-100">
                  <td className="border-r border-black px-2 py-2"></td>
                  <td className="border-r border-black px-2 py-2"></td>
                  <td className="border-r border-black px-2 py-2"></td>
                  <td className="border-r border-black px-2 py-2"></td>
                  <td className="px-2 py-2"></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totais */}
          <div className="grid grid-cols-3 border-b border-black">
            <div className="p-2 col-span-2 border-r border-black">
              <div className="text-[9px] text-slate-500 uppercase font-bold">Mensagens</div>
            </div>
            <div className="p-2 space-y-1">
              <div className="flex justify-between border-b border-slate-200 pb-1">
                <span className="text-[9px] text-right text-slate-500">Total dos Vencimentos</span>
                <span className="font-bold text-[10px] ml-4">{totalProv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-1">
                <span className="text-[9px] text-right text-slate-500">Total dos Descontos</span>
                <span className="font-bold text-[10px] ml-4">{totalDesc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[9px] font-bold text-right">Líquido a Receber -&gt;</span>
                <span className="font-black text-[12px] ml-4">{liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Rodapé */}
          <div className="grid grid-cols-2 items-end p-2 gap-4">
            <div>
              <div className="text-[9px] text-slate-500">Reembolso Base</div>
              <div className="font-bold">{totalProv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">2ª Via - Empregado</div>
              <div className="mt-6 border-t border-black pt-1 text-[9px] text-slate-500">Assinatura</div>
            </div>
          </div>
          <div className="border-t border-black px-2 py-1 text-[9px] text-slate-400 text-center">
            ......................... &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; .....
          </div>
        </div>
      </div>
      <style>{`@media print { .print\\:hidden { display: none !important; } body { margin: 0; } #recibo-print { max-width: 100% !important; border: none !important; } }`}</style>
    </div>
  );
}

// ── Tab: Recibos com Folha ────────────────────────────────────────────────────

function RecibosTab({ reload, colaboradores }: { reload: number; colaboradores: any[] }) {
  const [recibos, setRecibos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCol, setFiltroCol] = useState('');
  const [calculando, setCalculando] = useState(false);
  const [mesCalculo, setMesCalculo] = useState(() => new Date().toISOString().slice(0, 7));
  const [reciboImpresso, setReciboImpresso] = useState<any | null>(null);
  const [carregandoRecibo, setCarregandoRecibo] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const params = filtroCol ? `?colaborador_id=${filtroCol}` : '';
    const r = await fetch(`${API}/gente/recibos${params}`, { credentials: 'include' });
    setRecibos(Array.isArray(await r.json()) ? await r.clone().json() : []);
    const r2 = await fetch(`${API}/gente/recibos${params}`, { credentials: 'include' });
    setRecibos(await r2.json());
    setLoading(false);
  }, [filtroCol]);

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
      <div className="flex flex-col sm:flex-row gap-3 mb-5 flex-wrap">
        <select value={filtroCol} onChange={e => setFiltroCol(e.target.value)} className={`${ic} flex-1`}>
          <option value="">Todos colaboradores</option>
          {colaboradores.map(c => <option key={c.id} value={c.id}>{c.funcionario?.nome ?? c.id}</option>)}
        </select>
        <button onClick={carregar} className={bs}><RefreshCw size={14} /></button>
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-3 py-2">
          <Calculator size={16} className="text-amber-600" />
          <input type="month" value={mesCalculo} onChange={e => setMesCalculo(e.target.value)} className="bg-transparent text-sm font-bold text-amber-700 dark:text-amber-300 focus:outline-none" />
          <button onClick={calcularFolha} disabled={calculando} className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition disabled:opacity-50">
            {calculando ? 'Calculando...' : 'Calcular Folha'}
          </button>
        </div>
      </div>
      {loading ? <div className="text-center py-12 text-slate-400">Carregando...</div> : recibos.length === 0
        ? <div className="text-center py-12 text-slate-400">Nenhum recibo. Use &quot;Calcular Folha&quot; para gerar automaticamente.</div>
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

// ── Tabs genéricas ────────────────────────────────────────────────────────────

function GenericTab({ endpoint, titulo, reload, colaboradores, CamposComp, renderLinha }: {
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
    setItems(Array.isArray(await r.json()) ? await r.clone().json() : []);
    const r2 = await fetch(`${API}/gente/${endpoint}${params}`, { credentials: 'include' });
    setItems(await r2.json());
    setLoading(false);
  }, [endpoint, filtroCol]);

  useEffect(() => { carregar(); }, [carregar, reload]);

  const salvar = async () => {
    if (!form.colaborador_id) { toast.error('Selecione um colaborador.'); return; }
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
    <div className="flex items-center gap-2"><input type="checkbox" id="desc" checked={!!form.descontado} onChange={e => setForm((f: any) => ({ ...f, descontado: e.target.checked }))} className="w-4 h-4" /><label htmlFor="desc" className="text-sm text-slate-700 dark:text-slate-300">Já descontado</label></div>
  </>
);

const CamposAdvertencia = ({ form, setForm }: any) => (
  <>
    <FL label="Data"><input type="date" value={form.data || hoje()} onChange={e => setForm((f: any) => ({ ...f, data: e.target.value }))} className={ic} /></FL>
    <FL label="Motivo"><input type="text" value={form.motivo || ''} onChange={e => setForm((f: any) => ({ ...f, motivo: e.target.value }))} className={ic} /></FL>
    <FL label="Nível"><select value={form.nivel || 'escrita'} onChange={e => setForm((f: any) => ({ ...f, nivel: e.target.value }))} className={ic}>
      <option value="verbal">Verbal</option><option value="escrita">Escrita</option><option value="grave">Grave</option>
    </select></FL>
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

const CamposFalta = ({ form, setForm }: any) => (
  <>
    <FL label="Data"><input type="date" value={form.data || hoje()} onChange={e => setForm((f: any) => ({ ...f, data: e.target.value }))} className={ic} /></FL>
    <FL label="Motivo"><input type="text" value={form.motivo || ''} onChange={e => setForm((f: any) => ({ ...f, motivo: e.target.value }))} className={ic} /></FL>
    <div className="flex gap-4">
      <div className="flex items-center gap-2"><input type="checkbox" id="just" checked={!!form.justificada} onChange={e => setForm((f: any) => ({ ...f, justificada: e.target.checked }))} className="w-4 h-4" /><label htmlFor="just" className="text-sm">Justificada</label></div>
      <div className="flex items-center gap-2"><input type="checkbox" id="fdesc" checked={form.com_desconto !== false} onChange={e => setForm((f: any) => ({ ...f, com_desconto: e.target.checked }))} className="w-4 h-4" /><label htmlFor="fdesc" className="text-sm">Com desconto</label></div>
    </div>
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

const LinhaAdvertencia = ({ item, onEdit, onDel, colaboradores }: any) => {
  const nome = colaboradores.find((c: any) => c.id === item.colaborador_id)?.funcionario?.nome ?? '—';
  const cor: Record<string, string> = { verbal: 'bg-blue-100 text-blue-700', escrita: 'bg-orange-100 text-orange-700', grave: 'bg-red-100 text-red-700' };
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0"><div className="font-semibold truncate">{nome}</div><div className="text-xs text-slate-500">{fmt.data(item.data)} · {item.motivo}</div></div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge label={item.nivel} color={cor[item.nivel] || ''} />
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
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0"><div className="font-semibold truncate">{nome}</div><div className="text-xs text-slate-500">{fmt.data(item.data)} · {item.motivo || 'Sem motivo'}</div></div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge label={item.justificada ? 'Justificada' : 'Injustificada'} color={item.justificada ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'} />
        {item.com_desconto && <Badge label="Desconto" color="bg-red-100 text-red-600" />}
        <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-purple-600"><Edit2 size={13} /></button>
        <button onClick={onDel} className={bd}><Trash2 size={12} /></button>
      </div>
    </div>
  );
};

// ── Tab Ponto ────────────────────────────────────────────────────────────────

function PontoTab({ reload, colaboradores }: { reload: number; colaboradores: any[] }) {
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCol, setFiltroCol] = useState('');
  const [filtroInicio, setFiltroInicio] = useState('');
  const [filtroFim, setFiltroFim] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState<any>({ tipo: 'entrada', data_hora: new Date().toISOString().slice(0, 16) });
  const [salvando, setSalvando] = useState(false);
  const PONTO_URL = typeof window !== 'undefined' ? `${window.location.origin}/ponto?token=itp-ponto-2026` : '';

  const carregar = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (filtroCol) p.set('colaborador_id', filtroCol);
    if (filtroInicio) p.set('data_inicio', filtroInicio);
    if (filtroFim) p.set('data_fim', filtroFim);
    const r = await fetch(`${API}/gente/ponto?${p}`, { credentials: 'include' });
    setRegistros(Array.isArray(await r.json()) ? await r.clone().json() : []);
    const r2 = await fetch(`${API}/gente/ponto?${p}`, { credentials: 'include' });
    setRegistros(await r2.json());
    setLoading(false);
  }, [filtroCol, filtroInicio, filtroFim]);

  useEffect(() => { carregar(); }, [carregar, reload]);

  const salvar = async () => {
    if (!form.colaborador_id) { toast.error('Selecione um colaborador.'); return; }
    setSalvando(true);
    const r = await fetch(`${API}/gente/ponto`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, data_hora: new Date(form.data_hora).toISOString() }) });
    if (r.ok) { toast.success('Ponto registrado!'); setModalAberto(false); carregar(); }
    else { const e = await r.json(); toast.error(e.message); }
    setSalvando(false);
  };

  const deletar = async (id: string) => {
    if (!confirm('Excluir?')) return;
    await fetch(`${API}/gente/ponto/${id}`, { method: 'DELETE', credentials: 'include' });
    toast.success('Excluído.'); carregar();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-5 flex-wrap">
        <select value={filtroCol} onChange={e => setFiltroCol(e.target.value)} className={`${ic} flex-1`}>
          <option value="">Todos</option>
          {colaboradores.map(c => <option key={c.id} value={c.id}>{c.funcionario?.nome ?? c.id}</option>)}
        </select>
        <input type="date" value={filtroInicio} onChange={e => setFiltroInicio(e.target.value)} className={`${ic} w-36`} />
        <input type="date" value={filtroFim} onChange={e => setFiltroFim(e.target.value)} className={`${ic} w-36`} />
        <button onClick={carregar} className={bs}><RefreshCw size={14} /></button>
        <button onClick={() => setModalAberto(true)} className={bp}><Plus size={14} className="inline mr-1" />Registrar</button>
        <a href={PONTO_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition whitespace-nowrap"><ExternalLink size={14} />Link Externo</a>
      </div>
      {loading ? <div className="text-center py-12 text-slate-400">Carregando...</div> : registros.length === 0
        ? <div className="text-center py-12 text-slate-400">Nenhum registro.</div>
        : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>{['Colaborador', 'Tipo', 'Data/Hora', 'Distância', 'Por', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {registros.map(r => (
                  <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-semibold">{r.colaborador_nome || '—'}</td>
                    <td className="px-4 py-3"><Badge label={r.tipo === 'entrada' ? '✅ Entrada' : '🔴 Saída'} color={r.tipo === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} /></td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs">{fmt.data(r.data_hora)} {fmt.hora(r.data_hora)}</td>
                    <td className="px-4 py-3 text-xs">{r.distancia_metros != null ? <span className={r.dentro_area ? 'text-green-600' : 'text-red-500'}>{r.distancia_metros}m {r.dentro_area ? '✓' : '⚠️'}</span> : '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{r.registrado_por}</td>
                    <td className="px-4 py-3"><button onClick={() => deletar(r.id)} className={bd}><Trash2 size={12} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      {modalAberto && (
        <Modal title="Registrar Ponto" onClose={() => setModalAberto(false)}>
          <div className="space-y-4">
            <FL label="Colaborador">
              <select value={form.colaborador_id || ''} onChange={e => setForm((f: any) => ({ ...f, colaborador_id: e.target.value }))} className={ic}>
                <option value="">Selecione...</option>
                {colaboradores.map(c => <option key={c.id} value={c.id}>{c.funcionario?.nome ?? c.id}</option>)}
              </select>
            </FL>
            <div className="grid grid-cols-2 gap-3">
              <FL label="Tipo"><select value={form.tipo} onChange={e => setForm((f: any) => ({ ...f, tipo: e.target.value }))} className={ic}><option value="entrada">Entrada</option><option value="saida">Saída</option></select></FL>
              <FL label="Data/Hora"><input type="datetime-local" value={form.data_hora} onChange={e => setForm((f: any) => ({ ...f, data_hora: e.target.value }))} className={ic} /></FL>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setModalAberto(false)} className={bs}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} className={bp}>{salvando ? 'Salvando...' : 'Registrar'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Página Principal ──────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; icon: React.ComponentType<any> }[] = [
  { key: 'colaboradores', label: 'Colaboradores', icon: Users },
  { key: 'ponto', label: 'Ponto', icon: Clock },
  { key: 'codigos', label: 'Códigos VR', icon: Tag },
  { key: 'recibos', label: 'Recibos / Folha', icon: FileText },
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
      const r = await fetch(`${API}/gente/colaboradores`, { credentials: 'include' });
      const data = await r.json();
      setColaboradores(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  useEffect(() => { carregarColaboradores(); }, [carregarColaboradores, reload]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white">Gente</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Gestão de pessoas — funcionários e voluntários</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Users size={16} /><span>{colaboradores.length} colaborador{colaboradores.length !== 1 ? 'es' : ''}</span>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1 mb-6 scrollbar-hide">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest whitespace-nowrap transition-all ${tab === t.key ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
              <Icon size={14} />{t.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-6 shadow-sm">
        {tab === 'colaboradores' && <ColaboradoresTab reload={reload} colaboradores={colaboradores} carregarColaboradores={carregarColaboradores} />}
        {tab === 'ponto' && <PontoTab reload={reload} colaboradores={colaboradores} />}
        {tab === 'codigos' && <CodigosTab reload={reload} />}
        {tab === 'recibos' && <RecibosTab reload={reload} colaboradores={colaboradores} />}
        {tab === 'vales' && <GenericTab endpoint="vales" titulo="Vale" reload={reload} colaboradores={colaboradores} CamposComp={CamposVale} renderLinha={(i, e, d) => <LinhaVale key={i.id} item={i} onEdit={e} onDel={d} colaboradores={colaboradores} />} />}
        {tab === 'advertencias' && <GenericTab endpoint="advertencias" titulo="Advertência" reload={reload} colaboradores={colaboradores} CamposComp={CamposAdvertencia} renderLinha={(i, e, d) => <LinhaAdvertencia key={i.id} item={i} onEdit={e} onDel={d} colaboradores={colaboradores} />} />}
        {tab === 'suspensoes' && <GenericTab endpoint="suspensoes" titulo="Suspensão" reload={reload} colaboradores={colaboradores} CamposComp={CamposSuspensao} renderLinha={(i, e, d) => <LinhaSuspensao key={i.id} item={i} onEdit={e} onDel={d} colaboradores={colaboradores} />} />}
        {tab === 'faltas' && <GenericTab endpoint="faltas" titulo="Falta" reload={reload} colaboradores={colaboradores} CamposComp={CamposFalta} renderLinha={(i, e, d) => <LinhaFalta key={i.id} item={i} onEdit={e} onDel={d} colaboradores={colaboradores} />} />}
      </div>
    </div>
  );
}

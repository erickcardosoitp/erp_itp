'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  Users, Clock, FileText, Wallet, AlertTriangle,
  PauseCircle, Calendar, Plus, Search, X, Edit2,
  Trash2, ExternalLink, ChevronDown, ChevronUp,
  RefreshCw, MapPin, Tag, Calculator, Printer,
  Check, Upload, User, DollarSign, Paperclip, Bus,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';
const CNPJ = '11.759.851/0001-39';
const EMPRESA = 'Instituto Tia Pretinha';
const ENDERECO = 'Rua Ramiro Monteiro, 130 — Vaz Lobo';

type MainTab = 'colaboradores' | 'ponto' | 'folha' | 'disciplinar' | 'codigos';
type Tab = MainTab; // kept for compat

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
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState('ativo');
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<'vincular' | 'novo' | 'codigos' | 'editar' | null>(null);
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
  const [locais, setLocais] = useState<any[]>([]);
  const [formLocal, setFormLocal] = useState<any>({ nome: '', latitude: '', longitude: '', raio_metros: 100 });
  const [editandoLocal, setEditandoLocal] = useState<string | null>(null);

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
    const cd = await r.json();
    setCodigos(Array.isArray(cd) ? cd : []);
  };

  useEffect(() => { carregarCodigos(); }, [reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrirCodigosColaborador = async (col: any) => {
    setColSelecionado(col);
    const r = await fetch(`${API}/gente/colaboradores/${col.id}/codigos`, { credentials: 'include' });
    setCodigosCol(await r.json());
    setValoresCustom({});
    setModal('codigos');
  };

  const salvarEdicaoCompleta = async () => {
    if (!colSelecionado?.id || !editando?.id) return;
    setSalvando(true);
    try {
      // Salva dados do funcionário
      const { foto, id, matricula, ativo, created_at, updated_at, usuario_id, ...payloadFunc } = formFunc;
      const r1 = await fetch(`${API}/gente/colaboradores/${colSelecionado.id}/funcionario`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadFunc),
      });
      if (!r1.ok) { const e = await r1.json(); throw new Error(e.message ?? 'Erro ao salvar dados pessoais'); }

      // Salva configuração de ponto do colaborador (strip campos grandes/aninhados)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { funcionario: _f, foto: _foto2, ...payloadCol } = form as any;
      const r2 = await fetch(`${API}/gente/colaboradores/${editando.id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadCol),
      });
      if (!r2.ok) { const e = await r2.json(); throw new Error(e.message ?? 'Erro ao salvar configuração de ponto'); }

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

  const comprimirImagem = (file: File, maxPx = 400, quality = 0.82): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = url;
    });

  const handleFoto = async (e: React.ChangeEvent<HTMLInputElement>, _funcId: string | undefined, colId: string) => {
    const file = e.target.files?.[0];
    if (!file || !colId) return;
    setUploadandoFoto(colId);
    try {
      const fotoBase64 = await comprimirImagem(file);
      const r = await fetch(`${API}/gente/colaboradores/${colId}/foto`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foto: fotoBase64 }),
      });
      if (r.ok) { toast.success('Foto atualizada!'); carregarColaboradores(); }
      else {
        const msg = await r.json().catch(() => ({}));
        toast.error(`Erro ao enviar foto: ${msg?.message ?? r.status}`);
      }
    } catch { toast.error('Erro ao processar imagem.'); }
    finally { setUploadandoFoto(null); if (e.target) e.target.value = ''; }
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

  const usarGeoLocal = () => {
    navigator.geolocation?.getCurrentPosition(pos => {
      setFormLocal((f: any) => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
      toast.success('Localização capturada!');
    }, () => toast.error('Não foi possível obter localização.'), { enableHighAccuracy: true });
  };

  const carregarLocais = async (colaboradorId: string) => {
    try {
      const r = await fetch(`${API}/gente/colaboradores/${colaboradorId}/locais`, { credentials: 'include' });
      if (r.ok) setLocais(await r.json());
    } catch { setLocais([]); }
  };

  const salvarLocal = async (colaboradorId: string) => {
    if (!formLocal.nome || !formLocal.latitude || !formLocal.longitude) return toast.error('Preencha nome e coordenadas.');
    const url = editandoLocal ? `${API}/gente/locais/${editandoLocal}` : `${API}/gente/colaboradores/${colaboradorId}/locais`;
    const method = editandoLocal ? 'PATCH' : 'POST';
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(formLocal) });
    if (r.ok) { await carregarLocais(colaboradorId); setFormLocal({ nome: '', latitude: '', longitude: '', raio_metros: 100 }); setEditandoLocal(null); }
    else toast.error('Erro ao salvar local.');
  };

  const deletarLocal = async (localId: string, colaboradorId: string) => {
    const r = await fetch(`${API}/gente/locais/${localId}`, { method: 'DELETE', credentials: 'include' });
    if (r.ok) carregarLocais(colaboradorId);
    else toast.error('Erro ao remover local.');
  };

  const filtrados = colaboradores
    .filter(c => {
      if (filtroAtivo === 'ativo' && c.ativo === false) return false;
      if (filtroAtivo === 'inativo' && c.ativo !== false) return false;
      if (filtroTipo && c.tipo !== filtroTipo) return false;
      if (busca) {
        const q = busca.toLowerCase();
        return c.funcionario?.nome?.toLowerCase().includes(q) || c.funcionario?.cargo?.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => (a.funcionario?.nome ?? '').localeCompare(b.funcionario?.nome ?? '', 'pt-BR'));

  const PONTO_URL = typeof window !== 'undefined' ? `${window.location.origin}/ponto?token=itp-ponto-2026` : '';

  const formHorarioJSX = (
    <div className="space-y-3">
      <FL label="Tipo">
        <select value={form.tipo} onChange={e => setForm((f: any) => ({ ...f, tipo: e.target.value }))} className={ic}>
          <option value="voluntario">Voluntário</option>
          <option value="funcionario">Funcionário</option>
        </select>
      </FL>
      <div className="flex items-center gap-2 mb-1">
        <input type="checkbox" id="jornada_flexivel" checked={!!form.jornada_flexivel}
          onChange={e => setForm((f: any) => ({ ...f, jornada_flexivel: e.target.checked, horario_entrada: e.target.checked ? null : (f.horario_entrada || '08:00'), horario_saida: e.target.checked ? null : (f.horario_saida || '17:00') }))}
          className="rounded border-slate-300 text-purple-600 focus:ring-purple-500" />
        <label htmlFor="jornada_flexivel" className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer">Jornada flexível (sem horário fixo)</label>
      </div>
      {!form.jornada_flexivel ? (
        <div className="grid grid-cols-2 gap-3">
          <FL label="Entrada"><input type="time" value={form.horario_entrada || ''} onChange={e => setForm((f: any) => ({ ...f, horario_entrada: e.target.value }))} className={ic} /></FL>
          <FL label="Saída"><input type="time" value={form.horario_saida || ''} onChange={e => setForm((f: any) => ({ ...f, horario_saida: e.target.value }))} className={ic} /></FL>
        </div>
      ) : (
        <div className="space-y-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-widest">Jornada Flexível</span>
            <span className="text-xs text-purple-500">Padrão: 7h/dia útil</span>
          </div>
          {(() => {
            const semana = form.horario_flexivel_semana ?? {};
            const dias = (form.dias_trabalho || []) as string[];
            const totalMin = dias.reduce((acc: number, dia: string) => {
              const w = semana[dia] ?? { inicio: '08:00', fim: '20:00' };
              const [ih, im] = (w.inicio || '08:00').split(':').map(Number);
              const [fh, fm] = (w.fim || '20:00').split(':').map(Number);
              const dur = (fh * 60 + fm) - (ih * 60 + im);
              return acc + (dur > 0 ? dur : 0);
            }, 0);
            const h = Math.floor(totalMin / 60);
            const m = totalMin % 60;
            return (
              <div className="flex items-center gap-2 px-3 py-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300">Horas esperadas na semana:</span>
                <span className="text-sm font-black text-purple-800 dark:text-purple-200">{h}h{m > 0 ? String(m).padStart(2,'0')+'m' : ''}</span>
                <span className="text-xs text-purple-500 ml-auto">calculado pela janela</span>
              </div>
            );
          })()}
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-2">Janela de horário por dia da semana</label>
            <div className="space-y-2">
              {(['seg','ter','qua','qui','sex','sab','dom'] as const).map(dia => {
                const diaLabel: Record<string, string> = { seg:'Seg',ter:'Ter',qua:'Qua',qui:'Qui',sex:'Sex',sab:'Sáb',dom:'Dom' };
                const semana = form.horario_flexivel_semana ?? {};
                const val = semana[dia] ?? { inicio: '08:00', fim: '20:00' };
                const ativo = (form.dias_trabalho || []).includes(dia);
                if (!ativo) return null;
                return (
                  <div key={dia} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400 w-8">{diaLabel[dia]}</span>
                    <input type="time" value={val.inicio}
                      onChange={e => setForm((f: any) => ({ ...f, horario_flexivel_semana: { ...(f.horario_flexivel_semana ?? {}), [dia]: { ...val, inicio: e.target.value } } }))}
                      className={`${ic} flex-1`} />
                    <span className="text-slate-400 text-xs">até</span>
                    <input type="time" value={val.fim}
                      onChange={e => setForm((f: any) => ({ ...f, horario_flexivel_semana: { ...(f.horario_flexivel_semana ?? {}), [dia]: { ...val, fim: e.target.value } } }))}
                      className={`${ic} flex-1`} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <FL label="Dias de trabalho">
        <div className="flex gap-2 flex-wrap">
          {DIAS_OPT.map(d => (
            <button key={d.k} type="button" onClick={() => toggleDia(d.k)}
              className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${(form.dias_trabalho || []).includes(d.k) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>{d.l}</button>
          ))}
        </div>
      </FL>
      {/* Locais permitidos (múltiplos) */}
      {editando && (
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Locais permitidos p/ ponto</label>
          {locais.map((l: any) => (
            <div key={l.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm">
              <MapPin size={13} className="text-purple-500 shrink-0" />
              <span className="font-semibold flex-1">{l.nome}</span>
              <span className="text-slate-400 text-xs">{Number(l.latitude).toFixed(5)}, {Number(l.longitude).toFixed(5)} · {l.raio_metros}m</span>
              <button type="button" onClick={() => { setEditandoLocal(l.id); setFormLocal({ nome: l.nome, latitude: l.latitude, longitude: l.longitude, raio_metros: l.raio_metros }); }} className="p-1 text-slate-400 hover:text-purple-600 transition"><Edit2 size={12} /></button>
              <button type="button" onClick={() => deletarLocal(l.id, editando.id)} className="p-1 text-slate-400 hover:text-red-500 transition"><Trash2 size={12} /></button>
            </div>
          ))}
          <div className="border border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-3 space-y-2">
            <input placeholder="Nome do local (ex: Assoc. Rua Macunaíma)" value={formLocal.nome} onChange={e => setFormLocal((f: any) => ({ ...f, nome: e.target.value }))} className={`${ic} text-sm`} />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" step="any" placeholder="Latitude" value={formLocal.latitude} onChange={e => setFormLocal((f: any) => ({ ...f, latitude: e.target.value }))} className={`${ic} text-sm`} />
              <input type="number" step="any" placeholder="Longitude" value={formLocal.longitude} onChange={e => setFormLocal((f: any) => ({ ...f, longitude: e.target.value }))} className={`${ic} text-sm`} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Raio (m):</span>
              <input type="number" value={formLocal.raio_metros} onChange={e => setFormLocal((f: any) => ({ ...f, raio_metros: Number(e.target.value) }))} className={`${ic} w-20 text-sm`} />
              <button type="button" onClick={usarGeoLocal} className="text-xs text-purple-600 flex items-center gap-1 hover:underline ml-auto"><MapPin size={11} />GPS atual</button>
            </div>
            <button type="button" onClick={() => salvarLocal(editando.id)} className="w-full py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition">
              {editandoLocal ? 'Atualizar local' : '+ Adicionar local'}
            </button>
            {editandoLocal && (
              <button type="button" onClick={() => { setEditandoLocal(null); setFormLocal({ nome: '', latitude: '', longitude: '', raio_metros: 100 }); }} className="w-full py-1 text-xs text-slate-400 hover:text-slate-600">Cancelar edição</button>
            )}
          </div>
          <p className="text-xs text-slate-400">O ponto é liberado se o colaborador estiver dentro do raio de qualquer um dos locais acima.</p>
        </div>
      )}
      {!editando && (
        <FL label="Geolocalização padrão">
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
      )}
    </div>
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou cargo..." className={`${ic} pl-9`} />
        </div>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className={`${ic} w-40`}>
          <option value="">Todos os tipos</option>
          <option value="voluntario">Voluntário</option>
          <option value="funcionario">Funcionário</option>
        </select>
        <select value={filtroAtivo} onChange={e => setFiltroAtivo(e.target.value)} className={`${ic} w-36`}>
          <option value="">Todos</option>
          <option value="ativo">Ativos</option>
          <option value="inativo">Inativos</option>
        </select>
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
      <div className="text-xs text-slate-400 mb-3">{filtrados.length} colaborador(es)</div>

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
                        ? <img src={c.funcionario.foto} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-purple-300 dark:border-purple-600" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                        : <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-purple-700 dark:text-purple-300 font-black text-lg">{c.funcionario?.nome?.charAt(0) ?? '?'}</div>}
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
                    {c.jornada_flexivel ? <span className="text-xs text-slate-400 hidden sm:block">Jornada flexível</span> : c.horario_entrada && <span className="text-xs text-slate-400 hidden sm:block">{c.horario_entrada}→{c.horario_saida}</span>}
                    <button onClick={() => abrirCodigosColaborador(c)} className="p-1.5 text-slate-400 hover:text-emerald-600 transition" title="Códigos VR"><Tag size={14} /></button>
                    <button onClick={() => {
                      setColSelecionado(c);
                      setFormFunc({ ...c.funcionario });
                      setEditando(c);
                      setForm({ ...c });
                      setLocais([]);
                      setFormLocal({ nome: '', latitude: '', longitude: '', raio_metros: 100 });
                      setEditandoLocal(null);
                      carregarLocais(c.id);
                      setModal('editar');
                    }} className="p-1.5 text-slate-400 hover:text-purple-600 transition" title="Editar Colaborador"><Edit2 size={14} /></button>
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
                    <div><span className="text-slate-400 block">Horário</span><span className="font-semibold">{c.jornada_flexivel ? `Flexível · ${Math.floor((c.horas_dia_flex ?? 420) / 60)}h/dia` : `${c.horario_entrada || '—'} → ${c.horario_saida || '—'}`}</span></div>
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

            {/* ── Seção 1: Dados Pessoais ── */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
              <p className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">Dados Pessoais</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><FL label="Nome Completo *"><input type="text" value={formFunc.nome || ''} onChange={e => setFormFunc((f: any) => ({ ...f, nome: e.target.value }))} className={ic} /></FL></div>
                <FL label="Cargo / Função"><input type="text" value={formFunc.cargo || ''} onChange={e => setFormFunc((f: any) => ({ ...f, cargo: e.target.value }))} className={ic} /></FL>
                <FL label="Email"><input type="email" value={formFunc.email || ''} onChange={e => setFormFunc((f: any) => ({ ...f, email: e.target.value }))} className={ic} /></FL>
                <FL label="CPF"><input type="text" value={formFunc.cpf || ''} onChange={e => setFormFunc((f: any) => ({ ...f, cpf: e.target.value }))} className={ic} /></FL>
                <FL label="RG"><input type="text" value={formFunc.rg || ''} onChange={e => setFormFunc((f: any) => ({ ...f, rg: e.target.value }))} className={ic} /></FL>
                <FL label="Órgão Emissor RG"><input type="text" value={formFunc.orgao_emissor_rg || ''} onChange={e => setFormFunc((f: any) => ({ ...f, orgao_emissor_rg: e.target.value }))} className={ic} /></FL>
                <FL label="Data de Nascimento"><input type="date" value={formFunc.data_nascimento || ''} onChange={e => setFormFunc((f: any) => ({ ...f, data_nascimento: e.target.value }))} className={ic} /></FL>
                <FL label="Celular"><input type="text" value={formFunc.celular || ''} onChange={e => setFormFunc((f: any) => ({ ...f, celular: e.target.value }))} className={ic} /></FL>
                <FL label="Estado Civil">
                  <select value={formFunc.estado_civil || ''} onChange={e => setFormFunc((f: any) => ({ ...f, estado_civil: e.target.value }))} className={ic}>
                    <option value="">Selecione...</option>
                    {['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </FL>
                <FL label="Sexo">
                  <select value={formFunc.sexo || ''} onChange={e => setFormFunc((f: any) => ({ ...f, sexo: e.target.value }))} className={ic}>
                    <option value="">Selecione...</option>
                    {['Masculino', 'Feminino', 'Outro', 'Prefiro não informar'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </FL>
                <FL label="Raça / Cor">
                  <select value={formFunc.raca_cor || ''} onChange={e => setFormFunc((f: any) => ({ ...f, raca_cor: e.target.value }))} className={ic}>
                    <option value="">Selecione...</option>
                    {['Preta', 'Parda', 'Branca', 'Indígena', 'Amarela', 'Prefiro não informar'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </FL>
                <FL label="Escolaridade">
                  <select value={formFunc.escolaridade || ''} onChange={e => setFormFunc((f: any) => ({ ...f, escolaridade: e.target.value }))} className={ic}>
                    <option value="">Selecione...</option>
                    {['Fundamental Incompleto','Fundamental Completo','Médio Incompleto','Médio Completo','Superior Incompleto','Superior Completo','Pós-graduação'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </FL>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Endereço</p>
                <div className="grid grid-cols-2 gap-3">
                  <FL label="CEP"><input type="text" value={formFunc.cep || ''} onChange={async e => {
                    const cep = e.target.value.replace(/\D/g, '');
                    setFormFunc((f: any) => ({ ...f, cep: e.target.value }));
                    if (cep.length === 8) {
                      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                      const d = await r.json();
                      if (!d.erro) setFormFunc((f: any) => ({ ...f, logradouro: d.logradouro, bairro: d.bairro, cidade: d.localidade, estado: d.uf }));
                    }
                  }} className={ic} /></FL>
                  <FL label="Estado (UF)"><input type="text" maxLength={2} value={formFunc.estado || ''} onChange={e => setFormFunc((f: any) => ({ ...f, estado: e.target.value }))} className={ic} /></FL>
                  <div className="col-span-2"><FL label="Logradouro"><input type="text" value={formFunc.logradouro || ''} onChange={e => setFormFunc((f: any) => ({ ...f, logradouro: e.target.value }))} className={ic} /></FL></div>
                  <FL label="Número"><input type="text" value={formFunc.numero_residencia || ''} onChange={e => setFormFunc((f: any) => ({ ...f, numero_residencia: e.target.value }))} className={ic} /></FL>
                  <FL label="Complemento"><input type="text" value={formFunc.complemento || ''} onChange={e => setFormFunc((f: any) => ({ ...f, complemento: e.target.value }))} className={ic} /></FL>
                  <FL label="Bairro"><input type="text" value={formFunc.bairro || ''} onChange={e => setFormFunc((f: any) => ({ ...f, bairro: e.target.value }))} className={ic} /></FL>
                  <FL label="Cidade"><input type="text" value={formFunc.cidade || ''} onChange={e => setFormFunc((f: any) => ({ ...f, cidade: e.target.value }))} className={ic} /></FL>
                  <FL label="País"><input type="text" value={formFunc.pais || 'Brasil'} onChange={e => setFormFunc((f: any) => ({ ...f, pais: e.target.value }))} className={ic} /></FL>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-2">Contato de Emergência</p>
                <div className="grid grid-cols-2 gap-3">
                  <FL label="Tel. Emergência 1"><input type="text" value={formFunc.telefone_emergencia_1 || ''} onChange={e => setFormFunc((f: any) => ({ ...f, telefone_emergencia_1: e.target.value }))} className={ic} /></FL>
                  <FL label="Tel. Emergência 2"><input type="text" value={formFunc.telefone_emergencia_2 || ''} onChange={e => setFormFunc((f: any) => ({ ...f, telefone_emergencia_2: e.target.value }))} className={ic} /></FL>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-2">Saúde</p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formFunc.possui_deficiencia} onChange={e => setFormFunc((f: any) => ({ ...f, possui_deficiencia: e.target.checked }))} className="w-4 h-4" />Possui algum tipo de deficiência?</label>
                  {formFunc.possui_deficiencia && <FL label="Qual(is)?"><input type="text" value={formFunc.deficiencia_descricao || ''} onChange={e => setFormFunc((f: any) => ({ ...f, deficiencia_descricao: e.target.value }))} className={ic} /></FL>}
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formFunc.possui_alergias} onChange={e => setFormFunc((f: any) => ({ ...f, possui_alergias: e.target.checked }))} className="w-4 h-4" />Possui alergias?</label>
                  {formFunc.possui_alergias && <FL label="Qual(is)?"><input type="text" value={formFunc.alergias_descricao || ''} onChange={e => setFormFunc((f: any) => ({ ...f, alergias_descricao: e.target.value }))} className={ic} /></FL>}
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formFunc.usa_medicamentos} onChange={e => setFormFunc((f: any) => ({ ...f, usa_medicamentos: e.target.checked }))} className="w-4 h-4" />Uso contínuo de medicamento?</label>
                  {formFunc.usa_medicamentos && <FL label="Quais? (nome e dosagem)"><input type="text" value={formFunc.medicamentos_descricao || ''} onChange={e => setFormFunc((f: any) => ({ ...f, medicamentos_descricao: e.target.value }))} className={ic} /></FL>}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">Perfil Social</p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formFunc.interesse_cursos} onChange={e => setFormFunc((f: any) => ({ ...f, interesse_cursos: e.target.checked }))} className="w-4 h-4" />Interesse em cursos do ITP?</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formFunc.pertence_comunidade_tradicional} onChange={e => setFormFunc((f: any) => ({ ...f, pertence_comunidade_tradicional: e.target.checked }))} className="w-4 h-4" />Pertence a comunidade tradicional?</label>
                  {formFunc.pertence_comunidade_tradicional && <FL label="Qual comunidade?"><input type="text" value={formFunc.comunidade_tradicional || ''} onChange={e => setFormFunc((f: any) => ({ ...f, comunidade_tradicional: e.target.value }))} className={ic} /></FL>}
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formFunc.possui_cad_unico} onChange={e => setFormFunc((f: any) => ({ ...f, possui_cad_unico: e.target.checked }))} className="w-4 h-4" />Possui CadÚnico?</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formFunc.baixo_idh} onChange={e => setFormFunc((f: any) => ({ ...f, baixo_idh: e.target.checked }))} className="w-4 h-4" />Área de baixo IDH?</label>
                </div>
              </div>
            </div>

            {/* ── Seção 2: Configuração de Ponto ── */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
              <p className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">Configuração de Ponto</p>
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

      {/* Modal: Editar Colaborador (dados pessoais + ponto) */}
      {modal === 'editar' && colSelecionado && editando && (
        <Modal title="Editar Colaborador" onClose={() => setModal(null)} wide>
          <div className="space-y-5">
            {/* Cabeçalho */}
            <div className="flex items-center gap-4 p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl">
              {colSelecionado.funcionario?.foto
                ? <img src={colSelecionado.funcionario.foto} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-purple-400 shrink-0" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                : <div className="w-14 h-14 rounded-full bg-purple-200 dark:bg-purple-800 flex items-center justify-center text-purple-700 dark:text-purple-200 font-black text-xl shrink-0">{colSelecionado.funcionario?.nome?.charAt(0) ?? '?'}</div>}
              <div className="min-w-0">
                <div className="font-black text-slate-800 dark:text-white text-base truncate">{colSelecionado.funcionario?.nome ?? '—'}</div>
                <div className="text-sm text-purple-600 dark:text-purple-300 font-semibold">{colSelecionado.funcionario?.cargo ?? 'Sem cargo definido'}</div>
                <div className="text-xs text-slate-400">{colSelecionado.funcionario?.matricula ?? ''}</div>
              </div>
              <label className="ml-auto shrink-0 cursor-pointer flex flex-col items-center gap-1 text-xs text-purple-600 hover:text-purple-800 transition">
                {uploadandoFoto === colSelecionado.id ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
                <span>Trocar foto</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => handleFoto(e, colSelecionado.funcionario?.id, colSelecionado.id)} />
              </label>
            </div>

            {/* ── Seção 1: Dados Pessoais ── */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-4">
              <p className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">Dados Pessoais</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><FL label="Nome Completo *"><input type="text" value={formFunc.nome || ''} onChange={e => setFormFunc((f: any) => ({ ...f, nome: e.target.value }))} className={ic} /></FL></div>
                <FL label="Cargo / Função"><input type="text" value={formFunc.cargo || ''} onChange={e => setFormFunc((f: any) => ({ ...f, cargo: e.target.value }))} className={ic} /></FL>
                <FL label="Email"><input type="email" value={formFunc.email || ''} onChange={e => setFormFunc((f: any) => ({ ...f, email: e.target.value }))} className={ic} /></FL>
                <FL label="CPF"><input type="text" value={formFunc.cpf || ''} onChange={e => setFormFunc((f: any) => ({ ...f, cpf: e.target.value }))} className={ic} /></FL>
                <FL label="RG"><input type="text" value={formFunc.rg || ''} onChange={e => setFormFunc((f: any) => ({ ...f, rg: e.target.value }))} className={ic} /></FL>
                <FL label="Órgão Emissor RG"><input type="text" value={formFunc.orgao_emissor_rg || ''} onChange={e => setFormFunc((f: any) => ({ ...f, orgao_emissor_rg: e.target.value }))} className={ic} /></FL>
                <FL label="Data de Emissão RG"><input type="date" value={formFunc.data_emissao_rg || ''} onChange={e => setFormFunc((f: any) => ({ ...f, data_emissao_rg: e.target.value }))} className={ic} /></FL>
                <FL label="Data de Nascimento"><input type="date" value={formFunc.data_nascimento || ''} onChange={e => setFormFunc((f: any) => ({ ...f, data_nascimento: e.target.value }))} className={ic} /></FL>
                <FL label="Celular"><input type="text" value={formFunc.celular || ''} onChange={e => setFormFunc((f: any) => ({ ...f, celular: e.target.value }))} className={ic} /></FL>
                <FL label="Estado Civil">
                  <select value={formFunc.estado_civil || ''} onChange={e => setFormFunc((f: any) => ({ ...f, estado_civil: e.target.value }))} className={ic}>
                    <option value="">Selecione...</option>
                    {['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </FL>
                <FL label="Sexo">
                  <select value={formFunc.sexo || ''} onChange={e => setFormFunc((f: any) => ({ ...f, sexo: e.target.value }))} className={ic}>
                    <option value="">Selecione...</option>
                    {['Masculino', 'Feminino', 'Outro', 'Prefiro não informar'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </FL>
                <FL label="Gênero"><input type="text" placeholder="Ex: Não-binário" value={formFunc.genero || ''} onChange={e => setFormFunc((f: any) => ({ ...f, genero: e.target.value }))} className={ic} /></FL>
                <FL label="Raça / Cor">
                  <select value={formFunc.raca_cor || ''} onChange={e => setFormFunc((f: any) => ({ ...f, raca_cor: e.target.value }))} className={ic}>
                    <option value="">Selecione...</option>
                    {['Preta', 'Parda', 'Branca', 'Indígena', 'Amarela', 'Prefiro não informar'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </FL>
                <FL label="Escolaridade">
                  <select value={formFunc.escolaridade || ''} onChange={e => setFormFunc((f: any) => ({ ...f, escolaridade: e.target.value }))} className={ic}>
                    <option value="">Selecione...</option>
                    {['Fundamental Incompleto','Fundamental Completo','Médio Incompleto','Médio Completo','Superior Incompleto','Superior Completo','Pós-graduação'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </FL>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Endereço</p>
                <div className="grid grid-cols-2 gap-3">
                  <FL label="CEP"><input type="text" value={formFunc.cep || ''} onChange={async e => {
                    const cep = e.target.value.replace(/\D/g, '');
                    setFormFunc((f: any) => ({ ...f, cep: e.target.value }));
                    if (cep.length === 8) {
                      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                      const d = await r.json();
                      if (!d.erro) setFormFunc((f: any) => ({ ...f, logradouro: d.logradouro, bairro: d.bairro, cidade: d.localidade, estado: d.uf }));
                    }
                  }} className={ic} /></FL>
                  <FL label="Estado (UF)"><input type="text" maxLength={2} value={formFunc.estado || ''} onChange={e => setFormFunc((f: any) => ({ ...f, estado: e.target.value }))} className={ic} /></FL>
                  <div className="col-span-2"><FL label="Logradouro"><input type="text" value={formFunc.logradouro || ''} onChange={e => setFormFunc((f: any) => ({ ...f, logradouro: e.target.value }))} className={ic} /></FL></div>
                  <FL label="Número"><input type="text" value={formFunc.numero_residencia || ''} onChange={e => setFormFunc((f: any) => ({ ...f, numero_residencia: e.target.value }))} className={ic} /></FL>
                  <FL label="Complemento"><input type="text" value={formFunc.complemento || ''} onChange={e => setFormFunc((f: any) => ({ ...f, complemento: e.target.value }))} className={ic} /></FL>
                  <FL label="Bairro"><input type="text" value={formFunc.bairro || ''} onChange={e => setFormFunc((f: any) => ({ ...f, bairro: e.target.value }))} className={ic} /></FL>
                  <FL label="Cidade"><input type="text" value={formFunc.cidade || ''} onChange={e => setFormFunc((f: any) => ({ ...f, cidade: e.target.value }))} className={ic} /></FL>
                  <FL label="País"><input type="text" value={formFunc.pais || 'Brasil'} onChange={e => setFormFunc((f: any) => ({ ...f, pais: e.target.value }))} className={ic} /></FL>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-2">Contato de Emergência</p>
                <div className="grid grid-cols-2 gap-3">
                  <FL label="Tel. Emergência 1"><input type="text" value={formFunc.telefone_emergencia_1 || ''} onChange={e => setFormFunc((f: any) => ({ ...f, telefone_emergencia_1: e.target.value }))} className={ic} /></FL>
                  <FL label="Tel. Emergência 2"><input type="text" value={formFunc.telefone_emergencia_2 || ''} onChange={e => setFormFunc((f: any) => ({ ...f, telefone_emergencia_2: e.target.value }))} className={ic} /></FL>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-2">Saúde</p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formFunc.possui_deficiencia} onChange={e => setFormFunc((f: any) => ({ ...f, possui_deficiencia: e.target.checked }))} className="w-4 h-4" />Possui algum tipo de deficiência?</label>
                  {formFunc.possui_deficiencia && <FL label="Qual(is)?"><input type="text" value={formFunc.deficiencia_descricao || ''} onChange={e => setFormFunc((f: any) => ({ ...f, deficiencia_descricao: e.target.value }))} className={ic} /></FL>}
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formFunc.possui_alergias} onChange={e => setFormFunc((f: any) => ({ ...f, possui_alergias: e.target.checked }))} className="w-4 h-4" />Possui alergias?</label>
                  {formFunc.possui_alergias && <FL label="Qual(is)?"><input type="text" value={formFunc.alergias_descricao || ''} onChange={e => setFormFunc((f: any) => ({ ...f, alergias_descricao: e.target.value }))} className={ic} /></FL>}
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formFunc.usa_medicamentos} onChange={e => setFormFunc((f: any) => ({ ...f, usa_medicamentos: e.target.checked }))} className="w-4 h-4" />Uso contínuo de medicamento?</label>
                  {formFunc.usa_medicamentos && <FL label="Quais? (nome e dosagem)"><input type="text" value={formFunc.medicamentos_descricao || ''} onChange={e => setFormFunc((f: any) => ({ ...f, medicamentos_descricao: e.target.value }))} className={ic} /></FL>}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">Perfil Social</p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formFunc.interesse_cursos} onChange={e => setFormFunc((f: any) => ({ ...f, interesse_cursos: e.target.checked }))} className="w-4 h-4" />Interesse em cursos do ITP?</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formFunc.pertence_comunidade_tradicional} onChange={e => setFormFunc((f: any) => ({ ...f, pertence_comunidade_tradicional: e.target.checked }))} className="w-4 h-4" />Pertence a comunidade tradicional?</label>
                  {formFunc.pertence_comunidade_tradicional && <FL label="Qual comunidade?"><input type="text" value={formFunc.comunidade_tradicional || ''} onChange={e => setFormFunc((f: any) => ({ ...f, comunidade_tradicional: e.target.value }))} className={ic} /></FL>}
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formFunc.possui_cad_unico} onChange={e => setFormFunc((f: any) => ({ ...f, possui_cad_unico: e.target.checked }))} className="w-4 h-4" />Possui CadÚnico?</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formFunc.baixo_idh} onChange={e => setFormFunc((f: any) => ({ ...f, baixo_idh: e.target.checked }))} className="w-4 h-4" />Área de baixo IDH?</label>
                </div>
              </div>
            </div>

            {/* ── Seção 2: Configuração de Ponto ── */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
              <p className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">Configuração de Ponto</p>
              {formHorarioJSX}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t dark:border-slate-700">
              <button onClick={() => setModal(null)} className={bs}>Cancelar</button>
              <button onClick={salvarEdicaoCompleta} disabled={salvando} className={bp}>{salvando ? 'Salvando...' : 'Salvar Tudo'}</button>
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

// ── Recibo PDF ────────────────────────────────────────────────────────────────

function ReciboImpresso({ recibo, onClose }: { recibo: any; onClose: () => void }) {
  const mesRef = fmt.mes(recibo.mes_referencia ?? '');
  const proventos: any[] = recibo.proventos ?? [];
  const descontos: any[] = recibo.descontos ?? [];
  const totalProv = recibo.totalProventos ?? 0;
  const totalDesc = recibo.totalDescontos ?? 0;
  const liquido = recibo.liquido ?? recibo.valor ?? 0;
  const totalSalario = proventos.filter((p: any) => p.codigo === 'SAL').reduce((s: number, p: any) => s + Number(p.valor), 0);
  const totalReembolso = proventos.filter((p: any) => p.codigo !== 'SAL').reduce((s: number, p: any) => s + Number(p.valor), 0);
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
            <div className="space-y-1">
              {totalSalario > 0 && (
                <div>
                  <div className="text-[9px] text-slate-500">Salário Base</div>
                  <div className="font-bold">{totalSalario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
              )}
              {totalReembolso > 0 && (
                <div>
                  <div className="text-[9px] text-slate-500">Reembolso / Ajuda de Custo</div>
                  <div className="font-bold">{totalReembolso.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
              )}
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
            <div className="bg-red-50 dark:bg-red-900/30 px-3 py-2 text-xs font-bold text-red-700 dark:text-red-300 uppercase tracking-wider">Descontos (Vales)</div>
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

function RecibosTab({ reload, colaboradores }: { reload: number; colaboradores: any[] }) {
  const [recibos, setRecibos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCol, setFiltroCol] = useState('');
  const [calculando, setCalculando] = useState(false);
  const [mesCalculo, setMesCalculo] = useState(() => new Date().toISOString().slice(0, 7));
  const [reciboImpresso, setReciboImpresso] = useState<any | null>(null);
  const [carregandoRecibo, setCarregandoRecibo] = useState<string | null>(null);

  // Estado para criação manual de recibo
  const [modalNovo, setModalNovo] = useState(false);
  const [novoColId, setNovoColId] = useState('');
  const [novoMes, setNovoMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [preview, setPreview] = useState<any | null>(null);
  const [carregandoPreview, setCarregandoPreview] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const params = filtroCol ? `?colaborador_id=${filtroCol}` : '';
    const r = await fetch(`${API}/gente/recibos${params}`, { credentials: 'include' });
    const recData = await r.json();
    setRecibos(Array.isArray(recData) ? recData : []);
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
                {carregandoPreview ? 'Buscando...' : <><Search size={13} className="inline mr-1" />Ver Preview</>}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-5 flex-wrap">
        <select value={filtroCol} onChange={e => setFiltroCol(e.target.value)} className={`${ic} flex-1`}>
          <option value="">Todos colaboradores</option>
          {colaboradores.map(c => <option key={c.id} value={c.id}>{c.funcionario?.nome ?? c.id}</option>)}
        </select>
        <button onClick={carregar} className={bs}><RefreshCw size={14} /></button>
        <button onClick={() => { setModalNovo(true); setNovoColId(''); setPreview(null); }} className={bp}>
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

// ── Tab Ponto ────────────────────────────────────────────────────────────────

type LinhaLancamento = { id: number; data: string; entrada: string; saida: string };

let _lId = 0;
const novaLinha = (data: string, entrada = '08:00', saida = '17:00'): LinhaLancamento =>
  ({ id: ++_lId, data, entrada, saida });

function PontoTab({ reload, colaboradores }: { reload: number; colaboradores: any[] }) {
  const ic = 'w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-400';

  // ── Alertas state ─────────────────────────────────────────────────────────
  const [alertas, setAlertas] = useState<Array<{ colaborador_id: string; nome: string; dias_ausentes: string[] }>>([]);
  const [loadingAlertas, setLoadingAlertas] = useState(true);

  // ── Relatório state ───────────────────────────────────────────────────────
  const [relatorio, setRelatorio] = useState<any[]>([]);
  const [loadingRel, setLoadingRel] = useState(false);
  const [filtroCol, setFiltroCol] = useState('');
  const [filtroInicio, setFiltroInicio] = useState('');
  const [filtroFim, setFiltroFim] = useState('');

  // ── Modal state ───────────────────────────────────────────────────────────
  const [modalAberto, setModalAberto] = useState(false);
  const [colId, setColId] = useState('');
  const [linhas, setLinhas] = useState<LinhaLancamento[]>([]);
  const [salvando, setSalvando] = useState(false);
  const PONTO_URL = typeof window !== 'undefined' ? `${window.location.origin}/ponto?token=itp-ponto-2026` : '';

  const hoje = new Date().toISOString().split('T')[0];

  // ── Helpers ───────────────────────────────────────────────────────────────

  const fmtMinutos = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h${m > 0 ? String(m).padStart(2, '0') + 'm' : ''}`;
  };

  // ── Alertas ───────────────────────────────────────────────────────────────

  const carregarAlertas = useCallback(async () => {
    setLoadingAlertas(true);
    try {
      const r = await fetch(`${API}/gente/ponto/alertas`, { credentials: 'include' });
      const data = await r.json();
      setAlertas(Array.isArray(data) ? data : []);
    } catch { toast.error('Erro ao carregar alertas de ausência.'); }
    setLoadingAlertas(false);
  }, []);

  useEffect(() => { carregarAlertas(); }, [carregarAlertas, reload]);

  // ── Relatório ─────────────────────────────────────────────────────────────

  const carregar = useCallback(async () => {
    setLoadingRel(true);
    const p = new URLSearchParams();
    if (filtroCol) p.set('colaborador_id', filtroCol);
    if (filtroInicio) p.set('data_inicio', filtroInicio);
    if (filtroFim) p.set('data_fim', filtroFim);

    // Use relatorio endpoint for grouped display
    const rp = new URLSearchParams();
    if (filtroInicio) rp.set('data_inicio', filtroInicio);
    if (filtroFim) rp.set('data_fim', filtroFim);

    try {
      const r = await fetch(`${API}/gente/ponto/relatorio?${rp}`, { credentials: 'include' });
      const data = await r.json();
      let lista = Array.isArray(data) ? data : [];
      if (filtroCol) lista = lista.filter((c: any) => c.colaborador_id === filtroCol);
      setRelatorio(lista);
    } catch { toast.error('Erro ao carregar relatório de ponto.'); }
    setLoadingRel(false);
  }, [filtroCol, filtroInicio, filtroFim]);

  useEffect(() => { carregar(); }, [carregar, reload]);

  // ── Modal helpers ─────────────────────────────────────────────────────────

  const abrirModal = (preColId?: string) => {
    setColId(preColId ?? '');
    const col = colaboradores.find(c => c.id === preColId);
    setLinhas([novaLinha(hoje, col?.horario_entrada ?? '08:00', col?.horario_saida ?? '17:00')]);
    setModalAberto(true);
  };

  const addLinha = () => {
    const col = colaboradores.find(c => c.id === colId);
    setLinhas(l => [...l, novaLinha(hoje, col?.horario_entrada ?? '08:00', col?.horario_saida ?? '17:00')]);
  };

  const updLinha = (id: number, campo: keyof LinhaLancamento, val: string) =>
    setLinhas(l => l.map(r => r.id === id ? { ...r, [campo]: val } : r));

  const delLinha = (id: number) => setLinhas(l => l.filter(r => r.id !== id));

  const salvarLote = async () => {
    if (!colId) { toast.error('Selecione um colaborador.'); return; }
    if (linhas.length === 0) { toast.error('Adicione pelo menos uma linha.'); return; }
    const invalidas = linhas.filter(l => !l.data || !l.entrada);
    if (invalidas.length) { toast.error('Preencha data e entrada em todas as linhas.'); return; }
    setSalvando(true);

    // Para cada linha: entrada na data informada; saída na mesma data ou +1 dia se hora < entrada
    const registros: { tipo: string; data_hora: string }[] = [];
    for (const l of linhas) {
      registros.push({ tipo: 'entrada', data_hora: new Date(`${l.data}T${l.entrada}:00`).toISOString() });
      if (l.saida) {
        const saidaData = l.saida < l.entrada
          ? new Date(new Date(`${l.data}T${l.saida}:00`).getTime() + 86400000).toISOString()
          : new Date(`${l.data}T${l.saida}:00`).toISOString();
        registros.push({ tipo: 'saida', data_hora: saidaData });
      }
    }

    const results = await Promise.allSettled(
      registros.map(reg =>
        fetch(`${API}/gente/ponto`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ colaborador_id: colId, ...reg }),
        }).then(async r => {
          if (!r.ok) {
            const err = await r.json().catch(() => ({}));
            throw new Error(err.message ?? `HTTP ${r.status}`);
          }
          return r;
        })
      )
    );
    const ok = results.filter(r => r.status === 'fulfilled').length;
    const falhas = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
    const errMsg = falhas.length ? falhas[0].reason?.message : '';
    if (ok) toast.success(`${ok} marcação(ões) registrada(s)${falhas.length ? ` · ${falhas.length} falha(s)` : ''}.`);
    if (falhas.length && !ok) toast.error(`Nenhuma marcação registrada: ${errMsg}`);
    else if (falhas.length) toast.error(`${falhas.length} falha(s): ${errMsg}`);
    setSalvando(false);
    setModalAberto(false);
    carregar();
    carregarAlertas();
  };

  const deletarReg = async (id: string) => {
    if (!confirm('Excluir?')) return;
    await fetch(`${API}/gente/ponto/${id}`, { method: 'DELETE', credentials: 'include' });
    toast.success('Excluído.'); carregar(); carregarAlertas();
  };

  return (
    <div className="space-y-6">

      {/* ── Seção A: Alertas de Ausência ──────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-black text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <AlertTriangle size={16} className="text-orange-500" />
            Alertas de Ausência — últimos 14 dias
          </h3>
          <button onClick={carregarAlertas} className={bs} title="Recarregar alertas"><RefreshCw size={14} /></button>
        </div>

        {loadingAlertas ? (
          <div className="text-center py-6 text-slate-400 text-sm">Verificando ausências...</div>
        ) : alertas.length === 0 ? (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 text-sm">
            <Check size={16} />
            Nenhuma ausência detectada nos últimos 14 dias.
          </div>
        ) : (
          <div className="space-y-2">
            {alertas.map(alerta => (
              <div key={alerta.colaborador_id}
                className="flex flex-col sm:flex-row sm:items-start gap-3 px-4 py-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700">
                <AlertTriangle size={16} className="text-orange-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-orange-800 dark:text-orange-200 text-sm">{alerta.nome}</div>
                  <div className="text-xs text-orange-600 dark:text-orange-300 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                    {alerta.dias_ausentes.map(d => <span key={d} className="bg-orange-100 dark:bg-orange-800/40 px-1.5 py-0.5 rounded">{d}</span>)}
                  </div>
                </div>
                <button
                  onClick={() => abrirModal(alerta.colaborador_id)}
                  className="shrink-0 flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white transition">
                  <Plus size={11} />Lançar ponto
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Seção B: Relatório de Ponto ───────────────────────────────────── */}
      <div>
        <h3 className="font-black text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-3">
          <Clock size={16} className="text-purple-500" />
          Relatório de Ponto
        </h3>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5 flex-wrap">
          <select value={filtroCol} onChange={e => setFiltroCol(e.target.value)} className={`${ic} flex-1`}>
            <option value="">Todos os colaboradores</option>
            {colaboradores.map(c => <option key={c.id} value={c.id}>{c.funcionario?.nome ?? c.id}</option>)}
          </select>
          <input type="date" value={filtroInicio} onChange={e => setFiltroInicio(e.target.value)} className={`${ic} w-36`} />
          <input type="date" value={filtroFim} onChange={e => setFiltroFim(e.target.value)} className={`${ic} w-36`} />
          <button onClick={carregar} className={bs}><RefreshCw size={14} /></button>
          <button onClick={() => abrirModal()} className={bp}><Plus size={14} className="inline mr-1" />Lançar Ponto</button>
          <a href={PONTO_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition whitespace-nowrap">
            <ExternalLink size={14} />Link Externo
          </a>
        </div>

        {/* Relatório agrupado */}
        {loadingRel ? (
          <div className="text-center py-12 text-slate-400">Carregando...</div>
        ) : relatorio.length === 0 ? (
          <div className="text-center py-12 text-slate-400">Nenhum registro no período.</div>
        ) : (
          <div className="space-y-4">
            {relatorio.map(col => {
              const totalH = Math.floor(col.total_minutos / 60);
              const totalM = col.total_minutos % 60;
              return (
                <div key={col.colaborador_id} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  {/* Cabeçalho do colaborador */}
                  <div className="bg-slate-50 dark:bg-slate-800 px-4 py-3 flex items-center justify-between">
                    <span className="font-black text-slate-800 dark:text-white text-sm">{col.nome}</span>
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-300">
                      Total: {totalH}h{totalM > 0 ? String(totalM).padStart(2, '0') + 'm' : ''}
                    </span>
                  </div>

                  {/* Dias */}
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {col.dias.map((dia: any) => {
                      const [y, m, d] = dia.data.split('-');
                      const dataFmt = `${d}/${m}/${y}`;
                      const entradas = dia.registros.filter((r: any) => r.tipo === 'entrada');
                      const saidas = dia.registros.filter((r: any) => r.tipo === 'saida');

                      // Build pairs inline: E HH:MM → S HH:MM
                      const pares: string[] = [];
                      const maxPares = Math.max(entradas.length, saidas.length);
                      for (let i = 0; i < maxPares; i++) {
                        const e = entradas[i] ? `E ${entradas[i].hora}` : 'E —';
                        const s = saidas[i] ? `S ${saidas[i].hora}` : 'S —';
                        pares.push(`${e} → ${s}`);
                      }

                      return (
                        <div key={dia.data} className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2">
                          {/* Data + status */}
                          <div className="flex items-center gap-2 w-32 shrink-0">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{dataFmt}</span>
                            {dia.completo
                              ? <Check size={12} className="text-green-500 shrink-0" />
                              : <AlertTriangle size={12} className="text-orange-400 shrink-0" />}
                          </div>

                          {/* Pares entrada/saída */}
                          <div className="flex flex-wrap gap-x-3 gap-y-1 flex-1 text-xs text-slate-600 dark:text-slate-300 font-mono">
                            {pares.length === 0
                              ? <span className="text-slate-400 italic">Sem registros</span>
                              : pares.map((p, i) => <span key={i}>{p}</span>)}
                            {dia.minutos_trabalhados > 0 && (
                              <span className="text-purple-600 dark:text-purple-300 font-bold non-mono">
                                = {fmtMinutos(dia.minutos_trabalhados)}
                              </span>
                            )}
                          </div>

                          {/* Botão deletar por registro */}
                          <div className="flex gap-1 shrink-0">
                            {dia.registros.map((reg: any) => (
                              <button key={reg.id} onClick={() => deletarReg(reg.id)}
                                title={`Excluir ${reg.tipo} ${reg.hora}`}
                                className="flex items-center gap-0.5 text-xs text-slate-400 hover:text-red-500 border border-slate-200 dark:border-slate-600 hover:border-red-300 rounded px-1.5 py-0.5 transition">
                                <Trash2 size={10} />
                                <span>{reg.tipo === 'entrada' ? 'E' : 'S'} {reg.hora}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal Lançar Ponto ────────────────────────────────────────────── */}
      {modalAberto && (
        <Modal title="Lançar Ponto" onClose={() => setModalAberto(false)}>
          <div className="space-y-4">
            <FL label="Colaborador">
              <select value={colId} onChange={e => setColId(e.target.value)} className={ic}>
                <option value="">Selecione...</option>
                {colaboradores.map(c => <option key={c.id} value={c.id}>{c.funcionario?.nome ?? c.id}</option>)}
              </select>
            </FL>

            <div className="flex gap-2 mb-1">
              <button type="button" onClick={addLinha} disabled={!colId}
                className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 transition disabled:opacity-40">
                <Plus size={11} />Adicionar dia
              </button>
            </div>

            {/* Header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 px-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>Data</span><span>Entrada</span><span></span><span>Saída</span><span></span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {linhas.length === 0 && (
                <p className="text-slate-400 text-xs text-center py-4">Clique em &quot;Adicionar dia&quot; para inserir uma marcação.</p>
              )}
              {linhas.map(l => {
                const viradaDia = l.saida && l.saida < l.entrada;
                return (
                  <div key={l.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2">
                    <input type="date" value={l.data} onChange={e => updLinha(l.id, 'data', e.target.value)}
                      className="border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-white flex-1 min-w-0" />
                    <input type="time" value={l.entrada} onChange={e => updLinha(l.id, 'entrada', e.target.value)}
                      className="border border-green-200 dark:border-green-800 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-900 text-green-700 dark:text-green-400 w-24" />
                    <span className="text-slate-400 text-xs font-bold">→</span>
                    <div className="relative">
                      <input type="time" value={l.saida} onChange={e => updLinha(l.id, 'saida', e.target.value)}
                        className="border border-red-200 dark:border-red-800 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 w-24" />
                      {viradaDia && (
                        <span className="absolute -top-2 -right-1 text-[9px] font-black text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/40 px-1 rounded">+1d</span>
                      )}
                    </div>
                    <button type="button" onClick={() => delLinha(l.id)} className="text-slate-300 hover:text-red-500 transition ml-1"><Trash2 size={12} /></button>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-700">
              <span className="text-xs text-slate-400">{linhas.length} dia(s)</span>
              <div className="flex gap-2">
                <button onClick={() => setModalAberto(false)} className={bs}>Cancelar</button>
                <button onClick={salvarLote} disabled={salvando || !colId || linhas.length === 0} className={bp}>
                  {salvando ? 'Registrando...' : `Registrar ${linhas.length} dia(s)`}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Tab: Transporte ──────────────────────────────────────────────────────────

function TransporteTab({ colaboradores, reload }: { colaboradores: any[]; reload: number }) {
  const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  const [valores, setValores] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  const mesAtual = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    const init: Record<string, string> = {};
    colaboradores.forEach(c => { init[c.id] = c.valor_passagem != null ? String(c.valor_passagem) : ''; });
    setValores(init);
  }, [colaboradores, reload]);

  function diasNoMes(diasSemana: string[], mesRef: string): number {
    const mapa: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };
    const [ano, mes] = mesRef.split('-').map(Number);
    const alvos = new Set((diasSemana ?? []).map((d: string) => mapa[d]).filter((n: number) => n !== undefined));
    const total = new Date(ano, mes, 0).getDate();
    let count = 0;
    for (let d = 1; d <= total; d++) {
      if (alvos.has(new Date(ano, mes - 1, d).getDay())) count++;
    }
    return count;
  }

  const salvar = async (colId: string) => {
    setSalvando(colId);
    try {
      const r = await fetch(`${API}/gente/colaboradores/${colId}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor_passagem: valores[colId] === '' ? null : Number(valores[colId]) }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      toast.success('Valor de passagem salvo!');
    } catch (e: any) { toast.error(e.message); }
    setSalvando(null);
  };

  const ativos = colaboradores.filter(c => c.ativo !== false);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-2.5">
        <Bus size={15} className="text-blue-500 shrink-0" />
        <span>Defina o valor da passagem de ida+volta por dia. O total mensal é calculado automaticamente na folha.</span>
      </div>
      <div className="space-y-2">
        {ativos.sort((a: any, b: any) => (a.funcionario?.nome ?? '').localeCompare(b.funcionario?.nome ?? '', 'pt-BR')).map((c: any) => {
          const vp = parseFloat(valores[c.id] ?? '') || 0;
          const dias = diasNoMes(c.dias_trabalho ?? [], mesAtual);
          const totalMes = vp * dias;
          return (
            <div key={c.id} className="flex items-center gap-3 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-purple-700 dark:text-purple-300 font-black text-sm shrink-0">
                {c.funcionario?.nome?.charAt(0) ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-800 dark:text-white text-sm truncate">{c.funcionario?.nome ?? '—'}</div>
                <div className="text-xs text-slate-400">{c.tipo === 'voluntario' ? 'Voluntário' : 'Funcionário'} · {dias} dias úteis em {mesAtual}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right text-xs text-slate-500 dark:text-slate-400 w-20 hidden sm:block">
                  <div>Total/mês</div>
                  <div className="font-bold text-slate-700 dark:text-slate-200">{totalMes > 0 ? totalMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</div>
                </div>
                <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
                  <span className="px-2 text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 border-r border-slate-300 dark:border-slate-600">R$</span>
                  <input
                    type="number" step="0.01" min="0" placeholder="0,00"
                    value={valores[c.id] ?? ''}
                    onChange={e => setValores(v => ({ ...v, [c.id]: e.target.value }))}
                    className="w-24 px-2 py-1.5 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => salvar(c.id)}
                  disabled={salvando === c.id}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                >
                  {salvando === c.id ? '...' : 'Salvar'}
                </button>
              </div>
            </div>
          );
        })}
        {ativos.length === 0 && <div className="text-center py-10 text-slate-400 text-sm">Nenhum colaborador ativo.</div>}
      </div>
    </div>
  );
}

// ── Tab: Financeiro ───────────────────────────────────────────────────────────

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
  const totais = dados?.totais ?? { total_folha: 0, total_vales: 0, total_liquido: 0 };

  return (
    <div>
      {/* Seletor de mês */}
      <div className="flex items-center gap-3 mb-6">
        <input type="month" value={mes} onChange={e => setMes(e.target.value)}
          className={`${ic} w-40`} />
        <button onClick={carregar} className={bs}><RefreshCw size={14} /></button>
        <span className="text-sm text-slate-500">Visão financeira de {fmt.mes(mes)}</span>
      </div>

      {/* Cards de totais */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Folha', val: totais.total_folha, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
          { label: 'Vales Pendentes', val: totais.total_vales, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
          { label: 'Líquido a Pagar', val: totais.total_liquido, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-2xl p-4`}>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{c.label}</div>
            <div className={`text-xl font-black ${c.color}`}>{fmt.moeda(c.val)}</div>
          </div>
        ))}
      </div>

      {/* Tabela por colaborador */}
      {loading
        ? <div className="text-center py-12 text-slate-400">Carregando...</div>
        : cols.length === 0
          ? <div className="text-center py-12 text-slate-400">Nenhum colaborador ativo.</div>
          : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    {['Colaborador', 'Salário Base', 'VR / Benefícios', 'Total Proventos', 'Vales Pendentes', 'Líquido', 'Recibo'].map(h => (
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
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{fmt.moeda(c.salario_base)}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{fmt.moeda(c.total_vr)}</td>
                      <td className="px-4 py-3 font-bold text-purple-700 dark:text-purple-300">{fmt.moeda(c.total_proventos)}</td>
                      <td className="px-4 py-3">
                        {c.qtd_vales_pendentes > 0
                          ? <span className="text-red-600 font-semibold">{fmt.moeda(c.vales_pendentes)} <span className="text-xs text-red-400">({c.qtd_vales_pendentes})</span></span>
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 font-black text-emerald-600 dark:text-emerald-400">{fmt.moeda(c.liquido)}</td>
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

// ── Tab: Banco de Horas (admin) ───────────────────────────────────────────────

function BancoHorasAdminTab({ colaboradores }: { colaboradores: any[] }) {
  const [colId, setColId] = useState('');
  const [mes, setMes] = useState('');
  useEffect(() => { setMes(new Date().toISOString().slice(0, 7)); }, []);
  const [dados, setDados] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const consultar = async () => {
    if (!colId) return toast.error('Selecione um colaborador.');
    setLoading(true);
    try {
      const r = await fetch(`${API}/gente/ponto/externo/banco-horas?colaborador_id=${colId}&mes=${mes}`);
      if (r.ok) setDados(await r.json());
      else toast.error('Erro ao consultar banco de horas.');
    } finally { setLoading(false); }
  };

  const ic = 'w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500';
  const saldo = dados?.saldo_minutos ?? 0;
  const cor = saldo >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select value={colId} onChange={e => { setColId(e.target.value); setDados(null); }} className={ic}>
          <option value="">Selecione colaborador...</option>
          {colaboradores.map(c => <option key={c.id} value={c.id}>{c.funcionario?.nome ?? c.id}</option>)}
        </select>
        <input type="month" value={mes} onChange={e => { setMes(e.target.value); setDados(null); }} className={ic} />
        <button onClick={consultar} disabled={loading} className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl px-4 py-2 text-sm transition disabled:opacity-50">
          <Calculator size={14} />{loading ? 'Consultando...' : 'Consultar'}
        </button>
      </div>

      {dados && (
        <div className="space-y-4">
          {/* Resumo */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
            <div className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              {colaboradores.find((c: any) => c.id === colId)?.funcionario?.nome} · {dados.mes}
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                <div className="text-xs text-slate-400 uppercase font-bold mb-1">Trabalhado</div>
                <div className="text-2xl font-black text-slate-800 dark:text-white font-mono">{dados.trabalhado}</div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                <div className="text-xs text-slate-400 uppercase font-bold mb-1">Esperado</div>
                <div className="text-2xl font-black text-slate-800 dark:text-white font-mono">{dados.esperado}</div>
                <div className="text-xs text-slate-400 mt-1">{dados.dias_esperados} dias úteis</div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                <div className="text-xs text-slate-400 uppercase font-bold mb-1">Saldo</div>
                <div className={`text-2xl font-black font-mono ${cor}`}>{dados.saldo}</div>
              </div>
            </div>
            {dados.marcacoes_incompletas?.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-xl p-4 text-sm text-yellow-800 dark:text-yellow-300 space-y-1">
                <div className="font-bold">⚠️ Marcações com problema:</div>
                {dados.marcacoes_incompletas.map((m: string, i: number) => <div key={i} className="text-xs">• {m}</div>)}
              </div>
            )}
          </div>

          {/* Tabela dia a dia */}
          {dados.dias?.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-xs uppercase text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2 text-left font-bold">Data</th>
                    <th className="px-3 py-2 text-left font-bold">Status</th>
                    <th className="px-3 py-2 text-center font-bold">Marcações</th>
                    <th className="px-3 py-2 text-center font-bold">Esperado</th>
                    <th className="px-3 py-2 text-center font-bold">Trabalhado</th>
                    <th className="px-3 py-2 text-center font-bold">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.dias.map((d: any) => {
                    const fmtMin = (m: number) => {
                      const abs = Math.abs(m);
                      const h = String(Math.floor(abs / 60)).padStart(2, '0');
                      const min = String(abs % 60).padStart(2, '0');
                      return m === 0 ? '—' : `${m < 0 ? '-' : '+'}${h}:${min}`;
                    };
                    const statusCfg: Record<string, { label: string; row: string; badge: string }> = {
                      fds:      { label: 'FDS',      row: 'bg-slate-50 dark:bg-slate-900/30',            badge: 'bg-slate-100 text-slate-400 dark:bg-slate-800' },
                      presente: { label: 'Presente', row: 'bg-white dark:bg-slate-900',                  badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
                      ausente:  { label: 'Ausente',  row: 'bg-red-50 dark:bg-red-950/20',                badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
                      atestado: { label: 'Atestado', row: 'bg-blue-50 dark:bg-blue-950/20',              badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
                      folga:    { label: 'Folga',    row: 'bg-purple-50 dark:bg-purple-950/20',          badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
                    };
                    const cfg = statusCfg[d.status] ?? statusCfg.ausente;
                    const [, mm, dd] = d.data.split('-');
                    return (
                      <tr key={d.data} className={`border-t border-slate-100 dark:border-slate-800 ${cfg.row}`}>
                        <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {dd}/{mm} <span className="text-slate-400 text-xs">{d.dia_semana}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${cfg.badge}`}>
                            {cfg.label}{d.incompleto ? ' ⚠️' : ''}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-xs font-mono text-slate-600 dark:text-slate-300">
                          {(!d.sessoes || d.sessoes.length === 0) ? '—' : d.sessoes.map((s: any, si: number) => (
                            <span key={si} className="inline-flex items-center gap-0.5 mr-2">
                              <span className="text-green-600 dark:text-green-400">{s.entrada ?? '?'}</span>
                              <span className="text-slate-400">→</span>
                              <span className={`${!s.saida ? 'text-yellow-500' : 'text-red-500 dark:text-red-400'}`}>
                                {s.saida ? (s.proximo_dia ? `${s.saida}+1` : s.saida) : '—'}
                              </span>
                            </span>
                          ))}
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-xs text-slate-500">
                          {d.esperado_min === 0 ? '—' : `${String(Math.floor(d.esperado_min / 60)).padStart(2,'0')}:${String(d.esperado_min % 60).padStart(2,'0')}`}
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-xs text-slate-700 dark:text-slate-300">
                          {d.trabalhado_min === 0 ? '—' : `${String(Math.floor(d.trabalhado_min / 60)).padStart(2,'0')}:${String(d.trabalhado_min % 60).padStart(2,'0')}`}
                        </td>
                        <td className={`px-3 py-2 text-center font-mono text-xs font-bold ${d.saldo_min < 0 ? 'text-red-500' : d.saldo_min > 0 ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                          {d.dia_trabalho ? fmtMin(d.saldo_min) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab: Folgas ───────────────────────────────────────────────────────────────

function FolgasTab({ reload, colaboradores }: { reload: number; colaboradores: any[] }) {
  const [folgas, setFolgas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'todas' | 'pendente' | 'aprovada' | 'negada'>('pendente');
  const [colFiltro, setColFiltro] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminForm, setAdminForm] = useState({ colaborador_id: '', data: '' });
  const [salvando, setSalvando] = useState(false);

  const ic = 'border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500';

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const url = colFiltro ? `${API}/gente/folgas?colaborador_id=${colFiltro}` : `${API}/gente/folgas`;
      const r = await fetch(url, { credentials: 'include' });
      if (r.ok) setFolgas(await r.json());
    } finally { setLoading(false); }
  }, [colFiltro]);

  useEffect(() => { carregar(); }, [carregar, reload]);

  const responder = async (id: string, status: 'aprovada' | 'negada') => {
    const r = await fetch(`${API}/gente/folgas/${id}/responder`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (r.ok) { toast.success(`Folga ${status}!`); carregar(); }
    else toast.error('Erro ao responder folga.');
  };

  const confirmarFolga = async (id: string, realizada: boolean) => {
    const r = await fetch(`${API}/gente/folgas/${id}/confirmar`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ realizada }),
    });
    if (r.ok) { toast.success(realizada ? 'Confirmada — horas descontadas do banco.' : 'Marcada como não realizada.'); carregar(); }
    else toast.error('Erro ao confirmar folga.');
  };

  const criarFolgaAdmin = async () => {
    if (!adminForm.colaborador_id || !adminForm.data) return toast.error('Selecione colaborador e data.');
    setSalvando(true);
    try {
      const r = await fetch(`${API}/gente/folgas/admin`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminForm),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message || 'Erro'); }
      toast.success('Folga lançada e aprovada!');
      setAdminForm({ colaborador_id: '', data: '' });
      setShowAdmin(false);
      carregar();
    } catch (e: any) { toast.error(e.message); }
    finally { setSalvando(false); }
  };

  const bp = 'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition';
  const filtradas = folgas.filter(f => filtro === 'todas' || f.status === filtro);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <select value={colFiltro} onChange={e => setColFiltro(e.target.value)} className={ic}>
          <option value="">Todos os colaboradores</option>
          {colaboradores.map(c => <option key={c.id} value={c.id}>{c.funcionario?.nome ?? c.id}</option>)}
        </select>
        {(['todas', 'pendente', 'aprovada', 'negada'] as const).map(s => (
          <button key={s} onClick={() => setFiltro(s)}
            className={`${bp} ${filtro === s ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
            <span className="ml-1 bg-white/20 rounded px-1">{folgas.filter(f => s === 'todas' || f.status === s).length}</span>
          </button>
        ))}
        <button onClick={carregar} className={`${bp} ml-auto text-slate-400 hover:text-purple-600`}><RefreshCw size={12} /></button>
        <button onClick={() => setShowAdmin(v => !v)} className={`${bp} bg-purple-600 text-white hover:bg-purple-700`}><Plus size={12} /> Lançar (admin)</button>
      </div>

      {showAdmin && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-widest">Lançamento manual de folga (bypass de regras)</p>
          <div className="flex gap-3 flex-wrap">
            <select value={adminForm.colaborador_id} onChange={e => setAdminForm(f => ({ ...f, colaborador_id: e.target.value }))} className={ic + ' flex-1'}>
              <option value="">Selecione o colaborador</option>
              {colaboradores.map(c => <option key={c.id} value={c.id}>{c.funcionario?.nome ?? c.id}</option>)}
            </select>
            <input type="date" value={adminForm.data} onChange={e => setAdminForm(f => ({ ...f, data: e.target.value }))} className={ic} />
          </div>
          <div className="flex gap-2">
            <button onClick={criarFolgaAdmin} disabled={salvando} className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 transition disabled:opacity-50">{salvando ? 'Salvando...' : 'Confirmar'}</button>
            <button onClick={() => setShowAdmin(false)} className="px-4 py-1.5 text-slate-500 rounded-lg text-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Cancelar</button>
          </div>
        </div>
      )}
      {loading ? <p className="text-slate-400 text-center text-sm">Carregando...</p> : filtradas.length === 0 ? (
        <p className="text-slate-400 text-center text-sm">Nenhuma folga encontrada.</p>
      ) : (
        <div className="space-y-2">
          {filtradas.map(f => (
            <div key={f.id} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex-wrap">
              <Calendar size={16} className="text-purple-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-800 dark:text-white text-sm">{f.funcionario_nome ?? '—'}</div>
                <div className="text-xs text-slate-400">
                  {new Date(String(f.data).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                  {' · '}Solicitado: {new Date(f.created_at).toLocaleDateString('pt-BR')}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 flex-wrap">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${f.status === 'pendente' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' : f.status === 'aprovada' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                  {f.status.toUpperCase()}
                </span>
                {f.realizada === true && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">REALIZADA</span>}
                {f.realizada === false && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">NÃO REALIZADA</span>}
                {f.status === 'pendente' && (
                  <>
                    <button onClick={() => responder(f.id, 'aprovada')} className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 hover:bg-green-200 transition" title="Aprovar"><Check size={14} /></button>
                    <button onClick={() => responder(f.id, 'negada')} className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200 transition" title="Negar"><X size={14} /></button>
                  </>
                )}
                {f.status === 'aprovada' && f.realizada == null && new Date(String(f.data).slice(0, 10) + 'T23:59:59') < new Date() && (
                  <>
                    <button onClick={() => confirmarFolga(f.id, true)} className="px-2 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 hover:bg-blue-200 transition text-xs font-bold" title="Confirmar realização">✓ Realizada</button>
                    <button onClick={() => confirmarFolga(f.id, false)} className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 transition text-xs" title="Não realizada">✗ Não</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: Trabalho Externo ─────────────────────────────────────────────────────

function TrabalhoExternoTab({ reload, colaboradores }: { reload: number; colaboradores: any[] }) {
  const [autorizacoes, setAutorizacoes] = useState<any[]>([]);
  const [form, setForm] = useState({ colaborador_id: '', data: new Date().toISOString().split('T')[0] });
  const [salvando, setSalvando] = useState(false);

  const ic = 'w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500';

  const carregar = useCallback(async () => {
    const r = await fetch(`${API}/gente/trabalho-externo`, { credentials: 'include' });
    if (r.ok) setAutorizacoes(await r.json());
  }, []);

  useEffect(() => { carregar(); }, [carregar, reload]);

  const autorizar = async () => {
    if (!form.colaborador_id || !form.data) return toast.error('Selecione colaborador e data.');
    setSalvando(true);
    const r = await fetch(`${API}/gente/trabalho-externo`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSalvando(false);
    if (r.ok) { toast.success('Trabalho externo autorizado!'); setForm(f => ({ ...f, colaborador_id: '' })); carregar(); }
    else toast.error('Erro ao autorizar.');
  };

  const revogar = async (id: string) => {
    const r = await fetch(`${API}/gente/trabalho-externo/${id}`, { method: 'DELETE', credentials: 'include' });
    if (r.ok) { toast.success('Revogado.'); carregar(); }
  };

  const nomeCol = (id: string) => colaboradores.find(c => c.id === id)?.funcionario?.nome ?? id;

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-xs text-blue-700 dark:text-blue-300">
        <strong>Trabalho Externo:</strong> autoriza um colaborador a registrar ponto de qualquer localização no dia selecionado, sem restrição de geofence.
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select value={form.colaborador_id} onChange={e => setForm(f => ({ ...f, colaborador_id: e.target.value }))} className={ic}>
          <option value="">Selecione colaborador...</option>
          {colaboradores.map(c => <option key={c.id} value={c.id}>{c.funcionario?.nome ?? c.id}</option>)}
        </select>
        <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} className={ic} />
        <button onClick={autorizar} disabled={salvando} className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl px-4 py-2 text-sm transition disabled:opacity-50">
          <Plus size={14} />{salvando ? 'Salvando...' : 'Autorizar'}
        </button>
      </div>
      <div className="space-y-2">
        {autorizacoes.length === 0 ? (
          <p className="text-slate-400 text-center text-sm">Nenhuma autorização ativa.</p>
        ) : autorizacoes.map(a => (
          <div key={a.id} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
            <MapPin size={16} className="text-purple-500 shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-sm text-slate-800 dark:text-white">{nomeCol(a.colaborador_id)}</div>
              <div className="text-xs text-slate-400">
                {new Date(a.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })} · por {a.autorizado_por}
              </div>
            </div>
            <button onClick={() => revogar(a.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SubTabs ───────────────────────────────────────────────────────────────────

function SubTabs<T extends string>({ tabs, active, setActive }: {
  tabs: readonly { key: T; label: string; icon?: React.ComponentType<any> }[];
  active: T; setActive: (k: T) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-2 mb-5 border-b border-slate-200 dark:border-slate-700 scrollbar-hide">
      {tabs.map(t => {
        const Icon = t.icon;
        return (
          <button key={t.key} onClick={() => setActive(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${active === t.key ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}>
            {Icon && <Icon size={12} />}{t.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Tab: Folha de Ponto (relatório mensal imprimível) ─────────────────────────

function FolhaPontoRelatorio({ colaboradores }: { colaboradores: any[] }) {
  const [mes, setMes] = useState('');
  useEffect(() => { setMes(new Date().toISOString().slice(0, 7)); }, []);
  const [dados, setDados] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fmtMin = (min: number) => {
    if (!min && min !== 0) return '—';
    const h = Math.floor(Math.abs(min) / 60); const m = Math.abs(min) % 60;
    return `${min < 0 ? '-' : ''}${h}h${m > 0 ? String(m).padStart(2, '0') + 'm' : ''}`;
  };

  const carregar = useCallback(async () => {
    if (!mes || colaboradores.length === 0) return;
    setLoading(true);
    const results = await Promise.all(
      colaboradores.map(col =>
        fetch(`${API}/gente/ponto/externo/banco-horas?colaborador_id=${col.id}&mes=${mes}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => d ? { ...d, nome: col.funcionario?.nome ?? '—', cargo: col.funcionario?.cargo ?? '' } : null)
          .catch(() => null)
      )
    );
    setDados(results.filter(Boolean).sort((a: any, b: any) => (a.nome ?? '').localeCompare(b.nome ?? '')));
    setLoading(false);
  }, [mes, colaboradores]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { carregar(); }, [carregar]);

  const totalSaldo = dados.reduce((s, d) => s + (d.saldo_minutos ?? 0), 0);

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <input type="month" value={mes} onChange={e => setMes(e.target.value)} className={`${ic} w-40`} />
        <button onClick={carregar} disabled={loading} className={bs}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
        <button onClick={() => window.print()}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold px-4 py-2 rounded-xl text-sm transition">
          <Printer size={14} />Imprimir Folha
        </button>
        {mes && <span className="text-sm text-slate-500">Competência: {fmt.mes(mes)}</span>}
      </div>

      {loading ? <div className="text-center py-12 text-slate-400">Calculando horas...</div>
        : dados.length === 0 ? <div className="text-center py-12 text-slate-400">Nenhum colaborador ativo.</div>
        : (
          <div id="folha-ponto-print" className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>{['Colaborador', 'Cargo', 'Dias Esp.', 'Trabalhado', 'Esperado', 'Saldo', 'Assinatura'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {dados.map(d => {
                  const saldoMin = d.saldo_minutos ?? 0;
                  return (
                    <tr key={d.colaborador_id ?? d.nome} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">{d.nome}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{d.cargo || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-center">{d.dias_esperados ?? '—'}</td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-white">{d.trabalhado ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">{d.esperado ?? '—'}</td>
                      <td className={`px-4 py-3 font-mono font-black ${saldoMin >= 0 ? 'text-green-600' : 'text-red-500'}`}>{d.saldo ?? '—'}</td>
                      <td className="px-4 py-3 w-40 border-l border-slate-200 dark:border-slate-700 text-slate-200 dark:text-slate-700 text-xs select-none">____________</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800">
                <tr>
                  <td className="px-4 py-2 font-black text-slate-800 dark:text-white" colSpan={3}>Total ({dados.length} colaboradores)</td>
                  <td colSpan={2} />
                  <td className={`px-4 py-2 font-mono font-black text-sm ${totalSaldo >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmtMin(totalSaldo)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      <style>{`@media print { #folha-ponto-print { font-size: 11px !important; } }`}</style>
    </div>
  );
}

// ── Página Principal ──────────────────────────────────────────────────────────

const MAIN_TABS = [
  { key: 'colaboradores' as const, label: 'Colaboradores', icon: Users },
  { key: 'ponto' as const, label: 'Ponto & Horas', icon: Clock },
  { key: 'folha' as const, label: 'Folha / RH', icon: FileText },
  { key: 'disciplinar' as const, label: 'Disciplinar', icon: AlertTriangle },
  { key: 'codigos' as const, label: 'Códigos VR', icon: Tag },
];

const SUB_PONTO = [
  { key: 'alertas' as const, label: 'Alertas & Ponto', icon: Clock },
  { key: 'banco-horas' as const, label: 'Banco de Horas', icon: Calculator },
  { key: 'relatorio-folha' as const, label: 'Folha de Ponto', icon: Printer },
  { key: 'folgas' as const, label: 'Folgas', icon: Check },
  { key: 'trabalho-externo' as const, label: 'Trab. Externo', icon: MapPin },
] as const;

const SUB_FOLHA = [
  { key: 'recibos' as const, label: 'Recibos / Folha', icon: FileText },
  { key: 'vales' as const, label: 'Vales', icon: Wallet },
  { key: 'transporte' as const, label: 'Transporte', icon: Bus },
  { key: 'financeiro' as const, label: 'Financeiro', icon: DollarSign },
] as const;

const SUB_DISCIPLINAR = [
  { key: 'advertencias' as const, label: 'Advertências', icon: AlertTriangle },
  { key: 'suspensoes' as const, label: 'Suspensões', icon: PauseCircle },
  { key: 'faltas' as const, label: 'Faltas', icon: Calendar },
] as const;

export default function GentePage() {
  const [tab, setTab] = useState<MainTab>('colaboradores');
  const [subPonto, setSubPonto] = useState<typeof SUB_PONTO[number]['key']>('alertas');
  const [subFolha, setSubFolha] = useState<typeof SUB_FOLHA[number]['key']>('recibos');
  const [subDisc, setSubDisc] = useState<typeof SUB_DISCIPLINAR[number]['key']>('advertencias');
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

      {/* Tabs principais */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-6 scrollbar-hide">
        {MAIN_TABS.map(t => {
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

        {tab === 'colaboradores' && (
          <ColaboradoresTab reload={reload} colaboradores={colaboradores} carregarColaboradores={carregarColaboradores} />
        )}

        {tab === 'ponto' && (
          <>
            <SubTabs tabs={SUB_PONTO} active={subPonto} setActive={setSubPonto} />
            {subPonto === 'alertas' && <PontoTab reload={reload} colaboradores={colaboradores} />}
            {subPonto === 'banco-horas' && <BancoHorasAdminTab colaboradores={colaboradores} />}
            {subPonto === 'relatorio-folha' && <FolhaPontoRelatorio colaboradores={colaboradores} />}
            {subPonto === 'folgas' && <FolgasTab reload={reload} colaboradores={colaboradores} />}
            {subPonto === 'trabalho-externo' && <TrabalhoExternoTab reload={reload} colaboradores={colaboradores} />}
          </>
        )}

        {tab === 'folha' && (
          <>
            <SubTabs tabs={SUB_FOLHA} active={subFolha} setActive={setSubFolha} />
            {subFolha === 'recibos' && <RecibosTab reload={reload} colaboradores={colaboradores} />}
            {subFolha === 'vales' && <GenericTab endpoint="vales" titulo="Vale" reload={reload} colaboradores={colaboradores} CamposComp={CamposVale} renderLinha={(i, e, d) => <LinhaVale key={i.id} item={i} onEdit={e} onDel={d} colaboradores={colaboradores} />} />}
            {subFolha === 'transporte' && <TransporteTab reload={reload} colaboradores={colaboradores} />}
            {subFolha === 'financeiro' && <FinanceiroTab reload={reload} />}
          </>
        )}

        {tab === 'disciplinar' && (
          <>
            <SubTabs tabs={SUB_DISCIPLINAR} active={subDisc} setActive={setSubDisc} />
            {subDisc === 'advertencias' && <GenericTab endpoint="advertencias" titulo="Advertência" reload={reload} colaboradores={colaboradores} CamposComp={CamposAdvertencia} renderLinha={(i, e, d) => <LinhaAdvertencia key={i.id} item={i} onEdit={e} onDel={d} colaboradores={colaboradores} />} />}
            {subDisc === 'suspensoes' && <GenericTab endpoint="suspensoes" titulo="Suspensão" reload={reload} colaboradores={colaboradores} CamposComp={CamposSuspensao} renderLinha={(i, e, d) => <LinhaSuspensao key={i.id} item={i} onEdit={e} onDel={d} colaboradores={colaboradores} />} />}
            {subDisc === 'faltas' && <GenericTab endpoint="faltas" titulo="Falta" reload={reload} colaboradores={colaboradores} CamposComp={CamposFalta} renderLinha={(i, e, d) => <LinhaFalta key={i.id} item={i} onEdit={e} onDel={d} colaboradores={colaboradores} />} />}
          </>
        )}

        {tab === 'codigos' && <CodigosTab reload={reload} />}
      </div>
    </div>
  );
}

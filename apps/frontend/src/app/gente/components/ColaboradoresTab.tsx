'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  Plus, Search, Edit2, Trash2, ExternalLink, ChevronDown, ChevronUp,
  RefreshCw, MapPin, Tag, Upload, Paperclip, X,
} from 'lucide-react';
import { API, fmt, ic, bp, bs, bd, Badge, Modal, FL } from './shared';

// ── Modal de Documentos do Colaborador ────────────────────────────────────────

function DocumentosModal({ colaboradorId, colaboradorNome, onClose }: { colaboradorId: string; colaboradorNome: string; onClose: () => void }) {
  const ic2 = 'border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-400 w-full';
  const [docs, setDocs] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ nome: '', url: '', vencimento: '', observacao: '', categoria: 'pessoal' });
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const hoje = new Date().toISOString().split('T')[0];
  const em30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const handleArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Arquivo muito grande. Limite: 10 MB.'); return; }
    setUploading(true);
    setNomeArquivo(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f: any) => ({ ...f, url: reader.result as string, nome: f.nome || file.name.replace(/\.[^.]+$/, '') }));
      setUploading(false);
    };
    reader.onerror = () => { toast.error('Erro ao ler arquivo.'); setUploading(false); };
    reader.readAsDataURL(file);
  };

  const carregar = useCallback(async () => {
    const r = await fetch(`${API}/gente/colaboradores/${colaboradorId}/documentos`, { credentials: 'include' });
    if (r.ok) setDocs(await r.json());
  }, [colaboradorId]);

  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async () => {
    if (!form.nome) { toast.error('Informe o nome do documento.'); return; }
    const url = editandoId ? `${API}/gente/documentos/${editandoId}` : `${API}/gente/colaboradores/${colaboradorId}/documentos`;
    const r = await fetch(url, { method: editandoId ? 'PATCH' : 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (r.ok) { toast.success(editandoId ? 'Atualizado.' : 'Adicionado.'); setForm({ nome: '', url: '', vencimento: '', observacao: '', categoria: 'pessoal' }); setNomeArquivo(''); setEditandoId(null); setMostrarForm(false); carregar(); }
    else toast.error('Erro ao salvar documento.');
  };

  const deletar = async (id: string) => {
    if (!confirm('Excluir documento?')) return;
    const r = await fetch(`${API}/gente/documentos/${id}`, { method: 'DELETE', credentials: 'include' });
    if (r.ok) { toast.success('Removido.'); carregar(); }
  };

  const DocItem = ({ d }: { d: any }) => {
    const venceu = d.vencimento && String(d.vencimento).slice(0, 10) < hoje;
    const proxVenc = d.vencimento && !venceu && String(d.vencimento).slice(0, 10) <= em30;
    return (
      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs border ${venceu ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : proxVenc ? 'border-orange-300 bg-orange-50 dark:bg-orange-900/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60'}`}>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{d.nome}</div>
          <div className="flex flex-wrap items-center gap-2 mt-0.5 text-slate-400">
            {d.vencimento && <span className={venceu ? 'text-red-600 font-bold' : proxVenc ? 'text-orange-600 font-bold' : ''}>Vence: {fmt.data(String(d.vencimento).slice(0,10))}{venceu ? ' ⚠ VENCIDO' : proxVenc ? ' ⚠ A vencer' : ''}</span>}
            {d.observacao && <span>· {d.observacao}</span>}
            {d.createdAt && <span className="text-slate-300 dark:text-slate-600">Inserido em {fmt.data(d.createdAt)}{d.criado_por_nome ? ` por ${d.criado_por_nome}` : ''}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" className="p-1 text-blue-500 hover:text-blue-700" title="Abrir"><ExternalLink size={12} /></a>}
          {d.categoria !== 'vale' && <>
            <button onClick={() => { setForm({ nome: d.nome, url: d.url || '', vencimento: String(d.vencimento || '').slice(0,10), observacao: d.observacao || '', categoria: d.categoria || 'pessoal' }); setNomeArquivo(''); setEditandoId(d.id); setMostrarForm(true); }} className="p-1 text-slate-400 hover:text-purple-600"><Edit2 size={12} /></button>
            <button onClick={() => deletar(d.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={12} /></button>
          </>}
        </div>
      </div>
    );
  };

  const pessoais = docs.filter(d => !d.categoria || d.categoria === 'pessoal');
  const vales = docs.filter(d => d.categoria === 'vale');
  const outros = docs.filter(d => d.categoria === 'outros');

  const Secao = ({ titulo, lista, cor }: { titulo: string; lista: any[]; cor: string }) => (
    <div>
      <div className={`text-[10px] font-black uppercase tracking-widest ${cor} mb-2`}>{titulo} <span className="font-normal opacity-60">({lista.length})</span></div>
      {lista.length === 0 ? <p className="text-xs text-slate-400 py-1">Nenhum documento.</p> : <div className="space-y-1.5">{lista.map(d => <DocItem key={d.id} d={d} />)}</div>}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="font-black text-slate-800 dark:text-white flex items-center gap-2"><Paperclip size={16} /> Documentos</h2>
            <p className="text-xs text-slate-400 mt-0.5">{colaboradorNome}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
          <Secao titulo="Documentos Pessoais" lista={pessoais} cor="text-purple-600 dark:text-purple-400" />
          {vales.length > 0 && <Secao titulo="Fichas de Vale" lista={vales} cor="text-emerald-600 dark:text-emerald-400" />}
          <Secao titulo="Outros Documentos" lista={outros} cor="text-slate-500 dark:text-slate-400" />
        </div>

        {/* Form adicionar */}
        <div className="px-6 pb-6 border-t border-slate-200 dark:border-slate-700 pt-4">
          {mostrarForm ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Categoria</label>
                  <select value={form.categoria} onChange={e => setForm((f: any) => ({ ...f, categoria: e.target.value }))} className={ic2}>
                    <option value="pessoal">Documentos Pessoais</option>
                    <option value="outros">Outros Documentos</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Nome *</label>
                  <input placeholder="Ex: RG, CNH, Contrato..." value={form.nome} onChange={e => setForm((f: any) => ({ ...f, nome: e.target.value }))} className={ic2} />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Anexo</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-dashed border-purple-400 dark:border-purple-600 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition disabled:opacity-50 shrink-0">
                    {uploading ? <RefreshCw size={12} className="animate-spin" /> : <Upload size={12} />}
                    {uploading ? 'Carregando...' : 'Escolher arquivo'}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" className="hidden" onChange={handleArquivo} />
                  {nomeArquivo && !uploading
                    ? <span className="flex-1 text-xs text-slate-500 truncate flex items-center">{nomeArquivo}</span>
                    : <input placeholder="ou cole uma URL (Google Drive...)" value={form.url?.startsWith('data:') ? '' : (form.url || '')} onChange={e => setForm((f: any) => ({ ...f, url: e.target.value }))} className={`${ic2} flex-1`} />
                  }
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Vencimento</label>
                  <input type="date" value={form.vencimento} onChange={e => setForm((f: any) => ({ ...f, vencimento: e.target.value }))} className={ic2} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Observação</label>
                  <input placeholder="Observação" value={form.observacao} onChange={e => setForm((f: any) => ({ ...f, observacao: e.target.value }))} className={ic2} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setMostrarForm(false); setEditandoId(null); setNomeArquivo(''); setForm({ nome: '', url: '', vencimento: '', observacao: '', categoria: 'pessoal' }); }} className="flex-1 py-1.5 text-xs text-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 transition">Cancelar</button>
                <button onClick={salvar} disabled={!form.nome} className="flex-1 py-1.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition disabled:opacity-50">{editandoId ? 'Atualizar' : 'Adicionar'}</button>
              </div>
            </div>
          ) : (
            <button onClick={() => { setForm({ nome: '', url: '', vencimento: '', observacao: '', categoria: 'pessoal' }); setEditandoId(null); setMostrarForm(true); }}
              className="w-full py-2 text-xs text-purple-600 dark:text-purple-400 border border-dashed border-purple-300 dark:border-purple-700 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition flex items-center justify-center gap-1.5 font-bold">
              <Plus size={12} /> Adicionar Documento
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Colaboradores ────────────────────────────────────────────────────────

export interface ColaboradoresTabProps {
  reload: number;
  colaboradores: any[];
  carregarColaboradores: () => void;
}

export function ColaboradoresTab({ reload, colaboradores, carregarColaboradores }: ColaboradoresTabProps) {
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
  const [abaEdicao, setAbaEdicao] = useState(0);

  const [form, setForm] = useState<any>({
    tipo: 'voluntario', dias_trabalho: ['seg', 'ter', 'qua', 'qui', 'sex'],
    horario_entrada: '08:00', horario_saida: '17:00',
  });
  const [formFunc, setFormFunc] = useState<any>({ pais: 'Brasil' });
  const [docModalColaborador, setDocModalColaborador] = useState<{ id: string; nome: string } | null>(null);

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
      const { foto, id, matricula, ativo, created_at, updated_at, usuario_id, ...payloadFunc } = formFunc;
      const r1 = await fetch(`${API}/gente/colaboradores/${colSelecionado.id}/funcionario`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadFunc),
      });
      if (!r1.ok) {
        let msg = 'Erro ao salvar dados pessoais';
        try { const e = await r1.json(); msg = e.message ?? e.error ?? msg; } catch {}
        throw new Error(`[${r1.status}] ${msg}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { funcionario: _f, foto: _foto2, ...payloadCol } = form as any;
      const r2 = await fetch(`${API}/gente/colaboradores/${editando.id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadCol),
      });
      if (!r2.ok) {
        let msg2 = 'Erro ao salvar configuração de ponto';
        try { const e2 = await r2.json(); msg2 = e2.message ?? e2.error ?? msg2; } catch {}
        throw new Error(`[${r2.status}] ${msg2}`);
      }

      await carregarColaboradores(); toast.success('Cadastro atualizado!'); setModal(null);
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
      await carregarColaboradores(); toast.success('Funcionário e colaborador criados!'); setModal(null);
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

  const geoErrMsg = (err: GeolocationPositionError) => {
    if (err.code === 1) return 'Permissão negada. Verifique as configurações do navegador (Ajustes → Safari → Localização).';
    if (err.code === 2) return 'Localização indisponível. Verifique o GPS do dispositivo.';
    return 'Tempo esgotado ao obter localização. Tente novamente.';
  };

  const usarGeo = () => {
    if (!navigator.geolocation) { toast.error('Geolocalização não suportada neste navegador.'); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      setForm((f: any) => ({ ...f, latitude_permitida: pos.coords.latitude, longitude_permitida: pos.coords.longitude }));
      toast.success('Localização capturada!');
    }, (err) => toast.error(geoErrMsg(err)), { enableHighAccuracy: true, timeout: 12000 });
  };

  const usarGeoLocal = () => {
    if (!navigator.geolocation) { toast.error('Geolocalização não suportada neste navegador.'); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      setFormLocal((f: any) => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
      toast.success('Localização capturada!');
    }, (err) => toast.error(geoErrMsg(err)), { enableHighAccuracy: true, timeout: 12000 });
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

  const [ordemCampo, setOrdemCampo] = useState<'nome' | 'cargo' | 'tipo'>('nome');
  const [ordemDir, setOrdemDir] = useState<'asc' | 'desc'>('asc');

  const toggleOrdem = (campo: 'nome' | 'cargo' | 'tipo') => {
    if (ordemCampo === campo) setOrdemDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setOrdemCampo(campo); setOrdemDir('asc'); }
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
    .sort((a, b) => {
      let va = '', vb = '';
      if (ordemCampo === 'nome') { va = a.funcionario?.nome ?? ''; vb = b.funcionario?.nome ?? ''; }
      else if (ordemCampo === 'cargo') { va = a.funcionario?.cargo ?? ''; vb = b.funcionario?.cargo ?? ''; }
      else if (ordemCampo === 'tipo') { va = a.tipo ?? ''; vb = b.tipo ?? ''; }
      return ordemDir === 'asc' ? va.localeCompare(vb, 'pt-BR') : vb.localeCompare(va, 'pt-BR');
    });

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
      <div className="flex items-center gap-2 mb-1">
        <input type="checkbox" id="pagamento_isento" checked={!!form.pagamento_isento}
          onChange={e => setForm((f: any) => ({ ...f, pagamento_isento: e.target.checked }))}
          className="rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
        <label htmlFor="pagamento_isento" className="text-sm text-orange-700 dark:text-orange-400 cursor-pointer font-semibold">Pagamento isento (não pago pelo instituto)</label>
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
      {/* Home Office por dia fixo */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          🏠 Dias de Home Office (fixos/semanais)
        </label>
        <div className="flex gap-2 flex-wrap">
          {DIAS_OPT.map(d => {
            const ativo = (form.dias_home_office || []).includes(d.k);
            return (
              <button key={d.k} type="button"
                onClick={() => setForm((f: any) => ({
                  ...f,
                  dias_home_office: ativo
                    ? (f.dias_home_office || []).filter((x: string) => x !== d.k)
                    : [...(f.dias_home_office || []), d.k],
                }))}
                className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${ativo ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                {d.l}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-400">Nestes dias o geofence é ignorado automaticamente — o colaborador registra de qualquer local.</p>
      </div>
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
      {/* Stats */}
      {colaboradores.length > 0 && (() => {
        const ativos = colaboradores.filter(c => c.ativo !== false);
        const funcs = ativos.filter(c => c.tipo === 'funcionario').length;
        const vols = ativos.filter(c => c.tipo === 'voluntario').length;
        const inativos = colaboradores.length - ativos.length;
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Total Ativos', value: ativos.length, color: 'text-purple-600 dark:text-purple-400' },
              { label: 'Funcionários', value: funcs, color: 'text-blue-600 dark:text-blue-400' },
              { label: 'Voluntários', value: vols, color: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Inativos', value: inativos, color: 'text-slate-400' },
            ].map(s => (
              <div key={s.label} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
                <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                <div className="text-xs text-slate-400 font-semibold mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        );
      })()}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-slate-400">{filtrados.length} colaborador(es)</span>
        <span className="text-xs text-slate-300 dark:text-slate-600">·</span>
        <span className="text-xs text-slate-400">Ordenar:</span>
        {(['nome', 'cargo', 'tipo'] as const).map(campo => (
          <button key={campo} onClick={() => toggleOrdem(campo)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${ordemCampo === campo ? 'bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 dark:hover:border-slate-500'}`}>
            {campo.charAt(0).toUpperCase() + campo.slice(1)}
            {ordemCampo === campo && <span className="font-black">{ordemDir === 'asc' ? ' ↑' : ' ↓'}</span>}
          </button>
        ))}
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
                    {c.pagamento_isento && <Badge label="Isento" color="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" />}
                    {c.jornada_flexivel ? <span className="text-xs text-slate-400 hidden sm:block">Jornada flexível</span> : c.horario_entrada && <span className="text-xs text-slate-400 hidden sm:block">{c.horario_entrada}→{c.horario_saida}</span>}
                    <button onClick={() => abrirCodigosColaborador(c)} className="p-1.5 text-slate-400 hover:text-emerald-600 transition" title="Códigos VR"><Tag size={14} /></button>
                    <button onClick={() => setDocModalColaborador({ id: c.id, nome: c.funcionario?.nome ?? '' })} className="p-1.5 text-slate-400 hover:text-blue-600 transition" title="Documentos"><Paperclip size={14} /></button>
                    <button onClick={() => {
                      if (!c.funcionario) { toast.error('Este colaborador não possui funcionário vinculado. Desvincule e recadastre.'); return; }
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
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 space-y-3">
                    {/* Linha 1: Identificação */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div><span className="text-slate-400 block">CPF</span><span className="font-semibold">{c.funcionario?.cpf || '—'}</span></div>
                      <div><span className="text-slate-400 block">Celular</span><span className="font-semibold">{c.funcionario?.celular || '—'}</span></div>
                      <div><span className="text-slate-400 block">Email</span><span className="font-semibold truncate block">{c.funcionario?.email || '—'}</span></div>
                      <div><span className="text-slate-400 block">Nascimento</span><span className="font-semibold">{c.funcionario?.data_nascimento ? fmt.data(c.funcionario.data_nascimento) : '—'}</span></div>
                      <div><span className="text-slate-400 block">Estado Civil</span><span className="font-semibold">{c.funcionario?.estado_civil || '—'}</span></div>
                      <div><span className="text-slate-400 block">Sexo / Gênero</span><span className="font-semibold">{[c.funcionario?.sexo, c.funcionario?.genero].filter(Boolean).join(' · ') || '—'}</span></div>
                      <div><span className="text-slate-400 block">Escolaridade</span><span className="font-semibold">{c.funcionario?.escolaridade || '—'}</span></div>
                    </div>
                    {/* Linha 2: Endereço */}
                    {(c.funcionario?.logradouro || c.funcionario?.cidade) && (
                      <div className="text-xs border-t border-slate-100 dark:border-slate-700 pt-2 space-y-1">
                        <span className="text-slate-400 font-bold uppercase tracking-widest">Endereço</span>
                        <div className="font-semibold text-slate-700 dark:text-slate-300">
                          {[c.funcionario?.logradouro, c.funcionario?.numero_residencia, c.funcionario?.complemento].filter(Boolean).join(', ')}
                          {c.funcionario?.bairro && <span className="text-slate-500"> · {c.funcionario.bairro}</span>}
                          {c.funcionario?.cidade && <span> · {c.funcionario.cidade}{c.funcionario?.estado ? `/${c.funcionario.estado}` : ''}</span>}
                          {c.funcionario?.cep && <span className="text-slate-400"> (CEP {c.funcionario.cep})</span>}
                        </div>
                        {(c.funcionario?.telefone_emergencia_1 || c.funcionario?.telefone_emergencia_2) && (
                          <div className="text-slate-500">
                            Tel. emergência: {[c.funcionario?.telefone_emergencia_1, c.funcionario?.telefone_emergencia_2].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Linha 3: Saúde & Perfil Social */}
                    {(c.funcionario?.possui_deficiencia || c.funcionario?.possui_alergias || c.funcionario?.usa_medicamentos || c.funcionario?.possui_plano_saude || c.funcionario?.interesse_cursos || c.funcionario?.pertence_comunidade_tradicional || c.funcionario?.possui_cad_unico || c.funcionario?.baixo_idh) && (
                      <div className="text-xs border-t border-slate-100 dark:border-slate-700 pt-2 flex flex-wrap gap-2">
                        {c.funcionario?.possui_deficiencia && <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full">Deficiência</span>}
                        {c.funcionario?.possui_alergias && <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full">Alergias</span>}
                        {c.funcionario?.usa_medicamentos && <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded-full">Medicamentos</span>}
                        {c.funcionario?.possui_plano_saude && <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">Plano: {c.funcionario?.plano_saude || '✓'}</span>}
                        {c.funcionario?.interesse_cursos && <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">Interesse cursos</span>}
                        {c.funcionario?.pertence_comunidade_tradicional && <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">Com. tradicional</span>}
                        {c.funcionario?.possui_cad_unico && <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">CadÚnico</span>}
                        {c.funcionario?.baixo_idh && <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">Baixo IDH</span>}
                      </div>
                    )}
                    {/* Linha 4: Ponto */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-t border-slate-100 dark:border-slate-700 pt-2">
                      <div><span className="text-slate-400 block">Horário</span><span className="font-semibold">{c.jornada_flexivel ? `Flexível · ${Math.floor((c.horas_dia_flex ?? 420) / 60)}h/dia` : `${c.horario_entrada || '—'} → ${c.horario_saida || '—'}`}</span></div>
                      <div><span className="text-slate-400 block">Dias</span><span className="font-semibold">{(c.dias_trabalho || []).join(', ') || '—'}</span></div>
                      <div><span className="text-slate-400 block">Geofence</span><span className="font-semibold">{c.latitude_permitida ? `${Number(c.latitude_permitida).toFixed(4)}, ${Number(c.longitude_permitida).toFixed(4)}` : '—'}</span></div>
                      <div><span className="text-slate-400 block">Raio</span><span className="font-semibold">{c.raio_metros ?? 100}m</span></div>
                    </div>
                    {/* Linha 5: Documentos */}
                    <div className="text-xs text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-2 flex items-center gap-1.5">
                      <Paperclip size={12} />
                      <button onClick={() => setDocModalColaborador({ id: c.id, nome: c.funcionario?.nome ?? '' })} className="text-blue-500 hover:underline">Ver documentos do colaborador</button>
                    </div>
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
                <FL label="Data de Emissão RG"><input type="date" value={formFunc.data_emissao_rg?.slice(0, 10) || ''} onChange={e => setFormFunc((f: any) => ({ ...f, data_emissao_rg: e.target.value }))} className={ic} /></FL>
                <FL label="Data de Nascimento"><input type="date" value={formFunc.data_nascimento?.slice(0, 10) || ''} onChange={e => setFormFunc((f: any) => ({ ...f, data_nascimento: e.target.value }))} className={ic} /></FL>
                <FL label="Celular"><input type="text" value={formFunc.celular || ''} onChange={e => setFormFunc((f: any) => ({ ...f, celular: e.target.value }))} className={ic} /></FL>
                <FL label="Estado Civil">
                  <select value={formFunc.estado_civil || ''} onChange={e => setFormFunc((f: any) => ({ ...f, estado_civil: e.target.value }))} className={ic}>
                    <option value="">Selecione...</option>
                    {['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Separado(a)', 'Viúvo(a)', 'União Estável'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </FL>
                <FL label="Sexo">
                  <select value={formFunc.sexo || ''} onChange={e => setFormFunc((f: any) => ({ ...f, sexo: e.target.value }))} className={ic}>
                    <option value="">Selecione...</option>
                    {['Masculino', 'Feminino', 'Outro', 'Prefiro não informar'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </FL>
                <FL label="Gênero">
                  <select value={formFunc.genero || ''} onChange={e => setFormFunc((f: any) => ({ ...f, genero: e.target.value }))} className={ic}>
                    <option value="">Selecione...</option>
                    {['Homem cisgênero','Mulher cisgênero','Homem trans','Mulher trans','Não-binário','Gênero fluido','Prefiro não informar'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </FL>
                <FL label="Raça / Cor">
                  <select value={formFunc.raca_cor || ''} onChange={e => setFormFunc((f: any) => ({ ...f, raca_cor: e.target.value }))} className={ic}>
                    <option value="">Selecione...</option>
                    {['Preta', 'Parda', 'Branca', 'Indígena', 'Amarela', 'Prefiro não informar'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </FL>
                <FL label="Escolaridade">
                  <select value={formFunc.escolaridade || ''} onChange={e => setFormFunc((f: any) => ({ ...f, escolaridade: e.target.value }))} className={ic}>
                    <option value="">Selecione...</option>
                    {['Fundamental Incompleto','Fundamental Completo','Médio Incompleto','Médio Completo','Superior Incompleto','Superior Completo','Pós-graduação'].map(v => <option key={v} value={v}>{v}</option>)}
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
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formFunc.possui_plano_saude} onChange={e => setFormFunc((f: any) => ({ ...f, possui_plano_saude: e.target.checked }))} className="w-4 h-4" />Possui plano de saúde?</label>
                  {formFunc.possui_plano_saude && (
                    <div className="grid grid-cols-2 gap-3">
                      <FL label="Plano de Saúde"><input type="text" value={formFunc.plano_saude || ''} onChange={e => setFormFunc((f: any) => ({ ...f, plano_saude: e.target.value }))} className={ic} /></FL>
                      <FL label="Nº SUS"><input type="text" value={formFunc.numero_sus || ''} onChange={e => setFormFunc((f: any) => ({ ...f, numero_sus: e.target.value }))} className={ic} /></FL>
                    </div>
                  )}
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

      {/* Modal: Editar Colaborador — com abas */}
      {modal === 'editar' && colSelecionado && editando && (
        <Modal title="Editar Colaborador" onClose={() => setModal(null)} wide>
          <div className="space-y-4">
            {/* Cabeçalho */}
            <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl">
              {colSelecionado.funcionario?.foto
                ? <img src={colSelecionado.funcionario.foto} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-purple-400 shrink-0" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                : <div className="w-12 h-12 rounded-full bg-purple-200 dark:bg-purple-800 flex items-center justify-center text-purple-700 dark:text-purple-200 font-black text-lg shrink-0">{colSelecionado.funcionario?.nome?.charAt(0) ?? '?'}</div>}
              <div className="min-w-0 flex-1">
                <div className="font-black text-slate-800 dark:text-white truncate">{colSelecionado.funcionario?.nome ?? '—'}</div>
                <div className="text-xs text-purple-600 dark:text-purple-300 font-semibold">{colSelecionado.funcionario?.cargo ?? 'Sem cargo'} · {colSelecionado.funcionario?.matricula ?? ''}</div>
              </div>
              <label className="shrink-0 cursor-pointer flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 transition bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-700 rounded-lg px-3 py-1.5">
                {uploadandoFoto === colSelecionado.id ? <RefreshCw size={13} className="animate-spin" /> : <Upload size={13} />}
                Foto
                <input type="file" accept="image/*" className="hidden" onChange={e => handleFoto(e, colSelecionado.funcionario?.id, colSelecionado.id)} />
              </label>
            </div>

            {/* Abas */}
            {(() => {
              const abas = ['Pessoal', 'Endereço', 'Saúde & Perfil', 'Ponto'];
              return (
                <div className="flex border-b dark:border-slate-700 -mx-1 overflow-x-auto">
                  {abas.map((aba, i) => (
                    <button key={aba} onClick={() => setAbaEdicao(i)}
                      className={`px-4 py-2 text-sm font-bold whitespace-nowrap border-b-2 transition ${abaEdicao === i ? 'border-purple-600 text-purple-600 dark:text-purple-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >{aba}</button>
                  ))}
                </div>
              );
            })()}

            {/* Aba 0: Pessoal */}
            {abaEdicao === 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><FL label="Nome Completo *"><input type="text" value={formFunc.nome || ''} onChange={e => setFormFunc((f: any) => ({ ...f, nome: e.target.value }))} className={ic} /></FL></div>
                <FL label="Cargo / Função"><input type="text" value={formFunc.cargo || ''} onChange={e => setFormFunc((f: any) => ({ ...f, cargo: e.target.value }))} className={ic} /></FL>
                <FL label="Email"><input type="email" value={formFunc.email || ''} onChange={e => setFormFunc((f: any) => ({ ...f, email: e.target.value }))} className={ic} /></FL>
                <FL label="CPF"><input type="text" value={formFunc.cpf || ''} onChange={e => setFormFunc((f: any) => ({ ...f, cpf: e.target.value }))} className={ic} /></FL>
                <FL label="Celular"><input type="text" value={formFunc.celular || ''} onChange={e => setFormFunc((f: any) => ({ ...f, celular: e.target.value }))} className={ic} /></FL>
                <FL label="Data de Nascimento"><input type="date" value={formFunc.data_nascimento?.slice(0, 10) || ''} onChange={e => setFormFunc((f: any) => ({ ...f, data_nascimento: e.target.value }))} className={ic} /></FL>
                <FL label="Estado Civil">
                  <select value={formFunc.estado_civil || ''} onChange={e => setFormFunc((f: any) => ({ ...f, estado_civil: e.target.value }))} className={ic}>
                    <option value="">Selecione...</option>
                    {['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Separado(a)', 'Viúvo(a)', 'União Estável'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </FL>
                <FL label="Sexo">
                  <select value={formFunc.sexo || ''} onChange={e => setFormFunc((f: any) => ({ ...f, sexo: e.target.value }))} className={ic}>
                    <option value="">Selecione...</option>
                    {['Masculino', 'Feminino', 'Outro', 'Prefiro não informar'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </FL>
                <FL label="Gênero">
                  <select value={formFunc.genero || ''} onChange={e => setFormFunc((f: any) => ({ ...f, genero: e.target.value }))} className={ic}>
                    <option value="">Selecione...</option>
                    {['Homem cisgênero','Mulher cisgênero','Homem trans','Mulher trans','Não-binário','Gênero fluido','Prefiro não informar'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </FL>
                <FL label="Raça / Cor">
                  <select value={formFunc.raca_cor || ''} onChange={e => setFormFunc((f: any) => ({ ...f, raca_cor: e.target.value }))} className={ic}>
                    <option value="">Selecione...</option>
                    {['Preta', 'Parda', 'Branca', 'Indígena', 'Amarela', 'Prefiro não informar'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </FL>
                <FL label="Escolaridade">
                  <select value={formFunc.escolaridade || ''} onChange={e => setFormFunc((f: any) => ({ ...f, escolaridade: e.target.value }))} className={ic}>
                    <option value="">Selecione...</option>
                    {['Fundamental Incompleto','Fundamental Completo','Médio Incompleto','Médio Completo','Superior Incompleto','Superior Completo','Pós-graduação'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </FL>
                <FL label="RG"><input type="text" value={formFunc.rg || ''} onChange={e => setFormFunc((f: any) => ({ ...f, rg: e.target.value }))} className={ic} /></FL>
                <FL label="Órgão Emissor RG"><input type="text" value={formFunc.orgao_emissor_rg || ''} onChange={e => setFormFunc((f: any) => ({ ...f, orgao_emissor_rg: e.target.value }))} className={ic} /></FL>
                <FL label="Data de Emissão RG"><input type="date" value={formFunc.data_emissao_rg?.slice(0, 10) || ''} onChange={e => setFormFunc((f: any) => ({ ...f, data_emissao_rg: e.target.value }))} className={ic} /></FL>
              </div>
            )}

            {/* Aba 1: Endereço */}
            {abaEdicao === 1 && (
              <div className="space-y-3">
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
                <p className="text-xs font-bold text-orange-400 uppercase tracking-widest pt-2">Contato de Emergência</p>
                <div className="grid grid-cols-2 gap-3">
                  <FL label="Tel. Emergência 1"><input type="text" value={formFunc.telefone_emergencia_1 || ''} onChange={e => setFormFunc((f: any) => ({ ...f, telefone_emergencia_1: e.target.value }))} className={ic} /></FL>
                  <FL label="Tel. Emergência 2"><input type="text" value={formFunc.telefone_emergencia_2 || ''} onChange={e => setFormFunc((f: any) => ({ ...f, telefone_emergencia_2: e.target.value }))} className={ic} /></FL>
                </div>
              </div>
            )}

            {/* Aba 2: Saúde & Perfil */}
            {abaEdicao === 2 && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">Saúde</p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formFunc.possui_deficiencia} onChange={e => setFormFunc((f: any) => ({ ...f, possui_deficiencia: e.target.checked }))} className="w-4 h-4" />Possui algum tipo de deficiência?</label>
                    {formFunc.possui_deficiencia && <FL label="Qual(is)?"><input type="text" value={formFunc.deficiencia_descricao || ''} onChange={e => setFormFunc((f: any) => ({ ...f, deficiencia_descricao: e.target.value }))} className={ic} /></FL>}
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formFunc.possui_alergias} onChange={e => setFormFunc((f: any) => ({ ...f, possui_alergias: e.target.checked }))} className="w-4 h-4" />Possui alergias?</label>
                    {formFunc.possui_alergias && <FL label="Qual(is)?"><input type="text" value={formFunc.alergias_descricao || ''} onChange={e => setFormFunc((f: any) => ({ ...f, alergias_descricao: e.target.value }))} className={ic} /></FL>}
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formFunc.usa_medicamentos} onChange={e => setFormFunc((f: any) => ({ ...f, usa_medicamentos: e.target.checked }))} className="w-4 h-4" />Uso contínuo de medicamento?</label>
                    {formFunc.usa_medicamentos && <FL label="Quais? (nome e dosagem)"><input type="text" value={formFunc.medicamentos_descricao || ''} onChange={e => setFormFunc((f: any) => ({ ...f, medicamentos_descricao: e.target.value }))} className={ic} /></FL>}
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formFunc.possui_plano_saude} onChange={e => setFormFunc((f: any) => ({ ...f, possui_plano_saude: e.target.checked }))} className="w-4 h-4" />Possui plano de saúde?</label>
                    {formFunc.possui_plano_saude && (
                      <div className="grid grid-cols-2 gap-3">
                        <FL label="Plano de Saúde"><input type="text" value={formFunc.plano_saude || ''} onChange={e => setFormFunc((f: any) => ({ ...f, plano_saude: e.target.value }))} className={ic} /></FL>
                        <FL label="Nº SUS"><input type="text" value={formFunc.numero_sus || ''} onChange={e => setFormFunc((f: any) => ({ ...f, numero_sus: e.target.value }))} className={ic} /></FL>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-2">Perfil Social</p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formFunc.interesse_cursos} onChange={e => setFormFunc((f: any) => ({ ...f, interesse_cursos: e.target.checked }))} className="w-4 h-4" />Interesse em cursos do ITP?</label>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formFunc.pertence_comunidade_tradicional} onChange={e => setFormFunc((f: any) => ({ ...f, pertence_comunidade_tradicional: e.target.checked }))} className="w-4 h-4" />Pertence a comunidade tradicional?</label>
                    {formFunc.pertence_comunidade_tradicional && <FL label="Qual comunidade?"><input type="text" value={formFunc.comunidade_tradicional || ''} onChange={e => setFormFunc((f: any) => ({ ...f, comunidade_tradicional: e.target.value }))} className={ic} /></FL>}
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formFunc.possui_cad_unico} onChange={e => setFormFunc((f: any) => ({ ...f, possui_cad_unico: e.target.checked }))} className="w-4 h-4" />Possui CadÚnico?</label>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!formFunc.baixo_idh} onChange={e => setFormFunc((f: any) => ({ ...f, baixo_idh: e.target.checked }))} className="w-4 h-4" />Área de baixo IDH?</label>
                  </div>
                </div>
              </div>
            )}

            {/* Aba 3: Ponto */}
            {abaEdicao === 3 && (
              <div>{formHorarioJSX}</div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t dark:border-slate-700">
              <button onClick={() => setModal(null)} className={bs}>Cancelar</button>
              <button onClick={salvarEdicaoCompleta} disabled={salvando} className={bp}>{salvando ? 'Salvando...' : 'Salvar Tudo'}</button>
            </div>
          </div>
        </Modal>
      )}

      {docModalColaborador && (
        <DocumentosModal
          colaboradorId={docModalColaborador.id}
          colaboradorNome={docModalColaborador.nome}
          onClose={() => setDocModalColaborador(null)}
        />
      )}
    </div>
  );
}

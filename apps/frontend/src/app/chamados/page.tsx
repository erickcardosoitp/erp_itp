'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus, Trash2, X, Edit3, User, FileImage,
  Star, BookOpen, Lightbulb, Tag, NotebookPen,
} from 'lucide-react';
import api from '@/services/api';
import { useAuth } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { toast } from 'sonner';
import { ChamadosHeader } from './components/ChamadosHeader';
import { ChamadosTable } from './components/ChamadosTable';
import { ChamadosKanban } from './components/ChamadosKanban';
import type {
  Chamado, Acompanhamento, Aluno, Turma, Responsavel, Fila, Conhecimento, Stats,
} from './components/_shared';
import {
  COR_STATUS, LABEL_STATUS, LABEL_PRIO, TIPOS_CHAMADO, STATUS_CHAMADO,
  PRIO_CHAMADO, EQUIPES, ROLE_LABEL, isSLACritical, isMeuChamado,
} from './components/_shared';

// ─── Rich Text Editor ─────────────────────────────────────────────────────────

function ToolBtn({ onClick, title, children }: { onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={title}
      className="w-7 h-7 rounded hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors text-slate-600 dark:text-slate-300 shrink-0">
      {children}
    </button>
  );
}

function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const ready = useRef(false);

  useEffect(() => {
    if (editorRef.current && !ready.current) {
      editorRef.current.innerHTML = value || '';
      ready.current = true;
    }
  }, [value]);

  const exec = (cmd: string, val?: string) => { editorRef.current?.focus(); document.execCommand(cmd, false, val); };

  const insertImg = (file: File) => {
    const reader = new FileReader();
    reader.onload = ev => {
      exec('insertHTML', `<img src="${ev.target?.result as string}" style="max-width:100%;border-radius:8px;margin:6px 0;display:block;" />`);
      onChange(editorRef.current?.innerHTML ?? '');
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex-wrap">
        <ToolBtn onClick={() => exec('bold')} title="Negrito"><span className="font-black text-sm leading-none">B</span></ToolBtn>
        <ToolBtn onClick={() => exec('italic')} title="Itálico"><span className="italic text-sm leading-none">I</span></ToolBtn>
        <ToolBtn onClick={() => exec('underline')} title="Sublinhado"><span className="underline text-sm leading-none">U</span></ToolBtn>
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-1" />
        <ToolBtn onClick={() => exec('insertUnorderedList')} title="Lista"><span className="text-sm leading-none">•≡</span></ToolBtn>
        <ToolBtn onClick={() => exec('insertOrderedList')} title="Numerada"><span className="text-[10px] leading-none">1.</span></ToolBtn>
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-1" />
        <label className="w-7 h-7 rounded hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center cursor-pointer text-slate-500 transition-colors shrink-0" title="Inserir imagem">
          <FileImage size={13} />
          <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) insertImg(f); e.target.value = ''; }} />
        </label>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onPaste={e => {
          const imgItem = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'));
          if (imgItem) { e.preventDefault(); const f = imgItem.getAsFile(); if (f) insertImg(f); }
        }}
        onInput={() => onChange(editorRef.current?.innerHTML ?? '')}
        className="min-h-[200px] p-4 text-sm focus:outline-none dark:text-slate-100 dark:bg-slate-900
          [&_strong]:font-bold [&_em]:italic [&_u]:underline
          [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2
          [&_li]:mb-0.5 [&_p]:mb-1 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-2"
      />
    </div>
  );
}

// ─── Acompanhamento Modal ──────────────────────────────────────────────────────

function AcompModal({ chamado, onClose, onAdded }: { chamado: Chamado; onClose: () => void; onAdded: () => void }) {
  const [entries, setEntries] = useState<Acompanhamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoHtml, setNovoHtml] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get(`/chamados/${chamado.id}/acompanhamentos`)
      .then(r => setEntries(r.data ?? []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [chamado.id]);

  const publicar = async () => {
    if (!novoHtml.trim() || novoHtml === '<br>') return;
    setPublishing(true);
    try {
      const r = await api.post(`/chamados/${chamado.id}/acompanhamentos`, { conteudo: novoHtml });
      setEntries(prev => [...prev, r.data]);
      setNovoHtml('');
      onAdded();
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch { toast.error('Erro ao publicar acompanhamento.'); }
    setPublishing(false);
  };

  const deletar = async (id: string) => {
    if (!confirm('Excluir este acompanhamento?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/chamados/acompanhamentos/${id}`);
      setEntries(prev => prev.filter(e => e.id !== id));
      onAdded();
    } catch { toast.error('Erro ao excluir.'); }
    setDeletingId(null);
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-3xl h-[92vh] sm:max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="min-w-0 flex-1 pr-3">
            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${COR_STATUS[chamado.status] ?? ''}`}>{LABEL_STATUS[chamado.status] ?? chamado.status}</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase">{chamado.tipo}</span>
              <span className={`text-[9px] font-black ${chamado.prioridade === 'urgente' ? 'text-red-500' : chamado.prioridade === 'alta' ? 'text-orange-500' : 'text-slate-400'}`}>· {LABEL_PRIO[chamado.prioridade]}</span>
            </div>
            <h3 className="font-black text-sm text-slate-800 dark:text-slate-100">{chamado.titulo}</h3>
            {chamado.aluno_nome && <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1"><User size={9} />{chamado.aluno_nome}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-black text-purple-600 bg-purple-50 dark:bg-purple-950 px-2 py-0.5 rounded-full flex items-center gap-1">
              <NotebookPen size={9} />{entries.length}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"><X size={15} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading ? (
            <p className="text-center text-xs text-slate-400 py-8">Carregando...</p>
          ) : entries.length === 0 ? (
            <div className="text-center py-10">
              <NotebookPen size={20} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-400">Nenhum acompanhamento.</p>
            </div>
          ) : (
            entries.map((e, i) => (
              <div key={e.id} className="flex gap-3">
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-[10px] font-black text-purple-600 dark:text-purple-300">{(e.autor_nome?.[0] ?? '?').toUpperCase()}</div>
                  {i < entries.length - 1 && <div className="w-px flex-1 bg-slate-100 dark:bg-slate-800 mt-1" />}
                </div>
                <div className="flex-1 min-w-0 pb-2">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div>
                      <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">{e.autor_nome || 'Responsável'}</span>
                      <span className="text-[10px] text-slate-400 ml-2">{new Date(e.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <button onClick={() => deletar(e.id)} disabled={deletingId === e.id} className="p-1 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 disabled:opacity-40"><Trash2 size={11} /></button>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-700 dark:text-slate-200
                    [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_img]:max-w-full [&_img]:rounded-xl [&_img]:my-2"
                    dangerouslySetInnerHTML={{ __html: e.conteudo }} />
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-slate-100 dark:border-slate-800 px-5 pt-3 pb-4 shrink-0 space-y-2">
          <p className="text-[10px] font-black uppercase text-slate-400">Novo acompanhamento</p>
          <RichTextEditor key={`new-${entries.length}`} value="" onChange={setNovoHtml} />
          <div className="flex justify-end">
            <button onClick={publicar} disabled={publishing}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60">
              {publishing ? 'Publicando...' : <><Plus size={11} /> Publicar</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Satisfação Modal ─────────────────────────────────────────────────────────

function SatisfacaoModal({ chamado, onClose, onSaved }: { chamado: Chamado; onClose: () => void; onSaved: () => void }) {
  const [nota, setNota] = useState(0);
  const [saving, setSaving] = useState(false);
  const LABELS = ['', 'Muito insatisfeito', 'Insatisfeito', 'Regular', 'Satisfeito', 'Muito satisfeito'];

  const salvar = async () => {
    if (!nota) return;
    setSaving(true);
    try { await api.patch(`/chamados/${chamado.id}/satisfacao`, { nota }); toast.success('Avaliação registrada!'); onSaved(); onClose(); }
    catch { toast.error('Erro ao registrar.'); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm p-6">
        <div className="text-center mb-5">
          <Star size={22} className="text-yellow-500 mx-auto mb-2" />
          <h3 className="font-black text-sm text-slate-800 dark:text-slate-100 uppercase tracking-tight">Avaliar Atendimento</h3>
          <p className="text-xs text-slate-400 mt-1 line-clamp-1">"{chamado.titulo}"</p>
        </div>
        <div className="flex justify-center gap-2 mb-2">
          {[1,2,3,4,5].map(s => (
            <button key={s} onClick={() => setNota(s)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${nota >= s ? 'bg-yellow-400 text-white scale-110 shadow' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-yellow-100'}`}>
              <Star size={18} fill={nota >= s ? 'currentColor' : 'none'} />
            </button>
          ))}
        </div>
        {nota > 0 && <p className="text-center text-[11px] font-black text-yellow-600 mb-4">{LABELS[nota]}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 px-3 py-2 text-xs font-black rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500">Pular</button>
          <button onClick={salvar} disabled={!nota || saving} className="flex-1 px-3 py-2 text-xs font-black rounded-xl bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Avaliar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Base de Conhecimento Panel ───────────────────────────────────────────────

function BaseConhecimentoPanel({ onClose, canWrite }: { onClose: () => void; canWrite: boolean }) {
  const { user } = useAuth();
  const [artigos, setArtigos] = useState<Conhecimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [artigoAberto, setArtigoAberto] = useState<Conhecimento | null>(null);
  const [editando, setEditando] = useState<Conhecimento | null>(null);
  const [form, setForm] = useState({ titulo: '', conteudo: '', categoria: '' });
  const [salvando, setSalvando] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const carregar = useCallback(async (q?: string) => {
    setLoading(true);
    try { const r = await api.get('/chamados/conhecimento', q ? { params: { q } } : {}); setArtigos(r.data ?? []); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const buscarDebounced = useMemo(() => {
    let t: ReturnType<typeof setTimeout>;
    return (v: string) => { clearTimeout(t); t = setTimeout(() => carregar(v || undefined), 350); };
  }, [carregar]);

  const salvar = async () => {
    if (!form.titulo.trim() || !form.conteudo.trim()) { toast.error('Título e conteúdo obrigatórios.'); return; }
    setSalvando(true);
    try {
      if (editando) { await api.patch(`/chamados/conhecimento/${editando.id}`, form); toast.success('Artigo atualizado.'); }
      else { await api.post('/chamados/conhecimento', form); toast.success('Artigo criado.'); }
      setShowForm(false); setEditando(null); setForm({ titulo: '', conteudo: '', categoria: '' }); carregar();
    } catch { toast.error('Erro ao salvar.'); }
    setSalvando(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex justify-end" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg h-full shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2"><BookOpen size={16} className="text-purple-600" /><h3 className="font-black text-sm text-slate-800 dark:text-slate-100">Base de Conhecimento</h3></div>
          <div className="flex items-center gap-2">
            {canWrite && !showForm && (
              <button onClick={() => { setShowForm(true); setEditando(null); setForm({ titulo: '', conteudo: '', categoria: '' }); }}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-black rounded bg-purple-600 text-white hover:bg-purple-700">
                <Plus size={11} /> Novo
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"><X size={15} /></button>
          </div>
        </div>
        {showForm ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <p className="text-[10px] font-black uppercase text-slate-400">{editando ? 'Editar' : 'Novo Artigo'}</p>
            <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Título *"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 dark:bg-slate-800 dark:text-slate-100" />
            <input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Categoria"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 dark:bg-slate-800 dark:text-slate-100" />
            <textarea value={form.conteudo} onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))} rows={12} placeholder="Conteúdo *"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 dark:bg-slate-800 dark:text-slate-100 resize-none" />
            <div className="flex gap-2">
              <button onClick={() => { setShowForm(false); setEditando(null); }} className="flex-1 px-3 py-2 text-xs font-black rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500">Cancelar</button>
              <button onClick={salvar} disabled={salvando} className="flex-1 px-3 py-2 text-xs font-black rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60">{salvando ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        ) : artigoAberto ? (
          <div className="flex-1 overflow-y-auto p-5">
            <button onClick={() => setArtigoAberto(null)} className="text-[10px] font-black text-purple-600 mb-3">← Voltar</button>
            {artigoAberto.categoria && <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full mb-2"><Tag size={8} /> {artigoAberto.categoria}</span>}
            <h2 className="text-base font-black text-slate-800 dark:text-slate-100 mb-3">{artigoAberto.titulo}</h2>
            <pre className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 font-sans">{artigoAberto.conteudo}</pre>
            <p className="text-[10px] text-slate-400 mt-3">{artigoAberto.autor_nome && `Por ${artigoAberto.autor_nome} · `}{artigoAberto.visualizacoes} visualizações</p>
            {canWrite && (
              <div className="flex gap-2 mt-4">
                <button onClick={() => { setEditando(artigoAberto); setForm({ titulo: artigoAberto.titulo, conteudo: artigoAberto.conteudo, categoria: artigoAberto.categoria ?? '' }); setShowForm(true); setArtigoAberto(null); }}
                  className="px-3 py-1.5 text-[10px] font-black rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">Editar</button>
                <button onClick={async () => { if (!confirm('Excluir?')) return; try { await api.delete(`/chamados/conhecimento/${artigoAberto.id}`); carregar(); setArtigoAberto(null); } catch {} }}
                  className="px-3 py-1.5 text-[10px] font-black rounded bg-red-50 text-red-500">Excluir</button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <input value={busca} onChange={e => { setBusca(e.target.value); buscarDebounced(e.target.value); }} placeholder="Buscar artigos..."
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 dark:bg-slate-800 dark:text-slate-100" />
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {loading ? <p className="text-center text-xs text-slate-400 py-8">Carregando...</p>
                : artigos.length === 0 ? (
                  <div className="text-center py-10">
                    <Lightbulb size={24} className="text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">Nenhum artigo encontrado.</p>
                  </div>
                ) : artigos.map(a => (
                  <button key={a.id} onClick={() => setArtigoAberto(a)}
                    className="w-full text-left p-3 bg-slate-50 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-purple-200 transition-colors">
                    {a.categoria && <span className="text-[9px] font-black uppercase text-purple-500 block mb-0.5">{a.categoria}</span>}
                    <p className="text-xs font-black text-slate-700 dark:text-slate-200 line-clamp-1">{a.titulo}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{a.conteudo.slice(0, 120)}</p>
                  </button>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChamadosPage() {
  const { user } = useAuth();
  const { canWrite } = usePermissions(user);

  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [loading, setLoading] = useState(true);

  // View & filters
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroPrioridade, setFiltroPrioridade] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroMeus, setFiltroMeus] = useState(false);
  const [filtroSLA, setFiltroSLA] = useState(false);
  const [filtroSite, setFiltroSite] = useState(false);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Chamado | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [acampChamado, setAcampChamado] = useState<Chamado | null>(null);
  const [satisfacaoChamado, setSatisfacaoChamado] = useState<Chamado | null>(null);
  const [showKB, setShowKB] = useState(false);

  // Form
  const [alunoSearch, setAlunoSearch] = useState('');
  const [todoInstituto, setTodoInstituto] = useState(false);
  const [modoResponsavel, setModoResponsavel] = useState<'usuario' | 'equipe'>('usuario');
  const [form, setForm] = useState({
    titulo: '', descricao: '', tipo: 'Social', prioridade: 'normal', status: 'aberto',
    aluno_id: '', aluno_nome: '', turma_id: '', turma_nome: '',
    responsavel_nome: '', observacoes: '', fila_nome: '',
  });

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filtroStatus) params.status = filtroStatus;
      if (filtroTipo) params.tipo = filtroTipo;
      if (filtroPrioridade) params.prioridade = filtroPrioridade;
      const [rc, rs] = await Promise.all([
        api.get('/chamados', { params }),
        api.get('/chamados/stats'),
      ]);
      setChamados(rc.data);
      setStats(rs.data);
    } catch { toast.error('Erro ao carregar chamados.'); }
    setLoading(false);
  }, [filtroStatus, filtroTipo, filtroPrioridade]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    Promise.all([
      api.get('/academico/alunos').catch(() => ({ data: [] })),
      api.get('/academico/turmas').catch(() => ({ data: [] })),
      api.get('/chamados/responsaveis').catch(() => ({ data: [] })),
      api.get('/chamados/filas').catch(() => ({ data: [] })),
    ]).then(([ra, rt, rr, rf]) => {
      setAlunos(ra.data ?? []); setTurmas(rt.data ?? []);
      setResponsaveis(rr.data ?? []); setFilas(rf.data ?? []);
    });
  }, []);

  const alunosFiltrados = useMemo(() => {
    if (!alunoSearch.trim()) return alunos.slice(0, 8);
    const s = alunoSearch.toLowerCase();
    return alunos.filter(a => a.nome_completo.toLowerCase().includes(s)).slice(0, 8);
  }, [alunoSearch, alunos]);

  const chamadosFiltrados = useMemo(() => {
    let list = chamados;
    if (busca.trim()) {
      const s = busca.toLowerCase();
      list = list.filter(c =>
        c.titulo.toLowerCase().includes(s) ||
        (c.aluno_nome ?? '').toLowerCase().includes(s) ||
        (c.responsavel_nome ?? '').toLowerCase().includes(s) ||
        (c.protocolo ?? '').toLowerCase().includes(s)
      );
    }
    if (filtroMeus) list = list.filter(c => isMeuChamado(c, user?.nome || user?.email));
    if (filtroSLA) list = list.filter(isSLACritical);
    if (filtroSite) list = list.filter(c => c.origem === 'site');
    return list;
  }, [chamados, busca, filtroMeus, filtroSLA, filtroSite, user]);

  const upd = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  function abrirNovo() {
    setEditando(null); setAlunoSearch(''); setTodoInstituto(false); setModoResponsavel('usuario');
    setForm({ titulo: '', descricao: '', tipo: 'Social', prioridade: 'normal', status: 'aberto', aluno_id: '', aluno_nome: '', turma_id: '', turma_nome: '', responsavel_nome: '', observacoes: '', fila_nome: '' });
    setShowModal(true);
  }

  function abrirEditar(c: Chamado) {
    setEditando(c); setAlunoSearch(c.aluno_nome ?? ''); setTodoInstituto(c.aluno_nome === 'Todo o Instituto'); setModoResponsavel('usuario');
    setForm({ titulo: c.titulo, descricao: c.descricao ?? '', tipo: c.tipo, prioridade: c.prioridade, status: c.status, aluno_id: c.aluno_id ?? '', aluno_nome: c.aluno_nome ?? '', turma_id: c.turma_id ?? '', turma_nome: c.turma_nome ?? '', responsavel_nome: c.responsavel_nome ?? '', observacoes: c.observacoes ?? '', fila_nome: c.fila_nome ?? '' });
    setShowModal(true);
  }

  async function salvar() {
    if (!form.titulo.trim()) { toast.error('Título é obrigatório.'); return; }
    setSalvando(true);
    try {
      const payload = { ...form, aluno_id: form.aluno_id || null, turma_id: form.turma_id || null, aluno_nome: todoInstituto ? 'Todo o Instituto' : (form.aluno_nome || null), criado_por_nome: editando ? undefined : (user?.nome || user?.email) };
      if (editando) await api.patch(`/chamados/${editando.id}`, payload);
      else await api.post('/chamados', payload);
      toast.success(editando ? 'Chamado atualizado.' : 'Chamado criado.');
      setShowModal(false); carregar();
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Erro ao salvar.'); }
    setSalvando(false);
  }

  async function mudarStatus(id: string, status: string, chamado?: Chamado) {
    try {
      await api.patch(`/chamados/${id}`, { status });
      await carregar();
      if (status === 'resolvido' && chamado) setSatisfacaoChamado(chamado);
    } catch {}
  }

  async function deletar(id: string) {
    if (!confirm('Excluir este chamado?')) return;
    try { await api.delete(`/chamados/${id}`); carregar(); } catch {}
  }

  const tableKanbanProps = {
    chamados: chamadosFiltrados,
    canWrite,
    onAtender: (id: string) => mudarStatus(id, 'em_andamento'),
    onResolver: (c: Chamado) => mudarStatus(c.id, 'resolvido', c),
    onAcomp: (c: Chamado) => setAcampChamado(c),
    onEditar: abrirEditar,
    onDeletar: deletar,
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-6xl mx-auto px-4 md:px-6">

        {/* Title + stats strip */}
        <div className="flex items-center justify-between pt-6 pb-1 gap-4">
          <div>
            <h1 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">Chamados</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Registro e acompanhamento de ocorrências</p>
          </div>
          {stats && (
            <div className="hidden sm:flex items-center gap-6 shrink-0">
              {[
                { label: 'Abertos', val: stats.abertos, cls: 'text-blue-600', onClick: () => setFiltroStatus('aberto') },
                { label: 'Em atend.', val: stats.em_andamento, cls: 'text-amber-600', onClick: () => setFiltroStatus('em_andamento') },
                { label: 'Resolvidos', val: stats.resolvidos, cls: 'text-emerald-600', onClick: () => setFiltroStatus('resolvido') },
                { label: 'Urgentes', val: stats.urgentes, cls: 'text-red-600', onClick: () => setFiltroPrioridade(filtroPrioridade === 'urgente' ? '' : 'urgente') },
              ].map(s => (
                <button key={s.label} onClick={s.onClick} className="text-center hover:opacity-70 transition-opacity">
                  <p className={`text-xl font-black leading-none ${s.cls}`}>{s.val}</p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">{s.label}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sticky filter header */}
        <ChamadosHeader
          stats={stats}
          busca={busca} onBusca={setBusca}
          filtroStatus={filtroStatus} onFiltroStatus={setFiltroStatus}
          filtroPrioridade={filtroPrioridade} onFiltroPrioridade={setFiltroPrioridade}
          filtroTipo={filtroTipo} onFiltroTipo={setFiltroTipo}
          filtroMeus={filtroMeus} onFiltroMeus={setFiltroMeus}
          filtroSLA={filtroSLA} onFiltroSLA={setFiltroSLA}
          filtroSite={filtroSite} onFiltroSite={setFiltroSite}
          view={view} onView={setView}
          onNovo={abrirNovo} onKB={() => setShowKB(true)}
        />

        {/* Content */}
        <div className="py-5">
          {loading ? (
            <div className="text-center py-16 text-sm text-slate-400">Carregando...</div>
          ) : view === 'table' ? (
            <ChamadosTable {...tableKanbanProps} />
          ) : (
            <ChamadosKanban {...tableKanbanProps} />
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-5 border-b shrink-0">
              <h3 className="font-black text-sm uppercase tracking-tight text-slate-800 dark:text-slate-100">{editando ? 'Editar Chamado' : 'Novo Chamado'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Título */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500">Título *</label>
                <input value={form.titulo} onChange={e => upd('titulo', e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 dark:bg-slate-800 dark:text-slate-100" />
              </div>
              {/* Tipo + Prioridade */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Tipo</label>
                  <select value={form.tipo} onChange={e => upd('tipo', e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white dark:bg-slate-800 dark:text-slate-100">
                    {TIPOS_CHAMADO.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Prioridade</label>
                  <select value={form.prioridade} onChange={e => upd('prioridade', e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white dark:bg-slate-800 dark:text-slate-100">
                    {PRIO_CHAMADO.map(p => <option key={p} value={p}>{LABEL_PRIO[p]}</option>)}
                  </select>
                </div>
              </div>
              {/* Status (edit only) */}
              {editando && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Status</label>
                  <select value={form.status} onChange={e => upd('status', e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white dark:bg-slate-800 dark:text-slate-100">
                    {STATUS_CHAMADO.map(s => <option key={s} value={s}>{LABEL_STATUS[s]}</option>)}
                  </select>
                </div>
              )}
              {/* Aluno */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase text-slate-500">Aluno / Destinatário</label>
                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-purple-600 cursor-pointer">
                    <input type="checkbox" checked={todoInstituto} onChange={e => { setTodoInstituto(e.target.checked); if (e.target.checked) { upd('aluno_id', ''); upd('aluno_nome', 'Todo o Instituto'); setAlunoSearch(''); } else { upd('aluno_nome', ''); } }} className="accent-purple-600" />
                    Todo o Instituto
                  </label>
                </div>
                {!todoInstituto && (
                  <>
                    <input value={alunoSearch} onChange={e => setAlunoSearch(e.target.value)} placeholder="Buscar aluno..."
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 dark:bg-slate-800 dark:text-slate-100" />
                    {alunoSearch.trim() && (
                      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                        {alunosFiltrados.map(a => (
                          <button key={a.id} onClick={() => { const turma = turmas.find(t => a.turmas?.some((ta: any) => ta.id === t.id)); upd('aluno_id', a.id); upd('aluno_nome', a.nome_completo); if (turma) { upd('turma_id', turma.id); upd('turma_nome', turma.nome); } setAlunoSearch(a.nome_completo); }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-purple-50 dark:hover:bg-purple-950 border-b border-slate-100 dark:border-slate-700 last:border-0 dark:text-slate-200">
                            <span className="font-bold">{a.nome_completo}</span>
                            {a.turma_nome && <span className="text-slate-400 ml-2">· {a.turma_nome}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              {/* Fila */}
              {filas.length > 0 && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Fila de Atendimento</label>
                  <select value={form.fila_nome} onChange={e => upd('fila_nome', e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white dark:bg-slate-800 dark:text-slate-100">
                    <option value="">Sem fila específica</option>
                    {filas.map(f => <option key={f.id} value={f.nome}>{f.nome} (SLA: {f.sla_horas_resolucao}h)</option>)}
                  </select>
                </div>
              )}
              {/* Responsável */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase text-slate-500">Responsável</label>
                  <div className="flex gap-1">
                    {(['usuario', 'equipe'] as const).map(m => (
                      <button key={m} onClick={() => setModoResponsavel(m)}
                        className={`text-[9px] font-black px-2 py-0.5 rounded-full transition-colors ${modoResponsavel === m ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                        {m === 'usuario' ? 'Usuário' : 'Equipe'}
                      </button>
                    ))}
                  </div>
                </div>
                {modoResponsavel === 'usuario' ? (
                  <select value={form.responsavel_nome} onChange={e => upd('responsavel_nome', e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white dark:bg-slate-800 dark:text-slate-100">
                    <option value="">Selecione...</option>
                    {responsaveis.map(r => <option key={r.id} value={r.nome}>{r.nome} — {ROLE_LABEL[r.role] ?? r.role}</option>)}
                  </select>
                ) : (
                  <select value={form.responsavel_nome} onChange={e => upd('responsavel_nome', e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white dark:bg-slate-800 dark:text-slate-100">
                    <option value="">Selecione...</option>
                    {EQUIPES.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                  </select>
                )}
              </div>
              {/* Descrição + Observações */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500">Descrição</label>
                <textarea value={form.descricao} onChange={e => upd('descricao', e.target.value)} rows={3}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 dark:bg-slate-800 dark:text-slate-100 resize-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500">Observações</label>
                <textarea value={form.observacoes} onChange={e => upd('observacoes', e.target.value)} rows={3}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 dark:bg-slate-800 dark:text-slate-100 resize-none" />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-black rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-300">Cancelar</button>
                <button onClick={salvar} disabled={salvando || !form.titulo.trim()} className="px-4 py-2 text-xs font-black rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60">
                  {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Criar Chamado'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {acampChamado && <AcompModal key={acampChamado.id} chamado={acampChamado} onClose={() => setAcampChamado(null)} onAdded={carregar} />}
      {satisfacaoChamado && <SatisfacaoModal chamado={satisfacaoChamado} onClose={() => setSatisfacaoChamado(null)} onSaved={carregar} />}
      {showKB && <BaseConhecimentoPanel onClose={() => setShowKB(false)} canWrite={canWrite} />}
    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Edit3, Trash2, CheckCircle, Clock, User, Users,
  Tag, Globe, Star, NotebookPen, Plus, FileImage, AlertTriangle,
} from 'lucide-react';
import api from '@/services/api';
import { useAuth } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { toast } from 'sonner';
import type { Chamado, Acompanhamento, Fila, Responsavel } from '../components/_shared';
import {
  COR_STATUS, PRIO_BORDER, PRIO_TEXT, PRIO_STRIP_BG, LABEL_STATUS, LABEL_PRIO,
  TIPOS_CHAMADO, PRIO_CHAMADO, STATUS_CHAMADO, EQUIPES, ROLE_LABEL,
  getSLAState, getSLATextClass, fmtRelative,
} from '../components/_shared';

// ─── Rich Text Editor ─────────────────────────────────────────────────────────

function RTE({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const ready = useRef(false);
  useEffect(() => {
    if (ref.current && !ready.current) { ref.current.innerHTML = value || ''; ready.current = true; }
  }, [value]);
  const exec = (cmd: string) => { ref.current?.focus(); document.execCommand(cmd, false, undefined); };
  const insertImg = (file: File) => {
    const reader = new FileReader();
    reader.onload = ev => { ref.current?.focus(); document.execCommand('insertHTML', false, `<img src="${ev.target?.result}" style="max-width:100%;border-radius:8px;margin:4px 0;display:block;" />`); onChange(ref.current?.innerHTML ?? ''); };
    reader.readAsDataURL(file);
  };
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
        {[['bold','B'],['italic','I'],['underline','U']].map(([cmd, label]) => (
          <button key={cmd} type="button" onClick={() => exec(cmd)}
            className="w-7 h-7 rounded hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-300">
            {cmd === 'italic' ? <span className="italic">{label}</span> : cmd === 'underline' ? <span className="underline">{label}</span> : label}
          </button>
        ))}
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-1" />
        <button type="button" onClick={() => exec('insertUnorderedList')} className="w-7 h-7 rounded hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-xs text-slate-600 dark:text-slate-300">•≡</button>
        <label className="w-7 h-7 rounded hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center cursor-pointer text-slate-500">
          <FileImage size={13} />
          <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) insertImg(f); e.target.value = ''; }} />
        </label>
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML ?? '')}
        onPaste={e => { const img = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/')); if (img) { e.preventDefault(); const f = img.getAsFile(); if (f) insertImg(f); } }}
        className="min-h-[120px] p-4 text-sm focus:outline-none dark:text-slate-100 dark:bg-slate-900
          [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_ul]:list-disc [&_ul]:pl-5
          [&_img]:max-w-full [&_img]:rounded-xl [&_img]:my-2" />
    </div>
  );
}

// ─── SLA Bar ─────────────────────────────────────────────────────────────────

function SLASection({ chamado }: { chamado: Chamado }) {
  const { pct, colorClass, label } = getSLAState(chamado);
  const textClass = getSLATextClass(colorClass);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">SLA</span>
        <span className={`text-sm font-black ${textClass}`}>{label}</span>
      </div>
      <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${colorClass} transition-all rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      {pct >= 100 && chamado.status !== 'resolvido' && (
        <div className="flex items-center gap-1.5 text-xs text-red-500">
          <AlertTriangle size={12} />SLA expirado
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChamadoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { canWrite } = usePermissions(user);
  const id = params?.id as string;

  const [chamado, setChamado] = useState<Chamado | null>(null);
  const [acomps, setAcomps] = useState<Acompanhamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);

  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState<Partial<Chamado>>({});

  const [novoHtml, setNovoHtml] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [deletingAcompId, setDeletingAcompId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    try {
      const [rc, ra] = await Promise.all([
        api.get(`/chamados/${id}`),
        api.get(`/chamados/${id}/acompanhamentos`),
      ]);
      setChamado(rc.data);
      setAcomps(ra.data ?? []);
    } catch { toast.error('Chamado não encontrado.'); router.push('/chamados'); }
    setLoading(false);
  }, [id, router]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    Promise.all([
      api.get('/chamados/filas').catch(() => ({ data: [] })),
      api.get('/chamados/responsaveis').catch(() => ({ data: [] })),
    ]).then(([rf, rr]) => { setFilas(rf.data ?? []); setResponsaveis(rr.data ?? []); });
  }, []);

  const salvar = async () => {
    if (!form.titulo?.trim()) { toast.error('Título obrigatório.'); return; }
    setSalvando(true);
    try {
      await api.patch(`/chamados/${id}`, form);
      toast.success('Chamado atualizado.');
      setEditando(false);
      carregar();
    } catch { toast.error('Erro ao salvar.'); }
    setSalvando(false);
  };

  const mudarStatus = async (status: string) => {
    try { await api.patch(`/chamados/${id}`, { status }); carregar(); } catch {}
  };

  const deletar = async () => {
    if (!confirm('Excluir este chamado? Esta ação não pode ser desfeita.')) return;
    try { await api.delete(`/chamados/${id}`); toast.success('Chamado excluído.'); router.push('/chamados'); } catch {}
  };

  const publicar = async () => {
    if (!novoHtml.trim() || novoHtml === '<br>') return;
    setPublishing(true);
    try {
      const r = await api.post(`/chamados/${id}/acompanhamentos`, { conteudo: novoHtml });
      setAcomps(prev => [...prev, r.data]);
      setNovoHtml('');
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch { toast.error('Erro ao publicar.'); }
    setPublishing(false);
  };

  const deletarAcomp = async (aid: string) => {
    if (!confirm('Excluir este acompanhamento?')) return;
    setDeletingAcompId(aid);
    try { await api.delete(`/chamados/acompanhamentos/${aid}`); setAcomps(prev => prev.filter(e => e.id !== aid)); }
    catch { toast.error('Erro ao excluir.'); }
    setDeletingAcompId(null);
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
      <p className="text-sm text-slate-400">Carregando...</p>
    </div>
  );

  if (!chamado) return null;

  const dataAbertura = chamado.abertura ?? chamado.created_at;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">

        {/* ── Breadcrumb / back ── */}
        <button onClick={() => router.push('/chamados')}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 mb-5 transition-colors">
          <ArrowLeft size={13} />Voltar para Chamados
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">

          {/* ── Coluna principal ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Card principal */}
            <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden`}>
              {/* Priority strip top */}
              <div className={`h-1 w-full ${PRIO_STRIP_BG[chamado.prioridade] ?? 'bg-slate-200'}`} />

              <div className="p-5">
                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  {chamado.protocolo && (
                    <span className="font-mono text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                      {chamado.protocolo}
                    </span>
                  )}
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${COR_STATUS[chamado.status] ?? ''}`}>
                    {LABEL_STATUS[chamado.status] ?? chamado.status}
                  </span>
                  <span className={`text-[10px] font-black ${PRIO_TEXT[chamado.prioridade] ?? 'text-slate-400'}`}>
                    {LABEL_PRIO[chamado.prioridade]}
                  </span>
                  {chamado.origem === 'site' && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded border text-sky-600 bg-sky-50 border-sky-200">
                      <Globe size={8} />Site
                    </span>
                  )}
                </div>

                {editando ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Título</label>
                      <input value={form.titulo ?? ''} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 dark:bg-slate-800 dark:text-slate-100" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Tipo</label>
                        <select value={form.tipo ?? ''} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                          className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white dark:bg-slate-800 dark:text-slate-100">
                          {TIPOS_CHAMADO.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Prioridade</label>
                        <select value={form.prioridade ?? ''} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))}
                          className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white dark:bg-slate-800 dark:text-slate-100">
                          {PRIO_CHAMADO.map(p => <option key={p} value={p}>{LABEL_PRIO[p]}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Status</label>
                        <select value={form.status ?? ''} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                          className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white dark:bg-slate-800 dark:text-slate-100">
                          {STATUS_CHAMADO.map(s => <option key={s} value={s}>{LABEL_STATUS[s]}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Fila</label>
                        <select value={form.fila_nome ?? ''} onChange={e => setForm(f => ({ ...f, fila_nome: e.target.value }))}
                          className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white dark:bg-slate-800 dark:text-slate-100">
                          <option value="">Sem fila</option>
                          {filas.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Responsável</label>
                      <select value={form.responsavel_nome ?? ''} onChange={e => setForm(f => ({ ...f, responsavel_nome: e.target.value }))}
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white dark:bg-slate-800 dark:text-slate-100">
                        <option value="">Sem responsável</option>
                        {responsaveis.map(r => <option key={r.id} value={r.nome}>{r.nome} — {ROLE_LABEL[r.role] ?? r.role}</option>)}
                        {EQUIPES.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Descrição</label>
                      <textarea value={form.descricao ?? ''} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={3}
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 dark:bg-slate-800 dark:text-slate-100 resize-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Observações</label>
                      <textarea value={form.observacoes ?? ''} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={3}
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 dark:bg-slate-800 dark:text-slate-100 resize-none" />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditando(false)} className="px-4 py-2 text-xs font-black rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500">Cancelar</button>
                      <button onClick={salvar} disabled={salvando} className="px-4 py-2 text-xs font-black rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60">
                        {salvando ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-1 break-words">{chamado.titulo}</h1>
                    <p className="text-sm text-slate-400">{chamado.tipo}</p>

                    {chamado.descricao && (
                      <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Descrição</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{chamado.descricao}</p>
                      </div>
                    )}

                    {chamado.observacoes && (
                      <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Observações</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{chamado.observacoes}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── Acompanhamentos ── */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5">
              <div className="flex items-center gap-2 mb-5">
                <NotebookPen size={14} className="text-purple-500" />
                <h2 className="text-sm font-black text-slate-700 dark:text-slate-200">Acompanhamentos</h2>
                {acomps.length > 0 && (
                  <span className="text-[10px] font-black text-purple-600 bg-purple-50 dark:bg-purple-950 px-2 py-0.5 rounded-full">{acomps.length}</span>
                )}
              </div>

              {acomps.length === 0 ? (
                <p className="text-sm text-slate-300 dark:text-slate-600 text-center py-6">Nenhum acompanhamento ainda.</p>
              ) : (
                <div className="space-y-5 mb-6">
                  {acomps.map((e, i) => (
                    <div key={e.id} className="flex gap-3">
                      <div className="flex flex-col items-center shrink-0">
                        <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-[11px] font-black text-purple-600 dark:text-purple-300">
                          {(e.autor_nome?.[0] ?? '?').toUpperCase()}
                        </div>
                        {i < acomps.length - 1 && <div className="w-px flex-1 bg-slate-100 dark:bg-slate-800 mt-1" />}
                      </div>
                      <div className="flex-1 min-w-0 pb-2">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div>
                            <span className="text-xs font-black text-slate-700 dark:text-slate-200">{e.autor_nome || 'Responsável'}</span>
                            <span className="text-[10px] text-slate-400 ml-2">
                              {new Date(e.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <button onClick={() => deletarAcomp(e.id)} disabled={deletingAcompId === e.id}
                            className="p-1 rounded text-slate-300 hover:text-red-400 hover:bg-red-50 disabled:opacity-40 transition-colors">
                            <Trash2 size={11} />
                          </button>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-700 dark:text-slate-200
                          [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_ul]:list-disc [&_ul]:pl-5
                          [&_img]:max-w-full [&_img]:rounded-xl [&_img]:my-2"
                          dangerouslySetInnerHTML={{ __html: e.conteudo }} />
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Novo acompanhamento</p>
                <RTE key={`new-${acomps.length}`} value="" onChange={setNovoHtml} />
                <div className="flex justify-end">
                  <button onClick={publicar} disabled={publishing}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60">
                    {publishing ? 'Publicando...' : <><Plus size={11} />Publicar</>}
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* ── Sidebar direita ── */}
          <div className="space-y-4">

            {/* SLA */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
              <SLASection chamado={chamado} />
            </div>

            {/* Ações */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">Ações</p>

              {chamado.status !== 'resolvido' && chamado.status !== 'em_andamento' && (
                <button onClick={() => mudarStatus('em_andamento')}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs font-black rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-colors">
                  <Clock size={13} />Iniciar Atendimento
                </button>
              )}
              {chamado.status !== 'resolvido' && (
                <button onClick={() => mudarStatus('resolvido')}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs font-black rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors">
                  <CheckCircle size={13} />Marcar como Resolvido
                </button>
              )}
              {chamado.status === 'resolvido' && (
                <button onClick={() => mudarStatus('aberto')}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs font-black rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  Reabrir Chamado
                </button>
              )}

              {canWrite && (
                <>
                  <button onClick={() => { setForm({ ...chamado }); setEditando(true); }}
                    className="w-full flex items-center justify-center gap-2 py-2 text-xs font-black rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <Edit3 size={13} />Editar Chamado
                  </button>
                  <button onClick={deletar}
                    className="w-full flex items-center justify-center gap-2 py-2 text-xs font-black rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                    <Trash2 size={13} />Excluir
                  </button>
                </>
              )}
            </div>

            {/* Detalhes */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Detalhes</p>

              {([
                { label: 'Tipo', value: chamado.tipo },
                { label: 'Prioridade', value: LABEL_PRIO[chamado.prioridade] },
                { label: 'Fila', value: chamado.fila_nome || null },
                { label: 'Responsável', value: chamado.responsavel_nome || null },
                { label: 'Aluno', value: chamado.aluno_nome || null },
                chamado.turma_nome ? { label: 'Turma', value: chamado.turma_nome } : null,
                { label: 'Aberto por', value: chamado.criado_por_nome || null },
                { label: 'Origem', value: chamado.origem === 'site' ? 'Site institucional' : 'Interno (ERP)' },
                { label: 'Abertura', value: new Date(dataAbertura).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) },
                { label: 'Atualização', value: new Date(chamado.updated_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) },
              ] as ({ label: string; value: string | null } | null)[]).filter(Boolean).map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-3">
                  <span className="text-[10px] text-slate-400 shrink-0">{label}</span>
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 text-right">{value ?? '—'}</span>
                </div>
              ))}

              {chamado.satisfacao && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">Avaliação</span>
                  <div className="flex items-center gap-0.5">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} size={11} className={i <= chamado.satisfacao! ? 'text-yellow-400' : 'text-slate-200'} fill={i <= chamado.satisfacao! ? 'currentColor' : 'none'} />
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

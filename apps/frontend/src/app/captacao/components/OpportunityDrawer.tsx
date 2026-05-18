'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { X, ExternalLink, Calendar, DollarSign, ChevronDown, FileText, History, Loader2, Download } from 'lucide-react';
import type { Opportunity, PipelineStatus, TemplateType } from '../types';
import { STATUS_LABELS, STATUS_COLORS, SOURCE_TYPE_LABELS, TEMPLATE_LABELS, PIPELINE_ORDER, formatBRL, formatDate } from '../constants';
import { ScoreBadge } from './ScoreBadge';
import { AiConfidenceBar } from './AiConfidenceBar';
import * as api from '../services/captacaoApi';

type Tab = 'detalhes' | 'documento' | 'pipeline';

interface Props {
  opportunityId: string | null;
  onClose: () => void;
  onStatusChange?: (id: string, status: PipelineStatus) => void;
  onDelete?: (id: string) => void;
}

export function OpportunityDrawer({ opportunityId, onClose, onStatusChange, onDelete }: Props) {
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('detalhes');
  const [notes, setNotes] = useState('');
  const [notesUpdating, setNotesUpdating] = useState(false);

  // Pipeline tab
  const [newStatus, setNewStatus] = useState<PipelineStatus>('prospeccao');
  const [statusNotes, setStatusNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Document tab
  const [templateType, setTemplateType] = useState<TemplateType>('project_summary');
  const [generating, setGenerating] = useState(false);

  // Lazy load ao abrir
  useEffect(() => {
    if (!opportunityId) { setOpportunity(null); return; }
    setLoading(true);
    setActiveTab('detalhes');
    api.getOpportunityById(opportunityId)
      .then(o => {
        setOpportunity(o);
        setNotes(o.notes ?? '');
        setNewStatus(o.status);
      })
      .catch(() => toast.error('Erro ao carregar oportunidade'))
      .finally(() => setLoading(false));
  }, [opportunityId]);

  if (!opportunityId) return null;

  const handleSaveNotes = async () => {
    if (!opportunity) return;
    setNotesUpdating(true);
    try {
      const updated = await api.updateOpportunity(opportunity.id, { notes });
      setOpportunity(updated);
      toast.success('Notas salvas');
    } catch { toast.error('Erro ao salvar notas'); }
    setNotesUpdating(false);
  };

  const handleStatusUpdate = async () => {
    if (!opportunity) return;
    setUpdatingStatus(true);
    try {
      const updated = await api.updateStatus(opportunity.id, newStatus, statusNotes || undefined);
      setOpportunity(updated);
      onStatusChange?.(opportunity.id, newStatus);
      toast.success('Status atualizado!');
      setStatusNotes('');
    } catch { toast.error('Erro ao atualizar status'); }
    setUpdatingStatus(false);
  };

  const handleGenerateDocument = async () => {
    if (!opportunity) return;
    setGenerating(true);
    try {
      const blob = await api.generateDocument(opportunity.id, templateType);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `captacao_${templateType}_${opportunity.id.slice(0, 8)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Documento gerado!');
    } catch (err: any) {
      const msg = err?.response?.status === 503 ? 'Serviço de IA indisponível. Tente novamente.' : 'Erro ao gerar documento';
      toast.error(msg);
    }
    setGenerating(false);
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'detalhes', label: 'Detalhes', icon: <FileText size={13} /> },
    { id: 'documento', label: 'Documento', icon: <Download size={13} /> },
    { id: 'pipeline', label: 'Pipeline', icon: <History size={13} /> },
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-black text-sm text-slate-800 dark:text-white truncate pr-4">
            {loading ? 'Carregando...' : opportunity?.title ?? '—'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition shrink-0">
            <X size={20} />
          </button>
        </div>

        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={32} className="animate-spin text-purple-500" />
          </div>
        )}

        {!loading && opportunity && (
          <>
            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 px-2">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-xs font-bold border-b-2 transition
                    ${activeTab === t.id
                      ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                      : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                >
                  {t.icon}{t.label}
                </button>
              ))}
            </div>

            {/* Tab: Detalhes */}
            {activeTab === 'detalhes' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Score + Confidence */}
                <div className="space-y-2">
                  {opportunity.ai_score != null && <ScoreBadge score={opportunity.ai_score} size="md" />}
                  {opportunity.ai_confidence != null && <AiConfidenceBar confidence={opportunity.ai_confidence} />}
                </div>

                {/* Meta */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400">Fonte</div>
                    <div className="font-semibold text-slate-700 dark:text-white">{SOURCE_TYPE_LABELS[opportunity.source_type]}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400">Status</div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[opportunity.status].bg} ${STATUS_COLORS[opportunity.status].text}`}>
                      {STATUS_LABELS[opportunity.status]}
                    </span>
                  </div>
                  {opportunity.entity_name && (
                    <div className="col-span-2">
                      <div className="text-[10px] font-bold uppercase text-slate-400">Organização</div>
                      <div className="font-semibold text-slate-700 dark:text-white">{opportunity.entity_name}</div>
                    </div>
                  )}
                  {opportunity.deadline && (
                    <div>
                      <div className="text-[10px] font-bold uppercase text-slate-400">Prazo</div>
                      <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-white">
                        <Calendar size={12} />{formatDate(opportunity.deadline)}
                      </div>
                    </div>
                  )}
                  {opportunity.estimated_value != null && (
                    <div>
                      <div className="text-[10px] font-bold uppercase text-slate-400">Valor estimado</div>
                      <div className="flex items-center gap-1 font-semibold text-green-600 dark:text-green-400">
                        <DollarSign size={12} />{formatBRL(opportunity.estimated_value)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Resumo */}
                {opportunity.summary && (
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Resumo</div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{opportunity.summary}</p>
                  </div>
                )}

                {/* Match reasons */}
                {opportunity.match_reasons && opportunity.match_reasons.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Por que se encaixa</div>
                    <div className="flex flex-wrap gap-1.5">
                      {opportunity.match_reasons.map((r, i) => (
                        <span key={i} className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Link */}
                {opportunity.source_url && (
                  <a href={opportunity.source_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                    <ExternalLink size={13} />Ver edital original
                  </a>
                )}

                {/* Notas editáveis */}
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Anotações</div>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Adicione notas, observações..."
                    className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-white resize-none"
                  />
                  <button
                    onClick={handleSaveNotes}
                    disabled={notesUpdating}
                    className="mt-1 text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline disabled:opacity-50"
                  >
                    {notesUpdating ? 'Salvando...' : 'Salvar notas'}
                  </button>
                </div>

                {/* Histórico de eventos */}
                {opportunity.pipeline_events && opportunity.pipeline_events.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400 mb-2">Histórico do pipeline</div>
                    <div className="space-y-2">
                      {opportunity.pipeline_events.map(ev => (
                        <div key={ev.id} className="flex items-start gap-2 text-xs">
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                          <div>
                            <span className="font-bold text-slate-700 dark:text-white">
                              {ev.from_status ? `${STATUS_LABELS[ev.from_status as PipelineStatus] ?? ev.from_status} → ` : ''}
                              {STATUS_LABELS[ev.to_status as PipelineStatus] ?? ev.to_status}
                            </span>
                            {ev.notes && <span className="text-slate-400"> — {ev.notes}</span>}
                            <div className="text-[10px] text-slate-400">{formatDate(ev.created_at)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Documento */}
            {activeTab === 'documento' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5">Tipo de documento</label>
                  <div className="relative">
                    <select
                      value={templateType}
                      onChange={e => setTemplateType(e.target.value as TemplateType)}
                      className="w-full appearance-none border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 pr-8"
                    >
                      {Object.entries(TEMPLATE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-sm text-slate-500 dark:text-slate-400">
                  <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">{TEMPLATE_LABELS[templateType]}</p>
                  {templateType === 'project_summary' && <p>Resumo executivo com dados do ITP, problema social, solução proposta, metas e orçamento resumido.</p>}
                  {templateType === 'cover_letter' && <p>Carta formal de apresentação do ITP para o financiador, destacando alinhamento com a oportunidade.</p>}
                  {templateType === 'budget_memo' && <p>Memorando de orçamento detalhado com categorias, justificativas e cronograma físico-financeiro.</p>}
                </div>

                <button
                  onClick={handleGenerateDocument}
                  disabled={generating}
                  className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition text-sm"
                >
                  {generating ? <><Loader2 size={15} className="animate-spin" />Gerando com IA...</> : <><Download size={15} />Gerar e Baixar .docx</>}
                </button>

                <p className="text-[10px] text-slate-400 text-center">
                  Documento gerado pelo Gemini 2.0 Flash com base nos dados da oportunidade e no perfil do ITP.
                </p>
              </div>
            )}

            {/* Tab: Pipeline */}
            {activeTab === 'pipeline' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5">Novo status</label>
                  <div className="relative">
                    <select
                      value={newStatus}
                      onChange={e => setNewStatus(e.target.value as PipelineStatus)}
                      className="w-full appearance-none border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 pr-8"
                    >
                      {PIPELINE_ORDER.map(s => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5">Observação (opcional)</label>
                  <textarea
                    value={statusNotes}
                    onChange={e => setStatusNotes(e.target.value)}
                    rows={3}
                    placeholder="Motivo da mudança, próximos passos..."
                    className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-white resize-none"
                  />
                </div>

                <button
                  onClick={handleStatusUpdate}
                  disabled={updatingStatus || newStatus === opportunity.status}
                  className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition text-sm"
                >
                  {updatingStatus ? <><Loader2 size={15} className="animate-spin" />Atualizando...</> : 'Atualizar Status'}
                </button>

                {onDelete && (
                  <button
                    onClick={() => { onDelete(opportunity.id); onClose(); }}
                    className="w-full text-xs font-bold text-red-500 hover:text-red-700 transition py-2"
                  >
                    Remover oportunidade
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

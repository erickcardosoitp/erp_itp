'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { X, ExternalLink, Calendar, DollarSign, ChevronDown, FileText, History, Loader2, Download, ShieldCheck, CheckCircle2, AlertCircle, XCircle, TrendingUp } from 'lucide-react';
import type { Opportunity, PipelineStatus, TemplateType, EligibilityAnalysis } from '../types';
import { STATUS_LABELS, STATUS_COLORS, SOURCE_TYPE_LABELS, TEMPLATE_LABELS, PIPELINE_ORDER, formatBRL, formatDate } from '../constants';
import { ScoreBadge } from './ScoreBadge';
import { AiConfidenceBar } from './AiConfidenceBar';
import * as api from '../services/captacaoApi';

type Tab = 'detalhes' | 'documento' | 'pipeline' | 'elegibilidade';

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

  // Eligibility tab
  const [eligibility, setEligibility] = useState<EligibilityAnalysis | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);

  // Document tab
  const [templateType, setTemplateType] = useState<TemplateType>('project_summary');
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  const handleAnalyzeEligibility = async () => {
    if (!opportunity) return;
    setEligibilityLoading(true);
    setEligibility(null);
    try {
      const res = await api.analyzeEligibility(opportunity.id);
      setEligibility(res.analysis);
      toast.success('Análise concluída!');
    } catch (err: any) {
      const msg = err?.response?.status === 503
        ? 'Serviço de IA indisponível. Tente novamente.'
        : 'Erro ao analisar elegibilidade';
      toast.error(msg);
    }
    setEligibilityLoading(false);
  };

  // Lazy load ao abrir
  useEffect(() => {
    if (!opportunityId) { setOpportunity(null); return; }
    setLoading(true);
    setActiveTab('detalhes');
    setEligibility(null);
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
    setPreviewContent(null);
    try {
      const content = await api.previewDocument(opportunity.id, templateType);
      setPreviewContent(content);
      toast.success('Prévia gerada — revise antes de baixar.');
    } catch (err: any) {
      const msg = err?.response?.status === 503 ? 'Serviço de IA indisponível. Tente novamente.' : 'Erro ao gerar prévia';
      toast.error(msg);
    }
    setGenerating(false);
  };

  const handleDownloadDocument = async () => {
    if (!opportunity) return;
    setDownloading(true);
    try {
      const blob = await api.generateDocument(opportunity.id, templateType);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `captacao_${templateType}_${opportunity.id.slice(0, 8)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Documento baixado!');
    } catch (err: any) {
      const msg = err?.response?.status === 503 ? 'Serviço de IA indisponível. Tente novamente.' : 'Erro ao baixar documento';
      toast.error(msg);
    }
    setDownloading(false);
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'detalhes', label: 'Detalhes', icon: <FileText size={13} /> },
    { id: 'elegibilidade', label: 'Elegibilidade', icon: <ShieldCheck size={13} /> },
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

            {/* Tab: Elegibilidade */}
            {activeTab === 'elegibilidade' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {!eligibility && !eligibilityLoading && (
                  <div className="space-y-3">
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-purple-600" />
                        <span className="text-sm font-black text-purple-700 dark:text-purple-300">Análise de Elegibilidade com IA</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        O Gemini pesquisa no Portal da Transparência, TransfereGov e BNDES quais organizações foram aprovadas historicamente por este financiador, compara o perfil delas com o ITP e calcula a probabilidade de aprovação com evidências reais.
                      </p>
                    </div>
                    <button
                      onClick={handleAnalyzeEligibility}
                      className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-black py-3 rounded-xl transition text-sm"
                    >
                      <ShieldCheck size={15} />Analisar Elegibilidade
                    </button>
                    <p className="text-[10px] text-slate-400 text-center">Leva ~30–45 segundos — pesquisa em tempo real</p>
                  </div>
                )}

                {eligibilityLoading && (
                  <div className="flex flex-col items-center justify-center py-16 space-y-3 text-slate-500">
                    <Loader2 size={32} className="animate-spin text-purple-500" />
                    <p className="text-sm font-semibold">Pesquisando beneficiários históricos...</p>
                    <p className="text-xs text-slate-400">Consultando Portal da Transparência e TransfereGov</p>
                  </div>
                )}

                {eligibility && !eligibilityLoading && (
                  <div className="space-y-5">
                    {/* Veredito */}
                    <div className={`rounded-xl p-4 space-y-1 ${
                      eligibility.verdict === 'alta' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' :
                      eligibility.verdict === 'media' ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800' :
                      eligibility.verdict === 'baixa' ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800' :
                      'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-black uppercase tracking-wide ${
                          eligibility.verdict === 'alta' ? 'text-green-700 dark:text-green-300' :
                          eligibility.verdict === 'media' ? 'text-yellow-700 dark:text-yellow-300' :
                          eligibility.verdict === 'baixa' ? 'text-orange-700 dark:text-orange-300' :
                          'text-red-700 dark:text-red-300'
                        }`}>
                          Chance {eligibility.verdict === 'incompativel' ? 'incompatível' : eligibility.verdict}
                        </span>
                        <span className={`text-2xl font-black ${
                          eligibility.overall_score >= 70 ? 'text-green-600' :
                          eligibility.overall_score >= 50 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>{eligibility.overall_score}%</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{eligibility.verdict_explanation}</p>
                    </div>

                    {/* Beneficiários históricos */}
                    <div>
                      <div className="text-[10px] font-black uppercase text-slate-400 mb-2 flex items-center gap-1.5">
                        <TrendingUp size={10} />Beneficiários históricos similares
                        {eligibility.past_beneficiaries.found_evidence && (
                          <span className="text-green-600 text-[9px]">● dados encontrados</span>
                        )}
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 space-y-2">
                        <p className="text-xs text-slate-600 dark:text-slate-300">{eligibility.past_beneficiaries.typical_profile}</p>
                        {eligibility.past_beneficiaries.examples.length > 0 && (
                          <ul className="space-y-0.5">
                            {eligibility.past_beneficiaries.examples.map((ex, i) => (
                              <li key={i} className="text-[11px] text-slate-500 dark:text-slate-400 flex gap-1.5">
                                <span className="text-purple-400 shrink-0">–</span>{ex}
                              </li>
                            ))}
                          </ul>
                        )}
                        <p className="text-[9px] text-slate-400">Fonte: {eligibility.past_beneficiaries.data_source}</p>
                      </div>
                    </div>

                    {/* Checklist */}
                    {eligibility.eligibility_checklist.length > 0 && (
                      <div>
                        <div className="text-[10px] font-black uppercase text-slate-400 mb-2">Checklist de Requisitos</div>
                        <div className="space-y-2">
                          {eligibility.eligibility_checklist.map((item, i) => (
                            <div key={i} className="flex items-start gap-2.5 text-xs">
                              {item.status === 'ok'
                                ? <CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" />
                                : item.status === 'verificar'
                                ? <AlertCircle size={14} className="text-yellow-500 shrink-0 mt-0.5" />
                                : <XCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                              }
                              <div>
                                <span className="font-semibold text-slate-700 dark:text-white">{item.requirement}</span>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.detail}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Fatores de fit */}
                    {eligibility.itp_fit_factors.length > 0 && (
                      <div>
                        <div className="text-[10px] font-black uppercase text-slate-400 mb-2">Fatores de Compatibilidade</div>
                        <div className="space-y-2">
                          {eligibility.itp_fit_factors.map((f, i) => (
                            <div key={i} className="space-y-0.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-700 dark:text-white">{f.factor}</span>
                                <span className={`font-black text-xs ${f.score >= 70 ? 'text-green-600' : f.score >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>{f.score}%</span>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full transition-all ${f.score >= 70 ? 'bg-green-500' : f.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${f.score}%` }} />
                              </div>
                              <p className="text-[10px] text-slate-400">{f.explanation}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pontos fortes */}
                    {eligibility.strengths.length > 0 && (
                      <div>
                        <div className="text-[10px] font-black uppercase text-green-600 mb-1.5">Pontos Fortes do ITP</div>
                        <ul className="space-y-1">
                          {eligibility.strengths.map((s, i) => (
                            <li key={i} className="flex gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                              <CheckCircle2 size={12} className="text-green-500 shrink-0 mt-0.5" />{s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Riscos */}
                    {eligibility.risk_factors.length > 0 && (
                      <div>
                        <div className="text-[10px] font-black uppercase text-red-500 mb-1.5">Fatores de Risco</div>
                        <ul className="space-y-1">
                          {eligibility.risk_factors.map((r, i) => (
                            <li key={i} className="flex gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                              <AlertCircle size={12} className="text-red-400 shrink-0 mt-0.5" />{r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Ações recomendadas */}
                    {eligibility.recommended_actions.length > 0 && (
                      <div>
                        <div className="text-[10px] font-black uppercase text-purple-600 mb-1.5">Ações Recomendadas</div>
                        <ol className="space-y-1">
                          {eligibility.recommended_actions.map((a, i) => (
                            <li key={i} className="flex gap-2 text-xs text-slate-600 dark:text-slate-300">
                              <span className="font-black text-purple-500 shrink-0">{i + 1}.</span>{a}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    <p className="text-[9px] text-slate-400 italic">{eligibility.disclaimer}</p>

                    <button
                      onClick={handleAnalyzeEligibility}
                      className="w-full text-xs text-purple-600 dark:text-purple-400 hover:underline font-bold py-1"
                    >
                      Refazer análise
                    </button>
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
                      onChange={e => { setTemplateType(e.target.value as TemplateType); setPreviewContent(null); }}
                      className="w-full appearance-none border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 pr-8"
                    >
                      {Object.entries(TEMPLATE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <button
                  onClick={handleGenerateDocument}
                  disabled={generating}
                  className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition text-sm"
                >
                  {generating ? <><Loader2 size={15} className="animate-spin" />Gerando com IA...</> : 'Gerar Prévia'}
                </button>

                {/* Textarea de revisão — aparece após gerar */}
                {previewContent !== null && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-slate-400">Prévia — edite se necessário</span>
                      <span className="text-[10px] text-slate-400">{previewContent.length} caracteres</span>
                    </div>
                    <textarea
                      value={previewContent}
                      onChange={e => setPreviewContent(e.target.value)}
                      rows={16}
                      className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-white resize-none font-mono"
                    />
                    <button
                      onClick={handleDownloadDocument}
                      disabled={downloading}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition text-sm"
                    >
                      {downloading ? <><Loader2 size={15} className="animate-spin" />Baixando...</> : <><Download size={15} />Baixar .docx</>}
                    </button>
                  </div>
                )}

                <p className="text-[10px] text-slate-400 text-center">
                  Documento gerado pelo Gemini 2.0 Flash. O .docx é gerado na hora do download.
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

import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  ExternalLink, Save, Calendar, DollarSign,
  AlertTriangle, FileText, Tag, CheckCircle2,
} from 'lucide-react';
import type { SearchResult } from '../types';
import { SOURCE_TYPE_LABELS, formatBRL, formatDate, isExpiringSoon } from '../constants';
import { ScoreBadge } from './ScoreBadge';
import { AiConfidenceBar } from './AiConfidenceBar';

interface Props {
  result: SearchResult;
  onSave: (result: SearchResult) => Promise<void>;
}

const MODALIDADE_LABEL: Record<string, string> = {
  'convênio': 'Convênio',
  'OS': 'OS',
  'OSC': 'OSC',
  'licitação': 'Licitação',
  'incentivo_fiscal': 'Incentivo Fiscal',
  'chamamento_público': 'Chamamento Público',
  'outro': 'Outro',
};

export function SearchResultCard({ result, onSave }: Props) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const expiring = isExpiringSoon(result.deadline);

  const handleSave = async () => {
    if (saved) return;
    setSaving(true);
    try {
      await onSave(result);
      setSaved(true);
      toast.success('Oportunidade salva no pipeline!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const valorDisplay = () => {
    if (result.valor_minimo && result.valor_maximo)
      return `${formatBRL(result.valor_minimo)} – ${formatBRL(result.valor_maximo)}`;
    if (result.valor_maximo) return `Até ${formatBRL(result.valor_maximo)}`;
    if (result.valor_minimo) return `A partir de ${formatBRL(result.valor_minimo)}`;
    if (result.estimated_value) return formatBRL(result.estimated_value);
    return null;
  };

  const valor = valorDisplay();
  const linkPrincipal = result.link_edital || result.source_url;

  const diasParaPrazo = result.deadline
    ? Math.ceil((new Date(result.deadline).getTime() - Date.now()) / 86_400_000)
    : null;

  return (
    <div className={`rounded-2xl border bg-white dark:bg-slate-900 overflow-hidden hover:shadow-lg transition-shadow ${
      expiring ? 'border-orange-300 dark:border-orange-700' : 'border-slate-200 dark:border-slate-700'
    }`}>
      {/* Barra de urgência */}
      {expiring && (
        <div className="bg-orange-500 text-white text-[10px] font-black uppercase tracking-wider px-4 py-1.5 flex items-center gap-1.5">
          <AlertTriangle size={11} />
          {diasParaPrazo !== null && diasParaPrazo >= 0
            ? `Prazo em ${diasParaPrazo} dia${diasParaPrazo !== 1 ? 's' : ''}!`
            : 'Prazo expirado'}
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* Score + Tipo + Modalidade */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <ScoreBadge score={result.ai_score} />
          <div className="flex items-center gap-1.5 flex-wrap">
            {result.modalidade && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                {MODALIDADE_LABEL[result.modalidade] ?? result.modalidade}
              </span>
            )}
            <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
              {SOURCE_TYPE_LABELS[result.source_type] ?? result.source_type}
            </span>
          </div>
        </div>

        <AiConfidenceBar confidence={result.ai_confidence} />

        <h3 className="font-black text-sm text-slate-800 dark:text-white leading-snug">
          {result.title}
        </h3>

        {result.entity_name && (
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{result.entity_name}</p>
        )}

        {/* Prazo + Valor em destaque */}
        {(result.deadline || valor) && (
          <div className="grid grid-cols-2 gap-2">
            {result.deadline && (
              <div className={`flex flex-col gap-0.5 px-3 py-2 rounded-xl border ${
                expiring
                  ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
              }`}>
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Calendar size={9} /> Prazo
                </span>
                <span className={`text-xs font-bold ${expiring ? 'text-orange-600 dark:text-orange-400' : 'text-slate-700 dark:text-slate-200'}`}>
                  {formatDate(result.deadline)}
                </span>
              </div>
            )}
            {valor && (
              <div className="flex flex-col gap-0.5 px-3 py-2 rounded-xl border bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <DollarSign size={9} /> Valor
                </span>
                <span className="text-xs font-bold text-green-700 dark:text-green-400 leading-tight">{valor}</span>
              </div>
            )}
          </div>
        )}

        {result.summary && (
          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
            {result.summary}
          </p>
        )}

        {/* Elegibilidade */}
        {result.requisitos_elegibilidade && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2">
            <p className="text-[9px] font-black uppercase tracking-wider text-blue-500 mb-1 flex items-center gap-1">
              <CheckCircle2 size={9} /> Elegibilidade
            </p>
            <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed line-clamp-2">
              {result.requisitos_elegibilidade}
            </p>
          </div>
        )}

        {/* Documentos */}
        {result.documentos_necessarios && result.documentos_necessarios.length > 0 && (
          <div>
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
              <FileText size={9} /> Documentos necessários
            </p>
            <div className="flex flex-wrap gap-1">
              {result.documentos_necessarios.slice(0, 4).map((doc, i) => (
                <span key={i} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                  {doc}
                </span>
              ))}
              {result.documentos_necessarios.length > 4 && (
                <span className="text-[10px] text-slate-400 px-1.5 py-0.5">
                  +{result.documentos_necessarios.length - 4} mais
                </span>
              )}
            </div>
          </div>
        )}

        {/* Match reasons */}
        {result.match_reasons.length > 0 && (
          <div>
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
              <Tag size={9} /> Por que o ITP se encaixa
            </p>
            <div className="flex flex-wrap gap-1">
              {result.match_reasons.slice(0, 3).map((r, i) => (
                <span key={i} className="text-[10px] bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          {linkPrincipal && (
            <a href={linkPrincipal} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
              <ExternalLink size={11} />
              {result.link_edital ? 'Abrir edital' : 'Ver fonte'}
            </a>
          )}
          <button onClick={handleSave} disabled={saving || saved}
            className={`ml-auto flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition
              ${saved
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 cursor-default'
                : 'bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50'
              }`}>
            <Save size={11} />
            {saving ? 'Salvando...' : saved ? 'Salvo ✓' : 'Salvar no Pipeline'}
          </button>
        </div>
      </div>
    </div>
  );
}

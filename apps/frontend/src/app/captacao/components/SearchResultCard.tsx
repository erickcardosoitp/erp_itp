import React, { useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, Save, Calendar, DollarSign, AlertTriangle } from 'lucide-react';
import type { SearchResult } from '../types';
import { SOURCE_TYPE_LABELS, formatBRL, formatDate, isExpiringSoon } from '../constants';
import { ScoreBadge } from './ScoreBadge';
import { AiConfidenceBar } from './AiConfidenceBar';

interface Props {
  result: SearchResult;
  onSave: (result: SearchResult) => Promise<void>;
}

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

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-white dark:bg-slate-900 space-y-3 hover:shadow-md transition-shadow">
      {/* Linha 1: Score + Fonte */}
      <div className="flex items-start justify-between gap-2">
        <ScoreBadge score={result.ai_score} />
        <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full shrink-0">
          {SOURCE_TYPE_LABELS[result.source_type] ?? result.source_type}
        </span>
      </div>

      {/* IA Confidence */}
      <AiConfidenceBar confidence={result.ai_confidence} />

      {/* Título */}
      <h3 className="font-black text-sm text-slate-800 dark:text-white leading-snug">
        {result.title}
      </h3>

      {/* Organização */}
      {result.entity_name && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{result.entity_name}</p>
      )}

      {/* Prazo + Valor */}
      <div className="flex flex-wrap gap-3">
        {result.deadline && (
          <div className={`flex items-center gap-1 text-xs font-semibold ${expiring ? 'text-orange-600 dark:text-orange-400' : 'text-slate-500 dark:text-slate-400'}`}>
            {expiring && <AlertTriangle size={11} />}
            <Calendar size={11} />
            {formatDate(result.deadline)}
            {expiring && <span className="text-[10px] font-black">— urgente!</span>}
          </div>
        )}
        {result.estimated_value && (
          <div className="flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400">
            <DollarSign size={11} />
            {formatBRL(result.estimated_value)}
          </div>
        )}
      </div>

      {/* Resumo */}
      {result.summary && (
        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
          {result.summary}
        </p>
      )}

      {/* Match reasons */}
      {result.match_reasons.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {result.match_reasons.slice(0, 3).map((r, i) => (
            <span key={i} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full">
              {r}
            </span>
          ))}
        </div>
      )}

      {/* Ações */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
        {result.source_url && (
          <a
            href={result.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            <ExternalLink size={11} />
            Ver edital
          </a>
        )}
        <button
          onClick={handleSave}
          disabled={saving || saved}
          className={`ml-auto flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition
            ${saved
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 cursor-default'
              : 'bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50'
            }`}
        >
          <Save size={11} />
          {saving ? 'Salvando...' : saved ? 'Salvo ✓' : 'Salvar no Pipeline'}
        </button>
      </div>
    </div>
  );
}

import React from 'react';
import { Calendar, DollarSign, AlertTriangle, ChevronRight, Trash2 } from 'lucide-react';
import type { Opportunity } from '../types';
import { STATUS_LABELS, STATUS_COLORS, SOURCE_TYPE_LABELS, formatBRL, formatDate, isExpiringSoon } from '../constants';
import { ScoreBadge } from './ScoreBadge';

interface Props {
  opportunity: Opportunity;
  onOpen?: (o: Opportunity) => void;
  onDelete?: (id: string) => void;
  dragging?: boolean;
}

export function OpportunityCard({ opportunity: o, onOpen, onDelete, dragging }: Props) {
  const expiring = isExpiringSoon(o.deadline);
  const statusStyle = STATUS_COLORS[o.status];

  return (
    <div
      className={`bg-white dark:bg-slate-900 border rounded-xl p-3 space-y-2 cursor-grab active:cursor-grabbing select-none
        ${dragging ? 'shadow-2xl rotate-1 opacity-90' : 'shadow-sm hover:shadow-md'}
        ${statusStyle.border} transition-shadow`}
    >
      {/* Score + Fonte */}
      <div className="flex items-center justify-between gap-1">
        {o.ai_score != null && <ScoreBadge score={o.ai_score} showBar={false} />}
        <span className="text-[9px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 shrink-0">
          {SOURCE_TYPE_LABELS[o.source_type] ?? o.source_type}
        </span>
      </div>

      {/* Título */}
      <h4 className="text-xs font-black text-slate-800 dark:text-white leading-tight line-clamp-2">
        {o.title}
      </h4>

      {/* Organização */}
      {o.entity_name && (
        <p className="text-[10px] text-slate-400 truncate">{o.entity_name}</p>
      )}

      {/* Prazo + Valor */}
      <div className="flex flex-wrap gap-2">
        {o.deadline && (
          <div className={`flex items-center gap-0.5 text-[10px] font-semibold ${expiring ? 'text-orange-500' : 'text-slate-400'}`}>
            {expiring && <AlertTriangle size={9} />}
            <Calendar size={9} />
            {formatDate(o.deadline)}
          </div>
        )}
        {o.estimated_value != null && (
          <div className="flex items-center gap-0.5 text-[10px] font-semibold text-green-600 dark:text-green-400">
            <DollarSign size={9} />
            {formatBRL(o.estimated_value)}
          </div>
        )}
      </div>

      {/* Ações */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(o.id); }}
            className="text-slate-300 hover:text-red-500 transition p-0.5 rounded"
            title="Remover"
          >
            <Trash2 size={11} />
          </button>
        )}
        {onOpen && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpen(o); }}
            className="ml-auto flex items-center gap-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline"
          >
            Detalhes <ChevronRight size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

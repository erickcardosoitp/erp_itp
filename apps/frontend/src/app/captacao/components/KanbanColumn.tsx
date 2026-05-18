'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Opportunity, PipelineStatus } from '../types';
import { STATUS_LABELS, STATUS_COLORS } from '../constants';
import { OpportunityCard } from './OpportunityCard';

interface ColumnProps {
  status: PipelineStatus;
  items: Opportunity[];
  onOpen: (o: Opportunity) => void;
  onDelete: (id: string) => void;
}

function SortableCard({ opportunity, onOpen, onDelete }: { opportunity: Opportunity; onOpen: (o: Opportunity) => void; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: opportunity.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <OpportunityCard opportunity={opportunity} onOpen={onOpen} onDelete={onDelete} />
    </div>
  );
}

export function KanbanColumn({ status, items, onOpen, onDelete }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const colors = STATUS_COLORS[status];

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-2xl min-w-[220px] w-[220px] border-2 transition-colors
        ${isOver ? 'border-purple-400 dark:border-purple-500' : colors.border}
        ${colors.bg}`}
    >
      {/* Header da coluna */}
      <div className={`px-3 py-2.5 rounded-t-2xl border-b ${colors.border}`}>
        <div className="flex items-center justify-between">
          <span className={`text-[11px] font-black uppercase tracking-wider ${colors.text}`}>
            {STATUS_LABELS[status]}
          </span>
          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
            {items.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 space-y-2 min-h-[100px]">
        {items.map(o => (
          <SortableCard key={o.id} opportunity={o} onOpen={onOpen} onDelete={onDelete} />
        ))}
        {items.length === 0 && (
          <div className="text-[10px] text-slate-400 text-center py-6 italic">
            Arraste aqui
          </div>
        )}
      </div>
    </div>
  );
}

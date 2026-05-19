'use client';

import React, { useState, useRef } from 'react';
import type { Opportunity, PipelineStatus } from '../types';
import { PIPELINE_ORDER, STATUS_LABELS, STATUS_COLORS } from '../constants';
import { OpportunityCard } from './OpportunityCard';

interface Props {
  opportunities: Opportunity[];
  onMove: (id: string, newStatus: PipelineStatus) => void;
  onOpen: (o: Opportunity) => void;
  onDelete: (id: string) => void;
}

export function KanbanBoard({ opportunities, onMove, onOpen, onDelete }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<PipelineStatus | null>(null);
  const dragStatus = useRef<PipelineStatus | null>(null);

  const byStatus = PIPELINE_ORDER.reduce<Record<PipelineStatus, Opportunity[]>>(
    (acc, s) => ({ ...acc, [s]: opportunities.filter(o => o.status === s) }),
    {} as Record<PipelineStatus, Opportunity[]>,
  );

  const handleDragStart = (e: React.DragEvent, id: string, status: PipelineStatus) => {
    setDraggingId(id);
    dragStatus.current = status;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setOverColumn(null);
    dragStatus.current = null;
  };

  const handleColumnDragOver = (e: React.DragEvent, status: PipelineStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverColumn(status);
  };

  const handleColumnDrop = (e: React.DragEvent, status: PipelineStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (id && dragStatus.current !== status) {
      onMove(id, status);
    }
    setDraggingId(null);
    setOverColumn(null);
    dragStatus.current = null;
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[500px]">
      {PIPELINE_ORDER.map(status => {
        const colors = STATUS_COLORS[status];
        const isOver = overColumn === status;
        const items = byStatus[status];

        return (
          <div
            key={status}
            onDragOver={e => handleColumnDragOver(e, status)}
            onDragLeave={() => setOverColumn(null)}
            onDrop={e => handleColumnDrop(e, status)}
            className={`flex flex-col rounded-2xl min-w-[220px] w-[220px] border-2 transition-colors
              ${isOver ? 'border-purple-400 dark:border-purple-500 ring-2 ring-purple-300/40' : colors.border}
              ${colors.bg}`}
          >
            {/* Header */}
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
                <div
                  key={o.id}
                  draggable
                  onDragStart={e => handleDragStart(e, o.id, status)}
                  onDragEnd={handleDragEnd}
                  style={{ opacity: draggingId === o.id ? 0.4 : 1 }}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <OpportunityCard opportunity={o} onOpen={onOpen} onDelete={onDelete} />
                </div>
              ))}
              {items.length === 0 && (
                <div className={`text-[10px] text-center py-6 italic transition-colors
                  ${isOver ? 'text-purple-400' : 'text-slate-400'}`}>
                  {isOver ? 'Solte aqui' : 'Arraste aqui'}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

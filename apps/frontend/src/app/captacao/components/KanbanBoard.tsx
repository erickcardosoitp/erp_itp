'use client';

import React, { useState } from 'react';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Opportunity, PipelineStatus } from '../types';
import { PIPELINE_ORDER, STATUS_LABELS, STATUS_COLORS } from '../constants';
import { KanbanColumn } from './KanbanColumn';
import { OpportunityCard } from './OpportunityCard';

interface Props {
  opportunities: Opportunity[];
  onMove: (id: string, newStatus: PipelineStatus) => void;
  onOpen: (o: Opportunity) => void;
  onDelete: (id: string) => void;
}

export function KanbanBoard({ opportunities, onMove, onOpen, onDelete }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const byStatus = PIPELINE_ORDER.reduce<Record<PipelineStatus, Opportunity[]>>(
    (acc, s) => ({ ...acc, [s]: opportunities.filter(o => o.status === s) }),
    {} as any,
  );

  const activeOpportunity = activeId ? opportunities.find(o => o.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const draggedId = String(active.id);
    const overId = String(over.id);

    // Se solto sobre uma coluna (status)
    if (PIPELINE_ORDER.includes(overId as PipelineStatus)) {
      const dragged = opportunities.find(o => o.id === draggedId);
      if (dragged && dragged.status !== overId) {
        onMove(draggedId, overId as PipelineStatus);
      }
      return;
    }

    // Se solto sobre um card, move para o status do card alvo
    const target = opportunities.find(o => o.id === overId);
    if (target) {
      const dragged = opportunities.find(o => o.id === draggedId);
      if (dragged && dragged.status !== target.status) {
        onMove(draggedId, target.status);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 min-h-[500px]">
        {PIPELINE_ORDER.map(status => (
          <SortableContext
            key={status}
            id={status}
            items={byStatus[status].map(o => o.id)}
            strategy={verticalListSortingStrategy}
          >
            <KanbanColumn
              status={status}
              items={byStatus[status]}
              onOpen={onOpen}
              onDelete={onDelete}
            />
          </SortableContext>
        ))}
      </div>

      <DragOverlay>
        {activeOpportunity && (
          <OpportunityCard opportunity={activeOpportunity} dragging />
        )}
      </DragOverlay>
    </DndContext>
  );
}

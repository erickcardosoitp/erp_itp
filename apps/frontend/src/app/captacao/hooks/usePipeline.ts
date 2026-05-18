'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import type { Opportunity, PipelineStatus } from '../types';
import * as api from '../services/captacaoApi';

export function usePipeline(initialStatus?: PipelineStatus) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<PipelineStatus | undefined>(initialStatus);
  const [filterSearch, setFilterSearch] = useState('');

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await api.listOpportunities({
        status: filterStatus,
        search: filterSearch || undefined,
        page: p,
        limit: 20,
      });
      setOpportunities(res.data);
      setTotal(res.total);
      setPage(p);
    } catch {
      toast.error('Erro ao carregar pipeline');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterSearch]);

  useEffect(() => { load(1); }, [load]);

  /** Move card: otimistic update + rollback em erro */
  const moveCard = useCallback(async (id: string, newStatus: PipelineStatus, notes?: string) => {
    // Salva estado anterior para rollback
    const prev = opportunities.find(o => o.id === id);
    if (!prev) return;

    // Otimistic: atualiza imediatamente
    setOpportunities(cur => cur.map(o => o.id === id ? { ...o, status: newStatus } : o));

    try {
      const updated = await api.updateStatus(id, newStatus, notes);
      setOpportunities(cur => cur.map(o => o.id === id ? updated : o));
      toast.success('Status atualizado!');
    } catch {
      // Rollback
      setOpportunities(cur => cur.map(o => o.id === id ? prev : o));
      toast.error('Erro ao atualizar status');
    }
  }, [opportunities]);

  /** Soft delete com remoção otimista */
  const deleteCard = useCallback(async (id: string) => {
    const prev = [...opportunities];
    setOpportunities(cur => cur.filter(o => o.id !== id));
    try {
      await api.deleteOpportunity(id);
      setTotal(t => t - 1);
      toast.success('Removido do pipeline');
    } catch {
      setOpportunities(prev);
      toast.error('Erro ao remover');
    }
  }, [opportunities]);

  /** Atualiza campos inline */
  const updateCard = useCallback(async (id: string, data: Partial<Opportunity>) => {
    const updated = await api.updateOpportunity(id, data);
    setOpportunities(cur => cur.map(o => o.id === id ? updated : o));
    return updated;
  }, []);

  return {
    opportunities,
    total,
    page,
    loading,
    filterStatus,
    filterSearch,
    setFilterStatus,
    setFilterSearch,
    load,
    moveCard,
    deleteCard,
    updateCard,
  };
}

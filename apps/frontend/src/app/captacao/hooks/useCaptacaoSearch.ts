'use client';

import { useState, useRef, useCallback } from 'react';
import type { SearchResult } from '../types';
import * as api from '../services/captacaoApi';

// Cache em memória: hash(query+filtros) → { results, ts }
const searchCache = new Map<string, { results: SearchResult[]; ts: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min

function cacheKey(query: string, areas?: string[], sourceTypes?: string[]): string {
  return JSON.stringify({ query: query.trim().toLowerCase(), areas: [...(areas ?? [])].sort(), sourceTypes: [...(sourceTypes ?? [])].sort() });
}

export function useCaptacaoSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (
    query: string,
    options?: { areas?: string[]; source_types?: string[] },
  ) => {
    if (!query.trim()) return;

    // Verifica cache
    const key = cacheKey(query, options?.areas, options?.source_types);
    const cached = searchCache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      setResults(cached.results);
      setLastQuery(query);
      setError(null);
      return;
    }

    // Cancela requisição anterior
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setLastQuery(query);

    try {
      const data = await api.searchOpportunities(query, options, abortRef.current.signal);
      searchCache.set(key, { results: data.results, ts: Date.now() });
      setResults(data.results);
      setRequestId(data.request_id);
    } catch (err: any) {
      if (err?.code === 'ERR_CANCELED' || err?.name === 'AbortError') return;
      const msg =
        err?.response?.data?.message?.includes('Rate limit') ? 'Limite de buscas atingido. Aguarde 1 minuto.' :
        err?.response?.status === 503 ? 'Serviço temporariamente indisponível. Tente novamente.' :
        err?.message?.includes('timeout') ? 'A busca demorou mais que o esperado. Tente novamente.' :
        'Erro ao buscar oportunidades.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Invalida o cache ao salvar uma oportunidade */
  const invalidateCache = useCallback(() => {
    searchCache.clear();
  }, []);

  const save = useCallback(async (result: SearchResult) => {
    const saved = await api.saveOpportunity({
      title: result.title,
      source_type: result.source_type,
      source_url: result.source_url,
      entity_name: result.entity_name,
      deadline: result.deadline ? new Date(result.deadline) as any : undefined,
      estimated_value: result.estimated_value,
      ai_score: result.ai_score,
      ai_confidence: result.ai_confidence,
      summary: result.summary,
      match_reasons: result.match_reasons,
      search_metadata: { areas: result.areas },
    });
    invalidateCache();
    return saved;
  }, [invalidateCache]);

  return { results, loading, error, lastQuery, requestId, search, save, invalidateCache };
}

'use client';

import { useState, useEffect } from 'react';
import type { InsightsResponse } from '../types';
import * as api from '../services/captacaoApi';

export function useInsights() {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getInsights()
      .then(d => { if (!cancelled) { setData(d); setError(null); } })
      .catch(() => { if (!cancelled) setError('Erro ao carregar insights'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { data, loading, error };
}

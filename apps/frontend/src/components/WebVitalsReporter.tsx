'use client';

import { useEffect } from 'react';
import { onLCP, onINP, onCLS, type Metric } from 'web-vitals';

// RUM (Real User Monitoring) leve: reporta as 3 métricas centrais de Web
// Vitals pro backend, que expõe como histograma Prometheus
// (web_vitals_seconds). Fire-and-forget via sendBeacon quando disponível
// (não atrasa nem interfere na navegação do usuário).
function reportar(metric: Metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    pathname: typeof window !== 'undefined' ? window.location.pathname : undefined,
  });
  const url = '/backend-api/metrics/rum';
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
  } else {
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  }
}

export default function WebVitalsReporter() {
  useEffect(() => {
    onLCP(reportar);
    onINP(reportar);
    onCLS(reportar);
  }, []);
  return null;
}

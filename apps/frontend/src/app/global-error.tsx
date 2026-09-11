'use client';

import { useEffect } from 'react';

// error.tsx normal não cobre falha no próprio layout.tsx raiz — só esse
// arquivo especial cobre (Next.js App Router). Sem ele, um crash aqui
// fica só no navegador, sem nem a UI de fallback do error.tsx aparecer
// (achado na varredura de pontos cegos client-side, 2026-09-11).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    fetch('/backend-api/frontend-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `[layout raiz] ${error.message}`,
        stack: error.stack,
        pathname: typeof window !== 'undefined' ? window.location.pathname : undefined,
      }),
    }).catch(() => {});
  }, [error]);

  // global-error.tsx substitui o layout raiz inteiro enquanto ativo —
  // precisa dos próprios <html>/<body>, o layout.tsx normal não roda.
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ textAlign: 'center', maxWidth: 360 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Algo deu errado</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
              Ocorreu um erro inesperado ao carregar a aplicação.
            </p>
            <button
              onClick={() => reset()}
              style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

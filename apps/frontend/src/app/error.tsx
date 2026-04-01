'use client';

import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

function isChunkError(error: Error): boolean {
  return (
    error?.name === 'ChunkLoadError' ||
    /loading chunk/i.test(error?.message || '') ||
    /failed to fetch dynamically imported module/i.test(error?.message || '') ||
    /importing a module script failed/i.test(error?.message || '') ||
    /load failed/i.test(error?.message || '')
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Se for erro de chunk desatualizado (novo deploy), recarrega silenciosamente
    if (isChunkError(error)) {
      window.location.reload();
    }
  }, [error]);

  // Se for chunk error não mostra nada (vai recarregar)
  if (isChunkError(error)) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#1a2030] p-6">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 p-8 max-w-sm w-full text-center space-y-4">
        <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-2xl inline-block">
          <RefreshCw size={28} className="text-red-500 dark:text-red-400" />
        </div>
        <h2 className="text-lg font-black uppercase tracking-tight text-slate-800 dark:text-white">
          Algo deu errado
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Ocorreu um erro inesperado. Tente novamente ou recarregue a página.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => reset()}
            className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl font-black text-xs uppercase hover:bg-purple-700 transition-colors"
          >
            Tentar novamente
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-2.5 rounded-xl font-black text-xs uppercase hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Recarregar
          </button>
        </div>
      </div>
    </div>
  );
}

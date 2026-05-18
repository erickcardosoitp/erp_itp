'use client';

import React, { useState } from 'react';
import { Search, X, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import type { SourceType } from '../types';
import { SOURCE_TYPE_LABELS } from '../constants';
import { useCaptacaoSearch } from '../hooks/useCaptacaoSearch';
import { SearchResultCard } from '../components/SearchResultCard';

const SOURCE_OPTIONS = Object.entries(SOURCE_TYPE_LABELS) as [SourceType, string][];

const AREAS_OPTIONS = [
  'educação', 'esporte', 'cultura', 'saúde', 'arte', 'assistência social',
];

export default function BuscarPage() {
  const [query, setQuery] = useState('');
  const [selectedSources, setSelectedSources] = useState<SourceType[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);

  const { results, loading, error, lastQuery, search, save } = useCaptacaoSearch();

  const handleSearch = () => {
    if (!query.trim() || loading) return;
    search(query, {
      source_types: selectedSources.length ? selectedSources : undefined,
      areas: selectedAreas.length ? selectedAreas : undefined,
    });
  };

  const toggleSource = (s: SourceType) => {
    setSelectedSources(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  return (
    <div className="space-y-6">
      {/* Hero search */}
      <div className="bg-gradient-to-br from-purple-600 to-purple-800 dark:from-purple-900 dark:to-purple-950 rounded-2xl p-6 text-white space-y-4 shadow-lg">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-purple-200" />
          <span className="text-sm font-bold text-purple-100">Busca com IA — Gemini + Google Search</span>
        </div>

        <h2 className="text-xl font-black leading-tight">
          Encontre editais e financiamentos<br />para o Instituto Tia Pretinha
        </h2>

        {/* Search input */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-300" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Ex: editais para educação infantil, projetos sociais, cultura..."
              className="w-full pl-9 pr-4 py-3 rounded-xl bg-white/15 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-white/40 text-sm"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={!query.trim() || loading}
            className="flex items-center gap-2 px-5 py-3 bg-white text-purple-700 hover:bg-purple-50 rounded-xl text-sm font-black transition disabled:opacity-40"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {/* Filtros */}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] font-bold text-purple-300 self-center mr-1">Fonte:</span>
            {SOURCE_OPTIONS.map(([val, label]) => (
              <button
                key={val}
                onClick={() => setSelectedSources(p => p.includes(val) ? p.filter(x => x !== val) : [...p, val])}
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border transition
                  ${selectedSources.includes(val)
                    ? 'bg-white text-purple-700 border-white'
                    : 'bg-white/10 text-purple-200 border-white/20 hover:bg-white/20'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] font-bold text-purple-300 self-center mr-1">Área:</span>
            {AREAS_OPTIONS.map(area => (
              <button
                key={area}
                onClick={() => setSelectedAreas(p => p.includes(area) ? p.filter(x => x !== area) : [...p, area])}
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border transition
                  ${selectedAreas.includes(area)
                    ? 'bg-white text-purple-700 border-white'
                    : 'bg-white/10 text-purple-200 border-white/20 hover:bg-white/20'
                  }`}
              >
                {area}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 space-y-3 text-slate-500">
          <Loader2 size={32} className="animate-spin text-purple-500" />
          <p className="text-sm font-semibold">Consultando IA e Google Search...</p>
          <p className="text-xs text-slate-400">Isso pode levar até 30 segundos</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold">Erro na busca</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-black text-slate-700 dark:text-slate-200">
            {results.length} oportunidades encontradas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {results.map((result, i) => (
              <SearchResultCard key={i} result={result} onSave={r => save(r).then(() => {})} />
            ))}
          </div>
        </div>
      )}

      {/* Empty after search */}
      {!loading && !error && results.length === 0 && lastQuery && (
        <div className="text-center py-16 text-slate-400">
          <Search size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-semibold">Nenhum resultado para "{lastQuery}"</p>
          <p className="text-xs mt-1">Tente termos diferentes ou remova filtros de fonte</p>
        </div>
      )}

      {/* Initial empty */}
      {!loading && !error && results.length === 0 && !lastQuery && (
        <div className="text-center py-16 text-slate-400">
          <Sparkles size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-semibold">Digite uma busca para encontrar editais</p>
          <p className="text-xs mt-1">A IA pesquisa em tempo real usando Google Search</p>
        </div>
      )}
    </div>
  );
}

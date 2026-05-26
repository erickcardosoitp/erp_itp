'use client';

import React, { useState, useMemo } from 'react';
import { Search, Loader2, Sparkles, AlertCircle, SlidersHorizontal, Clock, DollarSign, Zap } from 'lucide-react';
import type { SearchResult, SourceType } from '../types';
import { SOURCE_TYPE_LABELS } from '../constants';
import { useCaptacaoSearch } from '../hooks/useCaptacaoSearch';
import { SearchResultCard } from '../components/SearchResultCard';

const SOURCE_OPTIONS = Object.entries(SOURCE_TYPE_LABELS) as [SourceType, string][];

const AREAS_OPTIONS = [
  'educação', 'esporte', 'cultura', 'saúde', 'arte', 'assistência social',
];

const QUICK_SEARCHES = [
  { label: 'Itaú Social', query: 'Itaú Social editais OSC educação criança' },
  { label: 'BNDES Fundo Social', query: 'BNDES Fundo Social projetos sociais periferia' },
  { label: 'Petrobras Social', query: 'Petrobras Social editais Rio de Janeiro OSC' },
  { label: 'Lei Rouanet', query: 'Lei Rouanet editais cultura arte Rio de Janeiro' },
  { label: 'Fundação Bradesco', query: 'Fundação Bradesco editais educação esporte' },
  { label: 'FNDE educação', query: 'FNDE chamamento OSC educação infanto-juvenil' },
  { label: 'Incentivo Esporte', query: 'Lei Incentivo ao Esporte editais projetos sociais esportivos' },
  { label: 'Roberto Marinho', query: 'Fundação Roberto Marinho editais cultura educação' },
];

const PRAZO_OPCOES = [
  { label: 'Qualquer prazo', dias: null },
  { label: 'Próximos 30 dias', dias: 30 },
  { label: 'Próximos 60 dias', dias: 60 },
  { label: 'Próximos 90 dias', dias: 90 },
];

const VALOR_OPCOES = [
  { label: 'Qualquer valor', min: null, max: null },
  { label: 'Até R$ 50 mil', min: null, max: 50_000 },
  { label: 'R$ 50k – R$ 200k', min: 50_000, max: 200_000 },
  { label: 'R$ 200k – R$ 500k', min: 200_000, max: 500_000 },
  { label: 'Acima de R$ 500k', min: 500_000, max: null },
];

const SORT_OPCOES = [
  { label: 'Maior score', key: 'score' },
  { label: 'Prazo mais próximo', key: 'prazo' },
  { label: 'Maior valor', key: 'valor' },
];

export default function BuscarPage() {
  const [query, setQuery] = useState('');
  const [selectedSources, setSelectedSources] = useState<SourceType[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);

  // Filtros pós-busca
  const [filtroPrazoDias, setFiltroPrazoDias] = useState<number | null>(null);
  const [filtroValorMin, setFiltroValorMin] = useState<number | null>(null);
  const [filtroValorMax, setFiltroValorMax] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<'score' | 'prazo' | 'valor'>('score');
  const [showFiltros, setShowFiltros] = useState(false);

  const { results, loading, error, lastQuery, search, save } = useCaptacaoSearch();

  const handleSearch = (q?: string) => {
    const q_ = (q ?? query).trim();
    if (!q_ || loading) return;
    if (q) setQuery(q);
    search(q_, {
      source_types: selectedSources.length ? selectedSources : undefined,
      areas: selectedAreas.length ? selectedAreas : undefined,
    });
  };

  const valorEfetivo = (r: SearchResult): number | null => {
    return r.valor_maximo ?? r.valor_minimo ?? r.estimated_value ?? null;
  };

  const resultadosFiltrados = useMemo(() => {
    let r = [...results];

    if (filtroPrazoDias !== null) {
      const limite = Date.now() + filtroPrazoDias * 86_400_000;
      r = r.filter(x => x.deadline && new Date(x.deadline).getTime() <= limite && new Date(x.deadline).getTime() >= Date.now());
    }

    if (filtroValorMin !== null || filtroValorMax !== null) {
      r = r.filter(x => {
        const v = valorEfetivo(x);
        if (v === null) return false;
        if (filtroValorMin !== null && v < filtroValorMin) return false;
        if (filtroValorMax !== null && v > filtroValorMax) return false;
        return true;
      });
    }

    r.sort((a, b) => {
      if (sortKey === 'prazo') {
        const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return da - db;
      }
      if (sortKey === 'valor') {
        return (valorEfetivo(b) ?? 0) - (valorEfetivo(a) ?? 0);
      }
      return (b.ai_score ?? 0) - (a.ai_score ?? 0);
    });

    return r;
  }, [results, filtroPrazoDias, filtroValorMin, filtroValorMax, sortKey]);

  const temFiltroAtivo = filtroPrazoDias !== null || filtroValorMin !== null || filtroValorMax !== null;

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
            onClick={() => handleSearch()}
            disabled={!query.trim() || loading}
            className="flex items-center gap-2 px-5 py-3 bg-white text-purple-700 hover:bg-purple-50 rounded-xl text-sm font-black transition disabled:opacity-40"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {/* Filtros de fonte e área */}
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

        {/* Quick searches */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-purple-300 mb-2 flex items-center gap-1">
            <Zap size={9} /> Buscas rápidas
          </p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_SEARCHES.map(qs => (
              <button key={qs.label}
                onClick={() => handleSearch(qs.query)}
                disabled={loading}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-purple-100 hover:bg-white/20 transition disabled:opacity-40">
                {qs.label}
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
        <div className="space-y-4">
          {/* Barra de filtros pós-busca */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <button onClick={() => setShowFiltros(f => !f)}
                  className={`flex items-center gap-1.5 text-[11px] font-black px-3 py-1.5 rounded-xl border transition
                    ${showFiltros || temFiltroAtivo
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}>
                  <SlidersHorizontal size={11} />
                  Filtrar
                  {temFiltroAtivo && <span className="w-4 h-4 bg-white text-purple-600 rounded-full text-[9px] flex items-center justify-center font-black">!</span>}
                </button>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {resultadosFiltrados.length} de {results.length} oportunidade{results.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Sort */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase text-slate-400">Ordenar:</span>
                {SORT_OPCOES.map(s => (
                  <button key={s.key} onClick={() => setSortKey(s.key as any)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition
                      ${sortKey === s.key
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-purple-300'
                      }`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Painel de filtros */}
            {showFiltros && (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Prazo */}
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-1.5 flex items-center gap-1">
                    <Clock size={9} /> Prazo de submissão
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {PRAZO_OPCOES.map(op => (
                      <button key={op.label} onClick={() => setFiltroPrazoDias(op.dias)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition
                          ${filtroPrazoDias === op.dias
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-orange-300'
                          }`}>
                        {op.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Valor */}
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-1.5 flex items-center gap-1">
                    <DollarSign size={9} /> Faixa de valor
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {VALOR_OPCOES.map(op => (
                      <button key={op.label}
                        onClick={() => { setFiltroValorMin(op.min); setFiltroValorMax(op.max); }}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition
                          ${filtroValorMin === op.min && filtroValorMax === op.max
                            ? 'bg-green-600 text-white border-green-600'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-green-300'
                          }`}>
                        {op.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {resultadosFiltrados.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <SlidersHorizontal size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold">Nenhum resultado com estes filtros</p>
              <button onClick={() => { setFiltroPrazoDias(null); setFiltroValorMin(null); setFiltroValorMax(null); }}
                className="text-xs text-purple-600 mt-1 hover:underline">Limpar filtros</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {resultadosFiltrados.map((result, i) => (
                <SearchResultCard key={i} result={result} onSave={r => save(r).then(() => {})} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty after search */}
      {!loading && !error && results.length === 0 && lastQuery && (
        <div className="text-center py-16 text-slate-400">
          <Search size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-semibold">Nenhum resultado para &ldquo;{lastQuery}&rdquo;</p>
          <p className="text-xs mt-1">Tente termos diferentes ou use uma busca rápida acima</p>
        </div>
      )}

      {/* Initial empty */}
      {!loading && !error && results.length === 0 && !lastQuery && (
        <div className="text-center py-16 text-slate-400">
          <Sparkles size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-semibold">Digite uma busca ou use as sugestões acima</p>
          <p className="text-xs mt-1">A IA pesquisa em tempo real usando Google Search</p>
        </div>
      )}
    </div>
  );
}

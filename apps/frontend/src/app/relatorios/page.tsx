'use client';

import React, { useState, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  BarChart2, Download, TrendingUp, Users, BookOpen,
  Package, Heart, DollarSign, Globe, Filter, RefreshCw,
} from 'lucide-react';
import api from '@/services/api';

/* ── Helpers ── */
function moeda(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0);
}

function exportarExcel(dados: Record<string, unknown>[], nomeArquivo: string) {
  import('xlsx').then(mod => {
    const XLSX = (mod.default ?? mod) as typeof import('xlsx');
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
    XLSX.writeFile(wb, `${nomeArquivo}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  });
}

const CORES_PIZZA = ['#7c3aed', '#a855f7', '#c084fc', '#d8b4fe', '#ede9fe', '#4f46e5', '#818cf8'];

type AbaId = 'financeiro' | 'academico' | 'social' | 'estoque' | 'dre';

/* ════════════════════════════════════════════════════════
   ABAS FINANCEIRO
═══════════════════════════════════════════════════════════ */

function AbaFinanceiro() {
  const anoAtual = new Date().getFullYear();
  const [resumo, setResumo]     = useState<Record<string, unknown> | null>(null);
  const [fluxo, setFluxo]       = useState<unknown[]>([]);
  const [doacoes, setDoacoes]   = useState<Record<string, unknown> | null>(null);
  const [contabil, setContabil] = useState<unknown[]>([]);
  const [dataIni, setDataIni] = useState(`${anoAtual}-01-01`);
  const [dataFim, setDataFim] = useState(`${anoAtual}-12-31`);
  const [ano, setAno]         = useState(String(anoAtual));
  const [mes, setMes]         = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [carregando, setCarregando] = useState<string | null>(null);

  const carregar = useCallback(async (tipo: string) => {
    setCarregando(tipo);
    try {
      if (tipo === 'resumo') {
        const { data } = await api.get(`/relatorios/financeiro/resumo?data_ini=${dataIni}&data_fim=${dataFim}`);
        setResumo(data);
      } else if (tipo === 'fluxo') {
        const { data } = await api.get(`/relatorios/financeiro/fluxo-caixa?ano=${ano}`);
        setFluxo(data.meses ?? []);
      } else if (tipo === 'doacoes') {
        const { data } = await api.get(`/relatorios/financeiro/doacoes?data_ini=${dataIni}&data_fim=${dataFim}`);
        setDoacoes(data);
      } else if (tipo === 'contabil') {
        const { data } = await api.get(`/relatorios/financeiro/contabil?mes=${mes}&ano=${ano}`);
        setContabil(data.lancamentos ?? []);
      }
    } catch {/* silencia */} finally { setCarregando(null); }
  }, [dataIni, dataFim, ano, mes]);

  return (
    <div className="space-y-6">
      {/* ── Filtros globais ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">De</label>
          <input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)}
            className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-800 dark:text-slate-100" />
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Até</label>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
            className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-800 dark:text-slate-100" />
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Ano</label>
          <input type="number" value={ano} onChange={e => setAno(e.target.value)} min="2020" max="2099"
            className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm w-24 bg-white dark:bg-slate-800 dark:text-slate-100" />
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Mês</label>
          <select value={mes} onChange={e => setMes(e.target.value)}
            className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-800 dark:text-slate-100">
            {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Resumo Financeiro ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-black text-sm uppercase tracking-widest text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <TrendingUp size={16} className="text-purple-600" /> Resumo Financeiro
          </h3>
          <div className="flex gap-2">
            <button onClick={() => carregar('resumo')}
              className="px-3 py-1.5 text-xs font-bold bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-1 disabled:opacity-50"
              disabled={carregando === 'resumo'}>
              {carregando === 'resumo' ? <RefreshCw size={12} className="animate-spin" /> : <Filter size={12} />} Gerar
            </button>
            {resumo && (
              <button onClick={() => exportarExcel([(resumo.categorias as unknown[])].flat() as Record<string, unknown>[], 'resumo_financeiro')}
                className="px-3 py-1.5 text-xs font-bold border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1">
                <Download size={12} /> Excel
              </button>
            )}
          </div>
        </div>
        {resumo && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Receitas', value: moeda(Number(resumo.total_receitas)), color: 'text-green-600' },
                { label: 'Despesas', value: moeda(Number(resumo.total_despesas)), color: 'text-red-500' },
                { label: 'Saldo', value: moeda(Number(resumo.saldo)), color: Number(resumo.saldo) >= 0 ? 'text-green-600' : 'text-red-500' },
              ].map(c => (
                <div key={c.label} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{c.label}</p>
                  <p className={`text-xl font-black mt-1 ${c.color}`}>{c.value}</p>
                </div>
              ))}
            </div>
            {Array.isArray(resumo.categorias) && resumo.categorias.length > 0 && (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={resumo.categorias as Record<string, unknown>[]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="categoria" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => moeda(v)} />
                  <Bar dataKey="receita" name="Receita" fill="#7c3aed" radius={[4,4,0,0]} />
                  <Bar dataKey="despesa" name="Despesa" fill="#f87171" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>

      {/* ── Fluxo de Caixa ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-black text-sm uppercase tracking-widest text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <TrendingUp size={16} className="text-green-600" /> Fluxo de Caixa Mensal
          </h3>
          <div className="flex gap-2">
            <button onClick={() => carregar('fluxo')}
              className="px-3 py-1.5 text-xs font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1 disabled:opacity-50"
              disabled={carregando === 'fluxo'}>
              {carregando === 'fluxo' ? <RefreshCw size={12} className="animate-spin" /> : <Filter size={12} />} Gerar
            </button>
            {fluxo.length > 0 && (
              <button onClick={() => exportarExcel(fluxo as Record<string, unknown>[], 'fluxo_caixa')}
                className="px-3 py-1.5 text-xs font-bold border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1">
                <Download size={12} /> Excel
              </button>
            )}
          </div>
        </div>
        {fluxo.length > 0 && (
          <div className="p-5">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={fluxo as Record<string, unknown>[]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => moeda(v)} />
                <Legend />
                <Line type="monotone" dataKey="receita" name="Receita" stroke="#7c3aed" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="despesa" name="Despesa" stroke="#f87171" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="saldo" name="Saldo" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Doações ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-black text-sm uppercase tracking-widest text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <Heart size={16} className="text-pink-500" /> Relatório de Doações
          </h3>
          <div className="flex gap-2">
            <button onClick={() => carregar('doacoes')}
              className="px-3 py-1.5 text-xs font-bold bg-pink-600 text-white rounded-lg hover:bg-pink-700 flex items-center gap-1 disabled:opacity-50"
              disabled={carregando === 'doacoes'}>
              {carregando === 'doacoes' ? <RefreshCw size={12} className="animate-spin" /> : <Filter size={12} />} Gerar
            </button>
            {doacoes && (
              <button onClick={() => exportarExcel((doacoes.maiores_doadores as unknown[]) as Record<string, unknown>[], 'doacoes')}
                className="px-3 py-1.5 text-xs font-bold border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1">
                <Download size={12} /> Excel
              </button>
            )}
          </div>
        </div>
        {doacoes && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Doado</p>
                <p className="text-xl font-black text-pink-600 mt-1">{moeda(Number(doacoes.total_doacoes))}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nº Doadores</p>
                <p className="text-xl font-black text-purple-600 mt-1">{String(doacoes.num_doadores)}</p>
              </div>
            </div>
            {Array.isArray(doacoes.evolucao_mensal) && doacoes.evolucao_mensal.length > 0 && (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={doacoes.evolucao_mensal as Record<string, unknown>[]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => moeda(v)} />
                  <Bar dataKey="total" name="Doações" fill="#ec4899" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>

      {/* ── Contábil ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-black text-sm uppercase tracking-widest text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <DollarSign size={16} className="text-yellow-500" /> Relatório Contábil
          </h3>
          <div className="flex gap-2">
            <button onClick={() => carregar('contabil')}
              className="px-3 py-1.5 text-xs font-bold bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center gap-1 disabled:opacity-50"
              disabled={carregando === 'contabil'}>
              {carregando === 'contabil' ? <RefreshCw size={12} className="animate-spin" /> : <Filter size={12} />} Gerar
            </button>
            {contabil.length > 0 && (
              <button onClick={() => exportarExcel(contabil as Record<string, unknown>[], 'contabil')}
                className="px-3 py-1.5 text-xs font-bold border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1">
                <Download size={12} /> Excel
              </button>
            )}
          </div>
        </div>
        {contabil.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800">
                  <th className="px-4 py-2.5 text-left font-black text-slate-500 uppercase tracking-wider">Plano de Contas</th>
                  <th className="px-4 py-2.5 text-right font-black text-slate-500 uppercase tracking-wider">Receitas</th>
                  <th className="px-4 py-2.5 text-right font-black text-slate-500 uppercase tracking-wider">Despesas</th>
                  <th className="px-4 py-2.5 text-right font-black text-slate-500 uppercase tracking-wider">Lançamentos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(contabil as Record<string, unknown>[]).map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{String(r.plano_contas || r.categoria)}</td>
                    <td className="px-4 py-2.5 text-right text-green-600 font-bold">{moeda(Number(r.total_receitas))}</td>
                    <td className="px-4 py-2.5 text-right text-red-500 font-bold">{moeda(Number(r.total_despesas))}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-400">{String(r.num_lancamentos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   ABAS ACADÊMICO
═══════════════════════════════════════════════════════════ */

function AbaAcademico() {
  const [alunos, setAlunos]         = useState<Record<string, unknown> | null>(null);
  const [academico, setAcademico]   = useState<Record<string, unknown> | null>(null);
  const [matriculas, setMatriculas] = useState<Record<string, unknown> | null>(null);
  const [carregando, setCarregando] = useState<string | null>(null);

  const carregar = useCallback(async (tipo: string) => {
    setCarregando(tipo);
    try {
      if (tipo === 'alunos') {
        const { data } = await api.get('/relatorios/academico/alunos');
        setAlunos(data);
      } else if (tipo === 'academico') {
        const { data } = await api.get('/relatorios/academico/geral');
        setAcademico(data);
      } else if (tipo === 'matriculas') {
        const { data } = await api.get('/relatorios/academico/matriculas');
        setMatriculas(data);
      }
    } catch {/* silencia */} finally { setCarregando(null); }
  }, []);

  return (
    <div className="space-y-6">
      {/* ── Alunos ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-black text-sm uppercase tracking-widest text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <Users size={16} className="text-blue-600" /> Relatório de Alunos
          </h3>
          <div className="flex gap-2">
            <button onClick={() => carregar('alunos')}
              className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50"
              disabled={carregando === 'alunos'}>
              {carregando === 'alunos' ? <RefreshCw size={12} className="animate-spin" /> : <Filter size={12} />} Gerar
            </button>
            {alunos && (
              <button onClick={() => exportarExcel((alunos.por_curso as unknown[]) as Record<string, unknown>[], 'alunos')}
                className="px-3 py-1.5 text-xs font-bold border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1">
                <Download size={12} /> Excel
              </button>
            )}
          </div>
        </div>
        {alunos && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Ativos', value: String(alunos.total_ativos) },
                { label: 'Total Inativos', value: String(alunos.total_inativos) },
                { label: 'Infantil', value: String((alunos.turnos as Record<string, unknown>[] | undefined)?.find((t) => t.turno_escolar === 'Manhã')?.total ?? 0) },
                { label: 'Noturno', value: String((alunos.turnos as Record<string, unknown>[] | undefined)?.find((t) => t.turno_escolar === 'Noite')?.total ?? 0) },
              ].map(c => (
                <div key={c.label} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{c.label}</p>
                  <p className="text-xl font-black text-blue-600 mt-1">{c.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.isArray(alunos.por_curso) && alunos.por_curso.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Por Curso</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={alunos.por_curso as Record<string, unknown>[]} dataKey="total" nameKey="cursos_matriculados" cx="50%" cy="50%" outerRadius={80} label={({ name, value }: { name: string; value: number }) => `${name}: ${value}`}>
                        {(alunos.por_curso as Record<string, unknown>[]).map((_: unknown, i: number) => (
                          <Cell key={i} fill={CORES_PIZZA[i % CORES_PIZZA.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              {Array.isArray(alunos.turnos) && alunos.turnos.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Por Turno</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={alunos.turnos as Record<string, unknown>[]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="turno_escolar" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="total" fill="#3b82f6" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Visão Geral Acadêmica ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-black text-sm uppercase tracking-widest text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <BookOpen size={16} className="text-purple-600" /> Visão Geral Acadêmica
          </h3>
          <button onClick={() => carregar('academico')}
            className="px-3 py-1.5 text-xs font-bold bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-1 disabled:opacity-50"
            disabled={carregando === 'academico'}>
            {carregando === 'academico' ? <RefreshCw size={12} className="animate-spin" /> : <Filter size={12} />} Gerar
          </button>
        </div>
        {academico && (
          <div className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Cursos', value: String(academico.total_cursos) },
                { label: 'Professores', value: String(academico.total_professores) },
                { label: 'Turmas Ativas', value: String(academico.turmas_ativas) },
                { label: 'Cards Grade', value: String(academico.cards_grade) },
              ].map(c => (
                <div key={c.label} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{c.label}</p>
                  <p className="text-2xl font-black text-purple-600 mt-1">{c.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Matrículas ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-black text-sm uppercase tracking-widest text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <BookOpen size={16} className="text-indigo-600" /> Pipeline de Matrículas
          </h3>
          <div className="flex gap-2">
            <button onClick={() => carregar('matriculas')}
              className="px-3 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1 disabled:opacity-50"
              disabled={carregando === 'matriculas'}>
              {carregando === 'matriculas' ? <RefreshCw size={12} className="animate-spin" /> : <Filter size={12} />} Gerar
            </button>
            {matriculas && (
              <button onClick={() => exportarExcel((matriculas.por_status as unknown[]) as Record<string, unknown>[], 'matriculas')}
                className="px-3 py-1.5 text-xs font-bold border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1">
                <Download size={12} /> Excel
              </button>
            )}
          </div>
        </div>
        {matriculas && (
          <div className="p-5 space-y-4">
            {Array.isArray(matriculas.por_status) && (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={matriculas.por_status as Record<string, unknown>[]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="status_matricula" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#6366f1" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   ABAS SOCIAL
═══════════════════════════════════════════════════════════ */

function AbaSocial() {
  const [impacto, setImpacto] = useState<Record<string, unknown> | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get('/relatorios/social/impacto');
      setImpacto(data);
    } catch {/* silencia */} finally { setCarregando(false); }
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-black text-sm uppercase tracking-widest text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <Globe size={16} className="text-emerald-600" /> Impacto Social — ITP
          </h3>
          <div className="flex gap-2">
            <button onClick={carregar}
              className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-1 disabled:opacity-50"
              disabled={carregando}>
              {carregando ? <RefreshCw size={12} className="animate-spin" /> : <Filter size={12} />} Gerar
            </button>
            {impacto && (
              <button onClick={() => exportarExcel([impacto as Record<string, unknown>], 'impacto_social')}
                className="px-3 py-1.5 text-xs font-bold border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1">
                <Download size={12} /> Excel
              </button>
            )}
          </div>
        </div>
        {impacto && (
          <div className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: 'Alunos Beneficiados', value: String(impacto.total_alunos_ativos), color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                { label: 'Famílias Impactadas', value: String(Math.ceil(Number(impacto.total_alunos_ativos) / 3.5)), color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
                { label: 'Doadores Ativos', value: String(impacto.doadores_ativos), color: 'text-pink-600', bg: 'bg-pink-50 dark:bg-pink-900/20' },
                { label: 'Receita Total', value: moeda(Number(impacto.receita_total)), color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
                { label: 'Total Doado', value: moeda(Number(impacto.total_doacoes)), color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20' },
                { label: 'Itens em Estoque', value: String(impacto.itens_estoque), color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
              ].map(c => (
                <div key={c.label} className={`${c.bg} rounded-2xl p-5 text-center`}>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{c.label}</p>
                  <p className={`text-2xl font-black mt-2 ${c.color}`}>{c.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   ABAS ESTOQUE
═══════════════════════════════════════════════════════════ */

function AbaEstoque() {
  const anoAtual = new Date().getFullYear();
  const mesAtual = String(new Date().getMonth() + 1).padStart(2, '0');
  const [posicao, setPosicao]   = useState<Record<string, unknown> | null>(null);
  const [movimentos, setMovimentos] = useState<Record<string, unknown> | null>(null);
  const [dataIni, setDataIni] = useState(`${anoAtual}-${mesAtual}-01`);
  const [dataFim, setDataFim] = useState(`${anoAtual}-${mesAtual}-31`);
  const [carregando, setCarregando] = useState<string | null>(null);

  const carregar = useCallback(async (tipo: string) => {
    setCarregando(tipo);
    try {
      if (tipo === 'posicao') {
        const { data } = await api.get('/relatorios/estoque/posicao');
        setPosicao(data);
      } else if (tipo === 'movimentos') {
        const { data } = await api.get(`/relatorios/estoque/movimentos?data_ini=${dataIni}&data_fim=${dataFim}`);
        setMovimentos(data);
      }
    } catch {/* silencia */} finally { setCarregando(null); }
  }, [dataIni, dataFim]);

  return (
    <div className="space-y-6">
      {/* ── Posição Atual ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-black text-sm uppercase tracking-widest text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <Package size={16} className="text-orange-500" /> Posição de Estoque
          </h3>
          <div className="flex gap-2">
            <button onClick={() => carregar('posicao')}
              className="px-3 py-1.5 text-xs font-bold bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-1 disabled:opacity-50"
              disabled={carregando === 'posicao'}>
              {carregando === 'posicao' ? <RefreshCw size={12} className="animate-spin" /> : <Filter size={12} />} Gerar
            </button>
            {posicao && (
              <button onClick={() => exportarExcel((posicao.produtos as unknown[]) as Record<string, unknown>[], 'estoque')}
                className="px-3 py-1.5 text-xs font-bold border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1">
                <Download size={12} /> Excel
              </button>
            )}
          </div>
        </div>
        {posicao && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Produtos</p>
                <p className="text-xl font-black text-orange-500 mt-1">{String(posicao.total_produtos)}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Críticos</p>
                <p className="text-xl font-black text-red-500 mt-1">{String(posicao.total_criticos)}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Valor Total</p>
                <p className="text-xl font-black text-slate-700 dark:text-slate-200 mt-1">{moeda(Number(posicao.valor_total_estoque))}</p>
              </div>
            </div>
            {Array.isArray(posicao.produtos) && posicao.produtos.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800">
                      <th className="px-3 py-2 text-left font-black text-slate-500 uppercase tracking-wider">Produto</th>
                      <th className="px-3 py-2 text-right font-black text-slate-500 uppercase tracking-wider">Qtd</th>
                      <th className="px-3 py-2 text-right font-black text-slate-500 uppercase tracking-wider">Mínimo</th>
                      <th className="px-3 py-2 text-center font-black text-slate-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(posicao.produtos as Record<string, unknown>[]).map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300 font-medium">{String(p.nome)}</td>
                        <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">{String(p.quantidade_atual)}</td>
                        <td className="px-3 py-2 text-right text-slate-500">{String(p.estoque_minimo)}</td>
                        <td className="px-3 py-2 text-center">
                          {p.critico ? (
                            <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-[10px] font-black uppercase">Crítico</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-green-100 text-green-600 rounded-full text-[10px] font-black uppercase">OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Movimentos ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-black text-sm uppercase tracking-widest text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <Package size={16} className="text-slate-500" /> Movimentos de Estoque
          </h3>
          <div className="flex flex-wrap gap-2 items-end">
            <input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-800 dark:text-slate-100" />
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-800 dark:text-slate-100" />
            <button onClick={() => carregar('movimentos')}
              className="px-3 py-1.5 text-xs font-bold bg-slate-600 text-white rounded-lg hover:bg-slate-700 flex items-center gap-1 disabled:opacity-50"
              disabled={carregando === 'movimentos'}>
              {carregando === 'movimentos' ? <RefreshCw size={12} className="animate-spin" /> : <Filter size={12} />} Gerar
            </button>
            {movimentos && (
              <button onClick={() => exportarExcel((movimentos.movimentos as unknown[]) as Record<string, unknown>[], 'movimentos_estoque')}
                className="px-3 py-1.5 text-xs font-bold border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1">
                <Download size={12} /> Excel
              </button>
            )}
          </div>
        </div>
        {movimentos && Array.isArray(movimentos.movimentos) && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800">
                  <th className="px-3 py-2 text-left font-black text-slate-500 uppercase tracking-wider">Produto</th>
                  <th className="px-3 py-2 text-center font-black text-slate-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-3 py-2 text-right font-black text-slate-500 uppercase tracking-wider">Qtd</th>
                  <th className="px-3 py-2 text-left font-black text-slate-500 uppercase tracking-wider">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(movimentos.movimentos as Record<string, unknown>[]).slice(0, 50).map((m, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{String(m.nome ?? m.produto_id)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        m.tipo === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                      }`}>{String(m.tipo)}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">{String(m.quantidade)}</td>
                    <td className="px-3 py-2 text-slate-500">{new Date(String(m.data_movimento)).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   DRE — Demonstração de Resultado do Exercício
═══════════════════════════════════════════════════════════ */

interface DreLinha { conta: string; valor: number }
interface DreGrupoDespesa { grupo: string; itens: DreLinha[]; subtotal: number }
interface DreDado {
  periodo: { ano: number; mes_ini: number; mes_fim: number };
  receitasBrutas: DreLinha[];
  totalReceitasBrutas: number;
  deducoes: DreLinha[];
  totalDeducoes: number;
  receitaLiquida: number;
  gruposDespesas: DreGrupoDespesa[];
  totalDespesas: number;
  resultadoOperacional: number;
  resultadoFinanceiro: number;
  resultadoExercicio: number;
  margem: string;
  evolucaoMensal: { mes: number; receita: number; despesa: number; resultado: number }[];
}

const MESES_PT = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function LinhaDRE({ descricao, valor, nivel = 1, negrito = false, destaque = false, inverter = false }: {
  descricao: string; valor: number; nivel?: number;
  negrito?: boolean; destaque?: boolean; inverter?: boolean;
}) {
  const cor = destaque
    ? valor >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
    : inverter
      ? 'text-red-500 dark:text-red-400'
      : 'text-slate-700 dark:text-slate-300';
  return (
    <tr className={`border-b border-slate-100 dark:border-slate-800 ${
      destaque ? 'bg-slate-50 dark:bg-slate-800/60' : ''
    }`}>
      <td className={`py-2 ${nivel === 1 ? 'pl-4' : nivel === 2 ? 'pl-8' : 'pl-12'} text-xs ${
        negrito ? 'font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide' : 'text-slate-600 dark:text-slate-400'
      }`}>{descricao}</td>
      <td className={`py-2 pr-4 text-right text-xs font-bold ${cor}`}>
        {moeda(valor)}
      </td>
    </tr>
  );
}

function AbaDRE() {
  const anoAtual = new Date().getFullYear();
  const [dre, setDre]       = useState<DreDado | null>(null);
  const [ano, setAno]       = useState(String(anoAtual));
  const [mesIni, setMesIni] = useState('1');
  const [mesFim, setMesFim] = useState('12');
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get<DreDado>(`/relatorios/financeiro/dre?ano=${ano}&mes_ini=${mesIni}&mes_fim=${mesFim}`);
      setDre(data);
    } catch {/* silencia */} finally { setCarregando(false); }
  }, [ano, mesIni, mesFim]);

  const exportar = () => {
    if (!dre) return;
    const linhas: Record<string, unknown>[] = [
      { conta: '1. RECEITAS BRUTAS', valor: '' },
      ...dre.receitasBrutas.map(r => ({ conta: `   ${r.conta}`, valor: r.valor })),
      { conta: 'TOTAL RECEITAS BRUTAS', valor: dre.totalReceitasBrutas },
      { conta: '(-) Deduções', valor: -dre.totalDeducoes },
      { conta: '= RECEITA LÍQUIDA', valor: dre.receitaLiquida },
      { conta: '' , valor: '' },
      { conta: '2. DESPESAS', valor: '' },
      ...dre.gruposDespesas.flatMap(g => [
        { conta: `   ${g.grupo}`, valor: '' },
        ...g.itens.map(i => ({ conta: `      ${i.conta}`, valor: -i.valor })),
        { conta: `   Subtotal ${g.grupo}`, valor: -g.subtotal },
      ]),
      { conta: 'TOTAL DESPESAS', valor: -dre.totalDespesas },
      { conta: '' , valor: '' },
      { conta: '= RESULTADO OPERACIONAL', valor: dre.resultadoOperacional },
      { conta: '± Resultado Financeiro', valor: dre.resultadoFinanceiro },
      { conta: '= RESULTADO DO EXERCÍCIO', valor: dre.resultadoExercicio },
      { conta: 'Margem (%)', valor: `${dre.margem}%` },
    ];
    exportarExcel(linhas, `DRE_${ano}`);
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Ano</label>
          <input type="number" value={ano} onChange={e => setAno(e.target.value)} min="2020" max="2099"
            className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm w-24 bg-white dark:bg-slate-800 dark:text-slate-100" />
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Mês Inicial</label>
          <select value={mesIni} onChange={e => setMesIni(e.target.value)}
            className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-800 dark:text-slate-100">
            {MESES_PT.slice(1).map((m,i) => <option key={i+1} value={String(i+1)}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Mês Final</label>
          <select value={mesFim} onChange={e => setMesFim(e.target.value)}
            className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-800 dark:text-slate-100">
            {MESES_PT.slice(1).map((m,i) => <option key={i+1} value={String(i+1)}>{m}</option>)}
          </select>
        </div>
        <button onClick={carregar} disabled={carregando}
          className="px-4 py-2 text-xs font-black bg-purple-600 text-white rounded-xl hover:bg-purple-700 flex items-center gap-2 disabled:opacity-50">
          {carregando ? <RefreshCw size={13} className="animate-spin" /> : <Filter size={13} />} Gerar DRE
        </button>
        {dre && (
          <button onClick={exportar}
            className="px-4 py-2 text-xs font-black border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2">
            <Download size={13} /> Exportar Excel
          </button>
        )}
      </div>

      {dre && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Receita Bruta',    valor: dre.totalReceitasBrutas, cor: 'text-blue-600' },
              { label: 'Receita Líquida',  valor: dre.receitaLiquida,     cor: 'text-green-600' },
              { label: 'Total Despesas',   valor: -dre.totalDespesas,     cor: 'text-red-500' },
              { label: 'Resultado Final',  valor: dre.resultadoExercicio,  cor: dre.resultadoExercicio >= 0 ? 'text-emerald-600' : 'text-red-500' },
            ].map(k => (
              <div key={k.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-center shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{k.label}</p>
                <p className={`text-lg font-black mt-1 ${k.cor}`}>{moeda(k.valor)}</p>
              </div>
            ))}
          </div>

          {/* DRE Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-sm uppercase tracking-widest text-slate-700 dark:text-slate-200">
                DRE — {MESES_PT[dre.periodo.mes_ini]}/{dre.periodo.ano} a {MESES_PT[dre.periodo.mes_fim]}/{dre.periodo.ano}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800">
                    <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">Descrição</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider">Valor (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Receitas */}
                  <LinhaDRE descricao="1. RECEITAS OPERACIONAIS" valor={0} nivel={1} negrito />
                  {dre.receitasBrutas.map((r,i) => (
                    <LinhaDRE key={i} descricao={r.conta} valor={r.valor} nivel={2} />
                  ))}
                  <LinhaDRE descricao="TOTAL RECEITAS BRUTAS" valor={dre.totalReceitasBrutas} nivel={1} negrito />

                  {dre.deducoes.length > 0 && (
                    <>
                      <LinhaDRE descricao="(-) DEDUÇÕES DE RECEITAS" valor={0} nivel={1} negrito />
                      {dre.deducoes.map((d,i) => (
                        <LinhaDRE key={i} descricao={d.conta} valor={-d.valor} nivel={2} inverter />
                      ))}
                    </>
                  )}

                  <LinhaDRE descricao="= RECEITA LÍQUIDA" valor={dre.receitaLiquida} nivel={1} negrito destaque />

                  {/* Despesas */}
                  <LinhaDRE descricao="2. DESPESAS" valor={0} nivel={1} negrito />
                  {dre.gruposDespesas.map((g, gi) => (
                    <React.Fragment key={gi}>
                      <LinhaDRE descricao={g.grupo} valor={0} nivel={2} negrito />
                      {g.itens.map((it, ii) => (
                        <LinhaDRE key={ii} descricao={it.conta} valor={-it.valor} nivel={3} inverter />
                      ))}
                      <LinhaDRE descricao={`Subtotal ${g.grupo}`} valor={-g.subtotal} nivel={2} negrito inverter />
                    </React.Fragment>
                  ))}
                  <LinhaDRE descricao="TOTAL DESPESAS" valor={-dre.totalDespesas} nivel={1} negrito inverter />

                  {/* Resultados */}
                  <LinhaDRE descricao="= RESULTADO OPERACIONAL" valor={dre.resultadoOperacional} nivel={1} negrito destaque />

                  {dre.resultadoFinanceiro !== 0 && (
                    <LinhaDRE descricao="± Resultado Financeiro" valor={dre.resultadoFinanceiro} nivel={2} />
                  )}

                  <LinhaDRE descricao="= RESULTADO DO EXERCÍCIO" valor={dre.resultadoExercicio} nivel={1} negrito destaque />
                  <tr className="bg-purple-50 dark:bg-purple-900/20">
                    <td className="py-2 pl-4 text-xs font-black text-purple-700 dark:text-purple-300 uppercase tracking-wide">Margem (%)</td>
                    <td className="py-2 pr-4 text-right text-xs font-black text-purple-700 dark:text-purple-300">{dre.margem}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Gráfico evolução */}
          {dre.evolucaoMensal.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-black text-sm uppercase tracking-widest text-slate-700 dark:text-slate-200">Evolução Mensal do Resultado</h3>
              </div>
              <div className="p-5">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={dre.evolucaoMensal.map(m => ({ ...m, mes: MESES_PT[m.mes] }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => moeda(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="receita" name="Receita" stroke="#7c3aed" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="despesa" name="Despesa" stroke="#f87171" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="resultado" name="Resultado" stroke="#10b981" strokeWidth={2.5} strokeDasharray="5 5" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
═══════════════════════════════════════════════════════════ */

const ABAS: { id: AbaId; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'financeiro', label: 'Financeiro',  icon: DollarSign, color: 'text-green-600' },
  { id: 'dre',        label: 'DRE',         icon: TrendingUp, color: 'text-purple-600' },
  { id: 'academico',  label: 'Acadêmico',   icon: BookOpen,   color: 'text-blue-600' },
  { id: 'social',     label: 'Social',      icon: Globe,      color: 'text-emerald-600' },
  { id: 'estoque',    label: 'Estoque',     icon: Package,    color: 'text-orange-500' },
];

export default function RelatoriosPage() {
  const [aba, setAba] = useState<AbaId>('financeiro');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 uppercase italic tracking-tight flex items-center gap-2">
            <BarChart2 size={26} className="text-purple-600" />
            Relatórios
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            Análises financeiras, acadêmicas, sociais e de estoque
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-1 w-fit">
          {ABAS.map(a => {
            const Icon = a.icon;
            return (
              <button
                key={a.id}
                onClick={() => setAba(a.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  aba === a.id
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon size={14} className={aba === a.id ? 'text-white' : a.color} />
                {a.label}
              </button>
            );
          })}
        </div>

        {/* Conteúdo */}
        {aba === 'financeiro' && <AbaFinanceiro />}
        {aba === 'dre'        && <AbaDRE />}
        {aba === 'academico'  && <AbaAcademico />}
        {aba === 'social'     && <AbaSocial />}
        {aba === 'estoque'    && <AbaEstoque />}

      </div>
    </div>
  );
}

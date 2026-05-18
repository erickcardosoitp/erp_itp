'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle, TrendingUp, CheckCircle, DollarSign, Clock } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line, CartesianGrid,
} from 'recharts';
import { useInsights } from '../hooks/useInsights';
import { STATUS_LABELS, SOURCE_TYPE_LABELS, formatBRL } from '../constants';
import type { PipelineStatus, SourceType, MonthlyEntry } from '../types';
import * as api from '../services/captacaoApi';

const PIE_COLORS = ['#7c3aed', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe', '#f5f3ff', '#6d28d9'];

export default function InsightsPage() {
  const { data, loading, error } = useInsights();
  const [monthly, setMonthly] = useState<MonthlyEntry[]>([]);

  useEffect(() => {
    api.getMonthlySubmissions().then(setMonthly).catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-purple-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300">
        <AlertCircle size={18} className="shrink-0 mt-0.5" />
        <p className="text-sm">{error ?? 'Dados indisponíveis'}</p>
      </div>
    );
  }

  const { kpis, by_pipeline_status, by_source_type } = data;

  const statusChartData = by_pipeline_status.map(d => ({
    name: STATUS_LABELS[d.status as PipelineStatus] ?? d.status,
    value: d.count,
  }));

  const sourceChartData = by_source_type.map(d => ({
    name: SOURCE_TYPE_LABELS[d.source_type as SourceType] ?? d.source_type,
    count: d.count,
    value: d.total_value,
  }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<TrendingUp size={18} />}
          label="Total no Pipeline"
          value={kpis.total}
          color="purple"
        />
        <KpiCard
          icon={<CheckCircle size={18} />}
          label="Aprovados"
          value={`${kpis.approved} (${kpis.approval_rate.toFixed(0)}%)`}
          color="green"
        />
        <KpiCard
          icon={<DollarSign size={18} />}
          label="Valor Potencial"
          value={formatBRL(kpis.value_potential)}
          color="blue"
        />
        <KpiCard
          icon={<Clock size={18} />}
          label="Vencendo em 30d"
          value={kpis.expiring_30d}
          color={kpis.expiring_30d > 0 ? 'orange' : 'slate'}
        />
      </div>

      {/* KPIs secundários */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard
          icon={<DollarSign size={18} />}
          label="Valor Submetido"
          value={formatBRL(kpis.value_submitted)}
          color="blue"
        />
        <KpiCard
          icon={<CheckCircle size={18} />}
          label="Valor Aprovado"
          value={formatBRL(kpis.value_approved)}
          color="green"
        />
        <KpiCard
          icon={<TrendingUp size={18} />}
          label="Score Médio IA"
          value={kpis.avg_score.toFixed(0)}
          color="purple"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline por status */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
          <h3 className="text-sm font-black text-slate-700 dark:text-slate-200">Pipeline por Status</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusChartData} layout="vertical" margin={{ left: 8 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
              <Tooltip
                formatter={(v: number) => [v, 'Oportunidades']}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="value" fill="#7c3aed" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Por tipo de fonte */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
          <h3 className="text-sm font-black text-slate-700 dark:text-slate-200">Por Tipo de Fonte</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={sourceChartData}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {sourceChartData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number, name: string) => [v, name]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Valores por fonte */}
      {sourceChartData.some(d => d.value > 0) && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
          <h3 className="text-sm font-black text-slate-700 dark:text-slate-200">Valor Potencial por Fonte</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sourceChartData}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => formatBRL(v)} />
              <Tooltip
                formatter={(v: number) => [formatBRL(v), 'Valor']}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="value" fill="#a78bfa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Evolução mensal */}
      {monthly.length > 1 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
          <h3 className="text-sm font-black text-slate-700 dark:text-slate-200">Oportunidades Adicionadas por Mês</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip
                formatter={(v: number) => [v, 'Oportunidades']}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Line type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

    </div>
  );
}

function KpiCard({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: 'purple' | 'green' | 'blue' | 'orange' | 'slate';
}) {
  const styles = {
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    slate: 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  }[color];

  return (
    <div className={`rounded-2xl border p-4 space-y-2 ${styles}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">{label}</span>
      </div>
      <p className="text-2xl font-black">{value}</p>
    </div>
  );
}

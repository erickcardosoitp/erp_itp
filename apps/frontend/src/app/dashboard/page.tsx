'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, GraduationCap, TrendingDown, DollarSign,
  MapPin, Heart, TrendingUp, ShieldCheck,
  AlertTriangle, ArrowUpRight, Calendar, RefreshCw
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, LabelList 
} from 'recharts';
import api from '@/services/api';

// --- CONFIGURAÇÃO DE DESIGN ---
const PIE_COLORS = ['#2e1065', '#8b5cf6', '#facc15', '#94a3b8', '#e11d48', '#10b981'];

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function ultimos6Meses() {
  const hoje = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - 5 + i, 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`, label: MESES_ABREV[d.getMonth()] };
  });
}

export default function DashboardEstrategico() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [alunos,       setAlunos]       = useState<any[]>([]);
  const [alunosStats, setAlunosStats]  = useState<{ ativos: number; inativos: number; total: number } | null>(null);
  const [cursos,       setCursos]       = useState<any[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<any[]>([]);
  const [alertasCandidatos, setAlertasCandidatos] = useState<any[]>([]);
  const [faltasRecentes, setFaltasRecentes] = useState<any[]>([]);
  const [nps, setNps] = useState<{ nps: number | null; total_respostas: number; pesquisa_titulo?: string } | null>(null);
  const [carregando,   setCarregando]   = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [ra, rst, rc, rm, rca, rnps, rfc] = await Promise.allSettled([
        api.get('/academico/alunos'),
        api.get('/academico/alunos/stats'),
        api.get('/academico/cursos'),
        api.get('/financeiro/movimentacoes'),
        api.get('/academico/presenca/alertas-candidatos'),
        api.get('/pesquisas/nps'),
        api.get('/academico/presenca/faltas-recentes', { params: { limite: 5 } }),
      ]);
      if (ra.status === 'fulfilled') setAlunos(ra.value.data ?? []);
      if (rst.status === 'fulfilled') setAlunosStats(rst.value.data);
      if (rc.status === 'fulfilled') setCursos(rc.value.data ?? []);
      if (rm.status === 'fulfilled') setMovimentacoes(rm.value.data ?? []);
      if (rca.status === 'fulfilled') setAlertasCandidatos(rca.value.data ?? []);
      if (rnps.status === 'fulfilled') setNps(rnps.value.data);
      if (rfc.status === 'fulfilled') setFaltasRecentes(rfc.value.data ?? []);
    } catch { /* silencioso */ }
    setCarregando(false);
  }, []);

  const dadosFinanceiros = useMemo(() => {
    const meses = ultimos6Meses();
    return meses.map(({ key, label }) => {
      const movMes = movimentacoes.filter(m => {
        const d = m.data ? String(m.data).slice(0, 7) : '';
        return d === key;
      });
      const entradas = movMes
        .filter(m => /receita|entrada/i.test(m.tipo_movimentacao ?? ''))
        .reduce((s, m) => s + Number(m.valor ?? 0), 0);
      const saidas = movMes
        .filter(m => /despesa|saída|saida/i.test(m.tipo_movimentacao ?? ''))
        .reduce((s, m) => s + Number(m.valor ?? 0), 0);
      return { mes: label, entradas: Math.round(entradas), saidas: Math.round(saidas) };
    });
  }, [movimentacoes]);

  const dadosBairros = useMemo(() => {
    const contagem: Record<string, number> = {};
    alunos.forEach(a => {
      const b = (a.bairro || 'Não informado').trim();
      contagem[b] = (contagem[b] || 0) + 1;
    });
    const ordenado = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
    const top4 = ordenado.slice(0, 4);
    const outrosTotal = ordenado.slice(4).reduce((s, [, v]) => s + v, 0);
    const total = alunos.length || 1;
    const lista = top4.map(([name, v], i) => ({
      name, value: Math.round((v / total) * 100), color: PIE_COLORS[i],
    }));
    if (outrosTotal > 0) lista.push({ name: 'Outros', value: Math.round((outrosTotal / total) * 100), color: '#94a3b8' });
    return lista;
  }, [alunos]);

  const dadosCursos = useMemo(() => {
    const contagem: Record<string, number> = {};
    alunos.forEach(a => {
      const raw = a.cursos_matriculados ?? '';
      if (!raw.trim()) return;
      raw.split(/[,;/\n]+/).forEach((c: string) => {
        const nome = c.trim();
        if (nome) contagem[nome] = (contagem[nome] || 0) + 1;
      });
    });
    return Object.entries(contagem)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([nome, alunos]) => ({ nome, alunos }));
  }, [alunos]);

  const alunosAtivos  = useMemo(() => alunosStats?.ativos  ?? alunos.length, [alunosStats, alunos]);
  const alunosInativos= useMemo(() => alunosStats?.inativos ?? 0,            [alunosStats]);
  const totalAlunos   = useMemo(() => alunosStats?.total   ?? alunos.length, [alunosStats, alunos]);
  const cursosAtivos  = useMemo(() => cursos.filter(c => /ativo/i.test(c.status ?? '')).length || cursos.length, [cursos]);
  const taxaEvasao    = useMemo(() => totalAlunos ? ((alunosInativos / totalAlunos) * 100).toFixed(1) + '%' : '–', [totalAlunos, alunosInativos]);

  const saldoMesAtual = useMemo(() => {
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2,'0')}`;
    const movMes = movimentacoes.filter(m => String(m.data ?? '').slice(0, 7) === mesAtual);
    const entradas = movMes.filter(m => /receita|entrada/i.test(m.tipo_movimentacao ?? '')).reduce((s, m) => s + Number(m.valor ?? 0), 0);
    const saidas   = movMes.filter(m => /despesa|saída|saida/i.test(m.tipo_movimentacao ?? '')).reduce((s, m) => s + Number(m.valor ?? 0), 0);
    const saldo    = entradas - saidas;
    if (!entradas && !saidas) return null;
    return { valor: saldo, label: saldo >= 0 ? `+R$ ${(saldo/1000).toFixed(1)}k` : `-R$ ${(Math.abs(saldo)/1000).toFixed(1)}k`, positivo: saldo >= 0 };
  }, [movimentacoes]);

  // Garante que o Recharts só renderize no cliente (evita erro de hidratação/dimensão)
  useEffect(() => {
    setIsMounted(true);
    carregar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isMounted) return <div className="min-h-screen bg-slate-50 dark:bg-[#131b2e]" />;

  const mesAtual = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#131b2e] p-4 md:p-8 font-sans antialiased text-slate-900 dark:text-slate-100">
      <div className="max-w-[1600px] mx-auto">
        
        {/* HEADER COM STORYTELLING */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-purple-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">
                {carregando ? 'Carregando...' : 'Live Insights'}
              </span>
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                <Calendar size={12} /> {mesAtual}
              </span>
              <button onClick={carregar} disabled={carregando}
                className="flex items-center gap-1 text-[9px] font-black text-slate-400 hover:text-purple-600 uppercase disabled:opacity-50">
                <RefreshCw size={10} className={carregando ? 'animate-spin' : ''} />
              </button>
            </div>
            <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter italic">
              Dash<span className="text-purple-600">.ITP</span>
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Visão Geral e Indicadores Estratégicos</p>
          </div>

          <div className="flex gap-4 bg-white p-3 rounded-3xl shadow-sm border border-slate-100">
            <HeaderStat label="NPS Comunitário" value={nps?.nps != null ? String(nps.nps) : '–'} icon={Heart} color="text-rose-500" />
            <div className="w-[1px] bg-slate-100 h-10 self-center" />
            <HeaderStat label="Taxa de Retenção" value={totalAlunos ? (100 - parseFloat(taxaEvasao)).toFixed(1) + '%' : '–'} icon={ShieldCheck} color="text-emerald-500" />
          </div>
        </header>

        {/* LINHA 1: KPIs DE IMPACTO */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <KpiCard title="Alunos Ativos" value={carregando ? '...' : String(alunosAtivos)} trend={totalAlunos ? `${alunosAtivos} de ${totalAlunos}` : '–'} icon={Users} color="bg-purple-900" />
          <KpiCard title="Evasão" value={carregando ? '...' : taxaEvasao} trend={alunosInativos ? `-${alunosInativos} alunos` : 'Estável'} icon={TrendingDown} color="bg-rose-600" isNegative />
          <KpiCard title="Cursos Ativos" value={carregando ? '...' : String(cursosAtivos || '–')} trend="Estável" icon={GraduationCap} color="bg-amber-500" />
          <KpiCard title="Saldo do Mês" value={carregando ? '...' : (saldoMesAtual?.label ?? (movimentacoes.length ? 'R$ 0' : '–'))} trend={saldoMesAtual?.positivo ? 'Superávit' : (saldoMesAtual ? 'Déficit' : 'Sem dados')} icon={DollarSign} color="bg-emerald-600" isNegative={!saldoMesAtual?.positivo} />
        </div>

        {/* LINHA 2: GRÁFICOS ESTRATÉGICOS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          
          {/* FINANCEIRO: O Storytelling do Orçamento */}
          <section className="lg:col-span-2 bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 relative overflow-hidden">
            <div className="flex justify-between items-center mb-8 relative z-10">
              <div>
                <h3 className="text-sm font-black uppercase flex items-center gap-2 italic">
                  <TrendingUp size={18} className="text-emerald-500" /> Fluxo Financeiro — Últimos 6 Meses
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Entradas vs Saídas por mês</p>
              </div>
              <div className="flex gap-4 text-[10px] font-black uppercase">
                 <span className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500 rounded-full" /> Entradas</span>
                 <span className="flex items-center gap-1 border-l pl-4"><div className="w-2 h-2 bg-rose-400 rounded-full" /> Saídas</span>
              </div>
            </div>
            
            <div className="h-[350px] w-full">
              {movimentacoes.length === 0 && !carregando ? (
                <div className="flex items-center justify-center h-full text-slate-300 text-sm font-bold">
                  Nenhuma movimentação registrada ainda.
                </div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dadosFinanceiros}>
                  <defs>
                    <linearGradient id="colorEnt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSai" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e11d48" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#e11d48" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: '900', fill: '#94a3b8'}} />
                  <YAxis hide />
                  <Tooltip 
                    formatter={(v: any) => `R$ ${Number(v).toLocaleString('pt-BR')}`}
                    contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '15px'}}
                  />
                  <Area type="monotone" dataKey="entradas" name="Entradas" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorEnt)" />
                  <Area type="monotone" dataKey="saidas" name="Saídas" stroke="#e11d48" strokeWidth={2} strokeDasharray="8 8" fillOpacity={1} fill="url(#colorSai)" />
                </AreaChart>
              </ResponsiveContainer>
              )}
            </div>
          </section>

          {/* LOCALIZAÇÃO: Onde está o ITP? */}
          <section className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
            <h3 className="text-sm font-black uppercase mb-8 flex items-center gap-2 italic">
              <MapPin size={18} className="text-purple-600" /> Mapa de Presença
            </h3>
            {dadosBairros.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-slate-300 text-sm font-bold text-center">
                {carregando ? 'Carregando...' : 'Sem dados de bairro dos alunos.'}
              </div>
            ) : (
            <>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={dadosBairros} 
                    innerRadius={60} 
                    outerRadius={85} 
                    paddingAngle={8} 
                    dataKey="value"
                    cornerRadius={8}
                  >
                    {dadosBairros.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => `${v}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {dadosBairros.map((b) => (
                <div key={b.name} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
                  <div className="w-1.5 h-5 rounded-full shrink-0" style={{backgroundColor: b.color}} />
                  <div className="min-w-0">
                    <p className="text-[9px] font-black text-slate-400 uppercase leading-none truncate">{b.name}</p>
                    <p className="text-xs font-black text-slate-800">{b.value}%</p>
                  </div>
                </div>
              ))}
            </div>
            </>
            )}
          </section>
        </div>

        {/* LINHA 3: CURSOS E ALERTAS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* ALUNOS POR CURSO */}
          <section className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
            <h3 className="text-sm font-black uppercase mb-8 italic">Engajamento por Categoria</h3>
            {dadosCursos.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-slate-300 text-sm font-bold text-center">
                {carregando ? 'Carregando...' : 'Nenhum dado de curso nos alunos.'}
              </div>
            ) : (
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosCursos} layout="vertical" margin={{ left: 20, right: 40 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="nome" type="category" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: '900'}} width={90} />
                  <Tooltip cursor={{fill: 'transparent'}} formatter={(v: any) => [`${v} alunos`, 'Alunos']} />
                  <Bar dataKey="alunos" fill="#2e1065" radius={[0, 10, 10, 0]} barSize={22}>
                     <LabelList dataKey="alunos" position="right" style={{fontSize: '11px', fontWeight: '900', fill: '#2e1065'}} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            )}
          </section>

          {/* ALERTAS CRÍTICOS (Social Storytelling) */}
          <section className="bg-purple-950 p-8 rounded-[40px] shadow-xl text-white">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-sm font-black uppercase flex items-center gap-2 italic">
                <AlertTriangle size={18} className="text-amber-400" /> Alertas de Atenção Social
              </h3>
              <span className="bg-white/10 px-3 py-1 rounded-full text-[9px] font-black">ATENÇÃO</span>
            </div>
            
            <div className="space-y-4">
              {faltasRecentes.map((a: any) => (
                <AlertItem
                  key={a.aluno_id}
                  name={a.nome_completo}
                  bairro={a.turma_nome || 'Sem turma'}
                  msg={`${a.total_faltas} falta${a.total_faltas > 1 ? 's' : ''} nos últimos 30 dias. Frequência: ${a.pct_presenca != null ? Number(a.pct_presenca).toFixed(0) + '%' : '–'}`}
                />
              ))}
              {alunosInativos > 0 && (
                <AlertItem
                  name={`${alunosInativos} aluno${alunosInativos > 1 ? 's' : ''} inativo${alunosInativos > 1 ? 's' : ''}`}
                  bairro="Evasão"
                  msg={`Taxa de evasão: ${taxaEvasao}. Verifique os alunos e entre em contato com as famílias.`}
                />
              )}
              {alunos.filter((a: any) => a.cuidado_especial && a.cuidado_especial !== 'Não' && a.cuidado_especial !== 'null').slice(0, 2).map((a: any) => (
                <AlertItem
                  key={a.id}
                  name={a.nome_completo}
                  bairro={a.bairro || '–'}
                  msg={a.detalhes_cuidado || `Requer atenção especial: ${a.cuidado_especial}.`}
                />
              ))}
              {alertasCandidatos.slice(0, 2).map((a: any) => (
                <AlertItem
                  key={a.inscricao_id}
                  name={a.pessoa_nome || `Candidato #${a.inscricao_id}`}
                  bairro="Candidato"
                  msg={`Presente em "${a.tema_aula || 'aula'}" em ${a.data ? new Date(a.data + 'T12:00:00').toLocaleDateString('pt-BR') : '–'}. ${a.turma_nome ? 'Turma: ' + a.turma_nome : ''}`}
                />
              ))}
              {faltasRecentes.length === 0 && alunosInativos === 0 && alunos.filter((a: any) => a.cuidado_especial && a.cuidado_especial !== 'Não' && a.cuidado_especial !== 'null').length === 0 && alertasCandidatos.length === 0 && (
                <div className="bg-white/5 border border-white/10 p-4 rounded-3xl text-center">
                  <p className="text-sm text-slate-300 font-bold">Nenhum alerta no momento.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Todos os alunos estão ativos e presentes.</p>
                </div>
              )}
            </div>

            <button
              onClick={() => router.push('/academico')}
              className="w-full mt-6 py-4 bg-purple-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-500 transition-colors">
              Ver Monitoramento Acadêmico
            </button>
          </section>
        </div>

      </div>
    </div>
  );
}

// --- SUB-COMPONENTES ESTRUTURADOS ---

function KpiCard({ title, value, trend, icon: Icon, color, isNegative }: any) {
  return (
    <div className="bg-white p-6 rounded-[35px] shadow-sm border border-slate-100 hover:shadow-lg transition-all group">
      <div className="flex justify-between items-start mb-6">
        <div className={`p-4 rounded-2xl text-white ${color} shadow-lg shadow-opacity-20 transition-transform group-hover:scale-110`}>
          <Icon size={24} />
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg ${isNegative ? 'text-rose-600 bg-rose-50' : 'text-emerald-600 bg-emerald-50'}`}>
          {trend} <ArrowUpRight size={10} />
        </div>
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
      <h2 className="text-4xl font-black text-slate-900 tracking-tighter">{value}</h2>
    </div>
  );
}

function HeaderStat({ label, value, icon: Icon, color }: any) {
  return (
    <div className="flex flex-col items-end px-2">
      <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5 leading-none">{label}</p>
      <div className={`flex items-center gap-1.5 ${color}`}>
        <Icon size={16} fill="currentColor" className="opacity-70" />
        <span className="text-xl font-black tracking-tighter">{value}</span>
      </div>
    </div>
  );
}

function AlertItem({ name, bairro, msg }: any) {
  return (
    <div className="bg-white/5 border border-white/10 p-4 rounded-3xl hover:bg-white/10 transition-colors">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-black uppercase tracking-tight">{name}</span>
        <span className="text-[9px] font-bold text-purple-300 uppercase">{bairro}</span>
      </div>
      <p className="text-[11px] text-slate-300 font-medium leading-relaxed">{msg}</p>
    </div>
  );
}

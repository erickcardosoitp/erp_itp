'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, GraduationCap, TrendingDown, DollarSign, 
  MapPin, Heart, Target, TrendingUp, ShieldCheck,
  AlertTriangle, ArrowUpRight, Calendar
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, LabelList 
} from 'recharts';

// --- CONFIGURAÇÃO DE DESIGN (Storytelling Colors) ---
const COLORS = {
  primary: '#2e1065', // Roxo ITP
  secondary: '#facc15', // Amarelo Matrículas
  success: '#22c55e',
  danger: '#e11d48',
  accent: '#8b5cf6',
  muted: '#94a3b8'
};

// --- MOCKS ESTRATÉGICOS (Baseados no seu ecossistema) ---
const dadosFinanceiros = [
  { mes: 'Out', realizado: 8200, projetado: 8000 },
  { mes: 'Nov', realizado: 9100, projetado: 9500 },
  { mes: 'Dez', realizado: 7500, projetado: 7500 },
  { mes: 'Jan', realizado: 10200, projetado: 9000 },
  { mes: 'Fev', realizado: 12400, projetado: 10000 },
];

const dadosBairros = [
  { name: 'Vaz Lobo', value: 45, color: '#2e1065' },
  { name: 'Madureira', value: 32, color: '#8b5cf6' },
  { name: 'D. Caxias', value: 18, color: '#facc15' },
  { name: 'Outros', value: 12, color: '#94a3b8' },
];

const dadosCursos = [
  { nome: 'Jiu-Jitsu', alunos: 85 },
  { nome: 'Reforço', alunos: 120 },
  { nome: 'Informática', alunos: 64 },
  { nome: 'Inglês', alunos: 42 },
];

export default function DashboardEstrategico() {
  const [isMounted, setIsMounted] = useState(false);

  // Garante que o Recharts só renderize no cliente (evita erro de hidratação/dimensão)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return <div className="min-h-screen bg-slate-50" />;

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 font-sans antialiased text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        
        {/* HEADER COM STORYTELLING */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-purple-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">
                Live Insights
              </span>
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                <Calendar size={12} /> Março 2026
              </span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter italic">
              Visão <span className="text-purple-600">Estratégica</span>
            </h1>
            <p className="text-slate-500 font-bold text-xs uppercase tracking-tight">Instituto Todos Por Um • Unidade Rio de Janeiro</p>
          </div>

          <div className="flex gap-4 bg-white p-3 rounded-3xl shadow-sm border border-slate-100">
            <HeaderStat label="NPS Comunitário" value="4.9" icon={Heart} color="text-rose-500" />
            <div className="w-[1px] bg-slate-100 h-10 self-center" />
            <HeaderStat label="Taxa de Retenção" value="97.6%" icon={ShieldCheck} color="text-emerald-500" />
          </div>
        </header>

        {/* LINHA 1: KPIs DE IMPACTO */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <KpiCard title="Alunos Ativos" value="142" trend="+12%" icon={Users} color="bg-purple-900" />
          <KpiCard title="Evasão" value="2.4%" trend="-0.8%" icon={TrendingDown} color="bg-rose-600" isNegative />
          <KpiCard title="Cursos Ativos" value="08" trend="Estável" icon={GraduationCap} color="bg-amber-500" />
          <KpiCard title="Desvio Orç." value="+R$ 2.4k" trend="Superávit" icon={DollarSign} color="bg-emerald-600" />
        </div>

        {/* LINHA 2: GRÁFICOS ESTRATÉGICOS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          
          {/* FINANCEIRO: O Storytelling do Orçamento */}
          <section className="lg:col-span-2 bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 relative overflow-hidden">
            <div className="flex justify-between items-center mb-8 relative z-10">
              <div>
                <h3 className="text-sm font-black uppercase flex items-center gap-2 italic">
                  <TrendingUp size={18} className="text-emerald-500" /> Fluxo Financeiro Projetado
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Realizado vs Meta de Arrecadação</p>
              </div>
              <div className="flex gap-4 text-[10px] font-black uppercase">
                 <span className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500 rounded-full" /> Realizado</span>
                 <span className="flex items-center gap-1 border-l pl-4"><div className="w-2 h-2 bg-slate-300 rounded-full" /> Projetado</span>
              </div>
            </div>
            
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dadosFinanceiros}>
                  <defs>
                    <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: '900', fill: '#94a3b8'}} />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '15px'}}
                  />
                  <Area type="monotone" dataKey="realizado" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorReal)" />
                  <Area type="monotone" dataKey="projetado" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="8 8" fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* LOCALIZAÇÃO: Onde está o ITP? */}
          <section className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
            <h3 className="text-sm font-black uppercase mb-8 flex items-center gap-2 italic">
              <MapPin size={18} className="text-purple-600" /> Mapa de Presença
            </h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={dadosBairros} 
                    innerRadius={70} 
                    outerRadius={95} 
                    paddingAngle={8} 
                    dataKey="value"
                    cornerRadius={8}
                  >
                    {dadosBairros.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {dadosBairros.map((b) => (
                <div key={b.name} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
                  <div className="w-1.5 h-6 rounded-full" style={{backgroundColor: b.color}} />
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase leading-none">{b.name}</p>
                    <p className="text-xs font-black text-slate-800">{b.value}%</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* LINHA 3: CURSOS E ALERTAS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* ALUNOS POR CURSO */}
          <section className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
            <h3 className="text-sm font-black uppercase mb-8 italic">Engajamento por Categoria</h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosCursos} layout="vertical" margin={{ left: 20, right: 40 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="nome" type="category" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: '900'}} />
                  <Tooltip cursor={{fill: 'transparent'}} />
                  <Bar dataKey="alunos" fill="#2e1065" radius={[0, 10, 10, 0]} barSize={24}>
                     <LabelList dataKey="alunos" position="right" style={{fontSize: '12px', fontWeight: '900', fill: '#2e1065'}} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* ALERTAS CRÍTICOS (Social Storytelling) */}
          <section className="bg-purple-950 p-8 rounded-[40px] shadow-xl text-white">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-sm font-black uppercase flex items-center gap-2 italic">
                <AlertTriangle size={18} className="text-amber-400" /> Alertas de Atenção Social
              </h3>
              <span className="bg-white/10 px-3 py-1 rounded-full text-[9px] font-black">2 CASOS CRÍTICOS</span>
            </div>
            
            <div className="space-y-4">
              <AlertItem 
                name="Anthony Eduardo" 
                bairro="Madureira" 
                msg="Espectro autista. Requer suporte fonoaudiológico este mês." 
              />
              <AlertItem 
                name="Maria Eduarda" 
                bairro="Vaz Lobo" 
                msg="Frequência escolar abaixo de 75%. Necessário contato familiar." 
              />
            </div>
            
            <button className="w-full mt-6 py-4 bg-purple-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-500 transition-colors">
              Ver todos os relatórios sociais
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
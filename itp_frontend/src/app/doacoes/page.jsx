'use client';

import React, { useState, useEffect } from 'react';
import { 
  Heart, Users, Building2, TrendingUp, HandHelping, 
  Search, Filter, Calendar, MoreHorizontal, 
  ArrowUpRight, Target, ShieldCheck, CreditCard,
  QrCode, PieChart, UserPlus
} from 'lucide-react';

export default function GestaoDoacoesPro() {
  const [activeTab, setActiveTab] = useState('recorrentes');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const doacoes = [
    { id: 1, nome: 'Tech Solutions LTDA', tipo: 'PJ', valor: 2500.00, metodo: 'Pix', status: 'confirmado', recorrência: 'Mensal' },
    { id: 2, nome: 'Ana Maria Ferreira', tipo: 'PF', valor: 150.00, metodo: 'Cartão', status: 'confirmado', recorrência: 'Única' },
    { id: 3, nome: 'Roberto Carlos Jr', tipo: 'PF', valor: 50.00, metodo: 'Boleto', status: 'pendente', recorrência: 'Mensal' },
  ];

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-[#FDFDFF] p-6 lg:p-10 font-sans">
      <div className="max-w-[1500px] mx-auto space-y-8">
        
        {/* HEADER ESTRUTURADO */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-rose-500 p-3 rounded-2xl shadow-lg shadow-rose-500/20">
              <Heart className="text-white" size={28} fill="currentColor" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-slate-900 uppercase italic tracking-tighter">
                Captação<span className="text-rose-500">.ITP</span>
              </h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck size={14} className="text-rose-500" /> Gestão de Impacto e Transparência
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="bg-white border-2 border-slate-100 text-slate-600 px-6 py-4 rounded-2xl font-black text-[10px] uppercase hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
              <PieChart size={16} /> Relatórios
            </button>
            <button className="bg-rose-500 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase shadow-xl shadow-rose-500/20 border-b-4 border-rose-700 active:translate-y-1 active:border-b-0 transition-all flex items-center gap-3">
              <UserPlus size={18} strokeWidth={3} /> Registrar Novo Doador
            </button>
          </div>
        </header>

        {/* DASHBOARD DE MÉTRICAS (KPIs) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiDoacao label="Doador Pessoa Física" count="128" color="blue" icon={Users} trend="+12% este mês" />
          <KpiDoacao label="Doador Pessoa Jurídica" count="14" color="purple" icon={Building2} trend="Meta: 20" />
          <KpiDoacao label="Arrecadação Mensal" count="R$ 18.4k" color="rose" icon={TrendingUp} trend="82% da meta" />
          <div className="bg-slate-900 p-8 rounded-[40px] text-white flex flex-col justify-between shadow-2xl relative overflow-hidden">
            <Target className="absolute -right-4 -bottom-4 text-white/10" size={120} />
            <p className="text-[10px] font-black uppercase text-slate-400">Meta de Expansão</p>
            <div className="mt-4">
              <div className="flex justify-between mb-2">
                <span className="text-2xl font-black italic tracking-tighter">R$ 25.000</span>
                <span className="text-xs font-black text-rose-400">74%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 w-[74%] rounded-full shadow-[0_0_10px_#f43f5e]" />
              </div>
            </div>
          </div>
        </div>

        {/* FERRAMENTAS DE GESTÃO */}
        <section className="bg-white rounded-[40px] border border-slate-100 shadow-xl overflow-hidden min-h-[500px]">
          
          {/* TABS DE NAVEGAÇÃO INTERNA */}
          <div className="flex border-b border-slate-50 overflow-x-auto">
             <TabButton id="recorrentes" active={activeTab} set={setActiveTab} label="Recorrentes" />
             <TabButton id="pj" active={activeTab} set={setActiveTab} label="Parceiros PJ" />
             <TabButton id="campanhas" active={activeTab} set={setActiveTab} label="Campanhas" />
             <TabButton id="metodos" active={activeTab} set={setActiveTab} label="Meios de Pagamento" />
          </div>

          <div className="p-8">
            <div className="flex flex-col md:flex-row justify-between gap-4 mb-8">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-3.5 text-slate-300" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar doador por nome ou ID..." 
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-transparent focus:border-rose-100 focus:bg-white rounded-2xl text-xs font-bold outline-none transition-all"
                />
              </div>
              <div className="flex gap-2">
                 <button className="bg-slate-50 p-4 rounded-2xl text-slate-400 hover:text-rose-500 transition-all"><Filter size={20}/></button>
                 <button className="bg-slate-50 p-4 rounded-2xl text-slate-400 hover:text-rose-500 transition-all"><Calendar size={20}/></button>
              </div>
            </div>

            {/* TABELA DE DOADORES */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="px-6 py-4">Doador</th>
                    <th className="px-6 py-4">Fidelidade</th>
                    <th className="px-6 py-4">Método</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Contribuição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {doacoes.map((d) => (
                    <tr key={d.id} className="group hover:bg-rose-50/30 transition-all cursor-pointer">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-black text-xs ${d.tipo === 'PJ' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                            {d.tipo}
                          </div>
                          <div>
                            <div className="font-black text-slate-900 uppercase text-xs italic">{d.nome}</div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">ID: #00{d.id}99</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${d.recorrência === 'Mensal' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                          {d.recorrência}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-slate-500 font-black text-[10px] uppercase">
                          {d.metodo === 'Pix' ? <QrCode size={14}/> : <CreditCard size={14}/>} {d.metodo}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase ${d.status === 'confirmado' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-amber-100 text-amber-600'}`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right font-black text-slate-900 italic">
                        R$ {d.valor.toLocaleString('pt-br', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FOOTER DA PÁGINA */}
          <div className="bg-slate-50 p-6 flex flex-col md:flex-row justify-between items-center border-t border-slate-100 gap-4">
             <div className="flex items-center gap-3">
                <div className="h-2 w-2 bg-emerald-500 rounded-full animate-ping" />
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sincronizado com o financeiro em tempo real</p>
             </div>
             <div className="flex gap-2">
                <button className="text-rose-500 font-black text-[10px] uppercase px-4 py-2 hover:bg-rose-50 rounded-xl transition-all">Exportar Planilha (XLS)</button>
                <button className="text-slate-500 font-black text-[10px] uppercase px-4 py-2 hover:bg-slate-200 rounded-xl transition-all">Ver Histórico Geral</button>
             </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// --- SUB-COMPONENTES ---

function KpiDoacao({ label, count, color, icon: Icon, trend }) {
  const themes = {
    blue: 'text-blue-600 bg-blue-50',
    purple: 'text-purple-600 bg-purple-50',
    rose: 'text-rose-600 bg-rose-50',
  };
  return (
    <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-xl transition-all">
      <div className="flex justify-between items-start">
        <div className={`p-3 rounded-2xl ${themes[color]}`}><Icon size={22} /></div>
        <span className="text-[9px] font-black text-emerald-500 uppercase italic">{trend}</span>
      </div>
      <div className="mt-6">
        <p className="text-3xl font-black text-slate-900 tracking-tighter italic">{count}</p>
        <p className="text-[10px] font-black text-slate-400 uppercase mt-2 tracking-widest">{label}</p>
      </div>
    </div>
  );
}

function TabButton({ id, active, set, label }) {
  const isActive = active === id;
  return (
    <button 
      onClick={() => set(id)}
      className={`px-8 py-6 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
        isActive 
        ? 'border-rose-500 text-rose-500 bg-rose-50/20' 
        : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}
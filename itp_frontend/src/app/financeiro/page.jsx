'use client';

import React, { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, TrendingDown, Landmark, 
  FileText, ArrowUpRight, ArrowDownLeft, Receipt, 
  Search, Filter, Plus, Download, CheckCircle2, 
  Clock, AlertCircle, RefreshCcw, BarChart3
} from 'lucide-react';

export default function FinanceiroOperacional() {
  // Estado para controlar qual ferramenta está ativa
  const [activeTab, setActiveTab] = useState('movimentacoes');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 font-sans antialiased text-slate-900">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* HEADER OPERACIONAL */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
          <div>
            <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">
              Financeiro <span className="text-emerald-600">.ITP</span>
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              Gestão de Fluxo de Caixa e Obrigações
            </p>
          </div>

          <div className="flex gap-3">
            <button className="bg-rose-50 text-rose-600 px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase border border-rose-100 hover:bg-rose-100 transition-all">
              - Registrar Saída
            </button>
            <button className="bg-emerald-500 text-white px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all">
              + Registrar Entrada
            </button>
          </div>
        </header>

        {/* BARRA DE FERRAMENTAS (KPI NAVIGATION) */}
        <nav className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <ToolCard 
            id="movimentacoes" active={activeTab} set={setActiveTab} 
            label="Movimentações" count="152" icon={RefreshCcw} color="blue" 
          />
          <ToolCard 
            id="contas_pagar" active={activeTab} set={setActiveTab} 
            label="Contas a Pagar" count="R$ 12k" icon={TrendingDown} color="rose" 
          />
          <ToolCard 
            id="contas_receber" active={activeTab} set={setActiveTab} 
            label="Contas a Receber" count="R$ 45k" icon={TrendingUp} color="emerald" 
          />
          <ToolCard 
            id="plano_contas" active={activeTab} set={setActiveTab} 
            label="Plano de Contas" count="DRE" icon={BarChart3} color="purple" 
          />
          <ToolCard 
            id="conciliacao" active={activeTab} set={setActiveTab} 
            label="Conciliação" count="8 pend." icon={Landmark} color="amber" 
          />
          <ToolCard 
            id="boletos" active={activeTab} set={setActiveTab} 
            label="Boletos" count="Gerar" icon={Receipt} color="slate" 
          />
        </nav>

        {/* ÁREA DE TRABALHO DINÂMICA */}
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl overflow-hidden min-h-[500px]">
          
          {/* BARRA DE FILTRO INTERNA */}
          <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row justify-between gap-4 bg-slate-50/50">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-3 text-slate-300" size={18} />
              <input 
                type="text" 
                placeholder={`Pesquisar em ${activeTab}...`} 
                className="w-full pl-12 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex gap-2">
              <button className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase text-slate-500 flex items-center gap-2 hover:bg-slate-50">
                <Filter size={14} /> Filtros
              </button>
              <button className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase text-slate-500 flex items-center gap-2 hover:bg-slate-50">
                <Download size={14} /> Exportar
              </button>
            </div>
          </div>

          {/* CONTEÚDO DA TABELA - EXEMPLO: MOVIMENTAÇÕES */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-8 py-6 border-b border-slate-100">Vencimento / Data</th>
                  <th className="px-8 py-6 border-b border-slate-100">Descrição / Favorecido</th>
                  <th className="px-8 py-6 border-b border-slate-100">Categoria</th>
                  <th className="px-8 py-6 border-b border-slate-100 text-center">Status</th>
                  <th className="px-8 py-6 border-b border-slate-100 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {/* Exemplo de Linha de Saída */}
                <tr className="hover:bg-slate-50/80 transition-all cursor-pointer group">
                  <td className="px-8 py-5">
                    <div className="text-xs font-black text-slate-900">15/03/2026</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Competência: Fev/26</div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="text-xs font-black text-slate-700 uppercase italic">Pagamento Concessionária Luz</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase">Enel Distribuição</div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-[9px] font-black uppercase">Infraestrutura</span>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className="bg-rose-50 text-rose-600 px-4 py-1.5 rounded-full text-[9px] font-black uppercase border border-rose-100">
                      Pendente
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right font-black text-rose-600 italic">
                    - R$ 1.450,00
                  </td>
                </tr>

                {/* Exemplo de Linha de Entrada */}
                <tr className="hover:bg-slate-50/80 transition-all cursor-pointer group">
                  <td className="px-8 py-5">
                    <div className="text-xs font-black text-slate-900">02/03/2026</div>
                    <div className="text-[9px] text-emerald-500 font-bold uppercase tracking-tighter italic">Confirmado Hoje</div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="text-xs font-black text-slate-700 uppercase italic">Mensalidade - Aluno #1250</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase">João Ricardo Silva</div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase">Mensalidades</span>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className="bg-emerald-500 text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase shadow-sm">
                      Liquidado
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right font-black text-emerald-600 italic">
                    + R$ 250,00
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          {/* FOOTER DA ÁREA DE TRABALHO */}
          <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
            <div className="flex gap-8">
              <div>
                <p className="text-[9px] font-black uppercase text-slate-400">Total Previsto</p>
                <p className="text-xl font-black italic">R$ 52.400,00</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-rose-400">Total Pago</p>
                <p className="text-xl font-black italic">R$ 12.300,00</p>
              </div>
            </div>
            <button className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl transition-all">
              Conciliar Selecionados
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Sub-componente de Botão de Ferramenta (Estilo KPI)
function ToolCard({ id, active, set, label, count, icon: Icon, color }) {
  const isActive = active === id;
  
  const theme = {
    blue: 'text-blue-600 bg-blue-50',
    rose: 'text-rose-600 bg-rose-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    purple: 'text-purple-600 bg-purple-50',
    amber: 'text-amber-600 bg-amber-50',
    slate: 'text-slate-600 bg-slate-50',
  };

  return (
    <button 
      onClick={() => set(id)}
      className={`p-6 rounded-[32px] border-2 transition-all duration-300 text-left flex flex-col gap-4 shadow-sm group ${
        isActive 
        ? 'bg-purple-950 border-purple-950 text-white -translate-y-2 shadow-2xl' 
        : `bg-white border-slate-50 hover:border-slate-200`
      }`}
    >
      <div className={`p-3 rounded-2xl w-fit ${isActive ? 'bg-purple-600 text-white' : theme[color]}`}>
        <Icon size={20} strokeWidth={isActive ? 3 : 2} />
      </div>
      <div>
        <p className={`text-[9px] font-black uppercase tracking-widest ${isActive ? 'text-purple-300' : 'text-slate-400'}`}>
          {label}
        </p>
        <p className="text-xl font-black tracking-tighter italic">
          {count}
        </p>
      </div>
    </button>
  );
}
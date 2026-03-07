'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Briefcase, GraduationCap, Package, 
  Plus, Search, ChevronRight, Settings2, 
  UserPlus, BookOpen, Truck, ShieldCheck,
  MoreHorizontal, Zap, Filter, FilterX, ArrowUpRight
} from 'lucide-react';

// --- CONFIGURAÇÃO DE TIPOS ---
type TabId = 'funcionarios' | 'cursos' | 'insumos' | 'usuarios';

interface MockItem {
  id: number;
  nome: string;
  categoria: string;
  subtexto: string;
  status: 'Ativo' | 'Pendente' | 'Alerta';
  unidade: string;
}

export default function CadastroBasicoSistemico() {
  const [activeTab, setActiveTab] = useState<TabId>('funcionarios');
  const [isMounted, setIsMounted] = useState(false);
  
  // Estados de Filtro (Padronizado com Matrículas)
  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroUnidade, setFiltroUnidade] = useState('');

  useEffect(() => { setIsMounted(true); }, []);

  // --- MOCK DATA ESTRUTURADO ---
  const mockData: Record<TabId, MockItem[]> = useMemo(() => ({
    funcionarios: [
      { id: 1, nome: 'Dr. Ricardo Silva', categoria: 'Professor', subtexto: 'Robótica Avançada', status: 'Ativo', unidade: 'Rio de Janeiro' },
      { id: 2, nome: 'Ana Paula Souza', categoria: 'Coordenação', subtexto: 'Pedagógico Central', status: 'Ativo', unidade: 'Madureira' },
    ],
    cursos: [
      { id: 101, nome: 'Fullstack Next.js', categoria: 'Tecnologia', subtexto: '120h - Noturno', status: 'Ativo', unidade: 'Rio de Janeiro' },
      { id: 102, nome: 'Jiu-Jitsu Comunitário', categoria: 'Esporte', subtexto: 'Grade Sábado', status: 'Alerta', unidade: 'Vaz Lobo' },
    ],
    insumos: [
      { id: 501, nome: 'Kits Lego Education', categoria: 'Hardware', subtexto: 'Estoque: 12 unidades', status: 'Pendente', unidade: 'Rio de Janeiro' },
    ],
    usuarios: [
      { id: 901, nome: 'admin_itp', categoria: 'Root', subtexto: 'Acesso Total', status: 'Ativo', unidade: 'Sede' },
    ],
  }), []);

  // Lógica de Filtro Síncrono
  const dadosFiltrados = useMemo(() => {
    return mockData[activeTab].filter(item => {
      const matchBusca = item.nome.toLowerCase().includes(filtroBusca.toLowerCase());
      const matchStatus = filtroStatus === '' || item.status === filtroStatus;
      const matchUnidade = filtroUnidade === '' || item.unidade === filtroUnidade;
      return matchBusca && matchStatus && matchUnidade;
    });
  }, [activeTab, filtroBusca, filtroStatus, filtroUnidade, mockData]);

  if (!isMounted) return <div className="min-h-screen bg-[#F8FAFC]" />;

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 font-sans antialiased text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        
        {/* TAG DE PROTÓTIPO (Padrão ITP) */}
        <div className="fixed -right-12 top-10 rotate-45 bg-yellow-400 text-purple-950 px-12 py-1 font-black text-[10px] uppercase tracking-[0.3em] shadow-xl z-50 border-b-2 border-yellow-600 select-none">
          Ambiente Protótipo
        </div>

        {/* HEADER COM STORYTELLING */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-purple-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">
                Configurações de Core
              </span>
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                <Settings2 size={12} /> Gestão de Mestres e Infra
              </span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter italic">
              Cadastro <span className="text-purple-600">Básico</span>
            </h1>
          </div>

          <button className="bg-yellow-400 text-purple-950 px-8 py-4 rounded-2xl font-black text-[11px] uppercase flex items-center gap-3 hover:bg-yellow-300 transition-all shadow-xl shadow-yellow-500/20 border-b-4 border-yellow-600 active:translate-y-1 active:border-b-0">
            <Plus size={18} strokeWidth={3} /> Novo {activeTab.slice(0,-1)}
          </button>
        </header>

        {/* KPIs DE NAVEGAÇÃO (Tabs Estilizadas como KPI) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <TabKpi label="Funcionários" id="funcionarios" active={activeTab} set={setActiveTab} icon={Briefcase} count={mockData.funcionarios.length} />
          <TabKpi label="Cursos" id="cursos" active={activeTab} set={setActiveTab} icon={GraduationCap} count={mockData.cursos.length} />
          <TabKpi label="Insumos" id="insumos" active={activeTab} set={setActiveTab} icon={Package} count={mockData.insumos.length} />
          <TabKpi label="Usuários" id="usuarios" active={activeTab} set={setActiveTab} icon={Users} count={mockData.usuarios.length} />
        </div>

        {/* BARRA DE FILTROS PADRONIZADA */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 bg-white p-6 rounded-[30px] shadow-sm border border-slate-100 items-end">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Buscar por Nome</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 text-slate-300" size={14} />
              <input 
                type="text" 
                value={filtroBusca}
                onChange={(e) => setFiltroBusca(e.target.value)}
                placeholder="Ex: Dr. Ricardo..." 
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500" 
              />
            </div>
          </div>

          <FilterSelect label="Status" value={filtroStatus} set={setFiltroStatus}>
            <option value="">Todos</option>
            <option value="Ativo">Ativo</option>
            <option value="Alerta">Alerta</option>
            <option value="Pendente">Pendente</option>
          </FilterSelect>

          <FilterSelect label="Unidade" value={filtroUnidade} set={setFiltroUnidade}>
            <option value="">Todas Unidades</option>
            <option value="Rio de Janeiro">Rio de Janeiro</option>
            <option value="Madureira">Madureira</option>
            <option value="Vaz Lobo">Vaz Lobo</option>
          </FilterSelect>

          <button 
            onClick={() => { setFiltroBusca(''); setFiltroStatus(''); setFiltroUnidade(''); }}
            className="flex items-center justify-center gap-2 text-rose-500 font-black text-[10px] uppercase py-3 hover:bg-rose-50 rounded-xl transition-colors"
          >
            <FilterX size={14} /> Limpar Filtros
          </button>
        </div>

        {/* TABELA DE DADOS PADRONIZADA */}
        <div className="bg-white rounded-[40px] shadow-xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 uppercase text-[10px] font-black tracking-widest border-b border-slate-100">
                  <th className="px-8 py-6">Identificação / Categoria</th>
                  <th className="px-8 py-6 text-center">Unidade</th>
                  <th className="px-8 py-6 text-center">Status</th>
                  <th className="px-8 py-6 text-right">Gestão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {dadosFiltrados.map((item) => (
                  <tr key={item.id} className="hover:bg-purple-50/40 transition-all group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-yellow-400 font-black text-[10px]">
                          #{item.id}
                        </div>
                        <div>
                          <div className="font-black text-slate-900 uppercase text-xs">{item.nome}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                            {item.categoria} • <span className="italic">{item.subtexto}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                       <span className="text-[10px] font-black text-slate-600 uppercase bg-slate-100 px-3 py-1 rounded-lg">
                        {item.unidade}
                       </span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase shadow-sm border ${
                        item.status === 'Ativo' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                        item.status === 'Alerta' ? 'bg-rose-50 text-rose-600 border-rose-100' : 
                        'bg-amber-50 text-amber-600 border-amber-100'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button className="p-2 hover:bg-white hover:shadow-md rounded-xl text-slate-300 hover:text-purple-600 transition-all border border-transparent hover:border-slate-100">
                        <MoreHorizontal size={20} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

// --- SUB-COMPONENTES AUXILIARES ---

function TabKpi({ label, id, active, set, icon: Icon, count }: any) {
  const isActive = active === id;
  return (
    <button 
      onClick={() => set(id)}
      className={`p-5 rounded-3xl border transition-all duration-300 flex items-center gap-4 group ${
        isActive ? 'bg-purple-950 border-purple-950 text-white shadow-2xl scale-105' : 'bg-white border-slate-100 hover:shadow-md text-slate-500'
      }`}
    >
      <div className={`p-3 rounded-2xl flex items-center justify-center transition-colors ${isActive ? 'bg-purple-600' : 'bg-slate-50 group-hover:bg-purple-50 group-hover:text-purple-600'}`}>
        <Icon size={20} />
      </div>
      <div className="text-left">
        <p className={`text-[9px] font-black uppercase tracking-widest leading-none mb-1 ${isActive ? 'text-purple-300' : 'text-slate-400'}`}>{label}</p>
        <p className="text-2xl font-black tracking-tighter">{count.toString().padStart(2, '0')}</p>
      </div>
    </button>
  );
}

function FilterSelect({ label, value, set, children }: any) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{label}</label>
      <select 
        value={value} 
        onChange={(e) => set(e.target.value)}
        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-700 uppercase outline-none focus:ring-2 focus:ring-purple-500 transition-all"
      >
        {children}
      </select>
    </div>
  );
}
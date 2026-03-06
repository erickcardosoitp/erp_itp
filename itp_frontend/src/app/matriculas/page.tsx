"use client";
import React, { useState, useEffect, useMemo } from 'react';
// ✅ IMPORTANTE: Instância configurada com porta 3001 e Credentials
import api from '@/services/api'; 
import * as XLSX from 'xlsx';
import { 
  Search, Download, UserCheck, ChevronDown, Filter,
  Users, Clock, ShieldAlert, CheckCircle2, FilterX 
} from 'lucide-react';
import DossieCandidato from '../../components/DossieCandidato';

export default function GestaoMatriculas() {
  const [matriculas, setMatriculas] = useState<any[]>([]);
  const [candidatoSelecionado, setCandidatoSelecionado] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Estados de Filtro
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroBairro, setFiltroBairro] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  // ✅ Busca sincronizada com o Backend ITP (Porta 3001)
  const fetchMatriculas = async () => {
    setLoading(true);
    try {
      const response = await api.get('/matriculas');
      const dados = Array.isArray(response.data) ? response.data : [];
      setMatriculas(dados);
    } catch (error: any) {
      console.error("❌ Erro na requisição de matrículas:", error.response?.status || error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchMatriculas(); 
  }, []);

  // FILTRO SÍNCRONO: Bairros dependem da Cidade selecionada
  const bairrosDisponiveis = useMemo(() => {
    const listaBase = filtroCidade 
      ? matriculas.filter(m => (m.cidade || m.Cidade) === filtroCidade) 
      : matriculas;
    return [...new Set(listaBase.map(m => m.bairro || m.Bairro))].filter(Boolean).sort() as string[];
  }, [filtroCidade, matriculas]);

  // KPIs dinâmicos com useMemo
  const stats = useMemo(() => ({
    total: matriculas.length,
    pendentes: matriculas.filter(m => m.status_matricula === 'Pendente').length,
    aguardandoLgpd: matriculas.filter(m => m.status_matricula === 'Aguardando Assinatura LGPD').length,
    emValidacao: matriculas.filter(m => m.status_matricula === 'Em Validação').length,
    matriculados: matriculas.filter(m => m.status_matricula === 'Matriculado').length,
  }), [matriculas]);

  // Lógica de Filtro Case-Insensitive
  const dadosFiltrados = useMemo(() => {
    return matriculas.filter(m => {
      const valNome = (m.nome_completo || '').toLowerCase();
      const valCidade = (m.cidade || m.Cidade || '');
      const valBairro = (m.bairro || m.Bairro || '');
      const valStatus = m.status_matricula || '';

      return (
        valNome.includes(filtroNome.toLowerCase()) &&
        (filtroCidade === '' || valCidade === filtroCidade) &&
        (filtroBairro === '' || valBairro === filtroBairro) &&
        (filtroStatus === '' || valStatus === filtroStatus)
      );
    });
  }, [matriculas, filtroNome, filtroCidade, filtroBairro, filtroStatus]);

  const handleExport = (formato: 'xlsx' | 'csv' | 'json') => {
    const dataToExport = dadosFiltrados.map(m => ({
      ID: m.id,
      Nome: m.nome_completo,
      CPF: m.cpf,
      Cidade: m.cidade || m.Cidade || 'N/I',
      Bairro: m.bairro || m.Bairro || 'N/I',
      Curso: m.cursos_desejados || 'Não informado',
      Status: m.status_matricula,
      LGPD: m.lgpd_aceito ? 'Sim' : 'Não',
      Data_Inscricao: m.createdAt || m.created_at ? new Date(m.createdAt || m.created_at).toLocaleDateString('pt-BR') : '---'
    }));

    if (formato === 'json') {
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; 
      a.download = `matriculas_itp_${Date.now()}.json`; a.click();
    } else {
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Dados");
      XLSX.writeFile(wb, `matriculas_itp_${Date.now()}.${formato}`);
    }
    setShowExportMenu(false);
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Pendente': return { bg: '#facc15', text: '#422006' };
      case 'Aguardando Assinatura LGPD': return { bg: '#ff8c00', text: '#fff' };
      case 'Em Validação': return { bg: '#3b82f6', text: '#fff' };
      case 'Matriculado': return { bg: '#22c55e', text: '#fff' };
      case 'Cancelado': return { bg: '#000', text: '#fff' };
      case 'Desistente': return { bg: '#64748b', text: '#fff' };
      default: return { bg: '#e2e8f0', text: '#475569' };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans antialiased">
      <div className="max-w-[1600px] mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-purple-950">
              Gestão de Matrículas
            </h1>
            <p className="text-gray-600 font-bold text-xs uppercase tracking-widest mt-1">Portal Administrativo ITP</p>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-lg bg-purple-600 hover:scale-105 transition-all">
              <Download size={16} /> Exportar Base <ChevronDown size={14} className={showExportMenu ? 'rotate-180' : ''}/>
            </button>
            
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                {['xlsx', 'csv', 'json'].map((ext) => (
                  <button key={ext} onClick={() => handleExport(ext as any)} className="w-full text-left px-5 py-3 text-[10px] font-black uppercase hover:bg-purple-50 transition-colors border-b last:border-0 border-gray-50">
                    Arquivo .{ext}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <KPICard title="Total Inscritos" value={stats.total} icon={<Users size={20}/>} color="#2e1065" onClick={() => setFiltroStatus('')} isActive={filtroStatus === ''} />
          <KPICard title="Pendentes" value={stats.pendentes} icon={<Clock size={20}/>} color="#eab308" onClick={() => setFiltroStatus('Pendente')} isActive={filtroStatus === 'Pendente'} />
          <KPICard title="Assinatura LGPD" value={stats.aguardandoLgpd} icon={<ShieldAlert size={20}/>} color="#ff8c00" onClick={() => setFiltroStatus('Aguardando Assinatura LGPD')} isActive={filtroStatus === 'Aguardando Assinatura LGPD'} />
          <KPICard title="Matriculados" value={stats.matriculados} icon={<CheckCircle2 size={20}/>} color="#22c55e" onClick={() => setFiltroStatus('Matriculado')} isActive={filtroStatus === 'Matriculado'} />
        </div>

        {/* FILTROS */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 items-end">
          <FilterGroup label="Buscar Candidato">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={14} />
              <input type="text" value={filtroNome} placeholder="Nome..." className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500" onChange={(e) => setFiltroNome(e.target.value)} />
            </div>
          </FilterGroup>

          <FilterGroup label="Cidade">
            <select value={filtroCidade} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-700 uppercase outline-none" onChange={(e) => { setFiltroCidade(e.target.value); setFiltroBairro(''); }}>
              <option value="">Todas</option>
              {[...new Set(matriculas.map(m => m.cidade || m.Cidade))].filter(Boolean).sort().map((c: any) => <option key={c} value={c}>{c}</option>)}
            </select>
          </FilterGroup>

          <FilterGroup label="Bairro" isSincrono={!!filtroCidade}>
            <select value={filtroBairro} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-700 uppercase outline-none" onChange={(e) => setFiltroBairro(e.target.value)}>
              <option value="">Todos</option>
              {bairrosDisponiveis.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </FilterGroup>

          <FilterGroup label="Status">
            <select value={filtroStatus} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-700 uppercase outline-none" onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="">Todos Status</option>
              <option value="Pendente">Pendente</option>
              <option value="Aguardando Assinatura LGPD">Aguardando LGPD</option>
              <option value="Em Validação">Em Validação</option>
              <option value="Matriculado">Matriculado</option>
            </select>
          </FilterGroup>

          <div className="flex items-center pb-1">
            <button onClick={() => {setFiltroNome(''); setFiltroCidade(''); setFiltroBairro(''); setFiltroStatus('');}}
              className="flex items-center gap-2 text-red-500 font-black text-[10px] uppercase hover:underline">
              <FilterX size={14} /> Limpar
            </button>
          </div>
        </div>

        {/* TABELA */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black tracking-widest border-b border-gray-100">
                  <th className="px-6 py-5">Candidato / CPF</th>
                  <th className="px-6 py-5">Localização</th>
                  <th className="px-6 py-5 text-center">Inscrição</th>
                  <th className="px-6 py-5 text-center">Status</th>
                  <th className="px-6 py-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                   <tr><td colSpan={5} className="py-10 text-center text-gray-400 font-black uppercase text-xs animate-pulse italic">Sincronizando com Servidor ITP...</td></tr>
                ) : dadosFiltrados.length > 0 ? (
                  dadosFiltrados.map((m, idx) => {
                    const statusStyle = getStatusStyle(m.status_matricula);
                    return (
                      <tr key={m.id || idx} className="hover:bg-purple-50/30 transition-all group">
                        <td className="px-6 py-4">
                          <div className="font-black text-gray-800 uppercase text-xs">{m.nome_completo}</div>
                          <div className="text-[10px] text-gray-400 font-bold">{m.cpf}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-700 uppercase text-[11px]">
                            {m.cidade || m.Cidade || "N/I"}
                          </div>
                          <div className="text-[10px] text-gray-400 italic">
                            {m.bairro || m.Bairro || "Não inf."}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-mono text-[11px] font-bold text-gray-600">
                          {m.createdAt || m.created_at ? new Date(m.createdAt || m.created_at).toLocaleDateString('pt-BR') : '---'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase shadow-sm" style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}>
                            {m.status_matricula || 'Pendente'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => { setCandidatoSelecionado(m); setIsModalOpen(true); }}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 rounded-xl text-purple-900 font-black text-[10px] uppercase hover:bg-yellow-400 transition-all border border-gray-200 shadow-sm"
                          >
                            <UserCheck size={14} /> FICHA
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-400 font-bold uppercase text-xs italic">Nenhum registro encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {isModalOpen && candidatoSelecionado && (
        <DossieCandidato 
          aluno={candidatoSelecionado} 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={fetchMatriculas} 
        />
      )}
    </div>
  );
}

// Componentes Auxiliares
function KPICard({ title, value, icon, color, onClick, isActive }: any) {
  return (
    <div onClick={onClick} className={`cursor-pointer p-5 rounded-2xl border transition-all duration-300 flex items-center gap-4 hover:shadow-md ${isActive ? 'bg-white border-purple-500 scale-105 ring-2 ring-purple-100' : 'bg-white border-gray-100'}`}>
      <div className="p-3 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: color }}>{icon}</div>
      <div>
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">{title}</p>
        <p className="text-2xl font-black text-gray-800 tracking-tighter">{value}</p>
      </div>
    </div>
  );
}

function FilterGroup({ label, children, isSincrono }: any) {
  return (
    <div className="flex flex-col gap-2 relative">
      <div className="flex items-center gap-1">
        <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{label}</label>
        {isSincrono && <Filter size={10} className="text-purple-600 animate-pulse" />}
      </div>
      {children}
    </div>
  );
}
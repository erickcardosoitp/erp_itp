"use client";
import React, { useState, useEffect, useMemo } from 'react';
// ✅ IMPORTANTE: Instância configurada com porta 3001 e Credentials
import api from '@/services/api'; 
// xlsx carregado dinamicamente apenas ao exportar (evita ~1 MB no bundle inicial)
import { 
  Search, Download, UserCheck, ChevronDown, Filter,
  Users, Clock, ShieldAlert, CheckCircle2, FilterX, ChevronsUpDown, ChevronUp,
  FileText, FileCheck2, AlertCircle, UserX, Ban, ChevronRight
} from 'lucide-react';

// Formata datas com segurança (evita "Invalid Date")
function fmtDateSafe(v?: string | null): string {
  if (!v) return '---';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v; // já está em DD/MM/YYYY
  // Só adiciona T12:00:00 se for data pura (YYYY-MM-DD sem hora)
  const s = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v + 'T12:00:00' : v;
  const d = new Date(s);
  return isNaN(d.getTime()) ? '---' : d.toLocaleDateString('pt-BR');
}
import dynamic from 'next/dynamic';

// Carregado sob demanda: só compila quando o modal é aberto pela 1ª vez
const DossieCandidato = dynamic(() => import('@/components/DossieCandidato'), { ssr: false });

export default function GestaoMatriculas() {
  const [matriculas, setMatriculas] = useState<any[]>([]);
  const [candidatoSelecionado, setCandidatoSelecionado] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Ordenação
  type SortKey = 'nome_completo' | 'cidade' | 'data_inscricao' | 'status_matricula';
  const [sortKey, setSortKey] = useState<SortKey>('nome_completo');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(prev => !prev);
    else { setSortKey(key); setSortAsc(true); }
  };
  
  // Estados de Filtro
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroCpf, setFiltroCpf] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroBairro, setFiltroBairro] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroSexo, setFiltroSexo] = useState('');
  const [filtroAlergia, setFiltroAlergia] = useState('');
  const [showMoreKPIs, setShowMoreKPIs] = useState(false);

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
    aguardandoDocs: matriculas.filter(m => m.status_matricula === 'Aguardando Documentos').length,
    documentosEnviados: matriculas.filter(m => m.status_matricula === 'Documentos Enviados').length,
    matriculados: matriculas.filter(m => m.status_matricula === 'Matriculado').length,
    incompletos: matriculas.filter(m => m.status_matricula === 'Incompleto').length,
    desistentes: matriculas.filter(m => m.status_matricula === 'Desistente').length,
    cancelados: matriculas.filter(m => m.status_matricula === 'Cancelado').length,
  }), [matriculas]);

  // Lógica de Filtro Case-Insensitive
  const dadosFiltrados = useMemo(() => {
    const filtered = matriculas.filter(m => {
      const valNome = (m.nome_completo || '').toLowerCase();
      const valCpf  = (m.cpf || '').replace(/\D/g, '');
      const valCidade = (m.cidade || m.Cidade || '');
      const valBairro = (m.bairro || m.Bairro || '');
      const valStatus = m.status_matricula || '';
      const valSexo = (m.sexo || '').toLowerCase();
      const temAlergia = m.possui_alergias ? 'sim' : 'não';
      return (
        valNome.includes(filtroNome.toLowerCase()) &&
        (filtroCpf === '' || valCpf.includes(filtroCpf.replace(/\D/g, ''))) &&
        (filtroCidade === '' || valCidade === filtroCidade) &&
        (filtroBairro === '' || valBairro === filtroBairro) &&
        (filtroStatus === '' || valStatus === filtroStatus) &&
        (filtroSexo === '' || valSexo === filtroSexo.toLowerCase()) &&
        (filtroAlergia === '' || temAlergia === filtroAlergia)
      );
    });

    const statusOrder: Record<string, number> = {
      'Pendente': 1, 'Aguardando Assinatura LGPD': 2,
      'Em Validação': 3, 'Aguardando Documentos': 4,
      'Documentos Enviados': 5, 'Matriculado': 6,
      'Incompleto': 7, 'Desistente': 8, 'Cancelado': 9,
    };

    return [...filtered].sort((a: any, b: any) => {
      let va: any, vb: any;
      if (sortKey === 'data_inscricao') {
        va = new Date(a.createdAt || a.created_at || 0).getTime();
        vb = new Date(b.createdAt || b.created_at || 0).getTime();
        return sortAsc ? va - vb : vb - va;
      }
      if (sortKey === 'status_matricula') {
        va = statusOrder[a.status_matricula] ?? 99;
        vb = statusOrder[b.status_matricula] ?? 99;
        return sortAsc ? va - vb : vb - va;
      }
      va = ((sortKey === 'cidade' ? (a.cidade || a.Cidade) : a[sortKey]) || '').toLowerCase();
      vb = ((sortKey === 'cidade' ? (b.cidade || b.Cidade) : b[sortKey]) || '').toLowerCase();
      return sortAsc ? va.localeCompare(vb, 'pt-BR') : vb.localeCompare(va, 'pt-BR');
    });
  }, [matriculas, filtroNome, filtroCpf, filtroCidade, filtroBairro, filtroStatus, filtroSexo, filtroAlergia, sortKey, sortAsc]);

  const handleExport = async (formato: 'xlsx' | 'csv' | 'json') => {
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
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Dados");
      XLSX.writeFile(wb, `matriculas_itp_${Date.now()}.${formato}`);
    }
    setShowExportMenu(false);
  };

  // Paleta de cores fundamentada em UX de workflow:
  // Cinza = neutro/aguardando | Laranja = ação do candidato | Azul = processamento interno
  // Verde = sucesso | Vermelho = problema | Cinza-escuro = saída passiva
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Pendente':                     return { bg: '#94a3b8', text: '#fff' };  // slate-400 — neutro recebido
      case 'Aguardando Assinatura LGPD':   return { bg: '#f97316', text: '#fff' };  // orange-500 — ação do candidato
      case 'Em Validação':                 return { bg: '#3b82f6', text: '#fff' };  // blue-500  — processamento admin
      case 'Aguardando Documentos':        return { bg: '#f59e0b', text: '#fff' };  // amber-500 — ação do candidato
      case 'Documentos Enviados':          return { bg: '#0891b2', text: '#fff' };  // cyan-600  — recebido p/ análise
      case 'Matriculado':                  return { bg: '#16a34a', text: '#fff' };  // green-600 — concluído
      case 'Incompleto':                   return { bg: '#dc2626', text: '#fff' };  // red-600   — bloqueado
      case 'Desistente':                   return { bg: '#64748b', text: '#fff' };  // slate-500 — saída voluntária
      case 'Cancelado':                    return { bg: '#7f1d1d', text: '#fff' };  // red-950   — cancelado
      default:                             return { bg: '#e2e8f0', text: '#475569' };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#131b2e] p-8 font-sans antialiased text-slate-900 dark:text-slate-100">
      <div className="max-w-[1600px] mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic text-slate-900">
              Matrículas<span className="text-purple-600">.ITP</span>
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Portal de Inscrições e Gestão de Alunos</p>
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

        {/* ── KPIs ─────────────────────────────────────────────────────────────── */}
        <div className="mb-8 space-y-3">

          {/* RAIA 1 — Pipeline Ativo */}
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-purple-400 mb-2 pl-1">Pipeline Ativo</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <KPICard title="Total" value={stats.total} icon={<Users size={18}/>} color="#2e1065" onClick={() => setFiltroStatus('')} isActive={filtroStatus === ''} />
              <KPICard title="Pendentes" value={stats.pendentes} icon={<Clock size={18}/>} color="#94a3b8" onClick={() => setFiltroStatus('Pendente')} isActive={filtroStatus === 'Pendente'} />
              <KPICard title="Ag. LGPD" value={stats.aguardandoLgpd} icon={<ShieldAlert size={18}/>} color="#f97316" onClick={() => setFiltroStatus('Aguardando Assinatura LGPD')} isActive={filtroStatus === 'Aguardando Assinatura LGPD'} />
              <KPICard title="Em Validação" value={stats.emValidacao} icon={<UserCheck size={18}/>} color="#3b82f6" onClick={() => setFiltroStatus('Em Validação')} isActive={filtroStatus === 'Em Validação'} />
              <KPICard title="Ag. Documentos" value={stats.aguardandoDocs} icon={<FileText size={18}/>} color="#f59e0b" onClick={() => setFiltroStatus('Aguardando Documentos')} isActive={filtroStatus === 'Aguardando Documentos'} />
              <KPICard title="Docs Enviados" value={stats.documentosEnviados} icon={<FileCheck2 size={18}/>} color="#0891b2" onClick={() => setFiltroStatus('Documentos Enviados')} isActive={filtroStatus === 'Documentos Enviados'} />
              <KPICard title="Matriculados" value={stats.matriculados} icon={<CheckCircle2 size={18}/>} color="#16a34a" onClick={() => setFiltroStatus('Matriculado')} isActive={filtroStatus === 'Matriculado'} />
            </div>
          </div>

          {/* RAIA 2 — Saídas (oculta por padrão) */}
          <div>
            <button
              onClick={() => setShowMoreKPIs(v => !v)}
              className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors pl-1 mb-2"
            >
              <ChevronDown size={12} className={`transition-transform duration-200 ${showMoreKPIs ? 'rotate-180' : ''}`} />
              {showMoreKPIs ? 'Ocultar Saídas' : 'Mostrar Saídas'}
              <span className="ml-1 px-1.5 py-px bg-slate-100 rounded-full text-slate-500">
                {stats.incompletos + stats.desistentes + stats.cancelados}
              </span>
            </button>

            {showMoreKPIs && (
              <div className="grid grid-cols-3 gap-3">
                <KPICard title="Incompletos" value={stats.incompletos} icon={<AlertCircle size={18}/>} color="#dc2626" onClick={() => setFiltroStatus('Incompleto')} isActive={filtroStatus === 'Incompleto'} />
                <KPICard title="Desistentes" value={stats.desistentes} icon={<UserX size={18}/>} color="#64748b" onClick={() => setFiltroStatus('Desistente')} isActive={filtroStatus === 'Desistente'} />
                <KPICard title="Cancelados" value={stats.cancelados} icon={<Ban size={18}/>} color="#7f1d1d" onClick={() => setFiltroStatus('Cancelado')} isActive={filtroStatus === 'Cancelado'} />
              </div>
            )}
          </div>

        </div>

        {/* FILTROS */}
        <div className="mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 items-end">
            <FilterGroup label="Nome">
              <div className="relative">
                <Search className="absolute left-3 top-3 text-gray-400" size={12} />
                <input type="text" value={filtroNome} placeholder="Nome..." className="w-full pl-8 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500" onChange={(e) => setFiltroNome(e.target.value)} />
              </div>
            </FilterGroup>

            <FilterGroup label="CPF">
              <div className="relative">
                <Search className="absolute left-3 top-3 text-gray-400" size={12} />
                <input type="text" value={filtroCpf} placeholder="CPF..." className="w-full pl-8 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500" onChange={(e) => setFiltroCpf(e.target.value)} />
              </div>
            </FilterGroup>

            <FilterGroup label="Cidade">
              <select value={filtroCidade} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-700 uppercase outline-none" onChange={(e) => { setFiltroCidade(e.target.value); setFiltroBairro(''); }}>
                <option value="">Todas</option>
                {[...new Set(matriculas.map((m: any) => m.cidade || m.Cidade))].filter(Boolean).sort().map((c: any) => <option key={c} value={c}>{c}</option>)}
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
                <option value="Aguardando Assinatura LGPD">Ag. LGPD</option>
                <option value="Em Validação">Em Validação</option>
                <option value="Aguardando Documentos">Ag. Documentos</option>
                <option value="Documentos Enviados">Docs Enviados</option>
                <option value="Matriculado">Matriculado</option>
                <option value="Incompleto">Incompleto</option>
                <option value="Desistente">Desistente</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </FilterGroup>

            <FilterGroup label="Sexo">
              <select value={filtroSexo} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-700 uppercase outline-none" onChange={(e) => setFiltroSexo(e.target.value)}>
                <option value="">Todos</option>
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
                <option value="Outro">Outro</option>
              </select>
            </FilterGroup>

            <FilterGroup label="Alergia">
              <select value={filtroAlergia} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-700 uppercase outline-none" onChange={(e) => setFiltroAlergia(e.target.value)}>
                <option value="">Todos</option>
                <option value="sim">Possui</option>
                <option value="não">Não possui</option>
              </select>
            </FilterGroup>
          </div>
          <div className="flex justify-end mt-3">
            <button onClick={() => { setFiltroNome(''); setFiltroCpf(''); setFiltroCidade(''); setFiltroBairro(''); setFiltroStatus(''); setFiltroSexo(''); setFiltroAlergia(''); }}
              className="flex items-center gap-2 text-red-400 hover:text-red-600 font-black text-[10px] uppercase transition-colors">
              <FilterX size={12} /> Limpar Filtros
            </button>
          </div>
        </div>

        {/* TABELA */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left table-fixed">
              <colgroup>
                <col className="w-[34%]" />
                <col className="w-[20%]" />
                <col className="w-[13%]" />
                <col className="w-[19%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black tracking-widest border-b border-gray-100">
                  <SortTh label="Candidato / CPF" sortKey="nome_completo" current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <SortTh label="Localização" sortKey="cidade" current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <SortTh label="Inscrição" sortKey="data_inscricao" current={sortKey} asc={sortAsc} onSort={handleSort} align="center" />
                  <SortTh label="Status" sortKey="status_matricula" current={sortKey} asc={sortAsc} onSort={handleSort} align="center" />
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
                          {fmtDateSafe(m.createdAt || m.created_at)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase shadow-sm" style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}>
                            {m.status_matricula || 'Pendente'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => { setCandidatoSelecionado(m); setIsModalOpen(true); }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-xl text-purple-900 font-black text-[10px] uppercase hover:bg-yellow-400 transition-all border border-gray-200 shadow-sm whitespace-nowrap"
                          >
                            <UserCheck size={13} /> FICHA
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-400 font-bold uppercase text-xs italic">Nenhum registro encontrado.</td>
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

function SortTh({ label, sortKey, current, asc, onSort, align = 'left' }: {
  label: string;
  sortKey: string;
  current: string;
  asc: boolean;
  onSort: (k: any) => void;
  align?: 'left' | 'center' | 'right';
}) {
  const active = current === sortKey;
  const textAlign = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : '';
  return (
    <th
      className={`px-6 py-5 cursor-pointer select-none hover:bg-gray-100 transition-colors ${textAlign}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? <ChevronUp size={11} className={`text-purple-600 transition-transform ${asc ? '' : 'rotate-180'}`} />
          : <ChevronsUpDown size={11} className="text-gray-300" />}
      </span>
    </th>
  );
}
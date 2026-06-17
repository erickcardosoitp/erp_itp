"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '@/services/api';
import {
  Search, Download, UserCheck, ChevronDown, Filter,
  Users, Clock, ShieldAlert, CheckCircle2, FilterX, ChevronsUpDown, ChevronUp,
  FileText, FileCheck2, AlertCircle, UserX, Ban, ChevronRight, RefreshCw,
  GraduationCap, X, ExternalLink,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const FichaDrawer = dynamic(() => import('@/components/DossieCandidato'), { ssr: false });
const CadastroDiretoModal = dynamic(() => import('../../matriculas/components/CadastroDiretoModal'), { ssr: false });

// Formata datas com segurança (evita "Invalid Date")
function fmtDateSafe(v?: string | null): string {
  if (!v) return '---';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v;
  const s = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v + 'T12:00:00' : v;
  const d = new Date(s);
  return isNaN(d.getTime()) ? '---' : d.toLocaleDateString('pt-BR');
}

type CursoAcademico = { id: string; nome: string; sigla: string; turmas: Array<{ id: string; nome: string; codigo: string }> };

interface Props {
  podeEditar: boolean;
}

export default function MatriculasTab({ podeEditar }: Props) {
  const [cursosAcademico, setCursosAcademico] = useState<CursoAcademico[]>([]);
  const [matriculas, setMatriculas] = useState<any[]>([]);
  const [candidatoSelecionado, setCandidatoSelecionado] = useState<any>(null);
  const [fichaDrawerData, setFichaDrawerData] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [loading, setLoading] = useState(true);

  // Ordenação
  type SortKey = 'nome_completo' | 'cidade' | 'data_inscricao' | 'status_matricula';
  const [sortKey, setSortKey] = useState<SortKey>('nome_completo');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (key: SortKey) => {
    setPagina(1);
    if (sortKey === key) setSortAsc(prev => !prev);
    else { setSortKey(key); setSortAsc(true); }
  };

  // Filtros
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroCpf, setFiltroCpf] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroBairro, setFiltroBairro] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroSexo, setFiltroSexo] = useState('');
  const [filtroAlergia, setFiltroAlergia] = useState('');
  const [showMoreKPIs, setShowMoreKPIs] = useState(false);

  // Paginação
  const LIMITE = 50;
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [statsServidor, setStatsServidor] = useState<Record<string, number>>({});
  const [localidades, setLocalidades] = useState<{ cidades: string[]; bairrosPorCidade: Record<string, string[]> }>({
    cidades: [], bairrosPorCidade: {},
  });
  const [refreshTick, setRefreshTick] = useState(0);

  // Modal Efetivar Matrícula
  const [modalMatricular, setModalMatricular] = useState<{ aberto: boolean; candidato: any | null }>({ aberto: false, candidato: null });
  const [cursosSelecionados, setCursosSelecionados] = useState<string[]>([]);
  const [matriculando, setMatriculando] = useState(false);
  const [matriculaResultado, setMatriculaResultado] = useState<{ numero: string; nome: string } | null>(null);

  // Modal Cadastro Direto
  const [showCadastroDireto, setShowCadastroDireto] = useState(false);

  const fetchMatriculas = useCallback(() => setRefreshTick(t => t + 1), []);

  const abrirFicha = useCallback(async (m: any) => {
    setCandidatoSelecionado(m);
    setFichaDrawerData(null);
    setIsModalOpen(true);
    const alunoId = m.aluno?.id ?? m.aluno_id;
    if (alunoId) {
      try {
        const res = await api.get(`/academico/alunos/${alunoId}/ficha`);
        setFichaDrawerData(res.data);
      } catch { /* fica sem fichaData, não bloqueia */ }
    }
  }, []);

  // Suporte: cursos disponíveis e localidades (mount único)
  useEffect(() => {
    // cursosDisponiveis não é mais necessário (matricular usa cursosAcademico)
    api.get('/matriculas/localidades')
      .then(r => { if (r.data) setLocalidades(r.data); })
      .catch(() => {});
    api.get('/matriculas/cursos-ativos-academico')
      .then(r => setCursosAcademico(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, []);

  // Fetch paginado + filtrado
  useEffect(() => {
    let cancelled = false;
    const doFetch = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ pagina: String(pagina), limite: String(LIMITE) });
        if (filtroNome)    params.set('nome',        filtroNome);
        if (filtroCpf)     params.set('cpf',         filtroCpf);
        if (filtroStatus)  params.set('status',      filtroStatus);
        if (filtroCidade)  params.set('cidade',      filtroCidade);
        if (filtroBairro)  params.set('bairro',      filtroBairro);
        if (filtroSexo)    params.set('sexo',        filtroSexo);
        if (filtroAlergia) params.set('tem_alergia', filtroAlergia);
        params.set('orderBy',  sortKey);
        params.set('orderDir', sortAsc ? 'ASC' : 'DESC');
        const response = await api.get(`/matriculas?${params.toString()}`);
        if (!cancelled) {
          const data = response.data;
          setMatriculas(Array.isArray(data.items) ? data.items : []);
          setTotal(data.total || 0);
          setTotalPaginas(data.totalPaginas || 1);
          setStatsServidor(data.stats || {});
        }
      } catch (error: any) {
        if (!cancelled) console.error('Erro matrículas:', error.response?.status || error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    doFetch();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, filtroNome, filtroCpf, filtroStatus, filtroCidade, filtroBairro, filtroSexo, filtroAlergia, sortKey, sortAsc, refreshTick]);

  const bairrosDisponiveis = useMemo(
    () => filtroCidade ? (localidades.bairrosPorCidade[filtroCidade] || []) : [],
    [filtroCidade, localidades],
  );

  const stats = useMemo(() => ({
    total: Object.values(statsServidor).reduce((a, b) => a + b, 0),
    pendentes:          statsServidor['Pendente'] || 0,
    aguardandoLgpd:     statsServidor['Aguardando Assinatura LGPD'] || 0,
    emValidacao:        statsServidor['Em Validação'] || 0,
    aguardandoDocs:     statsServidor['Aguardando Documentos'] || 0,
    documentosEnviados: statsServidor['Documentos Enviados'] || 0,
    matriculados:       statsServidor['Matriculado'] || 0,
    incompletos:        statsServidor['Incompleto'] || 0,
    desistentes:        statsServidor['Desistente'] || 0,
    cancelados:         statsServidor['Cancelada'] || 0,
  }), [statsServidor]);

  const handleExport = async (formato: 'xlsx' | 'csv' | 'json') => {
    const dataToExport = matriculas.map(m => ({
      ID: m.id,
      Nome: m.nome_completo,
      CPF: m.cpf,
      Cidade: m.cidade || m.Cidade || 'N/I',
      Bairro: m.bairro || m.Bairro || 'N/I',
      Curso: m.cursos_desejados || 'Não informado',
      Status: m.status_matricula,
      LGPD: m.lgpd_aceito ? 'Sim' : 'Não',
      Data_Inscricao: m.createdAt || m.created_at ? new Date(m.createdAt || m.created_at).toLocaleDateString('pt-BR') : '---',
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
      XLSX.utils.book_append_sheet(wb, ws, 'Dados');
      XLSX.writeFile(wb, `matriculas_itp_${Date.now()}.${formato}`);
    }
    setShowExportMenu(false);
  };

  const podeMatricular = (status: string) => !['Matriculado', 'Desistente', 'Cancelada'].includes(status);

  const calcCompletude = (m: any) => {
    const faltando: string[] = [];
    const ehMenor = m.maior_18_anos === false || (m.idade && Number(m.idade) < 18);
    if (!ehMenor && !m.cpf) faltando.push('CPF');
    if (!m.email) faltando.push('E-mail');
    if (!ehMenor && !m.celular) faltando.push('Celular');
    if (!m.data_nascimento) faltando.push('Data de nascimento');
    if (!m.cidade) faltando.push('Cidade');
    if (!m.lgpd_aceito) faltando.push('Termo LGPD não assinado');
    if (!['Documentos Enviados', 'Matriculado'].includes(m.status_matricula)) faltando.push('Documentos pendentes');
    const total = ehMenor ? 5 : 7;
    const pct = Math.round(((total - faltando.length) / total) * 100);
    return { pct, faltando };
  };

  const abrirModalMatricular = (m: any) => {
    setCursosSelecionados([]);
    setMatriculaResultado(null);
    setModalMatricular({ aberto: true, candidato: m });
  };

  const fecharModalMatricular = () => {
    setModalMatricular({ aberto: false, candidato: null });
    setCursosSelecionados([]);
    setMatriculaResultado(null);
  };

  const toggleCurso = (id: string) => {
    setCursosSelecionados(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const confirmarMatricula = async () => {
    if (!modalMatricular.candidato) return;
    if (cursosSelecionados.length === 0) { alert('Selecione ao menos uma turma para efetivar a matrícula.'); return; }
    setMatriculando(true);
    try {
      const r = await api.post(`/matriculas/${modalMatricular.candidato.id}/finalizar`, { turma_ids: cursosSelecionados });
      const num = r.data?.numero_matricula || r.data?.aluno?.numero_matricula || '—';
      setMatriculaResultado({ numero: num, nome: modalMatricular.candidato.nome_completo });
      fetchMatriculas();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Erro ao efetivar matrícula.');
    }
    setMatriculando(false);
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Pendente':                   return { bg: '#94a3b8', text: '#fff' };
      case 'Aguardando Assinatura LGPD': return { bg: '#f97316', text: '#fff' };
      case 'Em Validação':               return { bg: '#3b82f6', text: '#fff' };
      case 'Aguardando Documentos':      return { bg: '#f59e0b', text: '#fff' };
      case 'Documentos Enviados':        return { bg: '#0891b2', text: '#fff' };
      case 'Matriculado':                return { bg: '#16a34a', text: '#fff' };
      case 'Incompleto':                 return { bg: '#dc2626', text: '#fff' };
      case 'Desistente':                 return { bg: '#64748b', text: '#fff' };
      case 'Cancelada':                  return { bg: '#7f1d1d', text: '#fff' };
      default:                           return { bg: '#e2e8f0', text: '#475569' };
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* TOOLBAR */}
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <button onClick={fetchMatriculas} disabled={loading} title="Atualizar lista"
          className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-purple-600 hover:border-purple-400 transition-all disabled:opacity-60">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
        <a href="https://institutotiapretinha.org/matricula" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-sm bg-emerald-500 hover:bg-emerald-600 transition-all">
          <ExternalLink size={14} /> Link de Inscrição
        </a>
        {podeEditar && (
          <button onClick={() => setShowCadastroDireto(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-sm bg-green-600 hover:bg-green-700 transition-all">
            <GraduationCap size={14} /> Cadastrar Diretamente
          </button>
        )}
        <div className="relative">
          <button onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-sm bg-purple-600 hover:bg-purple-700 transition-all">
            <Download size={14} /> Exportar <ChevronDown size={13} className={showExportMenu ? 'rotate-180' : ''} />
          </button>
          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-44 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
              {(['xlsx', 'csv', 'json'] as const).map(ext => (
                <button key={ext} onClick={() => handleExport(ext)}
                  className="w-full text-left px-5 py-3 text-[10px] font-black uppercase hover:bg-purple-50 transition-colors border-b last:border-0 border-gray-50">
                  Arquivo .{ext}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* KPIs — Pipeline Ativo */}
      <div className="space-y-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-purple-400 mb-2 pl-1">Pipeline Ativo</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <KPICard title="Total"         value={stats.total}              icon={<Users size={16}/>}       color="#2e1065" onClick={() => { setPagina(1); setFiltroStatus(''); }}                              isActive={filtroStatus === ''} />
            <KPICard title="Pendentes"     value={stats.pendentes}          icon={<Clock size={16}/>}       color="#94a3b8" onClick={() => { setPagina(1); setFiltroStatus('Pendente'); }}                    isActive={filtroStatus === 'Pendente'} />
            <KPICard title="Ag. LGPD"      value={stats.aguardandoLgpd}    icon={<ShieldAlert size={16}/>} color="#f97316" onClick={() => { setPagina(1); setFiltroStatus('Aguardando Assinatura LGPD'); }} isActive={filtroStatus === 'Aguardando Assinatura LGPD'} />
            <KPICard title="Em Validação"  value={stats.emValidacao}        icon={<UserCheck size={16}/>}   color="#3b82f6" onClick={() => { setPagina(1); setFiltroStatus('Em Validação'); }}                isActive={filtroStatus === 'Em Validação'} />
            <KPICard title="Ag. Docs"      value={stats.aguardandoDocs}     icon={<FileText size={16}/>}    color="#f59e0b" onClick={() => { setPagina(1); setFiltroStatus('Aguardando Documentos'); }}       isActive={filtroStatus === 'Aguardando Documentos'} />
            <KPICard title="Docs Enviados" value={stats.documentosEnviados} icon={<FileCheck2 size={16}/>}  color="#0891b2" onClick={() => { setPagina(1); setFiltroStatus('Documentos Enviados'); }}         isActive={filtroStatus === 'Documentos Enviados'} />
            <KPICard title="Matriculados"  value={stats.matriculados}       icon={<CheckCircle2 size={16}/>}color="#16a34a" onClick={() => { setPagina(1); setFiltroStatus('Matriculado'); }}                 isActive={filtroStatus === 'Matriculado'} />
          </div>
        </div>

        {/* KPIs — Saídas */}
        <div>
          <button onClick={() => setShowMoreKPIs(v => !v)}
            className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors pl-1 mb-2">
            <ChevronDown size={12} className={`transition-transform duration-200 ${showMoreKPIs ? 'rotate-180' : ''}`} />
            {showMoreKPIs ? 'Ocultar Saídas' : 'Mostrar Saídas'}
            <span className="ml-1 px-1.5 py-px bg-slate-100 rounded-full text-slate-500">
              {stats.incompletos + stats.desistentes + stats.cancelados}
            </span>
          </button>
          {showMoreKPIs && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <KPICard title="Incompletos" value={stats.incompletos} icon={<AlertCircle size={16}/>} color="#dc2626" onClick={() => { setPagina(1); setFiltroStatus('Incompleto'); }} isActive={filtroStatus === 'Incompleto'} />
              <KPICard title="Desistentes" value={stats.desistentes} icon={<UserX size={16}/>}       color="#64748b" onClick={() => { setPagina(1); setFiltroStatus('Desistente'); }} isActive={filtroStatus === 'Desistente'} />
              <KPICard title="Cancelados"  value={stats.cancelados}  icon={<Ban size={16}/>}          color="#7f1d1d" onClick={() => { setPagina(1); setFiltroStatus('Cancelada'); }} isActive={filtroStatus === 'Cancelada'} />
            </div>
          )}
        </div>
      </div>

      {/* FILTROS */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 items-end">
          <FilterGroup label="Nome">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={12} />
              <input type="text" value={filtroNome} placeholder="Nome..."
                className="w-full pl-8 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500"
                onChange={e => { setPagina(1); setFiltroNome(e.target.value); }} />
            </div>
          </FilterGroup>

          <FilterGroup label="CPF">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={12} />
              <input type="text" value={filtroCpf} placeholder="CPF..."
                className="w-full pl-8 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500"
                onChange={e => { setPagina(1); setFiltroCpf(e.target.value); }} />
            </div>
          </FilterGroup>

          <FilterGroup label="Cidade">
            <select value={filtroCidade} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-700 uppercase outline-none"
              onChange={e => { setPagina(1); setFiltroCidade(e.target.value); setFiltroBairro(''); }}>
              <option value="">Todas</option>
              {localidades.cidades.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </FilterGroup>

          <FilterGroup label="Bairro" isSincrono={!!filtroCidade}>
            <select value={filtroBairro} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-700 uppercase outline-none"
              onChange={e => { setPagina(1); setFiltroBairro(e.target.value); }}>
              <option value="">Todos</option>
              {bairrosDisponiveis.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </FilterGroup>

          <FilterGroup label="Status">
            <select value={filtroStatus} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-700 uppercase outline-none"
              onChange={e => { setPagina(1); setFiltroStatus(e.target.value); }}>
              <option value="">Todos Status</option>
              <option value="Pendente">Pendente</option>
              <option value="Aguardando Assinatura LGPD">Ag. LGPD</option>
              <option value="Em Validação">Em Validação</option>
              <option value="Aguardando Documentos">Ag. Documentos</option>
              <option value="Documentos Enviados">Docs Enviados</option>
              <option value="Matriculado">Matriculado</option>
              <option value="Incompleto">Incompleto</option>
              <option value="Desistente">Desistente</option>
              <option value="Cancelada">Cancelada</option>
            </select>
          </FilterGroup>

          <FilterGroup label="Sexo">
            <select value={filtroSexo} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-700 uppercase outline-none"
              onChange={e => { setPagina(1); setFiltroSexo(e.target.value); }}>
              <option value="">Todos</option>
              <option value="Masculino">Masculino</option>
              <option value="Feminino">Feminino</option>
              <option value="Outro">Outro</option>
            </select>
          </FilterGroup>

          <FilterGroup label="Alergia">
            <select value={filtroAlergia} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-700 uppercase outline-none"
              onChange={e => { setPagina(1); setFiltroAlergia(e.target.value); }}>
              <option value="">Todos</option>
              <option value="sim">Possui</option>
              <option value="não">Não possui</option>
            </select>
          </FilterGroup>
        </div>
        <div className="flex justify-end mt-3">
          <button onClick={() => { setPagina(1); setFiltroNome(''); setFiltroCpf(''); setFiltroCidade(''); setFiltroBairro(''); setFiltroStatus(''); setFiltroSexo(''); setFiltroAlergia(''); }}
            className="flex items-center gap-2 text-red-400 hover:text-red-600 font-black text-[10px] uppercase transition-colors">
            <FilterX size={12} /> Limpar Filtros
          </button>
        </div>
      </div>

      {/* TABELA */}
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[600px] w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black tracking-widest border-b border-gray-100">
                <SortTh label="Candidato / CPF" sortKey="nome_completo" current={sortKey} asc={sortAsc} onSort={handleSort} />
                <SortTh label="Localização"     sortKey="cidade"          current={sortKey} asc={sortAsc} onSort={handleSort} />
                <SortTh label="Inscrição"        sortKey="data_inscricao"  current={sortKey} asc={sortAsc} onSort={handleSort} align="center" />
                <SortTh label="Status"           sortKey="status_matricula" current={sortKey} asc={sortAsc} onSort={handleSort} align="center" />
                <th className="px-6 py-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="py-10 text-center text-gray-400 font-black uppercase text-xs animate-pulse italic">Sincronizando...</td></tr>
              ) : matriculas.length > 0 ? (
                matriculas.map((m, idx) => {
                  const statusStyle = getStatusStyle(m.status_matricula);
                  return (
                    <tr key={m.id || idx} className="hover:bg-purple-50/30 transition-all group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {(() => {
                            const { pct, faltando } = calcCompletude(m);
                            const cor = pct >= 80 ? 'bg-green-500' : 'bg-red-400';
                            return (
                              <div className="relative group/kpi shrink-0">
                                <span className={`block w-2.5 h-2.5 rounded-full ${cor} cursor-default`} title={`${pct}% completo`} />
                                <div className="absolute left-4 top-0 z-50 hidden group-hover/kpi:block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl p-2.5 min-w-[160px] shadow-xl pointer-events-none">
                                  <p className="text-[9px] font-black uppercase text-slate-400 mb-1.5">{pct}% completo</p>
                                  {faltando.length === 0
                                    ? <p className="text-[9px] text-green-600 font-bold">Cadastro completo</p>
                                    : faltando.map(f => <p key={f} className="text-[9px] text-red-500 font-bold leading-relaxed">• {f}</p>)}
                                </div>
                              </div>
                            );
                          })()}
                          <div>
                            <div className="font-black text-gray-800 uppercase text-xs">{m.nome_completo}</div>
                            <div className="text-[10px] text-gray-400 font-bold">{m.cpf}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-700 uppercase text-[11px]">{m.cidade || m.Cidade || 'N/I'}</div>
                        <div className="text-[10px] text-gray-400 italic">{m.bairro || m.Bairro || 'Não inf.'}</div>
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
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <button onClick={() => abrirFicha(m)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-xl text-purple-900 font-black text-[10px] uppercase hover:bg-yellow-400 transition-all border border-gray-200 shadow-sm whitespace-nowrap">
                            <UserCheck size={12} /> Ficha
                          </button>
                          {podeEditar && podeMatricular(m.status_matricula) && (
                            <button onClick={() => abrirModalMatricular(m)} title="Efetivar Matrícula"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-xl text-white font-black text-[10px] uppercase transition-all shadow-sm whitespace-nowrap">
                              <GraduationCap size={12} /> Matricular
                            </button>
                          )}
                        </div>
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

      {/* PAGINAÇÃO */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
        <p className="text-xs text-gray-500 font-bold">
          {total} registro{total !== 1 ? 's' : ''}
          {(filtroNome || filtroCpf || filtroStatus || filtroCidade || filtroBairro || filtroSexo || filtroAlergia) ? ' (filtrado)' : ''}
          {totalPaginas > 1 && <span className="ml-2 text-gray-400">— página {pagina} de {totalPaginas} · {LIMITE}/pág.</span>}
        </p>
        {totalPaginas > 1 && (
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPagina(1)} disabled={pagina <= 1 || loading}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 font-black text-xs disabled:opacity-40 hover:border-purple-400 hover:text-purple-700 transition-colors shadow-sm">«</button>
            <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina <= 1 || loading}
              className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 font-bold text-xs disabled:opacity-40 hover:border-purple-400 hover:text-purple-700 transition-colors shadow-sm">‹ Anterior</button>
            <span className="px-3 py-1.5 rounded-lg bg-purple-600 text-white font-black text-xs shadow-sm">{pagina} / {totalPaginas}</span>
            <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina >= totalPaginas || loading}
              className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 font-bold text-xs disabled:opacity-40 hover:border-purple-400 hover:text-purple-700 transition-colors shadow-sm">Próxima ›</button>
            <button onClick={() => setPagina(totalPaginas)} disabled={pagina >= totalPaginas || loading}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 font-black text-xs disabled:opacity-40 hover:border-purple-400 hover:text-purple-700 transition-colors shadow-sm">»</button>
          </div>
        )}
      </div>

      {/* FICHA DRAWER */}
      {isModalOpen && candidatoSelecionado && (
        <FichaDrawer
          aluno={candidatoSelecionado}
          fichaData={fichaDrawerData}
          onClose={() => { setIsModalOpen(false); setFichaDrawerData(null); }}
          onSuccess={fetchMatriculas}
        />
      )}

      {/* MODAL: Cadastro Direto */}
      {showCadastroDireto && (
        <CadastroDiretoModal
          cursosAcademico={cursosAcademico}
          onClose={() => setShowCadastroDireto(false)}
          onSuccess={fetchMatriculas}
        />
      )}

      {/* MODAL: Efetivar Matrícula */}
      {modalMatricular.aberto && modalMatricular.candidato && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">

            {/* Header */}
            <div className="bg-green-600 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl"><GraduationCap size={20} className="text-white" /></div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-green-100">Efetivar Matrícula</p>
                  <p className="text-sm font-black text-white leading-tight truncate max-w-[300px]">{modalMatricular.candidato.nome_completo}</p>
                </div>
              </div>
              <button onClick={fecharModalMatricular} className="text-white/70 hover:text-white transition-colors"><X size={18} /></button>
            </div>

            <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
              {matriculaResultado ? (
                /* SUCESSO */
                <div className="text-center py-4 space-y-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 size={32} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-green-600 mb-1">Matrícula Efetivada!</p>
                    <p className="text-slate-700 dark:text-slate-200 font-bold text-sm">{matriculaResultado.nome}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Número de Matrícula</p>
                    <p className="font-mono text-2xl font-black text-green-700 dark:text-green-400 mt-1 tracking-wider">{matriculaResultado.numero}</p>
                  </div>
                  <button onClick={fecharModalMatricular}
                    className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-colors">
                    Fechar
                  </button>
                </div>
              ) : (
                /* FORMULÁRIO */
                <>
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-4 space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Candidato</p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <InfoItem label="CPF"         value={modalMatricular.candidato.cpf} />
                      <InfoItem label="Idade"        value={modalMatricular.candidato.idade ? `${modalMatricular.candidato.idade} anos` : fmtDateSafe(modalMatricular.candidato.data_nascimento)} />
                      <InfoItem label="Cidade"       value={modalMatricular.candidato.cidade || '—'} />
                      <InfoItem label="Status Atual" value={modalMatricular.candidato.status_matricula} />
                    </div>
                    {modalMatricular.candidato.cursos_desejados && (
                      <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Interesse declarado</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">{modalMatricular.candidato.cursos_desejados}</p>
                      </div>
                    )}
                  </div>

                  {/* Seleção de turmas */}
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">
                      Turmas a matricular <span className="text-red-500">*</span>
                      <span className="ml-2 font-normal normal-case text-slate-400">({cursosSelecionados.length} selecionada{cursosSelecionados.length !== 1 ? 's' : ''})</span>
                    </p>
                    {cursosAcademico.length === 0 ? (
                      <p className="text-[10px] text-amber-600 font-bold uppercase text-center py-3 bg-amber-50 rounded-xl">Nenhuma turma ativa encontrada.</p>
                    ) : (
                      <div className="space-y-3">
                        {cursosAcademico.map(curso => (
                          <div key={curso.id}>
                            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1.5">{curso.sigla} — {curso.nome}</p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {curso.turmas.map(t => {
                                const ativo = cursosSelecionados.includes(t.id);
                                return (
                                  <button key={t.id} type="button" onClick={() => toggleCurso(t.id)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-[10px] font-bold transition-all ${
                                      ativo
                                        ? 'bg-green-600 border-green-600 text-white shadow-sm'
                                        : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-green-400'
                                    }`}>
                                    <span className={`w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center border ${ativo ? 'bg-white border-white' : 'border-slate-300 dark:border-slate-500'}`}>
                                      {ativo && <span className="text-green-600 text-[9px] font-black">✓</span>}
                                    </span>
                                    <span className="leading-tight">{t.nome}{t.codigo ? <span className="font-normal opacity-60 ml-1">({t.codigo})</span> : ''}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-3">
                    <p className="text-[10px] text-amber-700 dark:text-amber-300 font-bold">
                      Esta ação é irreversível. Será gerado um número de matrícula e o candidato será registrado como aluno do ITP.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={fecharModalMatricular}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-black text-xs uppercase hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                      Cancelar
                    </button>
                    <button onClick={confirmarMatricula} disabled={matriculando || cursosSelecionados.length === 0}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-widest transition-colors shadow-sm">
                      {matriculando
                        ? <><RefreshCw size={13} className="animate-spin" /> Matriculando...</>
                        : <><GraduationCap size={13} /> Confirmar Matrícula</>}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componentes Auxiliares ────────────────────────────────────────

function KPICard({ title, value, icon, color, onClick, isActive }: {
  title: string; value: number; icon: React.ReactNode; color: string;
  onClick: () => void; isActive: boolean;
}) {
  return (
    <div onClick={onClick}
      className={`cursor-pointer p-4 rounded-2xl border transition-all duration-300 flex items-center gap-3 hover:shadow-md ${isActive ? 'bg-white border-purple-500 scale-105 ring-2 ring-purple-100' : 'bg-white border-gray-100'}`}>
      <div className="p-2.5 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0" style={{ backgroundColor: color }}>{icon}</div>
      <div>
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">{title}</p>
        <p className="text-xl font-black text-gray-800 tracking-tighter">{value}</p>
      </div>
    </div>
  );
}

function FilterGroup({ label, children, isSincrono }: { label: string; children: React.ReactNode; isSincrono?: boolean }) {
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
  label: string; sortKey: string; current: string; asc: boolean;
  onSort: (k: any) => void; align?: 'left' | 'center' | 'right';
}) {
  const active = current === sortKey;
  const textAlign = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : '';
  return (
    <th className={`px-6 py-5 cursor-pointer select-none hover:bg-gray-100 transition-colors ${textAlign}`} onClick={() => onSort(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? <ChevronUp size={11} className={`text-purple-600 transition-transform ${asc ? '' : 'rotate-180'}`} />
          : <ChevronsUpDown size={11} className="text-gray-300" />}
      </span>
    </th>
  );
}

function InfoItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{value || '—'}</p>
    </div>
  );
}

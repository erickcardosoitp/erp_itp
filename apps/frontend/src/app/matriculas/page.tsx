"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
// ✅ IMPORTANTE: Instância configurada com porta 3001 e Credentials
import api from '@/services/api'; 
// xlsx carregado dinamicamente apenas ao exportar (evita ~1 MB no bundle inicial)
import { 
  Search, Download, UserCheck, ChevronDown, Filter,
  Users, Clock, ShieldAlert, CheckCircle2, FilterX, ChevronsUpDown, ChevronUp,
  FileText, FileCheck2, AlertCircle, UserX, Ban, ChevronRight, RefreshCw,
  GraduationCap, X
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
    setPagina(1);
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

  // Paginação e dados do servidor
  const LIMITE = 50;
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [statsServidor, setStatsServidor] = useState<Record<string, number>>({});
  const [localidades, setLocalidades] = useState<{ cidades: string[]; bairrosPorCidade: Record<string, string[]> }>({
    cidades: [], bairrosPorCidade: {},
  });
  // Incrementar este contador força re-fetch manual (botão refresh, pós-matrícula)
  const [refreshTick, setRefreshTick] = useState(0);

  // Modal de Matricular Candidato
  const [cursosDisponiveis, setCursosDisponiveis] = useState<string[]>([]);
  const [modalMatricular, setModalMatricular] = useState<{ aberto: boolean; candidato: any | null }>({ aberto: false, candidato: null });
  const [cursosSelecionados, setCursosSelecionados] = useState<string[]>([]);
  const [matriculando, setMatriculando] = useState(false);
  const [matriculaResultado, setMatriculaResultado] = useState<{ numero: string; nome: string } | null>(null);

  // Modal de Cadastro Direto (bypass do workflow)
  const [showCadastroDireto, setShowCadastroDireto] = useState(false);
  const [cursosAcademico, setCursosAcademico] = useState<Array<{ id: string; nome: string; sigla: string }>>([]);
  const FORM_DIRETO_VAZIO: Record<string, any> = {
    nome_completo: '', cpf: '', email: '', celular: '',
    data_nascimento: '', sexo: '', escolaridade: '', turno_escolar: '',
    // Endereço
    cep: '', logradouro: '', numero: '', complemento: '',
    bairro: '', cidade: '', estado_uf: '',
    // Responsável
    nome_responsavel: '', email_responsavel: '', grau_parentesco: '',
    cpf_responsavel: '', telefone_alternativo: '',
    // Saúde
    possui_alergias: 'Não', cuidado_especial: 'Não', detalhes_cuidado: '', uso_medicamento: 'Não',
    // Termos
    lgpd_aceito: false, autoriza_imagem: false,
    // Cursos
    curso_ids: [] as string[],
  };
  const [formDireto, setFormDireto] = useState<Record<string, any>>({ ...FORM_DIRETO_VAZIO });
  const [salvandoDireto, setSalvandoDireto] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erroDireto, setErroDireto] = useState<string | null>(null);
  const [resultadoDireto, setResultadoDireto] = useState<{ numero_matricula: string; nome_completo: string } | null>(null);

  // Dispara re-fetch manual (botão refresh, pós-matrícula)
  const fetchMatriculas = useCallback(() => setRefreshTick(t => t + 1), []);

  // Dados de suporte: cursos e localidades (executado apenas no mount)
  useEffect(() => {
    api.get('/matriculas/cursos-disponiveis')
      .then(r => setCursosDisponiveis(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
    api.get('/matriculas/localidades')
      .then(r => { if (r.data) setLocalidades(r.data); })
      .catch(() => {});
    api.get('/matriculas/cursos-ativos-academico')
      .then(r => setCursosAcademico(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, []);

  const calcularIdadeDireto = (dataNasc: string): number => {
    if (!dataNasc) return 99;
    const d = new Date(dataNasc + 'T12:00:00');
    if (isNaN(d.getTime())) return 99;
    const hoje = new Date();
    let idade = hoje.getFullYear() - d.getFullYear();
    const m = hoje.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) idade--;
    return idade;
  };
  const menorDeIdadeDireto = formDireto.data_nascimento ? calcularIdadeDireto(formDireto.data_nascimento) < 18 : false;

  const toggleCursoDireto = (id: string) => {
    setFormDireto(prev => ({
      ...prev,
      curso_ids: prev.curso_ids.includes(id)
        ? prev.curso_ids.filter((c: string) => c !== id)
        : [...prev.curso_ids, id],
    }));
  };

  const abrirCadastroDireto = () => {
    setFormDireto({ ...FORM_DIRETO_VAZIO, curso_ids: [] });
    setErroDireto(null);
    setResultadoDireto(null);
    setShowCadastroDireto(true);
  };

  const buscarCep = async (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setFormDireto(p => ({
          ...p,
          logradouro: data.logradouro || p.logradouro,
          bairro:     data.bairro     || p.bairro,
          cidade:     data.localidade || p.cidade,
          estado_uf:  data.uf         || p.estado_uf,
        }));
      }
    } catch { /* silencia erros de rede */ }
    finally { setBuscandoCep(false); }
  };

  const salvarCadastroDireto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDireto.nome_completo.trim()) { setErroDireto('Nome completo é obrigatório.'); return; }
    if (!formDireto.cpf.trim()) { setErroDireto('CPF é obrigatório.'); return; }
    if (!formDireto.email.trim()) { setErroDireto('E-mail é obrigatório.'); return; }
    if (!formDireto.celular.trim()) { setErroDireto('Celular é obrigatório.'); return; }
    setSalvandoDireto(true);
    setErroDireto(null);
    try {
      const t = (v: string) => v?.trim() || undefined;
      const payload: Record<string, any> = {
        nome_completo:        t(formDireto.nome_completo),
        cpf:                  t(formDireto.cpf),
        email:                t(formDireto.email),
        celular:              t(formDireto.celular),
        data_nascimento:      formDireto.data_nascimento || undefined,
        sexo:                 formDireto.sexo || undefined,
        escolaridade:         formDireto.escolaridade || undefined,
        turno_escolar:        formDireto.turno_escolar || undefined,
        cep:                  t(formDireto.cep),
        logradouro:           t(formDireto.logradouro),
        numero:               t(formDireto.numero),
        complemento:          t(formDireto.complemento),
        bairro:               t(formDireto.bairro),
        cidade:               t(formDireto.cidade),
        estado_uf:            t(formDireto.estado_uf),
        maior_18_anos:        !menorDeIdadeDireto,
        nome_responsavel:     menorDeIdadeDireto ? t(formDireto.nome_responsavel) : undefined,
        email_responsavel:    menorDeIdadeDireto ? t(formDireto.email_responsavel) : undefined,
        grau_parentesco:      menorDeIdadeDireto ? t(formDireto.grau_parentesco) : undefined,
        cpf_responsavel:      menorDeIdadeDireto ? t(formDireto.cpf_responsavel) : undefined,
        telefone_alternativo: t(formDireto.telefone_alternativo),
        possui_alergias:      formDireto.possui_alergias || undefined,
        cuidado_especial:     formDireto.cuidado_especial || undefined,
        detalhes_cuidado:     t(formDireto.detalhes_cuidado),
        uso_medicamento:      formDireto.uso_medicamento || undefined,
        lgpd_aceito:          formDireto.lgpd_aceito,
        autoriza_imagem:      formDireto.autoriza_imagem,
        curso_ids:            formDireto.curso_ids,
      };
      const r = await api.post('/matriculas/aluno-direto', payload);
      setResultadoDireto(r.data);
      fetchMatriculas();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao cadastrar.';
      setErroDireto(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSalvandoDireto(false);
    }
  };

  // Fetch paginado + filtrado — re-executa quando pagina, filtros, ordenação ou refreshTick mudam
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
        if (!cancelled) console.error('❌ Erro na requisição de matrículas:', error.response?.status || error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    doFetch();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, filtroNome, filtroCpf, filtroStatus, filtroCidade, filtroBairro, filtroSexo, filtroAlergia, sortKey, sortAsc, refreshTick]);

  // Bairros disponíveis para a cidade selecionada (dados do servidor)
  const bairrosDisponiveis = useMemo(
    () => filtroCidade ? (localidades.bairrosPorCidade[filtroCidade] || []) : [],
    [filtroCidade, localidades],
  );

  // KPIs baseados nos contadores aggregados do servidor (sem filtro — retrato geral)
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
  const podeMatricular = (status: string) => !['Matriculado', 'Desistente', 'Cancelada'].includes(status);

  const abrirModalMatricular = (m: any) => {
    const raw = m.cursos_desejados ?? '';
    const desejados = Array.isArray(raw)
      ? raw
      : raw.split(',').map((s: string) => s.trim()).filter(Boolean);
    setCursosSelecionados(desejados);
    setMatriculaResultado(null);
    setModalMatricular({ aberto: true, candidato: m });
  };

  const fecharModalMatricular = () => {
    setModalMatricular({ aberto: false, candidato: null });
    setCursosSelecionados([]);
    setMatriculaResultado(null);
  };

  const toggleCurso = (curso: string) => {
    setCursosSelecionados(prev =>
      prev.includes(curso) ? prev.filter(c => c !== curso) : [...prev, curso]
    );
  };

  const confirmarMatricula = async () => {
    if (!modalMatricular.candidato) return;
    if (cursosSelecionados.length === 0) { alert('Selecione ao menos um curso para efetivar a matrícula.'); return; }
    setMatriculando(true);
    try {
      const r = await api.post(`/matriculas/${modalMatricular.candidato.id}/finalizar`, { cursos: cursosSelecionados });
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
      case 'Pendente':                     return { bg: '#94a3b8', text: '#fff' };  // slate-400 — neutro recebido
      case 'Aguardando Assinatura LGPD':   return { bg: '#f97316', text: '#fff' };  // orange-500 — ação do candidato
      case 'Em Validação':                 return { bg: '#3b82f6', text: '#fff' };  // blue-500  — processamento admin
      case 'Aguardando Documentos':        return { bg: '#f59e0b', text: '#fff' };  // amber-500 — ação do candidato
      case 'Documentos Enviados':          return { bg: '#0891b2', text: '#fff' };  // cyan-600  — recebido p/ análise
      case 'Matriculado':                  return { bg: '#16a34a', text: '#fff' };  // green-600 — concluído
      case 'Incompleto':                   return { bg: '#dc2626', text: '#fff' };  // red-600   — bloqueado
      case 'Desistente':                   return { bg: '#64748b', text: '#fff' };  // slate-500 — saída voluntária
      case 'Cancelada':                    return { bg: '#7f1d1d', text: '#fff' };  // red-950   — cancelado
      default:                             return { bg: '#e2e8f0', text: '#475569' };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#131b2e] p-4 md:p-8 font-sans antialiased text-slate-900 dark:text-slate-100">
      <div className="max-w-[1600px] mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic text-slate-900">
              Matrículas<span className="text-purple-600">.ITP</span>
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Portal de Inscrições e Gestão de Alunos</p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={fetchMatriculas}
              disabled={loading}
              title="Atualizar lista"
              className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-purple-600 hover:border-purple-400 transition-all disabled:opacity-60"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={abrirCadastroDireto}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-lg bg-green-600 hover:bg-green-700 transition-all"
              title="Cadastrar aluno diretamente, sem o workflow de inscrição"
            >
              <GraduationCap size={15} /> Cadastrar Diretamente
            </button>
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
        </div>

        {/* ── KPIs ───────────────────────────────────────────────────────── */}
        <div className="mb-8 space-y-3">

          {/* RAIA 1 — Pipeline Ativo */}
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-purple-400 mb-2 pl-1">Pipeline Ativo</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <KPICard title="Total" value={stats.total} icon={<Users size={18}/>} color="#2e1065" onClick={() => { setPagina(1); setFiltroStatus(''); }} isActive={filtroStatus === ''} />
              <KPICard title="Pendentes" value={stats.pendentes} icon={<Clock size={18}/>} color="#94a3b8" onClick={() => { setPagina(1); setFiltroStatus('Pendente'); }} isActive={filtroStatus === 'Pendente'} />
              <KPICard title="Ag. LGPD" value={stats.aguardandoLgpd} icon={<ShieldAlert size={18}/>} color="#f97316" onClick={() => { setPagina(1); setFiltroStatus('Aguardando Assinatura LGPD'); }} isActive={filtroStatus === 'Aguardando Assinatura LGPD'} />
              <KPICard title="Em Validação" value={stats.emValidacao} icon={<UserCheck size={18}/>} color="#3b82f6" onClick={() => { setPagina(1); setFiltroStatus('Em Validação'); }} isActive={filtroStatus === 'Em Validação'} />
              <KPICard title="Ag. Documentos" value={stats.aguardandoDocs} icon={<FileText size={18}/>} color="#f59e0b" onClick={() => { setPagina(1); setFiltroStatus('Aguardando Documentos'); }} isActive={filtroStatus === 'Aguardando Documentos'} />
              <KPICard title="Docs Enviados" value={stats.documentosEnviados} icon={<FileCheck2 size={18}/>} color="#0891b2" onClick={() => { setPagina(1); setFiltroStatus('Documentos Enviados'); }} isActive={filtroStatus === 'Documentos Enviados'} />
              <KPICard title="Matriculados" value={stats.matriculados} icon={<CheckCircle2 size={18}/>} color="#16a34a" onClick={() => { setPagina(1); setFiltroStatus('Matriculado'); }} isActive={filtroStatus === 'Matriculado'} />
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <KPICard title="Incompletos" value={stats.incompletos} icon={<AlertCircle size={18}/>} color="#dc2626" onClick={() => { setPagina(1); setFiltroStatus('Incompleto'); }} isActive={filtroStatus === 'Incompleto'} />
                <KPICard title="Desistentes" value={stats.desistentes} icon={<UserX size={18}/>} color="#64748b" onClick={() => { setPagina(1); setFiltroStatus('Desistente'); }} isActive={filtroStatus === 'Desistente'} />
                <KPICard title="Cancelados" value={stats.cancelados} icon={<Ban size={18}/>} color="#7f1d1d" onClick={() => { setPagina(1); setFiltroStatus('Cancelada'); }} isActive={filtroStatus === 'Cancelada'} />
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
                <input type="text" value={filtroNome} placeholder="Nome..." className="w-full pl-8 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500" onChange={(e) => { setPagina(1); setFiltroNome(e.target.value); }} />
              </div>
            </FilterGroup>

            <FilterGroup label="CPF">
              <div className="relative">
                <Search className="absolute left-3 top-3 text-gray-400" size={12} />
                <input type="text" value={filtroCpf} placeholder="CPF..." className="w-full pl-8 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500" onChange={(e) => { setPagina(1); setFiltroCpf(e.target.value); }} />
              </div>
            </FilterGroup>

            <FilterGroup label="Cidade">
              <select value={filtroCidade} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-700 uppercase outline-none" onChange={(e) => { setPagina(1); setFiltroCidade(e.target.value); setFiltroBairro(''); }}>
                <option value="">Todas</option>
                {localidades.cidades.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FilterGroup>

            <FilterGroup label="Bairro" isSincrono={!!filtroCidade}>
              <select value={filtroBairro} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-700 uppercase outline-none" onChange={(e) => { setPagina(1); setFiltroBairro(e.target.value); }}>
                <option value="">Todos</option>
                {bairrosDisponiveis.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </FilterGroup>

            <FilterGroup label="Status">
              <select value={filtroStatus} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-700 uppercase outline-none" onChange={(e) => { setPagina(1); setFiltroStatus(e.target.value); }}>
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
              <select value={filtroSexo} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-700 uppercase outline-none" onChange={(e) => { setPagina(1); setFiltroSexo(e.target.value); }}>
                <option value="">Todos</option>
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
                <option value="Outro">Outro</option>
              </select>
            </FilterGroup>

            <FilterGroup label="Alergia">
              <select value={filtroAlergia} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-700 uppercase outline-none" onChange={(e) => { setPagina(1); setFiltroAlergia(e.target.value); }}>
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
                  <SortTh label="Localização" sortKey="cidade" current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <SortTh label="Inscrição" sortKey="data_inscricao" current={sortKey} asc={sortAsc} onSort={handleSort} align="center" />
                  <SortTh label="Status" sortKey="status_matricula" current={sortKey} asc={sortAsc} onSort={handleSort} align="center" />
                  <th className="px-6 py-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                   <tr><td colSpan={5} className="py-10 text-center text-gray-400 font-black uppercase text-xs animate-pulse italic">Sincronizando com Servidor ITP...</td></tr>
                ) : matriculas.length > 0 ? (
                  matriculas.map((m, idx) => {
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
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            <button
                              onClick={() => { setCandidatoSelecionado(m); setIsModalOpen(true); }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-xl text-purple-900 font-black text-[10px] uppercase hover:bg-yellow-400 transition-all border border-gray-200 shadow-sm whitespace-nowrap"
                            >
                              <UserCheck size={12} /> Ficha
                            </button>
                            {podeMatricular(m.status_matricula) && (
                              <button
                                onClick={() => abrirModalMatricular(m)}
                                title="Efetivar Matrícula"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-xl text-white font-black text-[10px] uppercase transition-all shadow-sm whitespace-nowrap"
                              >
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

        {/* ── Paginação ───────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 px-1">
          <p className="text-xs text-gray-500 font-bold">
            {total} registro{total !== 1 ? 's' : ''}
            {(filtroNome || filtroCpf || filtroStatus || filtroCidade || filtroBairro || filtroSexo || filtroAlergia)
              ? ' (filtrado)' : ''}
            {totalPaginas > 1 && (
              <span className="ml-2 text-gray-400">
                — página {pagina} de {totalPaginas} &middot; {LIMITE}/pág.
              </span>
            )}
          </p>
          {totalPaginas > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPagina(1)}
                disabled={pagina <= 1 || loading}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 font-black text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:border-purple-400 hover:text-purple-700 transition-colors shadow-sm"
              >«</button>
              <button
                onClick={() => setPagina(p => Math.max(1, p - 1))}
                disabled={pagina <= 1 || loading}
                className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:border-purple-400 hover:text-purple-700 transition-colors shadow-sm"
              >‹ Anterior</button>
              <span className="px-3 py-1.5 rounded-lg bg-purple-600 text-white font-black text-xs shadow-sm">
                {pagina} / {totalPaginas}
              </span>
              <button
                onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                disabled={pagina >= totalPaginas || loading}
                className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:border-purple-400 hover:text-purple-700 transition-colors shadow-sm"
              >Próxima ›</button>
              <button
                onClick={() => setPagina(totalPaginas)}
                disabled={pagina >= totalPaginas || loading}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 font-black text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:border-purple-400 hover:text-purple-700 transition-colors shadow-sm"
              >»</button>
            </div>
          )}
        </div>

      </div>
      {isModalOpen && candidatoSelecionado && (
        <DossieCandidato
          aluno={candidatoSelecionado}
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchMatriculas}
        />
      )}

      {/* ── Modal: Cadastro Direto ───────────────────────────────────── */}
      {showCadastroDireto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-green-600 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl"><GraduationCap size={20} className="text-white" /></div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-green-100">Matrícula Direta</p>
                  <p className="text-sm font-black text-white">Cadastrar Aluno sem Workflow</p>
                </div>
              </div>
              <button onClick={() => setShowCadastroDireto(false)} className="text-white/70 hover:text-white"><X size={18} /></button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5">
              {resultadoDireto ? (
                <div className="text-center py-8 space-y-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 size={32} className="text-green-600" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-green-600">Aluno Cadastrado!</p>
                  <p className="font-bold text-slate-800 dark:text-white">{resultadoDireto.nome_completo}</p>
                  <p className="text-[10px] text-slate-500">Número de Matrícula</p>
                  <p className="font-mono text-2xl font-black text-green-700 tracking-wider">{resultadoDireto.numero_matricula}</p>
                  <div className="flex gap-3 justify-center mt-4">
                    <button onClick={() => { setResultadoDireto(null); setFormDireto({ ...FORM_DIRETO_VAZIO, curso_ids: [] }); setErroDireto(null); }}
                      className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-xs uppercase">
                      + Cadastrar Outro
                    </button>
                    <button onClick={() => setShowCadastroDireto(false)}
                      className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase hover:bg-slate-50">
                      Fechar
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={salvarCadastroDireto} className="space-y-5">

                  {/* ── Identificação ── */}
                  <fieldset className="space-y-3">
                    <legend className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Identificação</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Nome Completo *</label>
                        <input required value={formDireto.nome_completo} onChange={e => setFormDireto(p => ({ ...p, nome_completo: e.target.value }))}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">CPF *</label>
                        <input required value={formDireto.cpf} onChange={e => setFormDireto(p => ({ ...p, cpf: e.target.value }))}
                          placeholder="000.000.000-00"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Data de Nascimento</label>
                        <input type="date" value={formDireto.data_nascimento} onChange={e => setFormDireto(p => ({ ...p, data_nascimento: e.target.value }))}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Sexo</label>
                        <select value={formDireto.sexo} onChange={e => setFormDireto(p => ({ ...p, sexo: e.target.value }))}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white">
                          <option value="">Selecione...</option>
                          <option>Masculino</option><option>Feminino</option><option>Outro</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Escolaridade</label>
                        <select value={formDireto.escolaridade} onChange={e => setFormDireto(p => ({ ...p, escolaridade: e.target.value }))}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white">
                          <option value="">Selecione...</option>
                          <option>Ensino Fundamental Incompleto</option>
                          <option>Ensino Fundamental Completo</option>
                          <option>Ensino Médio Incompleto</option>
                          <option>Ensino Médio Completo</option>
                          <option>Ensino Superior Incompleto</option>
                          <option>Ensino Superior Completo</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Turno Escolar</label>
                        <select value={formDireto.turno_escolar} onChange={e => setFormDireto(p => ({ ...p, turno_escolar: e.target.value }))}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white">
                          <option value="">Selecione...</option>
                          <option>Manhã</option><option>Tarde</option><option>Noite</option><option>Integral</option>
                        </select>
                      </div>
                    </div>
                  </fieldset>

                  {/* ── Contato ── */}
                  <fieldset className="space-y-3">
                    <legend className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Contato</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">E-mail *</label>
                        <input required type="email" value={formDireto.email} onChange={e => setFormDireto(p => ({ ...p, email: e.target.value }))}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Celular *</label>
                        <input required value={formDireto.celular} onChange={e => setFormDireto(p => ({ ...p, celular: e.target.value }))}
                          placeholder="(21) 99999-9999"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Telefone Alternativo</label>
                        <input value={formDireto.telefone_alternativo} onChange={e => setFormDireto(p => ({ ...p, telefone_alternativo: e.target.value }))}
                          placeholder="(21) 99999-9999"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                      </div>
                    </div>
                  </fieldset>

                  {/* ── Endereço ── */}
                  <fieldset className="space-y-3">
                    <legend className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Endereço</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                          CEP {buscandoCep && <span className="text-green-500 ml-1">buscando...</span>}
                        </label>
                        <input value={formDireto.cep}
                          onChange={e => {
                            const v = e.target.value;
                            setFormDireto(p => ({ ...p, cep: v }));
                            if (v.replace(/\D/g, '').length === 8) buscarCep(v);
                          }}
                          onBlur={e => buscarCep(e.target.value)}
                          placeholder="00000-000" maxLength={9}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Logradouro</label>
                        <input value={formDireto.logradouro} onChange={e => setFormDireto(p => ({ ...p, logradouro: e.target.value }))}
                          placeholder="Rua, Avenida..."
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Número</label>
                        <input value={formDireto.numero} onChange={e => setFormDireto(p => ({ ...p, numero: e.target.value }))}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Complemento</label>
                        <input value={formDireto.complemento} onChange={e => setFormDireto(p => ({ ...p, complemento: e.target.value }))}
                          placeholder="Apto, Casa..."
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Bairro</label>
                        <input value={formDireto.bairro} onChange={e => setFormDireto(p => ({ ...p, bairro: e.target.value }))}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Cidade</label>
                        <input value={formDireto.cidade} onChange={e => setFormDireto(p => ({ ...p, cidade: e.target.value }))}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Estado (UF)</label>
                        <input value={formDireto.estado_uf} onChange={e => setFormDireto(p => ({ ...p, estado_uf: e.target.value }))}
                          placeholder="RJ" maxLength={2}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 uppercase" />
                      </div>
                    </div>
                  </fieldset>

                  {/* ── Responsável (somente menores) ── */}
                  {menorDeIdadeDireto && (
                    <fieldset className="space-y-3 border border-orange-200 rounded-2xl p-4 bg-orange-50">
                      <legend className="text-[9px] font-black uppercase tracking-widest text-orange-500 px-1">Responsável (menor de idade)</legend>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Nome Completo do Responsável</label>
                          <input value={formDireto.nome_responsavel} onChange={e => setFormDireto(p => ({ ...p, nome_responsavel: e.target.value }))}
                            className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Grau de Parentesco</label>
                          <select value={formDireto.grau_parentesco} onChange={e => setFormDireto(p => ({ ...p, grau_parentesco: e.target.value }))}
                            className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
                            <option value="">Selecione...</option>
                            <option>Mãe</option><option>Pai</option><option>Avó/Avô</option>
                            <option>Tia/Tio</option><option>Irmã/Irmão</option><option>Responsável Legal</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">CPF do Responsável</label>
                          <input value={formDireto.cpf_responsavel} onChange={e => setFormDireto(p => ({ ...p, cpf_responsavel: e.target.value }))}
                            placeholder="000.000.000-00"
                            className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">E-mail do Responsável</label>
                          <input type="email" value={formDireto.email_responsavel} onChange={e => setFormDireto(p => ({ ...p, email_responsavel: e.target.value }))}
                            className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                        </div>
                      </div>
                    </fieldset>
                  )}

                  {/* ── Saúde ── */}
                  <fieldset className="space-y-3">
                    <legend className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Saúde e Cuidados</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Possui Alergias?</label>
                        <select value={formDireto.possui_alergias} onChange={e => setFormDireto(p => ({ ...p, possui_alergias: e.target.value }))}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white">
                          <option>Não</option><option>Sim</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Cuidado Especial?</label>
                        <select value={formDireto.cuidado_especial} onChange={e => setFormDireto(p => ({ ...p, cuidado_especial: e.target.value }))}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white">
                          <option>Não</option><option>Sim</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Usa Medicamento?</label>
                        <select value={formDireto.uso_medicamento} onChange={e => setFormDireto(p => ({ ...p, uso_medicamento: e.target.value }))}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white">
                          <option>Não</option><option>Sim</option>
                        </select>
                      </div>
                    </div>
                    {(formDireto.possui_alergias === 'Sim' || formDireto.cuidado_especial === 'Sim' || formDireto.uso_medicamento === 'Sim') && (
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Detalhes (alergias, cuidados, medicamentos)</label>
                        <textarea value={formDireto.detalhes_cuidado} onChange={e => setFormDireto(p => ({ ...p, detalhes_cuidado: e.target.value }))}
                          rows={2} placeholder="Descreva alergias, cuidados especiais e medicamentos em uso..."
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
                      </div>
                    )}
                  </fieldset>

                  {/* ── Cursos ── */}
                  {cursosAcademico.length > 0 && (
                    <fieldset>
                      <legend className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">
                        Cursos a Matricular
                        <span className="ml-2 font-normal normal-case text-slate-400">({formDireto.curso_ids.length} selecionado{formDireto.curso_ids.length !== 1 ? 's' : ''})</span>
                      </legend>
                      <div className="grid grid-cols-2 gap-2">
                        {cursosAcademico.map((c: any) => {
                          const ativo = formDireto.curso_ids.includes(c.id);
                          return (
                            <button key={c.id} type="button" onClick={() => toggleCursoDireto(c.id)}
                              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-[11px] font-bold transition-all ${
                                ativo ? 'bg-green-600 border-green-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-green-400'
                              }`}>
                              <span className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border ${ativo ? 'bg-white border-white' : 'border-slate-300'}`}>
                                {ativo && <span className="text-green-600 text-[10px] font-black">✓</span>}
                              </span>
                              <span className="truncate">{c.sigla} – {c.nome}</span>
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                  )}

                  {/* ── Termos ── */}
                  <fieldset className="space-y-2">
                    <legend className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Termos</legend>
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <input type="checkbox" id="lgpd_direto" checked={formDireto.lgpd_aceito}
                        onChange={e => setFormDireto(p => ({ ...p, lgpd_aceito: e.target.checked }))}
                        className="mt-0.5 rounded" />
                      <label htmlFor="lgpd_direto" className="text-[11px] font-bold text-amber-700 cursor-pointer">
                        Confirmo que o aluno autorizou o uso de seus dados conforme a LGPD (Lei 13.709/2018)
                      </label>
                    </div>
                    <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
                      <input type="checkbox" id="autoriza_imagem_direto" checked={formDireto.autoriza_imagem}
                        onChange={e => setFormDireto(p => ({ ...p, autoriza_imagem: e.target.checked }))}
                        className="mt-0.5 rounded" />
                      <label htmlFor="autoriza_imagem_direto" className="text-[11px] font-bold text-blue-700 cursor-pointer">
                        Autorizo o ITP a utilizar fotos e vídeos do aluno para fins institucionais e redes sociais
                      </label>
                    </div>
                  </fieldset>

                  {erroDireto && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold rounded-xl px-4 py-3">⚠ {erroDireto}</div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowCadastroDireto(false)}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-black text-xs uppercase hover:bg-slate-50">
                      Cancelar
                    </button>
                    <button type="submit" disabled={salvandoDireto}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-black text-xs uppercase">
                      {salvandoDireto ? <><RefreshCw size={13} className="animate-spin" /> Cadastrando...</> : <><GraduationCap size={13} /> Cadastrar Aluno</>}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Efetivar Matrícula ─────────────────────────────────── */}
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
                /* ── SUCESSO ── */
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
                  <button
                    onClick={fecharModalMatricular}
                    className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              ) : (
                /* ── FORMULÁRIO ── */
                <>
                  {/* Dados do candidato */}
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-4 space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Candidato</p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <InfoItem label="CPF" value={modalMatricular.candidato.cpf} />
                      <InfoItem label="Idade" value={modalMatricular.candidato.idade ? `${modalMatricular.candidato.idade} anos` : modalMatricular.candidato.data_nascimento ? fmtDateSafe(modalMatricular.candidato.data_nascimento) : '—'} />
                      <InfoItem label="Cidade" value={modalMatricular.candidato.cidade || '—'} />
                      <InfoItem label="Status Atual" value={modalMatricular.candidato.status_matricula} />
                    </div>
                    {modalMatricular.candidato.cursos_desejados && (
                      <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Interesse declarado</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">{modalMatricular.candidato.cursos_desejados}</p>
                      </div>
                    )}
                  </div>

                  {/* Seleção de cursos */}
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">
                      Cursos a matricular <span className="text-red-500">*</span>
                      <span className="ml-2 font-normal normal-case text-slate-400">({cursosSelecionados.length} selecionado{cursosSelecionados.length !== 1 ? 's' : ''})</span>
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {cursosDisponiveis.map(curso => {
                        const ativo = cursosSelecionados.includes(curso);
                        return (
                          <button
                            key={curso}
                            type="button"
                            onClick={() => toggleCurso(curso)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-[11px] font-bold transition-all ${
                              ativo
                                ? 'bg-green-600 border-green-600 text-white shadow-sm'
                                : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-green-400'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border ${
                              ativo ? 'bg-white border-white' : 'border-slate-300 dark:border-slate-500'
                            }`}>
                              {ativo && <span className="text-green-600 text-[10px] font-black">✓</span>}
                            </span>
                            {curso}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Aviso */}
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-3">
                    <p className="text-[10px] text-amber-700 dark:text-amber-300 font-bold">
                      ⚠️ Esta ação é irreversível. Será gerado um número de matrícula e o candidato será registrado como aluno do ITP.
                    </p>
                  </div>

                  {/* Botões */}
                  <div className="flex gap-3">
                    <button
                      onClick={fecharModalMatricular}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-black text-xs uppercase hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={confirmarMatricula}
                      disabled={matriculando || cursosSelecionados.length === 0}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-widest transition-colors shadow-sm"
                    >
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

function InfoItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{value || '—'}</p>
    </div>
  );
}
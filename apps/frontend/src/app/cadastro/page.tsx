'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users, Briefcase, ShieldCheck, GraduationCap, UserCheck,
  Package, Heart, Landmark, MapPin, Phone, User, Activity,
  Plus, Trash2, Edit3, Search, X, AlertCircle, Eye, EyeOff, Settings2, UserPlus, RefreshCw,
  ArrowLeftRight, BookOpen, Tag, UserCog, CreditCard, Repeat,
} from 'lucide-react';
import api from '@/services/api';
import { useAuth } from '@/context/auth-context';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TabId = 'funcionarios' | 'usuarios' | 'grupos' | 'cursos' | 'alunos' | 'insumos' | 'doadores' | 'contas'
  | 'fin_tipos_mov' | 'fin_planos' | 'fin_categorias' | 'fin_tipos_pessoa' | 'fin_formas_pag' | 'fin_recorrencias';

interface Professor {
  id: string;
  nome: string;
  especialidade?: string;
  email?: string;
  cpf?: string;
  data_nascimento?: string;
  celular?: string;
  sexo?: string;
  raca_cor?: string;
  escolaridade?: string;
  cep?: string;
  numero_residencia?: string;
  complemento?: string;
  estado?: string;
  telefone_emergencia_1?: string;
  telefone_emergencia_2?: string;
  possui_deficiencia?: boolean;
  deficiencia_descricao?: string;
  possui_alergias?: boolean;
  alergias_descricao?: string;
  usa_medicamentos?: boolean;
  medicamentos_descricao?: string;
  interesse_cursos?: boolean;
  ativo?: boolean;
}
interface Funcionario {
  id: string;
  nome: string;
  cargo?: string;
  email?: string;
  cpf?: string;
  data_nascimento?: string;
  celular?: string;
  sexo?: string;
  raca_cor?: string;
  escolaridade?: string;
  cep?: string;
  logradouro?: string;
  numero_residencia?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  telefone_emergencia_1?: string;
  telefone_emergencia_2?: string;
  possui_deficiencia?: boolean;
  deficiencia_descricao?: string;
  possui_alergias?: boolean;
  alergias_descricao?: string;
  usa_medicamentos?: boolean;
  medicamentos_descricao?: string;
  possui_plano_saude?: boolean;
  plano_saude?: string;
  numero_sus?: string;
  interesse_cursos?: boolean;
  ativo?: boolean;
  matricula?: string;
}
interface UsuarioAdmin { id: string; nome: string; email: string; role: string; matricula?: string; grupo?: { id: string; nome: string }; }
interface Grupo { id: string; nome: string; grupo_permissoes?: any; usuarios?: { id: string; nome: string }[]; }
interface Curso { id: string; codigo?: string; nome: string; sigla: string; status: string; periodo?: string; descricao?: string; }
interface Aluno { id: string; numero_matricula: string; nome_completo: string; cpf?: string; celular?: string; data_nascimento?: string; cursos_matriculados?: string; cidade?: string; ativo?: boolean; }
interface Insumo { id: string; nome: string; categoria?: string; quantidade?: number; unidade?: string; fornecedor?: string; status?: string; }
interface Doador { id: string; nome: string; tipo?: string; cpf_cnpj?: string; email?: string; telefone?: string; cidade?: string; ativo?: boolean; codigo_interno?: string | null; }
interface ContaBancaria { id: string; banco: string; agencia?: string; conta: string; tipo?: string; titular: string; pix?: string; ativo?: boolean; codigo_interno?: string | null; }

const ROLES = [
  { value: 'user',    label: 'Usuário Comum' },
  { value: 'cozinha', label: 'Cozinha' },
  { value: 'assist',  label: 'Assistente' },
  { value: 'monitor', label: 'Monitor' },
  { value: 'prof',    label: 'Professor' },
  { value: 'adjunto', label: 'Adjunto' },
  { value: 'drt',     label: 'Diretor' },
  { value: 'vp',      label: 'Vice-Presidente' },
  { value: 'prt',     label: 'Presidente' },
  { value: 'admin',   label: 'Administrador' },
];

const STATUS_INSUMO = ['ok', 'alerta', 'zerado'];
const CATEGORIAS_INSUMO = ['Alimentação', 'Higiene', 'Material Escolar', 'Uniforme', 'Limpeza', 'Tecnologia', 'Outros'];
const TIPOS_CONTA = ['Corrente', 'Poupança', 'Pagamento', 'Investimento'];

// Grupos que podem excluir registros do Cadastro Básico
const ROLES_PODEM_DELETAR = ['admin', 'prt', 'vp', 'drt', 'adjunto'];
// Grupos que podem criar um usuário a partir de um funcionário
const ROLES_CRIAR_USUARIO = ['admin', 'prt', 'vp', 'drt'];

// Módulos do sistema para configuração de permissões de grupo
const MODULOS_SISTEMA = [
  { key: 'dashboard',       label: 'Dashboard' },
  { key: 'cadastro_basico', label: 'Cadastro Básico' },
  { key: 'matriculas',      label: 'Matrículas' },
  { key: 'academico',       label: 'Acadêmico' },
  { key: 'financeiro',      label: 'Financeiro' },
  { key: 'doacoes',         label: 'Doações' },
  { key: 'estoque',         label: 'Estoque' },
];

// Proposta de numeração automática por categoria (aguardando validação)
const PROTO_NUMERACAO = [
  { cat: 'Alimentação',     codigo: 'CZNH', exemplo: 'ITP-CZNH-202603-001' },
  { cat: 'Higiene',         codigo: 'HGNE', exemplo: 'ITP-HGNE-202603-001' },
  { cat: 'Material Escolar',codigo: 'MESL', exemplo: 'ITP-MESL-202603-001' },
  { cat: 'Uniforme',        codigo: 'UNFM', exemplo: 'ITP-UNFM-202603-001' },
  { cat: 'Limpeza',         codigo: 'LMPZ', exemplo: 'ITP-LMPZ-202603-001' },
  { cat: 'Tecnologia',      codigo: 'TKNL', exemplo: 'ITP-TKNL-202603-001' },
  { cat: 'Outros',          codigo: 'OTRS', exemplo: 'ITP-OTRS-202603-001' },
  { cat: 'Funcionário',     codigo: 'FUNC', exemplo: 'ITP-FUNC-202603-001' },
  { cat: 'Curso',           codigo: 'CRSO', exemplo: 'ITP-CRSO-202603-001' },
  { cat: 'Doador',          codigo: 'DOAD', exemplo: 'ITP-DOAD-202603-001' },
  { cat: 'Conta Bancária',  codigo: 'BNCO', exemplo: 'ITP-BNCO-202603-001' },
  { cat: 'Aluno',           codigo: 'AUNO', exemplo: 'ITP-AUNO-20260301-01 (já implementado)' },
];

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function CadastroBasicoPage() {
  // hooks SEMPRE antes de qualquer return condicional
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('funcionarios');
  const [isMounted, setIsMounted] = useState(false);
  const [counts, setCounts] = useState<Record<TabId, number>>({
    funcionarios: 0, usuarios: 0, grupos: 0, cursos: 0,
    alunos: 0, insumos: 0, doadores: 0, contas: 0,
    fin_tipos_mov: 0, fin_planos: 0, fin_categorias: 0,
    fin_tipos_pessoa: 0, fin_formas_pag: 0, fin_recorrencias: 0,
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Carrega contagens de todas as abas em paralelo (KPIs visíveis imediatamente)
  const loadAllCounts = useCallback(async () => {
    setRefreshing(true);
    const endpoints: Array<[TabId, string]> = [
      ['funcionarios', '/funcionarios'],
      ['usuarios',     '/admin/usuarios'],
      ['grupos',       '/grupos'],
      ['cursos',       '/academico/cursos'],
      ['alunos',       '/academico/alunos'],
      ['insumos',      '/estoque/categorias'],
      ['doadores',     '/cadastro/doadores'],
      ['contas',       '/cadastro/contas-bancarias'],
      ['fin_tipos_mov',    '/financeiro/tipos-movimentacao'],
      ['fin_planos',       '/financeiro/planos-contas'],
      ['fin_categorias',   '/financeiro/categorias'],
      ['fin_tipos_pessoa', '/financeiro/tipos-pessoa'],
      ['fin_formas_pag',   '/financeiro/formas-pagamento'],
      ['fin_recorrencias', '/financeiro/recorrencias'],
    ];
    const results = await Promise.allSettled(endpoints.map(([, url]) => api.get(url)));
    setCounts(prev => {
      const next = { ...prev };
      endpoints.forEach(([tab], i) => {
        const r = results[i];
        if (r.status === 'fulfilled' && Array.isArray(r.value.data)) next[tab] = r.value.data.length;
      });
      return next;
    });
    setRefreshing(false);
  }, []);

  useEffect(() => { setIsMounted(true); loadAllCounts(); }, [loadAllCounts]);

  const handleRefresh = () => { setRefreshKey(k => k + 1); loadAllCounts(); };

  // CORREÇÃO: useMemo garante referências estáveis → evita re-render loop nos filhos
  const countSetters = useMemo(() => {
    const m = (tab: TabId) => (n: number) => setCounts(p => ({ ...p, [tab]: n }));
    return {
      funcionarios: m('funcionarios'), usuarios: m('usuarios'), grupos: m('grupos'),
      cursos: m('cursos'), alunos: m('alunos'), insumos: m('insumos'),
      doadores: m('doadores'), contas: m('contas'),
      fin_tipos_mov: m('fin_tipos_mov'), fin_planos: m('fin_planos'),
      fin_categorias: m('fin_categorias'), fin_tipos_pessoa: m('fin_tipos_pessoa'),
      fin_formas_pag: m('fin_formas_pag'), fin_recorrencias: m('fin_recorrencias'),
    } as Record<TabId, (n: number) => void>;
  }, []);

  if (!isMounted) return <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#131b2e]" />;

  const TABS: { id: TabId; label: string; icon: React.ElementType; cor: string }[] = [
    { id: 'funcionarios', label: 'Funcionários',  icon: Briefcase,     cor: 'purple' },
    { id: 'usuarios',     label: 'Usuários',       icon: Users,         cor: 'blue' },
    { id: 'grupos',       label: 'Grupos/Perfis',  icon: ShieldCheck,   cor: 'emerald' },
    { id: 'cursos',       label: 'Cursos',         icon: GraduationCap, cor: 'amber' },
    { id: 'alunos',       label: 'Alunos',         icon: UserCheck,     cor: 'cyan' },
    { id: 'insumos',      label: 'Insumos',        icon: Package,       cor: 'orange' },
    { id: 'doadores',     label: 'Doadores',       icon: Heart,         cor: 'rose' },
    { id: 'contas',       label: 'Contas Banc.',   icon: Landmark,      cor: 'indigo' },
  ];

  const TABS_FINANCEIRO: typeof TABS = [
    { id: 'fin_tipos_mov',    label: 'Tipo Movim.',    icon: ArrowLeftRight, cor: 'teal' },
    { id: 'fin_planos',       label: 'Plano Contas',   icon: BookOpen,       cor: 'teal' },
    { id: 'fin_categorias',   label: 'Categorias',     icon: Tag,            cor: 'teal' },
    { id: 'fin_tipos_pessoa', label: 'Tipo Pessoa',    icon: UserCog,        cor: 'teal' },
    { id: 'fin_formas_pag',   label: 'Forma Pagam.',   icon: CreditCard,     cor: 'teal' },
    { id: 'fin_recorrencias', label: 'Recorrências',   icon: Repeat,         cor: 'teal' },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#131b2e] p-4 md:p-8 font-sans antialiased text-slate-900 dark:text-slate-100">
      <div className="max-w-[1600px] mx-auto">

        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-purple-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">
                Configurações Core
              </span>
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                <Settings2 size={12} /> Gestão de Mestres e Infra
              </span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter italic">
              Cad. Básico<span className="text-purple-600">.ITP</span>
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              Cadastro centralizado de todos os registros do sistema
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Atualizar todos os registros"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:border-purple-400 hover:text-purple-600 transition-all text-[10px] font-black uppercase tracking-widest shadow-sm disabled:opacity-60"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </header>

        {/* TABS — scroll horizontal em mobile */}
        <div className="flex gap-3 overflow-x-auto pb-2 mb-4 snap-x">
          {TABS.map(t => (
            <TabKpi key={t.id} tab={t} active={activeTab} set={setActiveTab} count={counts[t.id]} />
          ))}
        </div>

        {/* FINANCEIRO — sub-tabs de cadastro */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-teal-200 dark:bg-teal-800" />
            <span className="text-[9px] font-black uppercase tracking-widest text-teal-600 dark:text-teal-400 px-3 py-1 bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 rounded-full">
              Cadastros Financeiros
            </span>
            <div className="h-px flex-1 bg-teal-200 dark:bg-teal-800" />
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
            {TABS_FINANCEIRO.map(t => (
              <TabKpi key={t.id} tab={t} active={activeTab} set={setActiveTab} count={counts[t.id]} />
            ))}
          </div>
        </div>

        {/* CONTEÚDO */}
        {activeTab === 'funcionarios' && <FuncionariosTab key={refreshKey} onCount={countSetters.funcionarios} />}
        {activeTab === 'usuarios'     && <UsuariosTab     key={refreshKey} onCount={countSetters.usuarios} />}
        {activeTab === 'grupos'       && <GruposTab       key={refreshKey} onCount={countSetters.grupos} />}
        {activeTab === 'cursos'       && <CursosTab       key={refreshKey} onCount={countSetters.cursos} />}
        {activeTab === 'alunos'       && <AlunosTab       key={refreshKey} onCount={countSetters.alunos} />}
        {activeTab === 'insumos'      && <InsumosTab      key={refreshKey} onCount={countSetters.insumos} />}
        {activeTab === 'doadores'     && <DoadoresTab     key={refreshKey} onCount={countSetters.doadores} />}
        {activeTab === 'contas'       && <ContasTab       key={refreshKey} onCount={countSetters.contas} />}
        {activeTab === 'fin_tipos_mov'    && <FinLookupTab key={`${refreshKey}-ftm`} onCount={countSetters.fin_tipos_mov}    endpoint="/financeiro/tipos-movimentacao" titulo="Tipo de Movimentação" cor="teal" />}
        {activeTab === 'fin_planos'       && <FinLookupTab key={`${refreshKey}-fpc`} onCount={countSetters.fin_planos}       endpoint="/financeiro/planos-contas"      titulo="Plano de Contas"       cor="teal" />}
        {activeTab === 'fin_categorias'   && <FinLookupTab key={`${refreshKey}-fca`} onCount={countSetters.fin_categorias}   endpoint="/financeiro/categorias"          titulo="Categoria Financeira"  cor="teal" />}
        {activeTab === 'fin_tipos_pessoa' && <FinLookupTab key={`${refreshKey}-ftp`} onCount={countSetters.fin_tipos_pessoa} endpoint="/financeiro/tipos-pessoa"        titulo="Tipo de Pessoa"        cor="teal" />}
        {activeTab === 'fin_formas_pag'   && <FinLookupTab key={`${refreshKey}-ffp`} onCount={countSetters.fin_formas_pag}   endpoint="/financeiro/formas-pagamento"    titulo="Forma de Pagamento"    cor="teal" />}
        {activeTab === 'fin_recorrencias' && <FinLookupTab key={`${refreshKey}-frc`} onCount={countSetters.fin_recorrencias} endpoint="/financeiro/recorrencias"        titulo="Recorrência"           cor="teal" />}

      </div>
    </div>
  );
}

// ─── Tab: Funcionários ────────────────────────────────────────────────────────

function FuncionariosTab({ onCount }: { onCount: (n: number) => void }) {
  const { user } = useAuth();
  const [lista, setLista]   = useState<Funcionario[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro]     = useState('');
  const [busca, setBusca]   = useState('');
  const [modal, setModal]   = useState<{ aberto: boolean; editando: Funcionario | null }>({ aberto: false, editando: null });
  const [form, setForm]     = useState<Partial<Funcionario>>({ ativo: true });
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  // Estado do modal "Criar Usuário" a partir do funcionário
  const [modalUsuario, setModalUsuario] = useState<{ aberto: boolean; funcionario: Funcionario | null }>({ aberto: false, funcionario: null });
  const [formUsuario, setFormUsuario] = useState<any>({ role: 'prof', senha: '' });
  const [salvandoUsuario, setSalvandoUsuario] = useState(false);
  const [erroUsuario, setErroUsuario] = useState('');
  const [mostrarSenhaUsuario, setMostrarSenhaUsuario] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rP, rG, rU] = await Promise.all([
        api.get('/funcionarios'),
        api.get('/grupos'),
        api.get('/admin/usuarios'),
      ]);
      setLista(rP.data); setGrupos(rG.data); setUsuarios(rU.data); onCount(rP.data.length);
    } catch { setErro('Erro ao carregar funcionários.'); }
    setLoading(false);
  }, [onCount]);

  useEffect(() => { load(); }, [load]);

  const buscarCep = async (cep: string) => {
    const numeros = cep.replace(/\D/g, '');
    if (numeros.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${numeros}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm(p => ({
          ...p,
          logradouro: data.logradouro ?? p.logradouro,
          bairro: data.bairro ?? p.bairro,
          cidade: data.localidade ?? p.cidade,
          estado: data.uf ?? p.estado,
        }));
      }
    } catch { /* ignora falhas silenciosamente */ }
    setBuscandoCep(false);
  };

  const abrirCriar  = () => { setForm({ ativo: true }); setModal({ aberto: true, editando: null }); };
  const abrirEditar = (p: Funcionario) => {
    setForm({
      ...p,
      // Garante formato YYYY-MM-DD para o input type="date"
      data_nascimento: p.data_nascimento ? String(p.data_nascimento).slice(0, 10) : undefined,
    });
    setModal({ aberto: true, editando: p });
  };
  const fecharModal = () => { setModal({ aberto: false, editando: null }); setForm({ ativo: true }); setErro(''); };

  const abrirCriarUsuario = (p: Funcionario) => {
    setFormUsuario({ nome: p.nome, email: p.email ?? '', role: 'prof', senha: '', grupo_id: '' });
    setErroUsuario('');
    setMostrarSenhaUsuario(false);
    setModalUsuario({ aberto: true, funcionario: p });
  };
  const fecharModalUsuario = () => {
    setModalUsuario({ aberto: false, funcionario: null });
    setFormUsuario({ role: 'prof', senha: '' });
    setErroUsuario('');
  };
  const handleCriarUsuario = async (e: React.FormEvent) => {
    e.preventDefault(); setSalvandoUsuario(true); setErroUsuario('');
    try {
      const payload: any = {
        nome: formUsuario.nome,
        email: formUsuario.email,
        password: formUsuario.senha,
        role: formUsuario.role,
        // Não passa a matrícula FUNC do funcionário — o backend gera uma baseada no cargo
      };
      if (formUsuario.grupo_id) payload.grupo_id = formUsuario.grupo_id;
      const resp = await api.post('/admin/usuarios', payload);
      fecharModalUsuario();
      load();
      const mat = resp.data?.matricula || modalUsuario.funcionario?.matricula || '';
      alert(`✅ Usuário criado para ${formUsuario.nome}!${
        mat ? `\n\n🧯 Matrícula: ${mat}\n\nUm e-mail com os dados de acesso foi enviado para ${formUsuario.email}.` : ''
      }`);
    } catch (err: any) {
      setErroUsuario(err.response?.data?.message || 'Erro ao criar usuário.');
    }
    setSalvandoUsuario(false);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault(); setSalvando(true); setErro('');
    try {
      if (modal.editando) await api.patch(`/funcionarios/${modal.editando.id}`, form);
      else await api.post('/funcionarios', form);
      fecharModal(); load();
    } catch (e: any) { setErro(e.response?.data?.message || 'Erro ao salvar.'); }
    setSalvando(false);
  };

  const handleDeletar = async (id: string) => {
    if (!confirm('Confirmar exclusão?')) return;
    try { await api.delete(`/funcionarios/${id}`); load(); }
    catch (e: any) { alert(e.response?.data?.message || 'Erro ao excluir.'); }
  };

  const podeCriarUsuario = ROLES_CRIAR_USUARIO.includes(user?.role ?? '');
  // Conjunto de e-mails que já possuem usuário cadastrado
  const emailsComUsuario = new Set(usuarios.map(u => (u.email ?? '').toLowerCase()));
  // Matrícula do usuário vinculado pelo e-mail (fallback quando funcionário não tem matrícula própria)
  const matriculaPorEmail = new Map(usuarios.map(u => [(u.email ?? '').toLowerCase(), u.matricula]));
  const filtrados = lista.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (p.cargo ?? '').toLowerCase().includes(busca.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      {erro && <Banner tipo="erro" msg={erro} onClose={() => setErro('')} />}

      <BarraAcao
        busca={busca} setBusca={setBusca} placeholder="Buscar funcionário ou cargo..."
        btnLabel="Novo Funcionário" btnCor="purple" onClick={abrirCriar}
      />

      <Tabela loading={loading} vazio={filtrados.length === 0} msgVazio="Nenhum funcionário encontrado.">
        <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-600">
          <tr className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
            <th className="text-left px-6 py-4">Nome</th>
            <th className="text-left px-6 py-4">Cargo / Especialidade</th>
            <th className="text-left px-6 py-4">E-mail</th>
            <th className="text-left px-6 py-4">Matrícula</th>
            <th className="text-center px-6 py-4">Status</th>
            <th className="text-right px-6 py-4">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
          {filtrados.map(p => {
            const matriculaExibida = p.matricula || matriculaPorEmail.get((p.email ?? '').toLowerCase());
            return (
            <tr key={p.id} className="hover:bg-purple-50/30 dark:hover:bg-purple-900/20 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <Avatar nome={p.nome} cor="purple" />
                  <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{p.nome}</span>
                </div>
              </td>
              <td className="px-6 py-4 text-xs text-slate-500">{p.cargo || '–'}</td>
              <td className="px-6 py-4 text-xs text-slate-500">{p.email || '–'}</td>
              <td className="px-6 py-4">
                {matriculaExibida ? (
                  <span className="font-mono text-[10px] font-bold bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-lg border border-purple-100 dark:border-purple-800">
                    {matriculaExibida}
                  </span>
                ) : <span className="text-slate-300 text-xs">–</span>}
              </td>
              <td className="px-6 py-4 text-center">
                <StatusBadge ativo={p.ativo !== false} />
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-1">
                  {podeCriarUsuario && (
                    <button
                      onClick={() => abrirCriarUsuario(p)}
                      disabled={!!p.email && emailsComUsuario.has((p.email ?? '').toLowerCase())}
                      title={
                        p.email && emailsComUsuario.has((p.email ?? '').toLowerCase())
                          ? 'Já possui conta de usuário'
                          : 'Criar conta de usuário'
                      }
                      className="p-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <UserPlus size={11} />
                    </button>
                  )}
                  <AcoesBotoes onEdit={() => abrirEditar(p)} onDelete={() => handleDeletar(p.id)} />
                </div>
              </td>
            </tr>
            );
          })}
        </tbody>
      </Tabela>

      {/* Modal: Criar Usuário a partir do Funcionário */}
      {modalUsuario.aberto && (
        <Modal title={`Criar Usuário — ${modalUsuario.funcionario?.nome ?? ''}`} onClose={fecharModalUsuario}>
          <form onSubmit={handleCriarUsuario} className="space-y-4">
            {erroUsuario && <ErroBanner msg={erroUsuario} />}
            {modalUsuario.funcionario?.matricula && (
              <div className="flex items-center gap-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl px-4 py-3">
                <span className="text-xs text-purple-700 dark:text-purple-300 font-semibold">🪪 Matrícula que será vinculada:</span>
                <span className="font-mono text-sm font-black text-purple-800 dark:text-purple-200 bg-purple-100 dark:bg-purple-900/50 px-3 py-0.5 rounded-lg">
                  {modalUsuario.funcionario.matricula}
                </span>
              </div>
            )}
            <p className="text-xs text-slate-500 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl px-4 py-3">
              Isso criará uma conta de acesso ao sistema vinculada a este funcionário.
              Informe a senha inicial — o usuário poderá alterá-la depois.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FieldInput label="Nome *" value={formUsuario.nome ?? ''} onChange={v => setFormUsuario((p: any) => ({ ...p, nome: v }))} required />
              <FieldInput label="E-mail *" type="email" value={formUsuario.email ?? ''} onChange={v => setFormUsuario((p: any) => ({ ...p, email: v }))} required />
            </div>
            {/* Senha */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Senha Inicial *</label>
              <div className="relative">
                <input
                  type={mostrarSenhaUsuario ? 'text' : 'password'}
                  value={formUsuario.senha ?? ''}
                  onChange={e => setFormUsuario((p: any) => ({ ...p, senha: e.target.value }))}
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 pr-10"
                />
                <button type="button" onClick={() => setMostrarSenhaUsuario(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {mostrarSenhaUsuario ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FieldSelect label="Cargo / Permissão *" value={formUsuario.role ?? 'prof'} onChange={v => setFormUsuario((p: any) => ({ ...p, role: v }))}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </FieldSelect>
              <FieldSelect label="Grupo" value={formUsuario.grupo_id ?? ''} onChange={v => setFormUsuario((p: any) => ({ ...p, grupo_id: v }))}>
                <option value="">Sem grupo</option>
                {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </FieldSelect>
            </div>
            <button type="submit" disabled={salvandoUsuario}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-colors disabled:opacity-60">
              {salvandoUsuario ? 'Criando conta...' : 'Criar Conta de Usuário'}
            </button>
          </form>
        </Modal>
      )}

      {modal.aberto && (
        <Modal title={modal.editando ? 'Editar Funcionário' : 'Novo Funcionário'} onClose={fecharModal}>
          <form onSubmit={handleSalvar} className="space-y-5">
            {erro && <ErroBanner msg={erro} />}

            {/* ── Dados Pessoais ── */}
            <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/50 rounded-xl px-4 py-2.5">
              <div className="p-1.5 bg-purple-100 dark:bg-purple-800 rounded-lg flex-shrink-0">
                <User size={13} className="text-purple-600 dark:text-purple-300" />
              </div>
              <span className="text-[10px] font-black text-purple-700 dark:text-purple-300 uppercase tracking-widest">Dados Pessoais</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FieldInput label="Nome Completo *" value={form.nome ?? ''} onChange={v => setForm(p => ({ ...p, nome: v }))} required />
              </div>
              <FieldInput label="Cargo / Função" value={form.cargo ?? ''} onChange={v => setForm(p => ({ ...p, cargo: v }))} placeholder="Ex: Professor, Cozinha, Administrativo..." />
              <FieldInput label="CPF" value={form.cpf ?? ''} onChange={v => setForm(p => ({ ...p, cpf: v }))} placeholder="000.000.000-00" />
              <FieldInput label="E-mail" type="email" value={form.email ?? ''} onChange={v => setForm(p => ({ ...p, email: v }))} />
              <FieldInput label="Celular *" value={form.celular ?? ''} onChange={v => setForm(p => ({ ...p, celular: v }))} placeholder="(21) 99999-9999" />
              <FieldInput label="Data de Nascimento" type="date" value={form.data_nascimento ?? ''} onChange={v => setForm(p => ({ ...p, data_nascimento: v }))} />
              <FieldSelect label="Sexo" value={form.sexo ?? ''} onChange={v => setForm(p => ({ ...p, sexo: v }))}>
                <option value="">Selecione...</option>
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
                <option value="Não-binário">Não-binário</option>
                <option value="Prefiro não informar">Prefiro não informar</option>
              </FieldSelect>
              <FieldSelect label="Raça / Cor" value={form.raca_cor ?? ''} onChange={v => setForm(p => ({ ...p, raca_cor: v }))}>
                <option value="">Selecione...</option>
                <option value="Branca">Branca</option>
                <option value="Preta">Preta</option>
                <option value="Parda">Parda</option>
                <option value="Amarela">Amarela</option>
                <option value="Indígena">Indígena</option>
                <option value="Prefiro não informar">Prefiro não informar</option>
              </FieldSelect>
              <FieldSelect label="Escolaridade" value={form.escolaridade ?? ''} onChange={v => setForm(p => ({ ...p, escolaridade: v }))}>
                <option value="">Selecione...</option>
                <option value="Fundamental Incompleto">Fundamental Incompleto</option>
                <option value="Fundamental Completo">Fundamental Completo</option>
                <option value="Médio Incompleto">Médio Incompleto</option>
                <option value="Médio Completo">Médio Completo</option>
                <option value="Superior Incompleto">Superior Incompleto</option>
                <option value="Superior Completo">Superior Completo</option>
                <option value="Pós-graduação">Pós-graduação</option>
              </FieldSelect>
            </div>

            {/* ── Endereço ── */}
            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl px-4 py-2.5">
              <div className="p-1.5 bg-blue-100 dark:bg-blue-800 rounded-lg flex-shrink-0">
                <MapPin size={13} className="text-blue-600 dark:text-blue-300" />
              </div>
              <span className="text-[10px] font-black text-blue-700 dark:text-blue-300 uppercase tracking-widest">Endereço</span>
              {buscandoCep && <span className="ml-auto text-[9px] text-blue-500 animate-pulse">Buscando CEP...</span>}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">CEP</label>
                <input
                  type="text"
                  value={form.cep ?? ''}
                  onChange={e => setForm(p => ({ ...p, cep: e.target.value }))}
                  onBlur={e => buscarCep(e.target.value)}
                  placeholder="00000-000"
                  className="w-full border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 transition-shadow"
                />
              </div>
              <FieldInput label="Número" value={form.numero_residencia ?? ''} onChange={v => setForm(p => ({ ...p, numero_residencia: v }))} placeholder="Ex: 123" />
              <div className="sm:col-span-2">
                <FieldInput label="Logradouro" value={form.logradouro ?? ''} onChange={v => setForm(p => ({ ...p, logradouro: v }))} placeholder="Rua, Av., Travessa..." />
              </div>
              <FieldInput label="Complemento" value={form.complemento ?? ''} onChange={v => setForm(p => ({ ...p, complemento: v }))} placeholder="Apto, Bloco..." />
              <FieldInput label="Bairro" value={form.bairro ?? ''} onChange={v => setForm(p => ({ ...p, bairro: v }))} />
              <FieldInput label="Cidade" value={form.cidade ?? ''} onChange={v => setForm(p => ({ ...p, cidade: v }))} />
              <FieldInput label="Estado (UF)" value={form.estado ?? ''} onChange={v => setForm(p => ({ ...p, estado: v }))} placeholder="Ex: RJ" />
            </div>

            {/* ── Emergência ── */}
            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50 rounded-xl px-4 py-2.5">
              <div className="p-1.5 bg-amber-100 dark:bg-amber-800 rounded-lg flex-shrink-0">
                <Phone size={13} className="text-amber-600 dark:text-amber-300" />
              </div>
              <span className="text-[10px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-widest">Contato de Emergência</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FieldInput label="Telefone de Emergência 1 *" value={form.telefone_emergencia_1 ?? ''} onChange={v => setForm(p => ({ ...p, telefone_emergencia_1: v }))} placeholder="(21) 99999-9999" />
              <FieldInput label="Telefone de Emergência 2" value={form.telefone_emergencia_2 ?? ''} onChange={v => setForm(p => ({ ...p, telefone_emergencia_2: v }))} placeholder="(21) 99999-9999" />
            </div>

            {/* ── Saúde ── */}
            <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/50 rounded-xl px-4 py-2.5">
              <div className="p-1.5 bg-rose-100 dark:bg-rose-800 rounded-lg flex-shrink-0">
                <Activity size={13} className="text-rose-600 dark:text-rose-300" />
              </div>
              <span className="text-[10px] font-black text-rose-700 dark:text-rose-300 uppercase tracking-widest">Saúde</span>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 cursor-pointer hover:bg-purple-50/60 dark:hover:bg-purple-900/20 transition-colors">
                <input type="checkbox" checked={!!form.possui_deficiencia} onChange={e => setForm(p => ({ ...p, possui_deficiencia: e.target.checked, deficiencia_descricao: e.target.checked ? p.deficiencia_descricao : '' }))} className="w-4 h-4 accent-purple-600 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Possui algum tipo de deficiência?</span>
              </label>
              {form.possui_deficiencia && <FieldInput label="Qual(is) deficiência(s)?" value={form.deficiencia_descricao ?? ''} onChange={v => setForm(p => ({ ...p, deficiencia_descricao: v }))} placeholder="Descreva" />}

              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 cursor-pointer hover:bg-purple-50/60 dark:hover:bg-purple-900/20 transition-colors">
                <input type="checkbox" checked={!!form.possui_alergias} onChange={e => setForm(p => ({ ...p, possui_alergias: e.target.checked, alergias_descricao: e.target.checked ? p.alergias_descricao : '' }))} className="w-4 h-4 accent-purple-600 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Possui alergias?</span>
              </label>
              {form.possui_alergias && <FieldInput label="Qual(is) alergia(s)?" value={form.alergias_descricao ?? ''} onChange={v => setForm(p => ({ ...p, alergias_descricao: v }))} placeholder="Descreva" />}

              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 cursor-pointer hover:bg-purple-50/60 dark:hover:bg-purple-900/20 transition-colors">
                <input type="checkbox" checked={!!form.usa_medicamentos} onChange={e => setForm(p => ({ ...p, usa_medicamentos: e.target.checked, medicamentos_descricao: e.target.checked ? p.medicamentos_descricao : '' }))} className="w-4 h-4 accent-purple-600 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Faz uso contínuo de algum medicamento?</span>
              </label>
              {form.usa_medicamentos && <FieldInput label="Quais medicamentos? (Nome e dosagem)" value={form.medicamentos_descricao ?? ''} onChange={v => setForm(p => ({ ...p, medicamentos_descricao: v }))} placeholder="Ex: Metformina 500mg" />}

              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 cursor-pointer hover:bg-purple-50/60 dark:hover:bg-purple-900/20 transition-colors">
                <input type="checkbox" checked={!!form.possui_plano_saude} onChange={e => setForm(p => ({ ...p, possui_plano_saude: e.target.checked, plano_saude: e.target.checked ? p.plano_saude : '' }))} className="w-4 h-4 accent-purple-600 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Possui plano de saúde?</span>
              </label>
              {form.possui_plano_saude && <FieldInput label="Qual plano de saúde?" value={form.plano_saude ?? ''} onChange={v => setForm(p => ({ ...p, plano_saude: v }))} placeholder="Ex: Unimed, Bradesco Saúde..." />}

              <FieldInput label="Número do SUS (Cartão Nacional de Saúde)" value={form.numero_sus ?? ''} onChange={v => setForm(p => ({ ...p, numero_sus: v }))} placeholder="000 0000 0000 0000" />

              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 cursor-pointer hover:bg-purple-50/60 dark:hover:bg-purple-900/20 transition-colors">
                <input type="checkbox" checked={!!form.interesse_cursos} onChange={e => setForm(p => ({ ...p, interesse_cursos: e.target.checked }))} className="w-4 h-4 accent-purple-600 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Interesse em cursos do Instituto Tia Pretinha?</span>
              </label>
            </div>

            <div className="pt-1">
              <ToggleAtivo valor={form.ativo !== false} onChange={v => setForm(p => ({ ...p, ativo: v }))} />
            </div>
            <BtnSalvar salvando={salvando} editando={!!modal.editando} />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Tab: Usuários ────────────────────────────────────────────────────────────

function UsuariosTab({ onCount }: { onCount: (n: number) => void }) {
  const [lista, setLista]   = useState<UsuarioAdmin[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro]     = useState('');
  const [busca, setBusca]   = useState('');
  const [modal, setModal]   = useState<{ aberto: boolean; editando: UsuarioAdmin | null }>({ aberto: false, editando: null });
  const [form, setForm]     = useState<any>({ role: 'assist' });
  const [salvando, setSalvando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rU, rG] = await Promise.all([api.get('/admin/usuarios'), api.get('/grupos')]);
      setLista(rU.data); setGrupos(rG.data); onCount(rU.data.length);
    } catch { setErro('Erro ao carregar usuários.'); }
    setLoading(false);
  }, [onCount]);

  useEffect(() => { load(); }, [load]);

  const abrirCriar  = () => { setForm({ role: 'assist' }); setMostrarSenha(false); setModal({ aberto: true, editando: null }); };
  const abrirEditar = (u: UsuarioAdmin) => {
    setForm({ nome: u.nome, role: u.role, grupo_id: u.grupo?.id ?? '', matricula: u.matricula ?? '' });
    setModal({ aberto: true, editando: u });
  };
  const fecharModal = () => { setModal({ aberto: false, editando: null }); setForm({ role: 'assist' }); setErro(''); };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault(); setSalvando(true); setErro('');
    try {
      if (modal.editando) {
        await api.patch(`/admin/usuarios/${modal.editando.id}`, {
          nome: form.nome, role: form.role, grupo_id: form.grupo_id || null,
          matricula: form.matricula || null,
          ...(form.nova_senha ? { nova_senha: form.nova_senha } : {}),
        });
      } else {
        await api.post('/admin/usuarios', form);
      }
      fecharModal(); load();
    } catch (e: any) { setErro(e.response?.data?.message || 'Erro ao salvar.'); }
    setSalvando(false);
  };

  const handleDeletar = async (id: string) => {
    if (!confirm('Confirmar exclusão do usuário?')) return;
    try { await api.delete(`/admin/usuarios/${id}`); load(); }
    catch (e: any) { alert(e.response?.data?.message || 'Erro ao excluir.'); }
  };

  const roleLabel = (r: string) => ROLES.find(x => x.value === r)?.label ?? r;
  const filtrados = lista.filter(u =>
    (u.nome ?? '').toLowerCase().includes(busca.toLowerCase()) ||
    (u.email ?? '').toLowerCase().includes(busca.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      {erro && <Banner tipo="erro" msg={erro} onClose={() => setErro('')} />}

      <BarraAcao busca={busca} setBusca={setBusca} placeholder="Buscar por nome ou e-mail..." btnLabel="Novo Usuário" btnCor="blue" onClick={abrirCriar} />

      <Tabela loading={loading} vazio={filtrados.length === 0} msgVazio="Nenhum usuário encontrado.">
        <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-600">
          <tr className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
            <th className="text-left px-6 py-4">Usuário</th>
            <th className="text-left px-6 py-4">E-mail</th>
            <th className="text-left px-6 py-4">Matrícula</th>
            <th className="text-center px-6 py-4">Cargo</th>
            <th className="text-center px-6 py-4">Grupo</th>
            <th className="text-right px-6 py-4">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
          {filtrados.map(u => (
            <tr key={u.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <Avatar nome={u.nome ?? '?'} cor="blue" />
                  <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{u.nome || '–'}</span>
                </div>
              </td>
              <td className="px-6 py-4 text-xs text-slate-500">{u.email}</td>
              <td className="px-6 py-4">
                {u.matricula
                  ? <span className="font-mono text-[10px] bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-700 px-2 py-0.5 rounded-md">{u.matricula}</span>
                  : <span className="text-slate-300 dark:text-slate-600 text-xs">–</span>}
              </td>
              <td className="px-6 py-4 text-center">
                <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border ${u.role === 'admin' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-600'}`}>
                  {roleLabel(u.role)}
                </span>
              </td>
              <td className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase">{u.grupo?.nome || '–'}</td>
              <td className="px-6 py-4 text-right">
                <AcoesBotoes onEdit={() => abrirEditar(u)} onDelete={() => handleDeletar(u.id)} />
              </td>
            </tr>
          ))}
        </tbody>
      </Tabela>

      {modal.aberto && (
        <Modal title={modal.editando ? 'Editar Usuário' : 'Novo Usuário'} onClose={fecharModal}>
          <form onSubmit={handleSalvar} className="space-y-4">
            {erro && <ErroBanner msg={erro} />}

            {/* — Identificação — */}
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">Identificação</span>
            </div>
            <FieldInput label="Nome completo *" value={form.nome ?? ''} onChange={v => setForm((p: any) => ({ ...p, nome: v }))} required />

            {!modal.editando && (
              <>
                <FieldInput label="E-mail *" type="email" value={form.email ?? ''} onChange={v => setForm((p: any) => ({ ...p, email: v }))} required />
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Senha * <span className="normal-case font-normal text-slate-400">(mín. 8 caracteres)</span></label>
                  <div className="relative">
                    <input type={mostrarSenha ? 'text' : 'password'} value={form.password ?? ''}
                      onChange={e => setForm((p: any) => ({ ...p, password: e.target.value }))} required placeholder="Mínimo 8 caracteres"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 pr-10" />
                    <button type="button" onClick={() => setMostrarSenha(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {mostrarSenha ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* — Permissões — */}
            <div className="flex items-center gap-2 mt-2 mb-1">
              <span className="bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">Permissões</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FieldSelect label="Cargo *" value={form.role ?? 'assist'} onChange={v => setForm((p: any) => ({ ...p, role: v }))}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </FieldSelect>
              <FieldSelect label="Grupo / Perfil" value={form.grupo_id ?? ''} onChange={v => setForm((p: any) => ({ ...p, grupo_id: v }))}>
                <option value="">Sem grupo</option>
                {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </FieldSelect>
            </div>

            {/* — Matrícula — */}
            <div className="flex items-center gap-2 mt-2 mb-1">
              <span className="bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">Matrícula</span>
            </div>
            <div className="relative">
              <FieldInput
                label={`Matrícula${form.role === 'admin' ? ' ★ (obrigatória para Admin)' : ' (opcional — usada para login)'}`}
                value={form.matricula ?? ''}
                onChange={v => setForm((p: any) => ({ ...p, matricula: v.toUpperCase() }))}
                placeholder="Ex: ITP-FUNC-202601-001"
              />
              {form.matricula && (
                <span className="absolute right-3 top-8 font-mono text-[10px] bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-700 px-2 py-0.5 rounded-md">
                  {form.matricula}
                </span>
              )}
            </div>

            {/* — Alterar Senha (edição) — */}
            {modal.editando && (
              <>
                <div className="flex items-center gap-2 mt-2 mb-1">
                  <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">Segurança</span>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Nova Senha <span className="text-slate-400 normal-case font-normal">(deixe vazio para manter a atual)</span>
                  </label>
                  <div className="relative">
                    <input type={mostrarSenha ? 'text' : 'password'} value={form.nova_senha ?? ''}
                      onChange={e => setForm((p: any) => ({ ...p, nova_senha: e.target.value }))}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 pr-10" />
                    <button type="button" onClick={() => setMostrarSenha(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {mostrarSenha ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-xl p-2.5 mt-1">
              <p className="text-[9px] text-blue-700 dark:text-blue-300">
                💡 <strong>Contas separadas:</strong> Para admin e professor, crie dois usuários com e-mails diferentes. A matrícula pode ser usada como identificador de login no lugar do e-mail.
              </p>
            </div>
            <BtnSalvar salvando={salvando} editando={!!modal.editando} label={modal.editando ? 'Salvar Alterações' : 'Criar Usuário'} />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Tab: Grupos ──────────────────────────────────────────────────────────────

function GruposTab({ onCount }: { onCount: (n: number) => void }) {
  const [lista, setLista]   = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro]     = useState('');
  const [busca, setBusca]   = useState('');
  const [modal, setModal]   = useState<{ aberto: boolean; editando: Grupo | null }>({ aberto: false, editando: null });
  const [nomeForm, setNomeForm] = useState('');
  const [modulosVisiveis, setModulosVisiveis] = useState<Record<string, boolean>>({});
  const [salvando, setSalvando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/grupos');
      setLista(r.data); onCount(r.data.length);
    } catch { setErro('Erro ao carregar grupos.'); }
    setLoading(false);
  }, [onCount]);

  useEffect(() => { load(); }, [load]);

  const GRUPOS_FULL_ACCESS = ['ADMIN', 'PRT', 'VP', 'DRT'];
  const todosModulosAtivos = () => Object.fromEntries(MODULOS_SISTEMA.map(m => [m.key, true]));

  const extrairModulosVisiveis = (gp: any): Record<string, boolean> => {
    if (!gp) return {};
    if (gp.modulos_visiveis) return gp.modulos_visiveis;
    // Compatibilidade com formato antigo { "cadastro_basico": true, ... }
    const result: Record<string, boolean> = {};
    for (const k of Object.keys(gp)) {
      if (k !== 'permissoes' && k !== 'modulos_visiveis' && typeof gp[k] === 'boolean') result[k] = gp[k];
    }
    return result;
  };

  const abrirCriar  = () => { setNomeForm(''); setModulosVisiveis({}); setModal({ aberto: true, editando: null }); };
  const abrirEditar = (g: Grupo) => {
    setNomeForm(g.nome);
    const mv = extrairModulosVisiveis(g.grupo_permissoes);
    const mvFinal = GRUPOS_FULL_ACCESS.includes(g.nome.toUpperCase())
      ? { ...todosModulosAtivos(), ...mv }
      : mv;
    setModulosVisiveis(mvFinal);
    setModal({ aberto: true, editando: g });
  };
  const fecharModal = () => { setModal({ aberto: false, editando: null }); setNomeForm(''); setModulosVisiveis({}); setErro(''); };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault(); setSalvando(true); setErro('');
    try {
      // Preserva permissões CRUD existentes ao salvar
      const permissoesExistentes = modal.editando?.grupo_permissoes?.permissoes || {};
      const payload = {
        nome: nomeForm,
        grupo_permissoes: {
          modulos_visiveis: modulosVisiveis,
          permissoes: permissoesExistentes,
        },
      };
      if (modal.editando) {
        await api.patch(`/grupos/${modal.editando.id}`, payload);
      } else {
        await api.post('/grupos', { nome: nomeForm, permissoes: { modulos_visiveis: modulosVisiveis, permissoes: {} } });
      }
      fecharModal(); load();
    } catch (e: any) { setErro(e.response?.data?.message || 'Erro ao salvar grupo.'); }
    setSalvando(false);
  };

  const handleDeletar = async (id: string) => {
    if (!confirm('Confirmar exclusão do grupo?')) return;
    try { await api.delete(`/grupos/${id}`); load(); }
    catch (e: any) { alert(e.response?.data?.message || 'Erro ao excluir grupo.'); }
  };

  const filtrados = lista.filter(g => g.nome.toLowerCase().includes(busca.toLowerCase()));

  // Extrai nomes legíveis dos módulos visíveis de um grupo para a tabela
  const modulosLabelDoGrupo = (nome: string, gp: any): { key: string; ativo: boolean }[] => {
    // Grupos com acesso total sempre mostram todos os módulos
    if (GRUPOS_FULL_ACCESS.includes(nome.toUpperCase())) {
      return MODULOS_SISTEMA.map(m => ({ key: m.label, ativo: true }));
    }
    const mv = extrairModulosVisiveis(gp);
    return MODULOS_SISTEMA.filter(m => mv[m.key]).map(m => ({ key: m.label, ativo: true }));
  };

  return (
    <div className="space-y-4">
      {erro && <Banner tipo="erro" msg={erro} onClose={() => setErro('')} />}

      <BarraAcao busca={busca} setBusca={setBusca} placeholder="Buscar grupo..." btnLabel="Novo Grupo" btnCor="emerald" onClick={abrirCriar} />

      <Tabela loading={loading} vazio={filtrados.length === 0} msgVazio="Nenhum grupo encontrado.">
        <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-600">
          <tr className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
            <th className="text-left px-6 py-4">Grupo / Perfil</th>
            <th className="text-center px-6 py-4">Usuários</th>
            <th className="text-left px-6 py-4">Módulos Liberados</th>
            <th className="text-right px-6 py-4">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
          {filtrados.map(g => {
            const modulos = modulosLabelDoGrupo(g.nome, g.grupo_permissoes);
            return (
              <tr key={g.id} className="hover:bg-emerald-50/30 dark:hover:bg-emerald-900/20 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar nome={g.nome} cor="emerald" />
                    <span className="font-bold text-slate-800 dark:text-slate-100 text-sm uppercase">{g.nome}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-lg text-[10px] font-black">
                    {g.usuarios?.length ?? 0}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {modulos.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {modulos.slice(0, 4).map(m => (
                        <span key={m.key} className="px-2 py-0.5 rounded text-[8px] font-black uppercase border bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">{m.key}</span>
                      ))}
                      {modulos.length > 4 && (
                        <span className="text-[9px] text-slate-400 font-bold self-center">+{modulos.length - 4}</span>
                      )}
                    </div>
                  ) : <span className="text-[10px] text-slate-400">Nenhum módulo</span>}
                </td>
                <td className="px-6 py-4 text-right">
                  <AcoesBotoes onEdit={() => abrirEditar(g)} onDelete={() => handleDeletar(g.id)} cor="emerald" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </Tabela>

      {modal.aberto && (
        <Modal title={modal.editando ? 'Editar Grupo' : 'Novo Grupo'} onClose={fecharModal}>
          <form onSubmit={handleSalvar} className="space-y-4">
            {erro && <ErroBanner msg={erro} />}
            <FieldInput label="Nome do Grupo *" value={nomeForm} onChange={setNomeForm} required />

            {/* Módulos Visíveis */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-xl px-4 py-2.5">
                <ShieldCheck size={13} className="text-emerald-600 dark:text-emerald-300" />
                <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-widest">Módulos Visíveis no Menu</span>
              </div>
              <p className="text-[9px] text-slate-500 font-semibold px-1">
                Define quais módulos os usuários deste grupo poderão visualizar no menu lateral.
                Permissões de edição, inclusão e exclusão são configuradas em <strong>Configurações → Gestão de Acesso</strong>.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => setModulosVisiveis(todosModulosAtivos())}
                  className="text-[9px] font-black uppercase tracking-wider text-emerald-600 hover:underline">Marcar Todos</button>
                <span className="text-slate-300">|</span>
                <button type="button" onClick={() => setModulosVisiveis({})}
                  className="text-[9px] font-black uppercase tracking-wider text-slate-400 hover:underline">Limpar</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {MODULOS_SISTEMA.map(m => (
                  <label key={m.key} className={`flex items-center gap-2 cursor-pointer py-2.5 px-3 rounded-xl border transition-colors ${
                    modulosVisiveis[m.key]
                      ? 'border-emerald-300 bg-emerald-50/80 dark:border-emerald-700 dark:bg-emerald-900/30'
                      : 'border-slate-100 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}>
                    <input
                      type="checkbox"
                      checked={!!modulosVisiveis[m.key]}
                      onChange={e => setModulosVisiveis(p => ({ ...p, [m.key]: e.target.checked }))}
                      className="w-4 h-4 accent-emerald-600"
                    />
                    <span className={`text-xs font-bold ${modulosVisiveis[m.key] ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'}`}>{m.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <BtnSalvar salvando={salvando} editando={!!modal.editando} cor="emerald" />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Tab: Cursos ──────────────────────────────────────────────────────────────

function CursosTab({ onCount }: { onCount: (n: number) => void }) {
  const [lista, setLista]   = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro]     = useState('');
  const [busca, setBusca]   = useState('');
  const [modal, setModal]   = useState<{ aberto: boolean; editando: Curso | null }>({ aberto: false, editando: null });
  const [form, setForm]     = useState<Partial<Curso>>({ status: 'Ativo' });
  const [salvando, setSalvando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/academico/cursos');
      setLista(r.data); onCount(r.data.length);
    } catch { setErro('Erro ao carregar cursos.'); }
    setLoading(false);
  }, [onCount]);

  useEffect(() => { load(); }, [load]);

  const abrirCriar  = () => { setForm({ status: 'Ativo' }); setModal({ aberto: true, editando: null }); };
  const abrirEditar = (c: Curso) => {
    setForm({ nome: c.nome, sigla: c.sigla, status: c.status, periodo: c.periodo, descricao: c.descricao });
    setModal({ aberto: true, editando: c });
  };
  const fecharModal = () => { setModal({ aberto: false, editando: null }); setForm({ status: 'Ativo' }); setErro(''); };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault(); setSalvando(true); setErro('');
    try {
      if (modal.editando) await api.patch(`/academico/cursos/${modal.editando.id}`, form);
      else await api.post('/academico/cursos', form);
      fecharModal(); load();
    } catch (e: any) { setErro(e.response?.data?.message || 'Erro ao salvar.'); }
    setSalvando(false);
  };

  const handleDeletar = async (id: string) => {
    if (!confirm('Confirmar exclusão do curso?')) return;
    try { await api.delete(`/academico/cursos/${id}`); load(); }
    catch (e: any) { alert(e.response?.data?.message || 'Erro ao excluir curso.'); }
  };

  const filtrados = lista.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.sigla.toLowerCase().includes(busca.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      {erro && <Banner tipo="erro" msg={erro} onClose={() => setErro('')} />}

      <BarraAcao busca={busca} setBusca={setBusca} placeholder="Buscar curso ou sigla..." btnLabel="Novo Curso" btnCor="amber" onClick={abrirCriar} />

      <Tabela loading={loading} vazio={filtrados.length === 0} msgVazio="Nenhum curso encontrado.">
        <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-600">
          <tr className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
            <th className="text-left px-6 py-4">Cód. Interno</th>
            <th className="text-left px-6 py-4">Sigla</th>
            <th className="text-left px-6 py-4">Nome do Curso</th>
            <th className="text-center px-6 py-4">Período</th>
            <th className="text-center px-6 py-4">Status</th>
            <th className="text-right px-6 py-4">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
          {filtrados.map(c => (
            <tr key={c.id} className="hover:bg-amber-50/30 dark:hover:bg-amber-900/20 transition-colors">
              <td className="px-6 py-4">
                {c.codigo ? (
                  <span className="font-mono text-[10px] font-bold bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-lg border border-amber-100 dark:border-amber-800">
                    {c.codigo}
                  </span>
                ) : <span className="text-slate-300 text-xs">–</span>}
              </td>
              <td className="px-6 py-4">
                <span className="font-mono font-black text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 px-2 py-1 rounded-lg text-xs">{c.sigla}</span>
              </td>
              <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100 text-sm">{c.nome}</td>
              <td className="px-6 py-4 text-center text-xs text-slate-500">{c.periodo || '–'}</td>
              <td className="px-6 py-4 text-center">
                <StatusBadge ativo={c.status === 'Ativo'} labelAtivo="Ativo" labelInativo={c.status || 'Inativo'} />
              </td>
              <td className="px-6 py-4 text-right">
                <AcoesBotoes onEdit={() => abrirEditar(c)} onDelete={() => handleDeletar(c.id)} cor="amber" />
              </td>
            </tr>
          ))}
        </tbody>
      </Tabela>

      {modal.aberto && (
        <Modal title={modal.editando ? 'Editar Curso' : 'Novo Curso'} onClose={fecharModal}>
          <form onSubmit={handleSalvar} className="space-y-3">
            {erro && <ErroBanner msg={erro} />}
            <FieldInput label="Nome do Curso *" value={form.nome ?? ''} onChange={v => setForm(p => ({ ...p, nome: v }))} required />
            <FieldInput label="Sigla *" value={form.sigla ?? ''} onChange={v => setForm(p => ({ ...p, sigla: v.toUpperCase() }))} required placeholder="Ex: COZINHA, DANÇA, INFO..." />
            <FieldInput label="Período" value={form.periodo ?? ''} onChange={v => setForm(p => ({ ...p, periodo: v }))} placeholder="Ex: Manhã, Tarde, Noite..." />
            <FieldSelect label="Status" value={form.status ?? 'Ativo'} onChange={v => setForm(p => ({ ...p, status: v }))}>
              <option value="Ativo">Ativo</option>
              <option value="Suspenso">Suspenso</option>
              <option value="Encerrado">Encerrado</option>
            </FieldSelect>
            <BtnSalvar salvando={salvando} editando={!!modal.editando} cor="amber" />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Tab: Alunos ──────────────────────────────────────────────────────────────

function AlunosTab({ onCount }: { onCount: (n: number) => void }) {
  const [lista, setLista]   = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro]     = useState('');
  const [busca, setBusca]   = useState('');
  const [modal, setModal]   = useState<{ aberto: boolean; editando: Aluno | null }>({ aberto: false, editando: null });
  const [form, setForm]     = useState<Partial<Aluno>>({});
  const [salvando, setSalvando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/academico/alunos');
      setLista(r.data); onCount(r.data.length);
    } catch { setErro('Erro ao carregar alunos.'); }
    setLoading(false);
  }, [onCount]);

  useEffect(() => { load(); }, [load]);

  const abrirCriar  = () => { setForm({}); setModal({ aberto: true, editando: null }); };
  const abrirEditar = (a: Aluno) => {
    setForm({
      nome_completo: a.nome_completo, cpf: a.cpf, celular: a.celular,
      data_nascimento: a.data_nascimento, cursos_matriculados: a.cursos_matriculados, cidade: a.cidade,
    });
    setModal({ aberto: true, editando: a });
  };
  const fecharModal = () => { setModal({ aberto: false, editando: null }); setForm({}); setErro(''); };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault(); setSalvando(true); setErro('');
    try {
      if (modal.editando) await api.patch(`/academico/alunos/${modal.editando.id}`, form);
      else await api.post('/academico/alunos', form);
      fecharModal(); load();
    } catch (e: any) { setErro(e.response?.data?.message || 'Erro ao salvar.'); }
    setSalvando(false);
  };

  const handleDeletar = async (id: string) => {
    if (!confirm('Desativar aluno?')) return;
    try { await api.delete(`/academico/alunos/${id}`); load(); }
    catch (e: any) { alert(e.response?.data?.message || 'Erro ao desativar.'); }
  };

  const filtrados = lista.filter(a =>
    a.nome_completo.toLowerCase().includes(busca.toLowerCase()) ||
    (a.cpf ?? '').includes(busca.replace(/\D/g, '')) ||
    (a.numero_matricula ?? '').toLowerCase().includes(busca.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      {erro && <Banner tipo="erro" msg={erro} onClose={() => setErro('')} />}

      <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-100 dark:border-cyan-800/30 rounded-2xl p-3 flex items-start gap-2">
        <AlertCircle size={14} className="text-cyan-500 mt-0.5 flex-shrink-0" />
        <p className="text-[10px] text-cyan-700 dark:text-cyan-300 font-bold">
          Cadastro rápido de alunos com <strong>origem Manual</strong>. O nº de matrícula (ITP-YYYY-MMDDX) é gerado automaticamente.
        </p>
      </div>

      <BarraAcao busca={busca} setBusca={setBusca} placeholder="Buscar por nome, CPF ou matrícula..." btnLabel="Cadastrar Aluno" btnCor="cyan" onClick={abrirCriar} />

      <Tabela loading={loading} vazio={filtrados.length === 0} msgVazio="Nenhum aluno encontrado.">
        <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-600">
          <tr className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
            <th className="text-left px-6 py-4">Matrícula</th>
            <th className="text-left px-6 py-4">Nome</th>
            <th className="text-left px-6 py-4">CPF / Celular</th>
            <th className="text-left px-6 py-4">Cursos</th>
            <th className="text-center px-6 py-4">Status</th>
            <th className="text-right px-6 py-4">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
          {filtrados.map(a => (
            <tr key={a.id} className="hover:bg-cyan-50/30 dark:hover:bg-cyan-900/20 transition-colors">
              <td className="px-6 py-4">
                <span className="font-mono text-[10px] font-black text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-900/30 px-2 py-1 rounded-lg">{a.numero_matricula}</span>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <Avatar nome={a.nome_completo} cor="cyan" />
                  <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{a.nome_completo}</span>
                </div>
              </td>
              <td className="px-6 py-4 text-xs text-slate-500">
                <div>{a.cpf ? formatarCPF(a.cpf) : '–'}</div>
                <div className="text-slate-400">{a.celular || ''}</div>
              </td>
              <td className="px-6 py-4 text-xs text-slate-500 max-w-[200px] truncate">{a.cursos_matriculados || '–'}</td>
              <td className="px-6 py-4 text-center">
                <StatusBadge ativo={a.ativo !== false} />
              </td>
              <td className="px-6 py-4 text-right">
                <AcoesBotoes onEdit={() => abrirEditar(a)} onDelete={() => handleDeletar(a.id)} cor="cyan" />
              </td>
            </tr>
          ))}
        </tbody>
      </Tabela>

      {modal.aberto && (
        <Modal title={modal.editando ? 'Editar Aluno' : 'Cadastrar Aluno'} onClose={fecharModal}>
          <form onSubmit={handleSalvar} className="space-y-3">
            {erro && <ErroBanner msg={erro} />}
            <FieldInput label="Nome Completo *" value={form.nome_completo ?? ''} onChange={v => setForm(p => ({ ...p, nome_completo: v }))} required />
            <FieldInput label="CPF" value={form.cpf ?? ''} onChange={v => setForm(p => ({ ...p, cpf: v }))} placeholder="000.000.000-00" />
            <FieldInput label="Celular" value={form.celular ?? ''} onChange={v => setForm(p => ({ ...p, celular: v }))} placeholder="(11) 99999-9999" />
            <FieldInput label="Data de Nascimento" type="date" value={form.data_nascimento ?? ''} onChange={v => setForm(p => ({ ...p, data_nascimento: v }))} />
            <FieldInput label="Cidade" value={form.cidade ?? ''} onChange={v => setForm(p => ({ ...p, cidade: v }))} />
            <FieldInput label="Cursos (separados por vírgula)" value={form.cursos_matriculados ?? ''} onChange={v => setForm(p => ({ ...p, cursos_matriculados: v }))} placeholder="Ex: Dança, Informática" />
            <BtnSalvar salvando={salvando} editando={!!modal.editando} cor="cyan" label={modal.editando ? 'Salvar' : 'Cadastrar Aluno'} />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Tab: Insumos (Categorias de Estoque) ────────────────────────────────────

type CategoriaEstoque = { id: string; nome: string; codigo?: string | null; createdAt: string };

function InsumosTab({ onCount }: { onCount: (n: number) => void }) {
  const [lista, setLista]     = useState<CategoriaEstoque[]>([]);
  const [produtos, setProdutos] = useState<{ id: string; categoria: string; ativo: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro]       = useState('');
  const [busca, setBusca]     = useState('');
  const [modal, setModal]     = useState<{ aberto: boolean; editando: CategoriaEstoque | null }>({ aberto: false, editando: null });
  const [formNome, setFormNome] = useState('');
  const [formCodigo, setFormCodigo] = useState('');
  const [salvando, setSalvando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErro('');
    try {
      const [rC, rP] = await Promise.allSettled([
        api.get('/estoque/categorias'),
        api.get('/estoque/produtos'),
      ]);
      const cats: CategoriaEstoque[] = rC.status === 'fulfilled' ? rC.value.data : [];
      const prods = rP.status === 'fulfilled' ? rP.value.data : [];
      setLista(cats);
      setProdutos(prods);
      onCount(cats.length);
    } catch { setErro('Erro ao carregar categorias.'); }
    setLoading(false);
  }, [onCount]);

  useEffect(() => { load(); }, [load]);

  const abrirCriar  = () => { setFormNome(''); setFormCodigo(''); setErro(''); setModal({ aberto: true, editando: null }); };
  const abrirEditar = (c: CategoriaEstoque) => { setFormNome(c.nome); setFormCodigo(c.codigo ?? ''); setErro(''); setModal({ aberto: true, editando: c }); };
  const fecharModal = () => { setModal({ aberto: false, editando: null }); setFormNome(''); setFormCodigo(''); setErro(''); };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault(); setSalvando(true); setErro('');
    try {
      if (modal.editando) await api.patch(`/estoque/categorias/${modal.editando.id}`, { nome: formNome, codigo: formCodigo || undefined });
      else await api.post('/estoque/categorias', { nome: formNome, codigo: formCodigo || undefined });
      fecharModal(); load();
    } catch (e: any) { setErro(e.response?.data?.message || 'Erro ao salvar.'); }
    setSalvando(false);
  };

  const handleDeletar = async (c: CategoriaEstoque) => {
    const total = produtos.filter(p => p.ativo && p.categoria === c.nome).length;
    if (total > 0) {
      alert(`A categoria "${c.nome}" possui ${total} produto${total > 1 ? 's' : ''} ativo${total > 1 ? 's' : ''} vinculado${total > 1 ? 's' : ''} no estoque e não pode ser excluída.`);
      return;
    }
    if (!confirm(`Excluir categoria "${c.nome}"?`)) return;
    try { await api.delete(`/estoque/categorias/${c.id}`); load(); }
    catch (e: any) { alert(e.response?.data?.message || 'Erro ao excluir.'); }
  };

  const filtrados = lista.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()),
  );

  const totalProdutos = (nome: string) =>
    produtos.filter(p => p.ativo && p.categoria === nome).length;

  return (
    <div className="space-y-4">
      {erro && <Banner tipo="erro" msg={erro} onClose={() => setErro('')} />}

      {/* Info — contexto */}
      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700/40 rounded-2xl px-5 py-3 flex items-start gap-3">
        <Package size={16} className="text-orange-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-black text-orange-700 dark:text-orange-300 uppercase tracking-wide">Categorias de Insumos — Estoque</p>
          <p className="text-[11px] text-orange-600 dark:text-orange-400 mt-0.5">
            Estas categorias são usadas no módulo Estoque para classificar os produtos. Cada categoria criada aqui fica disponível automaticamente no cadastro e visão geral de estoque.
          </p>
        </div>
      </div>

      <BarraAcao busca={busca} setBusca={setBusca} placeholder="Buscar categoria..." btnLabel="Nova Categoria" btnCor="orange" onClick={abrirCriar} />

      <Tabela loading={loading} vazio={filtrados.length === 0} msgVazio="Nenhuma categoria cadastrada.">
        <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-600">
          <tr className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
            <th className="text-left px-6 py-4">Nome da Categoria</th>
            <th className="text-left px-6 py-4">Código</th>
            <th className="text-center px-6 py-4">Produtos Vinculados</th>
            <th className="text-left px-6 py-4">Cadastrado em</th>
            <th className="text-right px-6 py-4">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
          {filtrados.map(c => {
            const total = totalProdutos(c.nome);
            const data = new Date(c.createdAt);
            const dataFmt = isNaN(data.getTime()) ? '—' : data.toLocaleDateString('pt-BR');
            return (
              <tr key={c.id} className="hover:bg-orange-50/30 dark:hover:bg-orange-900/20 transition-colors">
                <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100 text-sm">{c.nome}</td>
                <td className="px-6 py-4">
                  {c.codigo
                    ? <span className="font-mono text-[11px] bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/40 px-2 py-0.5 rounded">{c.codigo}</span>
                    : <span className="text-slate-300 text-xs">—</span>}
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${
                    total > 0
                      ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-100 dark:border-green-800/40'
                      : 'bg-slate-50 dark:bg-slate-700 text-slate-400 border-slate-100 dark:border-slate-600'
                  }`}>
                    {total} produto{total !== 1 ? 's' : ''}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-slate-400 font-mono">{dataFmt}</td>
                <td className="px-6 py-4 text-right">
                  <AcoesBotoes onEdit={() => abrirEditar(c)} onDelete={() => handleDeletar(c)} cor="orange" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </Tabela>

      {modal.aberto && (
        <Modal title={modal.editando ? 'Editar Categoria' : 'Nova Categoria de Insumo'} onClose={fecharModal}>
          <form onSubmit={handleSalvar} className="space-y-3">
            {erro && <ErroBanner msg={erro} />}
            <FieldInput
              label="Nome da Categoria *"
              value={formNome}
              onChange={setFormNome}
              required
              placeholder="Ex: Insumos - Cozinha"
            />
            <FieldInput
              label="Código (opcional)"
              value={formCodigo}
              onChange={v => setFormCodigo(v.toUpperCase())}
              placeholder="Ex: ALIM, HGNE, COZINHA"
            />
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              O nome será exibido no seletor de categoria ao cadastrar produtos no módulo Estoque. O código é um identificador curto definido por você.
            </p>
            <BtnSalvar salvando={salvando} editando={!!modal.editando} cor="orange" />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Tab: Doadores ────────────────────────────────────────────────────────────

function DoadoresTab({ onCount }: { onCount: (n: number) => void }) {
  const [lista, setLista]   = useState<Doador[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro]     = useState('');
  const [busca, setBusca]   = useState('');
  const [modal, setModal]   = useState<{ aberto: boolean; editando: Doador | null }>({ aberto: false, editando: null });
  const [form, setForm]     = useState<Partial<Doador>>({ tipo: 'PF', ativo: true });
  const [salvando, setSalvando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/cadastro/doadores');
      setLista(r.data); onCount(r.data.length);
    } catch { setErro('Erro ao carregar doadores.'); }
    setLoading(false);
  }, [onCount]);

  useEffect(() => { load(); }, [load]);

  const abrirCriar  = () => { setForm({ tipo: 'PF', ativo: true }); setModal({ aberto: true, editando: null }); };
  const abrirEditar = (d: Doador) => {
    setForm({ nome: d.nome, tipo: d.tipo, cpf_cnpj: d.cpf_cnpj, email: d.email, telefone: d.telefone, cidade: d.cidade, ativo: d.ativo });
    setModal({ aberto: true, editando: d });
  };
  const fecharModal = () => { setModal({ aberto: false, editando: null }); setForm({ tipo: 'PF', ativo: true }); setErro(''); };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault(); setSalvando(true); setErro('');
    try {
      if (modal.editando) await api.patch(`/cadastro/doadores/${modal.editando.id}`, form);
      else await api.post('/cadastro/doadores', form);
      fecharModal(); load();
    } catch (e: any) { setErro(e.response?.data?.message || 'Erro ao salvar.'); }
    setSalvando(false);
  };

  const handleDeletar = async (id: string) => {
    if (!confirm('Confirmar exclusão do doador?')) return;
    try { await api.delete(`/cadastro/doadores/${id}`); load(); }
    catch (e: any) { alert(e.response?.data?.message || 'Erro ao excluir.'); }
  };

  const filtrados = lista.filter(d =>
    d.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (d.email ?? '').toLowerCase().includes(busca.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      {erro && <Banner tipo="erro" msg={erro} onClose={() => setErro('')} />}

      <BarraAcao busca={busca} setBusca={setBusca} placeholder="Buscar doador..." btnLabel="Novo Doador" btnCor="rose" onClick={abrirCriar} />

      <Tabela loading={loading} vazio={filtrados.length === 0} msgVazio="Nenhum doador encontrado.">
        <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-600">
          <tr className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
            <th className="text-left px-6 py-4">Nome</th>
            <th className="text-left px-6 py-4">Cód. Interno</th>
            <th className="text-center px-6 py-4">Tipo</th>
            <th className="text-left px-6 py-4">CPF / CNPJ</th>
            <th className="text-left px-6 py-4">Contato</th>
            <th className="text-center px-6 py-4">Status</th>
            <th className="text-right px-6 py-4">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
          {filtrados.map(d => (
            <tr key={d.id} className="hover:bg-rose-50/30 dark:hover:bg-rose-900/20 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <Avatar nome={d.nome} cor="rose" />
                  <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{d.nome}</span>
                </div>
              </td>
              <td className="px-6 py-4">
                {d.codigo_interno
                  ? <span className="font-mono text-[11px] bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/40 px-2 py-0.5 rounded">{d.codigo_interno}</span>
                  : <span className="text-slate-300 text-xs">—</span>}
              </td>
              <td className="px-6 py-4 text-center">
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${d.tipo === 'PJ' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-violet-50 text-violet-600 border-violet-100'}`}>
                  {d.tipo || 'PF'}
                </span>
              </td>
              <td className="px-6 py-4 text-xs text-slate-500">{d.cpf_cnpj || '–'}</td>
              <td className="px-6 py-4 text-xs text-slate-500">
                <div>{d.email || '–'}</div>
                <div className="text-slate-400">{d.telefone || ''}</div>
              </td>
              <td className="px-6 py-4 text-center">
                <StatusBadge ativo={d.ativo !== false} />
              </td>
              <td className="px-6 py-4 text-right">
                <AcoesBotoes onEdit={() => abrirEditar(d)} onDelete={() => handleDeletar(d.id)} cor="rose" />
              </td>
            </tr>
          ))}
        </tbody>
      </Tabela>

      {modal.aberto && (
        <Modal title={modal.editando ? 'Editar Doador' : 'Novo Doador'} onClose={fecharModal}>
          <form onSubmit={handleSalvar} className="space-y-3">
            {erro && <ErroBanner msg={erro} />}
            <FieldInput label="Nome *" value={form.nome ?? ''} onChange={v => setForm(p => ({ ...p, nome: v }))} required />
            <FieldSelect label="Tipo" value={form.tipo ?? 'PF'} onChange={v => setForm(p => ({ ...p, tipo: v }))}>
              <option value="PF">Pessoa Física</option>
              <option value="PJ">Pessoa Jurídica</option>
            </FieldSelect>
            <FieldInput label="CPF / CNPJ" value={form.cpf_cnpj ?? ''} onChange={v => setForm(p => ({ ...p, cpf_cnpj: v }))} />
            <FieldInput label="E-mail" type="email" value={form.email ?? ''} onChange={v => setForm(p => ({ ...p, email: v }))} />
            <FieldInput label="Telefone" value={form.telefone ?? ''} onChange={v => setForm(p => ({ ...p, telefone: v }))} />
            <FieldInput label="Cidade" value={form.cidade ?? ''} onChange={v => setForm(p => ({ ...p, cidade: v }))} />
            <ToggleAtivo valor={form.ativo !== false} onChange={v => setForm(p => ({ ...p, ativo: v }))} />
            <BtnSalvar salvando={salvando} editando={!!modal.editando} cor="rose" />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Tab: Contas Bancárias ────────────────────────────────────────────────────

function ContasTab({ onCount }: { onCount: (n: number) => void }) {
  const [lista, setLista]   = useState<ContaBancaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro]     = useState('');
  const [busca, setBusca]   = useState('');
  const [modal, setModal]   = useState<{ aberto: boolean; editando: ContaBancaria | null }>({ aberto: false, editando: null });
  const [form, setForm]     = useState<Partial<ContaBancaria>>({ tipo: 'Corrente', ativo: true });
  const [salvando, setSalvando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/cadastro/contas-bancarias');
      setLista(r.data); onCount(r.data.length);
    } catch { setErro('Erro ao carregar contas bancárias.'); }
    setLoading(false);
  }, [onCount]);

  useEffect(() => { load(); }, [load]);

  const abrirCriar  = () => { setForm({ tipo: 'Corrente', ativo: true }); setModal({ aberto: true, editando: null }); };
  const abrirEditar = (c: ContaBancaria) => {
    setForm({ banco: c.banco, agencia: c.agencia, conta: c.conta, tipo: c.tipo, titular: c.titular, pix: c.pix, ativo: c.ativo });
    setModal({ aberto: true, editando: c });
  };
  const fecharModal = () => { setModal({ aberto: false, editando: null }); setForm({ tipo: 'Corrente', ativo: true }); setErro(''); };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault(); setSalvando(true); setErro('');
    try {
      if (modal.editando) await api.patch(`/cadastro/contas-bancarias/${modal.editando.id}`, form);
      else await api.post('/cadastro/contas-bancarias', form);
      fecharModal(); load();
    } catch (e: any) { setErro(e.response?.data?.message || 'Erro ao salvar.'); }
    setSalvando(false);
  };

  const handleDeletar = async (id: string) => {
    if (!confirm('Confirmar exclusão da conta bancária?')) return;
    try { await api.delete(`/cadastro/contas-bancarias/${id}`); load(); }
    catch (e: any) { alert(e.response?.data?.message || 'Erro ao excluir.'); }
  };

  const filtrados = lista.filter(c =>
    c.banco.toLowerCase().includes(busca.toLowerCase()) ||
    c.titular.toLowerCase().includes(busca.toLowerCase()) ||
    (c.pix ?? '').toLowerCase().includes(busca.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      {erro && <Banner tipo="erro" msg={erro} onClose={() => setErro('')} />}

      <BarraAcao busca={busca} setBusca={setBusca} placeholder="Buscar banco, titular ou PIX..." btnLabel="Nova Conta" btnCor="indigo" onClick={abrirCriar} />

      <Tabela loading={loading} vazio={filtrados.length === 0} msgVazio="Nenhuma conta bancária encontrada.">
        <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-600">
          <tr className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
            <th className="text-left px-6 py-4">Banco</th>
            <th className="text-left px-6 py-4">Cód. Interno</th>
            <th className="text-left px-6 py-4">Titular</th>
            <th className="text-left px-6 py-4">Agência / Conta</th>
            <th className="text-center px-6 py-4">Tipo</th>
            <th className="text-left px-6 py-4">PIX</th>
            <th className="text-center px-6 py-4">Status</th>
            <th className="text-right px-6 py-4">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
          {filtrados.map(c => (
            <tr key={c.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20 transition-colors">
              <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100 text-sm">{c.banco}</td>
              <td className="px-6 py-4">
                {c.codigo_interno
                  ? <span className="font-mono text-[11px] bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/40 px-2 py-0.5 rounded">{c.codigo_interno}</span>
                  : <span className="text-slate-300 text-xs">—</span>}
              </td>
              <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">{c.titular}</td>
              <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                <div>{c.agencia ? `Ag: ${c.agencia}` : '–'}</div>
                <div>{c.conta ? `CC: ${c.conta}` : ''}</div>
              </td>
              <td className="px-6 py-4 text-center">
                <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/30 px-3 py-1 rounded-lg text-[9px] font-black uppercase">
                  {c.tipo || 'Corrente'}
                </span>
              </td>
              <td className="px-6 py-4 text-xs text-slate-500">{c.pix || '–'}</td>
              <td className="px-6 py-4 text-center">
                <StatusBadge ativo={c.ativo !== false} />
              </td>
              <td className="px-6 py-4 text-right">
                <AcoesBotoes onEdit={() => abrirEditar(c)} onDelete={() => handleDeletar(c.id)} cor="indigo" />
              </td>
            </tr>
          ))}
        </tbody>
      </Tabela>

      {modal.aberto && (
        <Modal title={modal.editando ? 'Editar Conta' : 'Nova Conta Bancária'} onClose={fecharModal}>
          <form onSubmit={handleSalvar} className="space-y-3">
            {erro && <ErroBanner msg={erro} />}
            <FieldInput label="Banco *" value={form.banco ?? ''} onChange={v => setForm(p => ({ ...p, banco: v }))} required placeholder="Ex: Banco do Brasil, Nubank..." />
            <FieldInput label="Titular *" value={form.titular ?? ''} onChange={v => setForm(p => ({ ...p, titular: v }))} required />
            <div className="grid grid-cols-2 gap-3">
              <FieldInput label="Agência" value={form.agencia ?? ''} onChange={v => setForm(p => ({ ...p, agencia: v }))} />
              <FieldInput label="Conta *" value={form.conta ?? ''} onChange={v => setForm(p => ({ ...p, conta: v }))} required />
            </div>
            <FieldSelect label="Tipo de Conta" value={form.tipo ?? 'Corrente'} onChange={v => setForm(p => ({ ...p, tipo: v }))}>
              {TIPOS_CONTA.map(t => <option key={t} value={t}>{t}</option>)}
            </FieldSelect>
            <FieldInput label="Chave PIX" value={form.pix ?? ''} onChange={v => setForm(p => ({ ...p, pix: v }))} placeholder="CPF, CNPJ, e-mail, celular ou chave aleatória" />
            <ToggleAtivo valor={form.ativo !== false} onChange={v => setForm(p => ({ ...p, ativo: v }))} />
            <BtnSalvar salvando={salvando} editando={!!modal.editando} cor="indigo" />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Tab: Cadastro Financeiro (Genérica para lookup tables) ───────────────────

interface LookupItem { id: string; nome: string; descricao?: string; ativo?: boolean; }

function FinLookupTab({ onCount, endpoint, titulo, cor }: {
  onCount: (n: number) => void; endpoint: string; titulo: string; cor: string;
}) {
  const [lista, setLista]   = useState<LookupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro]     = useState('');
  const [busca, setBusca]   = useState('');
  const [modal, setModal]   = useState<{ aberto: boolean; editando: LookupItem | null }>({ aberto: false, editando: null });
  const [form, setForm]     = useState<Partial<LookupItem>>({ ativo: true });
  const [salvando, setSalvando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(endpoint);
      setLista(r.data); onCount(r.data.length);
    } catch { setErro(`Erro ao carregar ${titulo.toLowerCase()}.`); }
    setLoading(false);
  }, [onCount, endpoint, titulo]);

  useEffect(() => { load(); }, [load]);

  const abrirCriar  = () => { setForm({ ativo: true }); setModal({ aberto: true, editando: null }); };
  const abrirEditar = (i: LookupItem) => {
    setForm({ nome: i.nome, descricao: i.descricao, ativo: i.ativo });
    setModal({ aberto: true, editando: i });
  };
  const fecharModal = () => { setModal({ aberto: false, editando: null }); setForm({ ativo: true }); setErro(''); };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault(); setSalvando(true); setErro('');
    try {
      if (modal.editando) await api.patch(`${endpoint}/${modal.editando.id}`, form);
      else await api.post(endpoint, form);
      fecharModal(); load();
    } catch (e: any) { setErro(e.response?.data?.message || 'Erro ao salvar.'); }
    setSalvando(false);
  };

  const handleDeletar = async (id: string) => {
    if (!confirm(`Confirmar exclusão deste registro de ${titulo.toLowerCase()}?`)) return;
    try { await api.delete(`${endpoint}/${id}`); load(); }
    catch (e: any) { alert(e.response?.data?.message || 'Erro ao excluir.'); }
  };

  const filtrados = lista.filter(i =>
    i.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (i.descricao ?? '').toLowerCase().includes(busca.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      {erro && <Banner tipo="erro" msg={erro} onClose={() => setErro('')} />}

      <BarraAcao busca={busca} setBusca={setBusca} placeholder={`Buscar ${titulo.toLowerCase()}...`} btnLabel={`Novo(a) ${titulo}`} btnCor={cor} onClick={abrirCriar} />

      <Tabela loading={loading} vazio={filtrados.length === 0} msgVazio={`Nenhum registro de ${titulo.toLowerCase()} encontrado.`}>
        <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-600">
          <tr className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
            <th className="text-left px-6 py-4">Nome</th>
            <th className="text-left px-6 py-4">Descrição</th>
            <th className="text-center px-6 py-4">Status</th>
            <th className="text-right px-6 py-4">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
          {filtrados.map(i => (
            <tr key={i.id} className="hover:bg-teal-50/30 dark:hover:bg-teal-900/20 transition-colors">
              <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100 text-sm">{i.nome}</td>
              <td className="px-6 py-4 text-xs text-slate-500">{i.descricao || '–'}</td>
              <td className="px-6 py-4 text-center">
                <StatusBadge ativo={i.ativo !== false} />
              </td>
              <td className="px-6 py-4 text-right">
                <AcoesBotoes onEdit={() => abrirEditar(i)} onDelete={() => handleDeletar(i.id)} cor={cor} />
              </td>
            </tr>
          ))}
        </tbody>
      </Tabela>

      {modal.aberto && (
        <Modal title={modal.editando ? `Editar ${titulo}` : `Novo(a) ${titulo}`} onClose={fecharModal}>
          <form onSubmit={handleSalvar} className="space-y-3">
            {erro && <ErroBanner msg={erro} />}
            <FieldInput label="Nome *" value={form.nome ?? ''} onChange={v => setForm(p => ({ ...p, nome: v }))} required />
            <FieldInput label="Descrição" value={form.descricao ?? ''} onChange={v => setForm(p => ({ ...p, descricao: v }))} />
            <ToggleAtivo valor={form.ativo !== false} onChange={v => setForm(p => ({ ...p, ativo: v }))} />
            <BtnSalvar salvando={salvando} editando={!!modal.editando} cor={cor} />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Sub-Componentes Compartilhados ───────────────────────────────────────────

const CORES: Record<string, { tab: string; btn: string; ring: string }> = {
  purple: { tab: 'bg-purple-600',  btn: 'bg-purple-600 hover:bg-purple-700', ring: 'focus:ring-purple-400' },
  blue:   { tab: 'bg-blue-600',    btn: 'bg-blue-600 hover:bg-blue-700',     ring: 'focus:ring-blue-400' },
  emerald:{ tab: 'bg-emerald-600', btn: 'bg-emerald-600 hover:bg-emerald-700', ring: 'focus:ring-emerald-400' },
  amber:  { tab: 'bg-amber-500',   btn: 'bg-amber-500 hover:bg-amber-600',   ring: 'focus:ring-amber-400' },
  cyan:   { tab: 'bg-cyan-600',    btn: 'bg-cyan-600 hover:bg-cyan-700',     ring: 'focus:ring-cyan-400' },
  orange: { tab: 'bg-orange-500',  btn: 'bg-orange-500 hover:bg-orange-600', ring: 'focus:ring-orange-400' },
  rose:   { tab: 'bg-rose-500',    btn: 'bg-rose-500 hover:bg-rose-600',     ring: 'focus:ring-rose-400' },
  indigo: { tab: 'bg-indigo-600',  btn: 'bg-indigo-600 hover:bg-indigo-700', ring: 'focus:ring-indigo-400' },
  teal:   { tab: 'bg-teal-600',    btn: 'bg-teal-600 hover:bg-teal-700',     ring: 'focus:ring-teal-400' },
};

function TabKpi({ tab, active, set, count }: {
  tab: { id: TabId; label: string; icon: React.ElementType; cor: string };
  active: TabId; set: (v: TabId) => void; count: number;
}) {
  const isActive = active === tab.id;
  const Icon = tab.icon;
  const c = CORES[tab.cor] ?? CORES.purple;
  return (
    <button onClick={() => set(tab.id)} className={`flex-none snap-start p-4 rounded-2xl border transition-all duration-200 flex items-center gap-3 text-left min-w-[140px] ${
      isActive ? `${c.tab} border-transparent text-white shadow-lg` : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:shadow-md text-slate-600 dark:text-slate-400'
    }`}>
      <div className={`p-2 rounded-xl ${isActive ? 'bg-white/20' : 'bg-slate-50 dark:bg-slate-700'}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className={`text-[8px] font-black uppercase tracking-wider leading-none mb-0.5 ${isActive ? 'text-white/70' : 'text-slate-400'}`}>{tab.label}</p>
        <p className="text-xl font-black tracking-tighter">{count}</p>
      </div>
    </button>
  );
}

function BarraAcao({ busca, setBusca, placeholder, btnLabel, btnCor, onClick }: {
  busca: string; setBusca: (v: string) => void; placeholder: string;
  btnLabel: string; btnCor: string; onClick: () => void;
}) {
  const c = CORES[btnCor] ?? CORES.purple;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm">
      <div className="relative flex-1 min-w-[200px]">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder={placeholder}
          className="w-full pl-8 pr-3 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400" />
      </div>
      <button onClick={onClick} className={`${c.btn} text-white px-5 py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 transition-colors shadow-sm`}>
        <Plus size={14} strokeWidth={3} /> {btnLabel}
      </button>
    </div>
  );
}

function Tabela({ loading, vazio, msgVazio, children }: {
  loading: boolean; vazio: boolean; msgVazio: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow overflow-hidden">
      {loading ? <Carregando /> : vazio ? <Vazio msg={msgVazio} /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">{children}</table>
        </div>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-sm font-black uppercase tracking-tight text-slate-800 dark:text-slate-100">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function Avatar({ nome, cor }: { nome: string; cor: string }) {
  const c = CORES[cor] ?? CORES.purple;
  const iniciais = nome.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  return (
    <div className={`w-8 h-8 rounded-full ${c.tab} flex items-center justify-center text-white font-black text-[10px] shrink-0`}>
      {iniciais}
    </div>
  );
}

function StatusBadge({ ativo, labelAtivo = 'Ativo', labelInativo = 'Inativo' }: { ativo: boolean; labelAtivo?: string; labelInativo?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${ativo ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ativo ? 'bg-emerald-500' : 'bg-red-500'}`} />
      {ativo ? labelAtivo : labelInativo}
    </span>
  );
}

function AcoesBotoes({ onEdit, onDelete, cor = 'purple' }: { onEdit: () => void; onDelete: () => void; cor?: string }) {
  const { user } = useAuth();
  const podeExcluir = ROLES_PODEM_DELETAR.includes(user?.role ?? '');
  const c = CORES[cor] ?? CORES.purple;
  return (
    <div className="flex items-center gap-1">
      <button onClick={onEdit} className={`p-1.5 rounded-lg ${c.btn} text-white transition-colors`}><Edit3 size={11} /></button>
      {podeExcluir && (
        <button onClick={onDelete} className="p-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"><Trash2 size={11} /></button>
      )}
    </div>
  );
}

function FieldInput({ label, value, onChange, type = 'text', required, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 transition-shadow" />
    </div>
  );
}

function FieldSelect({ label, value, onChange, children, required }: {
  label: string; value: string; onChange: (v: string) => void;
  children: React.ReactNode; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 transition-shadow">
        {children}
      </select>
    </div>
  );
}

function ToggleAtivo({ valor, onChange }: { valor: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</span>
      <button type="button" onClick={() => onChange(!valor)}
        className={`relative w-10 h-5 rounded-full transition-colors ${valor ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${valor ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function BtnSalvar({ salvando, editando, cor = 'purple', label }: { salvando: boolean; editando: boolean; cor?: string; label?: string }) {
  const c = CORES[cor] ?? CORES.purple;
  return (
    <button type="submit" disabled={salvando}
      className={`w-full ${c.btn} text-white py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-colors disabled:opacity-60`}>
      {salvando ? 'Salvando...' : label ?? (editando ? 'Atualizar' : 'Cadastrar')}
    </button>
  );
}

function ErroBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
      <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
      <p className="text-xs text-red-600 dark:text-red-400 font-semibold">{msg}</p>
    </div>
  );
}

function Banner({ tipo, msg, onClose }: { tipo: 'erro' | 'ok'; msg: string; onClose?: () => void }) {
  const isErro = tipo === 'erro';
  return (
    <div className={`flex items-start gap-2 rounded-xl p-3 border ${isErro ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'}`}>
      <AlertCircle size={14} className={`shrink-0 mt-0.5 ${isErro ? 'text-red-500' : 'text-emerald-500'}`} />
      <p className={`text-xs font-semibold flex-1 ${isErro ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{msg}</p>
      {onClose && <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={12} /></button>}
    </div>
  );
}

function Carregando() {
  return <div className="py-16 text-center text-sm text-slate-400 dark:text-slate-500 font-bold">Carregando...</div>;
}

function Vazio({ msg }: { msg: string }) {
  return <div className="py-16 text-center text-sm text-slate-400 dark:text-slate-500 font-bold">{msg}</div>;
}

function formatarCPF(cpf: string): string {
  const n = cpf.replace(/\D/g, '');
  if (n.length !== 11) return cpf;
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
}

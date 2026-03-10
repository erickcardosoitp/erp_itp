'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { toast } from 'sonner';
import {
  User, Camera, Save, Loader2, Settings2,
  Palette, ShieldCheck, Moon, Sun,
  UserCog
} from 'lucide-react';
import { useTheme } from 'next-themes';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';

// --- HELPERS ---
const getInitials = (name = '') => {
  if (!name) return '';
  const names = name.split(' ');
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  return `${names[0].charAt(0)}${names[names.length - 1].charAt(0)}`.toUpperCase();
};

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  ADMIN:           { label: 'Administrador',    color: 'bg-purple-100 text-purple-700 border-purple-200' },
  DIRETOR:         { label: 'Diretor',           color: 'bg-blue-100 text-blue-700 border-blue-200' },
  PRESIDENTE:      { label: 'Presidente',        color: 'bg-amber-100 text-amber-700 border-amber-200' },
  VICE_PRESIDENTE: { label: 'Vice-Presidente',   color: 'bg-amber-50 text-amber-600 border-amber-100' },
  PROFESSOR:       { label: 'Professor',         color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  COORDENADOR:     { label: 'Coordenador',       color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  ALUNO:           { label: 'Aluno',             color: 'bg-slate-100 text-slate-600 border-slate-200' },
};

// --- TIPOS ---
type TabId = 'perfil' | 'acessibilidade' | 'gestao';

// ─────────────────────────────────────────────────────────────
// ABA: MEU PERFIL
// ─────────────────────────────────────────────────────────────
function MeuPerfilTab() {
  const { user, setUser } = useAuth();
  const [nome, setNome] = useState('');
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const buildFotoUrl = (fotoUrl?: string) => {
    if (!fotoUrl) return null;
    if (fotoUrl.startsWith('http')) return fotoUrl;
    // Caminhos relativos (/uploads/...) são servidos pelo proxy do Next.js
    return fotoUrl;
  };

  useEffect(() => {
    if (user) {
      setNome(user.nome || '');
      setFotoPreview(buildFotoUrl(user.fotoUrl));
    }
  }, [user]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setFotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSaveChanges = async () => {
    if (!user) return;
    setIsSaving(true);
    const formData = new FormData();
    formData.append('nome', nome);
    formData.append('email', user.email);
    if (fotoFile) formData.append('file', fotoFile);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/usuarios/perfil`, {
        method: 'PATCH',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Falha ao atualizar o perfil.');
      const updatedUser = await response.json();
      setUser(updatedUser);
      toast.success('Perfil atualizado com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Ocorreu um erro.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  const roleInfo = ROLE_LABELS[user.role] ?? { label: user.role, color: 'bg-slate-100 text-slate-600 border-slate-200' };

  return (
    <div className="space-y-8">
      {/* Cabeçalho da seção */}
      <div className="flex items-center gap-3 pb-6 border-b border-slate-100">
        <div className="bg-purple-600 p-2.5 rounded-xl shadow-lg shadow-purple-500/20">
          <User size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-sm font-black uppercase tracking-tighter text-slate-900">Edição de Perfil</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Dados pessoais e foto de exibição</p>
        </div>
      </div>

      {/* Card de identidade */}
      <div className="bg-slate-50 rounded-[28px] p-6 border border-slate-100 flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <div className="relative flex-shrink-0">
          <Avatar className="h-28 w-28 border-4 border-white shadow-xl ring-2 ring-purple-100">
            <AvatarImage src={fotoPreview || ''} alt={user.nome} />
            <AvatarFallback className="text-3xl font-black bg-purple-900 text-yellow-400">
              {getInitials(user.nome)}
            </AvatarFallback>
          </Avatar>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-2 -right-2 bg-yellow-400 text-purple-950 rounded-full p-2.5 hover:bg-yellow-300 transition-all active:scale-90 shadow-lg border-2 border-white font-black"
            title="Alterar foto"
          >
            <Camera size={15} />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/png, image/jpeg, image/gif"
          />
        </div>

        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-900">{user.nome}</h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">{user.email}</p>
          <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
            <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-lg border ${roleInfo.color}`}>
              {roleInfo.label}
            </span>
            <span className="text-[9px] font-black uppercase px-3 py-1 rounded-lg border bg-slate-100 text-slate-500 border-slate-200">
              Instituto Tia Pretinha
            </span>
          </div>
        </div>
      </div>

      {/* Campos editáveis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome Completo</label>
          <Input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome completo"
            className="bg-slate-50 border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">E-mail</label>
          <Input
            value={user.email}
            disabled
            className="bg-slate-100 border-slate-200 rounded-xl font-bold text-slate-400 cursor-not-allowed"
          />
        </div>
      </div>

      {/* Ação */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSaveChanges}
          disabled={isSaving}
          className="bg-yellow-400 text-purple-950 px-8 py-4 rounded-2xl font-black text-[11px] uppercase flex items-center gap-3 hover:bg-yellow-300 transition-all shadow-xl shadow-yellow-500/20 border-b-4 border-yellow-600 active:translate-y-1 active:border-b-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:translate-y-0"
        >
          {isSaving
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
            : <><Save size={16} strokeWidth={3} /> Salvar Alterações</>
          }
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ABA: ACESSIBILIDADE
// ─────────────────────────────────────────────────────────────
function AcessibilidadeTab() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="space-y-8">
      {/* Cabeçalho da seção */}
      <div className="flex items-center gap-3 pb-6 border-b border-slate-100">
        <div className="bg-purple-600 p-2.5 rounded-xl shadow-lg shadow-purple-500/20">
          <Palette size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-sm font-black uppercase tracking-tighter text-slate-900">Acessibilidade</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Visualização e preferências de interface</p>
        </div>
      </div>

      {/* Seletor de Tema */}
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Tema de Cores</p>
        <div className="flex items-center gap-4 bg-slate-100 p-1.5 rounded-2xl w-fit">
          <button
            onClick={() => setTheme('light')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-[11px] uppercase tracking-tighter transition-all duration-200 ${
              !isDark
                ? 'bg-white text-slate-900 shadow-md'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Sun size={16} />
            Claro
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-[11px] uppercase tracking-tighter transition-all duration-200 ${
              isDark
                ? 'bg-purple-950 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Moon size={16} />
            Escuro
          </button>
        </div>
      </div>

      {/* Opções em breve */}
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Mais Opções</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Tamanho da Fonte',    desc: 'Ajuste o tamanho do texto da plataforma.' },
            { label: 'Alto Contraste',      desc: 'Melhora a legibilidade para baixa visão.' },
            { label: 'Reduzir Animações',   desc: 'Diminui efeitos de movimento da interface.' },
            { label: 'Compactar Layout',    desc: 'Exibe mais informações com menos espaçamento.' },
          ].map(({ label, desc }) => (
            <div key={label} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 opacity-50 cursor-not-allowed select-none">
              <div>
                <p className="text-xs font-black uppercase tracking-tighter text-slate-700">{label}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">{desc}</p>
              </div>
              <span className="text-[8px] font-black uppercase bg-slate-200 text-slate-500 px-2 py-1 rounded-lg">Em Breve</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ABA: GESTÃO DE ACESSO
// ─────────────────────────────────────────────────────────────
const MOCK_USUARIOS = [
  { id: 1, nome: 'Ricardo Almeida',  email: 'admin@itp.org.br',      role: 'ADMIN',      status: 'Ativo' },
  { id: 2, nome: 'Carla Mendes',     email: 'carla@itp.org.br',       role: 'DIRETOR',    status: 'Ativo' },
  { id: 3, nome: 'Marcus Vinícius',  email: 'marcus@itp.org.br',      role: 'PROFESSOR',  status: 'Ativo' },
  { id: 4, nome: 'Juliana Pereira',  email: 'juliana@itp.org.br',     role: 'COORDENADOR', status: 'Ativo' },
  { id: 5, nome: 'Pedro Henrique',   email: 'pedro.h@itp.org.br',     role: 'PROFESSOR',  status: 'Pendente' },
];

function GestaoAcessoTab() {
  return (
    <div className="space-y-8">
      {/* Cabeçalho da seção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="bg-purple-600 p-2.5 rounded-xl shadow-lg shadow-purple-500/20">
            <ShieldCheck size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-tighter text-slate-900">Gestão de Acesso</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Usuários e permissões do sistema</p>
          </div>
        </div>
        <button
          disabled
          className="bg-yellow-400 text-purple-950 px-6 py-3 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2 opacity-50 cursor-not-allowed border-b-4 border-yellow-600"
          title="Em desenvolvimento"
        >
          <UserCog size={14} strokeWidth={3} /> Convidar Usuário
        </button>
      </div>

      {/* KPIs resumidos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total de Usuários', value: '5',  color: 'bg-purple-900 text-white' },
          { label: 'Ativos',            value: '4',  color: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
          { label: 'Pendentes',         value: '1',  color: 'bg-amber-50 text-amber-600 border border-amber-100' },
          { label: 'Perfis de Acesso',  value: '6',  color: 'bg-slate-100 text-slate-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`${color} px-5 py-4 rounded-2xl`}>
            <p className="text-2xl font-black">{value}</p>
            <p className="text-[10px] font-black uppercase tracking-widest mt-0.5 opacity-70">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabela de usuários */}
      <div className="overflow-x-auto rounded-[28px] border border-slate-100 shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
              <th className="px-6 py-4">Usuário</th>
              <th className="px-6 py-4 hidden md:table-cell">E-mail</th>
              <th className="px-6 py-4 text-center">Perfil</th>
              <th className="px-6 py-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {MOCK_USUARIOS.map((u) => {
              const roleInfo = ROLE_LABELS[u.role] ?? { label: u.role, color: 'bg-slate-100 text-slate-600 border-slate-200' };
              return (
                <tr key={u.id} className="hover:bg-purple-50/40 transition-all group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-900 flex items-center justify-center text-yellow-400 font-black text-[10px] flex-shrink-0">
                        {getInitials(u.nome)}
                      </div>
                      <span className="font-black text-xs text-slate-900 uppercase tracking-tighter">{u.nome}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <span className="text-xs text-slate-500 font-medium">{u.email}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-lg border ${roleInfo.color}`}>
                      {roleInfo.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-xl shadow-sm border ${
                      u.status === 'Ativo'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        : 'bg-amber-50 text-amber-600 border-amber-100'
                    }`}>
                      {u.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-300">
        Gestão completa de usuários em desenvolvimento
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function ConfiguracoesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('perfil');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const rolesComAcesso = ['ADMIN', 'DIRETOR', 'VICE_PRESIDENTE', 'VP', 'PRESIDENTE', 'DRT'];
  const temAcessoGestao = user && rolesComAcesso.includes((user.role ?? '').toUpperCase());

  if (!isMounted || loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <Loader2 className="animate-spin text-purple-600" size={48} />
      </div>
    );
  }

  if (!user) {
    router.replace('/login');
    return null;
  }

  const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'perfil',         label: 'Meu Perfil',     icon: User },
    { id: 'acessibilidade', label: 'Acessibilidade', icon: Palette },
    ...(temAcessoGestao ? [{ id: 'gestao' as TabId, label: 'Gestão de Acesso', icon: ShieldCheck }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 p-4 md:p-8 font-sans antialiased text-slate-900 dark:text-slate-50">
      <div className="max-w-[1600px] mx-auto">

        {/* ── HEADER ── */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-purple-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">
                Painel Pessoal
              </span>
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                <Settings2 size={12} /> Preferências e Conta
              </span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter italic">
              Config <span className="text-purple-600">.ITP</span>
            </h1>
          </div>


        </header>

        {/* ── TABS KPI ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {TABS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`p-5 rounded-3xl border transition-all duration-300 flex items-center gap-4 group ${
                  isActive
                    ? 'bg-purple-950 border-purple-950 text-white shadow-2xl shadow-purple-900/30 scale-[1.02]'
                    : 'bg-white border-slate-100 hover:shadow-md hover:border-slate-200'
                }`}
              >
                <div className={`p-3 rounded-2xl flex items-center justify-center transition-colors flex-shrink-0 ${
                  isActive
                    ? 'bg-purple-600'
                    : 'bg-slate-100 text-slate-500 group-hover:bg-purple-100 group-hover:text-purple-600'
                }`}>
                  <Icon size={20} />
                </div>
                <p className={`text-sm font-black uppercase tracking-tighter ${isActive ? 'text-white' : 'text-slate-800'}`}>
                  {label}
                </p>
              </button>
            );
          })}
        </div>

        {/* ── CONTEÚDO ATIVO ── */}
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl overflow-hidden p-6 sm:p-8 md:p-12">
          {activeTab === 'perfil'         && <MeuPerfilTab />}
          {activeTab === 'acessibilidade' && <AcessibilidadeTab />}
          {activeTab === 'gestao' && temAcessoGestao && <GestaoAcessoTab />}
        </div>

      </div>
    </div>
  );
}


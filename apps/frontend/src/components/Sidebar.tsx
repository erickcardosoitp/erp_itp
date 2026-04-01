'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import Cookies from 'js-cookie';
import { 
  LayoutDashboard, UserPlus, ClipboardList, 
  LogOut, Settings, PanelLeftClose, PanelLeftOpen,
  GraduationCap, DollarSign, Heart, Package, Loader2, BarChart2, X
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

// Mapeia path → chave de modulos_visiveis
const PATH_TO_MODULE: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/cadastro': 'cadastro_basico',
  '/matriculas': 'matriculas',
  '/academico': 'academico',
  '/financeiro': 'financeiro',
  '/doacoes': 'doacoes',
  '/estoque': 'estoque',
  '/relatorios': 'relatorios',
};

export default function Sidebar({ isCollapsed, setIsCollapsed, mobileOpen, setMobileOpen }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  // Menu atualizado com a taxonomia do ITP ERP
  const primaryMenu = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Cadastro Básico', path: '/cadastro', icon: UserPlus },
    { name: 'Matrículas', path: '/matriculas', icon: ClipboardList },
    { name: 'Acadêmico', path: '/academico', icon: GraduationCap },
    { name: 'Financeiro', path: '/financeiro', icon: DollarSign },
    { name: 'Doações', path: '/doacoes', icon: Heart },
    { name: 'Estoque', path: '/estoque', icon: Package },
    { name: 'Relatórios', path: '/relatorios', icon: BarChart2 },
  ];

  // Filtra módulos com base nas permissões do grupo
  // admin e prt têm acesso total (espelha o middleware)
  const isFullAccess = ['admin', 'prt'].includes(user?.role?.toLowerCase() ?? '');
  const modulosVisiveis = user?.grupo?.grupo_permissoes?.modulos_visiveis;

  const filteredMenu = primaryMenu.filter(item => {
    if (loading) return true;       // Mantém itens visíveis durante o carregamento inicial
    if (isFullAccess) return true;  // Admin/prt veem tudo
    if (!user?.grupo) return false; // Sem grupo = acesso restrito
    if (!modulosVisiveis) return false; // Grupo sem config = sem acesso
    const key = PATH_TO_MODULE[item.path];
    if (!key) return false;
    return modulosVisiveis[key] === true; // Apenas módulos explicitamente permitidos
  });

  /**
   * MODO ARQUITETURA:
   * Chamada ao endpoint do NestJS para invalidar o cookie HttpOnly.
   */
  const handleLogout = async () => {
    if (!confirm('Deseja realmente sair do sistema?')) return;

    setIsLoggingOut(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';
      await fetch(`${apiUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Erro ao deslogar:', error);
    } finally {
      // Sempre limpa o cookie client-side e redireciona, independente da resposta da API
      Cookies.remove('itp_token', { path: '/' });
      setIsLoggingOut(false);
      window.location.href = '/login';
    }
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-screen text-white flex flex-col shadow-2xl transition-all duration-300 z-50
        w-72 ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}
      style={{ backgroundColor: '#1a0b2e' }}
    >
      
      {/* Header com Logo e Toggle */}
      <div className="p-4 lg:p-6 flex items-center justify-between border-b border-purple-900/50">
        {/* X close – só no mobile */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 hover:bg-purple-800 rounded-lg transition-colors text-purple-300"
          aria-label="Fechar menu"
        >
          <X size={20} />
        </button>
        {(!isCollapsed || mobileOpen) && (
          <h1 className="text-xl font-black italic tracking-tighter">
            ITP <span className="text-yellow-400">ERP</span>
          </h1>
        )}
        {/* Collapse toggle – só no desktop */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex p-1 hover:bg-purple-800 rounded-lg transition-colors text-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
          aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
        >
          {isCollapsed ? <PanelLeftOpen size={24} /> : <PanelLeftClose size={20} />}
        </button>
      </div>

      {/* Navegação Principal */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
        {filteredMenu.map((item) => {
          const isActive = pathname.startsWith(item.path);
          const Icon = item.icon;
          
          return (
            <Link 
              key={item.path} 
              href={item.path} 
              title={isCollapsed ? item.name : ''}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-4 px-4 py-3 rounded-xl font-bold transition-all duration-200 group
                ${isActive ? 'bg-yellow-400 text-purple-950 shadow-lg' : 'hover:bg-purple-900/40 text-purple-200'}`}
            >
              <Icon size={22} className={`shrink-0 ${isActive ? '' : 'group-hover:scale-110 transition-transform'}`} />
              {(!isCollapsed || mobileOpen) && (
                <span className="uppercase text-[10px] font-black tracking-widest whitespace-nowrap">
                  {item.name}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Rodapé: Configurações e Logout */}
      <div className="px-3 py-4 border-t border-purple-900/50 space-y-1">
        <Link 
          href="/config" 
          title={isCollapsed ? "Configurações" : ""}
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-4 px-4 py-3 rounded-xl font-bold transition-all
            ${pathname === '/config' ? 'bg-yellow-400 text-purple-950' : 'text-purple-300 hover:bg-purple-900/40'}`}
        >
          <Settings size={22} />
          {(!isCollapsed || mobileOpen) && <span className="uppercase text-[10px] font-black tracking-widest">Configurações</span>}
        </Link>
        
        <button 
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex items-center gap-4 px-4 py-3 w-full rounded-xl font-bold text-red-400 hover:bg-red-500/10 transition-all group disabled:opacity-50"
        >
          {isLoggingOut ? (
            <Loader2 size={22} className="animate-spin" />
          ) : (
            <LogOut size={22} className="group-hover:translate-x-1 transition-transform" />
          )}
          {(!isCollapsed || mobileOpen) && (
            <span className="uppercase text-[10px] font-black tracking-widest text-left">
              {isLoggingOut ? 'Saindo...' : 'Sair'}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
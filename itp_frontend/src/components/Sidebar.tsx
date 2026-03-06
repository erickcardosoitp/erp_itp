'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, UserPlus, ClipboardList, 
  LogOut, Settings, PanelLeftClose, PanelLeftOpen,
  GraduationCap, DollarSign, Heart, Package, Loader2 
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
}

export default function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
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
  ];

  /**
   * MODO ARQUITETURA:
   * Chamada ao endpoint do NestJS para invalidar o cookie HttpOnly.
   */
  const handleLogout = async () => {
    if (!confirm('Deseja realmente sair do sistema?')) return;
    
    setIsLoggingOut(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api'; // Já usa a variável de ambiente
      
      const response = await fetch(`${apiUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include', // Necessário para enviar e limpar o cookie
      });

      if (response.ok) {
        // Força reload para limpar estados da aplicação e redirecionar via Middleware
        window.location.href = '/login';
      } else {
        throw new Error('Falha no logout');
      }
    } catch (error) {
      console.error('Erro ao deslogar:', error);
      // Fallback: redireciona mesmo se a API falhar
      router.push('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <aside 
      className={`fixed left-0 top-0 h-screen text-white flex flex-col shadow-2xl transition-all duration-300 z-50 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`} 
      style={{ backgroundColor: '#1a0b2e' }} // Roxo profundo (Purple 950)
    >
      
      {/* Header com Logo e Toggle */}
      <div className="p-6 flex items-center justify-between border-b border-purple-900/50">
        {!isCollapsed && (
          <h1 className="text-2xl font-black italic tracking-tighter">
            ITP <span className="text-yellow-400">ERP</span>
          </h1>
        )}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 hover:bg-purple-800 rounded-lg transition-colors text-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
          aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
        >
          {isCollapsed ? <PanelLeftOpen size={24} /> : <PanelLeftClose size={20} />}
        </button>
      </div>

      {/* Navegação Principal */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
        {primaryMenu.map((item) => {
          const isActive = pathname.startsWith(item.path);
          const Icon = item.icon;
          
          return (
            <Link 
              key={item.path} 
              href={item.path} 
              title={isCollapsed ? item.name : ''}
              className={`flex items-center gap-4 px-4 py-3 rounded-xl font-bold transition-all duration-200 group
                ${isActive ? 'bg-yellow-400 text-purple-950 shadow-lg' : 'hover:bg-purple-900/40 text-purple-200'}`}
            >
              <Icon size={22} className={`shrink-0 ${isActive ? '' : 'group-hover:scale-110 transition-transform'}`} />
              {!isCollapsed && (
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
          className={`flex items-center gap-4 px-4 py-3 rounded-xl font-bold transition-all
            ${pathname === '/config' ? 'bg-yellow-400 text-purple-950' : 'text-purple-300 hover:bg-purple-900/40'}`}
        >
          <Settings size={22} />
          {!isCollapsed && <span className="uppercase text-[10px] font-black tracking-widest">Configurações</span>}
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
          {!isCollapsed && (
            <span className="uppercase text-[10px] font-black tracking-widest text-left">
              {isLoggingOut ? 'Saindo...' : 'Sair'}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
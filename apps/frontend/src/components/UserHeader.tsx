'use client';
import { useAuth } from '@/context/auth-context';

const ROLE_LABELS: Record<string, string> = {
  ADMIN:           'Administrador',
  admin:           'Administrador',
  DIRETOR:         'Diretor',
  diretor:         'Diretor',
  PRESIDENTE:      'Presidente',
  VICE_PRESIDENTE: 'Vice-Presidente',
  PROFESSOR:       'Professor',
  COORDENADOR:     'Coordenador',
  ALUNO:           'Aluno',
  ASSISTENTE:      'Assistente',
};

const buildFotoUrl = (fotoUrl?: string) => {
  if (!fotoUrl) return null;
  // URLs absolutas (http/https) são usadas diretamente
  if (fotoUrl.startsWith('http')) return fotoUrl;
  // Caminhos relativos (ex: /uploads/perfil/...) passam pelo proxy do Next.js
  return fotoUrl;
};

export default function UserHeader() {
  const { user, loading } = useAuth();

  if (loading || !user) return null;

  const nome = user.nome || user.email || 'Usuário';
  const cargo = ROLE_LABELS[user.role] ?? user.role;
  const fotoUrl = buildFotoUrl(user.fotoUrl);
  const inicial = nome.charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-1.5 rounded-full shadow-md">
      <div className="flex flex-col items-end text-right">
        <span className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase italic leading-none">
          {nome}
        </span>
        <span className="text-[9px] font-black text-purple-600 dark:text-purple-400 tracking-widest uppercase">
          {cargo}
        </span>
      </div>

      <div className="w-9 h-9 rounded-full bg-purple-600 border-2 border-purple-100 dark:border-purple-800 overflow-hidden flex items-center justify-center flex-shrink-0">
        {fotoUrl ? (
          <img src={fotoUrl} className="w-full h-full object-cover" alt={nome} />
        ) : (
          <span className="text-white font-black text-xs">{inicial}</span>
        )}
      </div>
    </div>
  );
}
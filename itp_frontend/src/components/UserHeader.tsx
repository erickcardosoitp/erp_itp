'use client';
import { useEffect, useState } from 'react';

export default function UserHeader() {
  const [userData, setUserData] = useState<{ nome: string; grupoNome: string; fotoUrl?: string } | null>(null);

  useEffect(() => {
    const updateHeader = () => {
      const userRaw = localStorage.getItem('usuario');
      if (userRaw) {
        try {
          const user = JSON.parse(userRaw);
          // ✅ Ajuste para ler fotoUrl ou foto e garantir a URL do Backend (3001)
          const fotoPath = user.fotoUrl || user.foto || ''; // fotoPath já deve ser relativo (ex: /uploads/perfil/...)
          const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace('/api', '') || 'http://localhost:3001';
          const fullFotoUrl = fotoPath ? `${backendBaseUrl}${fotoPath}` : null;

          setUserData({
            nome: user.nome || user.name || "Usuário",
            grupoNome: user.grupo?.nome || user.grupo || 'ADMIN',
            fotoUrl: fullFotoUrl ?? undefined
          });
        } catch (e) { console.error("Erro no Header:", e); }
      }
    };

    updateHeader();
    window.addEventListener('storage', updateHeader);
    return () => window.removeEventListener('storage', updateHeader);
  }, []);

  if (!userData) return null;

  return (
    <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-1.5 rounded-full shadow-md">
      <div className="flex flex-col items-end text-right">
        <span className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase italic leading-none">
          {userData.nome}
        </span>
        <span className="text-[9px] font-black text-purple-600 dark:text-purple-400 tracking-widest uppercase">
          {userData.grupoNome}
        </span>
      </div>
      
      <div className="w-9 h-9 rounded-full bg-purple-600 border-2 border-purple-100 dark:border-purple-800 overflow-hidden flex items-center justify-center">
        {userData.fotoUrl ? (
          <img src={userData.fotoUrl} className="w-full h-full object-cover" alt="Profile" />
        ) : (
          <span className="text-white font-black text-xs">{userData.nome.charAt(0).toUpperCase()}</span>
        )}
      </div>
    </div>
  );
}
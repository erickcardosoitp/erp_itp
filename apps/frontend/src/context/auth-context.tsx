'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import Cookies from 'js-cookie';

interface UserPayload {
  email: string;
  role: string; // Ex: 'admin', 'drt', 'vp'
  sub: number;
  nome?: string;
  fotoUrl?: string;
  grupo?: string; // Nome do grupo do usuário (do JWT payload)
  permissoes?: Record<string, boolean>; // Permissões do grupo
}

interface AuthContextType {
  user: UserPayload | null;
  setUser: React.Dispatch<React.SetStateAction<UserPayload | null>>;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  isAuthenticated: false,
  loading: true
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = Cookies.get('itp_token');

        // Monta os headers: se o cookie for legível pelo js-cookie, usa Bearer.
        // Caso contrário, o browser enviará automaticamente o cookie httpOnly
        // graças a credentials: 'include'.
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token.replace(/"/g, '')}`;
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/usuarios/perfil`,
          { method: 'GET', credentials: 'include', headers }
        );

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Falha ao buscar os dados do usuário:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, isAuthenticated: !!user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook para facilitar o uso em outros componentes
export const useAuth = () => useContext(AuthContext);

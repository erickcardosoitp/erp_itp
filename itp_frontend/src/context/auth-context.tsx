'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';

interface UserPayload {
  email: string;
  role: string; // Ex: 'ADMIN', 'DRT'
  sub: number;
}

interface AuthContextType {
  user: UserPayload | null;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  isAuthenticated: false,
  loading: true 
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Captura o cookie definido no backend
    const token = Cookies.get('@ITP:token'); 

    if (token) {
      try {
        // 2. Decodifica o cargo (Role) do token
        const decoded = jwtDecode<UserPayload>(token);
        setUser(decoded);
      } catch (error) {
        console.error("Sessão inválida:", error);
        Cookies.remove('@ITP:token');
      }
    }
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook para facilitar o uso em outros componentes
export const useAuth = () => useContext(AuthContext);
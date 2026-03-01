'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, User, ArrowRight, Loader2 } from 'lucide-react';
import Cookies from 'js-cookie';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Captura para onde o usuário queria ir antes de ser barrado pelo middleware
  const callbackUrl = searchParams.get('callbackUrl') || '/academico';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // 1. Chamada para o seu NestJS (usando a variável de ambiente configurada na Vercel)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Falha na autenticação');
      }

      // 2. SALVAR TOKEN NOS COOKIES (Essencial para o Middleware)
      Cookies.set('@ITP:token', data.token, { 
        expires: 7, // 7 dias de login
        path: '/',
        sameSite: 'strict',
        secure: true // Sempre true pois o Vercel provê HTTPS
      });

      // 3. Redirecionar para a rota protegida
      router.push(callbackUrl);
      
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar com o servidor');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-purple-900 p-4 w-full">
      <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden p-10 border-b-8 border-yellow-500">
        
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black italic text-purple-900 tracking-tighter">
            ITP <span className="text-yellow-500">ERP</span>
          </h1>
          <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px] mt-3">
            Instituto Tia Pretinha
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border-l-4 border-rose-500 text-rose-600 text-xs font-bold uppercase animate-bounce">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-300" size={20} />
            <input 
              required
              type="email" 
              placeholder="E-mail Institucional"
              className="w-full pl-12 pr-4 py-5 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-yellow-500 focus:bg-white outline-none text-purple-900 font-bold transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-300" size={20} />
            <input 
              required
              type="password" 
              placeholder="Senha de Acesso"
              className="w-full pl-12 pr-4 py-5 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-yellow-500 focus:bg-white outline-none text-purple-900 font-bold transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full bg-purple-900 hover:bg-slate-900 disabled:bg-slate-300 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-purple-950/20 active:scale-95"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={24} />
            ) : (
              <>
                ENTRAR NO SISTEMA
                <ArrowRight size={20} strokeWidth={3} />
              </>
            )}
          </button>
        </form>

        <p className="text-center mt-8 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
          Acesso Restrito a Colaboradores
        </p>
      </div>
    </div>
  );
}
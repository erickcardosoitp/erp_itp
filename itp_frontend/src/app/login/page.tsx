'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Cookies from 'js-cookie';
import { 
  Lock, User, Loader2, 
  AlertCircle, ShieldCheck, Eye, EyeOff,
  ChevronRight, Sparkles
} from 'lucide-react';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api'}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', 
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(), 
          password: password.trim() 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Credenciais inválidas.');
      }

      // ✅ SALVAMENTO GARANTIDO: Captura o objeto 'user' ou 'usuario' da resposta
      const infoUsuario = data.usuario || data.user || data;
      if (infoUsuario) {
        const usuarioString = JSON.stringify(infoUsuario);
        // Persistência para o Frontend ler a Identidade Visual
        localStorage.setItem('usuario', usuarioString);
        Cookies.set('usuario', usuarioString, { expires: 7 });
      }

      // Pequeno delay para garantir que o navegador processe o localStorage antes de mudar de página
      setTimeout(() => {
        window.location.href = callbackUrl;
      }, 100);
      
    } catch (err: any) {
      setError(err.message || 'Erro de conexão com o servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-[#FDFDFF] flex items-center justify-center p-6 font-sans relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-100/50 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-100/50 rounded-full blur-[120px]" />

      <div className="w-full max-w-[480px] z-10">
        <div className="bg-white rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] overflow-hidden border border-slate-100">
          <div className="bg-slate-900 p-12 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 text-white">
              <ShieldCheck size={160} />
            </div>
            <div className="relative z-10 flex flex-col items-center">
              <div className="bg-purple-600 p-4 rounded-2xl shadow-xl mb-6">
                <Sparkles className="text-white" size={32} />
              </div>
              <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter">
                SISTEMA<span className="text-purple-500">.ITP</span>
              </h1>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-3 bg-white/5 px-4 py-1.5 rounded-full border border-white/10">
                Instituto Tia Pretinha
              </p>
            </div>
          </div>

          <div className="p-12 space-y-8">
            {error && (
              <div className="p-4 bg-rose-50 border-l-4 border-rose-500 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                <AlertCircle className="text-rose-500 shrink-0" size={20} />
                <p className="text-rose-700 text-[10px] font-black uppercase">{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">Usuário Administrativo</label>
                <div className="relative group">
                  <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-purple-600 transition-colors" size={20} />
                  <input 
                    type="email" 
                    placeholder="exemplo@itp.org"
                    className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-slate-50 rounded-[24px] outline-none focus:border-purple-600 focus:bg-white transition-all text-slate-900 font-bold"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">Senha de Acesso</label>
                <div className="relative group">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-purple-600 transition-colors" size={20} />
                  <input 
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full pl-14 pr-14 py-5 bg-slate-50 border-2 border-slate-50 rounded-[24px] outline-none focus:border-purple-600 focus:bg-white transition-all text-slate-900 font-bold"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-purple-600">
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isLoading} 
                className="w-full bg-purple-600 hover:bg-slate-900 text-white font-black py-5 rounded-[24px] flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-purple-600/20 uppercase text-xs tracking-widest group"
              >
                {isLoading ? <Loader2 className="animate-spin" size={24} /> : (
                  <>
                    Acessar Dashboard
                    <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform text-purple-300" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FDFDFF]" />}>
      <LoginForm />
    </Suspense>
  );
}
'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, User, ArrowRight, Loader2, AlertCircle, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import Cookies from 'js-cookie';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // Estado para o olho
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(), 
          password: password.trim() 
        }),
      });

      // Tratamento para evitar o erro "Unexpected end of JSON input"
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      if (!response.ok) {
        throw new Error(data.message || 'Credenciais inválidas. Verifique seus dados.');
      }

      if (data.access_token) {
        Cookies.set('@ITP:token', data.access_token, { 
          expires: 7, 
          path: '/',
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production' 
        });

        localStorage.setItem('@ITP:token', data.access_token);
        window.location.href = callbackUrl;
      }
      
    } catch (err: any) {
      console.error("Erro detalhado:", err);
      setError(err.message || 'Não foi possível conectar ao servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a1a2e] p-4 w-full selection:bg-yellow-500 selection:text-black">
      {/* Background Decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-yellow-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-[440px] z-10">
        <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border-b-[12px] border-yellow-500 transition-all">
          <div className="p-10 pt-12">
            {/* Logo Section */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-2xl mb-4 text-purple-900">
                <ShieldCheck size={32} />
              </div>
              <h1 className="text-4xl font-black text-purple-900 tracking-tight italic">
                ITP <span className="text-yellow-500 font-black">ERP</span>
              </h1>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="h-[1px] w-8 bg-slate-200"></span>
                <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Portal Administrativo</p>
                <span className="h-[1px] w-8 bg-slate-200"></span>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-rose-50 border-l-4 border-rose-500 text-rose-600 text-[12px] font-bold rounded-r-lg flex items-center gap-3 animate-shake">
                <AlertCircle size={18} /> {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Campo Email */}
              <div className="group relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-600 transition-colors" size={20} />
                <input 
                  required type="email" placeholder="E-mail institucional"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:border-purple-600 focus:bg-white outline-none text-purple-900 font-semibold transition-all placeholder:text-slate-400"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {/* Campo Senha com Botão de Mostrar */}
              <div className="group relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-600 transition-colors" size={20} />
                <input 
                  required 
                  type={showPassword ? "text" : "password"} 
                  placeholder="Sua senha"
                  className="w-full pl-12 pr-12 py-4 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:border-purple-600 focus:bg-white outline-none text-purple-900 font-semibold transition-all placeholder:text-slate-400"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-600 transition-colors"
                  title={showPassword ? "Esconder senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              <div className="flex justify-end pt-1">
                <button type="button" className="text-[11px] font-bold text-slate-400 hover:text-purple-600 transition-colors uppercase tracking-wider">Esqueceu a senha?</button>
              </div>

              <button 
                type="submit" disabled={isLoading}
                className="w-full bg-purple-900 hover:bg-slate-900 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-purple-900/20 disabled:opacity-70"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={24} />
                ) : (
                  <>ACESSAR DASHBOARD <ArrowRight size={20} className="text-yellow-500" /></>
                )}
              </button>
            </form>
          </div>
          
          <div className="bg-slate-50 p-6 text-center border-t border-slate-100">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              © 2026 Instituto Tia Pretinha • Sistema Integrado
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#1a1a2e]" />}>
      <LoginForm />
    </Suspense>
  );
}
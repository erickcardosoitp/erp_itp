'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Lock, User, ArrowRight, Loader2, AlertCircle, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import Cookies from 'js-cookie';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const isProd = process.env.NODE_ENV === 'production';
      
      /**
       * MODO ARQUITETURA:
       * Em produção na Vercel, usamos o subdomínio dedicado para a API.
       * Em desenvolvimento, apontamos para o NestJS rodando localmente na porta 3001.
       */
      const apiUrl = isProd 
        ? 'https://api.itp.institutotiapretinha.org' 
        : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
      
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(), 
          password: password.trim() 
        }),
      });

      // MODO DEBUG: Captura a resposta bruta para tratar erros de roteamento/infra
      const responseText = await response.text();
      let data;
      
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error("Resposta inválida do servidor:", responseText);
        throw new Error("A API retornou um formato inesperado. Verifique se o subdomínio está configurado na Vercel.");
      }

      if (!response.ok) {
        throw new Error(data.message || 'Credenciais inválidas. Verifique seus dados.');
      }

      if (data.access_token) {
        // Configuração idiomática de Cookies para Next.js na Vercel
        Cookies.set('@ITP:token', data.access_token, { 
          expires: 7, 
          path: '/',
          sameSite: 'lax',
          // Só força secure se estiver em HTTPS (Produção)
          secure: window.location.protocol === 'https:' 
        });

        // Sincronização com LocalStorage para persistência do lado do cliente
        localStorage.setItem('@ITP:token', data.access_token);
        
        // Redirecionamento forçado para limpar estados do middleware
        window.location.href = callbackUrl;
      }
      
    } catch (err: any) {
      console.error("Erro no fluxo de login:", err);
      setError(err.message || 'Erro de conexão: O serviço de autenticação está offline.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a1a2e] p-4 w-full">
      {/* Camada de Gradientes Decorativos */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-yellow-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-[440px] z-10">
        <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border-b-[12px] border-yellow-500 transition-all">
          <div className="p-10 pt-12">
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-2xl mb-4 text-purple-900">
                <ShieldCheck size={32} />
              </div>
              <h1 className="text-4xl font-black text-purple-900 italic tracking-tight">
                ITP <span className="text-yellow-500 font-black">ERP</span>
              </h1>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">Portal Administrativo</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-rose-50 border-l-4 border-rose-500 text-rose-600 text-[12px] font-bold rounded-r-lg flex items-center gap-3 animate-pulse">
                <AlertCircle size={18} /> {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="group relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-600 transition-colors" size={20} />
                <input 
                  required 
                  type="email" 
                  placeholder="E-mail institucional" 
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border-2 border-slate-100 outline-none focus:border-purple-600 focus:bg-white transition-all font-semibold text-purple-900" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                />
              </div>

              <div className="group relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-600 transition-colors" size={20} />
                <input 
                  required 
                  type={showPassword ? "text" : "password"} 
                  placeholder="Senha" 
                  className="w-full pl-12 pr-12 py-4 bg-slate-50 rounded-2xl border-2 border-slate-100 outline-none focus:border-purple-600 focus:bg-white transition-all font-semibold text-purple-900" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)} 
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              <button 
                type="submit" 
                disabled={isLoading} 
                className="w-full bg-purple-900 hover:bg-slate-900 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all disabled:opacity-70 active:scale-95 shadow-lg shadow-purple-900/20"
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
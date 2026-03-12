'use client';

import React, { useState, Suspense } from 'react';
import { Mail, Loader2, ShieldCheck, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';

function EsqueciSenhaForm() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErro('');
    try {
      const res = await fetch(`${API_BASE}/auth/esqueci-senha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro ao processar solicitação.');
      setEnviado(true);
    } catch (err: any) {
      setErro(err.message || 'Erro de conexão com o servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#FDFDFF] flex items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-100/50 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-100/50 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[460px] z-10">
        <div className="bg-white rounded-[28px] sm:rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] overflow-hidden border border-slate-100">

          {/* Header */}
          <div className="bg-slate-900 px-8 py-10 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10 rotate-12 text-white">
              <ShieldCheck size={120} />
            </div>
            <div className="relative z-10 flex flex-col items-center">
              <div className="bg-purple-600 p-3.5 rounded-2xl shadow-xl mb-5">
                <Mail className="text-white" size={26} />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white uppercase italic tracking-tighter">
                SISTEMA<span className="text-purple-500">.ITP</span>
              </h1>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.25em] mt-2 bg-white/5 px-4 py-1.5 rounded-full border border-white/10">
                Recuperação de Senha
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-8 sm:px-10 space-y-5">
            {!enviado ? (
              <>
                <p className="text-[13px] text-slate-500 leading-relaxed">
                  Informe o <strong>e-mail cadastrado</strong> na sua conta. Você receberá um link para criar uma nova senha.
                </p>

                {erro && (
                  <div className="p-3.5 bg-rose-50 border-l-4 border-rose-500 rounded-2xl flex items-center gap-3">
                    <AlertCircle className="text-rose-500 shrink-0" size={16} />
                    <p className="text-rose-700 text-[11px] font-bold">{erro}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">
                      E-mail da conta
                    </label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-purple-600 transition-colors" size={17} />
                      <input
                        type="email"
                        placeholder="exemplo@itp.org"
                        className="w-full pl-11 pr-4 py-4 bg-slate-50 border-2 border-slate-50 rounded-[20px] outline-none focus:border-purple-600 focus:bg-white transition-all text-slate-900 font-bold text-sm"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-purple-600 hover:bg-slate-900 text-white font-black py-4 rounded-[20px] flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-purple-600/20 uppercase text-xs tracking-widest"
                  >
                    {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Enviar Link de Recuperação'}
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-4 space-y-4">
                <div className="flex justify-center">
                  <div className="bg-green-100 p-4 rounded-full">
                    <CheckCircle className="text-green-600" size={36} />
                  </div>
                </div>
                <div>
                  <p className="text-base font-black text-slate-800">E-mail enviado!</p>
                  <p className="text-[13px] text-slate-500 mt-2 leading-relaxed">
                    Se o endereço <strong>{email}</strong> estiver cadastrado no sistema, você receberá as instruções em instantes.<br />
                    Verifique também a pasta de <strong>spam</strong>.
                  </p>
                </div>
                <p className="text-[11px] text-slate-400">O link expira em 1 hora.</p>
              </div>
            )}

            {/* Voltar ao login */}
            <div className="pt-2 border-t border-slate-100">
              <a href="/login" className="flex items-center justify-center gap-2 text-[12px] font-bold text-slate-400 hover:text-purple-600 transition-colors py-1">
                <ArrowLeft size={13} />
                Voltar para o Login
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EsqueciSenhaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FDFDFF]" />}>
      <EsqueciSenhaForm />
    </Suspense>
  );
}

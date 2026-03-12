'use client';

import React, { useState, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { Lock, Loader2, ShieldCheck, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';

function ResetSenhaForm() {
  const params = useParams();
  const token = Array.isArray(params?.token) ? params.token[0] : params?.token ?? '';

  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (senha.length < 6) {
      setErro('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (senha !== confirmar) {
      setErro('As senhas não coincidem.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/resetar-senha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, senha }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro ao redefinir senha.');
      setSucesso(true);
    } catch (err: any) {
      setErro(err.message || 'Erro de conexão com o servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const senhaForte = senha.length >= 6;
  const coincide = senha.length > 0 && senha === confirmar;

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
                <Lock className="text-white" size={26} />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white uppercase italic tracking-tighter">
                SISTEMA<span className="text-purple-500">.ITP</span>
              </h1>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.25em] mt-2 bg-white/5 px-4 py-1.5 rounded-full border border-white/10">
                Nova Senha
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-8 sm:px-10 space-y-5">
            {!sucesso ? (
              <>
                <p className="text-[13px] text-slate-500 leading-relaxed">
                  Crie uma <strong>nova senha</strong> para a sua conta. Use no mínimo 6 caracteres.
                </p>

                {erro && (
                  <div className="p-3.5 bg-rose-50 border-l-4 border-rose-500 rounded-2xl flex items-center gap-3">
                    <AlertCircle className="text-rose-500 shrink-0" size={16} />
                    <p className="text-rose-700 text-[11px] font-bold">{erro}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Nova senha */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">
                      Nova Senha
                    </label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-purple-600 transition-colors" size={17} />
                      <input
                        type={showSenha ? 'text' : 'password'}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full pl-11 pr-12 py-4 bg-slate-50 border-2 border-slate-50 rounded-[20px] outline-none focus:border-purple-600 focus:bg-white transition-all text-slate-900 font-bold text-sm"
                        value={senha}
                        onChange={e => setSenha(e.target.value)}
                        minLength={6}
                        required
                      />
                      <button type="button" onClick={() => setShowSenha(v => !v)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-purple-600 p-1 transition-colors">
                        {showSenha ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                    {senha.length > 0 && (
                      <p className={`text-[10px] ml-4 font-bold ${senhaForte ? 'text-green-600' : 'text-amber-500'}`}>
                        {senhaForte ? '✓ Senha válida' : `Ainda faltam ${6 - senha.length} caractere(s)`}
                      </p>
                    )}
                  </div>

                  {/* Confirmar senha */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">
                      Confirmar Nova Senha
                    </label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-purple-600 transition-colors" size={17} />
                      <input
                        type={showConfirmar ? 'text' : 'password'}
                        placeholder="Digite a senha novamente"
                        className="w-full pl-11 pr-12 py-4 bg-slate-50 border-2 border-slate-50 rounded-[20px] outline-none focus:border-purple-600 focus:bg-white transition-all text-slate-900 font-bold text-sm"
                        value={confirmar}
                        onChange={e => setConfirmar(e.target.value)}
                        required
                      />
                      <button type="button" onClick={() => setShowConfirmar(v => !v)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-purple-600 p-1 transition-colors">
                        {showConfirmar ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                    {confirmar.length > 0 && (
                      <p className={`text-[10px] ml-4 font-bold ${coincide ? 'text-green-600' : 'text-rose-500'}`}>
                        {coincide ? '✓ Senhas coincidem' : '✗ Senhas não coincidem'}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !senhaForte || !coincide}
                    className="w-full bg-purple-600 hover:bg-slate-900 text-white font-black py-4 rounded-[20px] flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-purple-600/20 uppercase text-xs tracking-widest disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  >
                    {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Redefinir Senha'}
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
                  <p className="text-base font-black text-slate-800">Senha redefinida!</p>
                  <p className="text-[13px] text-slate-500 mt-2 leading-relaxed">
                    Sua senha foi atualizada com sucesso. Você já pode fazer login com a nova senha.
                  </p>
                </div>
                <a href="/login"
                  className="inline-block bg-purple-600 hover:bg-slate-900 text-white font-black py-3.5 px-8 rounded-[20px] transition-all active:scale-[0.98] shadow-lg shadow-purple-600/20 uppercase text-xs tracking-widest mt-2">
                  Ir para o Login
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetSenhaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FDFDFF]" />}>
      <ResetSenhaForm />
    </Suspense>
  );
}

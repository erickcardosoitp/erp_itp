'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, CheckCircle2, XCircle, Loader2, ShieldCheck } from 'lucide-react';
import api from '@/services/api';

const CRITERIOS = [
  { label: 'Mínimo de 14 caracteres', test: (s: string) => s.length >= 14 },
  { label: 'Letra maiúscula (A-Z)', test: (s: string) => /[A-Z]/.test(s) },
  { label: 'Letra minúscula (a-z)', test: (s: string) => /[a-z]/.test(s) },
  { label: 'Número (0-9)', test: (s: string) => /[0-9]/.test(s) },
  { label: 'Símbolo especial (!@#$%...)', test: (s: string) => /[!@#$%^&*()\-_=+\[\]{};':",.<>/?\\|]/.test(s) },
];

export default function TrocarSenhaPage() {
  const router = useRouter();
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [showNova, setShowNova] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  const todosOK = CRITERIOS.every(c => c.test(novaSenha));
  const senhasIguais = novaSenha === confirmar && confirmar.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!todosOK) {
      setErro('A senha não atende todos os critérios de segurança.');
      return;
    }
    if (!senhasIguais) {
      setErro('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      await api.patch('/auth/trocar-senha', { nova_senha: novaSenha });
      setSucesso(true);
      setTimeout(() => router.push('/dashboard'), 2500);
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Erro ao atualizar a senha.');
    } finally {
      setLoading(false);
    }
  };

  if (sucesso) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 text-center max-w-sm w-full">
          <CheckCircle2 className="mx-auto text-green-500 mb-4" size={56} />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Senha atualizada!</h1>
          <p className="text-slate-500 text-sm">Redirecionando para o dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-red-600 px-8 py-6 text-center">
          <ShieldCheck className="mx-auto text-white mb-2" size={40} />
          <h1 className="text-2xl font-black text-white">Troca de Senha Obrigatória</h1>
          <p className="text-orange-100 text-sm mt-1">
            Sua conta requer a criação de uma nova senha segura.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
          {/* Nova senha */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Nova senha</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showNova ? 'text' : 'password'}
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
                placeholder="Digite a nova senha"
                className="w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                autoFocus
              />
              <button type="button" onClick={() => setShowNova(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showNova ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirmar senha */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Confirmar nova senha</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showConf ? 'text' : 'password'}
                value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
                placeholder="Repita a nova senha"
                className="w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <button type="button" onClick={() => setShowConf(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showConf ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Critérios de segurança */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Requisitos de segurança</p>
            {CRITERIOS.map(c => {
              const ok = c.test(novaSenha);
              return (
                <div key={c.label} className="flex items-center gap-2">
                  {ok
                    ? <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                    : <XCircle size={14} className="text-slate-300 shrink-0" />}
                  <span className={`text-xs ${ok ? 'text-green-700 font-medium' : 'text-slate-400'}`}>{c.label}</span>
                </div>
              );
            })}
            {confirmar.length > 0 && (
              <div className="flex items-center gap-2 pt-1 border-t border-slate-200 mt-1">
                {senhasIguais
                  ? <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                  : <XCircle size={14} className="text-red-400 shrink-0" />}
                <span className={`text-xs ${senhasIguais ? 'text-green-700 font-medium' : 'text-red-500'}`}>
                  As senhas coincidem
                </span>
              </div>
            )}
          </div>

          {erro && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-600 text-sm">
              <XCircle size={16} />
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !todosOK || !senhasIguais}
            className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-orange-600 to-red-600 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
            {loading ? 'Atualizando…' : 'Criar nova senha'}
          </button>
        </form>
      </div>
    </div>
  );
}

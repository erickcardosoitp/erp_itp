'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ScanLine, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import api from '@/services/api';

interface ResultadoCheckout {
  ok: boolean;
  ja_registrado?: boolean;
  hora_saida?: string;
  inscricao: {
    nome_completo: string;
    cuidado_especial?: string;
    equipe?: { nome: string; cor: string };
  };
}

type Estado = 'aguardando' | 'sucesso' | 'ja_registrado' | 'erro';

export default function CheckoutPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [codigo, setCodigo] = useState('');
  const [estado, setEstado] = useState<Estado>('aguardando');
  const [resultado, setResultado] = useState<ResultadoCheckout | null>(null);
  const [erroMsg, setErroMsg] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Foca o input automaticamente
  useEffect(() => {
    inputRef.current?.focus();
  }, [estado]);

  const resetar = () => {
    setCodigo('');
    setEstado('aguardando');
    setResultado(null);
    setErroMsg('');
    inputRef.current?.focus();
  };

  const processar = async (id: string) => {
    if (!id.trim()) return;
    try {
      const r = await api.get(`/projetos/checkout/${id.trim()}`);
      setResultado(r.data);
      setEstado(r.data.ja_registrado ? 'ja_registrado' : 'sucesso');
    } catch (err: any) {
      setErroMsg(err?.response?.data?.message || 'Código não encontrado ou sem presença hoje.');
      setEstado('erro');
    }

    // Volta ao estado inicial após 4s
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(resetar, 4000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      processar(codigo);
      setCodigo('');
    }
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const bgClass = {
    aguardando:    'bg-slate-900',
    sucesso:       'bg-green-900',
    ja_registrado: 'bg-amber-900',
    erro:          'bg-red-900',
  }[estado];

  return (
    <div className={`min-h-screen ${bgClass} flex flex-col items-center justify-center p-6 transition-colors duration-300`}
      onClick={() => inputRef.current?.focus()}>

      {/* Input oculto do scanner */}
      <input
        ref={inputRef}
        value={codigo}
        onChange={e => setCodigo(e.target.value)}
        onKeyDown={handleKeyDown}
        className="opacity-0 absolute pointer-events-none"
        autoFocus
        autoComplete="off"
      />

      {/* Estado: Aguardando */}
      {estado === 'aguardando' && (
        <div className="text-center space-y-6">
          <div className="w-24 h-24 rounded-3xl bg-white/10 flex items-center justify-center mx-auto">
            <ScanLine size={48} className="text-white/60"/>
          </div>
          <div>
            <h1 className="text-white font-black text-3xl tracking-tight">Check-out</h1>
            <p className="text-white/50 text-sm mt-2">Passe o leitor na pulseira do participante</p>
          </div>
          <div className="text-white/30 text-xs font-mono">
            {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      )}

      {/* Estado: Sucesso */}
      {(estado === 'sucesso' || estado === 'ja_registrado') && resultado && (
        <div className="text-center space-y-5 max-w-sm w-full">
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto
            ${estado === 'sucesso' ? 'bg-green-500' : 'bg-amber-500'}`}>
            {estado === 'sucesso'
              ? <CheckCircle size={40} className="text-white"/>
              : <Clock size={40} className="text-white"/>
            }
          </div>

          <div className={`rounded-3xl p-6 space-y-3 ${estado === 'sucesso' ? 'bg-green-800/50' : 'bg-amber-800/50'}`}>
            {resultado.inscricao.equipe && (
              <span className="inline-block text-xs font-black px-3 py-1 rounded-full text-white"
                style={{ background: resultado.inscricao.equipe.cor }}>
                {resultado.inscricao.equipe.nome}
              </span>
            )}
            <h2 className="text-white font-black text-2xl leading-tight">
              {resultado.inscricao.nome_completo}
            </h2>
            {resultado.inscricao.cuidado_especial && resultado.inscricao.cuidado_especial !== 'Não' && (
              <div className="flex items-center justify-center gap-1.5 bg-red-500/30 rounded-xl px-3 py-2">
                <AlertCircle size={14} className="text-red-300"/>
                <span className="text-red-200 text-xs font-bold">{resultado.inscricao.cuidado_especial}</span>
              </div>
            )}
            <p className="text-white/60 text-sm">
              {estado === 'sucesso'
                ? `Saída registrada às ${resultado.hora_saida?.slice(0, 5)}`
                : 'Saída já havia sido registrada'
              }
            </p>
          </div>

          <p className="text-white/30 text-xs">Voltando em instantes...</p>
        </div>
      )}

      {/* Estado: Erro */}
      {estado === 'erro' && (
        <div className="text-center space-y-5 max-w-sm w-full">
          <div className="w-20 h-20 rounded-3xl bg-red-500 flex items-center justify-center mx-auto">
            <AlertCircle size={40} className="text-white"/>
          </div>
          <div className="bg-red-800/50 rounded-3xl p-6 space-y-2">
            <h2 className="text-white font-black text-xl">Não encontrado</h2>
            <p className="text-red-200 text-sm">{erroMsg}</p>
          </div>
          <p className="text-white/30 text-xs">Voltando em instantes...</p>
        </div>
      )}
    </div>
  );
}

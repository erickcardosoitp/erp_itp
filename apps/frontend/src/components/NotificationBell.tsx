'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Bell, Package, Heart, DollarSign, UserPlus, ClipboardList, Info, Check, Trash2, X } from 'lucide-react';
import api from '@/services/api';

function tempoRelativo(dataStr: string): string {
  const diff = Date.now() - new Date(dataStr).getTime();
  const seg = Math.floor(diff / 1000);
  if (seg < 60) return 'agora mesmo';
  const min = Math.floor(seg / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d} dia${d > 1 ? 's' : ''}`;
  const m = Math.floor(d / 30);
  return `há ${m} mes${m > 1 ? 'es' : ''}`;
}

interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  criado_em: string;
  referencia_id?: string;
  referencia_tipo?: string;
}

const TIPO_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  estoque_minimo:  { icon: Package,       color: 'text-orange-500' },
  nova_doacao:     { icon: Heart,         color: 'text-pink-500' },
  pix_recebido:    { icon: DollarSign,    color: 'text-green-500' },
  novo_aluno:      { icon: UserPlus,      color: 'text-blue-500' },
  nova_matricula:  { icon: ClipboardList, color: 'text-purple-500' },
  presenca_pendente: { icon: Bell,        color: 'text-yellow-500' },
  sistema:         { icon: Info,          color: 'text-slate-500' },
};

export default function NotificationBell() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [totalNaoLidas, setTotalNaoLidas] = useState(0);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const carregarContagem = useCallback(async () => {
    try {
      const { data } = await api.get<{ total: number }>('/notificacoes/count');
      setTotalNaoLidas(data.total);
    } catch {
      // silencia erros de rede
    }
  }, []);

  const carregarNotificacoes = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get<Notificacao[]>('/notificacoes?limite=10');
      setNotificacoes(data);
    } catch {
      // silencia erros de rede
    } finally {
      setCarregando(false);
    }
  }, []);

  // Polling a cada 30s para atualizar badge
  useEffect(() => {
    carregarContagem();
    const timer = setInterval(carregarContagem, 30_000);
    return () => clearInterval(timer);
  }, [carregarContagem]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = () => {
    if (!aberto) carregarNotificacoes();
    setAberto(prev => !prev);
  };

  const marcarLida = async (id: string) => {
    try {
      await api.patch(`/notificacoes/${id}/lida`);
      setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
      setTotalNaoLidas(prev => Math.max(0, prev - 1));
    } catch {/* silencia */}
  };

  const marcarTodasLidas = async () => {
    try {
      await api.patch('/notificacoes/todas-lidas');
      setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
      setTotalNaoLidas(0);
    } catch {/* silencia */}
  };

  const deletar = async (id: string) => {
    try {
      await api.delete(`/notificacoes/${id}`);
      const notif = notificacoes.find(n => n.id === id);
      setNotificacoes(prev => prev.filter(n => n.id !== id));
      if (notif && !notif.lida) setTotalNaoLidas(prev => Math.max(0, prev - 1));
    } catch {/* silencia */}
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botão sino */}
      <button
        onClick={toggleDropdown}
        className="relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
        aria-label="Notificações"
      >
        <Bell size={22} className="text-slate-600 dark:text-slate-300" />
        {totalNaoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-purple-600 text-white text-[10px] font-black rounded-full flex items-center justify-center px-0.5 leading-none">
            {totalNaoLidas > 99 ? '99+' : totalNaoLidas}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {aberto && (
        <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <span className="font-black text-sm text-slate-900 dark:text-slate-100 uppercase tracking-widest">
              Notificações {totalNaoLidas > 0 && <span className="text-purple-600">({totalNaoLidas})</span>}
            </span>
            <div className="flex items-center gap-2">
              {totalNaoLidas > 0 && (
                <button
                  onClick={marcarTodasLidas}
                  className="text-[11px] font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1"
                  title="Marcar todas como lidas"
                >
                  <Check size={13} /> Todas lidas
                </button>
              )}
              <button onClick={() => setAberto(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {carregando && (
              <div className="flex items-center justify-center h-24 text-slate-400 text-sm">
                Carregando...
              </div>
            )}
            {!carregando && notificacoes.length === 0 && (
              <div className="flex flex-col items-center justify-center h-24 text-slate-400 gap-1">
                <Bell size={22} className="opacity-30" />
                <span className="text-xs">Nenhuma notificação</span>
              </div>
            )}
            {!carregando && notificacoes.map(n => {
              const cfg = TIPO_CONFIG[n.tipo] ?? TIPO_CONFIG.sistema;
              const Icon = cfg.icon;
              const tempo = tempoRelativo(n.criado_em);

              return (
                <div
                  key={n.id}
                  className={`flex gap-3 px-4 py-3 group transition-colors cursor-pointer ${
                    n.lida ? 'opacity-60' : 'bg-purple-50/40 dark:bg-purple-900/10'
                  } hover:bg-slate-50 dark:hover:bg-slate-800/60`}
                  onClick={() => !n.lida && marcarLida(n.id)}
                >
                  <div className={`mt-0.5 shrink-0 ${cfg.color}`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold leading-snug ${n.lida ? 'text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>
                      {n.titulo}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{n.mensagem}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{tempo}</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deletar(n.id); }}
                    className="opacity-0 group-hover:opacity-100 shrink-0 text-slate-300 hover:text-red-400 transition-all"
                    title="Remover"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 text-center">
            <Link
              href="/notificacoes"
              onClick={() => setAberto(false)}
              className="text-[11px] font-black text-purple-600 hover:text-purple-800 uppercase tracking-widest"
            >
              Ver todas as notificações →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

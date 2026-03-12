'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, Package, Heart, DollarSign, UserPlus, ClipboardList,
  Info, Check, Trash2, RefreshCw, Filter,
} from 'lucide-react';
import api from '@/services/api';

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

const TIPO_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  estoque_minimo:    { icon: Package,       color: 'text-orange-500',  label: 'Estoque Mínimo' },
  nova_doacao:       { icon: Heart,         color: 'text-pink-500',    label: 'Nova Doação' },
  pix_recebido:      { icon: DollarSign,    color: 'text-green-500',   label: 'PIX Recebido' },
  novo_aluno:        { icon: UserPlus,      color: 'text-blue-500',    label: 'Novo Aluno' },
  nova_matricula:    { icon: ClipboardList, color: 'text-purple-500',  label: 'Nova Matrícula' },
  presenca_pendente: { icon: Bell,          color: 'text-yellow-500',  label: 'Presença Pendente' },
  sistema:           { icon: Info,          color: 'text-slate-400',   label: 'Sistema' },
};

const TODOS_TIPOS = ['todos', 'nao_lidas', ...Object.keys(TIPO_CONFIG)];

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

export default function NotificacoesPage() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [filtro, setFiltro] = useState('todos');
  const [carregando, setCarregando] = useState(true);
  const [totalNaoLidas, setTotalNaoLidas] = useState(0);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get<Notificacao[]>('/notificacoes?limite=100');
      setNotificacoes(data);
      setTotalNaoLidas(data.filter(n => !n.lida).length);
    } catch {
      /* silencia erros de rede */
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

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

  const deletarLidas = async () => {
    if (!confirm('Excluir todas as notificações lidas?')) return;
    try {
      await api.delete('/notificacoes/lidas');
      setNotificacoes(prev => prev.filter(n => !n.lida));
    } catch {/* silencia */}
  };

  const filtradas = notificacoes.filter(n => {
    if (filtro === 'todos') return true;
    if (filtro === 'nao_lidas') return !n.lida;
    return n.tipo === filtro;
  });

  const contaPorTipo = (tipo: string) => {
    if (tipo === 'todos') return notificacoes.length;
    if (tipo === 'nao_lidas') return totalNaoLidas;
    return notificacoes.filter(n => n.tipo === tipo).length;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 uppercase italic tracking-tight flex items-center gap-2">
              <Bell size={24} className="text-purple-600" />
              Notificações
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
              {totalNaoLidas > 0
                ? `${totalNaoLidas} não lida${totalNaoLidas > 1 ? 's' : ''}`
                : 'Todas as notificações em dia'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={carregar}
              className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw size={14} /> Atualizar
            </button>
            {totalNaoLidas > 0 && (
              <button
                onClick={marcarTodasLidas}
                className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-purple-600 border border-purple-200 dark:border-purple-800 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
              >
                <Check size={14} /> Marcar todas lidas
              </button>
            )}
            <button
              onClick={deletarLidas}
              className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-500 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 size={14} /> Excluir lidas
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 flex-wrap items-center">
          <Filter size={14} className="text-slate-400" />
          {[
            { value: 'todos', label: 'Todas' },
            { value: 'nao_lidas', label: 'Não lidas' },
            ...Object.entries(TIPO_CONFIG).map(([k, v]) => ({ value: k, label: v.label })),
          ].map(tab => {
            const count = contaPorTipo(tab.value);
            if (count === 0 && tab.value !== 'todos' && tab.value !== 'nao_lidas') return null;
            return (
              <button
                key={tab.value}
                onClick={() => setFiltro(tab.value)}
                className={`px-3 py-1.5 text-[11px] font-black rounded-lg uppercase tracking-wider transition-colors ${
                  filtro === tab.value
                    ? 'bg-purple-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-purple-300'
                }`}
              >
                {tab.label} {count > 0 && <span className="opacity-70">({count})</span>}
              </button>
            );
          })}
        </div>

        {/* Lista */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          {carregando && (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
              Carregando...
            </div>
          )}

          {!carregando && filtradas.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
              <Bell size={28} className="opacity-30" />
              <span className="text-sm">Nenhuma notificação encontrada</span>
            </div>
          )}

          {!carregando && filtradas.map((n, idx) => {
            const cfg = TIPO_CONFIG[n.tipo] ?? TIPO_CONFIG.sistema;
            const Icon = cfg.icon;

            return (
              <div
                key={n.id}
                className={`flex gap-4 px-5 py-4 group transition-colors border-b border-slate-100 dark:border-slate-800 last:border-b-0 ${
                  n.lida ? '' : 'bg-purple-50/30 dark:bg-purple-900/10'
                } hover:bg-slate-50 dark:hover:bg-slate-800/60`}
              >
                {/* Ícone */}
                <div className={`mt-1 shrink-0 ${cfg.color}`}>
                  <Icon size={20} />
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-bold leading-snug ${n.lida ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>
                      {n.titulo}
                    </p>
                    {!n.lida && (
                      <span className="shrink-0 w-2 h-2 mt-1.5 rounded-full bg-purple-600" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{n.mensagem}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] text-slate-400">{tempoRelativo(n.criado_em)}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.color} bg-current/5`} style={{ backgroundColor: 'rgba(0,0,0,0.04)' }}>
                      {cfg.label}
                    </span>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {!n.lida && (
                    <button
                      onClick={() => marcarLida(n.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                      title="Marcar como lida"
                    >
                      <Check size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => deletar(n.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

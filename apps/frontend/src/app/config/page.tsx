'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { toast } from 'sonner';
import {
  User, Camera, Save, Loader2, Settings2,
  Palette, ShieldCheck, Moon, Sun,
  ChevronDown, Check, Lock,
  Server, Database, Cpu, Activity, RefreshCw, Wifi, HardDrive, Zap,
} from 'lucide-react';
import { useTheme } from 'next-themes';

import api from '@/services/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/hooks/use-permissions';

// --- HELPERS ---
const getInitials = (name = '') => {
  if (!name) return '';
  const names = name.split(' ');
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  return `${names[0].charAt(0)}${names[names.length - 1].charAt(0)}`.toUpperCase();
};

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  ADMIN:           { label: 'Administrador',    color: 'bg-purple-100 text-purple-700 border-purple-200' },
  DIRETOR:         { label: 'Diretor',           color: 'bg-blue-100 text-blue-700 border-blue-200' },
  PRESIDENTE:      { label: 'Presidente',        color: 'bg-amber-100 text-amber-700 border-amber-200' },
  VICE_PRESIDENTE: { label: 'Vice-Presidente',   color: 'bg-amber-50 text-amber-600 border-amber-100' },
  PROFESSOR:       { label: 'Professor',         color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  COORDENADOR:     { label: 'Coordenador',       color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  ALUNO:           { label: 'Aluno',             color: 'bg-slate-100 text-slate-600 border-slate-200' },
};

// --- TIPOS ---
type TabId = 'perfil' | 'acessibilidade' | 'gestao' | 'monitoramento-ti';

// ─────────────────────────────────────────────────────────────
// ABA: MEU PERFIL
// ─────────────────────────────────────────────────────────────
function MeuPerfilTab() {
  const { user, setUser } = useAuth();
  const [nome, setNome] = useState('');
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const buildFotoUrl = (fotoUrl?: string) => {
    if (!fotoUrl) return null;
    if (fotoUrl.startsWith('http')) return fotoUrl;
    // Caminhos relativos (/uploads/...) são servidos pelo proxy do Next.js
    return fotoUrl;
  };

  useEffect(() => {
    if (user) {
      setNome(user.nome || '');
      setFotoPreview(buildFotoUrl(user.fotoUrl));
    }
  }, [user]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setFotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSaveChanges = async () => {
    if (!user) return;
    setIsSaving(true);
    const formData = new FormData();
    formData.append('nome', nome);
    formData.append('email', user.email);
    if (fotoFile) formData.append('foto', fotoFile);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/usuarios/perfil`, {
        method: 'PATCH',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Falha ao atualizar o perfil.');
      const updatedUser = await response.json();
      setUser(updatedUser);
      toast.success('Perfil atualizado com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Ocorreu um erro.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  const roleInfo = ROLE_LABELS[user.role] ?? { label: user.role, color: 'bg-slate-100 text-slate-600 border-slate-200' };

  return (
    <div className="space-y-8">
      {/* Cabeçalho da seção */}
      <div className="flex items-center gap-3 pb-6 border-b border-slate-100">
        <div className="bg-purple-600 p-2.5 rounded-xl shadow-lg shadow-purple-500/20">
          <User size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-sm font-black uppercase tracking-tighter text-slate-900">Edição de Perfil</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Dados pessoais e foto de exibição</p>
        </div>
      </div>

      {/* Card de identidade */}
      <div className="bg-slate-50 rounded-[28px] p-6 border border-slate-100 flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <div className="relative flex-shrink-0">
          <Avatar className="h-28 w-28 border-4 border-white shadow-xl ring-2 ring-purple-100">
            <AvatarImage src={fotoPreview || ''} alt={user.nome} />
            <AvatarFallback className="text-3xl font-black bg-purple-900 text-yellow-400">
              {getInitials(user.nome)}
            </AvatarFallback>
          </Avatar>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-2 -right-2 bg-yellow-400 text-purple-950 rounded-full p-2.5 hover:bg-yellow-300 transition-all active:scale-90 shadow-lg border-2 border-white font-black"
            title="Alterar foto"
          >
            <Camera size={15} />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/png, image/jpeg, image/gif"
          />
        </div>

        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-900">{user.nome}</h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">{user.email}</p>
          <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
            <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-lg border ${roleInfo.color}`}>
              {roleInfo.label}
            </span>
            <span className="text-[9px] font-black uppercase px-3 py-1 rounded-lg border bg-slate-100 text-slate-500 border-slate-200">
              Instituto Tia Pretinha
            </span>
          </div>
        </div>
      </div>

      {/* Campos editáveis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome Completo</label>
          <Input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome completo"
            className="bg-slate-50 border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">E-mail</label>
          <Input
            value={user.email}
            disabled
            className="bg-slate-100 border-slate-200 rounded-xl font-bold text-slate-400 cursor-not-allowed"
          />
        </div>
      </div>

      {/* Ação */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSaveChanges}
          disabled={isSaving}
          className="bg-yellow-400 text-purple-950 px-8 py-4 rounded-2xl font-black text-[11px] uppercase flex items-center gap-3 hover:bg-yellow-300 transition-all shadow-xl shadow-yellow-500/20 border-b-4 border-yellow-600 active:translate-y-1 active:border-b-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:translate-y-0"
        >
          {isSaving
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
            : <><Save size={16} strokeWidth={3} /> Salvar Alterações</>
          }
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ABA: ACESSIBILIDADE
// ─────────────────────────────────────────────────────────────
const FONT_SIZES = [
  { value: 'sm', label: 'Pequeno' },
  { value: 'base', label: 'Normal' },
  { value: 'lg', label: 'Grande' },
] as const;

type FontSize = typeof FONT_SIZES[number]['value'];

function applySettings(fontSize: FontSize, reducedMotion: boolean, compact: boolean) {
  const root = document.documentElement;
  root.classList.remove('font-size-sm', 'font-size-base', 'font-size-lg');
  root.classList.add(`font-size-${fontSize}`);
  root.classList.toggle('reduce-motion', reducedMotion);
  root.classList.toggle('compact', compact);
}

function AcessibilidadeTab() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  const [fontSize, setFontSize]         = React.useState<FontSize>('base');
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const [compact, setCompact]           = React.useState(false);

  // Carregar preferências salvas
  React.useEffect(() => {
    const fs = (localStorage.getItem('itp_font_size') as FontSize) || 'base';
    const rm = localStorage.getItem('itp_reduce_motion') === 'true';
    const cp = localStorage.getItem('itp_compact') === 'true';
    setFontSize(fs);
    setReducedMotion(rm);
    setCompact(cp);
    applySettings(fs, rm, cp);
  }, []);

  const handleFontSize = (v: FontSize) => {
    setFontSize(v);
    localStorage.setItem('itp_font_size', v);
    applySettings(v, reducedMotion, compact);
  };

  const handleReducedMotion = (v: boolean) => {
    setReducedMotion(v);
    localStorage.setItem('itp_reduce_motion', String(v));
    applySettings(fontSize, v, compact);
  };

  const handleCompact = (v: boolean) => {
    setCompact(v);
    localStorage.setItem('itp_compact', String(v));
    applySettings(fontSize, reducedMotion, v);
  };

  return (
    <div className="space-y-8">
      {/* Cabeçalho da seção */}
      <div className="flex items-center gap-3 pb-6 border-b border-slate-100">
        <div className="bg-purple-600 p-2.5 rounded-xl shadow-lg shadow-purple-500/20">
          <Palette size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-sm font-black uppercase tracking-tighter text-slate-900">Acessibilidade</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Visualização e preferências de interface</p>
        </div>
      </div>

      {/* Seletor de Tema */}
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Tema de Cores</p>
        <div className="flex items-center gap-4 bg-slate-100 p-1.5 rounded-2xl w-fit">
          <button
            onClick={() => setTheme('light')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-[11px] uppercase tracking-tighter transition-all duration-200 ${
              !isDark
                ? 'bg-white text-slate-900 shadow-md'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Sun size={16} />
            Claro
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-[11px] uppercase tracking-tighter transition-all duration-200 ${
              isDark
                ? 'bg-purple-950 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Moon size={16} />
            Escuro
          </button>
        </div>
      </div>

      {/* Tamanho da Fonte */}
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Tamanho da Fonte</p>
        <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl w-fit">
          {FONT_SIZES.map(fs => (
            <button
              key={fs.value}
              onClick={() => handleFontSize(fs.value)}
              className={`px-5 py-3 rounded-xl font-black text-[11px] uppercase tracking-tighter transition-all duration-200 ${
                fontSize === fs.value
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {fs.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Mais Opções</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Reduzir Animações */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div>
              <p className="text-xs font-black uppercase tracking-tighter text-slate-700">Reduzir Animações</p>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5">Diminui efeitos de movimento da interface.</p>
            </div>
            <button
              onClick={() => handleReducedMotion(!reducedMotion)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0 ${
                reducedMotion ? 'bg-purple-600' : 'bg-slate-300'
              }`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                reducedMotion ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          </div>
          {/* Compactar Layout */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div>
              <p className="text-xs font-black uppercase tracking-tighter text-slate-700">Compactar Layout</p>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5">Exibe mais informações com menos espaçamento.</p>
            </div>
            <button
              onClick={() => handleCompact(!compact)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0 ${
                compact ? 'bg-purple-600' : 'bg-slate-300'
              }`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                compact ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ABA: GESTÃO DE ACESSO
// ─────────────────────────────────────────────────────────────
const MODULOS_SISTEMA = [
  { key: 'dashboard',       label: 'Dashboard' },
  { key: 'cadastro_basico', label: 'Cadastro Básico' },
  { key: 'matriculas',      label: 'Matrículas' },
  { key: 'academico',       label: 'Acadêmico' },
  { key: 'financeiro',      label: 'Financeiro' },
  { key: 'doacoes',         label: 'Doações' },
  { key: 'estoque',         label: 'Estoque' },
  { key: 'gente',           label: 'Gente' },
  { key: 'relatorios',      label: 'Relatórios' },
];

const ACOES_PERM = [
  { key: 'visualizar', label: 'Visualizar' },
  { key: 'incluir',    label: 'Incluir' },
  { key: 'editar',     label: 'Editar' },
  { key: 'excluir',    label: 'Excluir' },
];

interface GrupoGA {
  id: string;
  nome: string;
  grupo_permissoes: any;
  usuarios?: { id: string; nome: string }[];
}

function GestaoAcessoTab() {
  const [grupos, setGrupos] = useState<GrupoGA[]>([]);
  const [loading, setLoading] = useState(true);
  const [grupoSelecionado, setGrupoSelecionado] = useState<GrupoGA | null>(null);
  const [permissoes, setPermissoes] = useState<Record<string, Record<string, boolean>>>({});
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await api.get('/grupos');
        setGrupos(r.data);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const isAdmin = (nome: string) => nome.toUpperCase() === 'ADMIN';

  const selecionarGrupo = (g: GrupoGA) => {
    setGrupoSelecionado(g);
    setMensagem(null);
    if (isAdmin(g.nome)) {
      // ADMIN tem tudo
      const all: Record<string, Record<string, boolean>> = {};
      MODULOS_SISTEMA.forEach(m => { all[m.key] = { visualizar: true, incluir: true, editar: true, excluir: true }; });
      setPermissoes(all);
      return;
    }
    // Carrega permissões existentes
    const gp = g.grupo_permissoes || {};
    const permsExistentes = gp.permissoes || {};
    const modulosVisiveis = gp.modulos_visiveis || {};
    const result: Record<string, Record<string, boolean>> = {};
    MODULOS_SISTEMA.forEach(m => {
      const visivel = !!modulosVisiveis[m.key];
      const p = permsExistentes[m.key] || {};
      result[m.key] = {
        visualizar: visivel || !!p.visualizar,
        incluir:    !!p.incluir,
        editar:     !!p.editar,
        excluir:    !!p.excluir,
      };
    });
    setPermissoes(result);
  };

  const togglePerm = (modulo: string, acao: string) => {
    if (grupoSelecionado && isAdmin(grupoSelecionado.nome)) return;
    setPermissoes(prev => {
      const modPerms = { ...(prev[modulo] || {}) };
      modPerms[acao] = !modPerms[acao];
      // Se visualizar é desmarcado, remove todas as outras
      if (acao === 'visualizar' && !modPerms[acao]) {
        modPerms.incluir = false;
        modPerms.editar = false;
        modPerms.excluir = false;
      }
      // Se marca incluir/editar/excluir, visualizar deve estar ativo
      if (acao !== 'visualizar' && modPerms[acao]) {
        modPerms.visualizar = true;
      }
      return { ...prev, [modulo]: modPerms };
    });
  };

  const handleSalvar = async () => {
    if (!grupoSelecionado || isAdmin(grupoSelecionado.nome)) return;
    setSalvando(true); setMensagem(null);
    try {
      const gp = grupoSelecionado.grupo_permissoes || {};
      const modulosVisiveis = gp.modulos_visiveis || {};
      // Sincroniza: se visualizar está ativo, garante que modulos_visiveis também está
      const mvAtualizado = { ...modulosVisiveis };
      MODULOS_SISTEMA.forEach(m => {
        if (permissoes[m.key]?.visualizar) mvAtualizado[m.key] = true;
      });
      const payload = {
        grupo_permissoes: {
          modulos_visiveis: mvAtualizado,
          permissoes: permissoes,
        },
      };
      await api.patch(`/grupos/${grupoSelecionado.id}`, payload);
      // Atualiza local
      setGrupos(prev => prev.map(g => g.id === grupoSelecionado.id
        ? { ...g, grupo_permissoes: payload.grupo_permissoes }
        : g
      ));
      setGrupoSelecionado({ ...grupoSelecionado, grupo_permissoes: payload.grupo_permissoes });
      setMensagem({ tipo: 'ok', texto: `Permissões de "${grupoSelecionado.nome}" salvas com sucesso.` });
    } catch (e: any) {
      setMensagem({ tipo: 'erro', texto: e.response?.data?.message || 'Erro ao salvar permissões.' });
    }
    setSalvando(false);
  };

  const modulosVisiveis = (g: GrupoGA) => {
    if (isAdmin(g.nome)) return MODULOS_SISTEMA;
    const gp = g.grupo_permissoes || {};
    const mv = gp.modulos_visiveis || {};
    return MODULOS_SISTEMA.filter(m => mv[m.key]);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3 pb-6 border-b border-slate-100 dark:border-slate-700">
        <div className="bg-purple-600 p-2.5 rounded-xl shadow-lg shadow-purple-500/20">
          <ShieldCheck size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-sm font-black uppercase tracking-tighter text-slate-900 dark:text-slate-100">Gestão de Acesso</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Permissões granulares por grupo de usuário</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-purple-600" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
          {/* Lista de Grupos */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Selecione o Grupo</p>
            {grupos.map(g => {
              const isSelected = grupoSelecionado?.id === g.id;
              const mvCount = modulosVisiveis(g).length;
              return (
                <button
                  key={g.id}
                  onClick={() => selecionarGrupo(g)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 ${
                    isSelected
                      ? 'bg-purple-950 border-purple-950 text-white shadow-xl shadow-purple-900/20'
                      : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-purple-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black ${
                        isSelected ? 'bg-purple-600 text-white' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      }`}>
                        {g.nome.slice(0, 2)}
                      </div>
                      <div>
                        <p className={`text-xs font-black uppercase tracking-tight ${isSelected ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>{g.nome}</p>
                        <p className={`text-[9px] font-bold ${isSelected ? 'text-purple-300' : 'text-slate-400'}`}>
                          {g.usuarios?.length ?? 0} usuário(s) · {mvCount} módulo(s)
                        </p>
                      </div>
                    </div>
                    {isAdmin(g.nome) && <Lock size={12} className={isSelected ? 'text-yellow-400' : 'text-slate-300'} />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Painel de Permissões */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-700 p-6">
            {!grupoSelecionado ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ShieldCheck size={40} className="text-slate-200 dark:text-slate-600 mb-4" />
                <p className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-tight">Selecione um grupo</p>
                <p className="text-[10px] font-bold text-slate-300 dark:text-slate-600 mt-1">Clique em um grupo à esquerda para configurar as permissões</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                      Permissões — {grupoSelecionado.nome}
                    </h3>
                    {isAdmin(grupoSelecionado.nome) && (
                      <p className="text-[9px] font-bold text-amber-600 mt-1 flex items-center gap-1">
                        <Lock size={10} /> ADMIN possui acesso total a todas as funcionalidades
                      </p>
                    )}
                  </div>
                </div>

                {mensagem && (
                  <div className={`flex items-start gap-2 rounded-xl p-3 border text-xs font-semibold ${
                    mensagem.tipo === 'ok'
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                  }`}>
                    {mensagem.tipo === 'ok' ? <Check size={14} className="mt-0.5 shrink-0" /> : null}
                    {mensagem.texto}
                  </div>
                )}

                {/* Tabela de Permissões */}
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-600">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-white dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
                        <th className="text-left px-5 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">Módulo</th>
                        {ACOES_PERM.map(a => (
                          <th key={a.key} className="text-center px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">{a.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-600">
                      {MODULOS_SISTEMA.map(m => {
                        const modPerms = permissoes[m.key] || {};
                        const isDisabled = isAdmin(grupoSelecionado.nome);
                        return (
                          <tr key={m.key} className="bg-white dark:bg-slate-800 hover:bg-purple-50/30 dark:hover:bg-purple-900/10 transition-colors">
                            <td className="px-5 py-3">
                              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{m.label}</span>
                            </td>
                            {ACOES_PERM.map(a => (
                              <td key={a.key} className="text-center px-4 py-3">
                                <label className="inline-flex items-center justify-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!!modPerms[a.key]}
                                    onChange={() => togglePerm(m.key, a.key)}
                                    disabled={isDisabled}
                                    className={`w-4 h-4 rounded accent-purple-600 ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                                  />
                                </label>
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <p className="text-[9px] text-slate-400 font-semibold">
                  Ao marcar <strong>Incluir</strong>, <strong>Editar</strong> ou <strong>Excluir</strong>, a permissão de <strong>Visualizar</strong> é habilitada automaticamente.
                </p>

                {!isAdmin(grupoSelecionado.nome) && (
                  <button
                    onClick={handleSalvar}
                    disabled={salvando}
                    className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-wider transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {salvando ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : <><Save size={14} /> Salvar Permissões</>}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ABA: MONITORAMENTO TI
// ─────────────────────────────────────────────────────────────
interface TIData {
  servidor: {
    uptime_segundos: number;
    node_version: string;
    ambiente: string;
    plataforma: string;
    arquitetura: string;
    memoria: { heap_usado_mb: number; heap_total_mb: number; rss_mb: number; externo_mb: number; percentual: number };
    cpu: { usuario_ms: number; sistema_ms: number };
  };
  banco: {
    latencia_ms: number;
    tamanho: string;
    tamanho_bytes: number;
    cache_hit_pct: number | null;
    conexoes_ativas: number;
    conexoes_totais: number;
    max_conexoes: number;
    tabelas: { nome: string; tamanho: string; linhas: number }[];
  };
  timestamp: string;
}

function fmtUptime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${m}m ${sec}s` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function ProgressBar({ value, max, color = 'bg-purple-500' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const danger = pct > 85;
  return (
    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
      <div
        className={`h-2 rounded-full transition-all ${danger ? 'bg-rose-500' : color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-start gap-3">
      <div className={`p-2.5 rounded-xl ${color}`}>
        <Icon size={16} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-lg font-black text-slate-900 leading-tight">{value}</p>
        {sub && <p className="text-[9px] text-slate-400 font-semibold mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function MonitoramentoTITab() {
  const [data, setData] = useState<TIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/sistema/monitoramento-ti');
      setData(r.data);
      setUltimaAtualizacao(new Date().toLocaleTimeString('pt-BR'));
    } catch { /* silencioso */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
    const id = setInterval(carregar, 30_000);
    return () => clearInterval(id);
  }, [carregar]);

  const srv = data?.servidor;
  const banco = data?.banco;

  const latColor =
    !banco ? '' :
    banco.latencia_ms < 50  ? 'text-emerald-600' :
    banco.latencia_ms < 200 ? 'text-amber-600'   : 'text-rose-600';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="bg-purple-600 p-2.5 rounded-xl shadow-lg shadow-purple-500/20">
            <Server size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-tighter text-slate-900">Monitoramento TI</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {ultimaAtualizacao ? `Atualizado às ${ultimaAtualizacao} · refresh automático 30s` : 'Carregando...'}
            </p>
          </div>
        </div>
        <button onClick={carregar} disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-black uppercase disabled:opacity-50 transition-colors">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-purple-600" size={36} />
        </div>
      ) : !data ? (
        <div className="py-16 text-center">
          <Server size={40} className="mx-auto mb-3 text-slate-200" />
          <p className="text-sm font-black text-slate-400 uppercase">Não foi possível carregar os dados</p>
        </div>
      ) : (
        <div className="space-y-8">

          {/* ── Servidor ── */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
              <Server size={11} /> Servidor
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <KpiCard icon={Activity}  label="Uptime"      value={fmtUptime(srv!.uptime_segundos)}  color="bg-emerald-500" />
              <KpiCard icon={Cpu}       label="Node.js"     value={srv!.node_version}                color="bg-blue-500"    sub={`${srv!.plataforma} ${srv!.arquitetura}`} />
              <KpiCard icon={Zap}       label="Ambiente"    value={srv!.ambiente.toUpperCase()}       color="bg-amber-500"   />
              <KpiCard icon={Server}    label="CPU (total)" value={`${srv!.cpu.usuario_ms + srv!.cpu.sistema_ms} ms`} color="bg-violet-500" sub={`usr ${srv!.cpu.usuario_ms}ms · sys ${srv!.cpu.sistema_ms}ms`} />
            </div>

            {/* Memória */}
            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                  <HardDrive size={11} /> Memória
                </p>
                <span className={`text-xs font-black ${srv!.memoria.percentual > 85 ? 'text-rose-600' : 'text-slate-700'}`}>
                  {srv!.memoria.percentual}% heap
                </span>
              </div>
              <ProgressBar value={srv!.memoria.heap_usado_mb} max={srv!.memoria.heap_total_mb} color="bg-purple-500" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-bold text-slate-600">
                <div><span className="text-slate-400">Heap usado</span><br />{srv!.memoria.heap_usado_mb} MB</div>
                <div><span className="text-slate-400">Heap total</span><br />{srv!.memoria.heap_total_mb} MB</div>
                <div><span className="text-slate-400">RSS</span><br />{srv!.memoria.rss_mb} MB</div>
                <div><span className="text-slate-400">Externo</span><br />{srv!.memoria.externo_mb} MB</div>
              </div>
            </div>
          </div>

          {/* ── Banco de Dados ── */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
              <Database size={11} /> Banco de Dados (PostgreSQL · Neon)
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <KpiCard icon={Wifi}     label="Latência"   value={`${banco!.latencia_ms} ms`}
                color={banco!.latencia_ms < 50 ? 'bg-emerald-500' : banco!.latencia_ms < 200 ? 'bg-amber-500' : 'bg-rose-500'} />
              <KpiCard icon={Database} label="Tamanho DB" value={banco!.tamanho}               color="bg-blue-500" />
              <KpiCard icon={Zap}      label="Cache Hit"  value={banco!.cache_hit_pct != null ? `${banco!.cache_hit_pct}%` : '–'} color="bg-teal-500"
                sub={banco!.cache_hit_pct != null ? (banco!.cache_hit_pct > 95 ? 'Excelente' : banco!.cache_hit_pct > 80 ? 'Bom' : 'Verificar') : undefined} />
              <KpiCard icon={Activity} label="Conexões"   value={`${banco!.conexoes_ativas} / ${banco!.conexoes_totais}`} color="bg-violet-500"
                sub={banco!.max_conexoes ? `máx ${banco!.max_conexoes}` : undefined} />
            </div>

            {/* Conexões progress */}
            {banco!.max_conexoes > 0 && (
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Uso de Conexões</p>
                  <span className="text-[10px] font-black text-slate-600">{banco!.conexoes_totais} de {banco!.max_conexoes}</span>
                </div>
                <ProgressBar value={banco!.conexoes_totais} max={banco!.max_conexoes} color="bg-blue-500" />
              </div>
            )}

            {/* Tabelas */}
            {banco!.tabelas.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Tabelas (por tamanho)</p>
                </div>
                <div className="divide-y divide-slate-50">
                  {banco!.tabelas.map((t, i) => {
                    const maxBytes = banco!.tabelas[0]?.tamanho ? 1 : 0;
                    return (
                      <div key={t.nome} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50/50">
                        <span className="text-[9px] font-black text-slate-300 w-5 shrink-0">{i + 1}</span>
                        <span className="flex-1 text-xs font-bold text-slate-700 font-mono truncate">{t.nome}</span>
                        <span className="text-[10px] font-black text-slate-500 shrink-0">{t.linhas.toLocaleString('pt-BR')} linhas</span>
                        <span className="text-[10px] font-black text-purple-600 shrink-0 min-w-[60px] text-right">{t.tamanho}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <p className="text-[9px] text-slate-300 text-right font-semibold">
            Snapshot: {data.timestamp ? new Date(data.timestamp).toLocaleString('pt-BR') : '–'}
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function ConfiguracoesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('perfil');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const { canWrite: temAcessoGestao } = usePermissions(user);
  const ehAdminOuPrt = ['admin', 'prt'].includes(user?.role ?? '');

  if (!isMounted || loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <Loader2 className="animate-spin text-purple-600" size={48} />
      </div>
    );
  }

  if (!user) {
    router.replace('/login');
    return null;
  }

  const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'perfil',           label: 'Meu Perfil',        icon: User },
    { id: 'acessibilidade',   label: 'Acessibilidade',    icon: Palette },
    ...(temAcessoGestao ? [{ id: 'gestao' as TabId, label: 'Gestão de Acesso', icon: ShieldCheck }] : []),
    ...(ehAdminOuPrt ? [{ id: 'monitoramento-ti' as TabId, label: 'Monitor TI', icon: Server }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 p-4 md:p-8 font-sans antialiased text-slate-900 dark:text-slate-50">
      <div className="max-w-[1600px] mx-auto">

        {/* ── HEADER ── */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-purple-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">
                Painel Pessoal
              </span>
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                <Settings2 size={12} /> Preferências e Conta
              </span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter italic">
              Config <span className="text-purple-600">.ITP</span>
            </h1>
          </div>


        </header>

        {/* ── TABS KPI ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {TABS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`p-5 rounded-3xl border transition-all duration-300 flex items-center gap-4 group ${
                  isActive
                    ? 'bg-purple-950 border-purple-950 text-white shadow-2xl shadow-purple-900/30 scale-[1.02]'
                    : 'bg-white border-slate-100 hover:shadow-md hover:border-slate-200'
                }`}
              >
                <div className={`p-3 rounded-2xl flex items-center justify-center transition-colors flex-shrink-0 ${
                  isActive
                    ? 'bg-purple-600'
                    : 'bg-slate-100 text-slate-500 group-hover:bg-purple-100 group-hover:text-purple-600'
                }`}>
                  <Icon size={20} />
                </div>
                <p className={`text-sm font-black uppercase tracking-tighter ${isActive ? 'text-white' : 'text-slate-800'}`}>
                  {label}
                </p>
              </button>
            );
          })}
        </div>

        {/* ── CONTEÚDO ATIVO ── */}
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl overflow-hidden p-6 sm:p-8 md:p-12">
          {activeTab === 'perfil'              && <MeuPerfilTab />}
          {activeTab === 'acessibilidade'      && <AcessibilidadeTab />}
          {activeTab === 'gestao'          && temAcessoGestao && <GestaoAcessoTab />}
          {activeTab === 'monitoramento-ti' && ehAdminOuPrt && <MonitoramentoTITab />}
        </div>

      </div>
    </div>
  );
}


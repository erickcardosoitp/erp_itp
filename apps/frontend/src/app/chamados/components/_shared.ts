export interface Chamado {
  id: string;
  protocolo?: string | null;
  titulo: string;
  descricao?: string | null;
  tipo: string;
  status: string;
  prioridade: string;
  aluno_id?: string | null;
  aluno_nome?: string | null;
  turma_id?: string | null;
  turma_nome?: string | null;
  responsavel_nome?: string | null;
  criado_por_nome?: string | null;
  observacoes?: string | null;
  data_resolucao?: string | null;
  abertura?: string | null;
  fechamento?: string | null;
  _total_acomp?: number;
  satisfacao?: number | null;
  origem?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Acompanhamento {
  id: string;
  chamado_id: string;
  conteudo: string;
  autor_nome?: string | null;
  created_at: string;
}

export interface Aluno { id: string; nome_completo: string; turma_nome?: string; turmas?: any[]; }
export interface Turma { id: string; nome: string; }
export interface Responsavel { id: string; nome: string; role: string; }
export interface Conhecimento {
  id: string; titulo: string; conteudo: string; categoria?: string;
  tags?: string[]; autor_nome?: string; visualizacoes: number; created_at: string;
}
export interface Stats { abertos: number; em_andamento: number; resolvidos: number; urgentes: number; }

export const COR_STATUS: Record<string, string> = {
  aberto:       'bg-blue-50 text-blue-600 border-blue-200',
  em_andamento: 'bg-amber-50 text-amber-600 border-amber-200',
  resolvido:    'bg-emerald-50 text-emerald-600 border-emerald-200',
};

export const PRIO_BORDER: Record<string, string> = {
  urgente: 'border-l-red-500',
  alta:    'border-l-orange-400',
  normal:  'border-l-blue-300',
  baixa:   'border-l-slate-200',
};

export const PRIO_STRIP_BG: Record<string, string> = {
  urgente: 'bg-red-500',
  alta:    'bg-orange-400',
  normal:  'bg-blue-300',
  baixa:   'bg-slate-200',
};

export const PRIO_DOT: Record<string, string> = {
  urgente: 'bg-red-500',
  alta:    'bg-orange-400',
  normal:  'bg-blue-400',
  baixa:   'bg-slate-300',
};

export const PRIO_TEXT: Record<string, string> = {
  urgente: 'text-red-600',
  alta:    'text-orange-500',
  normal:  'text-blue-500',
  baixa:   'text-slate-400',
};

export const LABEL_STATUS: Record<string, string> = {
  aberto: 'Aberto', em_andamento: 'Em andamento', resolvido: 'Resolvido',
};

export const LABEL_PRIO: Record<string, string> = {
  baixa: 'Baixa', normal: 'Normal', alta: 'Alta', urgente: 'Urgente',
};

export const TIPOS_CHAMADO = ['Social', 'Acadêmico', 'Saúde', 'Família', 'Financeiro', 'Gente', 'Suporte', 'TI', 'Outro'];
export const STATUS_CHAMADO = ['aberto', 'em_andamento', 'resolvido'] as const;
export const PRIO_CHAMADO = ['baixa', 'normal', 'alta', 'urgente'] as const;

export const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin', prt: 'Presidência', vp: 'VP', drt: 'Diretoria',
  adjunto: 'Adjunto', prof: 'Professor', monitor: 'Monitor',
  assist: 'Assistente', cozinha: 'Cozinha', user: 'Usuário',
};

export const SLA_LIMITES: Record<string, { amarelo: number; vermelho: number }> = {
  urgente: { amarelo: 2,  vermelho: 4  },
  alta:    { amarelo: 4,  vermelho: 8  },
  normal:  { amarelo: 12, vermelho: 24 },
  baixa:   { amarelo: 36, vermelho: 72 },
};

export function fmtRelative(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 2) return 'agora';
  if (mins < 60) return `há ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ontem';
  if (days < 7) return `há ${days}d`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export interface SLAState { pct: number; colorClass: string; label: string; }

export function getSLAState(c: Chamado): SLAState {
  const ini = c.abertura ?? c.created_at;
  if (!ini) return { pct: 0, colorClass: 'bg-slate-200', label: '—' };
  const limites = SLA_LIMITES[c.prioridade] ?? SLA_LIMITES.normal;
  if (c.status === 'resolvido') {
    const fim = c.fechamento ? new Date(c.fechamento) : new Date();
    const h = (fim.getTime() - new Date(ini).getTime()) / 3600000;
    const label = h >= 48 ? `${Math.floor(h / 24)}d` : `${Math.floor(h)}h`;
    return { pct: 100, colorClass: 'bg-emerald-400', label };
  }
  const h = (Date.now() - new Date(ini).getTime()) / 3600000;
  const pct = Math.min(100, (h / limites.vermelho) * 100);
  const label = h >= 48 ? `${Math.floor(h / 24)}d` : h >= 1 ? `${Math.floor(h)}h` : `${Math.floor(h * 60)}m`;
  if (pct >= 100) return { pct: 100, colorClass: 'bg-red-500', label };
  if (h >= limites.amarelo) return { pct, colorClass: 'bg-amber-400', label };
  return { pct, colorClass: 'bg-emerald-400', label };
}

export function getSLATextClass(colorClass: string): string {
  if (colorClass === 'bg-red-500') return 'text-red-500';
  if (colorClass === 'bg-amber-400') return 'text-amber-500';
  return 'text-emerald-600';
}

export function isSLACritical(c: Chamado): boolean {
  if (c.status === 'resolvido') return false;
  const ini = c.abertura ?? c.created_at;
  if (!ini) return false;
  const h = (Date.now() - new Date(ini).getTime()) / 3600000;
  return h >= (SLA_LIMITES[c.prioridade] ?? SLA_LIMITES.normal).amarelo;
}

export function isMeuChamado(c: Chamado, userName?: string | null): boolean {
  if (!userName) return false;
  return c.responsavel_nome === userName || c.criado_por_nome === userName;
}

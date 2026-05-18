import type { PipelineStatus, SourceType, TemplateType, ScoreLabel } from '../types';

// ── Labels e cores dos status ──────────────────────────────────────────────────
export const STATUS_LABELS: Record<PipelineStatus, string> = {
  prospeccao:  'Prospecção',
  qualificacao: 'Qualificação',
  elaboracao:  'Elaboração',
  submissao:   'Submetido',
  aprovado:    'Aprovado',
  reprovado:   'Reprovado',
  archived:    'Arquivado',
};

export const STATUS_COLORS: Record<PipelineStatus, { bg: string; text: string; border: string }> = {
  prospeccao:  { bg: 'bg-slate-100 dark:bg-slate-700',  text: 'text-slate-600 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-600' },
  qualificacao: { bg: 'bg-blue-50 dark:bg-blue-900/30',  text: 'text-blue-700 dark:text-blue-300',   border: 'border-blue-200 dark:border-blue-700' },
  elaboracao:  { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-200 dark:border-yellow-700' },
  submissao:   { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-700' },
  aprovado:    { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300',  border: 'border-green-200 dark:border-green-700' },
  reprovado:   { bg: 'bg-red-50 dark:bg-red-900/20',    text: 'text-red-700 dark:text-red-300',      border: 'border-red-200 dark:border-red-700' },
  archived:    { bg: 'bg-slate-50 dark:bg-slate-800',   text: 'text-slate-400',                       border: 'border-slate-200 dark:border-slate-700' },
};

// ── Labels de fonte ───────────────────────────────────────────────────────────
export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  edital:       'Edital',
  grant:        'Grant',
  patrocinio:   'Patrocínio',
  lei_incentivo: 'Lei de Incentivo',
  outro:        'Outro',
};

// ── Score → Label ─────────────────────────────────────────────────────────────
export function getScoreLabel(score: number): ScoreLabel {
  if (score >= 90) return 'Excelente';
  if (score >= 75) return 'Alta';
  if (score >= 50) return 'Média';
  return 'Baixa';
}

export const SCORE_STYLES: Record<ScoreLabel, { bg: string; text: string; bar: string }> = {
  Excelente: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', bar: 'bg-green-500' },
  Alta:      { bg: 'bg-blue-50 dark:bg-blue-900/20',   text: 'text-blue-700 dark:text-blue-300',   bar: 'bg-blue-500' },
  Média:     { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-300', bar: 'bg-yellow-500' },
  Baixa:     { bg: 'bg-slate-50 dark:bg-slate-800',    text: 'text-slate-500',                       bar: 'bg-slate-400' },
};

// ── Templates de documento ────────────────────────────────────────────────────
export const TEMPLATE_LABELS: Record<TemplateType, string> = {
  project_summary: 'Resumo Executivo',
  cover_letter:    'Carta de Apresentação',
  budget_memo:     'Memorando de Orçamento',
  oficio:          'Ofício',
  chamamento:      'Resposta ao Chamamento',
  projeto_esboco:  'Esboço de Projeto',
  proposta:        'Proposta Técnica',
};

// ── Ordem do kanban ───────────────────────────────────────────────────────────
export const PIPELINE_ORDER: PipelineStatus[] = [
  'prospeccao', 'qualificacao', 'elaboracao', 'submissao', 'aprovado', 'reprovado', 'archived',
];

// ── Formatadores ──────────────────────────────────────────────────────────────
export function formatBRL(value?: number | null): string {
  if (value == null) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDate(date?: string | null): string {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

export function isExpiringSoon(deadline?: string | null): boolean {
  if (!deadline) return false;
  const d = new Date(deadline);
  const diff = d.getTime() - Date.now();
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000; // < 30 dias
}

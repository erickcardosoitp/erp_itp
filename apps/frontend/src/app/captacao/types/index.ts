export type SourceType = 'edital' | 'grant' | 'patrocinio' | 'lei_incentivo' | 'outro';

export type PipelineStatus =
  | 'prospeccao'
  | 'qualificacao'
  | 'elaboracao'
  | 'submissao'
  | 'aprovado'
  | 'reprovado'
  | 'archived';

export type TemplateType =
  | 'project_summary'
  | 'cover_letter'
  | 'budget_memo'
  | 'oficio'
  | 'chamamento'
  | 'projeto_esboco'
  | 'proposta';

export type ScoreLabel = 'Excelente' | 'Alta' | 'Média' | 'Baixa';

// Resultado bruto da busca Gemini (não salvo no banco)
export interface SearchResult {
  title: string;
  source_type: SourceType;
  entity_name?: string;
  source_url?: string;
  deadline?: string;
  estimated_value?: number;
  ai_score: number;
  ai_confidence: number;
  summary?: string;
  match_reasons: string[];
  areas: string[];
}

// Oportunidade salva no pipeline
export interface Opportunity {
  id: string;
  title: string;
  source_type: SourceType;
  source_url?: string;
  entity_name?: string;
  deadline?: string;
  estimated_value?: number;
  status: PipelineStatus;
  ai_score?: number;
  ai_confidence?: number;
  summary?: string;
  match_reasons?: string[];
  search_metadata?: Record<string, any>;
  notes?: string;
  created_by?: string;
  deleted_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
  // lazy-loaded pelo drawer
  pipeline_events?: PipelineEvent[];
}

export interface PipelineEvent {
  id: string;
  opportunity_id: string;
  from_status?: string;
  to_status: string;
  changed_by?: string;
  notes?: string;
  created_at: string;
}

export interface PipelineResponse {
  data: Opportunity[];
  total: number;
  page: number;
  limit: number;
}

export interface InsightsKPIs {
  total: number;
  approved: number;
  approval_rate: number;
  value_potential: number;
  value_submitted: number;
  value_approved: number;
  avg_score: number;
  expiring_30d: number;
}

export interface InsightsResponse {
  kpis: InsightsKPIs;
  by_pipeline_status: Array<{ status: string; count: number }>;
  by_source_type: Array<{ source_type: string; count: number; total_value: number }>;
}

export interface MonthlyEntry {
  month: string;
  count: number;
}

export interface SearchState {
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  lastQuery: string;
  requestId: string | null;
}

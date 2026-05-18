import api from '@/services/api';
import type {
  SearchResult, Opportunity, PipelineStatus, PipelineResponse,
  InsightsResponse, TemplateType,
} from '../types';

const BASE = '/captacao';

// ── Busca via Gemini (resultado apenas em memória, não persiste) ──────────────
export async function searchOpportunities(
  query: string,
  options?: { areas?: string[]; source_types?: string[] },
  signal?: AbortSignal,
): Promise<{ request_id: string; results: SearchResult[] }> {
  const res = await api.post(
    `${BASE}/search`,
    { query, areas: options?.areas, source_types: options?.source_types },
    { signal, timeout: 30_000 },
  );
  return res.data;
}

// ── Salvar oportunidade no pipeline (persiste no banco) ───────────────────────
export async function saveOpportunity(data: Partial<Opportunity> & { title: string; source_type: string }): Promise<Opportunity> {
  const res = await api.post(`${BASE}/opportunities`, data);
  return res.data;
}

// ── Listar pipeline ───────────────────────────────────────────────────────────
export async function listOpportunities(params?: {
  status?: PipelineStatus;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PipelineResponse> {
  const res = await api.get(`${BASE}/opportunities`, { params, timeout: 10_000 });
  return res.data;
}

// ── Buscar por ID (detalhes + eventos) ───────────────────────────────────────
export async function getOpportunityById(id: string): Promise<Opportunity> {
  const res = await api.get(`${BASE}/opportunities/${id}`, { timeout: 10_000 });
  return res.data;
}

// ── Atualizar status ──────────────────────────────────────────────────────────
export async function updateStatus(id: string, status: PipelineStatus, notes?: string): Promise<Opportunity> {
  const res = await api.patch(`${BASE}/opportunities/${id}/status`, { status, notes });
  return res.data;
}

// ── Atualizar campos (PATCH parcial) ─────────────────────────────────────────
export async function updateOpportunity(id: string, data: Partial<Opportunity>): Promise<Opportunity> {
  const res = await api.patch(`${BASE}/opportunities/${id}`, data, { timeout: 10_000 });
  return res.data;
}

// ── Soft delete ───────────────────────────────────────────────────────────────
export async function deleteOpportunity(id: string): Promise<{ ok: boolean }> {
  const res = await api.delete(`${BASE}/opportunities/${id}`);
  return res.data;
}

// ── Insights ──────────────────────────────────────────────────────────────────
export async function getInsights(): Promise<InsightsResponse> {
  const res = await api.get(`${BASE}/insights`, { timeout: 10_000 });
  return res.data;
}

// ── Gerar documento DOCX ─────────────────────────────────────────────────────
export async function generateDocument(opportunityId: string, templateType: TemplateType): Promise<Blob> {
  const res = await api.post(
    `${BASE}/opportunities/${opportunityId}/documents`,
    { template_type: templateType },
    { responseType: 'blob', timeout: 35_000 },
  );
  return res.data;
}

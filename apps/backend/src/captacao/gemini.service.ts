import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// ── Contexto institucional fixo ────────────────────────────────────────────────
export const ITP_CONTEXT = `
Organização: Instituto Tia Pretinha
CNPJ: 11.759.851/0001-39
Natureza: Associação Privada sem fins lucrativos
Fundação: 09/03/2010
Endereço: Rua Ramiro Monteiro, 130 — Vaz Lobo, Rio de Janeiro/RJ — CEP 21.360-460
Atividades: ensino de esportes, arte e cultura, atenção à saúde, artes cênicas, projetos esportivos
Propósito: transformação social por meio do afeto, cuidado, dignidade e oportunidades
Público: crianças, adolescentes, jovens e adultos em vulnerabilidade social
Indicadores: 245 alunos | 85 famílias | satisfação 4,93/5 | evasão 0,9%
Contato: contato@institutotiapretinha.com.br | (21) 6554-0576
`.trim();

// ── Templates de prompt ────────────────────────────────────────────────────────
const SEARCH_PROMPT = (query: string, areas?: string[], sourceTypes?: string[]) => `
Você é especialista sênior em captação de recursos para o terceiro setor brasileiro com acesso ao Google Search.

PERFIL COMPLETO DA ORGANIZAÇÃO:
${ITP_CONTEXT}
Natureza jurídica: Associação Privada sem fins lucrativos (OSC/OSCIP elegível)
Anos de operação: ${new Date().getFullYear() - 2010} anos (fundada 2010)
Localização: Vaz Lobo, Zona Norte do Rio de Janeiro — periferia

TAREFA: Pesquise oportunidades REAIS de captação para: "${query}"

FILTROS:
- Áreas: ${areas?.join(', ') || 'esporte, cultura, educação, saúde, arte'}
- Tipos: ${sourceTypes?.join(', ') || 'editais, grants, patrocínios, leis de incentivo'}

PROCESSO DE ANÁLISE (execute em ordem):
1. Use Google Search para encontrar editais/programas ABERTOS ou com previsão de abertura em 2025/2026
2. Para cada oportunidade encontrada, PESQUISE no Google: quais tipos de organizações foram selecionadas historicamente por este financiador (ex: "organizações selecionadas [nome financiador]", "convênios [financiador] OSC site:portaldatransparencia.gov.br" ou "beneficiários [programa]")
3. Compare o perfil histórico de beneficiários com o ITP: localização (RJ/periferia), área de atuação, porte (pequena OSC), natureza jurídica
4. Calcule o ai_score (0-100) baseado em evidências reais: 80+ = OSCs similares foram aprovadas; 50-79 = perfil compatível mas sem evidência clara; <50 = incompatibilidade estrutural
5. Verifique prazos e valide URLs

FONTES PRIORITÁRIAS A PESQUISAR:
- portaldatransparencia.gov.br (convênios federais com OSCs)
- plataformamaisbrasil.gov.br (transferências voluntárias)
- bndes.gov.br/transparencia
- mapaosc.ipea.gov.br (perfil de OSCs similares aprovadas)
- cultura.gov.br (Lei Rouanet / SEFIC)
- esporte.gov.br / secretaria estadual de esporte RJ
- faperj.br / fundações estaduais RJ
- empresas com programas de responsabilidade social (Lei do Esporte, Lei Rouanet)

RETORNE APENAS JSON array válido (sem markdown) com até 8 oportunidades:
[
  {
    "title": "Nome exato do edital/programa",
    "source_type": "edital|grant|patrocinio|lei_incentivo|outro",
    "entity_name": "Órgão ou empresa responsável",
    "source_url": "URL oficial verificada ou null",
    "deadline": "YYYY-MM-DD ou null",
    "estimated_value": número em reais ou null,
    "ai_score": 0-100 (baseado em evidências de beneficiários históricos),
    "ai_confidence": 0-100 (confiança na informação encontrada),
    "summary": "Descrição objetiva em até 220 caracteres incluindo por que o ITP se encaixa",
    "match_reasons": ["evidência 1 baseada em pesquisa", "evidência 2"],
    "areas": ["educação", "esporte", "cultura", "saúde"]
  }
]

Se não encontrar oportunidades com evidências reais, retorne: []
`.trim();

const DOCUMENT_PROMPTS: Record<string, (opp: any) => string> = {
  oficio: (opp) => `
Você é especialista em elaboração de documentos oficiais para organizações do terceiro setor brasileiro.

CONTEXTO INSTITUCIONAL:
${ITP_CONTEXT}

OPORTUNIDADE:
- Título: ${opp.title}
- Organização financiadora: ${opp.entity_name || 'Organização financiadora'}
- Valor estimado: ${opp.estimated_value ? `R$ ${Number(opp.estimated_value).toLocaleString('pt-BR')}` : 'A definir'}

TAREFA: Redija um Ofício formal solicitando apoio/parceria para esta oportunidade.

O ofício deve conter:
- Número: OFÍCIO Nº ___/2025-ITP
- Local e data: Rio de Janeiro, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
- Destinatário: (deixar espaço para nome e cargo)
- Assunto: Solicitação de apoio — ${opp.title}
- Corpo: apresentação do ITP, objetivo do ofício, proposta, indicadores de impacto, pedido formal
- Assinatura: Diretoria Executiva — Instituto Tia Pretinha
- Tom: formal, respeitoso, objetivo. Máximo 1 página.
`.trim(),

  chamamento: (opp) => `
Você é especialista em elaboração de documentos para captação de recursos no terceiro setor brasileiro.

CONTEXTO INSTITUCIONAL:
${ITP_CONTEXT}

OPORTUNIDADE:
- Título: ${opp.title}
- Organização financiadora: ${opp.entity_name || 'Organização financiadora'}
- Valor estimado: ${opp.estimated_value ? `R$ ${Number(opp.estimated_value).toLocaleString('pt-BR')}` : 'A definir'}
- Prazo: ${opp.deadline ? new Date(opp.deadline).toLocaleDateString('pt-BR') : 'A confirmar'}

TAREFA: Redija uma Resposta ao Chamamento Público / Manifestação de Interesse para esta oportunidade.

O documento deve conter:
1. IDENTIFICAÇÃO DA ORGANIZAÇÃO PROPONENTE
2. DECLARAÇÃO DE INTERESSE E CAPACIDADE TÉCNICA
3. HISTÓRICO E QUALIFICAÇÃO DO ITP
4. DESCRIÇÃO DA PROPOSTA
5. METODOLOGIA E CRONOGRAMA
6. RESULTADOS ESPERADOS
7. DECLARAÇÕES LEGAIS (ato constitutivo, CNPJ, certidões negativas)
8. ASSINATURA

Tom: formal, técnico, convincente. Formato: documento de habilitação.
`.trim(),

  projeto_esboco: (opp) => `
Você é especialista em elaboração de projetos sociais para o terceiro setor brasileiro.

CONTEXTO INSTITUCIONAL:
${ITP_CONTEXT}

OPORTUNIDADE:
- Título: ${opp.title}
- Organização financiadora: ${opp.entity_name || 'Organização financiadora'}
- Valor estimado: ${opp.estimated_value ? `R$ ${Number(opp.estimated_value).toLocaleString('pt-BR')}` : 'A definir'}
- Prazo: ${opp.deadline ? new Date(opp.deadline).toLocaleDateString('pt-BR') : 'A confirmar'}

TAREFA: Redija um Esboço de Projeto (Project Brief) estruturado para esta oportunidade.

O esboço deve cobrir:
1. TÍTULO DO PROJETO
2. PROBLEMA / NECESSIDADE IDENTIFICADA
3. OBJETIVO GERAL e OBJETIVOS ESPECÍFICOS (mínimo 3)
4. PÚBLICO-ALVO (perfil, quantidade, localização)
5. ATIVIDADES PROPOSTAS (por eixo)
6. INDICADORES DE RESULTADO (quantitativos e qualitativos)
7. PRAZO DE EXECUÇÃO
8. ORÇAMENTO ESTIMADO (tabela resumida)
9. EQUIPE MÍNIMA NECESSÁRIA
10. ALINHAMENTO COM OS ODS (Objetivos de Desenvolvimento Sustentável)

Extensão: 2–3 páginas. Tom: técnico e objetivo.
`.trim(),

  proposta: (opp) => `
Você é especialista em elaboração de propostas técnicas para captação de recursos no terceiro setor brasileiro.

CONTEXTO INSTITUCIONAL:
${ITP_CONTEXT}

OPORTUNIDADE:
- Título: ${opp.title}
- Organização financiadora: ${opp.entity_name || 'Organização financiadora'}
- Valor estimado: ${opp.estimated_value ? `R$ ${Number(opp.estimated_value).toLocaleString('pt-BR')}` : 'A definir'}
- Prazo: ${opp.deadline ? new Date(opp.deadline).toLocaleDateString('pt-BR') : 'A confirmar'}

TAREFA: Redija uma Proposta Técnica completa para submissão a esta oportunidade.

A proposta deve conter:
1. SUMÁRIO EXECUTIVO
2. CONTEXTUALIZAÇÃO E JUSTIFICATIVA
3. OBJETIVOS (geral e específicos)
4. METODOLOGIA DETALHADA
5. CRONOGRAMA DE EXECUÇÃO (tabela mês a mês)
6. PLANO DE MONITORAMENTO E AVALIAÇÃO
7. ORÇAMENTO DETALHADO (com justificativas por item)
8. SUSTENTABILIDADE DO PROJETO
9. EXPERIÊNCIA PRÉVIA DO ITP EM INICIATIVAS SIMILARES
10. ANEXOS SUGERIDOS

Extensão: 4–6 páginas. Tom: técnico, formal, persuasivo.
`.trim(),

  project_summary: (opp) => `
Você é especialista em elaboração de documentos para captação de recursos no terceiro setor brasileiro.

CONTEXTO INSTITUCIONAL:
${ITP_CONTEXT}

OPORTUNIDADE:
- Título: ${opp.title}
- Organização financiadora: ${opp.entity_name || 'Não especificado'}
- Valor estimado: ${opp.estimated_value ? `R$ ${Number(opp.estimated_value).toLocaleString('pt-BR')}` : 'A definir'}
- Prazo: ${opp.deadline ? new Date(opp.deadline).toLocaleDateString('pt-BR') : 'A confirmar'}

TAREFA: Redija um Resumo Executivo do Projeto para esta oportunidade.

O documento deve conter:
1. IDENTIFICAÇÃO DO PROJETO
2. PROBLEMA SOCIAL ENDEREÇADO
3. SOLUÇÃO PROPOSTA (atividades do ITP)
4. PÚBLICO BENEFICIÁRIO
5. RESULTADOS ESPERADOS (metas mensuráveis)
6. ORÇAMENTO RESUMIDO
7. EQUIPE RESPONSÁVEL
8. SUSTENTABILIDADE

Tom: formal, objetivo, persuasivo. Máximo 2 páginas (800 palavras).
Idioma: Português brasileiro.
`.trim(),

  cover_letter: (opp) => `
Você é especialista em elaboração de documentos para captação de recursos no terceiro setor brasileiro.

CONTEXTO INSTITUCIONAL:
${ITP_CONTEXT}

OPORTUNIDADE:
- Título: ${opp.title}
- Organização financiadora: ${opp.entity_name || 'Organização financiadora'}
- Valor estimado: ${opp.estimated_value ? `R$ ${Number(opp.estimated_value).toLocaleString('pt-BR')}` : 'A definir'}

TAREFA: Redija uma Carta de Apresentação formal para submissão a esta oportunidade.

A carta deve:
1. Identificar o ITP (missão, CNPJ, anos de atuação)
2. Apresentar brevemente o projeto proposto
3. Destacar alinhamento com os objetivos do financiador
4. Mencionar indicadores de impacto do ITP
5. Solicitar formalmente apoio e expressar disponibilidade para reunião

Tom: formal, cordial, persuasivo. Máximo 1 página (400 palavras).
Endereçar ao(à) Responsável pelo Programa (deixar espaço para nome).
Data: Rio de Janeiro, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}.
`.trim(),

  budget_memo: (opp) => `
Você é especialista em elaboração de documentos para captação de recursos no terceiro setor brasileiro.

CONTEXTO INSTITUCIONAL:
${ITP_CONTEXT}

OPORTUNIDADE:
- Título: ${opp.title}
- Valor estimado: ${opp.estimated_value ? `R$ ${Number(opp.estimated_value).toLocaleString('pt-BR')}` : 'A definir'}

TAREFA: Elabore um Memorando de Orçamento detalhado para esta oportunidade.

O documento deve incluir:
1. RESUMO DO PROJETO
2. ORÇAMENTO DETALHADO por categoria:
   - Pessoal (professores, coordinadores, administrativo)
   - Material pedagógico e esportivo
   - Infraestrutura e equipamentos
   - Comunicação e documentação
   - Despesas administrativas (máx. 10%)
3. CRONOGRAMA FÍSICO-FINANCEIRO (12 meses)
4. JUSTIFICATIVA DE CADA ITEM

Valores em BRL. Formato: tabela clara com colunas (Item, Qtd, Unit, Total, Justificativa).
`.trim(),
};

// ── Prompt de Análise de Elegibilidade ────────────────────────────────────────
const ELIGIBILITY_PROMPT = (opp: any) => `
Você é especialista em captação de recursos para o terceiro setor brasileiro com acesso ao Google Search.

ORGANIZAÇÃO PROPONENTE:
${ITP_CONTEXT}
Natureza jurídica: Associação Privada sem fins lucrativos
Anos de operação: ${new Date().getFullYear() - 2010} anos (fundada em 2010)
Bairro: Vaz Lobo — Zona Norte, Rio de Janeiro (periferia)
Certificações típicas de OSCs deste porte: CMAS, CEAS-RJ, inscrição no CNEAS

OPORTUNIDADE A ANALISAR:
- Título: ${opp.title}
- Financiador/Órgão: ${opp.entity_name || 'Não especificado'}
- Valor estimado: ${opp.estimated_value ? `R$ ${Number(opp.estimated_value).toLocaleString('pt-BR')}` : 'Não informado'}
- Prazo: ${opp.deadline ? new Date(opp.deadline).toLocaleDateString('pt-BR') : 'Não informado'}
- URL: ${opp.source_url || 'Não informada'}
- Áreas: ${(opp.areas || []).join(', ') || 'Não especificado'}

PESQUISE E ANALISE (use Google Search ativamente):
1. Busque o edital/programa pelo nome: quais são os requisitos de elegibilidade? (CNPJ, tempo de existência, certidões, abrangência geográfica, área temática)
2. Pesquise no Portal da Transparência e TransfereGov: este financiador já firmou convênios com OSCs similares ao ITP? Com que perfil? (ex: "convênios [financiador] Rio de Janeiro OSC site:portaldatransparencia.gov.br")
3. Busque resultados de edições anteriores: quais organizações foram selecionadas? Qual o porte e perfil delas? (ex: "[nome edital] organizações selecionadas OR resultado OR beneficiários")
4. Identifique fatores de risco: o que costuma reprovar OSCs deste porte?
5. Identifique pontos fortes do ITP frente a este edital específico

RETORNE APENAS JSON válido (sem markdown) neste formato exato:
{
  "overall_score": 0-100,
  "verdict": "alta|media|baixa|incompativel",
  "verdict_explanation": "Uma frase objetiva explicando o veredito com evidências",
  "past_beneficiaries": {
    "found_evidence": true/false,
    "typical_profile": "Descrição do perfil típico de quem foi aprovado (ou 'Sem dados históricos encontrados')",
    "examples": ["Org Exemplo 1 — RJ — área — valor", "Org Exemplo 2"],
    "data_source": "Portal da Transparência | TransfereGov | Busca web | Sem dados"
  },
  "eligibility_checklist": [
    { "requirement": "Descrição do requisito", "status": "ok|verificar|risco", "detail": "Como o ITP se posiciona frente a este requisito" }
  ],
  "itp_fit_factors": [
    { "factor": "Nome do fator", "score": 0-100, "explanation": "Por que esta nota" }
  ],
  "strengths": ["Ponto forte 1 do ITP para este edital", "Ponto forte 2"],
  "risk_factors": ["Risco 1 que pode comprometer a candidatura", "Risco 2"],
  "recommended_actions": ["Ação concreta 1 a tomar antes de submeter", "Ação 2"],
  "disclaimer": "Análise baseada em dados públicos disponíveis. Verifique os requisitos no edital oficial."
}
`.trim();

export interface GeminiSearchResult {
  title: string;
  source_type: string;
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

export interface EligibilityAnalysis {
  overall_score: number;
  verdict: 'alta' | 'media' | 'baixa' | 'incompativel';
  verdict_explanation: string;
  past_beneficiaries: {
    found_evidence: boolean;
    typical_profile: string;
    examples: string[];
    data_source: string;
  };
  eligibility_checklist: Array<{
    requirement: string;
    status: 'ok' | 'verificar' | 'risco';
    detail: string;
  }>;
  itp_fit_factors: Array<{
    factor: string;
    score: number;
    explanation: string;
  }>;
  strengths: string[];
  risk_factors: string[];
  recommended_actions: string[];
  disclaimer: string;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  constructor(private readonly config: ConfigService) {}

  private getApiKey(): string {
    const key = this.config.get<string>('GEMINI_API_KEY');
    if (!key) throw new Error('GEMINI_API_KEY não configurada');
    return key;
  }

  /** Chama a API REST do Gemini diretamente via fetch */
  private async callGemini(
    model: string,
    prompt: string,
    withSearch: boolean,
    timeoutMs: number,
  ): Promise<string> {
    const apiKey = this.getApiKey();
    const url = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;

    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    };

    if (withSearch) {
      body.tools = [{ google_search: {} }];
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(`Gemini HTTP ${res.status}: ${errText}`);
      }

      const data: any = await res.json();
      const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (!text) throw new Error('Resposta vazia do Gemini');
      return text;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Sanitiza input contra prompt injection */
  private sanitizeQuery(query: string): string {
    return query
      .slice(0, 500)
      .replace(/[<>{}[\]\\]/g, '')
      .replace(/ignore previous instructions?/gi, '')
      .replace(/system prompt/gi, '')
      .trim();
  }

  /** Parse seguro do JSON retornado pelo Gemini */
  private parseSearchResponse(raw: string): GeminiSearchResult[] {
    try {
      const cleaned = raw
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      const match = cleaned.match(/\[[\s\S]*\]/);
      if (!match) return [];

      const parsed = JSON.parse(match[0]);
      if (!Array.isArray(parsed)) return [];

      const validSourceTypes = ['edital', 'grant', 'patrocinio', 'lei_incentivo', 'outro'];

      return parsed
        .filter((item: any) => {
          if (!item || typeof item !== 'object') return false;
          if (!item.title || typeof item.title !== 'string' || item.title.trim() === '') return false;
          if (!validSourceTypes.includes(item.source_type)) return false;
          return true;
        })
        .map((item: any): GeminiSearchResult => ({
          title: String(item.title).trim(),
          source_type: item.source_type,
          entity_name: item.entity_name ? String(item.entity_name).trim() : undefined,
          source_url: item.source_url && item.source_url !== 'null' ? String(item.source_url) : undefined,
          deadline: item.deadline && item.deadline !== 'null' ? String(item.deadline) : undefined,
          estimated_value: typeof item.estimated_value === 'number' ? item.estimated_value : undefined,
          ai_score: Math.min(100, Math.max(0, Number(item.ai_score) || 0)),
          ai_confidence: Math.min(100, Math.max(0, Number(item.ai_confidence) || 0)),
          summary: item.summary ? String(item.summary).slice(0, 250) : undefined,
          match_reasons: Array.isArray(item.match_reasons)
            ? item.match_reasons.map((r: any) => String(r)).slice(0, 5)
            : [],
          areas: Array.isArray(item.areas)
            ? item.areas.map((a: any) => String(a)).slice(0, 6)
            : [],
        }));
    } catch (err: any) {
      this.logger.warn(`[Gemini] Falha no parse: ${err.message}`);
      return [];
    }
  }

  /** Busca oportunidades com retry exponencial */
  async searchOpportunities(
    query: string,
    requestId: string,
    areas?: string[],
    sourceTypes?: string[],
  ): Promise<GeminiSearchResult[]> {
    const safeQuery = this.sanitizeQuery(query);
    const prompt = SEARCH_PROMPT(safeQuery, areas, sourceTypes);
    const startedAt = Date.now();

    const MAX_RETRIES = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const text = await this.callGemini('gemini-2.0-flash', prompt, true, 25_000);
        const parsed = this.parseSearchResponse(text);

        this.logger.log(JSON.stringify({
          event: 'gemini_search',
          request_id: requestId,
          query: safeQuery,
          duration_ms: Date.now() - startedAt,
          results_count: parsed.length,
          attempt,
        }));

        return parsed;
      } catch (err: any) {
        lastError = err;
        const isRetryable =
          err.message?.includes('429') ||
          err.message?.includes('503') ||
          err.name === 'AbortError';

        this.logger.warn(`[Gemini] Tentativa ${attempt} falhou: ${err.message}`);

        if (isRetryable && attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
          continue;
        }
        break;
      }
    }

    this.logger.error(JSON.stringify({
      event: 'gemini_search_error',
      request_id: requestId,
      error: lastError?.message,
      duration_ms: Date.now() - startedAt,
    }));

    throw lastError ?? new Error('Erro desconhecido no Gemini');
  }

  /** Analisa elegibilidade de uma oportunidade com pesquisa de beneficiários históricos */
  async analyzeOpportunityEligibility(
    opportunity: any,
    requestId: string,
  ): Promise<EligibilityAnalysis> {
    const prompt = ELIGIBILITY_PROMPT(opportunity);
    const startedAt = Date.now();
    const MAX_RETRIES = 2;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const text = await this.callGemini('gemini-2.0-flash', prompt, true, 45_000);

        const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('JSON não encontrado na resposta');

        const parsed = JSON.parse(match[0]) as EligibilityAnalysis;

        this.logger.log(JSON.stringify({
          event: 'gemini_eligibility',
          request_id: requestId,
          opportunity_title: opportunity.title,
          overall_score: parsed.overall_score,
          verdict: parsed.verdict,
          duration_ms: Date.now() - startedAt,
          attempt,
        }));

        return {
          overall_score: Math.min(100, Math.max(0, Number(parsed.overall_score) || 0)),
          verdict: ['alta', 'media', 'baixa', 'incompativel'].includes(parsed.verdict)
            ? parsed.verdict
            : 'media',
          verdict_explanation: String(parsed.verdict_explanation || ''),
          past_beneficiaries: {
            found_evidence: Boolean(parsed.past_beneficiaries?.found_evidence),
            typical_profile: String(parsed.past_beneficiaries?.typical_profile || ''),
            examples: Array.isArray(parsed.past_beneficiaries?.examples)
              ? parsed.past_beneficiaries.examples.map(String).slice(0, 5)
              : [],
            data_source: String(parsed.past_beneficiaries?.data_source || ''),
          },
          eligibility_checklist: Array.isArray(parsed.eligibility_checklist)
            ? parsed.eligibility_checklist
                .filter((i: any) => i?.requirement)
                .map((i: any) => ({
                  requirement: String(i.requirement),
                  status: ['ok', 'verificar', 'risco'].includes(i.status) ? i.status : 'verificar',
                  detail: String(i.detail || ''),
                }))
                .slice(0, 10)
            : [],
          itp_fit_factors: Array.isArray(parsed.itp_fit_factors)
            ? parsed.itp_fit_factors
                .filter((f: any) => f?.factor)
                .map((f: any) => ({
                  factor: String(f.factor),
                  score: Math.min(100, Math.max(0, Number(f.score) || 0)),
                  explanation: String(f.explanation || ''),
                }))
                .slice(0, 6)
            : [],
          strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String).slice(0, 5) : [],
          risk_factors: Array.isArray(parsed.risk_factors) ? parsed.risk_factors.map(String).slice(0, 5) : [],
          recommended_actions: Array.isArray(parsed.recommended_actions) ? parsed.recommended_actions.map(String).slice(0, 6) : [],
          disclaimer: String(parsed.disclaimer || 'Análise baseada em dados públicos. Verifique o edital oficial.'),
        };
      } catch (err: any) {
        lastError = err;
        this.logger.warn(`[Gemini] Elegibilidade tentativa ${attempt} falhou: ${err.message}`);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 2000 * attempt));
        }
      }
    }

    this.logger.error(JSON.stringify({
      event: 'gemini_eligibility_error',
      request_id: requestId,
      error: lastError?.message,
    }));

    throw lastError ?? new Error('Erro ao analisar elegibilidade');
  }

  /** Gera documento de captação */
  async generateDocument(
    opportunity: any,
    templateType: string,
    requestId: string,
  ): Promise<string> {
    const promptFn = DOCUMENT_PROMPTS[templateType];
    if (!promptFn) throw new Error(`Template "${templateType}" não reconhecido`);

    const prompt = promptFn(opportunity);
    const startedAt = Date.now();
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const text = await this.callGemini('gemini-2.0-flash', prompt, false, 30_000);

        this.logger.log(JSON.stringify({
          event: 'gemini_document',
          request_id: requestId,
          template_type: templateType,
          duration_ms: Date.now() - startedAt,
          content_length: text.length,
          attempt,
        }));

        return text;
      } catch (err: any) {
        lastError = err;
        const isRetryable =
          err.message?.includes('429') ||
          err.message?.includes('503') ||
          err.name === 'AbortError';

        if (isRetryable && attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
          continue;
        }
        break;
      }
    }

    this.logger.error(JSON.stringify({
      event: 'gemini_document_error',
      request_id: requestId,
      template_type: templateType,
      error: lastError?.message,
    }));

    throw lastError ?? new Error('Erro ao gerar documento');
  }
}

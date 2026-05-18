import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
Você é especialista em captação de recursos para organizações do terceiro setor brasileiro.

CONTEXTO INSTITUCIONAL:
${ITP_CONTEXT}

TAREFA: Pesquise oportunidades REAIS e ATUAIS de captação de recursos para: "${query}"

FILTROS APLICADOS:
- Áreas de interesse: ${areas?.join(', ') || 'todas (esporte, cultura, educação, saúde, arte)'}
- Tipos de fonte: ${sourceTypes?.join(', ') || 'todos (editais, grants, patrocínios, leis de incentivo)'}

INSTRUÇÕES:
1. Use Google Search para encontrar oportunidades abertas e vigentes em 2025/2026
2. Priorize fontes brasileiras: BNDES, governo federal, estadual e municipal, fundações, empresas com lei de incentivo
3. Verifique se os prazos ainda estão vigentes
4. Avalie compatibilidade com o perfil do ITP (OSC, crianças/adolescentes, Rio de Janeiro)
5. NÃO invente oportunidades — apenas inclua as que realmente existem

RETORNE APENAS um JSON array válido (sem markdown, sem texto antes ou depois) com até 6 oportunidades:
[
  {
    "title": "Nome exato do edital/programa",
    "source_type": "edital|grant|patrocinio|lei_incentivo|outro",
    "entity_name": "Órgão ou empresa responsável",
    "source_url": "URL oficial ou null",
    "deadline": "YYYY-MM-DD ou null se não encontrado",
    "estimated_value": número em reais ou null,
    "ai_score": 0-100 (compatibilidade com ITP),
    "ai_confidence": 0-100 (confiança da informação),
    "summary": "Descrição objetiva em até 200 caracteres",
    "match_reasons": ["razão 1", "razão 2"],
    "areas": ["educação", "esporte", "cultura", "saúde"]
  }
]

Se não encontrar oportunidades relevantes, retorne: []
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
   - Pessoal (professores, coordenadores, administrativo)
   - Material pedagógico e esportivo
   - Infraestrutura e equipamentos
   - Comunicação e documentação
   - Despesas administrativas (máx. 10%)
3. CRONOGRAMA FÍSICO-FINANCEIRO (12 meses)
4. JUSTIFICATIVA DE CADA ITEM

Valores em BRL. Formato: tabela clara com colunas (Item, Qtd, Unit, Total, Justificativa).
`.trim(),
};

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

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private client: GoogleGenerativeAI | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): GoogleGenerativeAI {
    if (!this.client) {
      const apiKey = this.config.get<string>('GEMINI_API_KEY');
      if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');
      this.client = new GoogleGenerativeAI(apiKey);
    }
    return this.client;
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
      // Remove markdown fences
      const cleaned = raw
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      // Extrai o array JSON
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
        const model = this.getClient().getGenerativeModel({
          model: 'gemini-2.0-flash',
          // Google Search grounding
          tools: [{ googleSearch: {} } as any],
        });

        const result = await Promise.race([
          model.generateContent(prompt),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Gemini timeout')), 25_000),
          ),
        ]);

        const text = (result as any).response.text();
        const parsed = this.parseSearchResponse(text);

        this.logger.log(JSON.stringify({
          event: 'gemini_search',
          request_id: requestId,
          query: safeQuery,
          duration_ms: Date.now() - startedAt,
          results_count: parsed.length,
          attempt,
          cache_hit: false,
        }));

        return parsed;
      } catch (err: any) {
        lastError = err;
        const isRetryable =
          err.message?.includes('429') ||
          err.message?.includes('503') ||
          err.message?.includes('timeout');

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
        const model = this.getClient().getGenerativeModel({
          model: 'gemini-2.0-flash',
        });

        const result = await Promise.race([
          model.generateContent(prompt),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Gemini timeout')), 30_000),
          ),
        ]);

        const text = (result as any).response.text();

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
          err.message?.includes('timeout');

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

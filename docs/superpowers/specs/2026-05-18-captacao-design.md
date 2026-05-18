# Módulo Captação — Design Spec
**Data:** 2026-05-18  
**Status:** Aprovado  
**Projeto:** ERP ITP

---

## 1. Objetivo

Central inteligente de prospecção e gestão de oportunidades de funding para o Instituto Tia Pretinha (ITP). Usa Gemini 2.0 Flash com Google Search grounding para encontrar editais, grants, patrocínios e leis de incentivo alinhados à missão do ITP, permitindo salvar, acompanhar em pipeline e gerar documentos de captação.

---

## 2. Contexto Institucional (ITP_CONTEXT)

Usado em todos os prompts Gemini como contexto fixo:

```
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
```

---

## 3. Arquitetura

### 3.1 Rotas Frontend

```
/captacao                → redirect → /captacao/buscar
/captacao/buscar         → busca manual + resultados Gemini
/captacao/pipeline       → pipeline com toggle lista/kanban/tabs
/captacao/insights       → dashboard analítico (server-side)
```

Integração em `App.tsx` (ou equivalente no projeto):
```tsx
<Route path="captacao" element={<RequireModule module="captacao"><CaptacaoLayout /></RequireModule>}>
  <Route index element={<Navigate to="buscar" replace />} />
  <Route path="buscar"   element={<BuscarPage />} />
  <Route path="pipeline" element={<PipelinePage />} />
  <Route path="insights" element={<InsightsPage />} />
</Route>
```

### 3.2 Estrutura de Arquivos Frontend

```
src/modules/captacao/
  pages/
    BuscarPage.tsx
    PipelinePage.tsx
    InsightsPage.tsx
  components/
    OpportunityCard.tsx
    OpportunityFilters.tsx
    PipelineKanban.tsx
    PipelineTable.tsx
    PipelineTabs.tsx
    KPIStats.tsx
    SearchHero.tsx
    CompatibilityBadge.tsx
    OpportunityDrawer.tsx
  hooks/
    useGeminiAPI.ts          ← thin: só estado (loading/error/data)
    useOpportunityFilters.ts ← filtros + debounce 500ms
    usePipelineStats.ts      ← lê /captacao/insights
  services/
    captacao.service.ts      ← toda lógica: prompts, parsing, cache, retry, timeouts
  constants/
    itpContext.ts            ← ITP_CONTEXT string
    captacaoFilters.ts       ← opções de filtros (areas, source_types, etc.)
    promptTemplates.ts       ← templates de prompt por tipo de busca e documento
  utils/
    opportunityMapper.ts     ← mapeia resposta Gemini → Opportunity
    compatibility.ts         ← score → label (Excelente/Alta/Média/Baixa)
    geminiParser.ts          ← sanitiza JSON bruto do Gemini
  types/
    index.ts
  layouts/
    CaptacaoLayout.tsx
```

### 3.3 Separação de Responsabilidades (Frontend)

```
useGeminiAPI()                ← estado: loading, error, data
  ↓
captacao.service.ts           ← lógica: prompt, cache, retry, parse, validate, timeout
  ↓
POST /captacao/search         ← backend (Gemini com API key segura)
  ↓
geminiParser.ts               ← sanitiza ```json fences, valida campos
  ↓
opportunityMapper.ts          ← normaliza → tipo Opportunity
```

### 3.4 Estrutura Backend

```
backend/
  models/captacao.py
  routers/captacao.py
  services/captacao_service.py
```

> Adaptar ao padrão de módulos existente no projeto (NestJS, FastAPI, etc.).

---

## 4. Banco de Dados

### 4.1 Tabela `opportunities`

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `association_id` | UUID FK NOT NULL | multi-tenant — obrigatório em TODA query |
| `title` | TEXT NOT NULL | |
| `source_type` | ENUM NOT NULL | ver SourceType |
| `organization` | TEXT | órgão/instituição |
| `value_min` | NUMERIC(12,2) | nullable |
| `value_max` | NUMERIC(12,2) | nullable |
| `deadline` | DATE | nullable — data limite do edital |
| `expires_at` | TIMESTAMPTZ | nullable — controle interno de expiração |
| `compatibility` | ENUM NOT NULL | ver Compatibility |
| `score` | INT | 0–100 |
| `ai_confidence` | NUMERIC(4,3) | 0.000–1.000 ex: 0.870 |
| `summary` | TEXT | resumo gerado pelo Gemini |
| `match_reasons` | JSONB | ex: `["Atua em esporte", "Atende juventude"]` |
| `areas` | TEXT[] | ex: `["educação","esporte"]` |
| `tags` | TEXT[] | tags livres |
| `link` | TEXT | nullable |
| `pipeline_status` | ENUM NOT NULL | ver PipelineStatus |
| `notes` | TEXT | anotações manuais |
| `search_metadata` | JSONB | query, filtros, searched_at |
| `gemini_raw` | JSONB | resposta bruta (auditoria) |
| `created_by` | UUID FK | usuário que salvou |
| `created_at` | TIMESTAMPTZ NOT NULL | |
| `updated_at` | TIMESTAMPTZ NOT NULL | |
| `deleted_at` | TIMESTAMPTZ | soft delete |

### 4.2 Tabela `pipeline_events`

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `opportunity_id` | UUID FK NOT NULL | |
| `association_id` | UUID NOT NULL | multi-tenant |
| `from_status` | ENUM | nullable (criação) |
| `to_status` | ENUM NOT NULL | |
| `changed_by` | UUID FK NOT NULL | |
| `notes` | TEXT | nullable |
| `created_at` | TIMESTAMPTZ NOT NULL | |

### 4.3 Enums

```typescript
// Frontend
type DocumentType = 'carta' | 'oficio' | 'proposta' | 'resumo' | 'chamamento' | 'projeto_esboco'
type SourceType = 'public' | 'private' | 'incentive_law' | 'sponsorship' | 'foundation' | 'grant'
type Compatibility = 'high' | 'medium' | 'low'
type PipelineStatus = 'new' | 'analyzing' | 'preparing' | 'submitted' | 'approved' | 'archived' | 'expired'
```

> `archived` substitui `closed` — future-proof (oportunidade arquivada pode ser reaberta).

### 4.4 Índices

```sql
CREATE INDEX idx_opp_assoc           ON opportunities (association_id);
CREATE INDEX idx_opp_pipeline        ON opportunities (association_id, pipeline_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_opp_source_type     ON opportunities (association_id, source_type)     WHERE deleted_at IS NULL;
CREATE INDEX idx_opp_compatibility   ON opportunities (association_id, compatibility)   WHERE deleted_at IS NULL;
CREATE INDEX idx_opp_deadline        ON opportunities (deadline)                        WHERE deleted_at IS NULL;
CREATE INDEX idx_pipeline_events_opp ON pipeline_events (opportunity_id);
```

---

## 5. Endpoints API

Todos os endpoints requerem **JWT autenticado**. O `association_id` é extraído do JWT — nunca aceito como parâmetro do cliente.

```
POST   /captacao/search
POST   /captacao/opportunities
GET    /captacao/opportunities
GET    /captacao/opportunities/{id}
PATCH  /captacao/opportunities/{id}/pipeline
DELETE /captacao/opportunities/{id}
POST   /captacao/opportunities/{id}/document
GET    /captacao/insights
```

### POST /captacao/search
- **Auth:** JWT obrigatório
- Recebe: `{ request_id, query, filters: { areas, source_types, compatibility, value_range } }`
- `request_id` — UUID gerado pelo frontend para rastreabilidade
- Cache 15min por hash(query + filtros) por `association_id`
- Rate limit: **10 req/min por usuário**
- Timeout Gemini: **25s** → fallback `{ error: "A busca demorou mais que o esperado. Tente novamente." }`
- Retry: 3x com backoff exponencial em 429/503/timeout
- Retorna: lista de até 6 oportunidades normalizadas
- Log: `request_id`, query, duração, tokens estimados, cache hit/miss, erro

### GET /captacao/opportunities
- Filtros: `pipeline_status`, `source_type`, `compatibility`, `areas`, `search`
- Paginação: `page` + `limit` (padrão 20)
- Sempre filtra `deleted_at IS NULL` e `association_id = current`

### GET /captacao/opportunities/{id}
- Retorna dados completos + `pipeline_events` (lazy load do drawer)
- Retorna 404 se não pertence ao tenant (não 403 — não vazar existência)

### PATCH /captacao/opportunities/{id}/pipeline
- Body: `{ pipeline_status, notes? }`
- Registra evento em `pipeline_events`
- **Atualização otimista no frontend** com rollback em erro de rede ou 4xx

### DELETE /captacao/opportunities/{id}
- Soft delete: seta `deleted_at = now()`

### POST /captacao/opportunities/{id}/document
- Body: `{ document_type: DocumentType }`
- Rate limit: **5 req/min por usuário**
- Timeout Gemini: **30s**
- Gera arquivo Word (`.docx`)
- Retorna stream `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- **Fallback:** HTTP 503 se Gemini falhar após retries

### GET /captacao/insights
Server-side — nunca calcular no frontend:
```json
{
  "kpis": {
    "total": 0, "approved": 0, "approval_rate": 0.0,
    "value_potential": 0, "value_submitted": 0, "value_approved": 0,
    "avg_score": 0.0, "expiring_30d": 0
  },
  "by_source_type": [],
  "by_compatibility": [],
  "by_pipeline_status": [],
  "monthly_submissions": []
}
```

---

## 6. Componentes Frontend

### OpportunityCard
Hierarquia visual obrigatória (nessa ordem):
1. **Score** — barra visual + label (Excelente/Alta/Média/Baixa)
2. **Compatibilidade** — `CompatibilityBadge` com cor
3. **Prazo** — urgência visual se < 30 dias
4. `ai_confidence` — mini progress bar: `████████░░ 87%`
5. `match_reasons` — chips
6. Título, organização
7. **Resumo** — `line-clamp-2`
8. Ações: Salvar | Ver detalhes

### Score → Label
| Score | Label | Cor |
|---|---|---|
| 90–100 | Excelente aderência | verde |
| 75–89  | Alta aderência | azul |
| 50–74  | Média aderência | amarelo |
| < 50   | Baixa aderência | cinza |

### OpportunityDrawer
- Lazy: `GET /captacao/opportunities/{id}` ao abrir
- Skeleton enquanto carrega
- Aba "Detalhes": campos + `match_reasons` + histórico de `pipeline_events`
- Aba "Documento": select `document_type` → "Gerar" → textarea editável → "Baixar .docx"
- Aba "Pipeline": select status + nota → "Atualizar"

### PipelinePage — 3 visões (toggle)
- **`PipelineTable`** — tabela responsiva com select de status inline
- **`PipelineKanban`** — drag-and-drop via `@dnd-kit/core`; atualização otimista + rollback em erro; virtualização documentada como melhoria futura
- **`PipelineTabs`** — abas por status com contador

### InsightsPage
- `KPIStats`: 7 métricas (total, aprovadas, taxa, valor potencial/submetido/aprovado, expirando)
- Gráfico de barras `source_type`
- Gráfico de pizza `compatibility`
- Linha do tempo `monthly_submissions`

---

## 7. Segurança

### Multi-tenancy
- **TODA query** filtra por `association_id = current_user.association_id`
- `association_id` extraído exclusivamente do JWT
- Recursos de outro tenant → 404

### Chave de API
- `GEMINI_API_KEY` apenas no backend
- Nunca exposta ao frontend (sem `NEXT_PUBLIC_` ou `VITE_`)

### Checklist Pré-Deploy
- [ ] Todas as queries têm filtro `association_id`
- [ ] `GEMINI_API_KEY` não aparece em arquivos frontend
- [ ] Rate limiting ativo em `/search` e `/document`
- [ ] Soft delete — nenhum `DELETE` físico
- [ ] JWT validado em todos os endpoints
- [ ] Inputs sanitizados antes de enviar ao Gemini (anti prompt injection, max 500 chars)
- [ ] `gemini_raw` salvo para auditoria
- [ ] `request_id` logado

---

## 8. Observabilidade (Mínima)

Logar em cada chamada Gemini:
```
event, request_id, query, duration_ms, tokens_estimated, cache_hit, error, association_id, user_id
```

---

## 9. Expiração Automática

Cron diário:
```sql
UPDATE opportunities
SET pipeline_status = 'expired', updated_at = now()
WHERE deadline IS NOT NULL
  AND deadline < CURRENT_DATE
  AND pipeline_status NOT IN ('approved', 'archived', 'expired')
  AND deleted_at IS NULL
```

---

## 10. Cache de Busca

Em `captacao.service.ts` (frontend, memória):
- Chave: hash(query + sortedFilters + association_id)
- TTL: 15 minutos
- Estrutura: `Map<string, { data: Opportunity[]; ts: number }>`
- **Invalidação:** cache limpo ao salvar oportunidade

---

## 11. Timeouts no Frontend

| Operação | Frontend | Backend Gemini |
|---|---|---|
| `/search` | 30s | 25s |
| `/document` | 35s | 30s |
| Outros | 10s | N/A |

Implementar via `AbortController` em `captacao.service.ts`.

---

## 12. Políticas de Fallback de IA

### Busca
| Condição | Fallback |
|---|---|
| Timeout | `"A busca demorou mais que o esperado."` |
| 429/503 | Retry 3x backoff → `"Serviço temporariamente indisponível."` |
| JSON malformado | Retornar apenas itens válidos após parse |
| Sem resultados | `{ results: [], message: "Nenhuma oportunidade encontrada." }` |

### Documento
| Condição | Fallback |
|---|---|
| Timeout | HTTP 503 |
| Conteúdo vazio | HTTP 422 |
| Erro geração | HTTP 500 + log |

---

## 13. Templates de Prompt

### Busca (`promptTemplates.ts`)
```typescript
export const SEARCH_PROMPT = (query: string, filters: SearchFilters) => `
Você é especialista em captação de recursos para organizações do terceiro setor brasileiro.

CONTEXTO: ${ITP_CONTEXT}

TAREFA: Pesquise oportunidades REAIS e ATUAIS para: "${query}"

FILTROS:
- Áreas: ${filters.areas?.join(', ') || 'todas'}
- Tipo: ${filters.source_types?.join(', ') || 'todos'}
- Compatibilidade mínima: ${filters.compatibility || 'qualquer'}

RETORNE APENAS JSON array com até 6 oportunidades (sem markdown):
[{"title":"","source_type":"public|private|incentive_law|sponsorship|foundation|grant",
  "organization":"","value_min":null,"value_max":null,"deadline":"YYYY-MM-DD",
  "compatibility":"high|medium|low","score":0,"ai_confidence":0.0,
  "summary":"max 200 chars","match_reasons":[],"areas":[],"link":null}]`
```

### Documentos (backend)
Um template por `DocumentType`: `carta`, `oficio`, `proposta`, `resumo`, `chamamento`, `projeto_esboco`.
Cada usa `ITP_CONTEXT` + dados da oportunidade + instruções de formato/tom.

---

## 14. Normalização e Validação Gemini

`geminiParser.ts`:
1. Remover ` ```json ` e ` ``` ` antes do `JSON.parse`
2. Validar campos obrigatórios: `title`, `source_type`, `compatibility`, `score`
3. Defaults: `score = 0`, `areas = []`, `match_reasons = []`
4. Rejeitar itens com `title` vazio ou `source_type` inválido

---

## 15. Libs Novas

| Lib | Onde | Motivo |
|---|---|---|
| `@dnd-kit/core` | frontend | Kanban drag-and-drop |
| `@dnd-kit/sortable` | frontend | Kanban drag-and-drop |
| Geração Word | backend | `.docx` — usar lib nativa do stack do projeto |

---

## 16. Sidebar / Menu

Adicionar item "Captação" com ícone `Target` (Lucide) ao menu principal.
Permissão: módulo dedicado `captacao` — admin libera por usuário.

---

## 17. Variáveis de Ambiente

```
GEMINI_API_KEY=your_gemini_api_key
```

Não expor ao frontend.

---

## 18. Melhorias Futuras (Fora de Escopo)

- Virtualização do `PipelineKanban` (> 50 cards)
- Geração de documentos assíncrona via job/queue
- Tabelas many-to-many para `areas` e `tags`
- Notificações de prazo via push
- Export CSV/Excel do pipeline
- Integração com APIs externas de editais (FNDE, SICONV, etc.)
- `request_id` persistido no banco para deduplicação

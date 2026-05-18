# Módulo Captação — Implementation Plan
**Data:** 2026-05-18  
**Status:** Aprovado  
**Projeto:** ERP ITP  
**Spec:** [2026-05-18-captacao-design.md](2026-05-18-captacao-design.md)

---

## Visão Geral

10 fases sequenciais. Cada fase tem pré-requisitos, entregáveis e critério de done. Backend primeiro, depois frontend, integração no final.

---

## Fase 1 — Schema e Migrations

**Pré-requisitos:** Nenhum.

**Entregáveis:**
1. Migration: criar tabela `captacao_opportunities`
   - `id UUID PK DEFAULT gen_random_uuid()`
   - `association_id UUID NOT NULL FK → associations(id)`
   - `title TEXT NOT NULL`
   - `source_type TEXT NOT NULL CHECK IN ('edital','grant','patrocinio','lei_incentivo','outro')`
   - `source_url TEXT`
   - `entity_name TEXT`
   - `deadline TIMESTAMPTZ`
   - `estimated_value NUMERIC(12,2)`
   - `status TEXT NOT NULL DEFAULT 'prospeccao' CHECK IN ('prospeccao','qualificacao','elaboracao','submissao','aprovado','reprovado','archived')`
   - `ai_score SMALLINT CHECK (0..100)`
   - `ai_confidence SMALLINT CHECK (0..100)`
   - `summary TEXT`
   - `match_reasons JSONB`
   - `search_metadata JSONB`
   - `notes TEXT`
   - `assigned_to UUID FK → users(id)`
   - `deleted_at TIMESTAMPTZ`
   - `expires_at TIMESTAMPTZ`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
   - `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
   - Índices: `association_id`, `status`, `deleted_at`, `deadline`, `expires_at`

2. Migration: criar tabela `pipeline_events`
   - `id UUID PK`
   - `opportunity_id UUID NOT NULL FK → captacao_opportunities(id) ON DELETE CASCADE`
   - `from_status TEXT`
   - `to_status TEXT NOT NULL`
   - `changed_by UUID FK → users(id)`
   - `notes TEXT`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
   - Índice: `opportunity_id`

3. Migration: criar tabela `captacao_documents`
   - `id UUID PK`
   - `opportunity_id UUID NOT NULL FK → captacao_opportunities(id) ON DELETE CASCADE`
   - `template_type TEXT NOT NULL CHECK IN ('project_summary','cover_letter','budget_memo')`
   - `content TEXT NOT NULL`
   - `generated_by UUID FK → users(id)`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

**Critério de done:** Migrations aplicadas sem erro. Rollback testado.

---

## Fase 2 — Models e DTOs (Backend)

**Pré-requisitos:** Fase 1.

**Entregáveis:**

1. `backend/app/models/captacao.py`
   - Classes `CaptacaoOpportunity`, `PipelineEvent`, `CaptacaoDocument`
   - SQLModel com todos os campos do schema
   - Propriedade computada `score_label` no model: `>=90→"Excelente"`, `75-89→"Alta"`, `50-74→"Média"`, `<50→"Baixa"`

2. `backend/app/schemas/captacao.py`
   - `OpportunitySearchRequest`: `query: str` (max 500 chars, validação anti-injection)
   - `OpportunitySearchResult`: campos do Gemini response
   - `SaveOpportunityRequest`: campos para salvar
   - `UpdateOpportunityRequest`: campos parciais (PATCH)
   - `OpportunityResponse`: response completo com `score_label`
   - `PipelineResponse`: lista paginada com agregados
   - `InsightsResponse`: todos os KPIs

**Critério de done:** Schemas importam sem erro. Mypy passa.

---

## Fase 3 — Gemini Service

**Pré-requisitos:** Fase 2.

**Entregáveis:**

1. `backend/app/services/gemini_service.py`
   - `GeminiService` com injeção de `Settings`
   - `_gemini_client`: inicialização lazy com `google-generativeai` SDK
   - `search_opportunities(query: str, request_id: str) -> list[OpportunitySearchResult]`
     - Sanitiza query (remove prompt injection patterns)
     - Monta prompt com `ITP_CONTEXT` + template `SEARCH_PROMPT`
     - Chama Gemini 2.0 Flash com Google Search grounding
     - Retry: exponential backoff 3x para 429/503/timeout (1s, 2s, 4s)
     - AbortController equivalente: `asyncio.wait_for(..., timeout=30)`
     - Parse JSON da resposta
     - Retorna lista `OpportunitySearchResult`
   - `generate_document(opportunity: OpportunityResponse, template_type: str, request_id: str) -> str`
     - Monta prompt com dados da oportunidade + `ITP_CONTEXT`
     - Template `DOCUMENT_PROMPT` baseado em `template_type`
     - Timeout: 35s
     - Retorna conteúdo texto
   - Constantes de prompt: `ITP_CONTEXT`, `SEARCH_PROMPT`, `DOCUMENT_PROMPT_MAP`
   - Log estruturado: `request_id`, `tokens_used`, `latency_ms`

2. `backend/app/config.py` — adicionar `gemini_api_key: str = ""`

**Critério de done:** `search_opportunities("esporte juventude Rio")` retorna lista válida em dev.

---

## Fase 4 — Captação Service

**Pré-requisitos:** Fase 3.

**Entregáveis:**

1. `backend/app/services/captacao_service.py`
   - `CaptacaoService(db: AsyncSession, association_id: UUID)`
   - **Sempre** filtra por `association_id` — nunca aceitar do cliente
   - `search(query, user_id, request_id)`: chama GeminiService, retorna resultados (não persiste)
   - `save_opportunity(data: SaveOpportunityRequest, user_id)`: insere com `association_id`, registra `pipeline_events`
   - `list_pipeline(status?, page, page_size)`: `WHERE deleted_at IS NULL AND association_id=...`
   - `update_status(id, new_status, user_id, notes?)`: UPDATE + INSERT em `pipeline_events`
   - `update_opportunity(id, data: UpdateOpportunityRequest, user_id)`: PATCH parcial
   - `soft_delete(id, user_id)`: SET `deleted_at = now()`
   - `get_insights(association_id)`: queries agregadas (COUNT por status, valor médio, score médio, taxa conversão, top fontes)
   - `expire_stale(association_id)`: cron — move para `archived` onde `deadline < now() AND deleted_at IS NULL AND status NOT IN ('aprovado','reprovado','archived') AND deadline IS NOT NULL`
   - `generate_document(opportunity_id, template_type, user_id, request_id)`: fetch opportunity, chama GeminiService, persiste em `captacao_documents`, converte para DOCX em memória, retorna bytes

**Critério de done:** Testes unitários passam para save/list/update_status/insights.

---

## Fase 5 — Router e Rate Limiting

**Pré-requisitos:** Fase 4.

**Entregáveis:**

1. `backend/app/routers/captacao.py`
   - Prefixo: `/captacao`
   - `POST /search` — rate limit 10/min por user
     - Body: `OpportunitySearchRequest`
     - Injeta `request_id = str(uuid4())`
     - Retorna `list[OpportunitySearchResult]`
   - `POST /opportunities` — salvar
     - Body: `SaveOpportunityRequest`
     - Retorna `OpportunityResponse`
   - `GET /pipeline` — listar
     - Query params: `status?`, `page=1`, `page_size=20`
     - Retorna `PipelineResponse`
   - `PATCH /opportunities/{id}` — atualizar campos
     - Body: `UpdateOpportunityRequest`
   - `PATCH /opportunities/{id}/status` — mover no pipeline
     - Body: `{ "status": str, "notes"?: str }`
   - `DELETE /opportunities/{id}` — soft delete
   - `GET /insights` — dashboard
     - Retorna `InsightsResponse`
   - `POST /opportunities/{id}/documents` — gerar documento
     - Rate limit 5/min por user
     - Body: `{ "template_type": str }`
     - Retorna DOCX como `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
     - Header: `Content-Disposition: attachment; filename="captacao_<type>_<id>.docx"`

2. Registrar router em `main.py`

3. Adicionar `"captacao"` à lista de módulos do sistema de permissões

**Critério de done:** Todos os endpoints respondem 200/201 com Postman. Rate limit retorna 429 após limite.

---

## Fase 6 — DOCX Generation

**Pré-requisitos:** Fase 5.

**Entregáveis:**

1. Dependência: `python-docx` em `requirements.txt`

2. `backend/app/utils/docx_builder.py`
   - `build_docx(content: str, title: str, template_type: str) -> bytes`
   - Estrutura: título H1, seções parseadas por `\n\n`, fonte Calibri 11pt
   - Header: logo ITP (placeholder texto se não disponível) + data geração
   - Footer: "Gerado pelo ERP ITP em {data}"
   - Retorna bytes prontos para streaming

**Critério de done:** Arquivo .docx gerado abre corretamente no Word/LibreOffice.

---

## Fase 7 — Frontend: Estrutura Base

**Pré-requisitos:** Fase 5 (endpoints disponíveis).

**Entregáveis:**

1. Estrutura de diretórios:
   ```
   frontend/src/modules/captacao/
   ├── api/
   │   └── captacaoApi.ts       # fetch wrappers para todos os endpoints
   ├── hooks/
   │   ├── useCaptacaoSearch.ts  # estado de busca, cache 15min, AbortController 30s
   │   ├── usePipeline.ts        # lista, paginação, otimismo
   │   └── useInsights.ts        # dados do dashboard
   ├── components/
   │   ├── SearchBar.tsx
   │   ├── SearchResultCard.tsx
   │   ├── OpportunityCard.tsx   # usado em lista e kanban
   │   ├── OpportunityDrawer.tsx # lazy fetch on open
   │   ├── KanbanBoard.tsx       # dnd-kit
   │   ├── KanbanColumn.tsx
   │   ├── ScoreBadge.tsx        # Excelente/Alta/Média/Baixa
   │   ├── AiConfidenceBar.tsx   # inline mini progress bar
   │   └── DocumentButton.tsx    # gera e baixa DOCX
   ├── pages/
   │   ├── BuscarPage.tsx
   │   ├── PipelinePage.tsx
   │   └── InsightsPage.tsx
   └── CaptacaoLayout.tsx        # nav tabs + Outlet
   ```

2. `captacaoApi.ts` — todas as chamadas com tipos TypeScript alinhados aos schemas backend

3. Rotas em `App.tsx` (ou roteador do projeto):
   ```tsx
   <Route path="captacao" element={<RequireModule module="captacao"><CaptacaoLayout /></RequireModule>}>
     <Route index element={<Navigate to="buscar" replace />} />
     <Route path="buscar"   element={<BuscarPage />} />
     <Route path="pipeline" element={<PipelinePage />} />
     <Route path="insights" element={<InsightsPage />} />
   </Route>
   ```

4. Nav item no sidebar/AppShell com ícone Target e label "Captação"

**Critério de done:** Rotas renderizam sem erro. Layout mostra as 3 abas.

---

## Fase 8 — Frontend: Busca

**Pré-requisitos:** Fase 7.

**Entregáveis:**

1. `useCaptacaoSearch.ts`
   - Estado: `results`, `loading`, `error`, `lastQuery`
   - Cache: `Map<string, { results, timestamp }>` — TTL 15min
   - Busca manual (sem debounce automático)
   - AbortController com timeout 30s
   - Invalida cache ao salvar uma oportunidade
   - `search(query)`: chama `POST /captacao/search`
   - `save(result)`: chama `POST /captacao/opportunities`, invalida cache

2. `BuscarPage.tsx`
   - `SearchBar`: input + botão buscar, loading state, erro inline
   - Grid de `SearchResultCard` (max 10 resultados)
   - `SearchResultCard`:
     - Título (negrito), entity_name, deadline formatada, estimated_value formatado BRL
     - `ScoreBadge` com cor: verde=Excelente, azul=Alta, amarelo=Média, cinza=Baixa
     - `AiConfidenceBar` inline (ex: `■■■□ 72%`)
     - `summary` com `line-clamp-2`
     - Botão "Salvar no Pipeline" — loading state, feedback toast

**Critério de done:** Busca retorna resultados. Salvar aparece no pipeline. Cache funciona (segunda busca igual não faz request).

---

## Fase 9 — Frontend: Pipeline e Insights

**Pré-requisitos:** Fase 8.

**Entregáveis:**

1. `usePipeline.ts`
   - Paginação (page, page_size=20)
   - Otimistic update para drag-and-drop (move card imediatamente, rollback em erro)
   - `moveCard(id, newStatus)`: PATCH otimista + confirmação backend
   - `deleteCard(id)`: soft delete com remoção otimista

2. `PipelinePage.tsx`
   - Toggle: Lista | Kanban | Tabs (botão grupo no header)
   - **Vista Lista**: tabela com colunas: título, fonte, valor, score, status, deadline, ações
   - **Vista Kanban**: `KanbanBoard` com `@dnd-kit/core` + `@dnd-kit/sortable`
     - 7 colunas (uma por status)
     - `KanbanColumn` com header colorido por status + count
     - `OpportunityCard` draggable
     - Drop atualiza status via `moveCard`
   - **Vista Tabs**: uma aba por status, lista filtrada

3. `OpportunityDrawer.tsx`
   - Abre em painel lateral
   - Lazy: fetch detalhes ao abrir (não pré-carrega)
   - Campos: todos os dados, match_reasons como tags, notes editável
   - Botão "Gerar Documento" → `DocumentButton`
   - `DocumentButton`: seleciona template, chama `POST .../documents`, baixa DOCX

4. `InsightsPage.tsx`
   - KPIs: total oportunidades, valor estimado total, ticket médio, score médio, taxa conversão
   - Gráfico de barras: distribuição por status (usar Recharts ou Nivo, conforme padrão do projeto)
   - Gráfico de pizza: top 5 fontes (source_type)
   - Tabela: top oportunidades por score
   - Todos os dados via `GET /captacao/insights` (server-side, nunca calcular no frontend)

**Critério de done:** Kanban funciona drag-and-drop. Insights renderiza sem erros de tipo. Drawer abre e fecha. DOCX baixa corretamente.

---

## Fase 10 — Cron, Permissões e Observabilidade

**Pré-requisitos:** Fase 9.

**Entregáveis:**

1. Cron de expiração automática:
   - Endpoint `POST /captacao/cron/expire` protegido por `cron_secret` header
   - Chama `captacao_service.expire_stale()`
   - Registrar no scheduler (Vercel cron ou equivalente) — frequência: diária às 02:00

2. Permissões:
   - Adicionar `captacao` ao mapa de módulos do backend
   - Admin: acesso total
   - Operator: pode buscar, salvar, mover pipeline
   - Viewer: somente leitura (GET endpoints)
   - Guards no router: verificar `can_view`, `can_edit`, `can_delete` por role

3. Observabilidade:
   - Log estruturado em todos os endpoints: `request_id`, `user_id`, `association_id`, `latency_ms`
   - Log no GeminiService: `tokens_used`, `grounding_sources_count`, `model_version`
   - Métricas de rate limit: log quando 429 é retornado
   - Error tracking: capturar e logar exceções do Gemini com contexto

4. Segurança (checklist final):
   - [ ] `association_id` sempre do JWT, nunca do body/query
   - [ ] Sanitização de input antes de enviar ao Gemini
   - [ ] `gemini_api_key` apenas em variáveis de ambiente (nunca no código)
   - [ ] Rate limiting aplicado em search e document generation
   - [ ] Soft delete (nunca DELETE físico de oportunidades)
   - [ ] `pipeline_events` imutável (sem UPDATE/DELETE)

**Critério de done:** Cron executa sem erro em staging. Permissões bloqueiam roles incorretos. Logs aparecem estruturados.

---

## Ordem de Deploy

```
1. Aplicar migrations (Fase 1)
2. Deploy backend com novas rotas (Fase 5)
3. Deploy frontend com módulo captação (Fase 9)
4. Configurar cron (Fase 10)
5. Ativar permissão "captacao" para tenants piloto
```

## Rollback

```
1. Feature flag: desativar módulo captacao no painel de permissões (sem deploy)
2. Se necessário: reverter migrations (DROP TABLE captacao_opportunities CASCADE)
3. Frontend: remover rota captacao do App.tsx e nav item
```

## Dependências Externas

| Pacote | Onde | Versão mínima |
|--------|------|---------------|
| `google-generativeai` | backend | 0.5+ |
| `python-docx` | backend | 1.1+ |
| `@dnd-kit/core` | frontend | 6.0+ |
| `@dnd-kit/sortable` | frontend | 7.0+ |

## Variáveis de Ambiente Necessárias

```
GEMINI_API_KEY=...        # Google AI Studio
CRON_SECRET=...           # para endpoint /cron/expire
```

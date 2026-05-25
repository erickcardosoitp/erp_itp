# CLAUDE.md — ERP ITP

Sistema de Gestão Empresarial para o ITP (Instituto Técnico/Politécnico). Monorepo NestJS + Next.js para gestão acadêmica, financeira e operacional.

---

## Estrutura do Projeto

```
erp_itp/
├── apps/
│   ├── backend/          # API NestJS (TypeORM + PostgreSQL)
│   └── frontend/         # Next.js 15 (App Router)
├── google-apps-script/   # Integração com Google Forms
├── CLAUDE.md             # Este arquivo — ponto central de documentação
└── package.json          # Scripts raiz do monorepo
```

---

## Comandos Essenciais

### Raiz (monorepo)
```bash
npm run start:dev       # Inicia backend em modo watch
npm run build           # Build backend + frontend
npm run build:backend   # Build apenas backend
npm run build:frontend  # Build apenas frontend
npm run start           # Inicia backend em produção
```

### Backend (`apps/backend/`)
```bash
npm run start:dev                          # NestJS watch mode
npm run build                              # Compila TypeScript
npm run start:prod                         # Servidor de produção
npm run typeorm:migration:generate         # Gera migrations
npm run typeorm:migration:run              # Executa migrations
npm run typeorm:migration:revert           # Reverte migrations
npm run test                               # Testes unitários (Jest)
npm run test:e2e                           # Testes e2e
```

### Frontend (`apps/frontend/`)
```bash
npm run dev    # Next.js dev com Turbopack (porta 3000)
npm run build  # Build de produção
npm run start  # Servidor de produção
npm run lint   # ESLint
```

---

## Arquitetura — Backend

**Framework:** NestJS 11 | **ORM:** TypeORM 0.3.20 | **DB:** PostgreSQL (Neon em produção)
**Porta local:** 3001

### Módulos Backend (17 módulos)

| Módulo | Pasta | Responsabilidade |
|--------|-------|-----------------|
| `academico` | `src/academico/` | Turmas, cursos, professores, chamada, diário, controles |
| `alunos` | `src/alunos/` | Cadastro e dados complementares de alunos matriculados |
| `auth` | `src/auth/` | JWT via Passport, guards de roles, cron de senhas |
| `cadastro` | `src/cadastro/` | Dados mestre: doadores, contas bancárias, insumos |
| `captacao` | `src/captacao/` | Oportunidades (editais, grants), pipeline Kanban, IA Gemini |
| `estoque` | `src/estoque/` | Produtos, categorias, movimentos entrada/baixa |
| `financeiro` | `src/financeiro/` | Plano de contas, movimentações, boletos, formas de pagamento |
| `funcionarios` | `src/funcionarios/` | Cadastro de funcionários |
| `gente` | `src/gente/` | RH: colaboradores, ponto, folha, vales, faltas, advertências |
| `grupos` | `src/grupos/` | Grupos de permissão e módulos visíveis |
| `matriculas` | `src/matriculas/` | Inscrições, LGPD, matrícula direta, documentos |
| `modules/users` | `src/modules/users/` | Gestão de usuários do sistema |
| `notificacoes` | `src/notificacoes/` | Sistema de notificações internas |
| `pesquisas` | `src/pesquisas/` | Formulários de pesquisa de satisfação |
| `projetos` | `src/projetos/` | Projetos sazonais (colônia de férias), pulseiras |
| `publico` | `src/publico/` | Endpoints públicos (sem auth) |
| `relatorios` | `src/relatorios/` | Geração de relatórios PDF/Excel (agrega outros módulos) |

### Autenticação

- **Estratégia:** JWT via Passport
- **Cookie:** `itp_token` (httpOnly)
- **Extração:** Bearer token ou cookie
- **Expiração:** 8 horas
- **Guard global:** `JwtAuthGuard` + `RolesGuard`
- **Rota pública:** Usar decorator `@Public()`

### Hierarquia de Roles (nível numérico)

```
user(0) < cozinha(1) < assist(2) < monitor(3) < prof(4)
< adjunto(5) < drt(8) < vp(9) < prt/admin(10)
```

Guards verificam se `roleLevel >= nivelMínimo`. Usar `@Roles('drt')` para proteger endpoints.

### Padrões do Banco de Dados

- **PK:** UUID via `gen_random_uuid()` (exceto `inscricoes` que usa INT auto-increment)
- **Soft delete:** campo `ativo: boolean` (NÃO usar DELETE em registros de negócio)
- **Timestamps:** `createdAt`, `updatedAt` (TypeORM automático)
- **Sincronize:** desabilitado — usar migrations
- **Migrations automáticas:** executadas em `onModuleInit()` via SQL raw em `app.module.ts`

### Email

`EmailService` usa Nodemailer + SMTP:
- `enviarTermoLGPD()` — envia termo para o aluno
- `enviarTermoLGPDResponsavel()` — envia para responsável (alunos <18)

---

## Arquitetura — Frontend

**Framework:** Next.js 15.5 (App Router) | **UI:** React 19 + Shadcn/UI + Tailwind CSS
**Porta local:** 3000

### Módulos do Sidebar (ordem alfabética — Dashboard fixo no topo, Config no rodapé)

| Módulo | Rota | Arquivo principal |
|--------|------|------------------|
| Dashboard | `/dashboard` | `app/dashboard/page.tsx` |
| Acadêmico | `/academico` | `app/academico/page.tsx` (~2500 linhas) |
| Cadastro Básico | `/cadastro` | `app/cadastro/page.tsx` |
| Captação | `/captacao` | `app/captacao/page.tsx` (redirect para /buscar) |
| Chamados | `/chamados` | `app/chamados/page.tsx` (~800 linhas) |
| Doações | `/doacoes` | `app/doacoes/page.tsx` (~300 linhas) |
| Estoque | `/estoque` | `app/estoque/page.tsx` (~2000 linhas) |
| Financeiro | `/financeiro` | `app/financeiro/page.tsx` (~1500 linhas) |
| Gente | `/gente` | `app/gente/page.tsx` (~2000 linhas) |
| Matrículas | `/matriculas` | `app/matriculas/page.tsx` (~2000 linhas) |
| Projetos | `/projetos` | `app/projetos/page.tsx` (~400 linhas) |
| Relatórios | `/relatorios` | `app/relatorios/page.tsx` (~3000 linhas) |
| Configurações | `/config` | `app/config/page.tsx` (rodapé fixo) |

### Páginas Públicas (sem sidebar, sem auth)

| Rota | Descrição |
|------|-----------|
| `/login` | Autenticação |
| `/inscricao` | Formulário público de inscrição |
| `/lgpd/[token]` | Aceite de LGPD via token |
| `/documentos/[token]` | Download seguro de documentos |
| `/ponto` | Marcação de ponto (GPS + assinatura) — **DESCONTINUADO** |
| `/estoque/coletor` | APP offline de contagem (token fixo) |
| `/pesquisa/[link]` | Formulário público de pesquisa |
| `/esqueci-senha`, `/reset-senha/[token]`, `/trocar-senha` | Fluxo de senha |

### Sub-rotas por Módulo

```
/academico/chamada          # Chamada com token (projetor/tablet)
/academico/chamada-professor # Chamada por CPF do professor
/captacao/buscar            # Busca com IA (Gemini + Tavily)
/captacao/pipeline          # Kanban de oportunidades (drag-and-drop)
/captacao/insights          # Análises e dados
/estoque/coletor            # Coletor mobile offline (QR Code)
/matriculas/[id]/documentos # Documentos de uma inscrição específica
/projetos/[id]/pulseiras    # Venda de pulseiras do projeto
/projetos/checkout          # Checkout de pulseiras
```

### Estado Global

`AuthContext` (`src/context/auth-context.tsx`):
- Payload: `email`, `role`, `sub`, `nome`, `fotoUrl`, `grupo`
- Carrega via `GET /api/usuarios/perfil` no mount
- Hook: `useAuth()` — contexto completo
- Hook: `usePermissions(userRole)` — retorna `canWrite`, `canRead`
- Permissão por módulo: `grupo.grupo_permissoes.modulos_visiveis[chave] !== false`

### Integração com API

- **Variável:** `NEXT_PUBLIC_API_BASE_URL`
- **Proxy Next.js:** `/backend-api/*` → backend `/api/*` (evita CORS)
- **Uploads:** `/uploads/*` roteado ao diretório de uploads do backend
- **Credenciais:** cookies cross-origin habilitados (`credentials: 'include'`)

### Bibliotecas notáveis

| Lib | Uso |
|-----|-----|
| Shadcn/UI | Componentes de UI base |
| Recharts | Gráficos e dashboards |
| jsPDF + html2canvas | Exportação de PDF |
| qrcode.react | Geração de QR Code |
| XLSX (CDN) | Exportação de planilhas |
| Sonner | Toasts/notificações |
| next-themes | Suporte a tema escuro |

---

## Mapa de Entidades do Banco (principais tabelas)

### Fluxo Candidato → Aluno (CRÍTICO)

```
inscricoes (INT PK)           # Candidato/inscrito — StatusMatricula enum
  └── alunos (UUID PK)        # Aluno matriculado — aluno_id FK em inscricoes
       ├── alunos_complemento # Dados extras (RG, banco, gênero)
       ├── documentos_validacao # RG, CPF, comprovante validados
       └── turma_alunos       # Vínculo N:N com turmas
```

**Problema atual:** DossieCandidato (`/matriculas`) e ficha do aluno (`/academico`) são telas separadas. O fluxo deve ser contínuo — candidato tem dossiê, aluno tem o mesmo dossiê + informações adicionais. Ver seção de melhorias.

### Módulo Gente (15 tabelas)

```
gente_colaboradores           # Config do colaborador (jornada, GPS, home office)
gente_ponto                   # Registros de ponto (entrada/saída, lat/lon, assinatura)
gente_faltas                  # Faltas, atestados, afastamentos
gente_recibos                 # Recibos de pagamento
gente_vales                   # Vales adiantados
gente_advertencias            # Advertências disciplinares
gente_suspensoes              # Suspensões
gente_folga_solicitacoes      # Solicitações de folga
gente_trabalho_externo        # Autorização de trabalho externo
gente_colaborador_locais      # Locais GPS permitidos
gente_codigos_ajuda           # Códigos VRX (Vale Refeição Extra)
gente_colaborador_codigos     # Atribuição de códigos VRX
gente_colaborador_documentos  # Documentos com vencimento
gente_feriados                # Feriados institucionais
gente_pagamentos_passagem     # Vale Transporte diário
gente_vt_assinaturas          # Assinaturas de VT por mês
```

**ATENÇÃO:** `gente_ponto` e toda a lógica de ponto está DESCONTINUADA. Ver plano de melhorias.

### Módulo Financeiro

```
movimentacoes_financeiras     # Receitas e despesas
boletos                       # Boletos (FEBRABAN, scanner)
boleto_parcelas               # Parcelas de boletos
planos_contas                 # Plano de contas contábil
```

**Doações** estão em tabela separada gerenciada pelo módulo `cadastro/doadores`. Devem ser integradas ao `financeiro` como tipo de movimentação.

### Módulo Captação

```
captacao_opportunities        # Oportunidades (editais, grants, patrocínios)
captacao_pipeline_events      # Histórico de mudanças de status
```

### Módulo Acadêmico

```
turmas                        # Turmas de cursos
cursos                        # Catálogo de cursos
professores                   # Corpo docente
turma_alunos                  # Vínculo aluno-turma (com data entrada/saída)
grade_horaria                 # Horários das aulas
presenca_sessoes              # Sessões de chamada
diario_academico              # Eventos e observações da turma
chamados_academicos           # Chamados sociais/acadêmicos
controle_futebol              # Controle de uniformes futebol
controle_ballet               # Controle de uniformes ballet
```

---

## Variáveis de Ambiente

### Backend (`.env` / `.env.local`)

```
DATABASE_URL       # String de conexão PostgreSQL (obrigatório)
JWT_SECRET         # Segredo para assinar JWT (obrigatório)
NODE_ENV           # development | production
SMTP_HOST          # Servidor SMTP
SMTP_PORT          # Porta SMTP
SMTP_USER          # Usuário SMTP
SMTP_PASS          # Senha SMTP
SMTP_FROM          # Endereço de remetente
APP_URL            # URL do frontend (usado em links de e-mail)
PORT               # Porta do servidor (padrão: 3001)
GEMINI_API_KEY     # Google Gemini (captação IA)
TAVILY_API_KEY     # Tavily Search (captação — usar sempre que disponível)
```

### Frontend (`.env.local`)

```
NEXT_PUBLIC_API_BASE_URL      # URL da API backend
BACKEND_INTERNAL_URL          # URL interna para proxy Vercel
APP_URL                        # URL do frontend
NEXT_PUBLIC_COLETOR_TOKEN     # Token de autenticação do coletor
```

---

## Deploy

| Componente | Plataforma | URL |
|------------|-----------|-----|
| Backend | Vercel Serverless | `https://api.itp.institutotiapretinha.org` |
| Frontend | Vercel (Next.js padrão) | `https://itp.institutotiapretinha.org` |
| Banco de dados | Neon PostgreSQL | via `DATABASE_URL` |

- Deploy automático via integração Vercel + Git (sem GitHub Actions)
- CORS: dinâmico em dev (localhost + 192.168.x.x), domínios fixos em produção

### Funções Serverless (backend)

| Arquivo | Memória | Timeout |
|---------|---------|---------|
| `api/main.ts` | 1024 MB | 30s |
| `api/health.ts` | 128 MB | 10s |

### Tokens Especiais (hardcoded em `vercel.json`)

```
COLETOR_TOKEN / NEXT_PUBLIC_COLETOR_TOKEN  = itp-coletor-2026
CHAMADA_TOKEN / NEXT_PUBLIC_CHAMADA_TOKEN  = itp-chamada-2026
```

> ⚠️ Tokens expostos no `vercel.json` — mover para variáveis privadas no dashboard Vercel.

### Cron Jobs (Vercel)

| Endpoint | Agendamento | Descrição |
|----------|-------------|-----------|
| `/api/auth/cron/verificar-senhas` | `0 8 * * *` | Verificação de senhas |

---

## Integrações Externas

- **Google Forms** (`google-apps-script/`): Captura inscrições e envia dados para o backend
- **Nodemailer/SMTP**: Envio de termos LGPD para alunos e responsáveis
- **Google Gemini**: IA de captação (busca de editais e análise de oportunidades)
- **Tavily Search**: Busca web para o agente de captação (preferir sempre que TAVILY_API_KEY disponível)

---

## Numeração de Matrícula

Formato: `ITP-ROLE-YYYYMM-###` — ex: `ITP-ALUNO-202503-001`

---

## Arquivos de Documentação

| Arquivo | Conteúdo |
|---------|----------|
| `RELATORIO_IMPLEMENTACAO.md` | Implementação do envio de termos LGPD por e-mail |
| `IMPLEMENTACAO_CURSOS_ATIVOS.md` | Integração de cursos ativos com matrícula direta |
| `FLUXO_MATRICULA_DIRETA.md` | Diagrama do fluxo de matrícula direta |

---

## PLANO DE MELHORIAS — Roadmap Técnico

> Estado registrado em 2026-05-25. Cada item tem diagnóstico do estado atual e passos de implementação.

---

### 1. Unificação Dossiê + Ficha de Aluno (Matrículas ↔ Acadêmico)

**Problema:** Dois módulos separados representam a mesma pessoa em estados diferentes.
- `/matriculas` → `DossieCandidato.tsx` (candidato, baseado em `inscricoes`)
- `/academico` → ficha inline no `page.tsx` (aluno, baseado em `alunos`)
- Não há link visual entre os dois — usuário perde o contexto após a matrícula

**Estado atual do banco:**
- `inscricoes.aluno_id` → FK para `alunos.id` (ligação existe, mas não é explorada na UI)
- `alunos.inscricao_id` → FK reversa também existe

**Solução:** Componente unificado `PerfilPessoa` que muda de camada conforme o status:
```
Candidato:   [Dados Pessoais] [Saúde] [Documentos] [Histórico Status]
Aluno:       [Dados Pessoais] [Saúde] [Documentos] [Histórico Status]
             [Turmas Ativas] [Frequência] [Notas] [Dados Complementares]
```

**Passos:**
1. Criar componente `PerfilPessoa.tsx` em `src/components/` com abas dinâmicas
2. `DossieCandidato.tsx` passa a ser wrapper de `PerfilPessoa` no modo "candidato"
3. `/academico` passa a usar o mesmo componente no modo "aluno"
4. Backend: endpoint `GET /pessoas/:id` que retorna `inscricao + aluno` unificado
5. Adicionar botão "Ver no Acadêmico" no DossieCandidato quando `aluno_id` existir
6. Adicionar botão "Ver Inscrição Original" na ficha do aluno

---

### 2. Doações dentro do Financeiro

**Problema:** Doações são módulo separado (`/doacoes`) mas são receitas financeiras.
- Tabela `doadores` está em `cadastro`, não tem FK direta para `movimentacoes_financeiras`
- Não há tipo de movimentação "Doação" no plano de contas
- Relatório de doações não compõe o DRE

**Solução:**
1. Adicionar aba "Doações" dentro de `/financeiro` (tab, não página separada)
2. Criar tipo de movimentação `tipo_movimentacao = 'doacao'` em `movimentacoes_financeiras`
3. Adicionar coluna `doador_id UUID FK doadores` em `movimentacoes_financeiras`
4. Migration: `ALTER TABLE movimentacoes_financeiras ADD COLUMN IF NOT EXISTS doador_id UUID REFERENCES doadores(id)`
5. Ao registrar uma movimentação de doação, criar/vincular o doador automaticamente
6. Remover `/doacoes` do sidebar após migração (a rota pode permanecer como redirect)
7. Relatório financeiro passa a incluir doações no DRE como "Receitas — Doações"

---

### 3. Módulo Gente — Remoção Completa do Ponto

**Problema:** Sistema de ponto está descontinuado mas ainda existe em todo o sistema.

**O que remover:**

*Frontend:*
- `app/ponto/page.tsx` — página pública de marcação de ponto (deletar)
- Aba "Ponto" em `app/gente/page.tsx` — remover tab e todo código relacionado
- Referências em `ClientShell.tsx` à rota `/ponto` como página sem sidebar

*Backend:*
- Endpoints em `gente.controller.ts`: `GET/POST /gente/ponto`, `/gente/ponto/alertas`, `/gente/ponto/relatorio`, `/gente/ponto/controle`, `DELETE /gente/ponto/:id`
- Endpoints públicos: `/gente/ponto/externo/*`
- `GentePonto` entity e tabela `gente_ponto` (manter tabela por segurança, apenas desativar endpoints)

**Passos:**
1. Remover aba "Ponto" do `gente/page.tsx` (UI)
2. Remover `/ponto` de `ClientShell.tsx` (rotas sem sidebar)
3. Deletar `app/ponto/page.tsx`
4. Marcar endpoints de ponto com `@Deprecated` no controller (não deletar ainda — dados históricos)
5. Remover "Banco de horas" e controles de jornada flexível que dependem de ponto
6. `gente_ponto` tabela: manter no banco, apenas não expor mais na UI

---

### 4. Estoque — Melhorias de Frontend

**Problema:** Interface não está profissional. Arquivos ~2000 linhas indicam componentes monolíticos.

**Diagnóstico específico:**
- `page.tsx` com 2000+ linhas = componente gigante, difícil de manter
- Abas: Visão, Produtos, Movimentos, Categorias, Cotação — cada uma precisa virar componente separado
- Falta dashboard visual: gráfico de consumo por categoria, alertas de mínimo em destaque
- Coletor mobile (`/estoque/coletor`) funciona mas UI é básica

**Melhorias planejadas:**
1. Quebrar `page.tsx` em componentes: `EstoqueVisao`, `EstoqueProdutos`, `EstoqueMovimentos`, `EstoqueCategorias`, `EstoqueCotacao`
2. Dashboard visual: cards com alertas de estoque mínimo em vermelho, gráfico de barras por categoria
3. Tabela de produtos com filtros inline, ordenação e bulk actions
4. Modal de movimentação com validação de quantidade disponível
5. Histórico de movimentos com timeline visual
6. Exportação PDF da posição de estoque atual

---

### 5. Relatórios — Expansão de Tipos

**Problema:** Poucos tipos de relatório para as necessidades do ITP.

**Relatórios existentes:**
- Financeiro (DRE, fluxo de caixa)
- Acadêmico (frequência, evasão)
- Social (perfil de alunos)
- Estoque (posição, movimentos)
- ONG (impacto social)

**Relatórios a adicionar:**

*Acadêmico:*
- Boletim individual do aluno (frequência + notas por turma)
- Declaração de matrícula (PDF com dados do aluno e turma)
- Lista de chamada por turma (PDF para impressão)
- Relatório de evasão com motivos
- Certidão de frequência

*Financeiro:*
- Balancete mensal por plano de contas
- Extrato de doações por período e doador
- Relatório de boletos a vencer (próximos 30/60/90 dias)
- Demonstrativo de Vale Transporte mensal

*RH/Gente (sem ponto):*
- Lista de colaboradores ativos com cargos
- Vencimento de documentos (próximos 30 dias)

*Captação:*
- Pipeline de oportunidades por status e valor estimado
- Taxa de aprovação por fonte de captação

---

### 6. Chamados — Evolução para Modelo GLPI

**Problema:** Chamados estão amadores — simples CRUD sem fluxo real de atendimento.

**Estado atual:**
- Tipos: Social, Acadêmico, Saúde, Família, Financeiro, Gente, Outro
- Status: Aberto, Em andamento, Resolvido
- Sem SLA configurável, sem categorias N-nível, sem base de conhecimento

**Modelo GLPI adaptado para o ITP:**

*Estrutura proposta:*
```
Chamado
├── Categorias hierárquicas (ex: Acadêmico > Falta de Material)
├── SLA por categoria (tempo de resposta e resolução configuráveis)
├── Fila de atendimento (por equipe/setor)
├── Atribuição automática por categoria
├── Templates de resposta
├── Base de conhecimento (artigos de solução)
├── Satisfação do solicitante (pós-resolução)
└── Histórico completo de acompanhamento
```

*Tabelas novas necessárias:*
```sql
chamados_categorias     -- Categorias hierárquicas (parent_id)
chamados_sla            -- SLA por categoria (horas_resposta, horas_resolucao)
chamados_filas          -- Filas de atendimento
chamados_conhecimento   -- Base de conhecimento (artigos)
chamados_satisfacao     -- Avaliação pós-resolução (1-5)
```

*Backend:*
- `ChamadoCategoria` entity com auto-referência (`parent_id`)
- `ChamadoSLA` entity com cálculo de prazo a partir da abertura
- `ChamadoFila` entity para distribuição entre atendentes
- Endpoint de base de conhecimento `GET /chamados/conhecimento`

*Frontend:*
- Dashboard do atendente com visão de fila
- Kanban por fila (diferente de status)
- Widget de SLA com semáforo (verde/amarelo/vermelho)
- Modal de solução com sugestão da base de conhecimento

---

### 7. Captação — Foco e Profundidade do Agente de IA

**Problema:** Agente busca informações genéricas; pouco focado em editais reais com dados concretos.

**Estado atual:**
- Gemini + Tavily Search para buscar oportunidades
- Retorna `title`, `summary`, `match_reasons`, `ai_score`, `ai_confidence`
- Falta: valor, prazo, link direto, requisitos, documentação necessária

**Melhorias no agente:**

*Prompt engineering:*
```
Focar em: FNDE, BNDES, Ministério da Educação, Secretaria de Cultura,
Fundações (Roberto Marinho, Itaú Social, Bradesco), Lei Rouanet,
Lei de Incentivo ao Esporte, editais municipais/estaduais de SP.

Extrair SEMPRE:
- Valor disponível (R$)
- Prazo de submissão (data exata)
- Documentação necessária
- Link oficial do edital
- Requisitos de elegibilidade
- Modalidade (convênio, OS, licitação, incentivo fiscal)
```

*Novos campos na entidade `captacao_opportunities`:*
```sql
ALTER TABLE captacao_opportunities ADD COLUMN IF NOT EXISTS valor_minimo DECIMAL(15,2);
ALTER TABLE captacao_opportunities ADD COLUMN IF NOT EXISTS valor_maximo DECIMAL(15,2);
ALTER TABLE captacao_opportunities ADD COLUMN IF NOT EXISTS prazo_submissao DATE;
ALTER TABLE captacao_opportunities ADD COLUMN IF NOT EXISTS link_edital TEXT;
ALTER TABLE captacao_opportunities ADD COLUMN IF NOT EXISTS documentos_necessarios JSONB;
ALTER TABLE captacao_opportunities ADD COLUMN IF NOT EXISTS requisitos_elegibilidade TEXT;
ALTER TABLE captacao_opportunities ADD COLUMN IF NOT EXISTS modalidade VARCHAR(50);
ALTER TABLE captacao_opportunities ADD COLUMN IF NOT EXISTS orgao_financiador VARCHAR(200);
```

*Frontend `/captacao/buscar`:*
- Exibir valor e prazo em destaque no card
- Filtro por valor mínimo/máximo
- Filtro por prazo (próximos 30/60/90 dias)
- Botão "Abrir Edital" com link direto
- Indicador de urgência quando prazo < 30 dias

---

## Débitos Técnicos Identificados

| Item | Severidade | Descrição |
|------|-----------|-----------|
| Páginas monolíticas | Alta | `matriculas/page.tsx`, `academico/page.tsx`, `gente/page.tsx` com 2000+ linhas cada |
| Módulo Ponto ativo | Alta | Código descontinuado ainda exposto e funcional |
| Doações desconexas | Média | Sem integração com DRE e movimentações financeiras |
| DossieCandidato isolado | Alta | Mesma pessoa representada em dois sistemas |
| Chamados simples | Média | Sem SLA, fila ou base de conhecimento |
| Captação com dados rasos | Média | IA não extrai campos essenciais dos editais |
| Estoque UI amadora | Média | Componente gigante sem separação de responsabilidades |
| Relatórios limitados | Baixa | Faltam relatórios operacionais essenciais |
| Tokens expostos em vercel.json | Baixa | Mover para variáveis privadas do dashboard Vercel |

---

## Decisões Arquiteturais Importantes

- **Migrations inline:** As migrations ficam em `app.module.ts` via SQL raw no `onModuleInit()`, não em arquivos de migration TypeORM separados. Isso é intencional para o ambiente Vercel Serverless.
- **inscricoes usa INT:** Única tabela com PK inteira (auto-increment) em vez de UUID — não alterar.
- **Soft delete:** NUNCA usar DELETE em registros de negócio. Sempre `ativo = false`.
- **Permissões:** Backend valida por role level. Frontend filtra por `modulos_visiveis` do grupo (UX apenas — segurança real é backend).
- **Proxy Vercel:** Frontend em `itp.institutotiapretinha.org` proxia `/backend-api/*` para a API para evitar CORS. Sempre usar o proxy, nunca chamar a API diretamente do browser em produção.

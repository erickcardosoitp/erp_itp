# Arquitetura — ERP ITP

> Detalhe técnico completo: infraestrutura, módulos, dependências, dívidas
> conhecidas. Para regras de trabalho/comandos, ver `CLAUDE.md`.
> Última atualização: 2026-09-09.

---

## 1. Stack

- **Backend**: NestJS + TypeORM, PostgreSQL 17. Node 24.
- **Frontend**: Next.js 15 (App Router), proxy `/backend-api/*` → backend (`next.config.mjs`), elimina CORS.
- **Auth**: JWT em cookie httpOnly (`itp_token`) — login por email/matrícula+senha, **e** SSO Microsoft (Entra ID), em paralelo.
- **Storage de arquivos**: Azure Blob Storage (`stitperpprod`, container `arquivos`) — migrado do Supabase Storage em 2026-09-09. Interface em `apps/backend/src/modules/supabase/supabase.service.ts` (nome mantido por compatibilidade, ver nota no arquivo).
- **Email**: Microsoft Graph API (`POST /users/{mailbox}/sendMail`), caixa `projetos@institutotiapretinha.org` — migrado do Gmail SMTP em 2026-09-09. Não usa SMTP: o tenant tem "Security Defaults" ativo (bloqueia autenticação legada/SMTP AUTH tenant-wide) e não há licença Entra ID P1 pra Conditional Access de exceção — Graph API com OAuth2 app-only contorna isso sem enfraquecer a segurança do tenant. `GraphMailTransport` em `apps/backend/src/email.service.ts` implementa a interface de transport do nodemailer, reaproveitando o App Registration do SSO (`MS_CLIENT_ID`/`MS_CLIENT_SECRET`/`MS_TENANT_ID`), permissão `Mail.Send` (Application). **Pendência de hardening**: `Mail.Send` (Application) por padrão permite enviar como qualquer mailbox do tenant, não só `projetos@` — restringir via Application Access Policy do Exchange Online exige Exchange Online PowerShell, que está bloqueado nesta VM/sessão por Conditional Access (dispositivo não gerenciado/compliant).

---

## 2. Infraestrutura (produção)

Tudo roda numa única VM Azure (`vm-itp-prod`, Oracle Linux 9, `20.114.240.177`), via Docker Compose. Decisão consciente de correlacionar falhas em troca de visibilidade/controle direto (ver histórico da migração em `docs/superpowers/` do repo `aprxm_sass`, arquivo `2026-09-06-migracao-vm-plan.md` — é o registro completo e cronológico de toda a migração Vercel→VM, SSO, storage, backups).

```
Internet → Traefik (SSL Let's Encrypt, roteamento por domínio)
             ├─ itp.institutotiapretinha.org       → erp_itp_frontend (Next.js, :3000)
             └─ api.itp.institutotiapretinha.org   → erp_itp_backend  (NestJS, :3001)
Postgres (itp_postgres, :5432) — só rede interna Docker
pgAdmin4 (:5050) — só localhost da VM (acesso via X2Go/MATE)
```

**Backup em 2 camadas** (cron na própria VM, sem depender de serviço externo pago):
| Camada | O quê | Frequência | Onde |
|---|---|---|---|
| Dados | `pg_dump` do Postgres → restaura no Neon (banco original, agora só alvo de backup) | 6h | `~/pg-sync-to-neon.sh` |
| Máquina | Snapshot incremental do disco Azure | Diário (3h) | `~/vm-snapshot.sh`, via managed identity da VM |

**Deploy**: `~/erp_itp/deploy.sh` na VM — `git pull` + `docker compose build/up` + limpeza de cache >24h.

---

## 3. Autenticação

Dois métodos coexistindo, sem um substituir o outro:

1. **Senha** (`POST /auth/login`): email ou matrícula + senha, bcrypt. Conta com `role: 'admin'` só entra por matrícula (nunca email).
2. **SSO Microsoft** (`GET /auth/microsoft` → `GET /auth/microsoft/callback`): OAuth2 Authorization Code manual (sem lib pesada de OIDC — `fetch` nativo + `jsonwebtoken`/`jwks-rsa` só pra validar assinatura do id_token). Casa por e-mail com `usuarios.email`. **Não cria conta automaticamente** — sem conta prévia, gera notificação de "solicitação de acesso" (visível pra role DRT+) com sugestão de cargo baseada no grupo de maior hierarquia da pessoa no Entra ID (Graph API, client-credentials).

Ambos emitem o mesmo cookie `itp_token`. Detalhe não-óbvio: o `redirect_uri` do SSO aponta pro **frontend** (`itp.institutotiapretinha.org/backend-api/auth/microsoft/callback`), não direto pro backend (`api.itp.*`) — necessário pra o `Set-Cookie` sair do domínio certo (ver `auth.controller.ts`, comentário no topo). Cookie do SSO usa `SameSite=Lax` (não `Strict` como o login normal) pelo mesmo motivo de fluxo de redirect cross-site.

Guards globais (`APP_GUARD`): `JwtAuthGuard` + `RolesGuard` em toda a app; rotas liberadas via `@Public()`. Autorização granular por módulo: `ModuloPermGuard` + `@ModuloPerm(modulo, acao)`, consultando `grupo_permissoes` (JSON) do grupo do usuário, com fallback por `ROLE_LEVEL` (`user:0 → cozinha:1 → assist:2 → monitor:3 → prof:4 → adjunto:5 → drt:8 → vp:9 → prt:10 → admin:10`) quando o grupo não tem permissão explícita pro módulo.

---

## 4. Migrations

**Não usa** o mecanismo padrão `typeorm migration:run` (apesar de existir um arquivo órfão em `apps/backend/src/migrations/` e comandos documentados no `CLAUDE.md` — não estão claros se são realmente executados ou vestígio de tentativa anterior; **confirmar antes de assumir que funcionam**). O mecanismo real é `runMigrations()` em `apps/backend/src/app.module.ts`:

- Gated por tabela `_schema_version` (coluna `version`), constante `SCHEMA_VERSION` no topo da função.
- Idempotente (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) — **todo bloco reexecuta caso a versão local seja menor que `SCHEMA_VERSION`**, então todo bloco precisa ser replay-safe.
- Roda em `onModuleInit` via `setImmediate` (fire-and-forget, não trava o cold start).
- Versão atual: **v22** (2026-09-09) — v21 adicionou FK do financeiro, v22 adicionou soft delete.

---

## 5. Módulos do backend (`apps/backend/src/`)

| Módulo | Responsabilidade | Entidades principais |
|---|---|---|
| `auth` | Login (senha + SSO), reset/troca de senha | `Usuario` |
| `usuarios` | Perfil do usuário logado (sem `.module.ts` próprio — controller usa `AuthService`) | `Usuario` |
| `academico` | Cursos, turmas, grade, diário, presença/chamada, chamados internos, futebol/ballet | `Curso`, `Professor`, `Turma`, `DiarioAcademico`, `ChamadoAcademico`, etc. |
| `alunos` | Complemento cadastral, documentos do aluno | `Aluno`, `AlunoComplemento`, `DocumentoValidacao` |
| `matriculas` | Inscrição pública → matrícula, LGPD, documentos por token | `Inscricao`, `DocumentoInscricao` |
| `cadastro` | Insumos, doadores, contas bancárias | `Insumo`, `Doador`, `ContaBancaria` |
| `captacao` | Pipeline de captação de recursos com IA (Gemini) | `CaptacaoOpportunity` |
| `estoque` | Estoque + endpoint público pra coletor de código de barras | `Produto`, `MovimentoEstoque` |
| `financeiro` | Movimentações, boletos/parcelas, lookups (categoria/plano/tipo/forma) | `MovimentacaoFinanceira`, `Boleto`, `BoletoParcela` |
| `funcionarios` | Cadastro, webhook do Google Forms | `Funcionario` (fica em `academico/entities/`) |
| `gente` | RH: folha, recibos, vales, advertências, faltas, folgas (geofencing) | `GenteColaborador` + ~12 entidades `Gente*` |
| `grupos` | RBAC (`grupo_permissoes` JSON) | `Grupo` |
| `modules/users` | Admin de usuários + config-listas | `Usuario` |
| `modules/supabase` | Storage de arquivos (hoje Azure Blob) — `@Global()` | — |
| `notificacoes` | Notificações internas, `cargo_minimo` (visibilidade por nível) | `Notificacao` |
| `pesquisas` | NPS/satisfação, link público | `Pesquisa`, `PesquisaResposta` |
| `projetos` | Projetos sociais, equipes, inscrições, presença | `Projeto`, `ProjetoEquipe`, `ProjetoInscricao` |
| `publico` | Transparência (`GET /publico/prestacao-contas`) | — |
| `relatorios` | Dashboards agregados (DRE, fluxo de caixa, etc.) — sem entidade própria | — |
| `responsaveis` | Responsáveis legais de aluno | `Responsavel` |

**Dependências entre módulos**: `notificacoes` é folha, consumido por quase todos. `modules/supabase` é `@Global`, injetado implicitamente em `academico`, `alunos`, `auth`, `funcionarios`, `gente`, `matriculas`, `projetos`. `gente` referencia `MovimentacaoFinanceira` direto (acoplamento de entidade, sem importar `FinanceiroModule`). `relatorios` provavelmente lê entidades de outros módulos via `TypeOrmModule.forFeature` direto, sem depender dos modules.

---

## 6. Frontend (`apps/frontend/src/app/`)

Mapeamento rota → módulo backend:

| Rota | Módulo |
|---|---|
| `/login`, `/esqueci-senha`, `/reset-senha/[token]`, `/trocar-senha` | `auth` |
| `/academico` (+ Alunos/Presença/Diário/Monitoramento) | `academico` |
| `/matriculas`, `/inscricao`, `/lgpd/[token]`, `/documentos/[token]` | `matriculas` |
| `/gente` | `gente` |
| `/financeiro`, `/doacoes` | `financeiro` |
| `/cadastro` | `cadastro` |
| `/estoque`, `/estoque/coletor` | `estoque` |
| `/captacao*` | `captacao` |
| `/projetos*` | `projetos` |
| `/pesquisa/[link]`, `/pesquisas` | `pesquisas` |
| `/notificacoes` | `notificacoes` |
| `/relatorios` | `relatorios` |
| `/config` | `grupos` + `modules/users` |

---

## 7. Dívidas conhecidas / achados (não corrigidos ainda)

Auditoria de banco completa em `docs/database-audit-2026-09-08.md` (repo `aprxm_sass`) — P0 (FK financeiro, soft delete) já implementados em 2026-09-09; P1 (índices em FK, CHECK/enum) e P2 (nomenclatura) ainda pendentes.

**Achados de código (levantamento 2026-09-09, não corrigidos)**:

1. **Rotas de chamada duplicadas no frontend** — `/chamada` + `/chamada-professor` (raiz) E `/academico/chamada` + `/academico/chamada-professor` são duas implementações completas e ativas do mesmo fluxo (chamada via QR/link), batendo nos mesmos endpoints. `LaunchPad.tsx` gera link pra uma versão, `PresencaTab.tsx` (dentro de `academico`) gera link pra outra. Não é código morto — duplicação funcional genuína, provável evolução paralela nunca consolidada.
2. **`apps/frontend/src/app/relatorios/page.jsx` é arquivo órfão** — coexiste com `relatorios/page.tsx` (o real, 2183 linhas). O `.jsx` tem 35 linhas, dados mockados, provavelmente quebra o build ou é ignorado silenciosamente (dois `page.*` na mesma pasta do App Router colidem). Candidato a remoção.
3. **`FuncionariosController` possivelmente registrado 2x** — aparece via `FuncionariosModule.controllers` E via `require()` dinâmico direto em `AppModule.controllers` (linha ~142). Vale investigar se causa rota duplicada ou é noop.
4. **`matriculas/database.ts`** — nome/padrão fora do convencionado (`*.service.ts`/`*.entity.ts`) usado no resto do projeto. Verificar se é acesso cru ao banco paralelo ao TypeORM.
5. **`auth` e `usuarios` sem `.module.ts` próprio** — registrados direto em `AppModule`, fora do padrão do resto do projeto (todo módulo de negócio tem seu module).
6. **✅ Resolvido (2026-09-09)** — Soft delete agora cobre também as queries SQL cru: `@DeleteDateColumn` já cobria `find()`/`findOne()` do TypeORM automaticamente, e as 31 queries manuais (`this.db.query()`/`dataSource.query()`) em `relatorios.service.ts` (25), `publico.service.ts` (5, inclui a página **pública** de prestação de contas) e `academico.service.ts` (1) contra `movimentacoes_financeiras` agora têm `deleted_at IS NULL` explícito. Ver commit `fix(soft-delete): adiciona deleted_at IS NULL...`.
7. **`alunos` não usa soft delete** — decisão deliberada: o endpoint de exclusão (`academico.service.ts`) já é hard-delete intencional (LGPD, "direito ao esquecimento"), gated por "só exclui aluno já inativo" via flag `ativo`. Adicionar `deleted_at` ali romperia esse fluxo.
8. **Comandos `typeorm:migration:*` no `CLAUDE.md`** podem não refletir o mecanismo real (`runMigrations()` em `app.module.ts`) — confirmar antes de usar.

---

## 8. Referências

- Histórico completo da migração de infra (VM, SSO, storage, backups, incidentes e fixes): repo `aprxm_sass`, `docs/superpowers/plans/2026-09-06-migracao-vm-plan.md`.
- Auditoria de banco de dados: repo `aprxm_sass`, `docs/database-audit-2026-09-08.md`.

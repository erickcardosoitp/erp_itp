# CLAUDE.md — ERP ITP

Sistema de Gestão Empresarial para o ITP (Instituto Técnico/Politécnico). Monorepo com backend NestJS e frontend Next.js, voltado para gestão acadêmica, financeira e operacional da instituição.

---

## Estrutura do Projeto

```
erp_itp/
├── apps/
│   ├── backend/          # API NestJS (TypeORM + PostgreSQL)
│   └── frontend/         # Next.js 15 (App Router)
├── google-apps-script/   # Integração com Google Forms
├── CLAUDE.md             # Este arquivo
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

### Módulos

| Módulo | Responsabilidade |
|--------|-----------------|
| `auth` | Autenticação JWT + guards de roles |
| `matriculas` | Inscrições, LGPD, matrícula direta |
| `academico` | Cursos, turmas, horários, chamada, notas |
| `modules/users` | Gestão de usuários |
| `funcionarios` | Gestão de funcionários |
| `estoque` | Produtos, movimentações, categorias |
| `financeiro` | Plano de contas, movimentações, formas de pagamento |
| `cadastro` | Dados mestre: doadores, contas bancárias, insumos |
| `grupos` | Grupos de permissão |
| `notificacoes` | Sistema de notificações |
| `relatorios` | Geração de relatórios |

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

### Padrões do banco de dados

- **PK:** UUID via `gen_random_uuid()`
- **Soft delete:** campo `ativo: boolean`
- **Timestamps:** `createdAt`, `updatedAt`
- **Sincronize:** desabilitado — usar migrations
- **Migrations automáticas:** executadas em `onModuleInit()` via SQL raw

### Email

Serviço `EmailService` usa Nodemailer + SMTP. Métodos principais:
- `enviarTermoLGPD()` — envia termo para o aluno
- `enviarTermoLGPDResponsavel()` — envia termo para responsável (alunos <18)

---

## Arquitetura — Frontend

**Framework:** Next.js 15.5 (App Router) | **UI:** React 19 + Shadcn/UI + Tailwind CSS
**Porta local:** 3000

### Rotas principais

| Rota | Descrição |
|------|-----------|
| `/login` | Autenticação |
| `/dashboard` | Painel principal |
| `/matriculas` | Gestão de matrículas e formulário de matrícula direta |
| `/academico` | Módulo acadêmico (cursos, turmas) |
| `/academico/chamada` | Controle de presença |
| `/estoque` | Gestão de estoque |
| `/estoque/coletor` | Coletor mobile de estoque |
| `/financeiro` | Gestão financeira |
| `/cadastro` | Dados mestre |
| `/doacoes` | Gestão de doações |
| `/relatorios` | Geração de relatórios |
| `/notificacoes` | Central de notificações |
| `/documentos/[token]` | Assinatura de termos LGPD (dinâmico) |
| `/lgpd/[token]` | Aceite de termo LGPD (dinâmico) |
| `/config` | Configurações |
| `/esqueci-senha` / `/reset-senha` / `/trocar-senha` | Fluxo de senha |

### Estado global

`AuthContext` (`src/context/auth-context.tsx`):
- Armazena payload do usuário: `email`, `role`, `sub`, `nome`, `fotoUrl`, `grupo`
- Carrega via `GET /api/usuarios/perfil` no mount
- Hook: `useAuth()` — acessa o contexto
- Hook: `usePermissions(userRole)` — retorna `canWrite`, `canRead`

### Integração com API

- **Variável:** `NEXT_PUBLIC_API_BASE_URL`
- **Proxy Next.js:** `/backend-api/*` → backend `/api/*` (evita CORS)
- **Uploads:** `/uploads/*` roteado ao diretório de uploads do backend
- **Interceptors Axios:** token JWT injetado automaticamente em todas requisições
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

- Variáveis de ambiente gerenciadas pelo dashboard Vercel
- CORS: dinâmico em dev (localhost + 192.168.x.x), domínios fixos em produção
- Arquivos estáticos: servidos pelo backend, proxiados pelo frontend via rewrites
- **Sem GitHub Actions** — deploy automático via integração Vercel + repositório Git

### Funções Serverless (backend)

| Arquivo | Memória | Timeout | Função |
|---------|---------|---------|--------|
| `api/main.ts` | 1024 MB | 30s | Toda a API NestJS |
| `api/health.ts` | 128 MB | 10s | Health check |

### Cron Jobs (Vercel)

| Endpoint | Agendamento | Descrição |
|----------|-------------|-----------|
| `/api/auth/cron/verificar-senhas` | `0 8 * * *` (08h UTC diário) | Verificação de senhas |

### Tokens de acesso especial (hardcoded em `vercel.json`)

```
COLETOR_TOKEN / NEXT_PUBLIC_COLETOR_TOKEN  = itp-coletor-2026
CHAMADA_TOKEN / NEXT_PUBLIC_CHAMADA_TOKEN  = itp-chamada-2026
```

> ⚠️ Esses tokens estão expostos no `vercel.json` — considerar mover para variáveis de ambiente privadas no dashboard Vercel.

---

## Integrações Externas

- **Google Forms** (`google-apps-script/`): Captura inscrições e envia dados para o backend, incluindo e-mail do responsável para LGPD
- **Nodemailer/SMTP**: Envio de termos LGPD para alunos e responsáveis

---

## Numeração de Matrícula

Formato automático: `ITP-ROLE-YYYYMM-###`
Exemplo: `ITP-ALUNO-202503-001`

---

## Arquivos de Documentação

| Arquivo | Conteúdo |
|---------|----------|
| `RELATORIO_IMPLEMENTACAO.md` | Implementação do envio de termos LGPD por e-mail |
| `IMPLEMENTACAO_CURSOS_ATIVOS.md` | Integração de cursos ativos com matrícula direta |
| `FLUXO_MATRICULA_DIRETA.md` | Diagrama do fluxo de matrícula direta |

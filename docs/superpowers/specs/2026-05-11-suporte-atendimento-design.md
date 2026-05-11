# Design: Seção Suporte e Atendimento — Site Institucional + ERP ITP

**Data:** 2026-05-11
**Status:** Aprovado

---

## Visão Geral

Adicionar seção "Suporte e Atendimento" ao site institucional (`website-tia-pretinha`) com dois modos: abertura de chamado e consulta de chamado. Os chamados abertos pelo site caem no módulo de chamados do ERP com tipo `Suporte`, notificam a equipe por e-mail e notificação interna, e podem ser consultados publicamente via protocolo ou nome, com resumo gerado por IA.

---

## Arquitetura

```
[Site institucional - Vite/React]
  Seção #suporte → Tab "Abrir Chamado" | Tab "Consultar Chamado"
        ↓ POST multipart/form-data          ↓ GET ?q=protocolo|nome
[ERP Backend - NestJS]
  POST /api/chamados/publico (@Public)   GET /api/chamados/publico/consultar (@Public)
        ↓                                        ↓
  Salva chamado (protocolo gerado)        Busca chamado + Claude API (resumo IA)
  Salva arquivos /uploads/chamados-publicos/
  E-mail → DRT + PRT + admin
  Notificação interna ERP
```

---

## Backend

### 1. Número de Protocolo (todos os chamados)

- Novo campo `protocolo VARCHAR` na entidade `ChamadoAcademico`
- Formato: `ITP-YYYYMM-###` (ex: `ITP-202605-001`)
- Gerado automaticamente em `criarChamado()` para **todos** os chamados (site e internos)
- Sequencial por mês: busca o último protocolo do mês corrente e incrementa
- Migration via SQL raw no `onModuleInit` do `AcademicoModule`:
  ```sql
  ALTER TABLE chamados_academicos ADD COLUMN IF NOT EXISTS protocolo VARCHAR;
  ```

### 2. Endpoint Público — Abrir Chamado

```
POST /api/chamados/publico
@Public() — sem autenticação
Content-Type: multipart/form-data
```

**Campos aceitos:**

| Campo | Tipo | Obrigatório |
|---|---|---|
| nome | string | ✅ |
| email | string (email) | ✅ |
| telefone | string | ✅ |
| nome_aluno | string | — |
| assunto | string (enum) | ✅ |
| mensagem | string | ✅ |
| arquivos | File[] (max 3, 5MB cada) | — |

**Assuntos válidos:** `Matrícula`, `Financeiro`, `Acadêmico`, `Dúvida Geral`, `Suporte`, `Outro`

**Processamento:**
1. Valida campos obrigatórios e limites de arquivo
2. Salva arquivos em `/uploads/chamados-publicos/` com nome único (timestamp + original)
3. Cria chamado: `tipo: 'Suporte'`, `status: 'aberto'`, `criado_por_nome: nome`, `titulo: assunto`, `descricao: mensagem + telefone + nome_aluno + URLs dos arquivos`
4. Gera protocolo via `criarChamado()`
5. Envia e-mail para todos os usuários com role `drt`, `prt`, `admin` (busca no banco)
6. Cria notificação interna ERP (tipo `novo_chamado`)
7. Retorna `{ protocolo, mensagem: 'Chamado aberto com sucesso' }`

**Proteções:**
- Tamanho máximo por arquivo: 5MB
- Máximo de 3 arquivos
- Tipos permitidos: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`

### 3. Endpoint Público — Consultar Chamado

```
GET /api/chamados/publico/consultar?q=<protocolo_ou_nome>
@Public() — sem autenticação
```

**Busca:**
- Se `q` começa com `ITP-`: busca exata por `protocolo`
- Caso contrário: busca parcial por `criado_por_nome` (ILIKE)
- Retorna no máximo 3 resultados para busca por nome

**Dados expostos (nunca expõe UUIDs internos, aluno_id, dados sensíveis):**
```json
{
  "protocolo": "ITP-202605-001",
  "titulo": "Matrícula",
  "tipo": "Suporte",
  "status": "aberto",
  "criado_em": "2026-05-11T10:00:00Z",
  "atualizado_em": "2026-05-11T14:00:00Z",
  "resumo_ia": "Seu chamado foi recebido em 11/05/2026..."
}
```

**Geração do resumo IA:**
- Chama `claude-haiku-4-5` via Anthropic SDK com os dados do chamado
- Prompt: gera parágrafo em português, tom amigável, explica o status atual e orienta o próximo passo
- `ANTHROPIC_API_KEY` configurada no `.env` do backend e no dashboard Vercel

### 4. Multer (upload de arquivos)

- Usar `@nestjs/platform-express` com `FilesInterceptor` (já disponível no NestJS)
- Destino: `./uploads/chamados-publicos/`
- Nome do arquivo: `${Date.now()}-${originalname}`

---

## Frontend (Site Institucional)

### Menu de Navegação

Adicionar `'suporte'` ao array de seções em `App.jsx`, com label `'Suporte'`, entre `'transparencia'` e `'matricule-se'`.

### Seção `#suporte`

Visual consistente com o site: fundo roxo escuro (`bg-[#1a0a35]`), texto branco, destaque amarelo.

**Estrutura:**
```
<section id="suporte">
  <h2>SUPORTE E ATENDIMENTO</h2>
  <p>subtítulo</p>
  <div class="tabs">
    [Abrir Chamado] [Consultar Chamado]
  </div>
  <div class="tab-content">
    {activeTab === 'abrir' ? <FormAbrir /> : <FormConsultar />}
  </div>
</section>
```

### Tab "Abrir Chamado"

- Campos: nome, e-mail, telefone, nome do aluno (opcional), assunto (select), mensagem (textarea), anexos (input file múltiplo)
- Validação client-side: campos obrigatórios, extensão/tamanho dos arquivos
- Estado de loading no botão durante o POST
- Sucesso: card verde com protocolo gerado — *"Chamado aberto! Protocolo: ITP-202605-001. Guarde este número."*
- Erro: mensagem vermelha descritiva

### Tab "Consultar Chamado"

- Campo único: "Digite seu protocolo (ITP-XXXXXX-XXX) ou seu nome"
- Botão "Consultar" com loading state
- Resultado: card com badge de status (cor por status), data de abertura, tipo, e parágrafo do resumo IA
- Sem resultado: *"Chamado não encontrado. Verifique o protocolo ou entre em contato pelo WhatsApp."*

### Chamadas de API

- Abrir: `POST /backend-api/chamados/publico` (multipart/form-data)
- Consultar: `GET /backend-api/chamados/publico/consultar?q=...`

O proxy `/backend-api/*` do `next.config.mjs` **não se aplica** ao site institucional (Vite). As chamadas vão diretamente para `https://itp.institutotiapretinha.org/api/chamados/publico`.

---

## Variáveis de Ambiente

### Backend `.env` / Vercel dashboard:
```
ANTHROPIC_API_KEY=sk-ant-...
```

### CORS
O endpoint `/api/chamados/publico` precisa aceitar origem `https://institutotiapretinha.org` além das já permitidas.

---

## Fora do Escopo

- Chat ao vivo / WebSocket
- Autenticação do visitante
- Histórico completo de acompanhamentos na consulta pública
- Rate limiting avançado (pode ser adicionado futuramente)

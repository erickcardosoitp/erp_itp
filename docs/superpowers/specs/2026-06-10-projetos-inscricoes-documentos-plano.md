# Plano de Implementação: Projetos — Inscrições, Documentação e Confirmação

**Spec:** `2026-06-10-projetos-inscricoes-documentos-design.md`
**Data:** 2026-06-10

---

## Pré-requisito (manual — fora do código)

- [ ] Login em supabase.com com `dev.itp@institutotiapretinha.org`
- [ ] Criar projeto `erp-itp` (região: South America São Paulo)
- [ ] Criar bucket `arquivos` (privado)
- [ ] Copiar `Project URL` e `service_role key` em Settings → API
- [ ] Adicionar ao `.env.local` do backend:
  ```
  SUPABASE_URL=https://xxxx.supabase.co
  SUPABASE_SERVICE_KEY=...
  SUPABASE_BUCKET=arquivos
  ```
- [ ] Adicionar as mesmas vars no dashboard do Vercel (backend)

---

## Etapa 1 — SupabaseService

**Arquivo:** `apps/backend/src/modules/supabase/supabase.service.ts`
**Arquivo:** `apps/backend/src/modules/supabase/supabase.module.ts`

- Instalar: `npm install @supabase/supabase-js sharp` no backend
- `SupabaseService` com métodos `upload`, `getSignedUrl`, `delete`
- `SupabaseModule` exporta `SupabaseService` como global (`@Global()`)
- Importar `SupabaseModule` em `AppModule`

**Validações:**
- `upload` rejeita arquivos > 5MB antes de enviar
- `upload` usa `sharp` para redimensionar para máx 1920px e converter para JPEG quality 85
- Path no bucket: `projetos/{projeto_id}/inscricoes/{inscricao_id}/{tipo}.jpg`

---

## Etapa 2 — Migration

**Arquivo:** `apps/backend/src/app.module.ts` (bloco `onModuleInit`)

Adicionar ao SQL de migrations inline:

```sql
-- Nova tabela de documentos de inscrição de projetos
CREATE TABLE IF NOT EXISTS projeto_inscricao_documentos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inscricao_id  UUID NOT NULL REFERENCES projeto_inscricoes(id) ON DELETE CASCADE,
  tipo          VARCHAR NOT NULL,
  url_arquivo   TEXT NOT NULL,
  created_at    TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proj_insc_docs_inscricao
  ON projeto_inscricao_documentos(inscricao_id);

-- Nova coluna de email na tabela de inscrições
ALTER TABLE projeto_inscricoes
  ADD COLUMN IF NOT EXISTS email_responsavel VARCHAR;
```

---

## Etapa 3 — Entity e DTOs

**Arquivo:** `apps/backend/src/projetos/entities/projeto-inscricao-documento.entity.ts`

```typescript
@Entity('projeto_inscricao_documentos')
export class ProjetoInscricaoDocumento {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column() inscricao_id: string
  @Column() tipo: string
  @Column() url_arquivo: string
  @CreateDateColumn() created_at: Date
  @ManyToOne(() => ProjetoInscricao, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inscricao_id' })
  inscricao: ProjetoInscricao
}
```

**Arquivo:** `apps/backend/src/projetos/dto/create-documento.dto.ts`
- `tipo: string` (validar enum dos 6 tipos)

Adicionar em `ProjetoInscricao` entity:
- `@Column({ nullable: true }) email_responsavel: string`
- `@OneToMany` para `ProjetoInscricaoDocumento`

---

## Etapa 4 — Endpoints de Documentos

**Arquivo:** `apps/backend/src/projetos/projetos.controller.ts`
**Arquivo:** `apps/backend/src/projetos/projetos.service.ts`

### Controller

```typescript
@Post(':id/inscricoes/:iId/documentos')
@UseInterceptors(FileInterceptor('arquivo'))
uploadDocumento(@Param() params, @UploadedFile() file, @Body('tipo') tipo)

@Get(':id/inscricoes/:iId/documentos')
findDocumentos(@Param() params)

@Delete(':id/inscricoes/:iId/documentos/:docId')
removeDocumento(@Param() params)
```

### Service — `uploadDocumento()`
1. Validar `tipo` contra enum dos 6 tipos válidos
2. Chamar `SupabaseService.upload(file.buffer, path, file.mimetype)`
3. Upsert em `projeto_inscricao_documentos` (mesmo tipo substitui)
4. Retornar `{ id, tipo, url_arquivo }`

### Service — `findDocumentos()`
1. Buscar todos os docs da inscrição
2. Para cada um: gerar signed URL via `SupabaseService.getSignedUrl(path, 3600)`
3. Retornar lista com `{ id, tipo, signed_url, created_at }`

### Service — `removeDocumento()`
1. Buscar doc, extrair path
2. `SupabaseService.delete(path)`
3. Deletar registro da tabela

---

## Etapa 5 — Endpoint de Busca para Reinscrição

**Arquivo:** `apps/backend/src/projetos/projetos.controller.ts`

```typescript
@Get('inscricoes/buscar')
buscarInscricaoAnterior(@Query('nome') nome: string, @Query('nascimento') nascimento: string)
```

### Service — `buscarInscricaoAnterior()`
- Query em `projeto_inscricoes` por `nome_completo ILIKE` + `data_nascimento`
- Retorna inscrição mais recente com documentos (sem signed URLs — só paths para reaproveitamento interno)
- Se não encontrar: retorna `null`

---

## Etapa 6 — doc_status em findInscricoes

**Arquivo:** `apps/backend/src/projetos/projetos.service.ts`

Constante dos tipos obrigatórios:
```typescript
const TIPOS_OBRIGATORIOS = [
  'foto_aluno', 'identidade_aluno', 'identidade_responsavel',
  'comprovante_residencia', 'certidao_nascimento'
]
```

Modificar `findInscricoes()`:
- **Externos:** subquery conta tipos obrigatórios em `projeto_inscricao_documentos`
- **Alunos ITP:** subquery conta tipos obrigatórios em `documentos_inscricao` por `aluno_id`
  - Mapear tipos do módulo Matrículas para os tipos do Projetos (verificar nomes reais antes)
- Adicionar campo calculado `doc_status: 'ok' | 'pendente'` no resultado
- Adicionar campo `docs_pendentes: string[]` com os tipos faltantes (para tooltip)

---

## Etapa 7 — Email de Confirmação

**Arquivo:** `apps/backend/src/email/email.service.ts`

Novo método `enviarConfirmacaoInscricao(dados)`:

```typescript
{
  email: string
  nome_crianca: string
  nome_responsavel: string
  nome_projeto: string
  data_inicio: string
  data_fim: string
  equipe?: string
  docs_pendentes: string[]  // ex: ['declaracao_escolar']
  telefone_instituto: string
}
```

Template HTML simples com:
- Confirmação de inscrição
- Dados do projeto e equipe
- Aviso de docs pendentes (se houver)
- Instrução para declaração escolar física

Chamar em `createInscricao()` após salvar — se não tiver email, logar warning e não bloquear.

---

## Etapa 8 — Frontend: Tabela de Inscritos

**Arquivo:** `apps/frontend/app/projetos/[id]/page.tsx`

Substituir lista atual na aba "Inscritos" por `<Table>` do Shadcn/UI:

Colunas: Nome | Idade | Responsável | Cuidados Especiais | Data Inscrição | Equipe | Documentação

- Coluna Documentação: `<Badge variant="success">OK</Badge>` ou `<Badge variant="warning">PENDENTE</Badge>`
- `<Tooltip>` no badge PENDENTE mostrando `docs_pendentes` formatados
- Filtros acima da tabela: select de equipe + toggle `todos | ok | pendente`
- `onClick` na linha abre `DrawerDocumentos`

---

## Etapa 9 — Frontend: Componente DocumentCamera

**Arquivo:** `apps/frontend/src/components/projetos/DocumentCamera.tsx`

Props: `tipo: string`, `onCapture: (blob: Blob) => void`, `onClose: () => void`

1. `useRef` para o elemento `<video>` e `<canvas>`
2. `getUserMedia({ video: { facingMode: 'environment', width: 1920 } })`
3. Overlay SVG com retângulo guia — proporção A4 para docs de papel, 85:54 para RG/CNH
4. Botão captura: `canvas.drawImage(video)`, recorta área do guia
5. `ctx.filter = 'contrast(1.2) brightness(1.05)'` antes do draw
6. Preview do resultado com botões "Usar" / "Tirar novamente"
7. "Usar": `canvas.toBlob(cb, 'image/jpeg', 0.9)` → chama `onCapture`
8. Fallback: `<input type="file" accept="image/*">` visível abaixo dos botões

Tipos que usam guia RG/CNH: `identidade_aluno`, `identidade_responsavel`
Tipos que usam guia A4: `declaracao_escolar`, `comprovante_residencia`, `certidao_nascimento`
Tipo foto: `foto_aluno` — guia quadrado

---

## Etapa 10 — Frontend: Tela de Inscrição Externa — Passo 1

**Arquivo:** `apps/frontend/app/projetos/[id]/page.tsx` (modal de inscrição externa)

Adicionar ao formulário existente:
- Campo `email_responsavel` (obrigatório)
- Lógica de reinscrição: ao sair do campo `nome_completo` ou `data_nascimento`:
  - Se ambos preenchidos: `GET /projetos/inscricoes/buscar?nome=&nascimento=`
  - Se encontrar: exibir `<Alert>` com nome do projeto anterior e botão "Pré-preencher dados"
  - Se confirmado: preencher todos os campos do formulário
  - Guardar `inscricao_anterior_id` no estado para o passo 2

---

## Etapa 11 — Frontend: Tela de Inscrição Externa — Passo 2

**Arquivo:** `apps/frontend/app/projetos/[id]/page.tsx`

Após salvar inscrição (passo 1), avançar para tela de documentos:

Grid 3×2 de cards de upload:
- Cada card: ícone do tipo, label, estado (aguardando / enviando / ✓ / erro)
- Botão "Fotografar": abre `<DocumentCamera>`
- Ao capturar: `POST /projetos/:id/inscricoes/:iId/documentos` (multipart)
- Upload imediato, sem esperar os outros — todos em paralelo via `Promise.all` não bloqueante
- Se reinscrição: card mostra "Usar foto anterior" (reaproveita path do Supabase via cópia no backend) ou "Fotografar novamente"
- `declaracao_escolar`: botão adicional "Marcar como PENDENTE" — define `declaracaoPendente = true` localmente
- Botão "Concluir": ativo apenas quando os 5 obrigatórios estão `✓` — avança para tela de confirmação

---

## Etapa 12 — Frontend: Tela de Confirmação Pós-Inscrição

**Arquivo:** `apps/frontend/app/projetos/[id]/page.tsx`

Tela final após concluir o passo 2:
- Nome do inscrito, equipe, resumo de docs
- Botão "Enviar confirmação por email" → chama endpoint de reenvio de email
- Botão "Enviar pelo WhatsApp" → abre em nova aba:
  ```
  https://wa.me/55{telefone_sem_formatacao}?text={encodeURIComponent(mensagem)}
  ```
- Botão "Nova inscrição" → reseta o formulário
- Botão "Fechar" → fecha modal

---

## Etapa 13 — Frontend: Inscrição Aluno ITP com Status de Docs

**Arquivo:** `apps/frontend/app/projetos/[id]/page.tsx`

No modal de inscrição ITP, após selecionar o aluno:
- Exibir lista dos 5 tipos obrigatórios com ✓ / ✗ baseado em `doc_status` retornado pelo backend
- Se algum ✗: `<Alert variant="warning">` — "Documentação incompleta. Orientar entrega no módulo Matrículas."
- Não bloqueia a inscrição — apenas informa

---

## Etapa 14 — Frontend: DrawerDocumentos

**Arquivo:** `apps/frontend/src/components/projetos/DrawerDocumentos.tsx`

Props: `inscricao`, `projetoId`, `onClose`

- `GET /projetos/:id/inscricoes/:iId/documentos` ao abrir
- **Externo:**
  - Cards por tipo com `<img>` thumbnail (signed URL)
  - Botão "Substituir": abre `DocumentCamera` → faz upload → atualiza signed URL
  - Botão "Remover": `DELETE` + remove card
  - Cards de tipos faltantes com botão "Fotografar"
  - `declaracao_escolar` pendente: botão "Marcar como recebida" → `POST` com `url_arquivo: 'fisico'`
- **Aluno ITP:**
  - Lista estática dos 5 tipos com ✓ / ✗
  - Link "Ver ficha no módulo Matrículas" → `/matriculas?aluno_id={id}`

---

## Ordem de Deploy

1. Backend (etapas 1–7) — deploy primeiro, migrations rodam no `onModuleInit`
2. Frontend (etapas 8–14) — deploy após backend estar estável

## Rollback

- Migration usa `IF NOT EXISTS` — segura para re-executar
- Supabase bucket pode ser limpo manualmente
- Frontend: reverter para o commit anterior da aba "Inscritos"

# Design: Projetos — Inscrições, Documentação e Confirmação por Email

**Data:** 2026-06-10
**Status:** Aprovado
**Módulo:** `projetos`

---

## Contexto

O módulo Projetos gerencia projetos sazonais (ex: colônia de férias) com inscrições de alunos ITP e externos. Os problemas centrais são:
- Ausência de rastreamento de documentação por inscrito
- UX ruim na tela de inscritos (sem tabela estruturada, sem status de docs)
- Sem confirmação de inscrição por email
- Imagens armazenadas no banco de dados (inviável com volume de crianças)

---

## Objetivos

1. Tabela de inscritos com status de documentação (OK / PENDENTE)
2. Tela de inscrição otimizada para mutirão presencial (5–6 mesas simultâneas, WiFi confiável)
3. Upload paralelo de documentos com câmera integrada e guia de enquadramento
4. Verificação de documentos de alunos ITP via ficha existente no módulo Matrículas
5. Email de confirmação de inscrição disparado automaticamente
6. Storage de arquivos via Supabase Storage (fora do banco de dados)

---

## Fora do Escopo

- Migração de outros uploads do sistema para Supabase (feito separadamente)
- Conversão de externos em alunos ITP
- Assinatura de termos LGPD (módulo Matrículas)
- Detecção automática de bordas com OpenCV (complexidade vs. ganho)

---

## 1. Banco de Dados

### 1.1 Nova tabela `projeto_inscricao_documentos`

```sql
CREATE TABLE projeto_inscricao_documentos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inscricao_id  UUID NOT NULL REFERENCES projeto_inscricoes(id) ON DELETE CASCADE,
  tipo          VARCHAR NOT NULL,
  url_arquivo   TEXT NOT NULL,   -- path no Supabase Storage (não URL completa)
  created_at    TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_proj_insc_docs_inscricao ON projeto_inscricao_documentos(inscricao_id);
```

**Tipos válidos (hardcoded no service):**

| Tipo | Obrigatório | Observação |
|------|-------------|------------|
| `foto_aluno` | Sim | — |
| `identidade_aluno` | Sim | — |
| `identidade_responsavel` | Sim | — |
| `comprovante_residencia` | Sim | — |
| `certidao_nascimento` | Sim | — |
| `declaracao_escolar` | **Não** | Único que pode ficar PENDENTE na inscrição |

Inscrição só é concluída com os 5 obrigatórios enviados. `declaracao_escolar` pode ser fotografada na hora ou deixada PENDENTE — o responsável entrega fisicamente depois.

### 1.2 Nova coluna em `projeto_inscricoes`

```sql
ALTER TABLE projeto_inscricoes
  ADD COLUMN email_responsavel VARCHAR;
```

---

## 2. Storage — Supabase

### Variáveis de ambiente (backend)

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=service-role-key
SUPABASE_BUCKET=arquivos
```

- Bucket `arquivos`: **privado** — acesso via signed URLs geradas pelo backend
- SDK: `@supabase/supabase-js` no backend

### Organização de paths no bucket

```
projetos/{projeto_id}/inscricoes/{inscricao_id}/{tipo}.jpg
```

Sobrescreve o arquivo se re-enviado (mesmo path).

### Limites e processamento

- Formatos aceitos: **JPEG, PNG, HEIC**
- Tamanho máximo: **5MB** por arquivo
- Processamento com `sharp` antes do upload: redimensionar para máx 1920px, recomprimir JPEG quality 85

---

## 3. Backend

### 3.1 `SupabaseService` — `src/modules/supabase/`

Módulo compartilhado, exportado globalmente.

```typescript
upload(buffer: Buffer, path: string, mimetype: string): Promise<string>
getSignedUrl(path: string, expiresIn?: number): Promise<string>  // default 3600s
delete(path: string): Promise<void>
```

### 3.2 `ProjetosService` — mudanças

**`createInscricao()`**
- Salva `email_responsavel` para externos
- Para aluno ITP: busca email do responsável em `alunos`
- Após criar inscrição: dispara `EmailService.enviarConfirmacaoInscricao()`
- Se aluno ITP sem email cadastrado: loga warning, não bloqueia inscrição

**`findInscricoes()`**
- Adiciona campo `doc_status: 'ok' | 'pendente'` por inscrito:
  - **Externo:** verifica se os 5 obrigatórios existem em `projeto_inscricao_documentos`
  - **Aluno ITP:** verifica se os 5 obrigatórios existem em `documentos_inscricao` (por `aluno_id`)
- Tipos do módulo Matrículas mapeados para os tipos do Projetos na camada de service

### 3.3 Novos endpoints

```
POST   /projetos/:id/inscricoes/:iId/documentos
       multipart/form-data: { tipo: string, arquivo: File }
       → 201 { id, tipo, path }

GET    /projetos/:id/inscricoes/:iId/documentos
       → 200 [{ id, tipo, signed_url, created_at }]

DELETE /projetos/:id/inscricoes/:iId/documentos/:docId
       → remove do Supabase + tabela
       → 204
```

Todos protegidos por `@Roles(Role.ASSIST)`.

### 3.4 Email de confirmação

Novo método `EmailService.enviarConfirmacaoInscricao()`.

Template inclui:
- Nome do inscrito, projeto, datas, equipe
- Lista de documentos pendentes (se `declaracao_escolar` ausente)
- Instrução para entregar declaração escolar presencialmente
- Contato do instituto

---

## 4. Frontend

### 4.1 Tabela de Inscritos

Substitui lista atual. Colunas:

| Nome | Idade | Responsável | Cuidados Especiais | Data Inscrição | Equipe | Documentação |
|------|-------|-------------|-------------------|----------------|--------|--------------|

- **Documentação:** badge `OK` (verde) ou `PENDENTE` (laranja)
- Tooltip no badge PENDENTE lista os tipos faltantes
- Filtros: por equipe, por status de documentação (`todos | ok | pendente`)
- Linha clicável → abre `DrawerDocumentos`

### 4.2 Tela de Inscrição Externa — Otimizada para Mutirão

**Passo 1 — Dados pessoais** (formulário rápido)

- Nome completo
- Data de nascimento
- Nome do responsável
- Telefone do responsável
- E-mail do responsável ← obrigatório para envio de confirmação
- CEP + logradouro, número, complemento
- Cuidados especiais (opcional)

**Passo 2 — Documentos** (tela única, touch-first)

Grid de cards de upload em tela cheia:

```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  📷 Foto aluno  │ │ ID do aluno     │ │ ID responsável  │
│  [obrigatório]  │ │  [obrigatório]  │ │  [obrigatório]  │
│  [ Fotografar ] │ │  [ Fotografar ] │ │  [ Fotografar ] │
└─────────────────┘ └─────────────────┘ └─────────────────┘
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Comp. residência│ │ Certidão nasc.  │ │ Declaração esc. │
│  [obrigatório]  │ │  [obrigatório]  │ │   [opcional]    │
│  [ Fotografar ] │ │  [ Fotografar ] │ │  [ Fotografar ] │
│                 │ │                 │ │  [ PENDENTE ✓ ] │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

- Botão **"Fotografar"**: abre componente `DocumentCamera`
- Declaração escolar tem opção adicional **"Marcar como PENDENTE"**
- Uploads acontecem **em paralelo** assim que cada foto é confirmada
- Cada card mostra estado: aguardando / enviando / enviado ✓ / erro
- Botão **"Concluir inscrição"** ativa apenas quando os 5 obrigatórios estão `enviado ✓`
- Ao concluir: email de confirmação disparado automaticamente

### 4.3 Componente `DocumentCamera`

Câmera integrada com guia de enquadramento — sem biblioteca pesada.

**Comportamento:**
1. Abre modal fullscreen com feed da câmera traseira (`facingMode: 'environment'`)
2. Overlay com retângulo guia proporcional ao documento (A4 ou RG/CNH conforme tipo)
3. Botão de captura — congela o frame
4. Preview da imagem capturada com opções: **"Usar"** ou **"Tirar novamente"**
5. Ao confirmar: aplica filtro de contraste e nitidez via Canvas API, envia para o backend

**Processamento canvas (client-side antes do upload):**
- Aumenta contraste: `filter: contrast(1.2) brightness(1.05)`
- Crop automático na área do guia (descarta bordas fora do retângulo)
- Converte para JPEG quality 0.9

**Fallback:** botão "Escolher arquivo" para quem preferir galeria/scan externo.

### 4.4 Inscrição Aluno ITP

- Mantém busca por nome/CPF
- Após selecionar aluno: exibe inline o status dos 5 docs obrigatórios na ficha
- Se PENDENTE: aviso amarelo "Documentação incompleta — orientar entrega no módulo Matrículas"
- Sem upload — docs ITP gerenciados em Matrículas

### 4.5 `DrawerDocumentos`

Abre ao clicar em qualquer inscrito na tabela.

- Header: nome, tipo (ITP / Externo), equipe, status geral
- **Externo:** cards por tipo com preview thumbnail
  - Botão "Substituir" por doc
  - Botão "Remover"
  - Cards de tipos faltantes com botão "Fotografar"
- **Aluno ITP:** lista os 5 tipos com status ✓ / ✗ e link "Ver ficha no módulo Matrículas"

---

## 5. Concorrência

5–6 mesas simultâneas com WiFi confiável — dentro da capacidade normal de Vercel Serverless + Supabase Storage. Não requer arquitetura especial. Uploads paralelos por inscrição não conflitam (paths únicos por `inscricao_id` + `tipo`).

---

## 6. Dependências e Riscos

| Item | Risco | Mitigação |
|------|-------|-----------|
| Tipos de doc em `documentos_inscricao` com nomes diferentes | Médio | Mapear tipos no service antes de implementar |
| HEIC não suportado pelo `sharp` em alguns ambientes | Baixo | Adicionar `heic-convert` se necessário |
| Signed URLs expiram em 1h | Baixo | Frontend regenera ao abrir o drawer |
| Aluno ITP sem email cadastrado | Médio | Loga warning, não bloqueia inscrição |
| `getUserMedia` bloqueado em HTTP | Médio | Produção já usa HTTPS; dev usar `localhost` |

---

## 7. Ordem de Implementação

1. Conta Supabase (`dev.itp@...`), bucket `arquivos`, env vars no Vercel e `.env.local`
2. `SupabaseService` — `src/modules/supabase/`
3. Migration: `projeto_inscricao_documentos` + coluna `email_responsavel`
4. Endpoints de documentos no backend + processamento com `sharp`
5. `doc_status` em `findInscricoes`
6. Email de confirmação (`enviarConfirmacaoInscricao`)
7. Frontend: tabela de inscritos com badge OK/PENDENTE
8. Frontend: componente `DocumentCamera`
9. Frontend: tela de inscrição externa — passo 1 (dados)
10. Frontend: tela de inscrição externa — passo 2 (documentos com uploads paralelos)
11. Frontend: inscrição aluno ITP com status de docs inline
12. Frontend: `DrawerDocumentos`

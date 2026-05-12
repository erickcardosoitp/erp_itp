# Módulo Projetos / Colônia de Férias — Design Spec

**Data:** 2026-05-12
**Status:** Aprovado
**Escopo:** Backend NestJS + Frontend Next.js — novo módulo independente

---

## Contexto

O ITP realiza projetos sazonais (ex: Colônia de Férias) que precisam de gestão própria de inscrições, equipes, presença e identificação física dos participantes. O módulo reutiliza a base de alunos existente mas aceita participantes externos (não matriculados). Não há pagamentos — projetos são gratuitos. Inscrições apenas via admin (sem formulário público).

---

## Modelo de Dados

### Tabela `projetos`

| Campo | Tipo | Observação |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| nome | varchar | ex: "Colônia Jul/2026" |
| descricao | text | nullable |
| data_inicio | date | |
| data_fim | date | |
| pulseira_largura_mm | int | default 54 |
| pulseira_altura_mm | int | default 25 |
| ativo | boolean | default true |
| created_at | timestamp | |
| updated_at | timestamp | |

### Tabela `projeto_equipes`

| Campo | Tipo | Observação |
|---|---|---|
| id | uuid PK | |
| projeto_id | uuid FK → projetos | CASCADE delete |
| nome | varchar | ex: "Tubarões" |
| cor | varchar | hex, ex: "#7c3aed" |
| faixa_min | int | nullable — idade mínima |
| faixa_max | int | nullable — idade máxima |
| created_at | timestamp | |
| updated_at | timestamp | |

Sem limite de vagas por equipe ou por projeto.

### Tabela `projeto_inscricoes`

| Campo | Tipo | Observação |
|---|---|---|
| id | uuid PK | valor codificado no barcode |
| projeto_id | uuid FK → projetos | |
| equipe_id | uuid FK → projeto_equipes | nullable — atribuído pelo admin |
| aluno_id | uuid FK → alunos | nullable — preenchido se tipo = regular |
| tipo | varchar | `regular` / `externo` |
| nome_completo | varchar | espelhado do aluno ou manual |
| data_nascimento | date | |
| nome_responsavel | varchar | nullable |
| telefone_responsavel | varchar | nullable |
| cuidado_especial | varchar | nullable — ex: "TEA", "Alérgico a Glúten" |
| detalhes_cuidado | text | nullable |
| status | varchar | `inscrito` / `confirmado` / `cancelado` |
| convertido_em_aluno | boolean | default false |
| created_at | timestamp | |
| updated_at | timestamp | |

**Dados externos mantidos indefinidamente** — sem expiração automática.

**"Tornar Aluno Regular":** copia dados da `projeto_inscricao` para uma nova `Inscricao` com `status = PENDENTE`, segue o fluxo normal de matrícula. Após efetivar, `aluno_id` é preenchido e `convertido_em_aluno = true`.

### Tabela `projeto_presencas`

| Campo | Tipo | Observação |
|---|---|---|
| id | uuid PK | |
| projeto_id | uuid FK → projetos | |
| equipe_id | uuid FK → projeto_equipes | nullable |
| inscricao_id | uuid FK → projeto_inscricoes | |
| data | date | dia da presença |
| presente | boolean | default false — marcado manualmente (check-in) |
| hora_entrada | time | nullable — preenchido manualmente |
| hora_saida | time | nullable — preenchido via scan do barcode |
| created_at | timestamp | |

**Constraint único:** `(inscricao_id, data)` — um registro por participante por dia.

---

## Diagrama ER (simplificado)

```
Aluno ─────────────────────────────────────┐
                                            ↓
Projeto ──── ProjetoEquipe ──── ProjetoInscricao ──── ProjetoPresenca
```

---

## Fluxo de Check-in / Check-out

**Check-in (manual):**
- Monitor abre a lista de presença da equipe no dia
- Marca cada participante como presente + registra `hora_entrada`

**Check-out (barcode):**
- Rota dedicada `/projetos/checkout` com input de scanner focado automaticamente
- Ao escanear: `GET /projetos/checkout/:inscricao_id`
  1. Localiza `projeto_presenca` do dia com `presente = true` e `hora_saida = null`
  2. Preenche `hora_saida = now()`
  3. Retorna nome + equipe + foto (se aluno regular)
- Interface exibe card de confirmação por 3 segundos e volta ao estado de espera
- Suporte a scanner USB HID (input type="text" com foco automático e submit ao Enter)

---

## Print Preview — Pulseiras

### Layout (Code 128, faixa inferior)

```
+------------------------------------------------------+
| ⚠ ALÉRGICO A GLÚTEN          EQUIPE: ★ TUBARÕES     |
| JOÃO PEDRO DA SILVA · 8 ANOS                         |
| RESP: MARIA SILVA · (11) 98888-7777                  |
| ▐▌▌▐▌▐▐▌▌▐▌▐▐▌▌▐▌▐▐▌▌▐▌▐▐▌▌   abc-123-def           |
+------------------------------------------------------+

(sem cuidado especial — sem tarja vermelha no topo)
+------------------------------------------------------+
|                               EQUIPE: ✦ GOLFINHOS    |
| ANA BEATRIZ LIMA · 10 ANOS                           |
| RESP: CARLOS LIMA · (11) 91111-2222                  |
| ▐▌▌▐▌▐▐▌▌▐▌▐▐▌▌▐▌▐▐▌▌▐▌▐▐▌▌   xyz-456-ghi           |
+------------------------------------------------------+
```

### Configuração de dimensões

- Campos **Largura (mm)** e **Altura (mm)** no cadastro do projeto (defaults: 54×25)
- No Print Preview, painel lateral permite ajuste ad-hoc sem salvar — para testar antes de imprimir
- O "espelho" reescala em tempo real via CSS custom properties (`--w-mm`, `--h-mm`)

### Técnica de impressão

CSS `@media print` puro — sem bibliotecas de PDF:

```css
@media print {
  .pulseira {
    width: var(--w-mm);
    height: var(--h-mm);
    page-break-inside: avoid;
    /* layout fixo, sem scroll */
  }
}
```

### Ajuste de fonte para nomes longos

`font-size: clamp(5pt, calc(7pt - 0.15pt * var(--name-len)), 8pt)` onde `--name-len` é calculado em JS com o comprimento do nome. Nomes acima de 28 caracteres começam em 5.5pt.

### Biblioteca de barcode

**JsBarcode** — leve, sem dependências, gera Code128, compatível com qualquer scanner USB/laser. Renderiza via `<svg>` inline, funciona em `@media print` sem problemas.

---

## Rotas Frontend

| Rota | Descrição |
|---|---|
| `/projetos` | Lista de projetos com status (ativo/encerrado) |
| `/projetos/[id]` | Dashboard: inscritos, equipes, presença do dia |
| `/projetos/[id]/pulseiras` | Print Preview + configuração de dimensões |
| `/projetos/checkout` | Tela de scanner para check-out (fullscreen simplificado) |

---

## Rotas Backend (NestJS)

| Método | Rota | Descrição |
|---|---|---|
| GET/POST | `/projetos` | Listar / criar projetos |
| GET/PATCH/DELETE | `/projetos/:id` | Detalhe / editar / remover |
| GET/POST | `/projetos/:id/equipes` | Listar / criar equipes |
| PATCH/DELETE | `/projetos/:id/equipes/:eqId` | Editar / remover equipe |
| GET/POST | `/projetos/:id/inscricoes` | Listar / inscrever participante |
| PATCH | `/projetos/:id/inscricoes/:iId` | Editar inscrição (equipe, status) |
| POST | `/projetos/:id/inscricoes/:iId/tornar-aluno` | Converter externo em aluno regular |
| GET/POST | `/projetos/:id/presencas` | Listar / registrar presença do dia |
| GET | `/projetos/checkout/:inscricao_id` | Registrar check-out via barcode |

---

## Módulo NestJS

Novo módulo `projetos/` independente. Entidades: `Projeto`, `ProjetoEquipe`, `ProjetoInscricao`, `ProjetoPresenca`. Importa `AlunosModule` e `MatriculasModule` apenas para o fluxo "Tornar Aluno Regular".

---

## Fora do Escopo (fase 1)

- Inscrição pública
- Pagamentos
- Limite de vagas
- QR Code (barcode Code128 cobre o caso de uso)
- Expiração automática de dados externos
- Notificações / e-mails

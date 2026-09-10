# Catálogo de Erros da VM

> Documento vivo do projeto de catalogação automática de erros da
> `vm-itp-prod`. Para o design técnico detalhado e o histórico de decisões,
> ver `docs/superpowers/specs/2026-09-09-catalogo-erros-vm-design.md`
> (v4). Este arquivo é o resumo executivo + estado atual.
> Última atualização: 2026-09-10.

---

## 1. O que é

Sistema que lê os logs das aplicações rodando na VM (ITP hoje; APRXM e DW
quando migrarem/subirem), agrupa ocorrências do mesmo erro, classifica por
categoria/criticidade, propõe correção via Claude Code CLI, e passa por
aprovação humana (Power Automate) antes de qualquer coisa ser aplicada em
produção.

**Motivação:** antes disso, a única forma de achar erro era vasculhar
`docker logs`/journalctl manualmente sob demanda. Na sessão de
2026-09-09 isso só aconteceu porque alguém perguntou "cadê os logs" — e
resultou em 3 bugs reais de schema encontrados e corrigidos no `erp_itp`
que ninguém sabia que existiam. Não havia processo recorrente nem memória
de "isso já foi visto e tratado".

---

## 2. Arquitetura (resumo)

```
APLICAÇÃO (erro em log/container)
        ↓
CAMADA DE SERVIÇO NA VM (script + Claude Code CLI headless)
   - lê docker logs / journalctl
   - normaliza a mensagem (regex, remove timestamp/PID/números/UUIDs)
   - deduplica em 3 camadas (normalização → busca exata → comparação
     semântica via Claude, só quando as duas primeiras não bateram)
   - classifica: Aplicacao / Categoria / TipoErro / Criticidade / IAPodeResolver
   - gera Diagnostico + CorrecaoProposta (nunca aplica sozinho)
        ↓                                  ↓
SHAREPOINT LIST                    PARQUET (append-only,
CatalogoErros                       particionado por app/data,
(via Graph API, saída da VM)        toda linha carimbada com CodErro)
        ↓
POWER AUTOMATE
   ├─ Flow A: item novo → Approval → atualiza Status/Fase na lista
   └─ Flow B: recorrência diária → relatório por email (Outlook)
        ↓ (aprovado)
VM (cron separado) lê aprovação → Claude Code CLI executa a correção
    aprovada + deploy.sh → valida de novo → RESOLVIDO/REABERTO/ESCALADO
```

**Três peças, três responsabilidades:**

| Peça | Onde vive | Papel |
|---|---|---|
| Camada de serviço | VM (script + Claude Code CLI) | Lê, classifica, deduplica, investiga, propõe correção |
| Catálogo operacional | SharePoint List `CatalogoErros` | Estado mutável (status, fase, contador) — o que Power Automate usa |
| Histórico analítico | Parquet (append-only) | Uma linha por ocorrência, nunca alterada — consulta/tendência/DW futuro |

**Não existe banco relacional no meio.** Parquet é imutável (sem UPDATE
nem lookup eficiente), então todo estado mutável vive na SharePoint List.

---

## 3. Decisões-chave (e por quê)

- **Sem conectores Premium no Power Automate** — usa só SharePoint,
  Approvals e Outlook (Standard), porque não há confirmação de que a
  licença nonprofit cobre HTTP/SQL Premium.
- **Sem AI Builder** — substituído pelo Claude Code CLI headless na VM,
  sem custo Microsoft adicional. A IA investiga e classifica, mas nunca
  executa fora do catálogo fechado de ações.
- **Nenhuma correção automática sem aprovação humana na v1** — mesmo
  quando `IAPodeResolver = sim_seguro`. Ver seção 6 (achados) sobre por
  quê essa cautela se provou correta no primeiro dia de uso.
- **Toda comunicação Microsoft 365 é de saída** — a VM chama a Graph API,
  o Power Automate nunca entra na VM. Evita expor portas/depender de
  conector premium.
- **Dedup por grupo, não por ocorrência** — 1 item por erro único na
  lista, com contador (`Ocorrencias`), não 1 item por disparo.
- **Fingerprinting erra pro lado seguro**: na dúvida entre "é o mesmo
  erro" ou "é novo", cria item novo. Fundir errado esconde bug real
  dentro de ticket já fechado; duplicar é só ruído a mais pra revisar.

---

## 4. Infraestrutura provisionada (2026-09-09)

| Item | Valor |
|---|---|
| Tenant | `insttiapretinha.onmicrosoft.com` (`institutotiapretinha.org`), ID `0ce4c521-c3f0-40c8-b32b-374ddac76505` |
| Site SharePoint | `https://insttiapretinha.sharepoint.com/sites/ObservabilidadeITP` |
| App registration | `Catalogo Erros - VM`, client ID `baf58f64-f423-4188-8dd1-462ede6afe22` (dedicado, separado do app de SSO) |
| Permissão Graph | `Sites.ReadWrite.All` (Application), consentida |
| Segredo | `~/itp-stack/catalogo_erros.env` na VM, `chmod 600` — nunca passou pelo chat |
| Lista `CatalogoErros` | Criada manualmente, 26 colunas ativas — feito 2026-09-09 |
| Push do VM pro GitHub | Deploy key SSH dedicada (ed25519, "Allow write access", escopo só `erp_itp`), `~/.ssh/config` com host alias `github-erp_itp` — feito 2026-09-10, necessário pro `aplicador.py` poder commitar/dar push sozinho |

**Achados de configuração que valem registrar:**
- `Sites.Selected` (opção mais restrita, cogitada inicialmente) foi
  abandonada: o passo de autorizar o app num site específico exige
  `PnP.PowerShell` (falha no Cloud Shell por dependência nativa
  `libsecret` ausente, sem `sudo` disponível) ou device-code flow
  (bloqueado por Acesso Condicional do tenant, `AADSTS530035` — dispositivo
  não registrado) ou o painel "API access" do SharePoint Advanced
  Management (add-on pago, não disponível no plano atual). Resolvido
  trocando para `Sites.ReadWrite.All`, que funciona só com consentimento
  simples de admin.
- **O app não consegue criar listas novas via Graph API** (`POST
  /sites/{id}/lists` → sempre `403 accessDenied`, mesmo com permissão
  completa) — é uma separação normal entre "escrever conteúdo" e "criar
  estrutura" em muitos tenants SharePoint. Escrever/ler **itens** numa
  lista já existente funciona normalmente (testado e confirmado). Por
  isso a lista precisa ser criada manualmente, uma vez só.

---

## 5. Schema da SharePoint List `CatalogoErros`

Criação manual (limitação acima). 26 colunas, ordenadas por bloco de uso
(triagem rápida primeiro, texto longo por último — pra não bagunçar a
visão em grade):

**Regra `Aplicacao=BD` vs `Categoria=banco`** (não são a mesma coisa):
`Aplicacao=BD` é pro erro do **motor do banco em si**, como infraestrutura
compartilhada sem dono claro entre as apps (disco cheio, replicação
quebrada, extensão faltando) — hoje ainda sem caso prático (só
`itp_postgres` dedicado ao `erp_itp_db`), mas relevante quando APRXM
subir e/ou dividir banco. `Categoria=banco` é pro bug de **schema/query
de uma app específica** — os 3 bugs de 2026-09-09 (`turma_id`,
`alergias_descricao`, `createdAt`) são `Aplicacao=ITP` + `Categoria=banco`,
não `Aplicacao=BD`.

**Bloco 1 — Identificação (visão em grade, sem abrir o item)**
| Coluna | Tipo | Valores/formato |
|---|---|---|
| `Aplicacao` | Escolha | ITP, APRXM, DW, BD |
| `DescricaoResumida` | Texto longo | O erro em português simples, sem jargão técnico — pra quem não é da área entender em 1-2 frases |
| `Categoria` | Escolha | banco, código, infra, security, integracao, usuario, terceiros (aberta a crescer) |
| `TipoErro` | Texto | Rótulo livre gerado pelo Claude, não é enum fixo |
| `Criticidade` | Escolha | baixa, media, alta, critica |
| `Status` | Escolha | aberto, resolvido, reaberto, conhecido, descartado |
| `Fase` | Escolha | detectado, investigando, diagnosticado, ag aprovacao, aplicando, validando, escalado |

**Bloco 2 — Rastreamento de ocorrência**
| Coluna | Tipo | Valores/formato |
|---|---|---|
| `Ocorrencias` | Número | Contador |
| `Reincidente` | Sim/Não | |
| `PrimeiraVez` / `UltimaVez` | Data/hora | |

**Bloco 3 — Identificadores técnicos**
| Coluna | Tipo | Valores/formato |
|---|---|---|
| `CodCat` | Texto | `CAT-{ID nativo:04d}` — código do item neste catálogo |
| `CodErro` | Texto | Código do **grupo** — igual em toda ocorrência, FK real com o Parquet |
| `Assinatura` | Texto (500) | Mensagem normalizada — só leitura/debug |

**Bloco 4 — Diagnóstico da IA**
| Coluna | Tipo | Valores/formato |
|---|---|---|
| `CamadaInvestigacao` | Escolha | log_app, schema_banco, infra_vm, integracao_ext |
| `Confianca` | Número | 0 a 10 — rubrica ancorada em qualidade de evidência (ver `catalogo-erros/claude_client.py`, rubrica no `PROMPT_TEMPLATE`) |
| `IAPodeResolver` | Escolha | seguro, sem risco, mediano, alto risco (escala de risco, não booleano) |
| `Diagnostico` | Texto longo | Análise do Claude — deve justificar a nota de `Confianca` |
| `MensagemExemplo` | Texto longo | Última mensagem bruta, sem normalizar |

**Bloco 5 — Correção e execução**
| Coluna | Tipo | Valores/formato |
|---|---|---|
| `CorrecaoProposta` | Texto longo | Correção sugerida pelo Claude na classificação |
| `PromptExecucao` | Texto longo | Montado pelo Power Automate na aprovação (padrão + comentário livre do aprovador) — é isso que o `aplicador.py` manda pro Claude Code CLI executar |
| `ResultadoExecucao` | Texto longo | Resumo do que foi feito, escrito pelo `aplicador.py` depois de executar |
| `AcaoExecutada` | Texto | Código da ação do catálogo (seção 7) |
| `LinkCommit` | Hyperlink | |
| `ResolvidoEm` | Data/hora | |
| `TentativasResolucao` | Número | Limite de 2 — no 3º ciclo sem sucesso, escala sem tentar de novo |

**Bloco 6 — Aprovação humana**
| Coluna | Tipo | Valores/formato |
|---|---|---|
| `AprovadoPor` | Pessoa | |
| `AprovadoEm` | Data/hora | |
| `MotivoRejeicao` | Texto longo | |

### 5.1 Fluxo de aprovação → execução (Power Automate + aplicador.py)

```
Item novo/reincidente na lista (Status=aberto/reaberto)
        ↓
Power Automate Fluxo A:
    dispara em "item criado" OU "Reincidente=true"
    → notifica na hora (email/Teams) com diagnóstico completo
    → Approval (campo de comentário livre)
    → aprovado (+ comentário opcional) ou rejeitado
    → Compose: PromptExecucao = template padrão + comentário do aprovador
    → grava: Status=aprovado, PromptExecucao
        ↓
VM — aplicador.py (cron, 15/15min):
    → busca Status=aprovado com PromptExecucao preenchido
    → checa TentativasResolucao < 2, senão escala direto
    → claude_client.executar(PromptExecucao) — só aplica o que foi
      aprovado, nunca decide algo fora do escopo (wrapper de segurança
      dedicado, diferente do classificar() do coletor.py)
    → grava: ResultadoExecucao, Status (resolvido/aberto+escalado), LinkCommit
        ↓
Power Automate Fluxo C: notifica resultado (sucesso → email; precisa
    atenção → Teams)

Fluxo B (separado, diário): resumo consolidado do dia inteiro
```

`PromptExecucao` é deliberadamente separado de `CorrecaoProposta`: o
segundo é a proposta que o Claude gerou na classificação (só leitura,
histórico); o primeiro é o que de fato vai ser executado, podendo ter
instrução adicional do humano que aprovou.

`Fase` (estágio técnico do pipeline) e `Status` (resumo de negócio pro
relatório) são campos **separados de propósito** — não redundantes.

---

## 6. Achados do primeiro dia de uso (2026-09-09)

Levantamento real feito antes mesmo do sistema existir, útil como
baseline e como prova de conceito do fingerprinting:

**25 linhas brutas de erro** nos containers → **6 grupos únicos** depois
de normalizar:

| Grupo | Categoria | Ocorrências | Situação |
|---|---|---|---|
| `turma_id`/`aluno_id` varchar vs uuid | banco | 2 | ✅ corrigido |
| tipo de parâmetro + `alergias_descricao` ausente | banco | 2 | ✅ corrigido |
| `createdAt` vs `created_at` em inscricoes | banco | 2 | ✅ corrigido |
| "Failed to find Server Action" (redeploy) | codigo | 16 | ruído esperado, não é bug |
| `relation "users" does not exist` | banco | 1 | exploração manual, não é bug |
| `role "postgres" does not exist` | banco | 1 | exploração manual, não é bug |

**Avaliação honesta de autonomia** (o dado que vai calibrar `IAPodeResolver`
na prática, não só na teoria):

| Bug | Claude resolveria sozinho? | Por quê |
|---|---|---|
| `createdAt` | Sim, confiança alta | Causa objetiva, sem ambiguidade, fix mecânico |
| `turma_id` | Sim, mas com risco | Investigação em várias etapas, mas puramente técnica |
| `alergias_descricao` | **Não** | O Claude errou o diagnóstico uma vez nesta sessão (propôs remover o campo em vez de completá-lo) — só corrigiu depois que o humano explicou a intenção de negócio ("alergia é um campo que a gente tem de um aluno"). Faltava contexto que não estava em log nenhum. |

Essa é a justificativa prática (não só teórica) por trás da decisão de
nunca auto-aplicar correção na v1: não é sobre capacidade técnica, é
sobre contexto de negócio que só existe na cabeça de quem construiu o
sistema.

---

## 7. Catálogo de ações (vocabulário fechado)

| Código | Tipo | Comando real | Risco | Aprovação |
|---|---|---|---|---|
| `CHECK_CONTAINER_LOGS` | verificação | `docker logs <container> --since <ts>` | baixo | não |
| `CHECK_SCHEMA` | verificação | `psql \d <tabela>` vs entidade TypeORM | baixo | não |
| `CHECK_DISK` | verificação | `df -h` / `docker system df` | baixo | não |
| `CHECK_INTEGRACAO_EXTERNA` | verificação | ping/HTTP no endpoint externo | baixo | não |
| `RESTART_CONTAINER` | resolução | `docker compose restart <servico>` | médio | sim |
| `CLEAR_BUILD_CACHE` | resolução | `docker builder prune --keep-storage 5GB` | baixo | não |
| `APPLY_MIGRATION` | resolução | ALTER TABLE idempotente via `app.module.ts` | alto | sim |
| `FIX_CODE_AND_DEPLOY` | resolução | commit + push + `deploy.sh` | alto | sim |
| `ESCALATE_HUMAN` | resolução | encerra como escalado, notifica | — | — |

Investigação segue sempre a ordem: `log_app` → `schema_banco` →
`infra_vm` → `integracao_externa` (só avança se a camada anterior não
explicar a causa).

---

## 8. App de visualização (Parquet)

Aplicação própria, só leitura, pra navegar o histórico do Parquet — não
substitui a SharePoint List (que continua sendo o catálogo operacional
editável). **Construída e em produção desde 2026-09-10.**

- **Escopo v1** (feito): tabela de erros agrupados por `CodErro`, filtro
  por `Aplicacao`/`Categoria`/`Criticidade`/`Status`/busca livre,
  drill-down no histórico completo de ocorrências de um erro (master-detail,
  estilo SAP Error Log — tabela em cima, painel de contexto fixo embaixo),
  botão manual de atualizar (o Parquet é gravado na mesma execução do
  coletor que cria o item no SharePoint, então o atraso percebido era só
  o frontend não re-buscar sem reload — não um problema de gravação).
- **Fora do escopo v1**: edição de dados (fica só na SharePoint List),
  autenticação própria, notificações, gráfico de tendência (adiado).
- **Stack**: backend Python (FastAPI + DuckDB lendo os Parquet via
  `read_parquet(glob, hive_partitioning=true)`), frontend Next.js 14.2.15
  (mesmo padrão do `erp_itp`).
- **Deploy**: containers `catalogo_backend` (porta interna 8000 →
  `127.0.0.1:8001`) e `catalogo_frontend` (porta interna 3000 →
  `127.0.0.1:8080`) no `docker-compose.yml` do `~/itp-stack` da VM —
  **restritos a localhost**, não expostos via Traefik/domínio público.
  Acesso via atalho de desktop MATE (`~/Desktop/catalogo-erros.desktop`,
  ícone `x-office-address-book`) na sessão gráfica da própria VM.

---

## 9. Teste end-to-end real (2026-09-10) — ciclo completo validado

Primeira validação do pipeline inteiro rodando de ponta a ponta, com dois
casos reais:

**Caso A — bug de banco real (CAT-0003)**: erro real de schema encontrado
em produção, classificado com confiança alta, aprovado, e **corrigido
autonomamente pelo Claude Code CLI na VM** (commit `3aecaeb5`, push, deploy,
`Status=resolvido`). Primeira correção de produção feita sem intervenção
manual de código.

**Caso B — crash de frontend proposital (CAT-0014 / `ERR-9d8025bfe2`)**:
bug de teste introduzido de propósito (`ChamadosTable.tsx`, campo
inexistente `tituloTypo`) pra validar a cadeia inteira: crash real no
navegador → captura via `POST /frontend-logs` → `docker logs` →
coletor → SharePoint → Power Automate (email + Teams) → aprovação →
`aplicador.py` executa, corrige, commita, dá push, roda `deploy.sh` →
`Status=resolvido`, `Fase=validando`. Diagnóstico e correção propostos
pelo Claude bateram exatamente com a causa raiz, incluindo grep do
histórico de commits pra confirmar que era teste proposital.

**Bugs reais encontrados só por causa desse teste ao vivo** (não seriam
achados só lendo o código):

- **Crash de UI client-side nunca chegava a log nenhum.** O
  `PageErrorBoundary` (`ClientShell.tsx`) capturava o erro só no
  navegador — sem reportar pro backend, o catálogo nunca veria esse tipo
  de erro. Corrigido com `componentDidCatch` chamando
  `POST /backend-api/frontend-logs` (endpoint novo, `@Public()`, loga via
  `Logger.error`).
- **Mesmo ponto cego em outro lugar**: existe um `error.tsx` global na
  raiz do App Router (`apps/frontend/src/app/error.tsx`) que intercepta o
  crash *antes* do `PageErrorBoundary` dentro do `ClientShell` — ele não
  tinha o mesmo report. Corrigido replicando o mesmo `fetch` best-effort
  ali. **Lição**: ao adicionar reporte de erro num boundary, sempre
  verificar se existe outro boundary mais acima na árvore (Next.js App
  Router permite vários `error.tsx` por segmento de rota + 1 global).
- **Logs coloridos (ANSI) quebravam a query pro SharePoint.** O Nest
  Logger grava logs com sequências de escape ANSI (`\x1b[32m` etc.); sem
  removê-las na normalização, a assinatura carregava caracteres de
  controle que geravam `400 Bad Request` na query OData `$filter` do
  Graph API — o coletor não conseguia nem checar duplicidade. Corrigido
  em `normalizador.py` (remove ANSI antes de qualquer outra substituição).
- **`LinkCommit` continua sem funcionar via Graph API** (mesmo problema
  já visto antes — a coluna Hyperlink não tem um formato de escrita que a
  API aceite). Isolado em `try/except` separado desde a correção
  anterior, então nunca bloqueia o resultado principal — mas segue sem
  solução real (ver seção 11).
- **Fuso horário da lista SharePoint em UTC**, não Brasília — as datas
  gravadas estão corretas (UTC, como deveria ser internamente), mas a
  exibição na lista não convertia pro fuso local. Corrigido nas
  Configurações Regionais do site (não é bug de código).

---

## 10. Próximos passos

- [x] Criar site, app registration, permissão Graph, lista `CatalogoErros` (26 colunas) — feito 2026-09-09.
- [x] Validar escrita/leitura de item completo via API — feito e testado 2026-09-09.
- [x] Decidir local do Parquet — disco local da VM, dentro do backup existente.
- [x] Escrever o script coletor (normalização regex → dedup 3 camadas → Claude Code CLI → sync SharePoint + Parquet).
- [x] Rodar o coletor manualmente contra os logs reais da VM e validar contra os 6 grupos já identificados (seção 6).
- [x] Agendar os crons — coletor `*/5min` (wrapper adaptativo: 5min/30min/2h/6h
      conforme a pior criticidade vista no lote, ver `cron_coletor.sh`),
      aplicador `*/15min`.
- [x] Montar o Fluxo A do Power Automate (notificação + Approval) — feito e
      testado 2026-09-09/10 com casos reais.
- [x] Construir a app de visualização do Parquet (seção 8) — feito e em
      produção 2026-09-10.
- [x] Validar o ciclo inteiro ponta a ponta com 2 casos reais (seção 9) —
      feito 2026-09-10, incluindo correção autônoma aplicada em produção.
- [ ] Montar Fluxo B (relatório diário consolidado) e Fluxo C (notificação
      de resultado após `aplicador.py` rodar) — só desenhados no design doc,
      não construídos na UI ainda.
- [ ] Popular o catálogo de ações/playbooks além dos 9 exemplos da seção 7.
- [ ] Varredura mais ampla de outros pontos cegos de erro client-side além
      dos 2 `error.tsx`/`PageErrorBoundary` já cobertos (pedido explícito do
      usuário, adiado deliberadamente pra depois do teste inicial: "o certo
      depois é fazer uma varredura desses tipos de erros que não chegam até
      nós").
- [ ] Rodar 1-2 semanas em modo piloto (aprovação manual sempre) antes de
      considerar liberar qualquer auto-fix sem aprovação.

---

## 11. Em aberto

- `LinkCommit` sem formato de escrita funcional via Graph API (400 em toda
  tentativa, isolado em try/except pra não bloquear o resultado principal
  — ver seção 9). Sem solução real ainda.
- Threshold de "pico de frequência" pra categoria `integracao` (proposto: >5/1h) — em uso em `aplicar_matriz_reincidencia()`, mas não validado com volume real ainda.
- Regras de auto-fix da v2 (quando liberar ações de baixo risco sem aprovação) — não antes do piloto de 1-2 semanas.
- Data de expiração do client secret do app `Catalogo Erros - VM` (anotar quando disponível, pra não pegar de surpresa a rotação).
- Data de expiração/rotação da deploy key SSH usada pro push autônomo do `aplicador.py`.
- Onde plugar APRXM e DW quando migrarem.
- Fluxos B e C do Power Automate ainda não construídos na UI (seção 10).

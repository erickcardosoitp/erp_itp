# Catálogo de Erros da VM

> Documento vivo do projeto de catalogação automática de erros da
> `vm-itp-prod`. Para o design técnico detalhado e o histórico de decisões,
> ver `docs/superpowers/specs/2026-09-09-catalogo-erros-vm-design.md`
> (v4). Este arquivo é o resumo executivo + estado atual.
> Última atualização: 2026-09-15 (ver seção 12 — incidente de estouro de
> sessão e evolução de arquitetura do mesmo dia).

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
| `VERIFICAR_MEMORIA` | verificação | `free -h` | baixo | não |
| `VERIFICAR_CONFIG_DUPLICADA` | verificação | grep por chave repetida em arquivo de config do SO (ex: `/etc/dnf.conf`) | baixo | não |
| `CRIAR_SWAP` | resolução | `fallocate` + `mkswap` + `swapon` + entrada persistente no `/etc/fstab` | médio | sim |
| `CORRIGIR_CONFIG_DUPLICADA` | resolução | remove linha duplicada de config do SO, com backup automático antes | baixo | sim |
| `ESCALATE_HUMAN` | resolução | encerra como escalado, notifica | — | — |

**Adicionadas 2026-09-11**, motivadas por ações reais feitas manualmente
nesta sessão (criação de swap, correção do `installonly_limit`
duplicado) que não tinham ação catalogada correspondente — a IA não
tinha autorização pra propor isso sozinha. `CRIAR_SWAP` exige aprovação
por alterar estado persistente da VM (mesmo sendo reversível); as 2
verificações não.

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
- ~~Threshold de "pico de frequência" pra categoria `integracao`~~ — resolvido indiretamente 2026-09-11: ao escrever testes pra `aplicar_matriz_reincidencia()`, achado bug real em `REABRE_SEMPRE` (grafia divergente de `CATEGORIAS_VALIDAS`, reincidência de `código`/`security`/`terceiros` nunca reabria). Corrigido + `test_reincidencia.py` criado. O número em si (5/lote) segue sem validação de volume real, mas não é mais o item crítico.
- Regras de auto-fix da v2 (quando liberar ações de baixo risco sem aprovação) — não antes do piloto de 1-2 semanas.
- Data de expiração do client secret do app `Catalogo Erros - VM` (anotar quando disponível, pra não pegar de surpresa a rotação).
- Data de expiração/rotação da deploy key SSH usada pro push autônomo do `aplicador.py`.
- Onde plugar APRXM e DW quando migrarem.
- Fluxos B e C do Power Automate ainda não construídos na UI (seção 10).

### 11.1 Alerta de escalonamento no Grafana — excluído em 2026-09-15

O alerta `itp-alerta-catalogo-escalonamento` (Grafana, pasta ITP, grupo
`itp-alertas-criticos`) foi **excluído a pedido do analista** depois de um
falso-positivo real (`DatasourceNoData`) e da descoberta de um drift de
provisionamento sem solução simples: o campo `noDataState` da regra
ficava preso em `NoData` mesmo com o arquivo dizendo
`no_data_state: OK`, e nem restart do container nem reload via API
(`POST /api/admin/provisioning/alerting/reload`) reconciliavam esse
campo específico (Grafana 13.2.1). Remover a regra do bloco `groups` do
YAML e reiniciar também não apagava de verdade — o Grafana continuava
servindo a versão antiga do banco interno. A exclusão real só funcionou
usando a seção `deleteRules` do provisionamento (mecanismo oficial pra
isso, diferente de só tirar do `groups`).

**O que continua funcionando sem o alerta:** todo `TarefaEscalada`
(timeout, rate-limit nas 2 contas, ou teto de 20%/sessão) continua sendo
registrado normalmente em
`~/itp-stack/catalogo-erros-escalonamentos.jsonl` (JSONL, um evento por
linha, com motivo e diagnóstico completo) e na métrica Prometheus
`catalogo_erros_escalonamentos_total` — só não existe mais uma regra
dedicada no Grafana disparando notificação automática por isso. Consulta
manual do JSONL ou da métrica continua possível a qualquer momento.

**Se recriar no futuro:** recomendado criar direto pela UI do Grafana
(Alerting → Alert rules → New), não por arquivo de provisionamento —
esse Grafana especificamente não reconcilia bem o campo `noDataState`
via arquivo depois que a regra já existe uma vez.

### 11.2 Checklist de pendências e verificações — 2026-09-15

**Pendente de decisão/ação do analista:**

- [ ] **CAT-0089, CAT-0090, CAT-0180** (bugs reais de validação de tenant
  na APRXM) ficaram `Status=aprovado` mas travados pelo teto de 20% da
  sessão — decisão explícita foi revisar manualmente na lista em vez de
  destravar o teto. Ainda aguardando essa revisão.
- [ ] **CAT-0179** ficou com diagnóstico desatualizado/errado — foi
  classificado antes da correção do acesso ao repositório APRXM
  (`--add-dir`, ver seção 12.3), com o repositório errado, e marcado
  `resolvido`/`sem risco` incorretamente. A tentativa de reclassificar
  de novo bateu timeout e nunca foi refeita. Precisa reclassificação
  manual.
- [ ] **Achado de segurança represado** (`ERR-14368ed7c8`, criticidade
  média): porta 5432 do `itp_postgres` exposta sem restrição de IP
  (`5432:5432` em vez de `127.0.0.1:5432:5432`, diferente dos outros
  serviços do mesmo `docker-compose.yml`). Vai aparecer no resumo diário
  de consolidação — decisão de hardening de infra pendente.
- [ ] **2 commits reais em produção no `aprxm_sys`** (`6d59459`,
  `2ca1a11`, ver seção 12.2) foram aplicados durante o incidente do
  volume de aprovações, com aprovação feita sob pressão (não deliberada)
  — decisão foi confiar no diagnóstico sem revisão formal de código.
  Registrado que segue sem revisão humana de código, só validação de
  saúde do container (`aprxm_backend` healthy).

**Precisa verificação (ainda não confirmado ao vivo):**

- [ ] **Consolidação diária das 20h BRT (23h UTC)** — `consolidar_diario.py`
  nunca rodou de verdade em produção ainda (só testado isoladamente).
  Primeira execução real será hoje à noite.
- [ ] **Comportamento de falha da consolidação** — se `consolidar_diario.py`
  quebrar no meio da execução (ex: falha de rede no Graph API), não há
  `TarefaEscalada`/escalonamento associado a esse script — falha ficaria
  silenciosa, visível só no log
  (`~/itp-stack/catalogo-erros-consolidacao.log`). Não implementado.
- [ ] **Alerta `catalogo_erros_teto_atingido`** (Grafana, separado do que
  foi excluído em 11.1) — não verificado se tem o mesmo drift de
  `noDataState`.

**Conhecido, fora de escopo por decisão explícita:**

- `PROMPT_EXECUCAO_WRAPPER` (`claude_client.py`) menciona só "deploy.sh
  do erp_itp" — não generalizado pra APRXM (que usa GitHub Actions, não
  `deploy.sh`). A IA se adaptou sozinha na prática (ver commits da seção
  12.2), mas o texto do prompt não reflete isso.
- Camada 2 real (busca exata no SharePoint, `buscar_por_assinatura`)
  usa `aplicacao_sugerida` como parte da chave de busca — mesmo padrão
  de risco do bug corrigido no staging (seção 12.4), mas essa parte já
  era assim desde antes de 2026-09-15. Não é regressão de hoje, não foi
  alterada, mas é uma fragilidade estrutural que existe.

---

## 12. Incidente de 2026-09-15 e evolução de arquitetura

Dia de trabalho único que começou como resposta a incidente (as duas
contas do Claude CLI usadas pela automação da VM estouraram a sessão de
5h) e terminou em várias mudanças estruturais de arquitetura, feitas com
o pipeline pausado e cada mudança validada antes de religar. Resumo
cronológico das decisões e correções reais (PRs #48 a #62 do `erp_itp`).

### 12.1 Causa raiz do estouro de sessão e contenção

- **Causa disparadora**: nenhum bug de código — as duas contas do Claude
  CLI usadas pela automação (`erickcardoso@...`, `dev.itp@...`) também
  são usadas por humanos em sessões interativas normais, e nunca houve
  uma conta dedicada só pra automação. Compartilhamento de conta com uso
  humano é um risco aceito, não eliminado.
- **Contenção implementada em `claude_client.py`**:
  - `TIMEOUT_MAXIMO_S = 300` — nenhuma chamada ao Claude CLI roda mais
    que 5min; ao estourar, levanta `TarefaEscalada` com diagnóstico
    completo em vez de ficar presa.
  - Failover entre conta principal e secundária (`~/.claude-account-b`)
    em rate-limit real (HTTP 429), com notificação por email throttled
    (1/6h).
  - Trava global bloqueante (`flock`) em volta de toda chamada real ao
    `claude -p` — nunca roda mais de um processo `claude` ao mesmo tempo
    no servidor inteiro (`coletor.py`, `aplicador.py` ou script futuro
    disputavam a mesma conta sem essa trava).
  - **Teto preventivo de 20% da sessão por conta**, autocalibrado: como
    o Claude Code CLI não expõe % de uso da sessão via API (só o sinal
    binário de 429), o sistema usa o `total_cost_usd` acumulado no
    momento de cada rate-limit real como "teto calibrado" daquela conta,
    e bloqueia preventivamente (sem gastar nada) ao passar de 20% disso
    na janela de 5h atual. Decisão explícita do analista de manter esse
    teto mesmo sabendo que fica restritivo na prática (a 1ª calibração
    do dia saiu em ~$0,78, então 20% é só ~$0,155 — menos que 1
    classificação típica) — ver seção 11.2.
- `registrar_escalonamento()` (novo, compartilhado entre coletor e
  aplicador): grava todo evento de escalada em
  `~/itp-stack/catalogo-erros-escalonamentos.jsonl` + métrica Prometheus
  `catalogo_erros_escalonamentos_total`.

### 12.2 Falha no Fluxo A do Power Automate (aprovação)

Três bugs reais achados e corrigidos no fluxo `915f14b9-...` (o mesmo
"Fluxo A" da seção 5.1), todos do mesmo padrão: uma ação lia
`outputs('Atualizar_item')?['body/CAMPO']` — o corpo de resposta de uma
ação de **atualização** (`PatchItem`), que o conector do SharePoint
sempre devolve vazio — em vez de `triggerBody()?['CAMPO']` (o item que
disparou o fluxo, sempre populado):

1. **Condição** (`greater(Confianca, 6)`) quebrava com `Null` — corrigido
   pra ler `triggerBody()?['Confianca']`.
2. **`Atualizar item 2`** (ação final, seta `Status=aprovado`) quebrava
   porque o parâmetro `id` vinha do mesmo padrão errado — corrigido pra
   `triggerBody()?['ID']`.
3. **`ResumoNotificacao`** (o corpo do email/card de aprovação) chegava
   sempre vazio pelo mesmo motivo em todos os campos — corrigido pra
   `triggerBody()?[...]` em cada um.
4. **Condição de Disparo do gatilho** ajustada (pelo analista, na UI) pra
   exigir `Criticidade` em alta/crítica além de `Fase` — ver 12.3.

Durante o pico de reclassificações do backlog (ver 12.4), o volume de
aprovações geradas em rajada (itens legítimos e distintos, não um loop
de re-disparo — hipótese de loop investigada e descartada) levou o
analista a aprovar vários itens rapidamente. Duas dessas aprovações
resultaram em **execução real de correção em produção no `aprxm_sys`**
(commits `6d59459` e `2ca1a11`, `aprxm_backend` redeployado via GitHub
Actions, container confirmado saudável) — decisão do analista foi
confiar no diagnóstico em vez de reverter, ver 11.2.

### 12.3 Acesso da IA ao código da APRXM

Achado: o container `itp_postgres` hospeda os bancos **das duas**
aplicações (`erp_itp_db` e `aprxm_db`) no mesmo processo Postgres, mas
`claude_client.py` restringia o diretório de trabalho da investigação só
a `~/erp_itp` — todo erro de origem APRXM (ex: triggers de integridade
referencial `packages`/`residents`/`association_id`, confirmadas reais
no banco) era investigado sem acesso ao código certo, virando "sem
origem localizada no código do ERP ITP" por falta de onde procurar.

Primeira tentativa de correção (symlink `~/itp-stack/catalogo-erros-workspace/{erp_itp,aprxm_sys}`
como diretório de trabalho) **não funcionou**: o Claude Code CLI recusa
symlink que resolve pra fora do diretório de trabalho permitido
(sandbox). Corrigido de verdade com a flag oficial `--add-dir
~/aprxm_sys`, mantendo `cwd` em `~/erp_itp` como sempre foi. Prompt
atualizado pra IA saber que os dois repositórios existem e escolher
pela origem real do erro, não pelo container de onde veio.

Backlog de 56 itens classificados antes dessa correção foi reprocessado:
48 confirmados ruído de DDL (fechados de graça, sem IA), 2 sobre
`pg_session_jwt` (causa já conhecida, resolvidos manualmente), 6
triggers reais da APRXM reclassificados com o acesso correto — um deles
(CAT-0179) ficou pendente por timeout na reclassificação, ver 11.2.

### 12.4 Roteamento por criticidade e consolidação diária

A pedido do analista, pra reduzir volume de notificação em tempo real e
dar mais controle de como erros chegam à IA e ao analista — implementa
o "Fluxo B" já previsto no design original (seção 2/10) e nunca
construído, mas via código em vez de Power Automate:

- **`coletor.py`**: só criticidade alta/crítica cria item na hora no
  SharePoint (dispara aprovação em tempo real, como sempre foi).
  Baixa/média (incluindo o ruído de DDL da Camada 2.5) vai pro **staging
  diário** (`staging_diario.py`, JSON local na VM) em vez do SharePoint.
- **Por que precisa de staging e não só o Parquet**: sem uma "memória do
  dia" fora do SharePoint, o mesmo erro baixo/médio recorrendo várias
  vezes no mesmo dia seria reclassificado pela IA a cada ocorrência (a
  Camada 2 real só vê o que já está no SharePoint).
- **Bug real achado e corrigido no mesmo dia**: a chave de dedup do
  staging usava a aplicação **decidida pela IA** (`classificacao['aplicacao']`)
  em vez da **sugerida pelo container** (`aplicacao_sugerida`) — quando
  as duas divergem (ex: um erro do `itp_postgres` que a IA classifica
  como `Aplicacao=BD`), a mesma mensagem nunca era reencontrada no
  staging, caía de novo na Camada 3 a cada rodada, e ficava
  perpetuamente adiada assim que o teto de 5/rodada fosse atingido por
  outros grupos — sem gerar linha no Parquet, sem crescer a contagem
  real, silenciosamente. Corrigido: a chave é sempre `aplicacao_sugerida`;
  a aplicação real da IA fica só dentro da classificação guardada,
  usada na hora de criar o item de verdade.
- **`consolidar_diario.py`** (novo, substitui a ideia original de
  `relatorio_diario.py` de mais cedo no mesmo dia, que só lia itens já
  existentes): roda 1x/dia às 23h UTC (20h BRT), cria de verdade na
  SharePoint List todos os itens represados no staging, zera o staging,
  e manda **1 único email-resumo terso** com a contagem por criticidade
  (ex: "48 erro(s) de criticidade baixa") + link da lista — sem detalhar
  item por item.
- **Aprovação de itens represados**: `PromptExecucao` já sai
  pré-preenchido (`Diagnostico` + `CorrecaoProposta`) na criação do
  item, mesmo pros represados — aprovar um item da consolidação diária é
  só trocar `Status` pra `aprovado` direto na lista, sem depender de
  nenhum fluxo do Power Automate pra esse caminho.
- **Bônus**: como baixa/média nunca chega a existir no SharePoint em
  tempo real, o fluxo do Power Automate simplesmente nunca é acionado
  pra esses itens — mesmo quando a consolidação noturna os cria em lote,
  a Condição de Disparo (12.2, item 4) barra qualquer aprovação
  disparada por esse lote.

### 12.5 Outras correções do mesmo dia

- **Hotfix de compatibilidade Python 3.9**: `claude_client.py` usou
  anotação de tipo `float | None` (PEP 604, Python 3.10+) sem `from
  __future__ import annotations` — quebrava a importação do módulo em
  produção (VM roda Python 3.9). Corrigido; validação de mudanças neste
  diretório passou a incluir importar o módulo de verdade no Python 3.9
  da VM antes de considerar deployado, não só `ast.parse` local (que não
  pega esse tipo de incompatibilidade de versão).
- **Backfill de `Confianca`**: investigado como possível causa raiz de
  um bug no Fluxo A — descartado, os 430 itens da lista já tinham esse
  campo preenchido. A causa real foi a encadeada em 12.2.
- **Alerta de escalonamento excluído do Grafana** — ver seção 11.1.

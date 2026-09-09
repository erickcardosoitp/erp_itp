# Catálogo de Erros da VM

> Documento vivo do projeto de catalogação automática de erros da
> `vm-itp-prod`. Para o design técnico detalhado e o histórico de decisões,
> ver `docs/superpowers/specs/2026-09-09-catalogo-erros-vm-design.md`
> (v4). Este arquivo é o resumo executivo + estado atual.
> Última atualização: 2026-09-09.

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
| Lista `CatalogoErros` | **Pendente** — criação manual pela UI (ver seção 5, limitação de API) |

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
| `Fase` | Escolha | detectado, investigando, diagnosticado, aguardando_aprovacao, aplicando, validando, escalado |

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
| `CamadaInvestigacao` | Escolha | log_app, schema_banco, infra_vm, integracao_externa |
| `Confianca` | Número | 0 a 10 (corte de auto-elegibilidade proposto: 8,5) |
| `IAPodeResolver` | Escolha | sim_seguro, sim_com_risco, nao |
| `Diagnostico` | Texto longo | Análise do Claude |
| `MensagemExemplo` | Texto longo | Última mensagem bruta, sem normalizar |

**Bloco 5 — Correção e execução**
| Coluna | Tipo | Valores/formato |
|---|---|---|
| `CorrecaoProposta` | Texto longo | Correção sugerida |
| `AcaoExecutada` | Texto | Código da ação do catálogo (seção 7) |
| `LinkCommit` | Hyperlink | |
| `ResolvidoEm` | Data/hora | |
| `TentativasResolucao` | Número | |

**Bloco 6 — Aprovação humana**
| Coluna | Tipo | Valores/formato |
|---|---|---|
| `AprovadoPor` | Pessoa | |
| `AprovadoEm` | Data/hora | |
| `MotivoRejeicao` | Texto longo | |

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
editável).

- **Escopo v1**: tabela de erros agrupados por `CodErro`, filtro por
  `Aplicacao`/`Categoria`/`Criticidade`/`Status`/período, drill-down no
  histórico completo de ocorrências de um erro, gráfico de tendência
  simples (erros por dia/semana, por categoria).
- **Fora do escopo v1**: edição de dados (fica só na SharePoint List),
  autenticação própria, notificações.
- **Stack**: backend Python (FastAPI + DuckDB lendo os Parquet), frontend
  Next.js (mesmo padrão do `erp_itp`).
- **Deploy**: mais 2 containers no `docker-compose.yml` da VM, atrás do
  mesmo Traefik (ex: `observabilidade.institutotiapretinha.org`).

---

## 10. Próximos passos

- [x] Criar site, app registration, permissão Graph, lista `CatalogoErros` (26 colunas) — feito 2026-09-09.
- [x] Validar escrita/leitura de item completo via API — feito e testado 2026-09-09.
- [x] Decidir local do Parquet — disco local da VM, dentro do backup existente.
- [ ] Escrever o script coletor (normalização regex → dedup 3 camadas → Claude Code CLI → sync SharePoint + Parquet).
- [ ] Rodar o coletor manualmente contra os logs reais da VM e validar contra os 6 grupos já identificados (seção 6).
- [ ] Agendar os 2 crons (coletor 3/3h; aplicação de correção aprovada, proposto 30 min).
- [ ] Montar os 2 flows do Power Automate (aprovação + relatório diário) — passo a passo depois que o coletor estiver gerando itens de verdade.
- [ ] Popular o catálogo de ações/playbooks além dos 9 exemplos da seção 7.
- [ ] Construir a app de visualização do Parquet (seção 8): backend FastAPI+DuckDB, frontend Next.js, deploy como 2 containers novos na VM.
- [ ] Rodar 1-2 semanas em modo piloto (só observando) antes de aprovar qualquer correção de verdade.

---

## 11. Em aberto

- Frequência do cron de aplicação de correções aprovadas (proposto: 30 min).
- Threshold de "pico de frequência" pra categoria `integracao` (proposto: >5/1h).
- Regras de auto-fix da v2 (quando liberar ações de baixo risco sem aprovação).
- Data de expiração do client secret do app `Catalogo Erros - VM` (anotar quando disponível).
- Onde plugar APRXM e DW quando migrarem.
- Onde plugar APRXM e DW quando migrarem.
- Data de expiração do client secret do app `Catalogo Erros - VM` (anotar quando disponível, pra não pegar de surpresa a rotação).

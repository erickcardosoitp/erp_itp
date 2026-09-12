# Catálogo de Erros da VM — Design Spec
**Data:** 2026-09-09 (v4 — schema final da lista, fingerprinting em 3 camadas, infra validada)
**Status:** Implementado e validado em produção (ciclo completo testado 2026-09-10, ver `CATALOGO-ERROS.md` seção 9 pro estado/achados atuais — este documento é o registro histórico de design, não é atualizado com o dia a dia)
**Projeto:** Infra vm-itp-prod (multi-app: ITP, APRXM, DW futuramente)

---

## 1. Objetivo

Catalogar automaticamente os erros registrados na VM (`vm-itp-prod`) para
cada aplicação hospedada nela (ITP hoje; APRXM e DW quando migrarem/subirem),
classificá-los, propor/aplicar correções (com aprovação humana) via Claude
Code CLI, e manter um histórico analítico consultável separado do catálogo
operacional do dia a dia.

Motivação: hoje a única forma de descobrir erros é vasculhar manualmente
`docker logs`/journalctl sob demanda — como aconteceu na sessão de
2026-09-09, que só achou e corrigiu 3 bugs de schema no `erp_itp` porque
alguém perguntou "cadê os logs". Não há processo recorrente nem memória
de "isso já foi visto e tratado".

Este design foi refinado a partir de um modelo de investigação de
incidentes de dados (Power BI/DW) desenhado para outro cliente — mas
mantido **enxuto**: o catálogo operacional é uma SharePoint List simples,
não um schema relacional complexo.

---

## 2. Três peças, três responsabilidades

| Peça | Onde vive | Papel |
|---|---|---|
| **Camada de serviço** | VM (script + Claude Code CLI) | Lê logs, classifica, investiga, deduplica, gera diagnóstico/correção |
| **Catálogo operacional** | SharePoint List `CatalogoErros` | Estado **mutável**: status, fase, contador. O que Power Automate lê/escreve |
| **Histórico analítico** | Parquet (append-only) | Uma linha por ocorrência, nunca alterada. Consulta/visualização/DW futuro |

**Não existe banco relacional nessa feature.** Parquet é imutável (sem
UPDATE nem point lookup), então todo estado que muda vive na SharePoint
List. Parquet só faz o que faz bem: append e leitura analítica.

---

## 3. Infraestrutura Microsoft 365 — já provisionada (2026-09-09)

- **Tenant:** `insttiapretinha.onmicrosoft.com` (domínio custom `institutotiapretinha.org`), tenant ID `0ce4c521-c3f0-40c8-b32b-374ddac76505`.
- **Site SharePoint:** `https://insttiapretinha.sharepoint.com/sites/ObservabilidadeITP` — criado.
- **App registration dedicado:** `Catalogo Erros - VM`, client ID `baf58f64-f423-4188-8dd1-462ede6afe22` — criado, **separado** do app de SSO (`ERP ITP - Login SSO`) por segurança (rotação independente, rastreabilidade de auditoria, superfície de exposição menor).
- **Permissão Graph:** `Sites.ReadWrite.All` (Application), consentida pelo admin.
  - ⚠️ **Achado importante:** `Sites.Selected` (a opção mais restrita, cogitada inicialmente) exige, além do consentimento, um passo extra de autorização por site — e esse passo se mostrou inviável no ambiente: `PnP.PowerShell` falha no Cloud Shell (dependência nativa `libsecret` ausente, sem `sudo` disponível pra instalar), e o fluxo alternativo via device-code (`Microsoft Graph PowerShell`, client público) foi bloqueado por política de Acesso Condicional do tenant (`AADSTS530035`, dispositivo não registrado). O painel de administração que resolveria isso pela UI (SharePoint Advanced Management → API access) é um add-on pago, não disponível no plano atual. Diante disso, trocamos para `Sites.ReadWrite.All` — funciona imediatamente após consentimento simples, sem esses obstáculos. Custo aceito: o app pode escrever em qualquer site do tenant (mitigado por o client secret só existir na VM).
- **Segredo:** armazenado em `~/itp-stack/catalogo_erros.env` na VM (`chmod 600`), nunca passou pelo chat.
- **Limitação confirmada:** o app **não consegue criar listas novas** via Graph API (`POST /sites/{id}/lists` → sempre `403 accessDenied`, mesmo com `Sites.ReadWrite.All` completo) — restrição de tenant que separa "escrever conteúdo" de "criar estrutura". **Escrever/ler itens numa lista já existente funciona normalmente** (testado e confirmado). Por isso, a lista `CatalogoErros` precisa ser **criada manualmente pela UI** (passo único), e depois disso tudo é automatizado via API.

---

## 4. Fluxo geral

```
APLICAÇÃO (erro em log/container)
        ↓
CAMADA DE SERVIÇO NA VM (script + Claude Code CLI headless)
   - lê docker logs / journalctl
   - normaliza a mensagem (regex — seção 6)
   - deduplica em 3 camadas (seção 6)
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

---

## 5. Catálogo operacional — SharePoint List `CatalogoErros`

**Criação:** manual, pela UI do SharePoint (ver seção 3 — limitação de API).
Depois de criada, leitura/escrita de itens é 100% automatizada.

| Coluna | Tipo SharePoint | Valores / formato |
|---|---|---|
| `Aplicacao` | Escolha | ITP, APRXM, DW |
| `Categoria` | Escolha | banco, codigo, infra, seguranca, usuario, integracao *(lista aberta — pode crescer quando APRXM entrar)* |
| `TipoErro` | Texto (linha única) | Rótulo curto gerado livremente pelo Claude (ex: "Divergência de tipo UUID/varchar em FK") — não é enum fixo |
| `Assinatura` | Texto (até 500 car.) | Mensagem normalizada (ver seção 6) — usada só pra leitura/debug, não é mais a chave de dedup primária |
| `CodCat` | Texto | Código do item neste catálogo: `CAT-{ID nativo do SharePoint:04d}` |
| `CodErro` | Texto | Código do **grupo** do erro — mesmo valor em toda ocorrência (ver seção 6). É a FK real com o Parquet |
| `MensagemExemplo` | Texto (várias linhas) | Última mensagem bruta capturada, sem normalizar |
| `Ocorrencias` | Número | Contador |
| `PrimeiraVez` / `UltimaVez` | Data/hora | |
| `Diagnostico` | Texto (várias linhas) | Análise do Claude Code CLI |
| `CorrecaoProposta` | Texto (várias linhas) | Correção sugerida, pronta pra aprovação |
| `Criticidade` | Escolha | baixa, media, alta, critica |
| `Fase` | Escolha | detectado, investigando, diagnosticado, aguardando_aprovacao, aplicando, validando, escalado — **estágio técnico do pipeline** |
| `Status` | Escolha | aberto, resolvido, reaberto, conhecido, descartado — **resultado de negócio, resumo pro relatório** |
| `IAPodeResolver` | Escolha | sim_seguro, sim_com_risco, nao — avaliação da IA, **não implica execução automática na v1** |
| `Confianca` | Número | 0 a 10 (não estrelas — compatível com threshold matemático, corte proposto em 8,5) |
| `AprovadoPor` | Pessoa | Quem decidiu (distinto do `Editor` nativo, que mostraria a identidade do app) |
| `AprovadoEm` | Data/hora | |
| `MotivoRejeicao` | Texto (várias linhas) | Se rejeitado, por quê |
| `AcaoExecutada` | Texto (linha única) | Código da ação do catálogo (seção 8) que foi de fato executada |
| `LinkCommit` | Hyperlink | Link pro commit/PR que corrigiu, quando aplicável |
| `CamadaInvestigacao` | Escolha | log_app, schema_banco, infra_vm, integracao_externa — onde a causa foi confirmada |
| `ResolvidoEm` | Data/hora | Timestamp da resolução real (distinto de `UltimaVez`, que é só a última ocorrência) |
| `TentativasResolucao` | Número | Quantas tentativas de correção já rodaram (liga com limite de 2 do loop) |
| `Reincidente` | Sim/Não | Marcado pela matriz de reincidência (seção 9) quando um erro "resolvido" volta |

`Fase` vs `Status` — por que são dois campos e não um: `Status` é o resumo
grosso pro relatório diário por email (você quer ver "quantos resolvidos",
não a sub-etapa técnica). `Fase` existe pra saber, a qualquer momento, **onde**
um incidente está no pipeline automatizado (útil pra debugar o próprio
sistema — ex: "por que esse incidente está parado há 3h" fica visível
olhando a Fase, não dá pra saber só pelo Status).

---

## 6. Fingerprinting e deduplicação — 3 camadas

Problema central: duas ocorrências do "mesmo" erro nunca são texto 100%
idêntico (timestamp, PID, valores variam) — e às vezes nem a estrutura é
idêntica (dois pontos de código com wording ligeiramente diferente para
o mesmo bug real). Resolver isso em camadas, da mais barata/determinística
pra mais cara/inteligente:

**Camada 1 — Normalização determinística (regex, sem custo de IA):**
Remove o que é sempre variável antes de qualquer comparação: timestamps,
`[PID]`, números soltos (posições de caractere, IDs) → `N`, UUIDs → `<uuid>`,
strings entre aspas que pareçam valor dinâmico → `<valor>`. Exemplo real
de hoje:
```
antes:  column "createdAt" does not exist at character 162
antes:  column "createdAt" does not exist at character 268
depois (as duas): column "createdAt" does not exist at character N
```

**Camada 2 — Busca exata na SharePoint List** pela mensagem normalizada
(dentro do mesmo `Aplicacao`+`Categoria`). Achou → é reincidência,
incrementa `Ocorrencias`, não gasta chamada de IA.

**Camada 3 — Comparação semântica via Claude** (só roda quando a camada 2
não bate, ou seja, só para erros genuinamente novos/ambíguos — não pra
toda ocorrência repetida): Claude recebe a mensagem normalizada + um
shortlist dos itens existentes da mesma `Aplicacao`/`Categoria`, e decide
se é, na essência, o mesmo problema de algum já catalogado.
- Confiança alta de que é o mesmo → funde (reusa o `CodErro` existente,
  incrementa `Ocorrencias`).
- Baixa confiança ou negativo → cria item novo.

**Princípio de segurança do fingerprinting:** na dúvida, criar item novo
em vez de fundir. Duplicar é inofensivo (mais itens pra revisar); fundir
errado é perigoso (pode esconder um bug novo dentro de um ticket já
"resolvido"). Não usamos embeddings/vetor nesta v1 — se a variação
semântica se provar um problema recorrente, é a extensão natural pra v2.

**Os três identificadores, pra não confundir:**

| Campo | O que é | Estabilidade |
|---|---|---|
| `Assinatura` | Mensagem normalizada (camada 1) | Só leitura/debug — não é mais usada como chave primária de dedup sozinha |
| `CodCat` | Código do item no catálogo (SharePoint) | Único por item, gerado do ID nativo |
| `CodErro` | Código do **grupo** do erro | Gerado na 1ª ocorrência, igual em toda ocorrência subsequente (SharePoint e Parquet) — é a FK real |

---

## 7. Camada analítica — Parquet

Arquivo(s) gravados pela VM a cada evento (append), particionados por
`app`/`data`. Toda linha carrega o `CodErro` do grupo a que pertence —
é assim que se conta reincidência de verdade: `COUNT(*) WHERE CodErro = X`,
sem depender de comparação de texto.

```
CodErro, app, categoria, tipo_erro, mensagem_normalizada, criticidade,
status_no_momento, timestamp_ocorrencia, foi_auto_corrigido (bool)
```

Uso: tendências ("quantos erros de banco por mês"), sem sobrecarregar a
lista operacional com histórico morto. Quando o DW subir, vira insumo
natural de carga pra lá — mesmo formato do pipeline de dados existente.
Ferramenta de consulta: DuckDB local (embutido, sem servidor) e/ou
Power BI mais adiante.

---

## 8. Ações do Power Automate

| Etapa | Ação | Uso |
|---|---|---|
| Entrada | Trigger (item criado na SharePoint List) | Novo incidente |
| Aprovação | Start and wait for an approval | Exigir humano pra correção proposta |
| Atualização | Update item | Marca `Status`/`Fase`/`AprovadoPor`/`AprovadoEm` na lista |
| Relatório | Recorrência (diária) + Get items + Outlook | Novos, tratados, conhecidos, pendentes |

Sem loop de investigação dentro do Power Automate — isso roda todo na VM
via Claude Code CLI. Power Automate fica só com aprovação + relatório.

---

## 9. Investigação em camadas + catálogo de ações

Ordem que o Claude Code CLI segue ao investigar (grava em `CamadaInvestigacao`):

1. **log_app** — docker logs do container relevante
2. **schema_banco** — compara entidade TypeORM vs `\d tabela` real
3. **infra_vm** — disco, memória, restarts, cron
4. **integracao_externa** — SSO, Graph API, webhooks (só se as anteriores não explicarem)

Vocabulário fechado de ações (grava em `AcaoExecutada`):

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

---

## 10. Matriz de reincidência (erro volta após `Status=resolvido`)

| Categoria | Ação padrão | Racional |
|---|---|---|
| banco | Reabre (`Status=reaberto`, `Fase=detectado`) sempre | Schema/integridade não deveria regredir |
| integracao | Mantém `resolvido`, só incrementa — exceto pico (>5/1h) → reabre | Instabilidade externa é esperada, pico é sinal real |
| usuario | Mantém `resolvido`/`conhecido`, só incrementa | Reincide naturalmente com usuários diferentes |
| codigo / infra / seguranca | Reabre sempre | Mesmo racional de banco — regressão real |

---

## 11. Regras de segurança

1. Claude Code CLI não inventa comando/endpoint/SQL — só escolhe da
   tabela de ações da seção 9.
2. Investigar e corrigir são etapas diferentes — corrigir sempre espera
   aprovação humana na v1, mesmo pra ações de baixo risco (`IAPodeResolver`
   é só metadado de avaliação, nunca gatilho de execução automática).
3. Nenhum banco (erp_itp_db, aprxm_db) recebe alteração de schema sem
   aprovação humana.
4. Credenciais/segredos nunca entram no prompt do Claude Code CLI, nem
   no chat de configuração (aconteceu na prática hoje: o segredo do app
   `Catalogo Erros - VM` foi colocado direto na VM via SSH, nunca visto
   pelo assistente).
5. Toda ação executada é registrada (`AcaoExecutada`, `LinkCommit`, log
   local, Parquet).
6. Limitar tentativas (2 por ação, grava em `TentativasResolucao`) e
   passos (8 por incidente) na investigação.
7. Reprodução manual (psql/curl direto) continua sendo a validação antes
   de confiar num diagnóstico — foi assim que testei a migration v23 e o
   cast `::uuid` no dia 2026-09-09, direto no Postgres, antes do deploy.
8. Fingerprinting erra para o lado seguro: na dúvida, item novo em vez de
   fundido (seção 6).

---

## 12. Em aberto / não decidido ainda

- Criar manualmente a lista `CatalogoErros` com as 26 colunas da seção 5
  (bloqueado em API, ver seção 3).
- Onde os arquivos Parquet ficam fisicamente (disco local da VM + backup,
  ou já direto num Blob Storage/OneDrive?).
- Frequência do cron de aplicação de correções aprovadas (proposto: 30 min).
- Threshold de "pico de frequência" pra categoria `integracao` (proposto: >5/1h).
- Regras de auto-fix da v2 (quando liberar ações de baixo risco sem aprovação).
- Onde plugar APRXM e DW quando migrarem.
- ✅ Rotação do client secret do app `Catalogo Erros - VM`: **expira em
  09/09/2027** (confirmado manualmente pelo usuário no Entra ID — a API
  segue sem privilégio suficiente pra ler isso, `Insufficient privileges`
  mesmo com os service principals disponíveis). Agendar rotação com
  antecedência (ex: lembrete pra agosto/2027).
- **Flow B (relatório diário por email) ainda não foi construído** — só
  Flow A (aprovação) existe hoje no Power Automate. Pendente.
- ✅ **Bug real do Flow A corrigido (2026-09-12)**: o email "Novo incidente"
  disparava em **toda atualização** de item (trigger "Quando um item é
  criado ou modificado"), não só criação — as 3 ações de notificação
  (Atualizar item/ResumoNotificacao/Enviar email) rodavam fora de
  qualquer condição, incondicionalmente. Corrigido: movidas pro ramo
  "Verdadeiro" de uma condição (`Condição 2`) que só passa se
  `Criticidade` = alta/critica OU `IAPodeResolver` = mediano/alto risco.
  Reduz bastante o volume de "incidente" que ofuscava os emails de
  aprovação de verdade.
- **Notificação de escalonamento (novo requisito, 2026-09-11)**: usuário
  precisa ser avisado no momento em que um item cai em `Fase=escalado`,
  já com um relatório completo do que aconteceu (diagnóstico, tentativas,
  resultado de cada execução) — hoje não existe esse alerta, só descobre
  entrando manualmente na lista. Candidato a um 3º flow (trigger em
  mudança de `Fase` pra `escalado` → montar resumo com os campos
  Diagnostico/ResultadoExecucao/TentativasResolucao → notificar por
  email/Teams).
- **AI Builder**: usuário quer avaliar uso do AI Builder em algum ponto do
  fluxo do Power Automate — ainda sem escopo definido, precisa de definição
  de onde encaixaria (hoje toda a parte de IA já é feita fora do Power
  Automate, via Claude Code CLI na VM).
- **Bug confirmado, não corrigido**: coluna `LinkCommit` nunca é gravada
  com sucesso (PATCH isolado sempre falha, 100% dos itens testados vazios)
  — ver `aplicador.py` linhas 107-112, e achado de 2026-09-11.
- **Camadas de dedup/análise adicionais (avaliar depois, 2026-09-11)**: hoje
  só há 3 camadas de dedup (exata, semântica via IA, criação de item novo).
  Ideias levantadas pra depois, quando o volume de erros justificar (ainda
  falta subir a aplicação mais importante do parque — volume real de erro
  vai crescer bastante depois disso):
  - Correlação temporal entre containers (ex: Postgres cai → backend não
    conecta no mesmo minuto — hoje viram 2 itens desconectados).
  - Sub-agentes/skills especializados por categoria (schema de banco,
    infra/Traefik) em vez de um prompt genérico único — só vale o custo
    extra se o volume justificar.
  - Reavaliar viabilidade só depois que o volume real de erro aumentar.
- **Lacuna confirmada, não corrigida**: `claude_client.executar()` não
  re-verifica impacto colateral no momento da execução (só a classificação
  inicial faz isso) — se o código mudar entre a proposta e a aprovação, a
  execução não percebe.

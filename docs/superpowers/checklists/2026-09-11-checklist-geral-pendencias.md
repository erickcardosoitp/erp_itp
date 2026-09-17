# Checklist geral de pendências — 2026-09-11

Consolidado de tudo que está/esteve pendente no `erp_itp` (catálogo de
erros, ITP_TEC, monitoramento, dívidas técnicas do código). Ver também
`2026-09-11-itp-tec-checklist.md` (checklist da rodada anterior) e
`CATALOGO-ERROS.md` (seções 10/11) / `ARCHITECTURE.md` (§7, §9) pros
detalhes completos de cada item.

---

## ✅ Feito (2026-09-11)

**Catálogo de erros / documentação**
- `relatorios/page.jsx` órfão removido; `LinkCommit` do catálogo de
  erros com causa raiz confirmada (limitação real da Graph API), link
  embutido em `ResultadoExecucao`; README do catálogo corrigido.
- Blind spot duplo de crash client-side (`PageErrorBoundary` +
  `error.tsx` global) — ambos reportam pro backend.
- Bug do ANSI quebrando query OData do Graph API corrigido.
- Ciclo completo do catálogo de erros validado ponta a ponta (2 casos
  reais, incluindo correção autônoma commitada e deployada).
- Backfill retroativo de `AprovadoEm`: decisão de não inventar dado em
  itens anteriores ao pipeline de aprovação, documentado no lugar.
- Site institucional (repo `website_tia_pretinha`) ganhou Error
  Boundary + reporte pro mesmo `/frontend-logs`, unificando com o
  catálogo — `Aplicacao=SITE` criado e reconhecido pelo `coletor.py`.
- Backend do `erp_itp` ganhou handler de
  `uncaughtException`/`unhandledRejection` (log estruturado antes de
  cair).
- Catálogo de ações populado: `VERIFICAR_MEMORIA`,
  `VERIFICAR_CONFIG_DUPLICADA`, `CRIAR_SWAP`, `CORRIGIR_CONFIG_DUPLICADA`
  (nomes em português).
- Bug real do `REABRE_SEMPRE` (grafia divergente de `CATEGORIAS_VALIDAS`
  fazia reincidência de `código`/`security`/`terceiros` nunca reabrir um
  item resolvido) — corrigido + `test_reincidencia.py` criado (7 testes).

**Dívidas técnicas do `erp_itp` (`ARCHITECTURE.md` §7)**
- `FuncionariosController` duplicado corrigido.
- `matriculas/database.ts` (vazio) e migration órfã removidos.
- Comandos `typeorm:migration:*` confirmados quebrados, `CLAUDE.md`
  corrigido.
- `auth`/`usuarios` refatorados pra módulos próprios, validado em
  produção (boot limpo, login testado).
- Rotas de chamada duplicadas investigadas — decisão: não consolidar
  (não são duplicatas de verdade). `/academico/chamada-professor`
  (órfão de verdade) removido.
- **P1 da auditoria de banco concluído**: 27 índices de FK ausentes +
  4 `CHECK`/enum criados, promovidos pro `runMigrations()` (v24),
  testado idempotente em produção.
- **P2 da auditoria de banco concluído**: `updated_at`/`created_at`
  faltando em 17 tabelas (v25) + nomenclatura camelCase→snake_case
  unificada em 5 tabelas, entities + queries cruas + bootstraps
  corrigidos juntos (v26). `usuarios.createdAt` duplicada renomeada pra
  `created_at_legado` (preserva valor histórico em vez de descartar).
  Achado de quebra evitada: query hardcoded em `app.module.ts:586`.

**Infra da VM**
- Swap de 1GB criado (`/swapfile`), `/tmp` isolado via tmpfs
  (`nosuid,nodev,noexec`), `installonly_limit` duplicado corrigido.

**Monitoramento (Grafana + Prometheus) — pedido urgente do usuário**
- Prometheus + Grafana + node-exporter + cAdvisor + postgres-exporter +
  blackbox-exporter, tudo restrito a localhost inicialmente, depois
  Grafana exposto publicamente em
  `grafana.itp.institutotiapretinha.org` (Traefik+SSL) com **SSO
  Microsoft** configurado (reaproveitando o app registration do
  `erp_itp`) além do login por senha.
- 4 dashboards customizados em português (Visão Geral, Servidor,
  Containers, Banco de Dados) substituindo os 3 densos da comunidade —
  todas as métricas verificadas contra o Prometheus real antes de cada
  painel ir pro ar. Bug real de duplicata na barra de memória por
  container corrigido (faltava `sum by (name)`).
- Métricas de aplicação/API: `MetricsModule` no NestJS (`prom-client`),
  interceptor global medindo toda requisição (histograma de duração —
  base do Apdex), `/api/metrics` exposto.
- RUM (Web Vitals — LCP/INP/CLS) via lib `web-vitals` no frontend,
  reportando pro `/api/metrics/rum`.
- Métricas de negócio (matrículas/dia, chamados abertos,
  movimentações/dia) como gauges no backend, refrescadas a cada 60s —
  **ainda sem painel no dashboard** (ver pendências abaixo).
- Heartbeat externo via healthchecks.io (cron `*/5min`).
- **5 regras de alerta reais**, testadas ponta a ponta de verdade
  (parando containers reais): site/API fora do ar, disco cheio, memória
  crítica, container caído, taxa de erro 5xx alta. Email vai pra
  `monitoramento@institutotiapretinha.org` (caixa criada pelo usuário).
  Bug real de "stale metric" do Prometheus achado e corrigido
  (`no_data_state: Alerting`).
- Ícone do atalho trocado pra logo oficial do Grafana, área de trabalho
  da VM reorganizada.
- Dashboard **"KPI BUSINESS - ITP"**: 8 métricas de negócio reais
  (alunos ativos, matrículas hoje, chamados abertos, boletos pendentes,
  movimentações financeiras hoje, oportunidades de captação ativas,
  colaboradores ativos, estoque abaixo do mínimo) — todas verificadas
  contra o banco antes de virar painel.
- Achado e corrigido bug real: o job de scrape do `erp_itp_backend` no
  Prometheus só existia no repo, nunca tinha sido copiado pro arquivo
  de verdade na VM — as métricas de API/RUM/negócio nunca estavam sendo
  coletadas de fato até agora, mesmo com o endpoint funcionando.
- **2026-09-14:** `https://api-aprxm.institutotiapretinha.org`
  adicionado ao job `blackbox-http` do Prometheus (probe de
  disponibilidade) — domínio do backend migrado do APRXM não estava
  monitorado até então. Sem regra de alerta nova necessária (a regra
  "Site ou API fora do ar" já existente não filtra por `instance`).

---

## ✅ Feito (2026-09-14, sessão de revisão operacional do APRXM)

Detalhe completo em `aprxm_sys/docs/superpowers/plans/2026-09-12-migracao-aprxm-execucao.md`
(Fase H em diante) — resumo aqui só pra manter este checklist geral
atualizado:

- **4 bugs reais de produção corrigidos**: login/queries 500
  (search_path do pooler Neon), `/openapi.json` 500 (forward-ref),
  `bulk-deliver` de encomendas 500 (import local sombreando
  `HTTPException`), `POST /finance/transactions` 500 pra mensalidade
  nova (`ON CONFLICT` não batia com a constraint real da tabela —
  drift entre model SQLModel e schema de produção).
- **APRXM conectado de vez ao catálogo de erros compartilhado**:
  `aprxm_backend` adicionado à lista de containers monitorados
  (`catalogo-erros/config.py`), endpoint `/frontend-logs` novo nos 3
  frontends, handler global de exceção corrigido, WebAuthn/Groq/push
  instrumentados. Item de pendência antigo (linha abaixo) fechado.
- **Bug real no próprio coletor de erros**: crash (`exit_code=1`, 40
  vezes) por um caractere de controle ESC não coberto pela regex de
  ANSI — corrigido em `normalizador.py`. Nenhum heartbeat externo
  existia pra detectar isso antes (o vigia dependia de si mesmo se
  auto-diagnosticar) — criado heartbeat via textfile collector do
  node_exporter, cobrindo as 9 tarefas agendadas, não só o coletor.
  Nova regra de alerta "Coletor de erros sem execução recente".
- **Catálogo de erros revisado por completo** (18 itens): 8 fechados
  (2 bugs antigos de banco documentados retroativamente, 3 DNS/ACME do
  APRXM confirmados resolvidos, 1 o crash do coletor), 2 marcados
  `conhecido` (ruído de scanner externo, não é bug nosso), 1 deixado
  aberto de propósito por falta de evidência de correção
  (`ERR-6df1ae0ad9`, Traefik/Docker provider race).
- **Grafana — APRXM ganhou paridade com o ITP** (containers,
  visão geral, KPI business com 37 painéis, dashboard novo de
  Apdex/latência — nem o ITP tinha esse) + 2 pastas novas:
  **VM** (visão consolidada só de infraestrutura, host-wide) e
  **Sistemas e Aplicações** (KPIs de ITP e APRXM lado a lado).
- Alerta de "container caído" recalibrado (threshold 120s→300s) depois
  de gerar falso alarme em todo redeploy manual feito hoje.

---

## ✅ Feito (2026-09-16, checkup geral + revisão do catálogo)

- **Porta 5432 do Postgres fechada pro público** (`127.0.0.1:5432:5432`),
  confirmada tanto no `docker-compose.yml` quanto no container real em
  produção — encerra 21+ itens de scan de bot (`FATAL: role "postgres"
  does not exist`) catalogados entre 09/09 e 09/16, vários criticidade
  alta.
- **Bug real de deduplicação corrigido** (PR #69): `buscar_por_assinatura`
  (Camada 2 do dedup) filtrava por `Assinatura` **e** `Aplicacao`, e a
  `Aplicacao` final gravada (decisão da IA) podia divergir da sugerida
  pelo container — fazendo a busca exata nunca encontrar o item já
  existente e criar um novo a cada recorrência. Filtro agora usa só
  `Assinatura`.
- **Limpeza retroativa das duplicatas geradas por esse bug**: 368 itens
  duplicados em 101 grupos encontrados no catálogo inteiro; 261
  excluídos (mantido 1 canônico por grupo, com `Ocorrencias` somada).
  Catálogo caiu de 845 pra 584 itens. Grupo da validação de tenant
  (CAT-0089/090/152/153/179/180/261/411) preservado à parte por ser
  achado de código, não ruído de log puro.
- **CAT-0089/090/179 (falsos positivos de escopo) marcados `descartado`**:
  código-alvo de duas delas não existe no repo certo (confundido com
  `aprxm_sys`), e a terceira (trigger `check_package_resident_tenant`)
  foi confirmada em produção como proteção multi-tenant funcionando
  como projetado — auditoria SQL real não achou nenhuma linha
  divergente hoje. Causa raiz da tentativa original (por que a app
  tentou a gravação incompatível) não pôde ser confirmada — logs do
  período já tinham expirado.
- **CAT-0035 corrigido** (`ERR-6df1ae0ad9`, item de backlog desde
  09-14): adicionado `healthcheck` ao serviço `grafana` — o Traefik só
  passa a rotear pro container depois de `healthy`, eliminando a
  corrida com o provider Docker. Aplicado e confirmado em produção
  (`itp_grafana healthy`, rota 200) antes do commit.
- **CAT-0397/CAT-0446 corrigidos**: log `ERROR` rebaixado pra `warn` em
  login com credenciais inválidas e callback SSO com `state`
  divergente — comportamento normal de usuário, não bug. PR #71.
- **Catálogo revisado de 26 → 5 itens genuinamente abertos** depois da
  limpeza de duplicatas: sobraram CAT-0153/CAT-0180 (falta de
  validação de tenant no APRXM antes do UPDATE/entrega de encomenda —
  ver pendências abaixo).
- Confirmado que a PR #70 (reconciliação `infra/docker-compose.yml`
  com produção) já estava mergeada — fecha o achado de drift descrito
  no backlog abaixo, exceto pela parte de symlink (ver seção Backlog).

---

## ⏳ Falta

### 🟡 Médio — precisa investigação antes de decidir a solução

- [ ] **CAT-0153 / CAT-0180**: falta validação de tenant no APRXM antes
      do `UPDATE` em `deliver_package` e antes de persistir
      `delivered_to_resident_id`, deixando o trigger de BD
      `check_package_resident_tenant` estourar exceção 500 em vez da
      aplicação retornar um erro tratado. Achado real, código a
      corrigir em `aprxm_sys/backend/app/services/package_service.py`.

### 🔴 Depende de decisão/ação do usuário

- [ ] Implementar SSO no ITP_TEC antes de expor publicamente em
      `tec.itp.institutotiapretinha.org` (decisão já tomada, falta
      implementar — reusar o SSO Microsoft do `erp_itp`, mesmo padrão
      já usado no Grafana). Não é urgente enquanto continuar só
      localhost.
- [ ] Checar manualmente no Entra a data de expiração do client secret
      do app `Catalogo Erros - VM` (sem privilégio suficiente via API).
- [ ] Data de expiração/rotação da deploy key SSH usada pro push
      autônomo do `aplicador.py`.
- [ ] Montar na UI do Power Automate: **Flow B** (relatório diário
      consolidado) e **Flow C** (notificação de resultado/escalonamento
      após `aplicador.py` rodar) — só desenhados no design doc, Flow A
      é o único construído e testado até agora.
- [ ] Decisão de ambiente de homologação/dev — referência ao plano
      antigo está quebrada (repo `aprxm_sass` não existe no disco desta
      máquina). Precisa reconstruir a decisão do zero ou localizar o
      documento certo.
- [x] ~~Migração do `aprxm_sys` (2º sistema do parque) — não iniciada.~~
      Migração de backend/crons/domínio/storage pra `vm-itp-prod`
      concluída (2026-09-12 a 2026-09-14) — detalhes completos em
      `aprxm_sys/docs/superpowers/plans/2026-09-12-migracao-aprxm-execucao.md`.
      O banco continua no Neon (só o compute migrou).
- [ ] **Backup real de produção do Neon do APRXM não existe.**
      Adiado a pedido do usuário (2026-09-14) — "vamos fazer isso mais
      tarde em relação ao aprxm". Tentativa anterior mirou o próprio
      banco de produção por engano (revertida sem dano, ver Fase H do
      doc de migração). Precisa de um destino de backup genuinamente
      separado (outro projeto/branch Neon, ou snapshot automático do
      próprio Neon) — decisão e connection string corretos ainda
      pendentes do usuário.
- [ ] **Corte da Fase I do APRXM** (desligar de vez a function
      serverless do backend na Vercel) — adiado junto com o item acima.
      Já não recebe tráfego normal, só falta decidir quando desligar.
- [ ] Confirmar visualmente o painel de presidência do APRXM com login
      real (a conexão do datawarehouse já foi corrigida e testada por
      baixo — ETL manual rodando com sucesso — só falta confirmação
      visual). Adiado junto com os itens acima.
- [ ] Regras de auto-fix v2 (liberar ação sem aprovação humana) — só
      depois do piloto de 1-2 semanas rodando só com aprovação manual.
- [x] ~~Onde plugar APRXM e DW no catálogo de erros quando migrarem pra
      VM.~~ Feito 2026-09-14: `aprxm_backend` adicionado à lista de
      containers monitorados do coletor, `/frontend-logs` novo nos 3
      frontends, handler global corrigido, WebAuthn/Groq/push
      instrumentados. Ver Fase H do doc de migração pro detalhe
      completo.

### ⚫ Backlog — baixa prioridade, reavaliar depois

- [ ] `aplicador.py` não escalona um item aprovado com `PromptExecucao`
      vazio — fica parado pra sempre. Gap conhecido, decisão do usuário
      de não mexer por ora.
- [ ] `claude_client.executar()` não re-checa impacto colateral no
      momento da execução, só a classificação inicial faz isso.
- [ ] Camadas extra de dedup/análise no catálogo de erros (correlação
      temporal, sub-agentes por categoria) — só depois que o volume real
      de erro aumentar.
- [x] ~~**`ERR-6df1ae0ad9`** (Traefik perde a rota do Grafana por corrida
      com o provider Docker, 40 ocorrências) — sem evidência de que foi
      corrigido, deixado aberto de propósito (2026-09-14) em vez de
      fechar por suposição. Investigar se voltar a ocorrer.~~ Corrigido
      2026-09-16 (CAT-0035): `healthcheck` no serviço `grafana`, ver
      seção "Feito" acima.
- [ ] **Vários arquivos de infra na VM são cópias manuais, não
      symlinks nem lidos direto do git**: `~/itp-stack/docker-compose.yml`,
      `~/itp-stack/monitoring/prometheus/prometheus.yml`, e todo
      `~/itp-stack/monitoring/grafana/dashboards-json/` e
      `provisioning/`. Achado repetidamente em 2026-09-14: um
      `git pull` no checkout do `erp_itp` **não** aplica a mudança
      sozinho, precisa de `cp` manual pro caminho que o docker-compose
      de fato monta — gerou pelo menos 4 incidentes de "achei que
      tinha deployado mas não tinha" na mesma sessão. Vale trocar por
      symlink (ou o compose apontar direto pro checkout do repo) numa
      próxima rodada, pra eliminar essa classe de erro de vez.
      `~/itp-stack/docker-compose.yml` **foi reconciliado com o repo em
      2026-09-16 (PR #70)** — conteúdo igual hoje — mas continua sendo
      cópia manual, não symlink; drift pode voltar a acontecer no
      próximo deploy direto na VM sem replicar pro git (foi o que
      quase aconteceu de novo com o `healthcheck` do CAT-0035 nesta
      mesma sessão — replicado manualmente pro repo a tempo).

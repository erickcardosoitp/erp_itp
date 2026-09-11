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

---

## ⏳ Falta

### 🟡 Médio — precisa investigação antes de decidir a solução

- [ ] Painel de métricas de negócio no dashboard "ITP — Visão Geral"
      (matrículas/dia, chamados abertos, movimentações/dia) — os gauges
      já existem no backend (`/api/metrics`), só falta adicionar os
      painéis no Grafana e validar com o usuário se são as métricas
      certas.

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
- [ ] Migração do `aprxm_sys` (2º sistema do parque) — não iniciada.
- [ ] Regras de auto-fix v2 (liberar ação sem aprovação humana) — só
      depois do piloto de 1-2 semanas rodando só com aprovação manual.
- [ ] Onde plugar APRXM e DW no catálogo de erros quando migrarem pra
      VM.

### ⚫ Backlog — baixa prioridade, reavaliar depois

- [ ] `aplicador.py` não escalona um item aprovado com `PromptExecucao`
      vazio — fica parado pra sempre. Gap conhecido, decisão do usuário
      de não mexer por ora.
- [ ] `claude_client.executar()` não re-checa impacto colateral no
      momento da execução, só a classificação inicial faz isso.
- [ ] Camadas extra de dedup/análise no catálogo de erros (correlação
      temporal, sub-agentes por categoria) — só depois que o volume real
      de erro aumentar.

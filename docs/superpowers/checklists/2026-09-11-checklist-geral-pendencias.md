# Checklist geral de pendências — 2026-09-11

Consolidado de tudo que está pendente no `erp_itp` (catálogo de erros,
ITP_TEC, dívidas técnicas do código). Falta organizado por facilidade —
não por prioridade de negócio. Ver também `2026-09-11-itp-tec-checklist.md`
(checklist da rodada anterior) e `CATALOGO-ERROS.md` (seções 10/11) /
`ARCHITECTURE.md` (§7) pros detalhes completos de cada item.

---

## ✅ Feito nesta rodada (2026-09-11)

**Monitoramento (Grafana + Prometheus)**
- Pedido urgente do usuário: painel completo de monitoramento "como um
  Grafana". Subido Grafana + Prometheus + node-exporter + cAdvisor +
  postgres-exporter + blackbox-exporter, tudo restrito a localhost.
  3 dashboards prontos da comunidade provisionados automaticamente.
  Heartbeat externo via healthchecks.io (cron `*/5min`) — cobre o caso
  da VM inteira cair, quando o próprio Grafana não tem como avisar
  ninguém. Testado e validado: 7/7 targets do Prometheus up, 3
  dashboards carregados, atalho de desktop criado. Ver `ARCHITECTURE.md`
  seção 9 pro detalhamento completo.

**Catálogo de erros / documentação**
- `relatorios/page.jsx` órfão removido (dado mockado, sem uso).
- `LinkCommit` do catálogo de erros — causa raiz confirmada (limitação
  real da Graph API), link embutido em `ResultadoExecucao` em vez de
  tentar escrever na coluna Hyperlink.
- README do catálogo de erros corrigido (não citava mais o `LinkCommit`
  como pendência aberta).
- Blind spot duplo de crash client-side (`PageErrorBoundary` + `error.tsx`
  global do App Router) — ambos reportam pro backend agora.
- Bug do ANSI (`\x1b[...m`) quebrando a query OData do Graph API —
  corrigido no `normalizador.py`.
- Ciclo completo do catálogo de erros validado ponta a ponta (2 casos
  reais, incluindo correção autônoma commitada, com push e deploy feitos
  pelo próprio `aplicador.py`).
- Backfill retroativo de `AprovadoEm`: CAT-0006/7/8/9 foram corrigidos
  manualmente em 2026-09-09, antes do pipeline de aprovação existir — sem
  timestamp real pra recuperar. Decisão: deixar em branco (não inventar
  dado), documentado no campo `Diagnostico` de cada item.

**Dívidas técnicas do `erp_itp` (`ARCHITECTURE.md` §7)**
- `FuncionariosController` estava registrado 2x (`FuncionariosModule` +
  `require()` direto em `AppModule`) — removido o registro redundante,
  validado no boot em produção.
- `matriculas/database.ts` confirmado **vazio**, sem nenhum import — não
  é acesso cru ao banco (a suspeita original). Não removido ainda
  (exclusão de arquivo bloqueada pelo classificador de segurança da
  sessão) — candidato a remoção manual.
- Comandos `npm run typeorm:migration:*` confirmados **quebrados** (sem
  `data-source.ts` de CLI configurado) — `CLAUDE.md` corrigido pra não
  documentar comando que não funciona. Arquivo órfão
  `src/migrations/1740000000000-AddEmailResponsavelFields.ts` nunca é
  executado pelo mecanismo real (`runMigrations()`) — removido, junto com
  `matriculas/database.ts` (também vazio, sem nenhum import); build
  validado nos dois casos.
- `auth`/`usuarios` sem `.module.ts` próprio — **refatorado**: criados
  `AuthModule` (exporta `AuthService`, `JwtStrategy`) e `UsuariosModule`
  (importa `AuthModule`). Baixo acoplamento confirmado antes de mexer.
  Validado em produção: build TypeScript limpo, boot sem erro de DI,
  rotas `/api/auth/*` e `/api/usuarios/*` mapeadas sem duplicação, login
  testado via curl.
- `installonly_limit` duplicado em `/etc/dnf/dnf.conf` (`/etc/yum.conf` é
  symlink do mesmo arquivo) — removida a linha duplicada, mantido o valor
  que já prevalecia na prática (`=2`), backup salvo antes de editar.
- `/tmp` isolado via tmpfs (`nosuid,nodev,noexec`, 3.7G, backed por
  RAM/swap) — antes era só um diretório dentro de `/`, sem isolamento
  nenhum. Validado: containers seguem saudáveis, `/tmp` gravável
  normalmente após a mudança.
- Threshold de "pico de frequência" da categoria `integracao` (>5
  ocorrências/lote) — não dava pra validar contra volume real ainda, mas
  ao tentar cobrir isso com teste, achado um **bug real**: `REABRE_SEMPRE`
  usava grafia antiga (`codigo`/`seguranca`/`outros`) que nunca batia com
  as categorias reais do classificador (`código`/`security`/`terceiros`)
  — reincidência de erro de **código** (a categoria mais comum) nunca
  reabria um item já resolvido, silenciosamente. Corrigido, e criado
  `catalogo-erros/test_reincidencia.py` (7 testes, stdlib `unittest`, sem
  dependência nova) cobrindo a matriz inteira — inclusive um teste de
  regressão que trava esse bug específico se ele voltar. Rodado e
  validado na VM.
- Métricas de aplicação/API concluídas: `MetricsModule` no NestJS
  (`prom-client`), interceptor global medindo toda requisição
  (histograma de duração — base do Apdex), `/api/metrics` exposto pro
  Prometheus. RUM (Web Vitals — LCP/INP/CLS) via lib `web-vitals` no
  frontend, reportando pro `/api/metrics/rum`. Métricas de negócio
  (matrículas/dia, chamados abertos, movimentações/dia) como gauges.
  Ponte de alerta do Grafana pro email (reaproveitando `EmailService`/
  Graph API) em `/api/metrics/alerta-grafana`. Grafana exposto
  publicamente em `grafana.itp.institutotiapretinha.org` (Traefik+SSL),
  protegido por senha forte. Dashboard customizado "ITP — Visão Geral"
  em português com painéis grandes tipo stat — corrigido bug real de
  duplicata na barra de memória por container (faltava `sum by (name)`).
- Varredura de pontos cegos client-side concluída, expandida além do
  `erp_itp` a pedido do usuário ("repensar e revisar toda a arquitetura
  do ITP e do site institucional"): `global-error.tsx` criado (cobria
  falha no `layout.tsx` raiz, não coberto pelo `error.tsx` normal) +
  `window.onerror`/`unhandledrejection` em `ClientShell.tsx` agora
  reportam qualquer erro pro backend, não só `ChunkLoadError` — cobre
  handler de evento/`setTimeout`/promise sem `.catch`, que nenhum Error
  Boundary React alcança. Validado em produção.
- **Site institucional** (repo separado `website_tia_pretinha`, SPA
  Vite+React sem backend próprio, Azure Static Web Apps): não tinha
  nenhum Error Boundary — tela ficava em branco se `App.jsx` quebrasse
  durante o render. Adicionado `ErrorBoundary.jsx` + listeners globais de
  `window`, reportando pro mesmo `/frontend-logs` do `erp_itp` (CORS/CSP
  já liberavam esse domínio, sem mudança de config extra) — unifica com
  o catálogo de erros da VM em vez de ficar isolado só no Application
  Insights que o site já tinha. Testado ponta a ponta via curl com CORS
  real, log aparece prefixado `[site-institucional]` no `docker logs`.
  Deployado via push (GitHub Actions da Azure Static Web Apps).
- **Backend do `erp_itp`**: não tinha handler de
  `uncaughtException`/`unhandledRejection` no processo Node — erro fora
  do ciclo de request derrubava o processo com só stack cru no stdout.
  Adicionado em `main.ts`, loga estruturado via `Logger` do Nest antes de
  sair. Validado: boot limpo em produção.
- `Aplicacao=SITE` criado na SharePoint List (manual) e reconhecido pelo
  código: `coletor.py` detecta o prefixo `[site-institucional]` e força
  `Aplicacao=SITE` pro grupo; `claude_client.py` atualizado pra aceitar
  `SITE` como valor válido; filtro do viewer atualizado. Testado
  ponta a ponta em produção: item real (`CAT-0015`) classificado
  corretamente como `Aplicacao=SITE`, `Categoria=integracao`, diagnóstico
  certo (reconheceu ser teste manual, não bug real).
- `/academico/chamada-professor` removido — confirmado órfão de verdade
  (rascunho de 331 linhas, sem nenhuma referência em código, superado
  pela versão da raiz com 700 linhas e mais funcionalidades).
- Rotas de chamada duplicadas (`/chamada` vs `/academico/chamada`) —
  investigado a fundo, inclusive testando o redirect real em produção.
  **Não é bug de segurança** (confirmado com o usuário: aluno nunca faz
  a própria chamada, ambas as rotas exigem login corretamente). É
  duplicação de manutenção genuína — decisão de consolidar ou não fica
  pendente (ver 🔴 abaixo).

---

## ⏳ Falta

### 🟢 Fácil — sem decisão pendente, só executar


### 🟡 Médio — precisa investigação antes de decidir a solução

- [ ] Instrumentar o NestJS com métricas de aplicação (`prom-client`,
      endpoint `/metrics`) — taxa de erro HTTP 5xx por endpoint, latência
      p50/p95/p99, Apdex. Segunda etapa do monitoramento (Grafana já
      pronto pra consumir assim que existir).
- [ ] Ponte de alerta do Grafana pro mesmo canal email/Teams do catálogo
      de erros — Grafana não tem SMTP nativo funcionando aqui (tenant
      bloqueia SMTP AUTH legado), precisa de um webhook reaproveitando o
      `EmailService`/Graph API já existente no `erp_itp`.
- [ ] RUM (Real User Monitoring) no `erp_itp` — Web Vitals, cliques,
      funil de conversão. O site institucional já tem via Application
      Insights; o ITP ainda só captura erro (não performance/
      comportamento).
- [ ] Métricas de negócio no dashboard (matrículas/dia, chamados
      abertos/resolvidos, movimentações financeiras) — exige definir as
      queries certas e validar com o usuário se são as métricas que
      importam de verdade.

- [x] Promover os 27 índices de FK e os 4 `CHECK` constraints pro
      `runMigrations()` — feito 2026-09-11 (`SCHEMA_VERSION` v23→v24).
      Testado contra o banco de produção, que já tinha tudo criado
      manualmente: rodou idempotente, sem erro (`CREATE INDEX IF NOT
      EXISTS` + `DO` block com `EXCEPTION WHEN duplicate_object` pros
      `CHECK`, que não tem `IF NOT EXISTS` nativo no Postgres).

- [x] Índices em FK (parte do P1 da auditoria de banco) — resolvido
      2026-09-11: 27 de 44 FKs reais não tinham índice (query rigorosa via
      `pg_constraint`/`pg_index`, cruzando FK com a primeira coluna de
      qualquer índice existente). Criados via `CREATE INDEX CONCURRENTLY`
      (não bloqueante), um por vez pra evitar o Postgres agrupar em
      transação implícita. Todos válidos (`indisvalid=true`), containers
      saudáveis, endpoints reais testados após a mudança. Ficou de fora
      `neon_auth.invitation.inviterId` (schema gerenciado por lib externa
      de auth, não é nossa entidade TypeORM).
- [x] CHECK/enum (resto do P1) — resolvido 2026-09-11: enums completos
      derivados do código-fonte real (não só dos dados atuais, pra não
      bloquear valor válido ainda sem uso — ex: `role=cozinha` existe no
      `ROLE_LEVEL` do backend mas não tinha nenhum usuário com esse role
      ainda). 4 `CHECK` criados: `usuarios.role` (10 valores),
      `movimentacoes_financeiras.status` (5, incluindo `Concluído` que
      não aparece no dropdown do frontend mas existe em 17 linhas reais),
      `boletos.status` (2), `chamados_academicos.status` (3). **P1 da
      auditoria de banco concluído.**
- [x] Popular o catálogo de ações/playbooks — resolvido 2026-09-11: 4
      ações novas (nomes em português), motivadas pelas ações manuais
      reais desta sessão (swap, config duplicada): `VERIFICAR_MEMORIA`,
      `VERIFICAR_CONFIG_DUPLICADA` (verificação, sem aprovação),
      `CRIAR_SWAP`, `CORRIGIR_CONFIG_DUPLICADA` (resolução, com
      aprovação). Atualizado tanto o doc (`CATALOGO-ERROS.md` §7) quanto
      o prompt real que restringe a IA na execução (`claude_client.py`).

### 🔴 Depende de decisão do usuário

- [x] Consolidar as 2 implementações de chamada — **decisão: não
      consolidar**. Verificado a fundo (2026-09-11): não são duplicatas
      de verdade, batem em endpoints de backend diferentes e
      `/academico/chamada` tem cadastro rápido de aluno que o outro fluxo
      não tem. Ver `ARCHITECTURE.md` §7.1.
- [ ] **Decisão tomada**: SSO é obrigatório antes de expor o ITP_TEC
      publicamente em `tec.itp.institutotiapretinha.org` (hoje só
      localhost/VM). Falta implementar (reusar o SSO Microsoft já
      existente no `erp_itp`) — não é urgente enquanto continuar só
      localhost.
- [ ] Checar manualmente no Entra a data de expiração do client secret do
      app `Catalogo Erros - VM` (sem privilégio suficiente pra checar via
      API).
- [ ] Data de expiração/rotação da deploy key SSH usada pro push
      autônomo do `aplicador.py`.
- [ ] Montar na UI do Power Automate: **Flow B** (relatório diário
      consolidado) e **Flow C** (notificação de resultado/escalonamento
      após `aplicador.py` rodar) — só desenhados no design doc, Flow A é
      o único construído e testado até agora.
- [ ] Decisão de ambiente de homologação/dev — **referência antiga
      quebrada** (2026-09-11): o doc `docs/superpowers/plans/2026-09-11-
      homologacao-dev-plan.md` no repo `aprxm_sass` não foi encontrado
      (nem o repo existe no disco desta máquina, só `aprxm_sys`, que
      parece ser outro projeto). Adiado por decisão do usuário — revisar
      de onde veio essa referência antes de continuar.
- [x] Permissão manual das tarefas do ITP_TEC — **decisão: manter como
      está** (`admin` pra backup/snapshot/aplicador, `tec` pro resto).
- [x] P2 da auditoria de banco (nomenclatura) — **concluído 2026-09-11**.
      Parte aditiva (v25): `updated_at`/`created_at` faltando em 17
      tabelas. Parte de rename (v26): unificado camelCase→snake_case em
      5 tabelas (`alunos`, `alunos_complemento`, `materias`,
      `estoque_produtos`, `documentos_validacao`) — entities + 4 queries
      SQL cruas + bootstraps de `CREATE TABLE` corrigidos juntos.
      `usuarios.createdAt` (coluna duplicada nunca lida pelo ORM, com 1
      linha de valor histórico divergente — a data real de criação da
      conta do próprio usuário) renomeada pra `created_at_legado` em vez
      de descartada. Achado de quebra: `app.module.ts:586` tinha query
      hardcoded que quebraria na próxima migration se não corrigida
      junto. Migrations v25/v26 testadas idempotentes em produção,
      colunas confirmadas via `information_schema`, zero erro nos logs.
- [ ] Migração do `aprxm_sys` (2º sistema do parque) — não iniciada.
- [ ] Regras de auto-fix v2 (quando liberar ações de baixo risco sem
      aprovação humana) — só depois do piloto de 1-2 semanas rodando só
      com aprovação manual.
- [ ] Onde plugar APRXM e DW no catálogo de erros quando migrarem pra VM.
- [x] Regras de alerta de verdade no Grafana — **concluído 2026-09-11**:
      5 regras provisionadas via arquivo (site fora do ar, disco cheio,
      memória crítica, container caído, taxa de erro 5xx alta), contact
      point apontando pro webhook, email indo pra
      `monitoramento@institutotiapretinha.org` (caixa criada pelo
      usuário pra isso). Testado ponta a ponta 2x de verdade (parando
      containers reais), incluindo um bug real de "stale metric" achado
      e corrigido (`no_data_state`).

### ⚫ Backlog — baixa prioridade, reavaliar depois

- [ ] `aplicador.py` não escalona um item aprovado com `PromptExecucao`
      vazio (aprovador não preencheu a instrução) — fica parado pra
      sempre. Gap conhecido, decisão do usuário de não mexer por ora.
- [ ] `claude_client.executar()` não re-checa impacto colateral no
      momento da execução, só a classificação inicial faz isso.
- [ ] Camadas extra de dedup/análise no catálogo de erros (correlação
      temporal, sub-agentes por categoria) — só depois que o volume real
      de erro aumentar.

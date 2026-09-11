# Checklist — Catálogo de Erros + ITP_TEC (rodada 2026-09-11)

Consolidado de tudo que foi trabalhado nesta rodada. Atualizar conforme
os itens pendentes forem fechados.

---

## ✅ Feito

### Catálogo de erros — bugs corrigidos
- [x] Falso-positivo Traefik 2xx/3xx no filtro de erro (`coletor.py`)
- [x] CAT-0013 fechado manualmente, causa raiz documentada
- [x] Fuso horário do dashboard (timeZone explícito América/São_Paulo)
- [x] Fuso horário da SharePoint List (confirmado já correto, Brasília)
- [x] `ResolvidoEm` do CAT-0013 corrigido (timestamp inventado por engano)
- [x] Status do catálogo de erros ao vivo no dashboard (bug do `any_value()`
      + status desatualizado do Parquet — busca direto na SharePoint agora)
- [x] `LinkCommit` — causa raiz confirmada (limitação real da Graph API,
      coluna sem type facet), removido o retry inútil, link embutido no
      `ResultadoExecucao`
- [x] Custo do Claude persistido estruturado (`custos.jsonl`), com
      fallback pro histórico em log antigo
- [x] Verificação real do pg_dump — 11 execuções, 0 erro genuíno (só os
      4 esperados do schema `pgrst`)
- [x] Tempo de resolução usa `AprovadoEm` (início do ciclo atual), não
      `PrimeiraVez` (que acumulava tempo de ciclos de reincidência antigos)
- [x] Backfill de `IAResolveu`/`TempoResolucaoHoras` nos 8 itens resolvidos
- [x] README do catálogo atualizado (aplicador.py documentado)

### ITP_TEC — console operacional
- [x] Estrutura base: navegação, layout, paleta roxo/amarelo do Instituto
- [x] `/erros` — catálogo de erros com status ao vivo
- [x] `/tarefas` — monitoramento + execução manual + criação de tarefa
  - [x] Reorganização dos scripts em `~/itp-stack/tarefas/`
  - [x] `tarefas-registro.json` com metadados das 7 tarefas
  - [x] `tarefas-api` (systemd, host, timing real via runner)
  - [x] Timing estruturado (exit code real, não heurística de palavra)
  - [x] Próxima execução (croniter), duração média
  - [x] Criticidade editável inline
  - [x] Popup dedicado de erro + log estruturado (hora BR, não blob cru)
  - [x] Análise IA sob demanda (cacheada por execução)
- [x] `/infra` — CPU/RAM/disco/swap/rede, containers (status+CPU/mem),
      Postgres (conexões, maiores tabelas, schemas, query ativa),
      endpoints críticos com tempo de resposta
- [x] `/custos` — uso do Claude só nesta VM
- [x] Papel de parede do servidor + atalho na área de trabalho

### Documentação
- [x] Usuário SSH da VM documentado no ARCHITECTURE.md
- [x] Plano de ambientes de homologação/dev (`docs/superpowers/plans/2026-09-11-homologacao-dev-plan.md`, repo aprxm_sass)

---

## ✅ Fechado por outra sessão em paralelo (2026-09-11, mesmo dia)

Enquanto essa rodada acontecia, outra sessão fechou praticamente todas as
pendências "difíceis" que estavam na lista:

- [x] Grafana + Prometheus completo (node-exporter, cadvisor,
      postgres-exporter, blackbox-exporter), exposto em
      `grafana.itp.institutotiapretinha.org`, **SSO Microsoft já configurado**
      (reaproveita o app registration do erp_itp — mesmo padrão que o
      ITP_TEC ainda precisa)
- [x] 5 alertas reais no Grafana, testados ponta a ponta, ponte de alerta
      envia pra `monitoramento@institutotiapretinha.org`
- [x] Dashboard de KPI de negócio (8 métricas)
- [x] P1/P2 da auditoria de banco: 27 índices FK criados, CHECK/enum,
      nomenclatura camelCase→snake_case
- [x] Dívidas de código do erp_itp (ARCHITECTURE.md §7): rotas de chamada
      duplicadas removidas, `relatorios/page.jsx` órfão removido,
      `FuncionariosController` duplicado corrigido, `database.ts` vazio
      removido, `auth`/`usuarios` extraídos pra módulos próprios
- [x] Bug real no `REABRE_SEMPRE` do coletor — grafia antiga de categoria
      (`codigo`/`seguranca`/`outros`) nunca batia com os valores reais do
      classificador (`código`/`security`/`terceiros`), reincidência dessas
      3 categorias nunca reabria item resolvido
- [x] Suporte a `Aplicacao=SITE` no catálogo de erros, testado em produção
- [x] Varredura de pontos cegos de crash client-side (frontend + backend)
- [x] Infra da VM: swap criado, `/tmp` isolado (tmpfs, nosuid/nodev/noexec),
      `installonly_limit` duplicado corrigido
- [x] Decisões registradas: chamada duplicada, SSO do ITP_TEC, permissões

**Conectado nesta rodada**: link direto pro Grafana na navegação do
ITP_TEC + atalho "ver histórico completo" na página `/infra` (que hoje é
só o retrato do momento via shell commands — Grafana tem o histórico de
verdade via Prometheus).

## 🟡 Fáceis, sem dependência — próximas

- [ ] Backfill retroativo revisado — conferir se `AprovadoEm` deveria ser
      preenchido também nos itens antigos (CAT-0006/7/8/9) que não têm
      (hoje ficaram com `TempoResolucaoHoras` em branco por falta de base
      confiável)
- [ ] Reaproveitar o mesmo padrão de SSO Microsoft já validado no Grafana
      (`GF_AUTH_AZUREAD_*`) pro ITP_TEC — precedente já existe, reduz o
      trabalho que faltava

## 🔴 Dependem de decisão/ação do usuário

- [ ] SSO antes de expor o ITP_TEC em `tec.itp.institutotiapretinha.org`
      (padrão já provado no Grafana, só replicar)
- [ ] Checar data de expiração do client secret do app `Catalogo Erros - VM`
      manualmente no Entra (sem privilégio suficiente via API)
- [ ] Power Automate: Flow B (relatório diário) e Flow C (alerta de
      escalonamento) — precisam ser montados na UI
- [ ] Decisão de ambiente de homologação/dev (opções documentadas, falta escolher)
- [ ] Revisar regra de permissão manual das tarefas (hoje: admin pra
      backup/snapshot/aplicador, tec pro resto — decisão minha, ajustável)
- [ ] Migração do aprxm_sys (2º sistema do parque, não iniciada)

## ⚫ Backlog — reavaliar depois, baixa prioridade agora

- [ ] `aplicador.py` não escalona item aprovado com `PromptExecucao` vazio
      (decisão do usuário de não mexer por ora)
- [ ] `claude_client.executar()` não re-checa impacto colateral no momento
      da execução (só a classificação inicial faz isso)
- [ ] Camadas extra de dedup/análise (correlação temporal, sub-agentes por
      categoria) — só depois que o volume real de erro aumentar

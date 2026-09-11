# Checklist geral de pendências — 2026-09-11

Consolidado de tudo que está pendente hoje no `erp_itp` (catálogo de
erros, ITP_TEC, dívidas técnicas do código), organizado por facilidade —
não por prioridade de negócio. "Fácil" = sem decisão de terceiro
envolvida, dá pra atacar direto. Ver também
`2026-09-11-itp-tec-checklist.md` (histórico do que já foi feito nesta
rodada) e `CATALOGO-ERROS.md` (seções 10/11) / `ARCHITECTURE.md` (§7)
pros detalhes completos de cada item.

---

## 🟢 Fácil — sem decisão pendente, só executar

- [x] `FuncionariosController` registrado 2x — confirmado e corrigido
      2026-09-11: removido o `require()` redundante em `AppModule`, só
      `FuncionariosModule` registra agora.
- [x] `matriculas/database.ts` — confirmado 2026-09-11: arquivo **vazio**,
      sem nenhum import, morto há vários commits. Não é acesso cru ao
      banco. **Não removido ainda** — exclusão de arquivo bloqueada pelo
      classificador de segurança da sessão; candidato a remoção manual.
- [x] Comandos `typeorm:migration:*` — confirmado 2026-09-11: não
      funcionam (sem `data-source.ts` de CLI configurado). `CLAUDE.md`
      corrigido pra não documentar comando quebrado. Arquivo órfão
      `src/migrations/1740000000000-AddEmailResponsavelFields.ts` nunca é
      executado pelo mecanismo real — mesma situação do item anterior
      (candidato a remoção manual).
- [x] Backfill retroativo de `AprovadoEm` — investigado 2026-09-11:
      CAT-0006/7/8/9 foram corrigidos manualmente em 2026-09-09, **antes**
      do pipeline de aprovação existir — não há timestamp de aprovação
      real pra recuperar. Decisão: deixar em branco (não inventar dado) e
      documentar o motivo direto no campo `Diagnostico` de cada item.
- [ ] Threshold de "pico de frequência" da categoria `integracao`
      (>5 ocorrências/1h, em uso em `aplicar_matriz_reincidencia()`) —
      **não é possível validar sem volume real** de erro dessa categoria
      ainda; segue em observação, não é algo pra "resolver" agora.

## 🟡 Médio — precisa investigação antes de decidir a solução

- [ ] Rotas de chamada duplicadas no frontend — `/chamada` +
      `/chamada-professor` (raiz) **e** `/academico/chamada` +
      `/academico/chamada-professor` são duas implementações completas e
      ativas do mesmo fluxo (QR/link de presença), batendo nos mesmos
      endpoints. `LaunchPad.tsx` linka pra uma versão, `PresencaTab.tsx`
      pra outra. Não é código morto — decidir qual manter exige entender
      se algum público específico depende de uma delas. (`ARCHITECTURE.md`
      §7.1)
- [ ] `auth` e `usuarios` sem `.module.ts` próprio — registrados direto em
      `AppModule`, fora do padrão do resto do projeto. Refatorar exige
      cuidado pra não quebrar guards globais que já dependem deles.
      (`ARCHITECTURE.md` §7.5)
- [ ] P1 da auditoria de banco — índices em FK, CHECK/enum (P0 já foi
      feito: FK financeiro + soft delete). Ver
      `docs/database-audit-2026-09-08.md` no repo `aprxm_sass`.
- [ ] Popular o catálogo de ações/playbooks do catálogo de erros além dos
      9 exemplos atuais (`CATALOGO-ERROS.md` seção 7).
- [ ] Varredura mais ampla de pontos cegos de erro client-side além dos 2
      `error.tsx`/`PageErrorBoundary` já cobertos — pedido explícito do
      usuário, adiado deliberadamente ("o certo depois é fazer uma
      varredura desses tipos de erros que não chegam até nós").

## 🔴 Depende de decisão do usuário

- [ ] SSO obrigatório antes de expor o ITP_TEC publicamente em
      `tec.itp.institutotiapretinha.org` (hoje só localhost/VM).
- [ ] Checar manualmente no Entra a data de expiração do client secret do
      app `Catalogo Erros - VM` (sem privilégio suficiente pra checar via
      API).
- [ ] Data de expiração/rotação da deploy key SSH usada pro push
      autônomo do `aplicador.py`.
- [ ] Montar na UI do Power Automate: **Flow B** (relatório diário
      consolidado) e **Flow C** (notificação de resultado/escalonamento
      após `aplicador.py` rodar) — só desenhados no design doc, Flow A é
      o único construído e testado até agora.
- [ ] Decisão de ambiente de homologação/dev (opções já documentadas em
      `docs/superpowers/plans/2026-09-11-homologacao-dev-plan.md`, repo
      `aprxm_sass` — falta escolher).
- [ ] Revisar regra de permissão manual das tarefas do ITP_TEC (hoje:
      `admin` pra backup/snapshot/aplicador, `tec` pro resto — decisão
      provisória, ajustável).
- [ ] P2 da auditoria de banco (nomenclatura) — mexe em nomes já em uso,
      exige decidir janela de deploy/migração.
- [ ] Migração do `aprxm_sys` (2º sistema do parque) — não iniciada.
- [ ] Regras de auto-fix v2 (quando liberar ações de baixo risco sem
      aprovação humana) — só depois do piloto de 1-2 semanas rodando só
      com aprovação manual.
- [ ] Onde plugar APRXM e DW no catálogo de erros quando migrarem pra VM.

## ⚫ Backlog — baixa prioridade, reavaliar depois

- [ ] `aplicador.py` não escalona um item aprovado com `PromptExecucao`
      vazio (aprovador não preencheu a instrução) — fica parado pra
      sempre. Gap conhecido, decisão do usuário de não mexer por ora.
- [ ] `claude_client.executar()` não re-checa impacto colateral no
      momento da execução, só a classificação inicial faz isso.
- [ ] Camadas extra de dedup/análise no catálogo de erros (correlação
      temporal, sub-agentes por categoria) — só depois que o volume real
      de erro aumentar.

---

## ✅ Já resolvido (não repetir)

- `relatorios/page.jsx` órfão — removido 2026-09-11.
- `LinkCommit` do catálogo de erros — causa raiz confirmada (limitação
  real da Graph API), link embutido em `ResultadoExecucao`.
- README do catálogo de erros corrigido (não citava mais o LinkCommit
  como pendência).
- Blind spot duplo de crash client-side (`PageErrorBoundary` +
  `error.tsx` global) — ambos reportam pro backend agora.
- Bug do ANSI quebrando query OData do Graph API — corrigido no
  normalizador.
- Ciclo completo do catálogo de erros validado ponta a ponta (2 casos
  reais, incluindo correção autônoma commitada e deployada).

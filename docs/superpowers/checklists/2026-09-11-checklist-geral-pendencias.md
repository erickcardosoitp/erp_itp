# Checklist geral de pendências — 2026-09-11

Consolidado de tudo que está pendente no `erp_itp` (catálogo de erros,
ITP_TEC, dívidas técnicas do código). Falta organizado por facilidade —
não por prioridade de negócio. Ver também `2026-09-11-itp-tec-checklist.md`
(checklist da rodada anterior) e `CATALOGO-ERROS.md` (seções 10/11) /
`ARCHITECTURE.md` (§7) pros detalhes completos de cada item.

---

## ✅ Feito nesta rodada (2026-09-11)

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
- Rotas de chamada duplicadas (`/chamada` vs `/academico/chamada`) —
  investigado a fundo, inclusive testando o redirect real em produção.
  **Não é bug de segurança** (confirmado com o usuário: aluno nunca faz
  a própria chamada, ambas as rotas exigem login corretamente). É
  duplicação de manutenção genuína — decisão de consolidar ou não fica
  pendente (ver 🔴 abaixo).

---

## ⏳ Falta

### 🟢 Fácil — sem decisão pendente, só executar

- [ ] Threshold de "pico de frequência" da categoria `integracao`
      (>5 ocorrências/1h) — não dá pra validar sem volume real de erro
      dessa categoria ainda; fica em observação.

### 🟡 Médio — precisa investigação antes de decidir a solução

- [ ] P1 da auditoria de banco — índices em FK, CHECK/enum (P0 já feito:
      FK financeiro + soft delete). Ver `docs/database-audit-2026-09-08.md`
      no repo `aprxm_sass`.
- [ ] Popular o catálogo de ações/playbooks do catálogo de erros além dos
      9 exemplos atuais (`CATALOGO-ERROS.md` seção 7).
- [ ] Varredura mais ampla de pontos cegos de erro client-side além dos 2
      `error.tsx`/`PageErrorBoundary` já cobertos — pedido explícito do
      usuário, adiado deliberadamente ("o certo depois é fazer uma
      varredura desses tipos de erros que não chegam até nós").
- [ ] `/academico/chamada-professor` — candidato a rota órfã (nenhuma
      referência encontrada no código), não confirmado com a mesma
      profundidade que os outros 3 endpoints de chamada.

### 🔴 Depende de decisão do usuário

- [ ] Consolidar ou não as duas implementações ativas de chamada
      (`/chamada` vs `/academico/chamada`) — investigação concluída, só
      falta decidir se vale a pena unificar.
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

### ⚫ Backlog — baixa prioridade, reavaliar depois

- [ ] `aplicador.py` não escalona um item aprovado com `PromptExecucao`
      vazio (aprovador não preencheu a instrução) — fica parado pra
      sempre. Gap conhecido, decisão do usuário de não mexer por ora.
- [ ] `claude_client.executar()` não re-checa impacto colateral no
      momento da execução, só a classificação inicial faz isso.
- [ ] Camadas extra de dedup/análise no catálogo de erros (correlação
      temporal, sub-agentes por categoria) — só depois que o volume real
      de erro aumentar.

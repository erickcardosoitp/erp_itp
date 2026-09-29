# JiraIA — triagem autônoma de erros

JiraIA é o nome do processo agêntico que lê os logs dos sistemas do Instituto Tia Pretinha, faz a triagem de cada erro e decide sozinho o que é ruído, o que é problema conhecido e o que precisa de gente. Ele evolui o [Catálogo de Erros](../CATALOGO-ERROS.md): a coleta continua a mesma, e a classificação pelo Claude foi substituída por triagem com o Jev (TypeSafe) e por um modelo de gestão de problemas.

- **Em produção desde:** 2026-09-28 (PRs #77 e #78)
- **Especificação:** [`docs/superpowers/specs/2026-09-28-jiraia-triagem-jev-design.md`](../docs/superpowers/specs/2026-09-28-jiraia-triagem-jev-design.md)
- **Pendências:** [`docs/superpowers/plans/2026-09-28-jiraia-pendencias.md`](../docs/superpowers/plans/2026-09-28-jiraia-pendencias.md)
- **Base de conhecimento e tickets:** SharePoint, site ObservabilidadeITP (seção 4)

## 1. Fluxo

```
a cada 5 min (espaçamento adaptativo quando não há erros)
container → filtro "error|exception|fatal|panic" → normalização → assinatura
   │
   ├─ assinatura já catalogada  → soma ocorrência no incidente e no ticket
   ├─ rajada de banco (mesmo PID/minuto, 20+ linhas, 5+ assinaturas)
   │                            → ticket "Rajada de erros de banco" do dia, sem IA
   ├─ DDL "already exists" fora de rajada → regra determinística, sem IA
   └─ erro novo → TRIAGEM PELO JEV
                    contexto consultado no SharePoint:
                      regras de classificação · contexto do sistema · tickets candidatos com exemplos reais
                    perguntas tipadas numa só chamada:
                      ticket · natureza · camada · criticidade · afeta usuário ·
                      travas (association_id, dinheiro, dado pessoal) · ação · risco de corrigir
                    travas e limites de confiança aplicados NO CÓDIGO
                      ├─ pertence a ticket existente → vincula (reabre se estava resolvido)
                      └─ não pertence → abre ticket novo (PRB-NNNN)
   │
   ├─ criticidade alta/crítica → item na hora na lista catalogoErros
   │     → Power Automate: e-mail + aprovação no Teams (se risco mediano/alto)
   └─ criticidade baixa/média  → staging do dia → consolidação às 23h + e-mail-resumo
```

Nenhuma correção é **publicada** automaticamente: o aplicador (`aplicador.py`) segue desligado. Desde 29/09 o investigador (fase 4a, seção 10) propõe correções em branches para revisão humana.

## 2. Componentes

| Arquivo | Papel |
|---|---|
| `coletor.py` | Coleta, deduplicação, rajada, roteamento. Modos: `--jev` (produção), `--sem-ia` (só registra, sem classificar), padrão (Claude, legado) |
| `jev_client.py` | Monta a chamada ao Jev (`POST https://api.typesafe.ai/v1/systemone`), aplica travas e limites de confiança, devolve a classificação no formato do coletor |
| `base_conhecimento.py` | Consulta a lista `TicketsProblema`, os exemplos por ticket (incidentes da `catalogoErros`) e os documentos da pasta `BaseConhecimento` |
| `retriar_pendentes.py` | Passa pelo Jev os itens `Categoria=pendente` (criados em modo `--sem-ia` ou com o Jev fora do ar). `--dry-run` só mostra |
| `consolidar_diario.py` | 23h: cria na lista os itens baixos/médios do dia (com `CodProblema`) e manda o e-mail-resumo |
| `cron_coletor.sh` | Chamado pelo cron via `tarefas_runner.py`; roda `coletor.py --jev` com `timeout 3300` |

## 3. Regras que valem acima da IA

- **Travas:** `association-id`, `dinheiro` e `dado-pessoal` são detectadas por regex no código **ou** pelo Jev (≥ 0,5). Com trava, o erro nunca é fechado e o risco vira "alto risco". `association-id` sobe a criticidade para pelo menos alta; as demais, para pelo menos média.
- **Confiança:** criticidade com confiança < 0,6 sobe um nível. Vínculo com ticket só com confiança ≥ 0,75. Fechar como ruído só com confiança ≥ 0,85 e sem trava.
- **Ticket revisado manda:** se o ticket vinculado tem `RevisadoPor` preenchido, a criticidade dele prevalece; senão vale a maior entre a do Jev e a do ticket.
- **Códigos de cor ANSI** (Traefik/Grafana) são removidos antes da triagem.
- **Falha do Jev** (rede/HTTP) não derruba a rodada: o erro entra como "pendente de triagem".
- **Teto:** 50 triagens Jev por rodada; o excedente fica para a rodada seguinte.

## 4. SharePoint (site ObservabilidadeITP)

| Artefato | O que é |
|---|---|
| Lista `catalogoErros` | Incidentes (uma linha por assinatura). Campo novo `CodProblema` liga ao ticket; opção `pendente` em `Categoria` e `CamadaInvestigacao` |
| Lista `TicketsProblema` | Tickets de problema (causa raiz), com taxonomia completa. É o gabarito quando `RevisadoPor` está preenchido |
| `Documentos/BaseConhecimento/00-Regras/` | `regras-classificacao.md`, `politica-rollback.md`, `formatacao-lista/` (cores e ordem de colunas, ainda não aplicadas) |
| `.../01-Sistemas/<Sistema>/contexto.md` | Resumo para triagem de cada sistema (APRXM, ERP-ITP, Banco, DW, Site), apontando para os documentos dos repositórios |
| `.../02-Problemas/PRB-NNNN-*/analise.md` | Análise de cada ticket |
| `.../03-Implementacoes/2026-09-28-triagem-jev/` | Especificação e pendências |
| `.../04-Padroes-Recorrentes/` | Lições aprendidas: mudança de schema, falha silenciosa após migração, restauração de banco |

Modelo de dados: **ocorrência** (linha de log, Parquet) → **incidente** (assinatura, `catalogoErros`) → **ticket de problema** (causa raiz, `TicketsProblema`) → **padrão recorrente** (documento).

Na criação, os 596 incidentes do catálogo foram agrupados em 25 tickets pré-classificados (544 deles eram um único evento: a restauração do banco reexecutada em 14/09 às 23:04).

## 5. Configuração

- `~/itp-stack/catalogo_erros.env` (permissão 600): além das variáveis existentes, `JEV_API_KEY`.
- App registration "Catalogo Erros - VM": `Sites.ReadWrite.All` e `Sites.Manage.All` (esta última para criar listas e colunas).
- Cron: `catalogo-erros-coletor` (a cada 5 min, via `tarefas_runner.py`) e `consolidar_diario.py` (23h). O `catalogo-erros-aplicador` segue comentado.

## 6. Operação

```bash
cd ~/erp_itp/catalogo-erros
python3 coletor.py --jev              # rodada manual (respeita o state)
python3 retriar_pendentes.py --dry-run
python3 retriar_pendentes.py          # grava a triagem dos pendentes
```

Não use `--desde` para reprocessar logs já coletados: a Camada 2 somaria as ocorrências de novo.

## 7. Validação (2026-09-28)

- **Offline**, 81 incidentes com ticket (após o filtro de DDL): 72 no ticket certo, **1 errado**, 8 não vinculados. As 9 violações de `association_id` ficaram todas em "alto risco" (8 com a trava marcada). O número é otimista: os exemplos por ticket vêm dos mesmos incidentes avaliados.
- **Itens nunca vistos** (9 pendentes de 28/09): 8 de 9 coerentes. O desvio (uma query manual ligada ao ticket de coluna ausente) errou para o lado seguro.
- **Custo:** a triagem do Jev não chama o Claude. Consumo típico de 3 a 6 mil tokens de entrada por erro novo.

## 8. Limitações conhecidas

- O Jev decide só a partir do texto do erro e do contexto; ele não lê o código. Consultas manuais ao banco não se distinguem de erros de aplicação pelo texto.
- Títulos, diagnósticos e correções de tickets novos são gerados a partir das respostas tipadas (o Jev não escreve texto livre). A investigação em texto fica para a fase de correção.
- O fluxo de aprovação do Power Automate tem bugs conhecidos no título e nos IDs de rejeitar/escalar (ver pendências).
- Os limites de confiança ainda não foram calibrados contra um gabarito revisado por humano.

## 9. Vídeo de apresentação

Projeto em [`video/`](video/), gerado com a skill `/brag` (latent-spaces/brag) sobre o Hyperframes. O áudio não é versionado (licença da trilha a confirmar); ver `video/README.md`.

## 10. Investigador — fase 4a (desde 2026-09-29)

`investigador.py`, a cada 30 min pelo cron, com trava própria (`~/itp-stack/jiraia-investigador.lock`):

1. Escolhe até **5 tickets** elegíveis: estado aberto/reaberto, disposição remediar, criticidade média ou maior, **sem trava**, sistema com repositório conhecido (APRXM → `aprxm_sys`, ERP-ITP → `erp_itp`), não investigado nos últimos 7 dias. Ordem: criticidade, depois mais recente.
2. Cria um **git worktree** isolado em `~/itp-stack/jiraia-worktrees/PRB-NNNN`, na branch `jiraia/PRB-NNNN-*` a partir de `origin/main`.
3. Roda o Claude Code (conta única `dev.itp`, ferramentas só `Read,Grep,Glob,Edit,Write` — sem shell) com o ticket, os incidentes, o contexto do sistema e o padrão recorrente. Ele preenche título, causa raiz, impacto, contorno e remediação e, se a correção for pequena e segura, edita o código.
4. O script **valida o diff**: nada em migrations, `/db/`, `.env`, `docker-compose`, `.github/`, `app.module.ts`, `vercel.json`; no máximo 6 arquivos e 400 linhas. Fora disso, a correção é descartada e o ticket fica em análise.
5. **Jev avalia a correção** (corrige a causa? escopo mínimo? efeito colateral? risco) — resultado em `AvaliacaoCorrecao`.
6. Commit, push da branch e **e-mail com o link "comparar e abrir PR"**. Ticket vai para `em-correcao` com `LinkPR`. Nada é mergeado nem publicado.

Custo e cota: assinatura (conta `dev.itp`), teto preventivo de **50% da sessão de 5 h** (`FRACAO_MAXIMA_SESSAO`), recalibrado no próximo rate-limit real. Uma investigação custou ~US$ 0,75 (equivalente reportado pelo CLI) no teste de 29/09. A conta secundária de failover foi removida.

```bash
python3 investigador.py --dry-run               # investiga, mostra os campos, não grava nem envia
python3 investigador.py --ticket PRB-0021       # um ticket específico
```

Fase 4b (publicação automática com rollback) só depois de avaliar a qualidade das propostas da 4a.


# JiraIA — pendências (2026-09-28)

Pendências do JiraIA e do catálogo de erros. Espelho da lista no SharePoint (`BaseConhecimento/03-Implementacoes/2026-09-28-triagem-jev/pendencias.md`), sem os itens de segurança, que ficam no repositório privado.

## Alta

| # | Pendência | Quem | Detalhe |
|---|---|---|---|
| 1 | Revisar os tickets da `TicketsProblema` | Erick | Conferir natureza, disposição e criticidade; preencher `RevisadoPor`/`RevisadoEm`. Sem isso não há gabarito para calibrar os limites de confiança. |
| 2 | Investigar PRB-0021, PRB-0026 e PRB-0027 | Equipe | `column r.deleted_at does not exist` (23/09, reabriu PRB-0021) · `value too long for type character varying(14)` (PRB-0026) · `duplicate key` em `uq_migration_...` (PRB-0027). |
| 3 | Corrigir o restante do fluxo `testeErros` (Power Automate) | Erick | Condição de disparo corrigida em 28/09. Falta: (a) título da aprovação e assunto do e-mail usam `outputs('Atualizar_item')?['body/TipoErro']`, que vem vazio → `triggerBody()?['TipoErro']`; (b) Id vazio em "Atualizar item 1" (escalar) e "3" (rejeitar) → `triggerBody()?['ID']`; (c) Id do "Atualizar item 2" (aprovar) com `\r\n` no final; (d) e-mail mostra objeto cru nas colunas de escolha: em ResumoNotificacao usar `triggerBody()?['Aplicacao']?['Value']` (idem Categoria, Criticidade, IAPodeResolver); (e) e-mail duplicado com o alerta imediato do JiraIA: remover "Enviar um e-mail (V2)" e manter só a aprovação. |

## Média

| # | Pendência | Detalhe |
|---|---|---|
| 4 | Calibrar limites de confiança | Rodar `jev_client.triar` contra os tickets revisados e ajustar `CONFIANCA_MIN_*`. Medir sem vazamento (excluir o próprio incidente dos exemplos). |
| 5 | Coleta de erros de operação (fase 2 da spec) | Respostas 409/422 agrupadas por endpoint + mensagem + associação; o Jev avalia se a frequência é anormal. Motivação: o bug de cadastro de dependente do APRXM (422 sempre) nunca apareceu no catálogo. |
| 6 | Heartbeat das automações | Alerta quando coletor/consolidação **não** rodam no período esperado (padrão "falha silenciosa após migração"). |
| 7 | Formatação visual da lista `TicketsProblema` | Cores e ordem de colunas prontas em `00-Regras/formatacao-lista/`; aplicar colando o JSON por coluna (automação exigiria certificado no app). |

## Evolução

| # | Pendência | Detalhe |
|---|---|---|
| 8 | Fase 4: correção com rollback | Jev avalia a correção proposta pelo Claude; publicação automática só com "seguro" dos dois, CodeQL/health check e reversão automática (`00-Regras/politica-rollback.md`). Reconstruir o fluxo do Power Automate sobre `TicketsProblema`. |
| 9 | Visualização do processo | Painel do fluxo JiraIA na infraestrutura. |
| 10 | Nome "JiraIA" para uso externo | "Jira" é marca da Atlassian; avaliar outro nome antes de publicar fora do Instituto. |
| 11 | Vídeo de apresentação | Versão atual é um primeiro rascunho (`catalogo-erros/video/`); refazer com a direção criativa desejada. |
| 12 | `01-Sistemas/Site/contexto.md` | Completar quando surgirem incidentes reais do site. |

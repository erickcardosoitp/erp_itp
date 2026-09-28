# JiraIA — triagem com Jev e gestão de problemas (especificação)

- **Data:** 2026-09-28
- **Status:** aprovado em conversa, aguardando revisão deste documento
- **Criado no SharePoint (28/09):** lista `TicketsProblema` (25 tickets pré-classificados, pendentes de revisão), campo `CodProblema` na `catalogoErros` (596 incidentes vinculados), pasta `BaseConhecimento` com regras, contexto dos sistemas e padrões recorrentes
- **Sistemas cobertos:** APRXM, ERP-ITP, Banco (itp_postgres), DW (ClickHouse/ETL), Site
- **Onde vive:** SharePoint, site ObservabilidadeITP

## 1. Por que

- Em 596 itens do catálogo, ~544 eram um único evento (a restauração do banco reexecutada em 14/09, 23:04) contados como casos separados. Pré-classificação: 596 incidentes → 25 tickets.
- A classificação usava o Claude a cada erro novo (US$ 0,25–0,40 por rodada, limite de 5 por rodada).
- O fluxo de aprovação ficou desligado desde 18/09. Quando ligado, tinha uma condição sempre falsa (`E` no lugar de `OU`), então nunca pediu aprovação. Itens "seguros" não tinham caminho nenhum.
- Erros de operação (respostas 409/422) nunca eram coletados. Exemplo: o cadastro de dependente nas Encomendas falhava sempre com 422 e nunca apareceu no catálogo.
- O Jev sem contexto específico errou de forma perigosa em teste: fechou como "regra de negócio" 7 violações de isolamento por `association_id`.

## 2. Princípios

1. **Tudo é catalogado.** Ruído não quer dizer "ignorar". Quer dizer "problema conhecido, com disposição definida".
2. **O que é determinístico fica no código.** A IA decide só o que é ambíguo.
3. **Na dúvida, escalar. Nunca publicar.**
4. **A base de conhecimento serve para qualquer IA.** Jev, Claude ou outra leem o mesmo material.
5. **Tudo fica no SharePoint.** Consulta sob demanda pelo Graph, sem cópia local.

## 3. Modelo de dados

| Nível | O que é | Onde |
|---|---|---|
| Ocorrência | Cada linha de erro no log | Parquet no servidor |
| Incidente | Cada assinatura (mensagem normalizada) distinta | Lista `CatalogoErros` (existente) |
| Ticket de problema | A causa raiz. Agrupa N incidentes | Lista `TicketsProblema` (nova) |
| Padrão recorrente | Lição aprendida a partir de vários tickets | `BaseConhecimento/04-Padroes-Recorrentes/` |

### 3.1 Lista `TicketsProblema`

| Campo | Tipo | Valores e notas |
|---|---|---|
| `Title` | texto | título do problema |
| `CodProblema` | texto | `PRB-NNNN`, único |
| `Sistema` | escolha | APRXM, ERP-ITP, Banco, DW, Site, Infra |
| `Modulo` | texto | ex.: Encomendas, Matrículas |
| `Camada` | escolha | frontend, backend, banco, infra, terceiros |
| `Natureza` | escolha | bug, migration, infra, operacao, regra-negocio, ataque-varredura, terceiros, efeito-deploy |
| `Disposicao` | escolha | remediar, aceito-conhecido, monitorar |
| `Criticidade` | escolha | baixa, media, alta, critica |
| `JustificativaCriticidade` | texto longo | |
| `Travas` | múltipla escolha | association-id, dinheiro, dado-pessoal |
| `CausaRaiz` | texto longo | |
| `Impacto` | texto longo | quem é afetado e como |
| `Contorno` | texto longo | o que fazer enquanto não se corrige |
| `Remediacao` | texto longo | a correção certa |
| `Estado` | escolha | aberto, em-analise, erro-conhecido, em-correcao, resolvido, encerrado, reaberto |
| `LinkPR` | texto | URL do PR ou do commit |
| `ResolvidoEm` | data | |
| `QtdIncidentes` | número | incidentes vinculados |
| `QtdOcorrencias` | número | soma das ocorrências |
| `UltimaOcorrencia` | data e hora | |
| `PastaDocumentos` | texto | caminho em `02-Problemas/` |
| `PadraoRecorrente` | texto | nome do documento em `04-Padroes-Recorrentes/`, se houver |
| `OrigemClassificacao` | escolha | ia, humano |
| `RevisadoPor` | texto | só vale como gabarito se preenchido |
| `RevisadoEm` | data | |

A `CatalogoErros` ganha o campo `CodProblema`, com o vínculo do incidente com o ticket.

### 3.2 Pasta `BaseConhecimento` (biblioteca Documentos)

```
00-Regras/                 regras-classificacao.md, politica-rollback.md
01-Sistemas/<Sistema>/     contexto.md, regras-negocio.md, armadilhas.md
02-Problemas/PRB-NNNN-descricao/   analise.md, correcao.md, anexos/
03-Implementacoes/AAAA-MM-DD-descricao/   spec.md, plano.md
04-Padroes-Recorrentes/    <tema>.md
```

Formato Markdown. Abre no SharePoint e a IA lê sem conversão.

## 4. Fluxo

1. **Coleta** (a cada 5 min, sem mudança): container → normalização → Parquet.
2. **Filtro determinístico** (código, sem IA). Rotula e vincula ao ticket conhecido, sem fechar nada sem registro:
   - DDL `already exists` e `duplicate key` em rajada → ticket de restauração ou migration do dia.
   - Robôs de varredura (`/.env`, `/.git`, `phpinfo`), sondas TLS.
   - Linhas `level=info`/`warn` capturadas por engano.
   - **Rajada:** dezenas de erros de banco no mesmo minuto → evento de restauração ou sincronização.
3. **Triagem pelo Jev** (uma chamada, perguntas em paralelo):
   - O contexto vem por consulta ao SharePoint: regras, contexto do sistema de origem, os 3–5 tickets revisados mais parecidos e os padrões recorrentes do tema.
   - Perguntas: pertence a qual ticket existente? · é reincidência de ticket resolvido? · natureza · disposição · sistema/módulo/camada · criticidade · afeta usuário · envolve dinheiro/dado pessoal/`association_id` · risco da correção · ação.
   - Resposta abaixo do limite de confiança conta como "não sei" e sobe um nível. Os limites são calibrados contra o gabarito revisado.
4. **Travas no código.** Valem acima de qualquer resposta da IA: `association_id`, dinheiro e dado pessoal nunca fecham e nunca publicam direto.
5. **SharePoint:** crítico/alto na hora. Médio/baixo na consolidação diária, organizada pelo Jev (agrupa, ordena e resume).
6. **Correção pelo Claude** (rodada periódica, máx. 5 tickets):
   - Antes de começar, recebe os padrões recorrentes do tema (ex.: mudança de schema).
   - Investiga no código e propõe a correção.
   - **O Jev avalia a correção:** bate com o diagnóstico? mexe além do necessário? risco?
   - **Jev e Claude dizem "seguro"** → publica direto, conforme a política de rollback (seção 5).
   - **Risco mediano ou alto** → aprovação no Power Automate (e-mail e Teams) → aprovado → Claude aplica.
   - **Duvidoso, complexo ou falhou** → estado "investigar".
7. **Avisos por e-mail:**
   - Investigar crítico/alto → na hora.
   - Investigar médio/baixo → resumo diário.
   - Toda publicação automática → aviso com link do commit.

## 5. Política de rollback (publicação automática)

- **Pré-condições:** CodeQL e build verdes; no máximo 5 publicações por rodada; nunca com trava ativa.
- **Deploy:** um commit por ticket, com a referência `PRB-NNNN` na mensagem.
- **Validação pós-deploy:** health check e janela de observação de 15 min.
  - Se a assinatura do problema voltar ou surgirem erros novos no mesmo módulo → **reversão automática** (`git revert` + redeploy).
  - O ticket volta para "em-correção" e passa a exigir aprovação humana.
- **Migrations:** nunca são publicadas automaticamente. Sempre passam por aprovação, pelo histórico de incidentes com `DROP ... CASCADE` e replay.
- **Circuit breaker:** duas reversões seguidas no mesmo sistema suspendem a publicação automática naquele sistema até liberação humana.

## 6. Erros de operação

- Coletar respostas 409/422 agrupadas por endpoint + mensagem + associação.
- O Jev avalia se a frequência é anormal, se o mesmo operador repete a ação e se a mensagem contradiz a tela.
- Rotina esperada vira estatística. Padrão anormal vira ticket com natureza `operacao`.

## 7. Fluxo no Power Automate

O fluxo `testeErros` (123fb2d1) é reconstruído. Ele passa a disparar sobre `TicketsProblema` (estado em-correção + risco mediano/alto), e não sobre a `CatalogoErros`.

Bugs corrigidos na reconstrução:
- condição com `E` no lugar de `OU`;
- quatro leituras de `outputs('Atualizar_item')` (sempre vazio) no lugar de `triggerBody()`;
- ID com `\r\n` no final;
- ausência de caminho para "seguro".

## 8. Fases de implementação

1. **Base de conhecimento.** Lista, biblioteca, regras, contexto por sistema, tickets pré-classificados a partir do catálogo → **revisão humana** → gabarito.
2. **Coleta ampliada.** Erros de operação; vínculo com deploy e commit.
3. **Triagem com Jev.** Filtro determinístico + Jev + travas. Validada contra o gabarito antes de ligar.
4. **Correção e publicação.** Avaliação da correção pelo Jev, rollback, novo fluxo no Power Automate.
5. **Futuro:** visualização do processo na infraestrutura.

## 9. Critérios de pronto (fase 3)

- 0 casos com trava fechados ou publicados automaticamente no teste contra o gabarito.
- Ruído vinculado ao ticket correto em ≥ 95% dos casos.
- Criticidade igual à do gabarito em ≥ 85%. Divergências só para cima são aceitas.

## 10. Fora de escopo

- Trocar o Parquet ou o visualizador atual.
- Painel de visualização do processo (fase 5).
- GitHub Issues: o catálogo permanece no SharePoint.

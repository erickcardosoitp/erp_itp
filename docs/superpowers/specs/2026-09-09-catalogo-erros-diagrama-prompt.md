# Arquitetura do Catálogo de Erros — insumo pra diagrama

> Este documento é só a estrutura (componentes, fluxo, decisões), sem
> histórico de discussão/troubleshooting. Objetivo: servir de contexto
> pra gerar um diagrama visual da arquitetura (ex: fluxograma, diagrama
> de componentes/sequência).

---

## Componentes

1. **Aplicações monitoradas** (fontes do erro): ITP (rodando hoje),
   APRXM e DW (a subir depois). Todas rodam como containers Docker numa
   única VM (`vm-itp-prod`).

2. **Camada de serviço** (roda na própria VM): um script + Claude Code
   CLI (headless, via linha de comando). Responsável por ler logs, normalizar,
   deduplicar, classificar, investigar causa raiz, propor correção.

3. **Catálogo operacional**: uma SharePoint List (`CatalogoErros`). Guarda
   o estado atual de cada erro único (não histórico de ocorrências) —
   status, fase, contador, diagnóstico, correção proposta.

4. **Histórico analítico**: arquivos Parquet, gravados em modo
   append-only (uma linha por ocorrência de erro, nunca alterada).
   Alimenta consultas de tendência e, no futuro, o Data Warehouse.

5. **Power Automate**: dois fluxos separados.
   - Fluxo A (aprovação): dispara quando um item novo aparece na
     SharePoint List → pede aprovação humana (Approval, notificação por
     Outlook/Teams) → grava a decisão de volta na lista.
   - Fluxo B (relatório): roda 1x por dia, lê a lista, monta um resumo
     (erros novos, tratados, conhecidos, pendentes) e envia por email.

6. **Microsoft Graph API**: é o único canal de comunicação entre a VM e
   o Microsoft 365 (SharePoint). A VM sempre inicia a chamada (saída);
   nunca o inverso.

---

## Fluxo principal (sequência)

```
1. Uma aplicação (ITP/APRXM/DW) gera um erro, que cai no log do container.
2. A camada de serviço na VM lê esse log periodicamente.
3. Normaliza a mensagem de erro (remove timestamp, IDs, valores variáveis).
4. Verifica se esse erro (já normalizado) já existe no catálogo:
   4a. Bate exatamente com um erro já catalogado → é reincidência,
       só incrementa o contador. Fim do fluxo pra essa ocorrência.
   4b. Não bate exatamente → Claude Code CLI compara semanticamente com
       os erros existentes da mesma aplicação/categoria:
       - Se for essencialmente o mesmo problema → funde com o existente
         (mesmo tratamento do item 4a).
       - Se for realmente novo → segue pro passo 5.
5. Claude Code CLI investiga a causa em camadas, nessa ordem:
   log do container → schema do banco → infraestrutura da VM →
   integração externa (só avança de camada se a anterior não explicar).
6. Gera um diagnóstico e uma correção proposta (nunca aplica sozinho).
7. Grava um novo item na SharePoint List (catálogo operacional) e uma
   linha no Parquet (histórico), via Microsoft Graph API.
8. Power Automate detecta o item novo → dispara aprovação humana.
9. Humano aprova ou rejeita (via Outlook/Teams).
10. Se aprovado: a VM (outro processo agendado) lê essa aprovação de
    volta na lista, e o Claude Code CLI executa a correção (a partir de
    um catálogo fechado de ações pré-aprovadas, nunca uma ação livre).
11. Depois de aplicar, valida de novo se o erro sumiu:
    - Sumiu → status = resolvido.
    - Continua → status = reaberto / escalado pra humano.
12. Uma vez por dia, Power Automate lê o catálogo inteiro e manda um
    relatório por email com o resumo do período.
```

---

## Decisões de design que afetam o diagrama

- A comunicação entre a VM e o Microsoft 365 é **sempre de saída** (a VM
  chama a Graph API) — não existe uma seta entrando na VM vinda do Power
  Automate.
- O Parquet só recebe escrita (append) da camada de serviço — nunca é
  lido/escrito pelo Power Automate diretamente.
- A SharePoint List é o único ponto de contato do Power Automate com o
  resto do sistema.
- Nenhuma correção é aplicada automaticamente sem passar pela etapa de
  aprovação humana (passo 8-9) — mesmo quando a IA avalia que poderia
  resolver sozinha.
- O passo 5 (investigação em camadas) e o passo 6 (geração de correção)
  rodam inteiramente dentro da VM — o Power Automate não participa dessa
  parte, só da aprovação e do relatório.

---

## Sugestão de diagrama

Um fluxograma com 3 "raias" (swimlanes) funciona bem:
- **Raia 1 — Aplicações**: ITP, APRXM, DW (containers na VM)
- **Raia 2 — VM (Claude Code CLI)**: normalização → dedup (3 camadas) →
  investigação em camadas → geração de correção → escrita em
  SharePoint/Parquet → execução de correção aprovada
- **Raia 3 — Microsoft 365**: SharePoint List ↔ Power Automate (Fluxo A
  de aprovação, Fluxo B de relatório) → email/Teams pro humano

Setas cruzando as raias representam a Graph API (VM → SharePoint) e a
aprovação voltando (Power Automate atualiza o item, a VM lê essa
atualização depois).

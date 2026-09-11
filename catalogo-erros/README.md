# Coletor do Catálogo de Erros

Implementação do fluxo descrito em `CATALOGO-ERROS.md` (raiz do repo) e
`docs/superpowers/specs/2026-09-09-catalogo-erros-vm-design.md`.

## Rodando manualmente

```bash
cd ~/catalogo-erros   # ou onde o repo estiver clonado na VM
python3 coletor.py                # usa o state salvo (~/itp-stack/catalogo-erros-state.json)
python3 coletor.py --desde 24h    # ignora o state, força janela de 24h
```

Pré-requisitos na VM (já instalados em 2026-09-09):
- Python 3.9+, `pip3 install -r requirements.txt`
- Node 22+, `npm install -g @anthropic-ai/claude-code`, `claude` já logado (`claude` interativo uma vez)
- `~/itp-stack/catalogo_erros.env` com as credenciais do app `Catalogo Erros - VM`

## O que ele faz

1. Lê `docker logs` dos containers em `config.py::CONTAINERS`
2. Filtra linhas com padrão de erro (`error|exception|fatal|panic`)
3. Normaliza cada linha (`normalizador.py`) — remove timestamp/PID/números/UUIDs
4. Deduplica em 3 camadas (spec seção 6):
   - Camada 1: normalização (acima)
   - Camada 2: busca exata na SharePoint List (`graph_client.py`) — sem custo de IA
   - Camada 3: comparação semântica via Claude Code CLI (`claude_client.py`) — só se a Camada 2 não achou
5. Grava/atualiza item na SharePoint List `CatalogoErros`
6. Grava uma linha por ocorrência no Parquet (`parquet_writer.py`), em `~/itp-stack/catalogo-erros-parquet/app=X/data=Y/`

## Aplicador de correções (`aplicador.py`)

Segunda metade do fluxo, separada do coletor de propósito (spec seção 7 —
investigar e corrigir são etapas diferentes). Roda via cron (`*/15 * * * *`,
hoje através do runner do ITP_TEC — ver `catalogo-erros-viewer/tarefas-api/`),
só executa itens já `Status=aprovado` com `PromptExecucao` preenchido pelo
Power Automate (Fluxo A). Nunca decide o que fazer sozinho — só aplica o
escopo já aprovado por humano, valida, e grava resultado
(`ResultadoExecucao`, `Fase`, `Status`, `TentativasResolucao`, `IAResolveu`,
`TempoResolucaoHoras`).

## Limitações conhecidas

- Não aplica nenhuma correção sozinho na fase de coleta — só classifica e propõe (decisão de design, não limitação técnica)
- Item aprovado com `PromptExecucao` vazio (aprovador não preencheu "Ação do catálogo"/"Instrução adicional") fica parado pra sempre, sem escalonar — gap conhecido, não corrigido de propósito por ora (ver spec, seção 12)
- `claude_client.executar()` não re-checa impacto colateral no momento da execução, só a classificação inicial faz isso
- Coluna `LinkCommit` não é gravada com sucesso (PATCH isolado falha sempre — schema/type facet da SharePoint)
- Assume que o timestamp da linha de log está em UTC sem indicação explícita de fuso

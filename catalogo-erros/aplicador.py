#!/usr/bin/env python3
"""Aplicador de correções aprovadas — a segunda metade do fluxo, depois
do Power Automate (Fluxo A) ter carimbado Status=aprovado e montado o
PromptExecucao na SharePoint List.

Diferente do coletor.py (que investiga e propõe, nunca aplica), esse
script SÓ EXECUTA o que já foi aprovado por humano — nunca decide algo
novo. Ver claude_client.py::executar() e o wrapper de segurança que
proíbe desviar do escopo aprovado.

Uso:
    python3 aplicador.py

Pensado pra rodar via cron (proposto: 15/15min) — sozinho, sem o wrapper
adaptativo do coletor (aqui não faz sentido acelerar/desacelerar, é
sempre a mesma prioridade: aplicar o que está esperando).
"""
import sys
from datetime import datetime, timezone

import config
import custos
from claude_client import TarefaEscalada, executar, registrar_escalonamento
from graph_client import GraphClient

LIMITE_TENTATIVAS = 2  # spec seção 11 — evita loop de retry infinito

# Circuit breaker (decisão 2026-09-15, pós-incidente de estouro de sessão):
# mesma lógica do coletor.py -- no máximo N execuções de correção por rodada.
# Cada executar() já é mais caro que uma classificação (roda Edit/Write/Bash
# de verdade, até 5min cada), então o mesmo teto é ainda mais importante aqui.
LIMITE_EXECUCOES_POR_RODADA = 5


def log(msg: str) -> None:
    print(f"[{datetime.now(timezone.utc).isoformat()}] {msg}", flush=True)


def main() -> None:
    cfg = config.carregar_env()
    client = GraphClient(cfg)

    itens = client.buscar_aprovados_pendentes()
    log(f"{len(itens)} item(ns) aprovado(s) aguardando execução")

    execucoes_nesta_rodada = 0

    for item in itens:
        fields = item["fields"]
        cod_erro = fields.get("CodErro")
        prompt_execucao = fields.get("PromptExecucao")

        if not prompt_execucao or not prompt_execucao.strip():
            log(f"  {cod_erro}: PromptExecucao vazio, pulando")
            continue

        tentativas_ate_agora = fields.get("TentativasResolucao", 0)
        if tentativas_ate_agora >= LIMITE_TENTATIVAS:
            log(f"  {cod_erro}: já teve {tentativas_ate_agora} tentativa(s), "
                f"limite atingido — escalando sem tentar de novo")
            client.atualizar_item(item["id"], {
                "Fase": "escalado",
                "Status": "aberto",
                "ResultadoExecucao": (
                    f"Limite de {LIMITE_TENTATIVAS} tentativas automáticas atingido "
                    f"sem sucesso — precisa de intervenção manual."
                ),
            })
            continue

        if execucoes_nesta_rodada >= LIMITE_EXECUCOES_POR_RODADA:
            log(f"  {cod_erro}: teto de {LIMITE_EXECUCOES_POR_RODADA} execuções da rodada "
                f"atingido — adiando pra próxima rodada (não conta como tentativa)")
            continue  # item continua "aprovado", pego de novo na próxima rodada

        log(f"  executando {cod_erro}...")
        client.atualizar_item(item["id"], {"Fase": "aplicando"})
        execucoes_nesta_rodada += 1

        try:
            resultado = executar(prompt_execucao)
        except TarefaEscalada as exc:
            log(f"  {cod_erro}: ESCALADO — {exc.motivo}")
            registrar_escalonamento("aplicador", cod_erro, exc.motivo, exc.diagnostico)
            client.atualizar_item(item["id"], {
                "Fase": "escalado",
                "Status": "aberto",
                "ResultadoExecucao": exc.diagnostico[:1500],
            })
            if "rate limit" in exc.motivo:
                # Próximas execuções desta rodada vão bater na mesma parede
                # -- para de tentar em vez de escalar item por item à toa.
                execucoes_nesta_rodada = LIMITE_EXECUCOES_POR_RODADA
            continue
        except Exception as exc:
            log(f"  {cod_erro}: ERRO ao executar — {exc}")
            client.atualizar_item(item["id"], {
                "Fase": "escalado",
                "ResultadoExecucao": f"Erro ao executar: {exc}",
            })
            continue

        if resultado.get("_custo_usd"):
            log(f"  {cod_erro}: custo desta execução ${resultado['_custo_usd']:.4f}")
            custos.registrar("aplicador", resultado["_custo_usd"], cod_erro=cod_erro)

        resumo_final = resultado["resumo"]
        if resultado.get("link_commit"):
            # Coluna LinkCommit nunca aceita escrita (400 sempre, testado
            # 2026-09-11: nem string simples nem objeto {Url,Description}
            # de hyperlink funcionam — a coluna nao expoe NENHUM type facet
            # no Graph, limitacao da API pra esse schema especifico, fora
            # do nosso controle). Em vez de tentar de novo a cada execucao,
            # embute o link no campo que ja funciona.
            resumo_final = f"{resumo_final}\n\nCommit: {resultado['link_commit']}"

        atualizacao = {
            "ResultadoExecucao": resumo_final,
            "TentativasResolucao": fields.get("TentativasResolucao", 0) + 1,
        }
        if resultado.get("acao_realizada"):
            atualizacao["AcaoExecutada"] = resultado["acao_realizada"].strip()[:255]

        if resultado.get("precisa_atencao_humana"):
            atualizacao["Fase"] = "escalado"
            atualizacao["Status"] = "aberto"
            log(f"  {cod_erro}: precisa de atenção humana — {resultado['resumo']}")
        elif resultado.get("sucesso"):
            agora_resolucao = datetime.now(timezone.utc)
            atualizacao["Fase"] = "validando"
            atualizacao["Status"] = "resolvido"
            atualizacao["ResolvidoEm"] = agora_resolucao.isoformat()
            atualizacao["IAResolveu"] = True
            # Base = AprovadoEm (inicio do CICLO atual), nunca PrimeiraVez:
            # um erro pode reabrir varias vezes, e PrimeiraVez fica fixo na
            # 1a ocorrencia de sempre — contaria tempo parado de ciclos
            # anteriores junto com o tempo de execucao real (achado do
            # usuario, 2026-09-11: "um erro pode acontecer mais de uma
            # vez, ai ele vai ter um tempo enorme que nao faz sentido").
            aprovado_em = fields.get("AprovadoEm")
            if aprovado_em:
                try:
                    inicio = datetime.fromisoformat(aprovado_em.replace("Z", "+00:00"))
                    atualizacao["TempoResolucaoHoras"] = round(
                        (agora_resolucao - inicio).total_seconds() / 3600, 2
                    )
                except ValueError:
                    pass
            log(f"  {cod_erro}: resolvido — {resultado['resumo']}")
        else:
            atualizacao["Fase"] = "escalado"
            atualizacao["Status"] = "aberto"
            log(f"  {cod_erro}: não resolvido — {resultado['resumo']}")

        client.atualizar_item(item["id"], atualizacao)

    log("Aplicação concluída.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        log(f"ERRO FATAL: {exc}")
        sys.exit(1)

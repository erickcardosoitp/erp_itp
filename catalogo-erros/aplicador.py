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
from claude_client import executar
from graph_client import GraphClient

LIMITE_TENTATIVAS = 2  # spec seção 11 — evita loop de retry infinito


def log(msg: str) -> None:
    print(f"[{datetime.now(timezone.utc).isoformat()}] {msg}", flush=True)


def main() -> None:
    cfg = config.carregar_env()
    client = GraphClient(cfg)

    itens = client.buscar_aprovados_pendentes()
    log(f"{len(itens)} item(ns) aprovado(s) aguardando execução")

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

        log(f"  executando {cod_erro}...")
        client.atualizar_item(item["id"], {"Fase": "aplicando"})

        try:
            resultado = executar(prompt_execucao)
        except Exception as exc:
            log(f"  {cod_erro}: ERRO ao executar — {exc}")
            client.atualizar_item(item["id"], {
                "Fase": "escalado",
                "ResultadoExecucao": f"Erro ao executar: {exc}",
            })
            continue

        if resultado.get("_custo_usd"):
            log(f"  {cod_erro}: custo desta execução ${resultado['_custo_usd']:.4f}")

        atualizacao = {
            "ResultadoExecucao": resultado["resumo"],
            "TentativasResolucao": fields.get("TentativasResolucao", 0) + 1,
        }
        if resultado.get("link_commit"):
            atualizacao["LinkCommit"] = resultado["link_commit"]

        if resultado.get("precisa_atencao_humana"):
            atualizacao["Fase"] = "escalado"
            atualizacao["Status"] = "aberto"
            log(f"  {cod_erro}: precisa de atenção humana — {resultado['resumo']}")
        elif resultado.get("sucesso"):
            atualizacao["Fase"] = "validando"
            atualizacao["Status"] = "resolvido"
            atualizacao["ResolvidoEm"] = datetime.now(timezone.utc).isoformat()
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

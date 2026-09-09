#!/usr/bin/env python3
"""Coletor de erros da VM — orquestra o fluxo descrito em
CATALOGO-ERROS.md: lê docker logs, normaliza, deduplica em 3 camadas,
classifica via Claude Code CLI, grava na SharePoint List e no Parquet.

Uso:
    python3 coletor.py                 # roda normal (usa/atualiza o state)
    python3 coletor.py --desde 24h     # ignora o state, força janela

Pensado pra rodar via cron. Idempotente na medida do possível: cada
execução só processa logs desde a última execução (arquivo de state).
"""
import argparse
import json
import os
import subprocess
import sys
import uuid
from collections import defaultdict
from datetime import datetime, timezone

import config
import normalizador
import parquet_writer
from claude_client import classificar
from graph_client import GraphClient

CAMPOS_SHORTLIST = ["CodErro", "TipoErro", "Assinatura", "Categoria"]

# Categorias cuja reincidência reabre sempre um item resolvido (spec seção 9/10).
REABRE_SEMPRE = {"banco", "codigo", "infra", "seguranca", "outros"}
LIMITE_PICO_INTEGRACAO = 5  # ocorrências no mesmo lote pra considerar "pico"


def log(msg: str) -> None:
    print(f"[{datetime.now(timezone.utc).isoformat()}] {msg}", flush=True)


def carregar_state() -> dict:
    if os.path.exists(config.STATE_FILE):
        with open(config.STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def salvar_state(state: dict) -> None:
    os.makedirs(os.path.dirname(config.STATE_FILE), exist_ok=True)
    with open(config.STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)


def logs_do_container(nome: str, desde_iso: str) -> str:
    resultado = subprocess.run(
        ["docker", "logs", "--since", desde_iso, nome],
        capture_output=True, text=True, timeout=60,
    )
    # docker manda log de app pro stderr às vezes (ex: NestJS) — junta os dois.
    return (resultado.stdout or "") + (resultado.stderr or "")


def extrair_erros(texto_log: str) -> list[str]:
    linhas = texto_log.splitlines()
    return [l for l in linhas if normalizador.contem_erro(l, config.PADRAO_ERRO)]


def gerar_cod_erro() -> str:
    return f"ERR-{uuid.uuid4().hex[:10]}"


def gerar_cod_cat(item_id: str) -> str:
    return f"CAT-{int(item_id):04d}"


def aplicar_matriz_reincidencia(item_fields: dict, categoria_do_item: str, qtd_no_lote: int) -> dict:
    """Decide se um item já 'resolvido' deve reabrir, de acordo com a
    matriz da spec (seção 9/10). Devolve os campos extras a atualizar."""
    status_atual = item_fields.get("Status")
    if status_atual != "resolvido":
        return {}  # só reincidência de item resolvido dispara essa lógica

    if categoria_do_item == "integracao":
        if qtd_no_lote > LIMITE_PICO_INTEGRACAO:
            return {"Status": "reaberto", "Fase": "detectado", "Reincidente": True}
        return {}  # instabilidade isolada esperada, não reabre
    if categoria_do_item == "usuario":
        return {}  # nunca reabre sozinho

    if categoria_do_item in REABRE_SEMPRE:
        return {"Status": "reaberto", "Fase": "detectado", "Reincidente": True}
    return {}


def processar_grupo(
    client: GraphClient,
    container: str,
    aplicacao_sugerida: str,
    msg_normalizada: str,
    exemplos_brutos: list[str],
    primeiro_timestamp: datetime,
    ultimo_timestamp: datetime,
    custo_acumulado: list,
) -> tuple[str, str]:
    """Processa um grupo (mesma assinatura normalizada) visto neste lote.
    Devolve (CodErro, Aplicacao) usados — pra gravar as linhas do Parquet."""
    qtd = len(exemplos_brutos)

    # Camada 2: busca exata (sem custo de IA).
    existente = client.buscar_por_assinatura(aplicacao_sugerida, msg_normalizada)
    if existente:
        fields = existente["fields"]
        cod_erro = fields["CodErro"]
        atualizacao = {
            "Ocorrencias": fields.get("Ocorrencias", 0) + qtd,
            "UltimaVez": ultimo_timestamp.isoformat(),
            "MensagemExemplo": exemplos_brutos[-1][:5000],
        }
        atualizacao.update(aplicar_matriz_reincidencia(fields, fields.get("Categoria"), qtd))
        client.atualizar_item(existente["id"], atualizacao)
        log(f"  reincidência exata: {cod_erro} (+{qtd} ocorrências)")
        return cod_erro, aplicacao_sugerida

    # Camada 3: sem match exato — classifica e checa semelhança semântica.
    shortlist = client.listar_shortlist(aplicacao_sugerida)
    classificacao = classificar(
        container=container,
        aplicacao_sugerida=aplicacao_sugerida,
        mensagem_normalizada=msg_normalizada,
        mensagem_bruta=exemplos_brutos[0],
        shortlist=shortlist,
    )
    if classificacao.get("_custo_usd"):
        custo_acumulado.append(classificacao["_custo_usd"])

    aplicacao_final = classificacao["aplicacao"]

    if classificacao.get("eh_reincidencia_de"):
        cod_erro_fundido = classificacao["eh_reincidencia_de"]
        correspondente = next(
            (i for i in shortlist if i.get("CodErro") == cod_erro_fundido), None
        )
        if correspondente:
            # Precisa do item completo (id) pra fazer PATCH — busca de novo por CodErro.
            item_completo = client.buscar_por_assinatura(
                aplicacao_final, correspondente["Assinatura"]
            )
            if item_completo:
                fields = item_completo["fields"]
                atualizacao = {
                    "Ocorrencias": fields.get("Ocorrencias", 0) + qtd,
                    "UltimaVez": ultimo_timestamp.isoformat(),
                }
                atualizacao.update(
                    aplicar_matriz_reincidencia(fields, fields.get("Categoria"), qtd)
                )
                client.atualizar_item(item_completo["id"], atualizacao)
                log(f"  fundido via IA com {cod_erro_fundido} (+{qtd} ocorrências)")
                return cod_erro_fundido, aplicacao_final
        log(f"  aviso: IA apontou fusão com {cod_erro_fundido} mas item não foi "
            f"reencontrado — criando novo por segurança")

    # Item genuinamente novo.
    cod_erro = gerar_cod_erro()
    novo_item = client.criar_item({
        "Title": classificacao["tipo_erro"][:255],
        "Aplicacao": aplicacao_final,
        "DescricaoResumida": classificacao["descricao_resumida"],
        "Categoria": classificacao["categoria"],
        "TipoErro": classificacao["tipo_erro"],
        "Assinatura": msg_normalizada[:500],
        "CodErro": cod_erro,
        "MensagemExemplo": exemplos_brutos[0][:5000],
        "Ocorrencias": qtd,
        "PrimeiraVez": primeiro_timestamp.isoformat(),
        "UltimaVez": ultimo_timestamp.isoformat(),
        "Diagnostico": classificacao["diagnostico"],
        "CorrecaoProposta": classificacao["correcao_proposta"],
        "Criticidade": classificacao["criticidade"],
        "Fase": "diagnosticado",
        "Status": "aberto",
        "IAPodeResolver": classificacao["ia_pode_resolver"],
        "Confianca": classificacao["confianca"],
        "CamadaInvestigacao": classificacao["camada_investigacao"],
        "Reincidente": False,
    })
    cod_cat = gerar_cod_cat(novo_item["id"])
    client.atualizar_item(novo_item["id"], {"CodCat": cod_cat})
    log(f"  item novo criado: {cod_cat} / {cod_erro} ({classificacao['categoria']}, "
        f"criticidade={classificacao['criticidade']})")
    return cod_erro, aplicacao_final


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--desde", default=None, help="Ex: 24h, 1h — ignora o state salvo")
    args = parser.parse_args()

    cfg = config.carregar_env()
    client = GraphClient(cfg)
    state = carregar_state()
    agora = parquet_writer.agora_utc()
    custo_acumulado: list = []
    linhas_parquet: list[dict] = []

    for container_cfg in config.CONTAINERS:
        nome = container_cfg["nome"]
        aplicacao_sugerida = container_cfg["aplicacao_sugerida"]

        if args.desde:
            desde_iso = args.desde
        else:
            desde_iso = state.get(nome, "24h")  # primeira execução: últimas 24h

        log(f"Lendo {nome} desde {desde_iso}...")
        texto_log = logs_do_container(nome, desde_iso)
        linhas_erro = extrair_erros(texto_log)
        log(f"  {len(linhas_erro)} linha(s) com padrão de erro")

        # Agrupa por assinatura normalizada dentro deste lote, guardando
        # também o timestamp real de cada ocorrência (quando a linha tiver).
        grupos: dict[str, list[str]] = defaultdict(list)
        timestamps_por_grupo: dict[str, list] = defaultdict(list)
        for linha in linhas_erro:
            assinatura = normalizador.normalizar(linha)
            grupos[assinatura].append(linha)
            ts = normalizador.extrair_timestamp(linha) or agora
            timestamps_por_grupo[assinatura].append(ts)

        for msg_normalizada, exemplos in grupos.items():
            ts_grupo = sorted(timestamps_por_grupo[msg_normalizada])
            primeiro_ts, ultimo_ts = ts_grupo[0], ts_grupo[-1]

            cod_erro, aplicacao_final = processar_grupo(
                client=client,
                container=nome,
                aplicacao_sugerida=aplicacao_sugerida,
                msg_normalizada=msg_normalizada,
                exemplos_brutos=exemplos,
                primeiro_timestamp=primeiro_ts,
                ultimo_timestamp=ultimo_ts,
                custo_acumulado=custo_acumulado,
            )
            for ts_ocorrencia in ts_grupo:
                linhas_parquet.append({
                    "CodErro": cod_erro,
                    "Aplicacao": aplicacao_final,
                    "Categoria": "",  # preenchido só na SharePoint List hoje; ok ficar vazio aqui
                    "TipoErro": "",
                    "MensagemNormalizada": msg_normalizada,
                    "Criticidade": "",
                    "StatusNoMomento": "",
                    "TimestampOcorrencia": ts_ocorrencia,
                    "FoiAutoCorrigido": False,
                })

        state[nome] = agora.isoformat()

    if linhas_parquet:
        arquivos = parquet_writer.agrupar_e_gravar(config.PARQUET_BASE_DIR, linhas_parquet)
        log(f"Parquet: {len(arquivos)} arquivo(s) gravado(s), {len(linhas_parquet)} linha(s) no total")

    salvar_state(state)

    if custo_acumulado:
        log(f"Custo estimado de IA nesta execução: ${sum(custo_acumulado):.4f} "
            f"({len(custo_acumulado)} chamada(s) ao Claude)")
    log("Coleta concluída.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        log(f"ERRO FATAL: {exc}")
        sys.exit(1)

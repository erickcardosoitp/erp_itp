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
from __future__ import annotations  # PEP 604 (X | None) -- VM roda Python 3.9

import argparse
import fcntl
import json
import os
import subprocess
import sys
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import config
import custos
import normalizador
import parquet_writer
from claude_client import TarefaEscalada, classificar, registrar_escalonamento
from graph_client import GraphClient

CAMPOS_SHORTLIST = ["CodErro", "TipoErro", "Assinatura", "Categoria"]

# Categorias cuja reincidência reabre sempre um item resolvido (spec seção
# 9/10). Precisa bater exatamente com CATEGORIAS_VALIDAS de claude_client.py
# (achado real 2026-09-11: grafia antiga "codigo"/"seguranca"/"outros" nunca
# batia com os valores reais "código"/"security"/"terceiros" que o
# classificador de fato atribui — reincidência dessas 3 categorias nunca
# reabria um item já resolvido).
REABRE_SEMPRE = {"banco", "código", "infra", "security", "terceiros"}
LIMITE_PICO_INTEGRACAO = 5  # ocorrências no mesmo lote pra considerar "pico"

# Circuit breaker (decisão 2026-09-15, pós-incidente de estouro de sessão):
# no máximo N classificações de IA por execução do coletor. O que sobrar
# fica pendente pro próximo lote (o state daquele container/tarefa não
# avança), em vez de drenar o backlog inteiro de uma vez -- foi exatamente
# isso que consumiu ~92% da janela de sessão de 5h em minutos no incidente.
LIMITE_CLASSIFICACOES_POR_RODADA = 5

METRICA_TETO_PATH = os.path.expanduser("~/itp-stack/textfile-metrics/catalogo-erros-teto.prom")


def _escrever_metrica_teto(atingido: bool) -> None:
    """Flag pro Grafana: 1 se esta rodada bateu no teto de classificações
    (sinal de backlog se acumulando, mesmo sem nenhum erro/exceção) --
    complementa o heartbeat existente (que só detecta ausência de execução,
    não uma execução "viva" mas sempre no limite)."""
    try:
        os.makedirs(os.path.dirname(METRICA_TETO_PATH), exist_ok=True)
        tmp = METRICA_TETO_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            f.write(
                "# HELP catalogo_erros_teto_atingido 1 se a última execução do "
                "coletor bateu no teto de classificações por rodada.\n"
                "# TYPE catalogo_erros_teto_atingido gauge\n"
                f"catalogo_erros_teto_atingido {1 if atingido else 0}\n"
            )
        os.replace(tmp, METRICA_TETO_PATH)
    except OSError:
        pass


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
    return [
        l for l in linhas
        if normalizador.contem_erro(l, config.PADRAO_ERRO)
        and not normalizador.eh_access_log_ok(l)
        and not normalizador.eh_nivel_nao_erro(l)
    ]


def _desde_para_datetime(desde: str):
    """Aceita tanto duracao simples ("24h") quanto ISO datetime, mesmo
    padrao aceito pelo --since do docker logs (mas aqui sem shell out)."""
    if desde.endswith("h") and desde[:-1].isdigit():
        return datetime.now(timezone.utc) - timedelta(hours=int(desde[:-1]))
    return datetime.fromisoformat(desde.replace("Z", "+00:00"))


def carregar_registro_tarefas() -> list[dict]:
    if not os.path.exists(config.TAREFAS_REGISTRO_PATH):
        return []
    return json.load(open(config.TAREFAS_REGISTRO_PATH, encoding="utf-8")).get("tarefas", [])


def falhas_da_tarefa(task_id: str, log_path: str | None, desde_iso: str) -> list[dict]:
    """Le tarefas-timing/<id>.jsonl e devolve as execucoes com exit_code != 0
    desde desde_iso. Cada item ja vem com um trecho do log real (log_path)
    pra dar contexto pra IA -- sem isso a classificacao teria so o exit_code,
    sem saber o motivo."""
    arquivo = os.path.join(config.TAREFAS_TIMING_DIR, f"{task_id}.jsonl")
    if not os.path.exists(arquivo):
        return []
    corte = _desde_para_datetime(desde_iso)
    falhas = []
    for linha in open(arquivo, encoding="utf-8"):
        linha = linha.strip()
        if not linha:
            continue
        registro = json.loads(linha)
        if registro.get("exit_code", 0) == 0:
            continue
        inicio = datetime.fromisoformat(registro["inicio"])
        if inicio <= corte:
            continue
        registro["_trecho_log"] = ""
        if log_path and os.path.exists(log_path):
            try:
                with open(log_path, encoding="utf-8", errors="replace") as lf:
                    lf.seek(0, os.SEEK_END)
                    tamanho = lf.tell()
                    lf.seek(max(0, tamanho - 3000))
                    registro["_trecho_log"] = lf.read()
            except OSError:
                pass
        falhas.append(registro)
    return falhas


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

    # Item auto-resolvido por ser "sem risco" (ver _criar_item_novo) nunca
    # reabre sozinho, mesmo em categoria de REABRE_SEMPRE -- reincidir não
    # muda o fato de que a classificação já disse que não há ação/risco
    # nenhum a avaliar. Sem essa checagem, ruído de DDL idempotente (banco)
    # reabriria a cada reincidência, anulando a auto-resolução.
    if item_fields.get("IAPodeResolver") == "sem risco":
        return {}

    if categoria_do_item == "integracao":
        if qtd_no_lote > LIMITE_PICO_INTEGRACAO:
            return {"Status": "reaberto", "Fase": "detectado", "Reincidente": True}
        return {}  # instabilidade isolada esperada, não reabre
    if categoria_do_item == "usuario":
        return {}  # nunca reabre sozinho

    if categoria_do_item in REABRE_SEMPRE:
        return {"Status": "reaberto", "Fase": "detectado", "Reincidente": True}
    return {}


GRUPO_ADIADO = None  # sentinela: teto da rodada atingido ou tarefa escalada -- vai pro próximo lote


def processar_grupo(
    client: GraphClient,
    container: str,
    aplicacao_sugerida: str,
    msg_normalizada: str,
    exemplos_brutos: list[str],
    primeiro_timestamp: datetime,
    ultimo_timestamp: datetime,
    custo_acumulado: list,
    contador_classificacoes: list,
) -> dict | None:
    """Processa um grupo (mesma assinatura normalizada) visto neste lote.
    Devolve os campos usados pra gravar as linhas do Parquet — inclui
    Categoria/TipoErro/Criticidade/Status reais, não só CodErro/Aplicacao
    (bug corrigido em 2026-09-09: ficavam vazios, quebrando os filtros e o
    painel de contexto da app de visualização)."""
    qtd = len(exemplos_brutos)

    # Camada 2: busca exata (sem custo de IA).
    existente = client.buscar_por_assinatura(aplicacao_sugerida, msg_normalizada)
    if existente:
        fields = existente["fields"]
        cod_erro = fields["CodErro"]
        atualizacao = {
            "Ocorrencias": fields.get("Ocorrencias", 0) + qtd,
            "UltimaVez": ultimo_timestamp.isoformat(),
            "MensagemExemplo": exemplos_brutos[-1][:255],  # coluna SharePoint single-line, maxLength real e 255
        }
        status_atualizado = atualizacao.get("Status") or fields.get("Status")
        atualizacao.update(aplicar_matriz_reincidencia(fields, fields.get("Categoria"), qtd))
        status_atualizado = atualizacao.get("Status", status_atualizado)
        client.atualizar_item(existente["id"], atualizacao)
        log(f"  reincidência exata: {cod_erro} (+{qtd} ocorrências)")
        return {
            "cod_erro": cod_erro,
            "aplicacao": aplicacao_sugerida,
            "categoria": fields.get("Categoria", ""),
            "tipo_erro": fields.get("TipoErro", ""),
            "criticidade": fields.get("Criticidade", ""),
            "status": status_atualizado or "",
        }

    # Camada 2.5 (decisão 2026-09-15, pós-incidente de represamento de
    # backlog): ruído de DDL idempotente conhecido (relation/constraint/
    # type/... already exists) nunca é bug real -- classifica direto, sem
    # gastar chamada de IA nem entrar na fila do teto da Camada 3. Isso é
    # exatamente o padrão que causou o backlog de ontem (494 variações de
    # "already exists" de uma restauração de schema mal feita).
    if normalizador.eh_ruido_ddl_idempotente(exemplos_brutos[0]):
        log(f"  ruído de DDL idempotente (sem custo de IA): '{msg_normalizada[:80]}'")
        classificacao = {
            "eh_reincidencia_de": None,
            "aplicacao": aplicacao_sugerida,
            "categoria": "banco",
            "tipo_erro": "Ruído de DDL idempotente (objeto já existe)",
            "descricao_resumida": "Um script tentou recriar algo no banco que já existia — sem impacto real.",
            "criticidade": "baixa",
            "camada_investigacao": "schema_banco",
            "confianca": 8,
            "ia_pode_resolver": "sem risco",
            "diagnostico": (
                "Classificado automaticamente (sem chamada de IA) por regra "
                "determinística: mensagem bate com padrão conhecido de erro de "
                "DDL idempotente do Postgres (\"já existe\"), que só ocorre quando "
                "um script de criação de schema roda de novo sobre algo que já "
                "existe (falta de IF NOT EXISTS). Nunca representa perda de dados "
                "ou bug de aplicação — confiança 8 porque o padrão é inequívoco, "
                "não 9-10 porque nenhuma IA/humano confirmou o caso específico."
            ),
            "impacto_avaliado": "Não se aplica — não há correção de código a avaliar.",
            "correcao_proposta": (
                "Nenhuma ação necessária. Se esse padrão se repetir com frequência, "
                "vale adicionar IF NOT EXISTS / IF EXISTS ao script que gera esse DDL."
            ),
        }
        aplicacao_final = classificacao["aplicacao"]
        return _criar_item_novo(client, aplicacao_final, msg_normalizada, exemplos_brutos, qtd, primeiro_timestamp, ultimo_timestamp, classificacao)

    # Camada 3: sem match exato — classifica e checa semelhança semântica.
    if len(contador_classificacoes) >= LIMITE_CLASSIFICACOES_POR_RODADA:
        log(f"  teto de {LIMITE_CLASSIFICACOES_POR_RODADA} classificações da rodada "
            f"atingido — adiando '{msg_normalizada[:80]}' pro próximo lote")
        return GRUPO_ADIADO

    shortlist = client.listar_shortlist(aplicacao_sugerida)
    contador_classificacoes.append(1)
    try:
        classificacao = classificar(
            container=container,
            aplicacao_sugerida=aplicacao_sugerida,
            mensagem_normalizada=msg_normalizada,
            mensagem_bruta=exemplos_brutos[0],
            shortlist=shortlist,
        )
    except TarefaEscalada as exc:
        log(f"  ESCALADO: '{msg_normalizada[:80]}' — {exc.motivo}")
        registrar_escalonamento("coletor", msg_normalizada, exc.motivo, exc.diagnostico)
        if "rate limit" in exc.motivo:
            # Se bateu rate-limit, todas as próximas chamadas desta rodada
            # vão falhar do mesmo jeito -- para de tentar classificar coisa
            # nova agora em vez de bater na parede repetidas vezes.
            contador_classificacoes.extend([1] * LIMITE_CLASSIFICACOES_POR_RODADA)
        return GRUPO_ADIADO

    if classificacao.get("_custo_usd"):
        custo_acumulado.append(classificacao["_custo_usd"])
        custos.registrar("coletor", classificacao["_custo_usd"])

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
                status_atualizado = fields.get("Status")
                atualizacao.update(
                    aplicar_matriz_reincidencia(fields, fields.get("Categoria"), qtd)
                )
                status_atualizado = atualizacao.get("Status", status_atualizado)
                client.atualizar_item(item_completo["id"], atualizacao)
                log(f"  fundido via IA com {cod_erro_fundido} (+{qtd} ocorrências)")
                return {
                    "cod_erro": cod_erro_fundido,
                    "aplicacao": aplicacao_final,
                    "categoria": fields.get("Categoria", ""),
                    "tipo_erro": fields.get("TipoErro", ""),
                    "criticidade": fields.get("Criticidade", ""),
                    "status": status_atualizado or "",
                }
        log(f"  aviso: IA apontou fusão com {cod_erro_fundido} mas item não foi "
            f"reencontrado — criando novo por segurança")

    # Item genuinamente novo.
    return _criar_item_novo(
        client, aplicacao_final, msg_normalizada, exemplos_brutos, qtd,
        primeiro_timestamp, ultimo_timestamp, classificacao,
    )


def _criar_item_novo(
    client: GraphClient,
    aplicacao_final: str,
    msg_normalizada: str,
    exemplos_brutos: list[str],
    qtd: int,
    primeiro_timestamp: datetime,
    ultimo_timestamp: datetime,
    classificacao: dict,
) -> dict:
    """Cria o item novo na SharePoint List a partir de uma classificação já
    pronta -- usada tanto pelo resultado real da IA (Camada 3) quanto pela
    classificação determinística de ruído de DDL idempotente (Camada 2.5,
    sem custo de IA)."""
    cod_erro = gerar_cod_erro()
    novo_item = client.criar_item({
        "Title": classificacao["tipo_erro"][:255],
        "Aplicacao": aplicacao_final,
        # Nome interno real da coluna (acento em "Descrição" gerou esse
        # escape no SharePoint) — achado em teste real 2026-09-10, nunca
        # tinha sido exercitado porque os 8 itens de backfill usaram PATCH
        # manual direto com o nome certo, não passaram por criar_item().
        "Descri_x00e7__x00e3_oResumida": classificacao["descricao_resumida"].strip()[:150],
        "Categoria": classificacao["categoria"],
        "TipoErro": classificacao["tipo_erro"],
        "Assinatura": msg_normalizada[:255],  # coluna SharePoint single-line, maxLength real e 255 (achado 2026-09-14)
        "CodErro": cod_erro,
        "MensagemExemplo": exemplos_brutos[0][:255],  # coluna SharePoint single-line, maxLength real e 255
        "Ocorrencias": qtd,
        "PrimeiraVez": primeiro_timestamp.isoformat(),
        "UltimaVez": ultimo_timestamp.isoformat(),
        "Diagnostico": (
            classificacao["diagnostico"]
            + "\n\nImpacto avaliado: "
            + classificacao.get("impacto_avaliado", "(não informado)")
        ),
        "CorrecaoProposta": classificacao["correcao_proposta"],
        "Criticidade": classificacao["criticidade"],
        # Auto-resolução sem passar por aprovação humana (decisão 2026-09-15,
        # a pedido do analista): "sem risco" no vocabulário do prompt já
        # significa "não há ação/risco nenhum a avaliar" (ruído, não é bug de
        # verdade) -- exigir aprovação humana pra fechar algo que a própria
        # classificação diz não precisar de ação nenhuma só represa a fila
        # de revisão com itens que nunca deveriam ter chegado nela. Qualquer
        # outro grau de risco (seguro/mediano/alto risco) continua indo pro
        # fluxo normal de aprovação -- essa auto-resolução é só pro caso em
        # que não existe ação nenhuma proposta.
        "Fase": "resolvido" if classificacao["ia_pode_resolver"] == "sem risco" else "diagnosticado",
        "Status": "resolvido" if classificacao["ia_pode_resolver"] == "sem risco" else "aberto",
        "IAPodeResolver": classificacao["ia_pode_resolver"],
        "Confianca": classificacao["confianca"],
        "CamadaInvestigacao": classificacao["camada_investigacao"],
        "Reincidente": False,
    })
    cod_cat = gerar_cod_cat(novo_item["id"])
    client.atualizar_item(novo_item["id"], {"CodCat": cod_cat})
    log(f"  item novo criado: {cod_cat} / {cod_erro} ({classificacao['categoria']}, "
        f"criticidade={classificacao['criticidade']})")
    return {
        "cod_erro": cod_erro,
        "aplicacao": aplicacao_final,
        "categoria": classificacao["categoria"],
        "tipo_erro": classificacao["tipo_erro"],
        "criticidade": classificacao["criticidade"],
        "status": "aberto",
    }


LOCK_FILE = os.path.expanduser("~/itp-stack/catalogo-erros-coletor.lock")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--desde", default=None, help="Ex: 24h, 1h — ignora o state salvo")
    args = parser.parse_args()

    # Trava de execucao unica: sem isso, duas execucoes concorrentes do
    # coletor (ex: rodada manual + cron, ou duas sessoes ao mesmo tempo)
    # podem ler o mesmo log ANTES de qualquer uma escrever na SharePoint
    # List — a Camada 2 (busca exata) nao acha nada em nenhuma das duas,
    # e as duas criam item novo pro MESMO erro. Achado real (2026-09-11):
    # 1 ocorrencia virou 4 itens duplicados na lista (CAT-0016/18/20/23),
    # outra virou 2 (CAT-0017/22), mesmo timestamp/PID exatos no log.
    os.makedirs(os.path.dirname(LOCK_FILE), exist_ok=True)
    lock_fd = open(LOCK_FILE, "w")
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        log("outra execução do coletor já está rodando — saindo sem fazer nada")
        return

    cfg = config.carregar_env()
    client = GraphClient(cfg)
    state = carregar_state()
    agora = parquet_writer.agora_utc()
    custo_acumulado: list = []
    contador_classificacoes: list = []
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
            # Trunca já aqui, na origem — a coluna Assinatura da SharePoint
            # List tem limite real de 255 caracteres (confirmado via Graph
            # API columns em 2026-09-14 -- o comentario original dizia 500,
            # errado). Se truncássemos só na hora de gravar (e não na
            # comparação de dedup), uma mensagem longa nunca seria
            # reconhecida como reincidência (bug real, achado em revisão
            # 2026-09-09): a busca compararia a string inteira contra o que
            # foi salvo truncado, nunca batendo. Corrigido pra 255 em
            # 2026-09-14 -- com 500 aqui e 255 na gravacao real, o mesmo
            # problema podia se repetir (grupo de dedup diferente do que
            # foi persistido).
            assinatura = normalizador.normalizar(linha)[:255]
            grupos[assinatura].append(linha)
            ts = normalizador.extrair_timestamp(linha) or agora
            timestamps_por_grupo[assinatura].append(ts)

        houve_adiamento = False
        for msg_normalizada, exemplos in grupos.items():
            ts_grupo = sorted(timestamps_por_grupo[msg_normalizada])
            primeiro_ts, ultimo_ts = ts_grupo[0], ts_grupo[-1]

            # O site institucional (repo separado, SPA sem backend próprio)
            # reporta erro pro /frontend-logs do erp_itp, então cai junto
            # nos logs do erp_itp_backend — sem essa checagem, seria
            # classificado como Aplicacao=ITP por engano (achado 2026-09-11).
            aplicacao_do_grupo = (
                "SITE" if "[site-institucional]" in msg_normalizada else aplicacao_sugerida
            )

            resultado = processar_grupo(
                client=client,
                container=nome,
                aplicacao_sugerida=aplicacao_do_grupo,
                msg_normalizada=msg_normalizada,
                exemplos_brutos=exemplos,
                primeiro_timestamp=primeiro_ts,
                ultimo_timestamp=ultimo_ts,
                custo_acumulado=custo_acumulado,
                contador_classificacoes=contador_classificacoes,
            )
            if resultado is GRUPO_ADIADO:
                # Fica pendente pro próximo lote -- não avança o state deste
                # container, senão essas linhas de log somem sem nunca terem
                # sido processadas (docker logs --since não devolve o passado).
                houve_adiamento = True
                continue
            for ts_ocorrencia in ts_grupo:
                linhas_parquet.append({
                    "CodErro": resultado["cod_erro"],
                    "Aplicacao": resultado["aplicacao"],
                    "Categoria": resultado["categoria"],
                    "TipoErro": resultado["tipo_erro"],
                    "MensagemNormalizada": msg_normalizada,
                    "Criticidade": resultado["criticidade"],
                    "StatusNoMomento": resultado["status"],
                    "TimestampOcorrencia": ts_ocorrencia,
                    "FoiAutoCorrigido": False,
                })

        if not houve_adiamento:
            state[nome] = agora.isoformat()
        else:
            log(f"  {nome}: state não avançado (há grupo(s) adiado(s) pro próximo lote)")

    # Fonte 2: falhas de cron/tarefa (tarefas-timing/*.jsonl) -- mesmo
    # pipeline de classificacao+SharePoint dos containers, achado real
    # 2026-09-14: essas falhas nunca tinham visibilidade nenhuma fora do
    # jsonl bruto.
    for tarefa_cfg in carregar_registro_tarefas():
        task_id = tarefa_cfg["id"]
        state_key = f"tarefa:{task_id}"
        desde_iso = args.desde or state.get(state_key, "24h")
        log(f"Lendo falhas da tarefa {task_id} desde {desde_iso}...")
        falhas = falhas_da_tarefa(task_id, tarefa_cfg.get("log_path"), desde_iso)
        log(f"  {len(falhas)} execucao(oes) com falha")

        aplicacao_sugerida = "APRXM" if task_id.startswith("aprxm-") else "ITP"
        # Uma assinatura por tarefa (nao por execucao) -- falhas repetidas da
        # MESMA tarefa devem se agrupar/reincidir, nao virar item novo cada vez.
        msg_normalizada = f"Tarefa agendada '{task_id}' falhando (exit_code != 0)"
        exemplos = [
            f"tarefa={task_id} exit_code={f['exit_code']} inicio={f['inicio']} "
            f"duracao_s={f.get('duracao_s')}\n--- trecho do log ---\n{f['_trecho_log'][-1500:]}"
            for f in falhas
        ]
        adiado = False
        if exemplos:
            timestamps = sorted(datetime.fromisoformat(f["inicio"]) for f in falhas)
            resultado = processar_grupo(
                client=client,
                container=task_id,
                aplicacao_sugerida=aplicacao_sugerida,
                msg_normalizada=msg_normalizada,
                exemplos_brutos=exemplos,
                primeiro_timestamp=timestamps[0],
                ultimo_timestamp=timestamps[-1],
                custo_acumulado=custo_acumulado,
                contador_classificacoes=contador_classificacoes,
            )
            if resultado is GRUPO_ADIADO:
                adiado = True
            else:
                for ts_ocorrencia in timestamps:
                    linhas_parquet.append({
                        "CodErro": resultado["cod_erro"],
                        "Aplicacao": resultado["aplicacao"],
                        "Categoria": resultado["categoria"],
                        "TipoErro": resultado["tipo_erro"],
                        "MensagemNormalizada": msg_normalizada,
                        "Criticidade": resultado["criticidade"],
                        "StatusNoMomento": resultado["status"],
                        "TimestampOcorrencia": ts_ocorrencia,
                        "FoiAutoCorrigido": False,
                    })
        if not adiado:
            state[state_key] = agora.isoformat()
        else:
            log(f"  tarefa {task_id}: state não avançado (adiado pro próximo lote)")

    if linhas_parquet:
        arquivos = parquet_writer.agrupar_e_gravar(config.PARQUET_BASE_DIR, linhas_parquet)
        log(f"Parquet: {len(arquivos)} arquivo(s) gravado(s), {len(linhas_parquet)} linha(s) no total")

    salvar_state(state)

    if custo_acumulado:
        log(f"Custo estimado de IA nesta execução: ${sum(custo_acumulado):.4f} "
            f"({len(custo_acumulado)} chamada(s) ao Claude)")
    teto_atingido = len(contador_classificacoes) >= LIMITE_CLASSIFICACOES_POR_RODADA
    log(f"Classificações desta rodada: {min(len(contador_classificacoes), LIMITE_CLASSIFICACOES_POR_RODADA)}"
        f"/{LIMITE_CLASSIFICACOES_POR_RODADA}")
    _escrever_metrica_teto(teto_atingido)
    log("Coleta concluída.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        log(f"ERRO FATAL: {exc}")
        sys.exit(1)

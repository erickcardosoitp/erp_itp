"""Memória do dia pra erros de criticidade baixa/média (decisão
2026-09-15, a pedido do analista): esses erros não vão pro SharePoint em
tempo real -- só ao consolidar no fim do dia (ver consolidar_diario.py).

Sem essa memória local, o mesmo erro baixo/médio recorrendo várias vezes
no mesmo dia seria reclassificado pela IA a cada ocorrência -- a Camada 2
real (busca exata no SharePoint) só acharia "já existe" depois que o item
fosse de fato criado lá, ou seja, só no dia seguinte. Isso reabriria o
problema de custo/backlog corrigido mais cedo no mesmo dia (Camada 2.5 +
teto de 5/rodada).

Formato: JSON, chave = "{aplicacao}::{msg_normalizada}", valor = tudo que
_criar_item_novo() (coletor.py) precisa pra criar o item de verdade na
consolidação, mais qtd/timestamps acumulados do dia inteiro.
"""
from __future__ import annotations

import json
import os

STAGING_PATH = os.path.expanduser("~/itp-stack/catalogo-erros-staging-dia.json")


def _chave(aplicacao: str, msg_normalizada: str) -> str:
    return f"{aplicacao}::{msg_normalizada}"


def _ler() -> dict:
    try:
        return json.load(open(STAGING_PATH, encoding="utf-8"))
    except Exception:
        return {}


def _salvar(dados: dict) -> None:
    os.makedirs(os.path.dirname(STAGING_PATH), exist_ok=True)
    tmp = STAGING_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)
    os.replace(tmp, STAGING_PATH)  # atômico, mesmo padrão do resto do projeto


def buscar(aplicacao: str, msg_normalizada: str) -> dict | None:
    return _ler().get(_chave(aplicacao, msg_normalizada))


def atualizar_existente(aplicacao: str, msg_normalizada: str, qtd: int, ultimo_timestamp_iso: str, exemplo: str) -> None:
    dados = _ler()
    chave = _chave(aplicacao, msg_normalizada)
    entrada = dados.get(chave)
    if not entrada:
        return  # defesa: se sumiu entre o buscar() e aqui, não quebra
    entrada["qtd"] += qtd
    entrada["ultimo_timestamp"] = ultimo_timestamp_iso
    entrada["exemplo"] = exemplo[:255]
    dados[chave] = entrada
    _salvar(dados)


def criar(
    aplicacao: str, msg_normalizada: str, classificacao: dict, cod_erro: str,
    qtd: int, primeiro_timestamp_iso: str, ultimo_timestamp_iso: str, exemplo: str,
) -> None:
    dados = _ler()
    dados[_chave(aplicacao, msg_normalizada)] = {
        "aplicacao": aplicacao,
        "msg_normalizada": msg_normalizada,
        "classificacao": classificacao,
        "cod_erro": cod_erro,
        "qtd": qtd,
        "primeiro_timestamp": primeiro_timestamp_iso,
        "ultimo_timestamp": ultimo_timestamp_iso,
        "exemplo": exemplo[:255],
    }
    _salvar(dados)


def listar_tudo() -> dict:
    return _ler()


def limpar() -> None:
    _salvar({})

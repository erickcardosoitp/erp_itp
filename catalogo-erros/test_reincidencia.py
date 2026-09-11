"""Testes da matriz de reincidência (coletor.py::aplicar_matriz_reincidencia).

Rodar: python3 -m unittest test_reincidencia.py -v

Sem dependência externa de propósito (sem pytest) — só stdlib, pra não
exigir instalar nada a mais na VM só pra rodar teste.
"""
import unittest

from coletor import aplicar_matriz_reincidencia, LIMITE_PICO_INTEGRACAO, REABRE_SEMPRE
from claude_client import CATEGORIAS_VALIDAS


class TestMatrizReincidencia(unittest.TestCase):
    def item_resolvido(self):
        return {"Status": "resolvido"}

    # ── Guarda de entrada: só mexe se já estava resolvido ──────────────
    def test_nao_mexe_se_status_nao_e_resolvido(self):
        for status in ["aberto", "reaberto", "conhecido", "descartado", None]:
            with self.subTest(status=status):
                r = aplicar_matriz_reincidencia({"Status": status}, "banco", qtd_no_lote=99)
                self.assertEqual(r, {})

    # ── REABRE_SEMPRE: reabre em qualquer volume, mesmo 1 ocorrência ───
    def test_categorias_reabre_sempre_reabrem_com_1_ocorrencia(self):
        for categoria in REABRE_SEMPRE:
            with self.subTest(categoria=categoria):
                r = aplicar_matriz_reincidencia(self.item_resolvido(), categoria, qtd_no_lote=1)
                self.assertEqual(r.get("Status"), "reaberto")
                self.assertEqual(r.get("Fase"), "detectado")
                self.assertTrue(r.get("Reincidente"))

    def test_REABRE_SEMPRE_bate_com_categorias_reais_do_classificador(self):
        """Regressão do bug real (2026-09-11): REABRE_SEMPRE usava grafia
        antiga ('codigo'/'seguranca'/'outros') que nunca batia com os
        valores reais que o Claude de fato atribui ('código'/'security'/
        'terceiros') - reincidência dessas categorias nunca reabria um
        item resolvido, silenciosamente. Este teste falha se qualquer
        entrada de REABRE_SEMPRE não for uma categoria real."""
        for categoria in REABRE_SEMPRE:
            self.assertIn(
                categoria, CATEGORIAS_VALIDAS,
                f"'{categoria}' em REABRE_SEMPRE não é uma categoria real "
                f"do classificador — reincidência dela nunca vai reabrir nada",
            )

    # ── usuario: nunca reabre sozinho ───────────────────────────────────
    def test_usuario_nunca_reabre(self):
        for qtd in [1, 5, 6, 100]:
            with self.subTest(qtd=qtd):
                r = aplicar_matriz_reincidencia(self.item_resolvido(), "usuario", qtd_no_lote=qtd)
                self.assertEqual(r, {})

    # ── integracao: só reabre acima do limite de pico ───────────────────
    def test_integracao_nao_reabre_ate_o_limite(self):
        for qtd in range(1, LIMITE_PICO_INTEGRACAO + 1):
            with self.subTest(qtd=qtd):
                r = aplicar_matriz_reincidencia(self.item_resolvido(), "integracao", qtd_no_lote=qtd)
                self.assertEqual(r, {}, f"não deveria reabrir com {qtd} ocorrências (limite={LIMITE_PICO_INTEGRACAO})")

    def test_integracao_reabre_acima_do_limite(self):
        r = aplicar_matriz_reincidencia(self.item_resolvido(), "integracao", qtd_no_lote=LIMITE_PICO_INTEGRACAO + 1)
        self.assertEqual(r.get("Status"), "reaberto")
        self.assertEqual(r.get("Fase"), "detectado")
        self.assertTrue(r.get("Reincidente"))

    # ── categoria desconhecida: comportamento seguro (não reabre) ───────
    def test_categoria_desconhecida_nao_reabre(self):
        r = aplicar_matriz_reincidencia(self.item_resolvido(), "categoria-que-nao-existe", qtd_no_lote=99)
        self.assertEqual(r, {})


if __name__ == "__main__":
    unittest.main()

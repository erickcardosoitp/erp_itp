"""Filtro de sessão manual do Postgres em coletor.extrair_erros.

Rodar: python3 -m unittest test_extrair_erros.py -v
"""
import unittest

from coletor import extrair_erros

APP = '2026-09-29 02:19:59.928 UTC [253412] app=| ERROR:  column "x" does not exist'
MANUAL = '2026-09-29 02:19:59.928 UTC [253412] app=psql| ERROR:  column r.phone does not exist'
PGADMIN = '2026-09-29 02:19:59.928 UTC [253412] app=pgAdmin 4 - DB:aprxm_db| ERROR:  syntax error'
ANTIGO = '2026-09-29 02:19:59.928 UTC [253412] ERROR:  column "x" does not exist'


class TestExtrairErros(unittest.TestCase):
    def test_descarta_sessao_manual(self):
        self.assertEqual(extrair_erros(MANUAL + "\n" + PGADMIN), [])

    def test_erro_do_sistema_fica_com_a_mesma_assinatura_de_antes(self):
        self.assertEqual(extrair_erros(APP), [ANTIGO])

    def test_log_sem_marcador_nao_muda(self):
        self.assertEqual(extrair_erros(ANTIGO), [ANTIGO])


if __name__ == "__main__":
    unittest.main()

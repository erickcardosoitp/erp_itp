/**
 * Número de matrícula: ITP-AAAA-MMDD + sequencial do dia, sem zeros à
 * esquerda (ex.: ITP-2026-08201). Formato mantido de propósito: já sai
 * impresso em documentos (decisão 2026-09-29).
 *
 * O sequencial é o MAIOR já emitido no dia + 1. Antes era COUNT(*) + 1: depois
 * de excluir uma matrícula do dia, o próximo número repetia um existente e a
 * gravação falhava no índice único alunos_numero_matricula_key.
 */
export async function gerarNumeroMatricula(
  runner: { query: (sql: string, params?: unknown[]) => Promise<any[]> },
  hoje: Date = new Date(),
): Promise<string> {
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  const prefixo = `ITP-${hoje.getFullYear()}-${mes}${dia}`;

  // Serializa emissões concorrentes do mesmo dia (vale dentro de transação).
  await runner.query('SELECT pg_advisory_xact_lock(hashtext($1))', [prefixo]);

  const [{ ultimo }] = await runner.query(
    `SELECT COALESCE(MAX(CAST(substring(numero_matricula FROM $2::int) AS INTEGER)), 0) AS ultimo
       FROM alunos
      WHERE numero_matricula LIKE $1
        AND substring(numero_matricula FROM $2::int) ~ '^[0-9]+$'`,
    [`${prefixo}%`, prefixo.length + 1],
  );
  return `${prefixo}${Number(ultimo) + 1}`;
}

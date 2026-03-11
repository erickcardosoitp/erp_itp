const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_qEAt05zJicRn@ep-wispy-tooth-aihlvt7v-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';

const db = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
db.connect().then(async () => {
  // Verificar se a coluna aluno_id existe na tabela inscricoes
  const cols = await db.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'inscricoes'
    ORDER BY ordinal_position
  `);
  console.log('\n=== Colunas de inscricoes ===');
  cols.rows.forEach(r => console.log(r.column_name, '|', r.data_type, '| nullable:', r.is_nullable));

  // Verificar se a tabela alunos existe
  const tabelas = await db.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);
  console.log('\n=== Tabelas ===');
  tabelas.rows.forEach(r => console.log(r.tablename));

  // Verificar coluna id de alunos
  const alunosCols = await db.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'alunos' ORDER BY ordinal_position
  `);
  console.log('\n=== Colunas de alunos ===');
  alunosCols.rows.forEach(r => console.log(r.column_name, '|', r.data_type));

  // Tentar fazer o query que listarTodas() faz
  try {
    const r = await db.query(`
      SELECT i.*, a.id as "aluno_id_val", a.matricula, a.nome as aluno_nome
      FROM inscricoes i
      LEFT JOIN alunos a ON a.id::text = i.aluno_id::text
      ORDER BY i.created_at DESC
      LIMIT 3
    `);
    console.log('\n=== Query listarTodas simulado: OK, linhas:', r.rowCount, '===');
  } catch (e) {
    console.error('\n=== ERRO na query:', e.message, '===');
  }

  await db.end();
}).catch(e => console.error(e.message));

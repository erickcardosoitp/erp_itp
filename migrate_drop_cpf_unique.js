/**
 * Migração: remove a constraint UNIQUE do campo cpf na tabela inscricoes
 * para permitir múltiplas inscrições por CPF (desde que apenas uma esteja ativa).
 *
 * Run: node migrate_drop_cpf_unique.js
 */
require('dotenv').config();
const { Client } = require('pg');

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('❌ DATABASE_URL não definida!');
  process.exit(1);
}

async function migrate() {
  const db = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  console.log('✅ Conectado ao banco');

  // Busca o nome real da constraint unique no cpf (TypeORM gera nome com hash)
  const res = await db.query(`
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'inscricoes'::regclass
      AND contype = 'u'
      AND conname ILIKE '%cpf%'
  `);

  if (res.rows.length === 0) {
    console.log('ℹ️  Nenhuma constraint UNIQUE encontrada no cpf de inscricoes — pode já ter sido removida.');
  } else {
    for (const row of res.rows) {
      await db.query(`ALTER TABLE inscricoes DROP CONSTRAINT IF EXISTS "${row.conname}"`);
      console.log(`✅ Constraint "${row.conname}" removida de inscricoes.cpf`);
    }
  }

  // Garante que não haja outro índice unique no cpf
  const idxRes = await db.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'inscricoes'
      AND indexname ILIKE '%cpf%'
      AND indexdef ILIKE '%unique%'
  `);

  for (const row of idxRes.rows) {
    await db.query(`DROP INDEX IF EXISTS "${row.indexname}"`);
    console.log(`✅ Índice único "${row.indexname}" removido de inscricoes.cpf`);
  }

  await db.end();
  console.log('✅ Migração concluída — CPF agora permite múltiplas inscrições (controle por status no backend).');
}

migrate().catch(e => { console.error('❌', e.message); process.exit(1); });

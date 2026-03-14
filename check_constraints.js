require('dotenv').config();
const { Client } = require('pg');
const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
db.connect().then(async () => {
  const r = await db.query(
    "SELECT conname, pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conrelid = 'inscricoes'::regclass AND contype = 'u'"
  );
  console.log('Constraints únicas em inscricoes:', JSON.stringify(r.rows, null, 2));
  const i = await db.query(
    "SELECT indexname, indexdef FROM pg_indexes WHERE tablename='inscricoes' AND indexdef ILIKE '%unique%'"
  );
  console.log('Índices únicos em inscricoes:', JSON.stringify(i.rows, null, 2));
  await db.end();
}).catch(e => { console.error(e.message); process.exit(1); });

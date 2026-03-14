require('dotenv').config();
const { Client } = require('pg');
const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
db.connect().then(async () => {
  await db.query('ALTER TABLE inscricoes DROP CONSTRAINT IF EXISTS "UQ_94496759640c1197071a9a63d7b"');
  console.log('✅ Constraint UQ_94496759640c1197071a9a63d7b removida de inscricoes.cpf');
  await db.end();
  console.log('✅ Pronto — CPF agora permite múltiplas inscrições.');
}).catch(e => { console.error(e.message); process.exit(1); });

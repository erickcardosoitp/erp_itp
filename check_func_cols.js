require('dotenv').config();
const { Client } = require('pg');
const db = new Client({ connectionString: process.env.DATABASE_URL });
db.connect().then(async () => {
  // Colunas da tabela funcionarios
  const cols = await db.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'funcionarios'
    ORDER BY ordinal_position
  `);
  console.log('=== COLUNAS DA TABELA funcionarios ===');
  cols.rows.forEach(c => console.log(c.column_name.padEnd(30), c.data_type.padEnd(16), c.is_nullable));
  
  // Primeiro funcionário cadastrado para ver o que foi salvo
  const sample = await db.query(`SELECT * FROM funcionarios LIMIT 1`);
  if (sample.rows.length > 0) {
    console.log('\n=== AMOSTRA DE REGISTRO ===');
    const row = sample.rows[0];
    Object.entries(row).forEach(([k,v]) => console.log(k.padEnd(30), JSON.stringify(v)));
  }
  await db.end();
}).catch(e => { console.error(e.message); process.exit(1); });

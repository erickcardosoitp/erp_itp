require('dotenv').config();
const { Client } = require('pg');
const db = new Client({ connectionString: process.env.DATABASE_URL });
db.connect().then(async () => {
  const r = await db.query('SELECT id, nome, email, matricula, role FROM usuarios ORDER BY role DESC');
  r.rows.forEach(u => console.log(JSON.stringify(u)));
  await db.end();
}).catch(e => { console.error(e.message); process.exit(1); });

require('dotenv').config();
const { Client } = require('pg');
const db = new Client({ connectionString: process.env.DATABASE_URL });
db.connect().then(async () => {
  const r = await db.query(`
    SELECT nome, raca_cor, numero_residencia, telefone_emergencia_1, logradouro, bairro, complemento, matricula
    FROM funcionarios ORDER BY created_at
  `);
  console.log('=== CAMPOS SUSPEITOS ===');
  r.rows.forEach(f => {
    const campos = {
      raca_cor: f.raca_cor,
      num_res: f.numero_residencia,
      tel_1: f.telefone_emergencia_1,
      logradouro: f.logradouro,
      bairro: f.bairro,
      complemento: f.complemento,
      matricula: f.matricula,
    };
    const nulls = Object.entries(campos).filter(([,v]) => v === null).map(([k]) => k);
    console.log(f.nome.padEnd(45), nulls.length > 0 ? 'NULOS: ' + nulls.join(', ') : '✓ ok');
  });
  await db.end();
}).catch(e => { console.error(e.message); process.exit(1); });

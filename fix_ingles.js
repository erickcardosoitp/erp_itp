const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_qEAt05zJicRn@ep-wispy-tooth-aihlvt7v-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';
const db = new Client({ connectionString: DATABASE_URL, ssl:{ rejectUnauthorized:false } });

db.connect().then(async () => {
  // Fix Ingês (missing 'l') → Inglês
  const r1 = await db.query(
    "UPDATE inscricoes SET cursos_desejados = REPLACE(cursos_desejados, 'Ingês', 'Inglês') WHERE cursos_desejados LIKE '%Ingês%'"
  );
  console.log('Ingês fixed:', r1.rowCount);

  // Verify final state
  const r2 = await db.query('SELECT cursos_desejados FROM inscricoes WHERE cursos_desejados IS NOT NULL');
  const all = new Map();
  for(const row of r2.rows){
    const parts = row.cursos_desejados.split(/[,;]/).map(s=>s.trim()).filter(Boolean);
    for(const p of parts){ all.set(p, (all.get(p)||0)+1); }
  }
  const sorted=[...all.entries()].sort((a,b)=>b[1]-a[1]);
  console.log('\nResultado final:');
  sorted.forEach(([k,v])=>console.log(v+' | '+k));
  await db.end();
}).catch(e=>console.error(e.message));

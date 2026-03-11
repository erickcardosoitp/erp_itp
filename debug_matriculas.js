const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_qEAt05zJicRn@ep-wispy-tooth-aihlvt7v-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';
const http = require('http');

const db = new Client({ connectionString: DATABASE_URL, ssl:{ rejectUnauthorized:false } });
db.connect().then(async () => {
  const r = await db.query('SELECT email, role FROM usuarios LIMIT 5');
  console.log('Usuários:', JSON.stringify(r.rows));
  await db.end();
  
  if (!r.rows.length) { console.log('Sem usuários!'); return; }
  const email = r.rows[0].email;
  
  // Tentar login com cada usuário
  const tryLogin = (email, pass) => new Promise((resolve) => {
    const body = JSON.stringify({ email, password: pass });
    const req = http.request({ hostname:'localhost', port:3001, path:'/api/auth/login', method:'POST', headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)} }, res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({ status: res.statusCode, body: JSON.parse(d) }));
    }); req.write(body); req.end();
  });
  
  let loginResult;
  for (const user of r.rows) {
    loginResult = await tryLogin(user.email, 'admin123');
    if (loginResult.status === 200) { console.log('Login ok:', user.email); break; }
    loginResult = await tryLogin(user.email, '123456');
    if (loginResult.status === 200) { console.log('Login ok:', user.email); break; }
  }
  
  if (!loginResult || loginResult.status !== 200) {
    console.log('Não consegui login. Testando endpoint sem auth...');
    http.get({ hostname:'localhost', port:3001, path:'/api/matriculas' }, res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>console.log('sem auth:', res.statusCode, d.slice(0,200)));
    });
    return;
  }
  
  const token = loginResult.body.access_token;
  const getReq = http.get({ hostname:'localhost', port:3001, path:'/api/matriculas', headers:{'Authorization':'Bearer '+token} }, res => {
    let d=''; res.on('data',c=>d+=c); res.on('end',()=>console.log('matriculas:', res.statusCode, d.slice(0,500)));
  });
  getReq.on('error', e => console.log('err:', e.message));
}).catch(e=>console.error(e.message));

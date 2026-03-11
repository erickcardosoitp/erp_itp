const { Client } = require('pg');
const http = require('http');
const DATABASE_URL = 'postgresql://neondb_owner:npg_qEAt05zJicRn@ep-wispy-tooth-aihlvt7v-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';

const makeRequest = (options, body) => new Promise((resolve, reject) => {
  const req = http.request(options, res => {
    let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d }));
  });
  req.on('error', reject);
  if (body) req.write(body);
  req.end();
});

async function main() {
  // Login
  const loginBody = JSON.stringify({ email: 'goncalvecardoso@gmail.com', password: 'admin123' });
  const lr = await makeRequest({ hostname:'localhost', port:3001, path:'/api/auth/login', method:'POST', headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(loginBody)} }, loginBody);
  const loginData = JSON.parse(lr.body);
  
  if (!loginData.access_token) {
    console.error('Login failed:', lr.body.slice(0,200));
    return;
  }
  
  const token = loginData.access_token;
  console.log('Login OK, role:', loginData.usuario?.role || 'n/a');
  
  // Test cursos-disponiveis (new static endpoint)
  const cr = await makeRequest({ hostname:'localhost', port:3001, path:'/api/matriculas/cursos-disponiveis', headers:{'Authorization':'Bearer '+token} }, null);
  console.log('\ncursos-disponiveis status:', cr.status);
  if (cr.status === 200) {
    const cursos = JSON.parse(cr.body);
    console.log('Cursos:', cursos);
    console.log('É lista estática?', cursos.includes('Ballet Clássico') && cursos.includes('Jiu-Jitsu') ? 'SIM ✓' : 'NÃO - ainda usa banco');
  } else {
    console.log('Erro:', cr.body.slice(0, 200));
  }
  
  // Test matriculas
  const mr = await makeRequest({ hostname:'localhost', port:3001, path:'/api/matriculas', headers:{'Authorization':'Bearer '+token} }, null);
  console.log('\nmatriculas status:', mr.status);
  if (mr.status === 200) {
    const data = JSON.parse(mr.body);
    console.log('Total registros:', data.length);
  } else {
    console.log('Erro matriculas:', mr.body.slice(0, 300));
  }
}
main().catch(e => console.error(e.message));

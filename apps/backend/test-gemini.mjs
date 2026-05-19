/**
 * Teste de conectividade com a API REST do Gemini
 * Uso: GEMINI_API_KEY=sua_chave node test-gemini.mjs
 *   ou: adicione ao .env e rode: node -e "require('dotenv').config({path:'.env'})" test-gemini.mjs
 */
import { readFileSync } from 'fs';

// Tenta ler .env manualmente
try {
  const env = readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length && !process.env[key.trim()]) {
      process.env[key.trim()] = rest.join('=').trim();
    }
  }
} catch {}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const key = process.env.GEMINI_API_KEY;

if (!key) {
  console.error('\n❌ GEMINI_API_KEY não encontrada no .env nem no ambiente.\n');
  console.log('Como obter a chave:');
  console.log('1. Acesse: https://aistudio.google.com/');
  console.log('2. Clique em "Get API key" → "Create API key"');
  console.log('3. Adicione ao apps/backend/.env:  GEMINI_API_KEY=sua_chave\n');
  process.exit(1);
}

console.log(`\n🔑 Chave encontrada: ${key.slice(0, 8)}...${key.slice(-4)}`);
console.log('📡 Chamando Gemini 2.0 Flash com Google Search...\n');

const body = {
  contents: [{ role: 'user', parts: [{ text: 'Qual o CNPJ do Instituto Tia Pretinha, Rio de Janeiro? Responda em 1 linha.' }] }],
};

try {
  const res = await fetch(`${GEMINI_BASE}/gemini-2.0-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  console.log('✅ Gemini respondeu:');
  console.log(`   "${text}"\n`);
  console.log('✅ API funcionando corretamente!\n');
  console.log('Próximo passo: adicionar GEMINI_API_KEY nas variáveis de ambiente do Vercel:');
  console.log('  https://vercel.com → Projeto erp-itp-38am → Settings → Environment Variables\n');
} catch (err) {
  console.error(`\n❌ Erro: ${err.message}\n`);
  process.exit(1);
}

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

const key = process.env.GEMINI_API_KEY;

if (!key) {
  console.error('\n❌ GEMINI_API_KEY não encontrada no .env\n');
  process.exit(1);
}

const isOpenRouter = key.startsWith('sk-or-');
console.log(`\n🔑 Provedor: ${isOpenRouter ? 'OpenRouter' : 'Google Gemini nativo'}`);
console.log(`📡 Testando conexão...\n`);

const prompt = 'Responda em uma linha: qual é a capital do Rio de Janeiro?';

try {
  let res, data, text;

  if (isOpenRouter) {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': 'https://itp.institutotiapretinha.org',
        'X-Title': 'ERP ITP',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat-v3-0324',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    data = await res.json();
    text = data?.choices?.[0]?.message?.content ?? '';
  } else {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    data = await res.json();
    text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  if (!text) throw new Error('Resposta vazia');
  console.log(`✅ Resposta: "${text.trim()}"\n`);
  console.log('✅ API funcionando! Já pode usar a busca no sistema.\n');
  if (isOpenRouter) {
    console.log('⚠️  OpenRouter: Google Search grounding indisponível.');
    console.log('   A IA usará conhecimento de treinamento (não pesquisa em tempo real).\n');
  }
} catch (err) {
  console.error(`\n❌ Erro: ${err.message}\n`);
  process.exit(1);
}

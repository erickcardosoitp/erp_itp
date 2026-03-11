// Script de normalização dos nomes de cursos em inscricoes.cursos_desejados
const { Client } = require('pg');

const DATABASE_URL =
  'postgresql://neondb_owner:npg_qEAt05zJicRn@ep-wispy-tooth-aihlvt7v-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';

// ────────────────────────────────────────────────────────────────────────────
// Regras de normalização, aplicadas em ordem (primeiro match vence).
// Cada regra pode produzir 1 ou N nomes canônicos.
// ────────────────────────────────────────────────────────────────────────────
const RULES = [
  // Compostos que precisam ser divididos em dois cursos
  { pattern: /^refor[çc]o\s+escolar\s+e\s+ball?[eé]t?(\s+cl[aá]ssico)?$/i,  out: ['Reforço Escolar', 'Ballet Clássico'] },
  { pattern: /^refor[çc]o\s+escolar\s+e\s+jiu[-\s]?j[ui]tsu$/i,             out: ['Reforço Escolar', 'Jiu-Jitsu'] },
  { pattern: /^v[oô]lei?\s+e\s+inform[aá]tica\.?$/i,                         out: ['Vôlei', 'Informática'] },

  // Jiu-Jitsu
  { pattern: /^jiu[-\s]?j[ui]tsu$/i,                                          out: ['Jiu-Jitsu'] },

  // Reforço Escolar
  { pattern: /^(projeto\s+de\s+)?refor[çc]o(\s+escolar)?$/i,                 out: ['Reforço Escolar'] },

  // Futebol
  { pattern: /^futebol$/i,                                                     out: ['Futebol'] },

  // Inglês
  { pattern: /^(aulas?\s+de\s+)?ingl[eê]s$/i,                                out: ['Inglês'] },

  // Ballet Clássico (todos os tipos de ballet → canonical único)
  { pattern: /^(projeto\s+de\s+)?ball?[eé]t?(\s+cl[aá]ssico)?$/i,            out: ['Ballet Clássico'] },
  { pattern: /^bal[eé]$/i,                                                     out: ['Ballet Clássico'] },

  // Informática
  { pattern: /^inform[aá]tica\.?$/i,                                           out: ['Informática'] },

  // Música
  { pattern: /^(projeto\s+de\s+)?m[úu]sica$/i,                               out: ['Música'] },

  // Capoeira
  { pattern: /^capoeira$/i,                                                    out: ['Capoeira'] },

  // Beleza e Massagem
  { pattern: /^(projeto\s+de\s+)?beleza[\s\/]+(?:e\s+)?massagem$/i,           out: ['Beleza e Massagem'] },

  // Danças Contemporâneas
  { pattern: /^dan[çc]as?\s+contempor[aâ]neas?$/i,                           out: ['Danças Contemporâneas'] },

  // Pré-Vestibular  (com typo: vestivular)
  { pattern: /^pr[eé][- ]?vesti[vb]ular$/i,                                   out: ['Pré-Vestibular'] },

  // Dança do Ventre
  { pattern: /^dan[çc]a\s+do\s+ventre$/i,                                     out: ['Dança do Ventre'] },

  // Jazz
  { pattern: /^jazz$/i,                                                        out: ['Jazz'] },

  // Vôlei
  { pattern: /^v[oô]lei?$/i,                                                   out: ['Vôlei'] },

  // Remover "Outros" e variantes
  { pattern: /^outros?:?.*/i,                                                  out: [] },
];

function normalizeCurso(part) {
  const trimmed = part.trim();
  if (!trimmed) return [];
  for (const rule of RULES) {
    if (rule.pattern.test(trimmed)) return rule.out;
  }
  console.warn(`  ⚠  Sem match: "${trimmed}"`);
  return [trimmed]; // mantém sem alteração
}

function normalizarLinha(raw) {
  if (!raw) return null;
  const parts = raw.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  const seen = new Set();
  for (const p of parts) {
    for (const canon of normalizeCurso(p)) {
      seen.add(canon);
    }
  }
  return seen.size > 0 ? [...seen].join(', ') : null;
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Conectado ao banco\n');

  const { rows } = await client.query(
    'SELECT id, cursos_desejados FROM inscricoes WHERE cursos_desejados IS NOT NULL ORDER BY id'
  );
  console.log(`📋 ${rows.length} linhas encontradas\n`);

  let updated = 0;
  for (const row of rows) {
    const novo = normalizarLinha(row.cursos_desejados);
    if (novo !== row.cursos_desejados) {
      console.log(`  [${row.id}] "${row.cursos_desejados}" → "${novo}"`);
      await client.query('UPDATE inscricoes SET cursos_desejados = $1 WHERE id = $2', [novo, row.id]);
      updated++;
    }
  }

  console.log(`\n✅ ${updated} registro(s) atualizado(s).`);
  await client.end();
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });

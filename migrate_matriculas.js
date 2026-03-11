/**
 * Migração: adiciona coluna `matricula` nas tabelas `funcionarios` e `usuarios`
 * Run: node migrate_matriculas.js
 */
require('dotenv').config();
const { Client } = require('pg');

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('❌ DATABASE_URL não definida!');
  process.exit(1);
}

async function migrate() {
  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  console.log('✅ Conectado ao banco');

  // Tabela funcionarios
  await db.query(`ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS matricula TEXT UNIQUE`);
  console.log('✅ funcionarios.matricula adicionada');

  // Tabela usuarios
  await db.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS matricula TEXT UNIQUE`);
  console.log('✅ usuarios.matricula adicionada');

  await db.end();
  console.log('✅ Migração concluída!');
}

migrate().catch(e => { console.error('❌', e.message); process.exit(1); });

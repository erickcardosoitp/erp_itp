// Script de migração para adicionar colunas academico
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Iniciando migração...');

    await client.query('ALTER TABLE materias ADD COLUMN IF NOT EXISTS codigo VARCHAR(30)');
    console.log('✓ materias.codigo adicionada');

    await client.query('ALTER TABLE materias ADD COLUMN IF NOT EXISTS descricao TEXT');
    console.log('✓ materias.descricao adicionada');

    await client.query('ALTER TABLE turmas ADD COLUMN IF NOT EXISTS codigo VARCHAR(30)');
    console.log('✓ turmas.codigo adicionada');

    console.log('Migração concluída com sucesso!');
  } catch (err) {
    console.error('Erro na migração:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();

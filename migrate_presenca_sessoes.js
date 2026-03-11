/**
 * Migração — Cria tabela presenca_sessoes e adiciona sessao_id em diario_academico
 * Instituto Tia Pretinha
 *
 * Execução: node migrate_presenca_sessoes.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Iniciando migração: presenca_sessoes...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS presenca_sessoes (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        turma_id          VARCHAR NOT NULL,
        turma_nome        VARCHAR,
        data              DATE NOT NULL,
        tema_aula         VARCHAR,
        conteudo_abordado TEXT,
        usuario_id        VARCHAR,
        usuario_nome      VARCHAR,
        total_presentes   INTEGER NOT NULL DEFAULT 0,
        total_ausentes    INTEGER NOT NULL DEFAULT 0,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✓ Tabela presenca_sessoes criada (ou já existia)');

    await client.query(`
      ALTER TABLE diario_academico
        ADD COLUMN IF NOT EXISTS sessao_id VARCHAR;
    `);
    console.log('✓ Coluna sessao_id adicionada em diario_academico');

    console.log('Migração concluída com sucesso!');
  } catch (err) {
    console.error('Erro na migração:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();

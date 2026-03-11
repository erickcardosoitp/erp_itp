/**
 * Migração — Cria a tabela grade_horaria
 * Instituto Tia Pretinha
 *
 * Execução:
 *   node migrate_grade_horaria.js
 *
 * A variável DATABASE_URL deve estar definida no .env raiz.
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
    console.log('Iniciando migração: grade_horaria...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS grade_horaria (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dia_semana    INTEGER,
        horario_inicio TIME NOT NULL,
        horario_fim    TIME NOT NULL,
        materia_id     VARCHAR,
        nome_curso     VARCHAR,
        professor_id   VARCHAR,
        nome_professor VARCHAR,
        turma_id       VARCHAR,
        sala           VARCHAR,
        cor            VARCHAR NOT NULL DEFAULT '#7c3aed'
      );
    `);
    console.log('✓ Tabela grade_horaria criada (ou já existia)');

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

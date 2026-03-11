import * as dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config();

const DB_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_qEAt05zJicRn@ep-wispy-tooth-aihlvt7v-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function migrate() {
  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  console.log('✅ Conectado');

  await db.query(`ALTER TABLE inscricoes ADD COLUMN IF NOT EXISTS data_inscricao TIMESTAMP`);
  console.log('✅ data_inscricao adicionada');

  await db.query(`
    CREATE TABLE IF NOT EXISTS inscricao_anotacoes (
      id SERIAL PRIMARY KEY,
      inscricao_id INTEGER NOT NULL REFERENCES inscricoes(id) ON DELETE CASCADE,
      texto_anotacao TEXT NOT NULL,
      usuario_id INTEGER,
      usuario_nome VARCHAR,
      usuario_foto VARCHAR,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ inscricao_anotacoes criada');

  await db.query(`
    CREATE TABLE IF NOT EXISTS inscricao_movimentacoes (
      id SERIAL PRIMARY KEY,
      inscricao_id INTEGER NOT NULL REFERENCES inscricoes(id) ON DELETE CASCADE,
      usuario_id INTEGER,
      usuario_nome VARCHAR,
      tipo VARCHAR NOT NULL,
      categoria VARCHAR,
      valor_antes TEXT,
      valor_depois TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ inscricao_movimentacoes criada');

  await db.end();
  console.log('👋 Migração concluída!');
}

migrate().catch(e => { console.error('❌', e.message); process.exit(1); });

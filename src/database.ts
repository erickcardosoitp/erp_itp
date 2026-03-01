import knex from 'knex';
import dotenv from 'dotenv';

dotenv.config();

// A URL deve estar no seu arquivo .env como DATABASE_URL
const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_IQK6XUgx5EqY@ep-wispy-tooth-aihlvt7v-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';

export const db = knex({
  client: 'pg',
  connection: {
    connectionString: connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
  },
  pool: { min: 2, max: 10 }
});

// Validação de conexão
db.raw('SELECT 1')
  .then(() => console.log('🐘 Banco conectado via URL com sucesso!'))
  .catch((err) => console.error('❌ Falha na conexão:', err.message));
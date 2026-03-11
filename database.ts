import knex from 'knex';
import dotenv from 'dotenv';

// Carrega as variáveis de ambiente
dotenv.config();

const connectionString = process.env.DATABASE_URL;

// Validação Crítica: Impede que o app rode sem a conexão
if (!connectionString) {
  throw new Error("❌ ERRO: A variável de ambiente DATABASE_URL não foi definida.");
}

export const db = knex({
  client: 'pg',
  connection: {
    connectionString: connectionString,
    // Opcional: Melhora a compatibilidade com instâncias Neon/Render
    ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
      ? false 
      : { rejectUnauthorized: false }
  },
  pool: { 
    min: 2, 
    max: 10,
    // Garante que conexões inativas sejam encerradas para não estourar o limite do Neon
    idleTimeoutMillis: 30000 
  }
});

// Verificação de conexão em tempo de execução
db.raw('SELECT 1')
  .then(() => console.log('🐘 Conexão com PostgreSQL estabelecida com sucesso!'))
  .catch((err) => {
    console.error('❌ Falha Crítica ao conectar no Banco de Dados:');
    console.error(err.message);
  });
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_qEAt05zJicRn@ep-wispy-tooth-aihlvt7v-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

const sql = `
  ALTER TABLE professores
    ADD COLUMN IF NOT EXISTS cpf TEXT,
    ADD COLUMN IF NOT EXISTS data_nascimento DATE,
    ADD COLUMN IF NOT EXISTS celular TEXT,
    ADD COLUMN IF NOT EXISTS sexo TEXT,
    ADD COLUMN IF NOT EXISTS raca_cor TEXT,
    ADD COLUMN IF NOT EXISTS escolaridade TEXT,
    ADD COLUMN IF NOT EXISTS cep TEXT,
    ADD COLUMN IF NOT EXISTS numero_residencia TEXT,
    ADD COLUMN IF NOT EXISTS complemento TEXT,
    ADD COLUMN IF NOT EXISTS estado TEXT,
    ADD COLUMN IF NOT EXISTS telefone_emergencia_1 TEXT,
    ADD COLUMN IF NOT EXISTS telefone_emergencia_2 TEXT,
    ADD COLUMN IF NOT EXISTS possui_deficiencia BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deficiencia_descricao TEXT,
    ADD COLUMN IF NOT EXISTS possui_alergias BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS alergias_descricao TEXT,
    ADD COLUMN IF NOT EXISTS usa_medicamentos BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS medicamentos_descricao TEXT,
    ADD COLUMN IF NOT EXISTS interesse_cursos BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
`;

client.connect()
  .then(() => client.query(sql))
  .then(() => { console.log('OK - colunas adicionadas com sucesso'); client.end(); })
  .catch(e => { console.error('ERRO:', e.message); client.end(); process.exit(1); });

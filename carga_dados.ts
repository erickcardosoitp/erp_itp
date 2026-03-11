import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { Client } from 'pg';
const { parse } = require('csv-parse/sync');

dotenv.config();

const CSV_PATH = "C:\\Users\\gonca\\Downloads\\Cadastro Alunos - Tia Pretinha 2026 - Respostas ao formulário 1.csv";
const DB_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_qEAt05zJicRn@ep-wispy-tooth-aihlvt7v-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function executarCarga() {
  console.log("🚀 Iniciando carga direta no banco...");

  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  console.log("✅ Conectado ao banco.");

  // ── TRUNCAR ──────────────────────────────────────────────────
  await db.query('TRUNCATE TABLE inscricoes RESTART IDENTITY CASCADE');
  console.log("🗑️  Tabela inscricoes limpa.");

  // ── LER CSV ──────────────────────────────────────────────────
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ Arquivo não encontrado: ${CSV_PATH}`);
    await db.end();
    return;
  }

  const records = parse(fs.readFileSync(CSV_PATH), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true
  });

  console.log(`📊 ${records.length} registros no CSV. Inserindo...`);

  let sucessos = 0;
  let erros = 0;
  let duplicados = 0;
  const cpfsVistos = new Set<string>();

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const nomeCandidato = row["Nome completo:"]?.trim() || "Sem Nome";

    let cpf = row["CPF:"]?.replace(/\D/g, '') || '';
    if (!cpf) cpf = `TEMP${Date.now()}${i}`;

    // Pula duplicados de CPF real dentro do próprio CSV
    if (!cpf.startsWith('TEMP') && cpfsVistos.has(cpf)) {
      console.warn(`⏭️  [${i+1}/${records.length}] DUPLICADO ignorado: ${nomeCandidato} (CPF: ${cpf})`);
      duplicados++;
      continue;
    }
    cpfsVistos.add(cpf);

    const emailRaw = row["Email:"] || row["Endereço de e-mail"] || row["Email"] || '';
    const email = emailRaw.includes('@') ? emailRaw.trim() : `contato_${cpf}@itp.com.br`;

    const toBool = (val: string | undefined) =>
      val ? val.trim().toLowerCase().includes("sim") || val.trim().toLowerCase().includes("autorizo") : false;

    const parseDate = (val: string | undefined): string | null => {
      if (!val) return null;
      const clean = val.trim();
      // DD/MM/YYYY
      const s = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (s) return `${s[3]}-${s[2].padStart(2, '0')}-${s[1].padStart(2, '0')}`;
      // DD/MM/YY (2-digit year)
      const s2 = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
      if (s2) {
        const year = parseInt(s2[3]) < 30 ? `20${s2[3]}` : `19${s2[3]}`;
        return `${year}-${s2[2].padStart(2, '0')}-${s2[1].padStart(2, '0')}`;
      }
      // DDMMYYYY (sem separador)
      const n = clean.match(/^(\d{2})(\d{2})(\d{4})$/);
      if (n) return `${n[3]}-${n[2]}-${n[1]}`;
      return clean;
    };

    // Parse de timestamp DD/MM/YYYY HH:MM:SS (formato Google Forms)
    const parseTimestamp = (val: string | undefined): string | null => {
      if (!val) return null;
      const m = val.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
      if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}T${m[4]}:${m[5]}:${m[6]}`;
      return null;
    };

    const payload = {
      nome_completo: nomeCandidato,
      cpf,
      email,
      celular: (row["Celular"] || row["Celular:"] || '').replace(/\D/g, '') || 'Não informado',
      telefone_alternativo: (row["Telefone alternativo:"] || '').replace(/\D/g, '') || null,
      data_nascimento: parseDate(row["Data de Nascimento:"]),
      idade: parseInt(row["Idade:"]) || null,
      sexo: row["Sexo:"] || null,
      escolaridade: row["Escolaridade:"] || null,
      turno_escolar: row["Turno Escolar:"] || null,
      logradouro: row["Logradouro"] || row["Logradouro:"] || null,
      numero: row["Número:"] || null,
      complemento: row["Complemento:"] || null,
      cidade: row["Cidade:"] || "Rio de Janeiro",
      bairro: row["Bairro:"] || null,
      estado_uf: row["Estado (UF):"] || "RJ",
      cep: (row["CEP:"] || '').replace(/\D/g, '') || null,
      maior_18_anos: toBool(row["Uma perguntinha... O aluno(a) é maior de 18 anos?"]) || toBool(row["Maior de 18 anos?"]),
      nome_responsavel: row["Nome Completo do Responsável:"] || null,
      grau_parentesco: row["Grau de Parentesco:"] || null,
      cpf_responsavel: (row["CPF do Responsável:"] || '').replace(/\D/g, '') || null,
      possui_alergias: row["Possui alergias?"] || null,
      cuidado_especial: row["Possui algum tipo de cuidado especial?"] || null,
      detalhes_cuidado: row["Caso a resposta anterior tenha sido sim, quais?"] || null,
      uso_medicamento: row["Faz uso de algum tipo de medicamento?"] || null,
      cursos_desejados: row["Projetos:"] || null,
      autoriza_imagem: toBool(row["Autorizo o Instituto Tia Pretinha a utilizar fotos e vídeos da criança/adolescente acima para fins institucionais, divulgação de projetos e redes sociais, sem qualquer ônus para a instituição."]),
      nome_assinatura_imagem: row["Se a sua resposta anterior for SIM, preencha por favor seu nome completo:"] || null,
      data_inscricao: parseTimestamp(row["Carimbo de data/hora"]),
      status_matricula: "Pendente",
      origem_inscricao: "Carga",
      lgpd_aceito: false,
    };

    try {
      await db.query(
        `INSERT INTO inscricoes (
          nome_completo, cpf, email, celular, telefone_alternativo,
          data_nascimento, idade, sexo, escolaridade, turno_escolar,
          logradouro, numero, complemento, cidade, bairro, estado_uf, cep,
          maior_18_anos, nome_responsavel, grau_parentesco, cpf_responsavel,
          possui_alergias, cuidado_especial, detalhes_cuidado, uso_medicamento,
          cursos_desejados, autoriza_imagem, nome_assinatura_imagem,
          data_inscricao, status_matricula, origem_inscricao, lgpd_aceito
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
          $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32
        )`,
        [
          payload.nome_completo, payload.cpf, payload.email, payload.celular, payload.telefone_alternativo,
          payload.data_nascimento, payload.idade, payload.sexo, payload.escolaridade, payload.turno_escolar,
          payload.logradouro, payload.numero, payload.complemento, payload.cidade, payload.bairro, payload.estado_uf, payload.cep,
          payload.maior_18_anos, payload.nome_responsavel, payload.grau_parentesco, payload.cpf_responsavel,
          payload.possui_alergias, payload.cuidado_especial, payload.detalhes_cuidado, payload.uso_medicamento,
          payload.cursos_desejados, payload.autoriza_imagem, payload.nome_assinatura_imagem,
          payload.data_inscricao, payload.status_matricula, payload.origem_inscricao, payload.lgpd_aceito,
        ]
      );
      sucessos++;
      console.log(`✅ [${i+1}/${records.length}] ${nomeCandidato}`);
    } catch (err: any) {
      console.error(`❌ [${i+1}/${records.length}] "${nomeCandidato}": ${err.message}`);
      erros++;
    }
  }

  await db.end();

  console.log(`\n--- RELATÓRIO FINAL ---`);
  console.log(`🎉 Sucessos:   ${sucessos}`);
  console.log(`⏭️  Duplicados: ${duplicados}`);
  console.log(`⚠️  Falhas:     ${erros}`);
  console.log(`------------------------\n`);
}

executarCarga().then(() => console.log("👋 Finalizado."));


import * as fs from 'fs';
const { parse } = require('csv-parse/sync');

const CSV_PATH = "C:\\Users\\gonca\\Downloads\\Cadastro Alunos - Tia Pretinha 2026 - Respostas ao formulário 1.csv";
const API_URL = "http://127.0.0.1:3000/matriculas/inscricao";

// Função para pausar a execução
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function executarCarga() {
  console.log("🚀 Iniciando carga técnica revisada...");
  console.log("⏱️  Intervalo de 3 segundos entre registros para estabilidade.");

  try {
    if (!fs.existsSync(CSV_PATH)) {
      throw new Error(`Arquivo não encontrado: ${CSV_PATH}`);
    }

    const fileContent = fs.readFileSync(CSV_PATH);
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true
    });

    console.log(`📊 Total de registros no CSV: ${records.length}`);
    let sucessos = 0;
    let erros = 0;

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const nomeCandidato = row["Nome completo:"] || "Sem Nome";
      
      // TRATAMENTO DE CPF: Se estiver vazio no CSV, gera um temporário para não violar o UNIQUE do banco
      let cpfLimpo = row["CPF:"]?.replace(/\D/g, '');
      if (!cpfLimpo || cpfLimpo === "") {
        cpfLimpo = `TEMP${Date.now()}${i}`; 
      }

      // TRATAMENTO DE EMAIL: Mapeia as 3 colunas possíveis que vi no seu CSV
      const emailOriginal = row["Email:"] || row["Endereço de e-mail"] || row["Email"];
      const emailFinal = emailOriginal && emailOriginal.includes('@') 
        ? emailOriginal 
        : `contato_${cpfLimpo}@itp.com.br`;

      try {
        const payload = {
          nome_completo: nomeCandidato,
          cpf: cpfLimpo,
          data_nascimento: row["Data de Nascimento:"],
          idade: parseInt(row["Idade:"]) || 0,
          sexo: row["Sexo:"],
          escolaridade: row["Escolaridade:"],
          turno_escolar: row["Turno Escolar:"],
          logradouro: row["Logradouro"] || "Não informado",
          numero: row["Número:"] || "S/N",
          complemento: row["Complemento:"],
          cidade: row["Cidade:"] || "Rio de Janeiro",
          bairro: row["Bairro:"] || "Vaz Lobo",
          estado_uf: row["Estado (UF):"] || "RJ",
          cep: row["CEP:"]?.replace(/\D/g, '') || "00000000",
          
          // Mapeamento de Maioridade (Checa ambas as colunas do formulário)
          maior_18_anos: 
            row["Uma perguntinha... O aluno(a) é maior de 18 anos?"]?.toLowerCase().includes("sim") || 
            row["Maior de 18 anos?"]?.toLowerCase().includes("sim"),
          
          nome_responsavel: row["Nome Completo do Responsável:"] || "O próprio",
          grau_parentesco: row["Grau de Parentesco:"] || "N/A",
          cpf_responsavel: row["CPF do Responsável:"]?.replace(/\D/g, ''),
          celular: row["Celular"] || row["Celular:"] || "Não informado",
          telefone_alternativo: row["Telefone alternativo:"],
          email: emailFinal,
          
          possui_alergias: row["Possui alergias?"],
          cuidado_especial: row["Possui algum tipo de cuidado especial?"],
          detalhes_cuidado: row["Caso a resposta anterior tenha sido sim, quais?"],
          uso_medicamento: row["Faz uso de algum tipo de medicamento?"],
          cursos_desejados: row["Projetos:"],
          
          // Mapeamento de Imagem (Tratando o texto longo do formulário)
          autoriza_imagem: 
            row["Autorizo o Instituto Tia Pretinha a utilizar fotos e vídeos da criança/adolescente acima para fins institucionais, divulgação de projetos e redes sociais, sem qualquer ônus para a instituição."]?.toLowerCase().includes("autorizo") || 
            row["Autorizo o Instituto Tia Pretinha a utilizar fotos e vídeos..."]?.toLowerCase().includes("sim"),
          
          nome_assinatura_imagem: row["Se a sua resposta anterior for SIM, preencha por favor seu nome completo:"],
          status_matricula: "Pendente"
        };

        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          sucessos++;
          console.log(`✅ [${sucessos}/${records.length}] CARREGADO: ${nomeCandidato}`);
        } else {
          const errorData: any = await res.json();
          console.error(`❌ ERRO em ${nomeCandidato}:`, errorData.message || "Erro na API");
          erros++;
        }

        // Delay de 3 segundos
        if (i < records.length - 1) {
          await delay(3000);
        }

      } catch (err: any) {
        console.error(`🔥 FALHA DE CONEXÃO em ${nomeCandidato}: Verifique se o Backend está rodando.`);
        erros++;
      }
    }

    console.log(`\n--- RELATÓRIO FINAL ---`);
    console.log(`🎉 Sucessos: ${sucessos}`);
    console.log(`⚠️  Falhas: ${erros}`);
    console.log(`------------------------\n`);

  } catch (err: any) {
    console.error("🔥 ERRO CRÍTICO:", err.message);
  }
}

executarCarga().then(() => console.log("👋 Processo finalizado."));
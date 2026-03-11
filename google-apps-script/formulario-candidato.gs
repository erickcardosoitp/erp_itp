/**
 * Google Apps Script — Formulário de Inscrição de Candidato
 * Instituto Tia Pretinha
 *
 * Grava diretamente no banco de dados Neon (PostgreSQL) via JDBC.
 * Não depende de nenhuma API ou backend do projeto.
 *
 * Configure o gatilho: Extensões → Apps Script → Gatilhos
 *   → Adicionar gatilho → aoEnviarFormulario → Do formulário → Ao enviar formulário
 *
 * Propriedades do script (Projeto → Configurações → Propriedades do script):
 *   DB_URL        = jdbc:postgresql://<host>.neon.tech/<dbname>?sslmode=require
 *   DB_USER       = <usuario_neon>
 *   DB_PASSWORD   = <senha_neon>
 *   EMAIL_VENDAS  = karina.livia.sales@gmail.com,gabrielagracianobezerra@gmail.com
 *   EMAIL_SUPORTE = goncalvecardoso@gmail.com
 */

// ─────────────────────────────────────────────────────────────────────
//  Utilitários
// ─────────────────────────────────────────────────────────────────────

function getConf_(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}

/** Retorna string limpa ou null */
function str_(val) {
  var v = (val || '').toString().trim();
  return v === '' ? null : v;
}

/** Extrai apenas dígitos; retorna null se vazio */
function digits_(val) {
  if (!val) return null;
  var v = val.toString().replace(/\D/g, '');
  return v === '' ? null : v;
}

/** "sim" → true | qualquer outra coisa → false */
function bool_(val) {
  if (!val) return false;
  return val.toString().trim().toLowerCase() === 'sim';
}

/** Converte DD/MM/YYYY para YYYY-MM-DD; retorna null se inválido */
function dataISO_(val) {
  var v = str_(val);
  if (!v) return null;
  var p = v.split('/');
  if (p.length === 3 && p[2].length === 4) return p[2] + '-' + p[1] + '-' + p[0];
  return v; // já pode estar em ISO
}

/** Lê campo das respostas do formulário */
function campo_(r, chave) {
  return str_(r[chave] ? r[chave][0] : null);
}

// ─────────────────────────────────────────────────────────────────────
//  Gravação em planilha (mantida do script original)
// ─────────────────────────────────────────────────────────────────────

function salvarNaPlanilha_(dados) {
  try {
    var ss  = SpreadsheetApp.getActiveSpreadsheet();
    var aba = ss.getSheetByName('Respostas');
    if (!aba) return;
    var linha = [
      new Date(),
      dados.nome_completo,
      dados.cpf,
      dados.cursos_desejados,
      dados.celular,
      dados.telefone_alternativo,
      dados.nome_responsavel,
    ];
    aba.getRange(aba.getLastRow() + 1, 1, 1, linha.length).setValues([linha]);
    Logger.log('[Planilha] Linha ' + aba.getLastRow() + ' gravada.');
  } catch (err) {
    Logger.log('[Planilha ERRO] ' + err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────
//  Notificações por e-mail
// ─────────────────────────────────────────────────────────────────────

function notificarEquipe_(dados, sucesso, detalhe) {
  var emailVendas  = getConf_('EMAIL_VENDAS')  || 'karina.livia.sales@gmail.com,gabrielagracianobezerra@gmail.com';
  var emailSuporte = getConf_('EMAIL_SUPORTE') || 'goncalvecardoso@gmail.com';

  var resumo = '👤 Nome: ' + dados.nome_completo +
               '\n📄 CPF: ' + dados.cpf +
               '\n📚 Cursos: ' + dados.cursos_desejados +
               '\n📱 Celular: ' + dados.celular;

  if (sucesso) {
    MailApp.sendEmail(emailVendas, '✅ Nova Inscrição ITP', resumo + '\nStatus: ✅ Gravado no banco');
  } else {
    MailApp.sendEmail(emailSuporte, '🚨 ALERTA TÉCNICO ITP', 'Erro ao gravar inscrição:\n' + detalhe + '\n\nDados:\n' + JSON.stringify(dados, null, 2));
    MailApp.sendEmail(emailVendas, '⚠️ Pendência na Inscrição', 'A inscrição de ' + dados.nome_completo + ' foi recebida mas houve um erro ao gravar no sistema. O suporte técnico já foi avisado.');
  }
}

// ─────────────────────────────────────────────────────────────────────
//  Gatilho principal — executado ao enviar o formulário
// ─────────────────────────────────────────────────────────────────────

function aoEnviarFormulario(e) {
  Logger.log('🚀 Pipeline ITP iniciado');

  if (!e || !e.namedValues) {
    Logger.log('❌ Evento vazio ou inválido');
    return;
  }

  var r = e.namedValues; // { "Título": ["resposta"] }

  // ── Leitura dos campos do formulário ──────────────────────────────
  var dados = {
    nome_completo:        campo_(r, 'Nome completo:')              || '',
    email:                campo_(r, 'Endereço de e-mail')          || '',
    cpf:                  digits_(campo_(r, 'CPF:'))               || '',
    celular:              digits_(campo_(r, 'Celular:'))           || '',
    data_nascimento:      dataISO_(campo_(r, 'Data de Nascimento:')),
    idade:                campo_(r, 'Idade:') ? parseInt(campo_(r, 'Idade:').replace(/\D/g, '')) || null : null,
    sexo:                 campo_(r, 'Sexo:'),
    escolaridade:         campo_(r, 'Escolaridade:'),
    turno_escolar:        campo_(r, 'Turno escolar:'),
    maior_18_anos:        bool_(campo_(r, 'Maior de 18 anos:')),
    logradouro:           campo_(r, 'Logradouro:'),
    numero:               campo_(r, 'Número:'),
    complemento:          campo_(r, 'Complemento:'),
    bairro:               campo_(r, 'Bairro:'),
    cidade:               campo_(r, 'Cidade:')      || 'Rio de Janeiro',
    estado_uf:            campo_(r, 'Estado (UF):') || 'RJ',
    cep:                  digits_(campo_(r, 'CEP:')),
    nome_responsavel:     campo_(r, 'Nome Completo do Responsável:'),
    grau_parentesco:      campo_(r, 'Grau de parentesco do responsável:'),
    cpf_responsavel:      digits_(campo_(r, 'CPF do Responsável:')),
    telefone_alternativo: digits_(campo_(r, 'Telefone alternativo:')),
    possui_alergias:      campo_(r, 'Possui alergias:'),
    cuidado_especial:     campo_(r, 'Necessita de cuidado especial:'),
    detalhes_cuidado:     campo_(r, 'Detalhes do cuidado:'),
    uso_medicamento:      campo_(r, 'Faz uso de medicamento:'),
    cursos_desejados:     campo_(r, 'Cursos desejados:'),
    lgpd_aceito:          bool_(campo_(r, 'LGPD Aceito:')),
    autoriza_imagem:      bool_(campo_(r, 'Autoriza uso de imagem:')),
  };

  Logger.log('👤 Candidato: ' + dados.nome_completo + ' | CPF: ' + dados.cpf);

  // ── Salva na planilha (independente do banco) ─────────────────────
  salvarNaPlanilha_(dados);

  // ── Conexão com o Neon (PostgreSQL) via JDBC ──────────────────────
  var conn;
  var sucesso = false;
  var erroMsg = '';

  try {
    var dbUrl  = getConf_('DB_URL');
    var dbUser = getConf_('DB_USER');
    var dbPass = getConf_('DB_PASSWORD');

    conn = Jdbc.getConnection(dbUrl, dbUser, dbPass);
    conn.setAutoCommit(false);

    // ── INSERT na tabela inscricoes ──────────────────────────────
    var sql = [
      'INSERT INTO inscricoes (',
      '  nome_completo, cpf, email, celular,',
      '  data_nascimento, idade, sexo, escolaridade, turno_escolar, maior_18_anos,',
      '  logradouro, numero, complemento, bairro, cidade, estado_uf, cep,',
      '  nome_responsavel, grau_parentesco, cpf_responsavel, telefone_alternativo,',
      '  possui_alergias, cuidado_especial, detalhes_cuidado, uso_medicamento,',
      '  cursos_desejados, lgpd_aceito, autoriza_imagem,',
      '  status_matricula, origem_inscricao, data_inscricao',
      ') VALUES (',
      '  ?, ?, ?, ?,',
      '  ?, ?, ?, ?, ?, ?,',
      '  ?, ?, ?, ?, ?, ?, ?,',
      '  ?, ?, ?, ?,',
      '  ?, ?, ?, ?,',
      '  ?, ?, ?,',
      "  'Pendente', 'Forms', NOW()",
      ')',
    ].join(' ');

    var st = conn.prepareStatement(sql);
    var i = 1;

    // nome_completo, cpf, email, celular
    st.setString(i++, dados.nome_completo);
    st.setString(i++, dados.cpf);
    st.setString(i++, dados.email);
    st.setString(i++, dados.celular);

    // data_nascimento
    if (dados.data_nascimento) { st.setString(i++, dados.data_nascimento); } else { st.setNull(i++, 0); }
    // idade
    if (dados.idade !== null && dados.idade !== undefined) { st.setInt(i++, dados.idade); } else { st.setNull(i++, 0); }
    // sexo, escolaridade, turno_escolar
    st.setString(i++, dados.sexo);
    st.setString(i++, dados.escolaridade);
    st.setString(i++, dados.turno_escolar);
    // maior_18_anos
    st.setBoolean(i++, dados.maior_18_anos);

    // logradouro, numero, complemento, bairro, cidade, estado_uf, cep
    st.setString(i++, dados.logradouro);
    st.setString(i++, dados.numero);
    st.setString(i++, dados.complemento);
    st.setString(i++, dados.bairro);
    st.setString(i++, dados.cidade);
    st.setString(i++, dados.estado_uf);
    st.setString(i++, dados.cep);

    // responsável
    st.setString(i++, dados.nome_responsavel);
    st.setString(i++, dados.grau_parentesco);
    st.setString(i++, dados.cpf_responsavel);
    st.setString(i++, dados.telefone_alternativo);

    // saúde
    st.setString(i++, dados.possui_alergias);
    st.setString(i++, dados.cuidado_especial);
    st.setString(i++, dados.detalhes_cuidado);
    st.setString(i++, dados.uso_medicamento);

    // cursos, termos
    st.setString(i++, dados.cursos_desejados);
    st.setBoolean(i++, dados.lgpd_aceito);
    st.setBoolean(i++, dados.autoriza_imagem);

    st.executeUpdate();
    conn.commit();
    st.close();

    sucesso = true;
    Logger.log('✅ Candidato gravado no banco: ' + dados.nome_completo);

  } catch (err) {
    erroMsg = err.toString();
    Logger.log('❌ Erro JDBC: ' + erroMsg);
    if (conn) { try { conn.rollback(); } catch (e2) {} }
  } finally {
    if (conn) { try { conn.close(); } catch (e3) {} }
  }

  notificarEquipe_(dados, sucesso, erroMsg);
}

// ─────────────────────────────────────────────────────────────────────
//  Teste manual — rode no editor do Apps Script para validar sem form
// ─────────────────────────────────────────────────────────────────────

function testeManual_() {
  var fakeEvent = {
    namedValues: {
      'Endereço de e-mail':                    ['candidato@teste.com'],
      'Nome completo:':                        ['João da Silva Teste'],
      'CPF:':                                  ['111.222.333-44'],
      'Celular:':                              ['(21) 99999-0000'],
      'Data de Nascimento:':                   ['15/06/2005'],
      'Idade:':                                ['20'],
      'Sexo:':                                 ['Masculino'],
      'Escolaridade:':                         ['Ensino Médio Completo'],
      'Turno escolar:':                        ['Manhã'],
      'Maior de 18 anos:':                     ['Sim'],
      'Logradouro:':                           ['Rua das Flores'],
      'Número:':                               ['42'],
      'Complemento:':                          [''],
      'Bairro:':                               ['Centro'],
      'Cidade:':                               ['Rio de Janeiro'],
      'Estado (UF):':                          ['RJ'],
      'CEP:':                                  ['20040-020'],
      'Nome Completo do Responsável:':         [''],
      'Grau de parentesco do responsável:':    [''],
      'CPF do Responsável:':                   [''],
      'Telefone alternativo:':                 [''],
      'Possui alergias:':                      ['Não'],
      'Necessita de cuidado especial:':        ['Não'],
      'Detalhes do cuidado:':                  [''],
      'Faz uso de medicamento:':               ['Não'],
      'Cursos desejados:':                     ['Informática Básica'],
      'LGPD Aceito:':                          ['Sim'],
      'Autoriza uso de imagem:':               ['Sim'],
    },
  };
  aoEnviarFormulario(fakeEvent);
}

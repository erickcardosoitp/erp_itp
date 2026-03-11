/**
 * Google Apps Script — Formulário de Cadastro de Funcionário
 * Instituto Tia Pretinha
 *
 * Grava diretamente no banco de dados Neon (PostgreSQL) via JDBC.
 * Não depende de nenhuma API ou backend do projeto.
 *
 * Configure o gatilho: Extensões → Apps Script → Gatilhos
 *   → Adicionar gatilho → onFormSubmit → Do formulário → Ao enviar formulário
 *
 * Propriedades do script (Projeto → Configurações → Propriedades do script):
 *   DB_URL      = jdbc:postgresql://<host>.neon.tech/<dbname>?sslmode=require
 *   DB_USER     = <usuario_neon>
 *   DB_PASSWORD = <senha_neon>
 *   EMAIL_ERROS = seuemail@dominio.com   (opcional)
 */

// ─────────────────────────────────────────────────────────────────────
//  Utilitários
// ─────────────────────────────────────────────────────────────────────

function getConf_(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}

/** "Sim..." → true | qualquer outra coisa → false */
function simParaBool_(value) {
  if (!value) return false;
  return value.toString().toLowerCase().startsWith('sim');
}

/** Retorna string limpa ou null */
function str_(value) {
  var v = (value || '').toString().trim();
  return v === '' ? null : v;
}

/**
 * Converte data no formato DD/MM/YYYY (Google Forms BR) para YYYY-MM-DD (SQL).
 * Retorna null se não conseguir converter.
 */
function dataParaISO_(value) {
  var v = str_(value);
  if (!v) return null;
  var partes = v.split('/');
  if (partes.length === 3) {
    return partes[2] + '-' + partes[1] + '-' + partes[0];
  }
  // Tenta retornar como está (já pode estar em ISO)
  return v;
}

// ─────────────────────────────────────────────────────────────────────
//  Gatilho principal — executado ao enviar o formulário
// ─────────────────────────────────────────────────────────────────────

function onFormSubmit(e) {
  var conn;
  try {
    // Normaliza respostas: { "Título da Pergunta": "resposta" }
    var r = {};
    var values = e.namedValues || {};
    for (var key in values) {
      r[key] = (values[key][0] || '').toString().trim();
    }

    // ── Leitura dos campos do formulário ──────────────────────────
    var nome               = str_(r['Nome Completo']);
    var email              = str_(r['E-mail (Obrigatório)'])            || str_(r['E-mail']);
    var cpf                = str_(r['CPF (Obrigatório)'])               || str_(r['CPF']);
    var data_nascimento    = dataParaISO_(r['Data de Nascimento (Obrigatório)'] || r['Data de Nascimento']);
    var celular            = str_(r['Celular (Obrigatório)'])           || str_(r['Celular']);
    var sexo               = str_(r['Sexo (Obrigatório)'])              || str_(r['Sexo']);
    var raca_cor           = str_(r['Raça/Cor']);
    var escolaridade       = str_(r['Escolaridade']);
    var cep                = str_(r['CEP']);
    var numero_residencia  = str_(r['Número da Residência']);
    var complemento        = str_(r['Complemento (Ex: Apartamento, Bloco)']);
    var estado             = str_(r['Estado (Ex: RJ, SP)']);
    var tel1               = str_(r['Telefone de Emergência 1 (Obrigatório)']);
    var tel2               = str_(r['Telefone de Emergência 2 (Opcional)']);
    var possui_deficiencia = simParaBool_(r['Possui algum tipo de deficiência?']);
    var def_descricao      = str_(r['Se sim, qual(is) deficiência(s) possui? (Descreva)']);
    var possui_alergias    = simParaBool_(r['Possui Alergias?']);
    var alergia_descricao  = str_(r['Se sim, qual(is) tipo(s) de alergia possui? (Descreva)']);
    var usa_medicamentos   = simParaBool_(r['Faz uso contínuo de algum tipo de medicamento?']);
    var med_descricao      = str_(r['Se sim, quais medicamentos utiliza? (Nome e dosagem, se souber)']);
    var interesse_cursos   = simParaBool_(r['Tem interesse em se matricular em algum curso do Instituto Tia Pretinha?']);

    // ── Conexão com o Neon (PostgreSQL) via JDBC ──────────────────
    var dbUrl  = getConf_('DB_URL');
    var dbUser = getConf_('DB_USER');
    var dbPass = getConf_('DB_PASSWORD');

    conn = Jdbc.getConnection(dbUrl, dbUser, dbPass);
    conn.setAutoCommit(false);

    // ── INSERT na tabela professores ──────────────────────────────
    var sql = [
      'INSERT INTO professores (',
      '  id, nome, email, cpf, data_nascimento, celular, sexo, raca_cor, escolaridade,',
      '  cep, numero_residencia, complemento, estado,',
      '  telefone_emergencia_1, telefone_emergencia_2,',
      '  possui_deficiencia, deficiencia_descricao,',
      '  possui_alergias, alergias_descricao,',
      '  usa_medicamentos, medicamentos_descricao,',
      '  interesse_cursos, ativo, created_at, updated_at',
      ') VALUES (',
      '  gen_random_uuid(), ?, ?, ?, ?, ?, ?, ?, ?,',
      '  ?, ?, ?, ?,',
      '  ?, ?,',
      '  ?, ?,',
      '  ?, ?,',
      '  ?, ?,',
      '  ?, true, NOW(), NOW()',
      ')',
    ].join(' ');

    var stmt = conn.prepareStatement(sql);
    var i = 1;
    stmt.setString(i++, nome);
    stmt.setString(i++, email);
    stmt.setString(i++, cpf);
    // data_nascimento é DATE — usa setNull se ausente
    if (data_nascimento) {
      stmt.setString(i++, data_nascimento);
    } else {
      stmt.setNull(i++, 0);
    }
    stmt.setString(i++, celular);
    stmt.setString(i++, sexo);
    stmt.setString(i++, raca_cor);
    stmt.setString(i++, escolaridade);
    stmt.setString(i++, cep);
    stmt.setString(i++, numero_residencia);
    stmt.setString(i++, complemento);
    stmt.setString(i++, estado);
    stmt.setString(i++, tel1);
    stmt.setString(i++, tel2);
    stmt.setBoolean(i++, possui_deficiencia);
    stmt.setString(i++, def_descricao);
    stmt.setBoolean(i++, possui_alergias);
    stmt.setString(i++, alergia_descricao);
    stmt.setBoolean(i++, usa_medicamentos);
    stmt.setString(i++, med_descricao);
    stmt.setBoolean(i++, interesse_cursos);

    stmt.executeUpdate();
    conn.commit();
    stmt.close();

    Logger.log('[OK] Funcionário cadastrado diretamente no banco: ' + nome);

  } catch (err) {
    Logger.log('[EXCEPTION] ' + err.toString());
    if (conn) {
      try { conn.rollback(); } catch (e2) {}
    }
    notificarErro_(err.toString(), (e && e.namedValues && e.namedValues['Nome Completo']) ? e.namedValues['Nome Completo'][0] : '?');
  } finally {
    if (conn) {
      try { conn.close(); } catch (e3) {}
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
//  Notificação de erros por e-mail (opcional)
// ─────────────────────────────────────────────────────────────────────

function notificarErro_(detalhe, nome) {
  var destino = getConf_('EMAIL_ERROS');
  if (!destino) return;
  MailApp.sendEmail({
    to:      destino,
    subject: '[ITP] Erro no cadastro de funcionário: ' + (nome || ''),
    body:    'Ocorreu um erro ao processar o formulário de cadastro de funcionário.\n\n' + detalhe,
  });
}

// ─────────────────────────────────────────────────────────────────────
//  Teste manual — rode no editor do Apps Script para validar sem form
// ─────────────────────────────────────────────────────────────────────

function testeManual_() {
  var fakeEvent = {
    namedValues: {
      'Nome Completo':                      ['Maria de Teste'],
      'E-mail (Obrigatório)':               ['teste@itp.org'],
      'CPF (Obrigatório)':                  ['000.000.000-00'],
      'Data de Nascimento (Obrigatório)':   ['01/01/1990'],
      'Celular (Obrigatório)':              ['(21) 99999-9999'],
      'Sexo (Obrigatório)':                 ['Feminino'],
      'Raça/Cor':                           ['Preta'],
      'Escolaridade':                       ['Ensino Médio Completo'],
      'CEP':                                ['20040-020'],
      'Número da Residência':               ['100'],
      'Complemento (Ex: Apartamento, Bloco)': ['Apto 2'],
      'Estado (Ex: RJ, SP)':                ['RJ'],
      'Telefone de Emergência 1 (Obrigatório)': ['(21) 98888-8888'],
      'Telefone de Emergência 2 (Opcional)': [''],
      'Possui algum tipo de deficiência?':  ['Não'],
      'Se sim, qual(is) deficiência(s) possui? (Descreva)': [''],
      'Possui Alergias?':                   ['Não'],
      'Se sim, qual(is) tipo(s) de alergia possui? (Descreva)': [''],
      'Faz uso contínuo de algum tipo de medicamento?': ['Não'],
      'Se sim, quais medicamentos utiliza? (Nome e dosagem, se souber)': [''],
      'Tem interesse em se matricular em algum curso do Instituto Tia Pretinha?': ['Sim'],
    },
  };
  onFormSubmit(fakeEvent);
}

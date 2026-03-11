/**
 * Google Apps Script — Formulário de Cadastro de Funcionário
 * Instituto Tia Pretinha
 *
 * Grava diretamente no banco Neon via Data API (REST/PostgREST).
 * Não depende de nenhuma API ou backend do projeto.
 *
 * Configure o gatilho: Extensões → Apps Script → Gatilhos
 *   → Adicionar gatilho → onFormSubmit → Do formulário → Ao enviar formulário
 *
 * Propriedades do script (Projeto → Configurações → Propriedades do script):
 *   NEON_API_URL = https://ep-wispy-tooth-aihlvt7v.apirest.c-4.us-east-1.aws.neon.tech/neondb/rest/v1
 *   DB_USER      = neondb_owner
 *   DB_PASSWORD  = npg_qEAt05zJicRn
 *   EMAIL_ERROS  = seuemail@dominio.com   (opcional)
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
  try {
    // Normaliza respostas: { "Título da Pergunta": "resposta" }
    var r = {};
    var values = e.namedValues || {};
    for (var key in values) {
      r[key] = (values[key][0] || '').toString().trim();
    }

    // ── Monta o payload com os campos do formulário ───────────────
    var payload = {
      nome:                   str_(r['Nome Completo']),
      email:                  str_(r['E-mail (Obrigatório)'])  || str_(r['E-mail']),
      cpf:                    str_(r['CPF (Obrigatório)'])     || str_(r['CPF']),
      data_nascimento:        dataParaISO_(r['Data de Nascimento (Obrigatório)'] || r['Data de Nascimento']),
      celular:                str_(r['Celular (Obrigatório)']) || str_(r['Celular']),
      sexo:                   str_(r['Sexo (Obrigatório)'])   || str_(r['Sexo']),
      raca_cor:               str_(r['Raça/Cor']),
      escolaridade:           str_(r['Escolaridade']),
      cep:                    str_(r['CEP']),
      numero_residencia:      str_(r['Número da Residência']),
      complemento:            str_(r['Complemento (Ex: Apartamento, Bloco)']),
      estado:                 str_(r['Estado (Ex: RJ, SP)']),
      telefone_emergencia_1:  str_(r['Telefone de Emergência 1 (Obrigatório)']),
      telefone_emergencia_2:  str_(r['Telefone de Emergência 2 (Opcional)']),
      possui_deficiencia:     simParaBool_(r['Possui algum tipo de deficiência?']),
      deficiencia_descricao:  str_(r['Se sim, qual(is) deficiência(s) possui? (Descreva)']),
      possui_alergias:        simParaBool_(r['Possui Alergias?']),
      alergias_descricao:     str_(r['Se sim, qual(is) tipo(s) de alergia possui? (Descreva)']),
      usa_medicamentos:       simParaBool_(r['Faz uso contínuo de algum tipo de medicamento?']),
      medicamentos_descricao: str_(r['Se sim, quais medicamentos utiliza? (Nome e dosagem, se souber)']),
      interesse_cursos:       simParaBool_(r['Tem interesse em se matricular em algum curso do Instituto Tia Pretinha?']),
      ativo:                  true,
    };

    // Remove campos null para não sobrescrever defaults do banco
    // (booleans permanecem mesmo se false)
    var body = {};
    for (var k in payload) {
      if (payload[k] !== null && payload[k] !== undefined && payload[k] !== '') {
        body[k] = payload[k];
      }
    }
    body['possui_deficiencia']  = payload['possui_deficiencia'];
    body['possui_alergias']     = payload['possui_alergias'];
    body['usa_medicamentos']    = payload['usa_medicamentos'];
    body['interesse_cursos']    = payload['interesse_cursos'];
    body['ativo']               = true;

    // ── POST para a Neon Data API (REST) ──────────────────────────
    var baseUrl = getConf_('NEON_API_URL') || 'https://ep-wispy-tooth-aihlvt7v.apirest.c-4.us-east-1.aws.neon.tech/neondb/rest/v1';
    var dbUser  = getConf_('DB_USER')      || 'neondb_owner';
    var dbPass  = getConf_('DB_PASSWORD')  || '';
    var auth    = Utilities.base64Encode(dbUser + ':' + dbPass);

    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Basic ' + auth,
        'Prefer': 'return=minimal',
      },
      payload: JSON.stringify(body),
      muteHttpExceptions: true,
    };

    var response = UrlFetchApp.fetch(baseUrl + '/professores', options);
    var code     = response.getResponseCode();
    var text     = response.getContentText();

    if (code === 201 || code === 200) {
      Logger.log('[OK] Funcionário cadastrado: ' + payload.nome);
    } else {
      Logger.log('[ERRO] HTTP ' + code + ' — ' + text);
      notificarErro_('HTTP ' + code + '\n' + text, payload.nome);
    }

  } catch (err) {
    Logger.log('[EXCEPTION] ' + err.toString());
    notificarErro_(err.toString(), (e && e.namedValues && e.namedValues['Nome Completo']) ? e.namedValues['Nome Completo'][0] : '?');
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

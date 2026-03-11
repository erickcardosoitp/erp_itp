/**
 * Google Apps Script — Formulário de Cadastro de Funcionário
 * Instituto Tia Pretinha
 *
 * Configure o gatilho: Extensões → Apps Script → Gatilhos
 *   → Adicionar gatilho → onFormSubmit → Do formulário → Ao enviar formulário
 *
 * Variáveis de script (Projeto → Configurações do projeto → Propriedades do script):
 *   API_URL    = https://api.itp.institutotiapretinha.org/api/academico/professores/webhook
 *   API_SECRET = <mesmo valor de WEBHOOK_SECRET no backend>
 *   EMAIL_ERROS = seuemail@dominio.com   (opcional — para receber erros)
 */

// ─────────────────────────────────────────────────────────────────────
//  Utilitários
// ─────────────────────────────────────────────────────────────────────

function getConf_(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}

function simParaBool_(value) {
  if (!value) return false;
  return value.toString().toLowerCase().startsWith('sim');
}

function trim_(value) {
  return (value || '').toString().trim() || null;
}

// ─────────────────────────────────────────────────────────────────────
//  Gatilho principal — executado ao enviar o formulário
// ─────────────────────────────────────────────────────────────────────

function onFormSubmit(e) {
  try {
    // e.namedValues: objeto cujas chaves são os títulos das perguntas
    // e cada valor é um array com a resposta (FormApp)
    var r = {};
    var values = e.namedValues || {};

    // Normaliza para string simples: pega o primeiro elemento do array
    for (var key in values) {
      r[key] = (values[key][0] || '').toString().trim();
    }

    // ── Mapeamento dos campos ──────────────────────────────────────
    var payload = {
      nome:                   trim_(r['Nome Completo']),
      email:                  trim_(r['E-mail (Obrigatório)']) || trim_(r['E-mail']),
      cpf:                    trim_(r['CPF (Obrigatório)']) || trim_(r['CPF']),
      data_nascimento:        trim_(r['Data de Nascimento (Obrigatório)']) || trim_(r['Data de Nascimento']),
      celular:                trim_(r['Celular (Obrigatório)']) || trim_(r['Celular']),
      sexo:                   trim_(r['Sexo (Obrigatório)']) || trim_(r['Sexo']),
      raca_cor:               trim_(r['Raça/Cor']),
      escolaridade:           trim_(r['Escolaridade']),
      cep:                    trim_(r['CEP']),
      numero_residencia:      trim_(r['Número da Residência']),
      complemento:            trim_(r['Complemento (Ex: Apartamento, Bloco)']),
      estado:                 trim_(r['Estado (Ex: RJ, SP)']),
      telefone_emergencia_1:  trim_(r['Telefone de Emergência 1 (Obrigatório)']),
      telefone_emergencia_2:  trim_(r['Telefone de Emergência 2 (Opcional)']),
      possui_deficiencia:     simParaBool_(r['Possui algum tipo de deficiência?']),
      deficiencia_descricao:  trim_(r['Se sim, qual(is) deficiência(s) possui? (Descreva)']),
      possui_alergias:        simParaBool_(r['Possui Alergias?']),
      alergias_descricao:     trim_(r['Se sim, qual(is) tipo(s) de alergia possui? (Descreva)']),
      usa_medicamentos:       simParaBool_(r['Faz uso contínuo de algum tipo de medicamento?']),
      medicamentos_descricao: trim_(r['Se sim, quais medicamentos utiliza? (Nome e dosagem, se souber)']),
      interesse_cursos:       simParaBool_(r['Tem interesse em se matricular em algum curso do Instituto Tia Pretinha?']),
      ativo:                  true,
    };

    // Remove campos nulos para não sobrescrever defaults do banco
    var body = {};
    for (var k in payload) {
      if (payload[k] !== null && payload[k] !== undefined && payload[k] !== '') {
        body[k] = payload[k];
      }
    }
    // Booleans sempre enviados mesmo que false
    body['possui_deficiencia']  = payload['possui_deficiencia'];
    body['possui_alergias']     = payload['possui_alergias'];
    body['usa_medicamentos']    = payload['usa_medicamentos'];
    body['interesse_cursos']    = payload['interesse_cursos'];

    // ── Chamada à API ─────────────────────────────────────────────
    var apiUrl    = getConf_('API_URL')    || 'https://api.itp.institutotiapretinha.org/api/academico/professores/webhook';
    var apiSecret = getConf_('API_SECRET') || '';

    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-itp-webhook-secret': apiSecret,
      },
      payload: JSON.stringify(body),
      muteHttpExceptions: true,
    };

    var response = UrlFetchApp.fetch(apiUrl, options);
    var code     = response.getResponseCode();
    var text     = response.getContentText();

    if (code < 200 || code >= 300) {
      Logger.log('[ERRO] HTTP ' + code + ' — ' + text);
      notificarErro_('Erro ao cadastrar funcionário\nHTTP ' + code + '\n' + text, payload.nome);
    } else {
      Logger.log('[OK] Funcionário cadastrado: ' + payload.nome + ' (HTTP ' + code + ')');
    }

  } catch (err) {
    Logger.log('[EXCEPTION] ' + err.toString());
    notificarErro_(err.toString(), '(erro antes do envio)');
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
//  Teste manual — rode no editor do Apps Script para testar sem enviar form
// ─────────────────────────────────────────────────────────────────────

function testeManual_() {
  var fakaeEvent = {
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
  onFormSubmit(fakaeEvent);
}

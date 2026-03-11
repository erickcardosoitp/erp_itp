/**
 * Google Apps Script — Formulário de Cadastro de Funcionário
 * Instituto Tia Pretinha
 *
 * Envia os dados para o backend ITP que grava no banco.
 *
 * Configure o gatilho: Extensões → Apps Script → Gatilhos
 *   → Adicionar gatilho → onFormSubmit → Do formulário → Ao enviar formulário
 *
 * Propriedades do script (Projeto → Configurações → Propriedades do script):
 *   WEBHOOK_SECRET = itp-forms-2026
 *   EMAIL_ERROS    = seuemail@dominio.com   (opcional)
 *
 * A URL da API já está fixa no script abaixo.
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
 * Extrai o valor de uma entrada do namedValues (array) ou string já processada.
 */
function extrair_(raw) {
  if (!raw) return null;
  var val = Array.isArray(raw) ? raw[0] : raw;
  return str_(val);
}

/**
 * Busca um campo em r (namedValues) com comparação case-insensitive e sem pontuação final.
 * Aceita múltiplas chaves candidatas e retorna a primeira que tiver valor.
 */
function campo_(r, chaves) {
  if (!Array.isArray(chaves)) chaves = [chaves];
  // Tentativa exata primeiro
  for (var i = 0; i < chaves.length; i++) {
    var v = extrair_(r[chaves[i]]);
    if (v) return v;
  }
  // Fallback case-insensitive + sem pontuação/espaço no final
  var normalize = function(s) { return s.toLowerCase().replace(/[:\s]+$/, '').trim(); };
  var normalizedKeys = chaves.map(normalize);
  for (var key in r) {
    var nk = normalize(key);
    for (var j = 0; j < normalizedKeys.length; j++) {
      if (nk === normalizedKeys[j]) {
        var v2 = extrair_(r[key]);
        if (v2) return v2;
      }
    }
  }
  return null;
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

var API_URL_FUNCIONARIO = 'https://api.itp.institutotiapretinha.org/api/academico/professores/webhook';

function onFormSubmit(e) {
  try {
    // Usa namedValues diretamente — cada chave é o título da pergunta, valor é array
    var r = (e && e.namedValues) ? e.namedValues : {};

    // Log diagnóstico: mostra todos os campos recebidos
    Logger.log('[Campos recebidos] ' + Object.keys(r).join(' | '));

    var body = {
      nome:                   campo_(r, ['Nome Completo', 'Nome completo', 'Nome']),
      email:                  campo_(r, ['E-mail (Obrigatório)', 'E-mail', 'Email', 'Endereço de e-mail']),
      cpf:                    campo_(r, ['CPF (Obrigatório)', 'CPF']),
      data_nascimento:        dataParaISO_(campo_(r, ['Data de Nascimento (Obrigatório)', 'Data de Nascimento', 'Data de nascimento'])),
      celular:                campo_(r, ['Celular (Obrigatório)', 'Celular']),
      sexo:                   campo_(r, ['Sexo (Obrigatório)', 'Sexo']),
      raca_cor:               campo_(r, ['Raça/Cor', 'Raça / Cor', 'Raca/Cor']),
      escolaridade:           campo_(r, ['Escolaridade']),
      cep:                    campo_(r, ['CEP', 'Cep']),
      numero_residencia:      campo_(r, ['Número da Residência', 'Numero da Residencia', 'Número']),
      complemento:            campo_(r, ['Complemento (Ex: Apartamento, Bloco)', 'Complemento']),
      estado:                 campo_(r, ['Estado (Ex: RJ, SP)', 'Estado']),
      telefone_emergencia_1:  campo_(r, ['Telefone de Emergência 1 (Obrigatório)', 'Telefone de Emergência 1', 'Telefone emergência 1']),
      telefone_emergencia_2:  campo_(r, ['Telefone de Emergência 2 (Opcional)', 'Telefone de Emergência 2', 'Telefone emergência 2']),
      possui_deficiencia:     simParaBool_(campo_(r, ['Possui algum tipo de deficiência?', 'Possui deficiência?'])),
      deficiencia_descricao:  campo_(r, ['Se sim, qual(is) deficiência(s) possui? (Descreva)', 'Descreva a deficiência']),
      possui_alergias:        simParaBool_(campo_(r, ['Possui Alergias?', 'Possui alergias?'])),
      alergias_descricao:     campo_(r, ['Se sim, qual(is) tipo(s) de alergia possui? (Descreva)', 'Descreva as alergias']),
      usa_medicamentos:       simParaBool_(campo_(r, ['Faz uso contínuo de algum tipo de medicamento?', 'Usa medicamentos?'])),
      medicamentos_descricao: campo_(r, ['Se sim, quais medicamentos utiliza? (Nome e dosagem, se souber)', 'Quais medicamentos?']),
      interesse_cursos:       simParaBool_(campo_(r, ['Tem interesse em se matricular em algum curso do Instituto Tia Pretinha?', 'Interesse em cursos?'])),
      ativo:                  true,
    };

    Logger.log('[body.nome resolvido] "' + body.nome + '"');

    var secret = getConf_('WEBHOOK_SECRET') || 'itp-forms-2026';

    var response = UrlFetchApp.fetch(API_URL_FUNCIONARIO, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-itp-webhook-secret': secret },
      payload: JSON.stringify(body),
      muteHttpExceptions: true,
    });

    var code = response.getResponseCode();
    var text = response.getContentText();

    if (code >= 200 && code < 300) {
      Logger.log('[OK] Funcionário cadastrado: ' + body.nome + ' (HTTP ' + code + ')');
    } else {
      Logger.log('[ERRO] HTTP ' + code + ' — ' + text);
      notificarErro_('HTTP ' + code + '\n' + text, body.nome);
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

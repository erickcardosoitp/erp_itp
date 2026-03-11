/**
 * Google Apps Script — Formulário de Inscrição de Candidato
 * Instituto Tia Pretinha
 *
 * Envia os dados para o backend ITP que grava no banco.
 *
 * Configure o gatilho: Extensões → Apps Script → Gatilhos
 *   → Adicionar gatilho → aoEnviarFormulario → Do formulário → Ao enviar formulário
 *
 * Propriedades do script (Projeto → Configurações → Propriedades do script):
 *   EMAIL_VENDAS  = karina.livia.sales@gmail.com,gabrielagracianobezerra@gmail.com
 *   EMAIL_SUPORTE = goncalvecardoso@gmail.com
 *
 * A URL da API já está fixa no script abaixo.
 */

var API_URL_CANDIDATO = 'https://api.itp.institutotiapretinha.org/api/matriculas/inscricao';

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

/**
 * Lê campo do namedValues com comparação case-insensitive e sem pontuação final.
 * Aceita múltiplas chaves candidatas e retorna a primeira que tiver valor.
 */
function campo_(r, chaves) {
  if (!Array.isArray(chaves)) chaves = [chaves];
  // Tentativa exata primeiro (incluindo array do namedValues)
  for (var i = 0; i < chaves.length; i++) {
    var raw = r[chaves[i]];
    var v = str_(raw ? raw[0] : null);
    if (v) return v;
  }
  // Fallback case-insensitive + sem pontuação final
  var normalize = function(s) { return s.toLowerCase().replace(/[:\s]+$/, '').trim(); };
  var normalizedKeys = chaves.map(normalize);
  for (var key in r) {
    var nk = normalize(key);
    for (var j = 0; j < normalizedKeys.length; j++) {
      if (nk === normalizedKeys[j]) {
        var raw2 = r[key];
        var v2 = str_(raw2 ? raw2[0] : null);
        if (v2) return v2;
      }
    }
  }
  return null;
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
    nome_completo:        campo_(r, ['Nome completo', 'Nome Completo', 'Nome completo:'])   || '',
    email:                campo_(r, ['Endereço de e-mail', 'E-mail', 'Email'])              || '',
    cpf:                  digits_(campo_(r, ['CPF', 'CPF:']))                               || '',
    celular:              digits_(campo_(r, ['Celular', 'Celular:']))                       || '',
    data_nascimento:      dataISO_(campo_(r, ['Data de Nascimento', 'Data de nascimento'])),
    idade:                (function() { var v = campo_(r, ['Idade', 'Idade:']); return v ? parseInt(v.replace(/\D/g, '')) || null : null; })(),
    sexo:                 campo_(r, ['Sexo', 'Sexo:']),
    escolaridade:         campo_(r, ['Escolaridade', 'Escolaridade:']),
    turno_escolar:        campo_(r, ['Turno escolar', 'Turno escolar:']),
    maior_18_anos:        bool_(campo_(r, ['Maior de 18 anos', 'Maior de 18 anos:'])),
    logradouro:           campo_(r, ['Logradouro', 'Logradouro:']),
    numero:               campo_(r, ['Número', 'Número:', 'Numero']),
    complemento:          campo_(r, ['Complemento', 'Complemento:']),
    bairro:               campo_(r, ['Bairro', 'Bairro:']),
    cidade:               campo_(r, ['Cidade', 'Cidade:'])           || 'Rio de Janeiro',
    estado_uf:            campo_(r, ['Estado (UF)', 'Estado (UF):', 'Estado', 'Estado:']) || 'RJ',
    cep:                  digits_(campo_(r, ['CEP', 'CEP:'])),
    nome_responsavel:     campo_(r, ['Nome Completo do Responsável', 'Nome do Responsável', 'Nome completo do responsável']),
    grau_parentesco:      campo_(r, ['Grau de parentesco do responsável', 'Grau de parentesco']),
    cpf_responsavel:      digits_(campo_(r, ['CPF do Responsável', 'CPF do responsável'])),
    telefone_alternativo: digits_(campo_(r, ['Telefone alternativo', 'Telefone alternativo:'])),
    possui_alergias:      campo_(r, ['Possui alergias', 'Possui alergias:']),
    cuidado_especial:     campo_(r, ['Necessita de cuidado especial', 'Necessita de cuidado especial:']),
    detalhes_cuidado:     campo_(r, ['Detalhes do cuidado', 'Detalhes do cuidado:']),
    uso_medicamento:      campo_(r, ['Faz uso de medicamento', 'Faz uso de medicamento:']),
    cursos_desejados:     campo_(r, ['Cursos desejados', 'Cursos desejados:']),
    lgpd_aceito:          bool_(campo_(r, ['LGPD Aceito', 'LGPD Aceito:'])),
    autoriza_imagem:      bool_(campo_(r, ['Autoriza uso de imagem', 'Autoriza uso de imagem:'])),
  };

  Logger.log('👤 Candidato: ' + dados.nome_completo + ' | CPF: ' + dados.cpf);

  // ── Salva na planilha (independente do banco) ─────────────────────
  salvarNaPlanilha_(dados);

  // ── POST para o backend ITP ───────────────────────────────────────
  var sucesso = false;
  var erroMsg = '';

  try {
    var body = {
      nome_completo:        dados.nome_completo,
      email:                dados.email,
      cpf:                  dados.cpf,
      celular:              dados.celular,
      data_nascimento:      dados.data_nascimento,
      idade:                dados.idade,
      sexo:                 dados.sexo,
      escolaridade:         dados.escolaridade,
      turno_escolar:        dados.turno_escolar,
      maior_18_anos:        dados.maior_18_anos,
      logradouro:           dados.logradouro,
      numero:               dados.numero,
      complemento:          dados.complemento,
      bairro:               dados.bairro,
      cidade:               dados.cidade,
      estado_uf:            dados.estado_uf,
      cep:                  dados.cep,
      nome_responsavel:     dados.nome_responsavel,
      grau_parentesco:      dados.grau_parentesco,
      cpf_responsavel:      dados.cpf_responsavel,
      telefone_alternativo: dados.telefone_alternativo,
      possui_alergias:      dados.possui_alergias,
      cuidado_especial:     dados.cuidado_especial,
      detalhes_cuidado:     dados.detalhes_cuidado,
      uso_medicamento:      dados.uso_medicamento,
      cursos_desejados:     dados.cursos_desejados,
      lgpd_aceito:          dados.lgpd_aceito,
      autoriza_imagem:      dados.autoriza_imagem,
      status_matricula:     'Pendente',
      origem_inscricao:     'Forms',
      data_inscricao:       new Date().toISOString(),
    };

    var response = UrlFetchApp.fetch(API_URL_CANDIDATO, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(body),
      muteHttpExceptions: true,
    });

    var code = response.getResponseCode();
    var text = response.getContentText();

    if (code >= 200 && code < 300) {
      sucesso = true;
      Logger.log('✅ Candidato cadastrado: ' + dados.nome_completo + ' (HTTP ' + code + ')');
    } else {
      erroMsg = 'HTTP ' + code + ' — ' + text;
      Logger.log('❌ ' + erroMsg);
    }

  } catch (err) {
    erroMsg = err.toString();
    Logger.log('❌ Erro: ' + erroMsg);
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

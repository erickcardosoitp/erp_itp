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
    var ss;

    // Se o script está vinculado ao FORM (não à planilha),
    // getActiveSpreadsheet() retorna null. Tenta via Form destination.
    try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch(ex) { ss = null; }

    if (!ss) {
      try {
        var form  = FormApp.getActiveForm();
        var destId = form ? form.getDestinationId() : null;
        if (destId) ss = SpreadsheetApp.openById(destId);
      } catch(ex2) { ss = null; }
    }

    if (!ss) {
      Logger.log('[Planilha] Nenhuma planilha vinculada — etapa ignorada.');
      return;
    }

    var aba = ss.getSheetByName('Respostas') || ss.getSheets()[0];
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

/**
 * Classifica o erro técnico em uma categoria amigável.
 * Retorna { titulo, orientacao } para compor o e-mail de forma compreensível.
 */
function classificarErro_(detalhe) {
  var d = (detalhe || '').toLowerCase();

  if (d.indexOf('já possui uma inscrição ativa') !== -1 || d.indexOf('cpf') !== -1 && d.indexOf('400') !== -1) {
    return {
      titulo: 'Inscrição duplicada (CPF já cadastrado)',
      orientacao: 'Este CPF já possui uma inscrição ativa no sistema. Verifique se o candidato já foi cadastrado anteriormente ou se precisa ter seu status atualizado (ex: Desistente) antes de uma nova inscrição.',
    };
  }
  if (d.indexOf('campos obrigatórios') !== -1 || d.indexOf('nome') !== -1 || d.indexOf('400') !== -1) {
    return {
      titulo: 'Dados incompletos no formulário',
      orientacao: 'O formulário não enviou todos os campos obrigatórios (nome completo e CPF são exigidos). Verifique se as perguntas obrigatórias do Google Forms estão marcadas corretamente.',
    };
  }
  if (d.indexOf('401') !== -1 || d.indexOf('403') !== -1) {
    return {
      titulo: 'Erro de autenticação na API',
      orientacao: 'A rota da API parece ter sido protegida por autenticação. Verifique se o endpoint /api/matriculas/inscricao ainda está marcado como @Public() no backend.',
    };
  }
  if (d.indexOf('404') !== -1) {
    return {
      titulo: 'Endpoint da API não encontrado',
      orientacao: 'A URL configurada no script não foi encontrada no servidor. Verifique se a API está em funcionamento e se o endereço está correto.',
    };
  }
  if (d.indexOf('500') !== -1 || d.indexOf('502') !== -1 || d.indexOf('503') !== -1) {
    return {
      titulo: 'Erro interno no servidor',
      orientacao: 'Houve uma falha inesperada no servidor no momento do envio. O dado pode não ter sido gravado. Verifique os logs do backend e confirme se a inscrição consta no sistema.',
    };
  }
  if (d.indexOf('urlfetch') !== -1 || d.indexOf('timeout') !== -1 || d.indexOf('network') !== -1 || d.indexOf('connection') !== -1) {
    return {
      titulo: 'Falha de conexão com a API',
      orientacao: 'O script não conseguiu alcançar o servidor. Pode ser uma instabilidade momentânea de rede ou o servidor pode estar fora do ar. Aguarde alguns minutos e verifique o status da API.',
    };
  }
  return {
    titulo: 'Erro inesperado ao gravar inscrição',
    orientacao: 'Ocorreu um erro não identificado. Verifique os logs do Apps Script e do backend para mais detalhes.',
  };
}

function notificarEquipe_(dados, sucesso, detalhe) {
  var emailVendas  = getConf_('EMAIL_VENDAS')  || 'karina.livia.sales@gmail.com,gabrielagracianobezerra@gmail.com';
  var emailSuporte = getConf_('EMAIL_SUPORTE') || 'goncalvecardoso@gmail.com';

  var resumo = '👤 Nome: '    + (dados.nome_completo   || '(não informado)') +
               '\n📄 CPF: '   + (dados.cpf             || '(não informado)') +
               '\n📱 Celular: ' + (dados.celular        || '(não informado)') +
               '\n📚 Cursos: ' + (dados.cursos_desejados|| '(não informado)') +
               '\n📧 E-mail: ' + (dados.email           || '(não informado)');

  if (sucesso) {
    MailApp.sendEmail(
      emailVendas,
      '✅ Nova Inscrição ITP — ' + dados.nome_completo,
      resumo + '\n\nStatus: ✅ Inscrição gravada com sucesso no sistema.\n' +
      'Acesse o painel para dar continuidade ao processo de matrícula:\n' +
      'https://www.institutotiapretinha.org/matriculas'
    );
  } else {
    var classificacao = classificarErro_(detalhe);

    // E-mail técnico para o suporte
    MailApp.sendEmail(
      emailSuporte,
      '🚨 ALERTA TÉCNICO ITP — ' + classificacao.titulo,
      '⚠️ Falha ao gravar inscrição no banco de dados.\n\n' +
      '🔎 Categoria do erro: ' + classificacao.titulo + '\n\n' +
      '💡 Orientação: ' + classificacao.orientacao + '\n\n' +
      '─────────────────────────\n' +
      'Detalhe técnico:\n' + detalhe + '\n\n' +
      'Dados do candidato:\n' + resumo + '\n\n' +
      'Data/hora: ' + new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    );

    // E-mail amigável para a equipe de vendas/matrículas
    MailApp.sendEmail(
      emailVendas,
      '⚠️ Atenção — Inscrição com pendência: ' + dados.nome_completo,
      'Olá!\n\n' +
      'A inscrição abaixo foi recebida pelo formulário, mas houve um problema ao salvá-la no sistema.\n\n' +
      resumo + '\n\n' +
      '❗ Motivo: ' + classificacao.titulo + '\n\n' +
      '👣 Próximo passo sugerido:\n' + classificacao.orientacao + '\n\n' +
      'O suporte técnico já foi notificado automaticamente.\n\n' +
      'Para dúvidas, entre em contato com: ' + emailSuporte
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
//  Gatilho principal — executado ao enviar o formulário
// ─────────────────────────────────────────────────────────────────────

/**
 * Reconstrói namedValues a partir de qualquer tipo de evento do Forms/Sheets.
 *
 * Caso 1 - Trigger vinculado à PLANILHA  → e.namedValues já existe.
 * Caso 2 - Trigger vinculado ao FORM     → e.response é um FormResponse;
 *          precisamos iterar getItemResponses() para montar o namedValues.
 * Caso 3 - Trigger da planilha sem namedValues → reconstrói via e.values + e.range.
 */
function reconstruirNamedValues_(e) {
  // Caso 1: planilha com namedValues pronto
  if (e && e.namedValues) return e.namedValues;

  var r = {};

  // Caso 2: trigger do Forms — e.response é um FormResponse object
  if (e && e.response && typeof e.response.getItemResponses === 'function') {
    var itemResponses = e.response.getItemResponses();
    for (var i = 0; i < itemResponses.length; i++) {
      var item   = itemResponses[i];
      var titulo = item.getItem().getTitle();
      var resp   = item.getResponse();
      // Caixas de seleção multipla retornam array → join
      r[titulo]  = [Array.isArray(resp) ? resp.join(', ') : (resp || '')];
    }
    return r;
  }

  // Caso 3: trigger da planilha sem namedValues (e.values + e.range)
  if (e && e.values && e.range) {
    var sheet   = e.range.getSheet();
    var headers = sheet.getRange(1, 1, 1, e.values.length).getValues()[0];
    for (var j = 0; j < headers.length; j++) {
      r[headers[j]] = [e.values[j]];
    }
    return r;
  }

  return r;
}

function aoEnviarFormulario(e) {
  Logger.log('🚀 Pipeline ITP iniciado');

  var r = reconstruirNamedValues_(e);

  if (Object.keys(r).length === 0) {
    Logger.log('❌ Evento vazio — nenhum campo extraído. Verifique o tipo de gatilho.');
    return;
  }

  Logger.log('Campos recebidos: ' + Object.keys(r).join(' | '));

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

function testeManual() {
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

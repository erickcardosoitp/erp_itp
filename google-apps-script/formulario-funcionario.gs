/**
 * Google Apps Script — Cadastro de Funcionário
 * Instituto Tia Pretinha
 *
 * Envia os dados para o backend ITP que grava no banco.
 *
 * Configure o gatilho: Extensões → Apps Script → Gatilhos
 *   → Adicionar gatilho → onFormSubmit → Do formulário → Ao enviar formulário
 *
 * Propriedades do script (Projeto → Configurações → Propriedades do script):
 *   WEBHOOK_SECRET = itp-forms-2026
 *   EMAIL_SUPORTE  = goncalvecardoso@gmail.com
 *   EMAIL_RH       = erickcardoso@institutotiapretinha.org  (opcional - equipe de RH/gestão)
 *
 * A URL da API já está fixa no script abaixo.
 */

var API_URL_FUNCIONARIO = 'https://api.itp.institutotiapretinha.org/api/funcionarios/webhook';

// ─────────────────────────────────────────────────────────────────────
//  Utilitários
// ─────────────────────────────────────────────────────────────────────

function getConf_(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}

function str_(v) {
  var s = (v || '').toString().trim();
  return s === '' ? null : s;
}

function simParaBool_(v) {
  if (!v) return false;
  return v.toString().trim().toLowerCase().startsWith('sim');
}

function dataParaISO_(value) {
  var v = str_(value);
  if (!v) return null;
  var partes = v.split('/');
  if (partes.length === 3 && partes[2].length === 4)
    return partes[2] + '-' + partes[1] + '-' + partes[0];
  return v;
}

/**
 * Lê campo do namedValues com comparação case-insensitive e sem pontuação final.
 * Aceita múltiplas chaves candidatas e retorna a primeira com valor.
 */
function campo_(r, chaves) {
  if (!Array.isArray(chaves)) chaves = [chaves];
  if (!r || typeof r !== 'object') return null;
  
  // Tentativa exata primeiro
  for (var i = 0; i < chaves.length; i++) {
    var raw = r[chaves[i]];
    if (raw && raw[0]) return str_(raw[0]);
  }
  
  // Fallback normalizado: lowercase, remove pontuação, replace spaces → underscore
  var normalize = function(s) { 
    return s.toLowerCase()
      .replace(/[:\s]+$/g, '')  // remove : e espaços FINAIS
      .replace(/\s+/g, '_')     // espaços → underscore
      .trim(); 
  };
  
  var nks = chaves.map(normalize);
  for (var key in r) {
    var nk = normalize(key);
    for (var j = 0; j < nks.length; j++) {
      if (nk === nks[j]) {
        var raw2 = r[key];
        if (raw2 && raw2[0]) return str_(raw2[0]);
      }
    }
  }
  
  return null;
}

// ─────────────────────────────────────────────────────────────────────
//  Extração universal do evento (Form trigger ou Sheets trigger)
// ─────────────────────────────────────────────────────────────────────

function extrairRespostas_(e) {
  Logger.log('🔎 Detectando estrutura do evento...');
  if (!e) { Logger.log('❌ Evento vazio'); return {}; }

  if (e.namedValues) {
    Logger.log('✅ Tipo: namedValues (planilha/teste manual)');
    return e.namedValues;
  }

  if (e.values && e.range) {
    Logger.log('✅ Tipo: Google Sheets');
    var r = {};
    var sheet = e.range.getSheet();
    var headers = sheet.getRange(1, 1, 1, e.values.length).getValues()[0];
    for (var i = 0; i < headers.length; i++) r[headers[i]] = [e.values[i]];
    return r;
  }

  if (e.response && typeof e.response.getItemResponses === 'function') {
    Logger.log('✅ Tipo: Google Forms');
    var r = {};
    var itens = e.response.getItemResponses();
    for (var i = 0; i < itens.length; i++) {
      var titulo = itens[i].getItem().getTitle();
      var resp = itens[i].getResponse();
      r[titulo] = [Array.isArray(resp) ? resp.join(', ') : (resp || '')];
      Logger.log('📌 ' + titulo + ' = ' + resp);
    }
    return r;
  }

  Logger.log('⚠️ Estrutura de evento desconhecida');
  return {};
}

// ─────────────────────────────────────────────────────────────────────
//  Classificação de erros para e-mails amigáveis
// ─────────────────────────────────────────────────────────────────────

function classificarErroFunc_(detalhe) {
  var d = (detalhe || '').toLowerCase();
  if (d.indexOf('401') !== -1 || d.indexOf('secret') !== -1) {
    return {
      titulo: 'Erro de autenticação na API',
      orientacao: 'A propriedade WEBHOOK_SECRET pode estar incorreta ou o endpoint não está mais público.',
    };
  }
  if (d.indexOf('duplicate key') !== -1 || d.indexOf('unique constraint') !== -1) {
    return {
      titulo: 'Cadastro duplicado (CPF ou matrícula já existente)',
      orientacao: 'Já existe um funcionário com esse CPF ou matrícula no sistema. Verifique em Gente > Colaboradores antes de relançar.',
    };
  }
  if (d.indexOf('nome') !== -1 && d.indexOf('400') !== -1) {
    return {
      titulo: 'Nome não encontrado no formulário',
      orientacao: 'O campo "Nome Completo" não foi enviado ou tem título diferente do esperado. Verifique as perguntas obrigatórias.',
    };
  }
  if (d.indexOf('404') !== -1) {
    return {
      titulo: 'Endpoint da API não encontrado',
      orientacao: 'Verifique se a API está em funcionamento e se a URL no script está correta.',
    };
  }
  if (d.indexOf('500') !== -1 || d.indexOf('502') !== -1 || d.indexOf('503') !== -1) {
    return {
      titulo: 'Erro interno no servidor',
      orientacao: 'Houve uma falha inesperada no servidor. Verifique os logs do backend.',
    };
  }
  if (d.indexOf('urlfetch') !== -1 || d.indexOf('timeout') !== -1 || d.indexOf('network') !== -1) {
    return {
      titulo: 'Falha de conexão com a API',
      orientacao: 'O servidor pode estar fora do ar. Aguarde alguns minutos e verifique o status da API.',
    };
  }
  return {
    titulo: 'Erro inesperado ao gravar cadastro',
    orientacao: 'Verifique os logs do Apps Script e do backend para mais detalhes.',
  };
}

// ─────────────────────────────────────────────────────────────────────
//  Notificações por e-mail
// ─────────────────────────────────────────────────────────────────────

function notificarEquipeFunc_(dados, sucesso, detalhe) {
  var emailSuporte = getConf_('EMAIL_SUPORTE') || 'goncalvecardoso@gmail.com';
  var emailRH      = getConf_('EMAIL_RH')      || emailSuporte;
  var dataHora     = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  var linhasDados = [
    ['👤 Nome',        dados.nome         || '(não informado)'],
    ['📄 CPF',         dados.cpf          || '(não informado)'],
    ['📧 E-mail',      dados.email        || '(não informado)'],
    ['📱 Celular',     dados.celular      || '(não informado)'],
    ['🎓 Escolaridade',dados.escolaridade || '(não informado)'],
    ['⚧ Sexo',        dados.sexo         || '(não informado)'],
  ];

  var tabelaHtml = '<table style="border-collapse:collapse;width:100%;font-size:14px;">';
  for (var i = 0; i < linhasDados.length; i++) {
    var bg = i % 2 === 0 ? '#f9f9f9' : '#ffffff';
    tabelaHtml += '<tr style="background:' + bg + ';">' +
      '<td style="padding:8px 12px;color:#555;font-weight:600;white-space:nowrap;border-bottom:1px solid #eee;">' + linhasDados[i][0] + '</td>' +
      '<td style="padding:8px 12px;color:#222;border-bottom:1px solid #eee;">' + linhasDados[i][1] + '</td>' +
      '</tr>';
  }
  tabelaHtml += '</table>';

  var estiloBase = 'font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0;';

  if (sucesso) {
    var htmlSucesso =
      '<div style="' + estiloBase + '">' +
        '<div style="background:#1a7f4b;padding:20px 24px;">' +
          '<h2 style="margin:0;color:#fff;font-size:18px;">✅ Novo cadastro de funcionário</h2>' +
          '<p style="margin:4px 0 0;color:#c8f5dc;font-size:13px;">' + dataHora + '</p>' +
        '</div>' +
        '<div style="padding:20px 24px;">' +
          '<p style="margin:0 0 16px;color:#333;">Um novo cadastro foi gravado com sucesso no sistema:</p>' +
          tabelaHtml +
          '<div style="margin-top:20px;text-align:center;">' +
            '<a href="https://itp.institutotiapretinha.org/gente" style="display:inline-block;background:#1a7f4b;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;">Abrir Gente &rarr; Colaboradores</a>' +
          '</div>' +
        '</div>' +
        '<div style="background:#f5f5f5;padding:12px 24px;font-size:11px;color:#999;text-align:center;">Instituto Tia Pretinha · Sistema ERP</div>' +
      '</div>';

    MailApp.sendEmail({
      to: emailRH,
      subject: '✅ Novo cadastro de funcionário ITP — ' + (dados.nome || '?'),
      htmlBody: htmlSucesso,
    });
  } else {
    var cls = classificarErroFunc_(detalhe);
    var htmlErro =
      '<div style="' + estiloBase + '">' +
        '<div style="background:#b91c1c;padding:20px 24px;">' +
          '<h2 style="margin:0;color:#fff;font-size:18px;">🚨 Falha no cadastro de funcionário</h2>' +
          '<p style="margin:4px 0 0;color:#fecaca;font-size:13px;">' + dataHora + '</p>' +
        '</div>' +
        '<div style="padding:20px 24px;">' +
          '<div style="background:#fff7ed;border-left:4px solid #f97316;padding:12px 16px;border-radius:4px;margin-bottom:20px;">' +
            '<p style="margin:0 0 4px;font-weight:700;color:#c2410c;">🔎 ' + cls.titulo + '</p>' +
            '<p style="margin:0;color:#7c2d12;font-size:13px;">💡 ' + cls.orientacao + '</p>' +
          '</div>' +
          '<h3 style="margin:0 0 10px;font-size:14px;color:#333;">Dados do funcionário</h3>' +
          tabelaHtml +
          '<div style="margin-top:20px;background:#fef2f2;border:1px solid #fecaca;border-radius:4px;padding:12px 16px;">' +
            '<p style="margin:0 0 4px;font-weight:700;color:#991b1b;font-size:12px;">Detalhe técnico</p>' +
            '<pre style="margin:0;font-size:11px;color:#7f1d1d;white-space:pre-wrap;word-break:break-all;">' + detalhe + '</pre>' +
          '</div>' +
          '<div style="margin-top:20px;text-align:center;">' +
            '<a href="https://itp.institutotiapretinha.org/gente" style="display:inline-block;background:#b91c1c;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;">Ver Gente &rarr; Colaboradores</a>' +
          '</div>' +
        '</div>' +
        '<div style="background:#f5f5f5;padding:12px 24px;font-size:11px;color:#999;text-align:center;">Instituto Tia Pretinha · Sistema ERP</div>' +
      '</div>';

    MailApp.sendEmail({
      to: emailSuporte,
      subject: '🚨 ALERTA — Falha no cadastro de funcionário: ' + (dados.nome || '?'),
      htmlBody: htmlErro,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────
//  Gatilho principal
// ─────────────────────────────────────────────────────────────────────

function onFormSubmit(e) {
  Logger.log('🚀 Formulário de funcionário recebido');

  var r = extrairRespostas_(e);

  if (Object.keys(r).length === 0) {
    Logger.log('❌ Evento vazio — nenhum campo extraído.');
    return;
  }

  Logger.log('Campos: ' + Object.keys(r).join(' | '));

  var dados = {
    nome:                   campo_(r, ['Nome Completo', 'Nome completo', 'Nome']),
    cargo:                  campo_(r, ['Cargo / Função', 'Cargo/Função', 'Cargo', 'Função', 'Especialidade', 'Cargo / Especialidade']),
    email:                  campo_(r, ['E-mail (Obrigatório)', 'E-mail', 'Email', 'Endereço de e-mail']),
    cpf:                    campo_(r, ['CPF (Obrigatório)', 'CPF']),
    data_nascimento:        dataParaISO_(campo_(r, ['Data de Nascimento (Obrigatório)', 'Data de Nascimento', 'Data de nascimento'])),
    celular:                campo_(r, ['Celular (Obrigatório)', 'Celular']),
    sexo:                   campo_(r, ['Sexo (Obrigatório)', 'Sexo']),
    // Endereço (o formulário não tem logradouro/bairro/cidade — só CEP, número, complemento, estado)
    cep:                    campo_(r, ['CEP', 'Cep']),
    numero:                 campo_(r, ['Número da Residência', 'Número', 'Numero']),
    complemento:            campo_(r, ['Complemento (Ex: Apartamento, Bloco)', 'Complemento']),
    estado:                 campo_(r, ['Estado (Ex: RJ, SP)', 'Estado (UF)', 'Estado', 'UF']),
    // Perfil
    raca:                   campo_(r, ['Raça/Cor', 'Raça / Cor', 'Raça', 'Raca/Cor', 'Raça/Cor (Obrigatório)', 'Etnia', 'Raça / Etnia']),
    escolaridade:           campo_(r, ['Escolaridade']),
    // Emergência
    telefone_emergencia_1:  campo_(r, ['Telefone de Emergência 1 (Obrigatório)', 'Telefone de Emergência 1', 'Telefone emergência 1', 'Tel. Emergência 1', 'Contato de Emergência 1', 'Emergência 1']),
    telefone_emergencia_2:  campo_(r, ['Telefone de Emergência 2 (Opcional)', 'Telefone de Emergência 2', 'Telefone emergência 2', 'Tel. Emergência 2', 'Contato de Emergência 2', 'Emergência 2']),
    // Saúde
    possui_deficiencia:     simParaBool_(campo_(r, ['Possui algum tipo de deficiência?', 'Possui deficiência?'])),
    descricao_deficiencia:  campo_(r, ['Se sim, qual(is) deficiência(s) possui? (Descreva)', 'Descreva a deficiência', 'Qual deficiência?']),
    possui_alergia:         simParaBool_(campo_(r, ['Possui Alergias?', 'Possui alergias?', 'Possui alergia?'])),
    descricao_alergia:      campo_(r, ['Se sim, qual(is) tipo(s) de alergia possui? (Descreva)', 'Descreva as alergias', 'Qual alergia?']),
    usa_medicamento:        simParaBool_(campo_(r, ['Faz uso contínuo de algum tipo de medicamento?', 'Usa medicamentos?', 'Usa medicamento contínuo?'])),
    descricao_medicamento:  campo_(r, ['Se sim, quais medicamentos utiliza? (Nome e dosagem, se souber)', 'Quais medicamentos?', 'Qual medicamento?']),
    // Interesse e perfil social (novos campos)
    interesse_cursos:       simParaBool_(campo_(r, ['Tem interesse em se matricular em algum curso do Instituto Tia Pretinha?', 'Interesse em cursos?', 'Interesse em Cursos?'])),
    genero:                 campo_(r, ['Gênero', 'Genero']),
    pertence_comunidade_tradicional: simParaBool_(campo_(r, ['Pertence a algum grupo de comunidade tradicional?', 'Pertence a comunidade tradicional?'])),
    comunidade_tradicional: campo_(r, ['Se sim, qual?', 'Qual comunidade tradicional?']),
    possui_cad_unico:       simParaBool_(campo_(r, ['Possui cadastro no Cad Unico?', 'Possui CadÚnico?', 'Tem CadÚnico?'])),
    baixo_idh:              simParaBool_(campo_(r, ['Reside em um lugar de baixo índice de desenvolvimento?', 'Área de baixo IDH?'])),
    ativo:                  true,
  };

  Logger.log('👤 Funcionário: ' + dados.nome + ' | Email: ' + dados.email);

  if (!dados.nome) {
    Logger.log('❌ Nome não encontrado. Cancelando.');
    return;
  }

  var sucesso = false;
  var erroMsg = '';

  try {
    var secret = getConf_('WEBHOOK_SECRET') || 'itp-forms-2026';

    var response = UrlFetchApp.fetch(API_URL_FUNCIONARIO, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-itp-webhook-secret': secret },
      payload: JSON.stringify(dados),
      muteHttpExceptions: true,
    });

    var code = response.getResponseCode();
    var text = response.getContentText();

    if (code >= 200 && code < 300) {
      sucesso = true;
      Logger.log('✅ Funcionário cadastrado: ' + dados.nome + ' (HTTP ' + code + ')');
    } else {
      erroMsg = 'HTTP ' + code + ' — ' + text;
      Logger.log('❌ ' + erroMsg);
    }
  } catch (err) {
    erroMsg = err.toString();
    Logger.log('❌ Exceção: ' + erroMsg);
  }

  notificarEquipeFunc_(dados, sucesso, erroMsg);
}

// ─────────────────────────────────────────────────────────────────────
//  Teste manual — rode no editor do Apps Script para validar sem form
// ─────────────────────────────────────────────────────────────────────

function testeManual() {
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
      'Gênero':                             ['Feminino cisgênero'],
      'Pertence a algum grupo de comunidade tradicional?': ['Não'],
      'Se sim, qual?':                      [''],
      'Possui cadastro no Cad Unico?':      ['Não'],
      'Reside em um lugar de baixo índice de desenvolvimento?': ['Não'],
    },
  };
  onFormSubmit(fakeEvent);
}



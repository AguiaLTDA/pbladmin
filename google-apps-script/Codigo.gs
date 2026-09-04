/**
 * Plataforma PBL — UNIVC
 * Web App do Google Apps Script responsável por persistir o cadastro
 * de estudantes em uma planilha do Google Sheets.
 *
 * COMO PUBLICAR (resumo — passo a passo completo em README_APPS_SCRIPT.md):
 *  1. Crie uma planilha no Google Sheets.
 *  2. Extensões > Apps Script, cole este arquivo e salve.
 *  3. Ajuste as constantes abaixo (principalmente TOKEN).
 *  4. Implantar > Nova implantação > Tipo: App da Web
 *     - Executar como: Eu
 *     - Quem pode acessar: Qualquer pessoa
 *  5. Copie a URL /exec gerada para VITE_GOOGLE_SHEETS_URL no client.
 */

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

/** Token compartilhado com o frontend. TROQUE por um valor próprio. */
var TOKEN = 'pbl-univc-2026';

/** Nome da aba onde os estudantes são gravados (criada automaticamente). */
var ABA_ESTUDANTES = 'Estudantes';

/** Colunas gravadas na planilha, na ordem. */
var COLUNAS = [
  'ID',
  'Data do Cadastro',
  'Nome Completo',
  'E-mail',
  'Matricula',
  'CPF',
  'Telefone',
  'Curso',
  'Turma',
  'Periodo',
  'Origem',
  'Status'
];

// ---------------------------------------------------------------------------
// Endpoints HTTP
// ---------------------------------------------------------------------------

/**
 * POST — cadastra um estudante.
 * Corpo (JSON, enviado como text/plain para evitar preflight de CORS):
 *   { token, nome, email, matricula, cpf, telefone, curso, turma, periodo, origem }
 */
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    if (body.token !== TOKEN) {
      return json({ ok: false, message: 'Token inválido.' });
    }

    var erro = validar(body);
    if (erro) {
      return json({ ok: false, message: erro });
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);

    try {
      var aba = getAba();
      var registros = lerRegistros(aba);

      var emailNormalizado = String(body.email).trim().toLowerCase();
      var matriculaNormalizada = String(body.matricula || '').trim().toLowerCase();

      for (var i = 0; i < registros.length; i++) {
        if (String(registros[i]['E-mail']).trim().toLowerCase() === emailNormalizado) {
          return json({ ok: false, message: 'Já existe um cadastro com este e-mail.' });
        }
        if (
          matriculaNormalizada &&
          String(registros[i]['Matricula']).trim().toLowerCase() === matriculaNormalizada
        ) {
          return json({ ok: false, message: 'Já existe um cadastro com esta matrícula.' });
        }
      }

      var id = 'EST-' + Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyyMMdd-HHmmss');
      var linha = [
        id,
        Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm:ss'),
        limpar(body.nome),
        emailNormalizado,
        limpar(body.matricula),
        limpar(body.cpf),
        limpar(body.telefone),
        limpar(body.curso),
        limpar(body.turma),
        limpar(body.periodo),
        limpar(body.origem) || 'PORTAL',
        'PENDENTE'
      ];

      aba.appendRow(linha);

      return json({ ok: true, id: id, message: 'Cadastro registrado com sucesso.' });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json({ ok: false, message: 'Erro interno: ' + err });
  }
}

/**
 * GET — lista os estudantes cadastrados.
 *   ?token=SEU_TOKEN&action=list
 */
function doGet(e) {
  try {
    var params = (e && e.parameter) || {};

    if (params.token !== TOKEN) {
      return json({ ok: false, message: 'Token inválido.' });
    }

    if (params.action === 'ping') {
      return json({ ok: true, message: 'Web App ativo.' });
    }

    var registros = lerRegistros(getAba());

    var estudantes = registros.map(function (r) {
      return {
        id: r['ID'],
        criadoEm: r['Data do Cadastro'],
        nome: r['Nome Completo'],
        email: r['E-mail'],
        matricula: r['Matricula'],
        cpf: r['CPF'],
        telefone: r['Telefone'],
        curso: r['Curso'],
        turma: r['Turma'],
        periodo: r['Periodo'],
        origem: r['Origem'],
        status: r['Status']
      };
    });

    estudantes.reverse(); // mais recentes primeiro

    return json({ ok: true, total: estudantes.length, estudantes: estudantes });
  } catch (err) {
    return json({ ok: false, message: 'Erro interno: ' + err });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAba() {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  var aba = planilha.getSheetByName(ABA_ESTUDANTES);

  if (!aba) {
    aba = planilha.insertSheet(ABA_ESTUDANTES);
  }

  if (aba.getLastRow() === 0) {
    aba.appendRow(COLUNAS);
    aba.getRange(1, 1, 1, COLUNAS.length).setFontWeight('bold');
    aba.setFrozenRows(1);
  }

  return aba;
}

function lerRegistros(aba) {
  var ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return [];

  var valores = aba.getRange(1, 1, ultimaLinha, COLUNAS.length).getValues();
  var cabecalho = valores.shift();

  return valores.map(function (linha) {
    var obj = {};
    cabecalho.forEach(function (coluna, i) {
      obj[coluna] = linha[i] === null || linha[i] === undefined ? '' : linha[i];
    });
    return obj;
  });
}

function validar(body) {
  if (!limpar(body.nome)) return 'O nome completo é obrigatório.';
  if (!limpar(body.email)) return 'O e-mail é obrigatório.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(limpar(body.email))) return 'E-mail inválido.';
  if (!limpar(body.matricula)) return 'A matrícula é obrigatória.';
  if (!limpar(body.curso)) return 'O curso é obrigatório.';
  return null;
}

function limpar(valor) {
  return valor === null || valor === undefined ? '' : String(valor).trim();
}

/**
 * O Apps Script sempre responde HTTP 200; o sucesso/erro vai no campo `ok`
 * do corpo, que é o que o frontend verifica.
 */
function json(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

import { google } from 'googleapis';
import path from 'path';
import { Readable } from 'stream';

// Local/dev: aponta para o arquivo baixado do Google Cloud Console.
// Produção (Render e afins, sem disco persistente para um arquivo): o conteúdo
// inteiro do JSON da chave vai direto numa variável de ambiente.
const KEY_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
const KEY_FILE = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE
  ? path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE)
  : undefined;

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

const auth = new google.auth.GoogleAuth({
  ...(KEY_JSON ? { credentials: JSON.parse(KEY_JSON) } : { keyFile: KEY_FILE }),
  // drive.file: a conta de serviço só enxerga arquivos que ela mesma criou via API,
  // suficiente aqui porque todo upload passa por este módulo.
  scopes: ['https://www.googleapis.com/auth/drive.file']
});

const drive = google.drive({ version: 'v3', auth });

export async function uploadToDrive(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: FOLDER_ID ? [FOLDER_ID] : undefined
    },
    media: {
      mimeType,
      body: Readable.from(buffer)
    },
    // Necessário para gravar dentro de um Drive Compartilhado (Shared Drive).
    supportsAllDrives: true,
    fields: 'id'
  });

  if (!res.data.id) {
    throw new Error('O Google Drive não retornou um id para o arquivo enviado.');
  }
  return res.data.id;
}

export async function downloadFromDrive(fileId: string): Promise<NodeJS.ReadableStream> {
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' }
  );
  return res.data as unknown as NodeJS.ReadableStream;
}

export async function deleteFromDrive(fileId: string): Promise<void> {
  await drive.files.delete({ fileId, supportsAllDrives: true });
}

/**
 * Pasta de quarentena dentro da pasta principal. O arquivo excluído no portal vai
 * para cá em vez de ser apagado: some da vista de quem trabalha no Drive, mas
 * continua recuperável por quem tem acesso à pasta — a exclusão no portal é
 * definitiva do lado do banco (não há rota de restauração), então o conteúdo
 * precisa sobreviver a um clique errado.
 */
const NOME_PASTA_EXCLUIDOS = 'Excluídos';
const MIME_PASTA = 'application/vnd.google-apps.folder';

// Uma busca por exclusão seria desperdício: o id não muda enquanto o processo
// vive. `null` = ainda não resolvido nesta execução.
let pastaExcluidosId: string | null = process.env.GOOGLE_DRIVE_TRASH_FOLDER_ID || null;

async function getPastaExcluidosId(): Promise<string> {
  if (pastaExcluidosId) return pastaExcluidosId;

  // O escopo é drive.file: a conta de serviço só enxerga o que ela mesma criou.
  // Uma pasta "Excluídos" criada à mão pela interface do Drive seria invisível
  // aqui — por isso a busca pode falhar e a criação abaixo é o caminho normal na
  // primeira exclusão. Para reaproveitar uma pasta existente, informe o id em
  // GOOGLE_DRIVE_TRASH_FOLDER_ID e compartilhe-a com a conta de serviço.
  const filtros = [
    `name = '${NOME_PASTA_EXCLUIDOS}'`,
    `mimeType = '${MIME_PASTA}'`,
    'trashed = false',
    ...(FOLDER_ID ? [`'${FOLDER_ID}' in parents`] : [])
  ];

  const busca = await drive.files.list({
    q: filtros.join(' and '),
    fields: 'files(id)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });

  const encontrada = busca.data.files?.[0]?.id;
  if (encontrada) {
    pastaExcluidosId = encontrada;
    return encontrada;
  }

  const criada = await drive.files.create({
    requestBody: {
      name: NOME_PASTA_EXCLUIDOS,
      mimeType: MIME_PASTA,
      parents: FOLDER_ID ? [FOLDER_ID] : undefined
    },
    supportsAllDrives: true,
    fields: 'id'
  });

  if (!criada.data.id) {
    throw new Error('O Google Drive não retornou um id para a pasta de excluídos.');
  }
  pastaExcluidosId = criada.data.id;
  return pastaExcluidosId;
}

/**
 * Move o arquivo para a pasta "Excluídos". Devolve `false` quando o arquivo já
 * não existe no Drive — situação esperada (exclusão anterior interrompida, ou
 * alguém mexeu direto no Drive) e não um erro a propagar.
 */
export async function moverParaExcluidosNoDrive(fileId: string): Promise<boolean> {
  const destino = await getPastaExcluidosId();

  let paisAtuais: string[];
  try {
    const atual = await drive.files.get({ fileId, fields: 'parents', supportsAllDrives: true });
    paisAtuais = atual.data.parents || [];
  } catch (err: any) {
    if (err?.code === 404 || err?.response?.status === 404) return false;
    throw err;
  }

  // Já está lá: repetir a exclusão não deve falhar nem duplicar o vínculo.
  if (paisAtuais.length === 1 && paisAtuais[0] === destino) return true;

  await drive.files.update({
    fileId,
    addParents: destino,
    // Sem isto o arquivo ficaria nas duas pastas ao mesmo tempo (no Drive, "mover"
    // é trocar o pai) e continuaria à vista na pasta de origem.
    removeParents: paisAtuais.join(','),
    supportsAllDrives: true,
    fields: 'id'
  });

  return true;
}

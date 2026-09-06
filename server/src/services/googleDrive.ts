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

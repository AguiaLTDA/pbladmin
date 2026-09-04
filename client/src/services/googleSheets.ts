import { StudentRegistration, StudentRegistrationInput } from '../types';

/**
 * Integração com o Google Sheets através de um Web App do Google Apps Script.
 *
 * O código do Web App está em `google-apps-script/Codigo.gs`, na raiz do
 * repositório. Configure a URL publicada e o token nas variáveis de ambiente
 * do client (`.env` local e Secrets do GitHub Actions):
 *
 *   VITE_GOOGLE_SHEETS_URL=https://script.google.com/macros/s/.../exec
 *   VITE_GOOGLE_SHEETS_TOKEN=seu-token
 */

const WEBAPP_URL = (import.meta.env.VITE_GOOGLE_SHEETS_URL || '').trim();
const WEBAPP_TOKEN = (import.meta.env.VITE_GOOGLE_SHEETS_TOKEN || '').trim();

const PENDING_KEY = 'pbl_cadastros_pendentes';

export const isGoogleSheetsConfigured = Boolean(WEBAPP_URL);

if (!isGoogleSheetsConfigured) {
  console.warn(
    '⚠️ VITE_GOOGLE_SHEETS_URL não configurada. Os cadastros de estudantes ficarão apenas na fila local do navegador.'
  );
}

interface SheetsResponse {
  ok: boolean;
  message?: string;
  id?: string;
  total?: number;
  estudantes?: StudentRegistration[];
}

/**
 * O Apps Script devolve HTML (tela de login/erro) quando a implantação não está
 * pública. Sem isso, o usuário veria um "Unexpected token <" incompreensível.
 */
async function parseResposta(response: Response): Promise<SheetsResponse> {
  const texto = await response.text();

  try {
    return JSON.parse(texto) as SheetsResponse;
  } catch {
    throw new Error(
      'O Web App do Google respondeu em formato inesperado. Confira se a implantação está publicada com acesso "Qualquer pessoa".'
    );
  }
}

/** Lê a fila local de cadastros que ainda não chegaram na planilha. */
export function getPendingRegistrations(): StudentRegistration[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as StudentRegistration[]) : [];
  } catch {
    return [];
  }
}

function savePendingRegistrations(items: StudentRegistration[]) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(items));
  } catch {
    /* quota estourada ou modo privado: ignora silenciosamente */
  }
}

function enqueue(input: StudentRegistrationInput): StudentRegistration {
  const registro: StudentRegistration = {
    ...input,
    id: `LOCAL-${Date.now()}`,
    criadoEm: new Date().toLocaleString('pt-BR'),
    status: 'PENDENTE_SINCRONIZACAO'
  };

  savePendingRegistrations([...getPendingRegistrations(), registro]);
  return registro;
}

/**
 * Envia um cadastro de estudante para a planilha.
 *
 * O corpo é enviado como `text/plain` de propósito: o Apps Script não responde
 * a requisições OPTIONS, então esse content-type evita o preflight de CORS.
 */
export async function registerStudent(
  input: StudentRegistrationInput
): Promise<{ id: string; sincronizado: boolean; message: string }> {
  if (!isGoogleSheetsConfigured) {
    const registro = enqueue(input);
    return {
      id: registro.id,
      sincronizado: false,
      message:
        'Cadastro salvo localmente. Configure VITE_GOOGLE_SHEETS_URL para gravar na planilha do Google.'
    };
  }

  try {
    const response = await fetch(WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...input, token: WEBAPP_TOKEN, origem: input.origem || 'PORTAL' })
    });

    const data = await parseResposta(response);

    if (!data.ok) {
      throw new Error(data.message || 'A planilha recusou o cadastro.');
    }

    return {
      id: data.id || '',
      sincronizado: true,
      message: data.message || 'Cadastro gravado na planilha com sucesso.'
    };
  } catch (err: any) {
    // Duplicidade e validação vêm com ok:false e devem ser mostradas ao usuário,
    // não enfileiradas. Falha de rede, sim.
    if (err instanceof TypeError) {
      const registro = enqueue(input);
      return {
        id: registro.id,
        sincronizado: false,
        message:
          'Sem conexão com a planilha agora. O cadastro ficou na fila local e pode ser reenviado depois.'
      };
    }

    throw err;
  }
}

/** Reenvia para a planilha os cadastros que ficaram na fila local. */
export async function syncPendingRegistrations(): Promise<{ enviados: number; restantes: number }> {
  const pendentes = getPendingRegistrations();
  if (!pendentes.length || !isGoogleSheetsConfigured) {
    return { enviados: 0, restantes: pendentes.length };
  }

  const restantes: StudentRegistration[] = [];
  let enviados = 0;

  for (const item of pendentes) {
    const { id, criadoEm, status, ...input } = item;

    try {
      const res = await registerStudent(input as StudentRegistrationInput);
      if (res.sincronizado) enviados += 1;
      else restantes.push(item);
    } catch {
      // Rejeitado pela planilha (duplicado ou inválido): sai da fila de vez,
      // reenviar não mudaria o resultado.
    }
  }

  savePendingRegistrations(restantes);
  return { enviados, restantes: restantes.length };
}

/** Lista os estudantes já gravados na planilha. */
export async function listStudents(): Promise<StudentRegistration[]> {
  if (!isGoogleSheetsConfigured) {
    return getPendingRegistrations();
  }

  const url = `${WEBAPP_URL}?action=list&token=${encodeURIComponent(WEBAPP_TOKEN)}`;
  const response = await fetch(url);
  const data = await parseResposta(response);

  if (!data.ok) {
    throw new Error(data.message || 'Não foi possível ler a planilha.');
  }

  return [...(data.estudantes || []), ...getPendingRegistrations()];
}

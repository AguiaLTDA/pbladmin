/**
 * Envio de e-mails transacionais do portal (verificação de cadastro e
 * recuperação de senha).
 *
 * Fala com a API HTTP de um provedor — Resend, Brevo ou SendGrid — escolhido
 * por `EMAIL_PROVIDER`. Os três recebem um POST com corpo JSON e chave no
 * header, então cada adaptador cabe em poucas linhas e trocar de fornecedor é
 * mudar uma variável de ambiente, sem tocar no código que chama daqui.
 *
 * Sem `EMAIL_API_KEY` configurada, `emailConfigurado()` devolve false e os
 * fluxos que dependem de e-mail se degradam de forma explícita (ver
 * authController / preCadastroController) em vez de deixar o aluno preso.
 */
import dotenv from 'dotenv';

dotenv.config();

type Provedor = 'resend' | 'brevo' | 'sendgrid';

const PROVEDOR = (process.env.EMAIL_PROVIDER || 'resend').toLowerCase() as Provedor;
const API_KEY = process.env.EMAIL_API_KEY || '';
const REMETENTE_EMAIL = process.env.EMAIL_FROM || '';
const REMETENTE_NOME = process.env.EMAIL_FROM_NOME || 'Portal PBL — UNIVC';

/** URL pública do portal, usada para montar os links enviados por e-mail. */
export const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

export function emailConfigurado(): boolean {
  return Boolean(API_KEY && REMETENTE_EMAIL);
}

/** Motivo pelo qual o envio está indisponível, para log e diagnóstico. */
export function motivoEmailIndisponivel(): string | null {
  if (!API_KEY) return 'EMAIL_API_KEY não definida';
  if (!REMETENTE_EMAIL) return 'EMAIL_FROM não definido';
  if (!['resend', 'brevo', 'sendgrid'].includes(PROVEDOR)) {
    return `EMAIL_PROVIDER inválido: "${PROVEDOR}" (use resend, brevo ou sendgrid)`;
  }
  return null;
}

interface Mensagem {
  para: string;
  nomeDestinatario?: string;
  assunto: string;
  html: string;
  texto: string;
}

async function enviarViaResend(m: Mensagem): Promise<void> {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${REMETENTE_NOME} <${REMETENTE_EMAIL}>`,
      to: [m.para],
      subject: m.assunto,
      html: m.html,
      text: m.texto
    })
  });
  if (!resp.ok) throw new Error(`Resend respondeu ${resp.status}: ${await resp.text()}`);
}

async function enviarViaBrevo(m: Mensagem): Promise<void> {
  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: REMETENTE_EMAIL, name: REMETENTE_NOME },
      to: [{ email: m.para, name: m.nomeDestinatario || m.para }],
      subject: m.assunto,
      htmlContent: m.html,
      textContent: m.texto
    })
  });
  if (!resp.ok) throw new Error(`Brevo respondeu ${resp.status}: ${await resp.text()}`);
}

async function enviarViaSendgrid(m: Mensagem): Promise<void> {
  const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: m.para, name: m.nomeDestinatario }] }],
      from: { email: REMETENTE_EMAIL, name: REMETENTE_NOME },
      subject: m.assunto,
      content: [
        { type: 'text/plain', value: m.texto },
        { type: 'text/html', value: m.html }
      ]
    })
  });
  if (!resp.ok) throw new Error(`SendGrid respondeu ${resp.status}: ${await resp.text()}`);
}

/**
 * Entrega a mensagem pelo provedor configurado.
 * Lança se o envio falhar — quem chama decide se isso derruba a operação
 * (cadastro) ou só é registrado (reenvio).
 */
export async function enviarEmail(m: Mensagem): Promise<void> {
  const impedimento = motivoEmailIndisponivel();
  if (impedimento) throw new Error(`Envio de e-mail indisponível: ${impedimento}`);

  if (PROVEDOR === 'brevo') return enviarViaBrevo(m);
  if (PROVEDOR === 'sendgrid') return enviarViaSendgrid(m);
  return enviarViaResend(m);
}

// --- Modelos das mensagens ---------------------------------------------------

/** Escapa o que vai interpolado no HTML — nome é texto livre digitado pelo aluno. */
function esc(texto: string): string {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function moldura(titulo: string, corpo: string, botaoTexto: string, link: string): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
    <tr><td style="background:#0f3d2e;padding:20px 28px;color:#ffffff">
      <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85">UNIVC — Centro Universitário Vale do Cricaré</div>
      <div style="font-size:18px;font-weight:700;margin-top:4px">Portal de Atividades PBL</div>
    </td></tr>
    <tr><td style="padding:28px">
      <h1 style="margin:0 0 12px;font-size:20px">${esc(titulo)}</h1>
      ${corpo}
      <p style="margin:24px 0">
        <a href="${link}" style="display:inline-block;background:#c2410c;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700">${esc(botaoTexto)}</a>
      </p>
      <p style="margin:0;font-size:13px;color:#64748b">
        Se o botão não funcionar, copie e cole este endereço no navegador:<br>
        <span style="word-break:break-all;color:#0f172a">${link}</span>
      </p>
    </td></tr>
    <tr><td style="padding:16px 28px;background:#f8fafc;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0">
      Mensagem automática da Coordenadoria Acadêmica. Não responda a este e-mail.
    </td></tr>
  </table>
</body></html>`;
}

export function montarEmailVerificacao(nome: string, link: string, horasValidade: number): Mensagem {
  const primeiroNome = nome.trim().split(/\s+/)[0] || 'estudante';
  const corpo = `
    <p style="margin:0 0 12px;line-height:1.6">Olá, ${esc(primeiroNome)}! Seu cadastro no Portal PBL foi recebido.</p>
    <p style="margin:0;line-height:1.6">Falta só confirmar que este e-mail é seu. Clique no botão abaixo para
    validar o cadastro e liberar o acesso ao portal. O link vale por ${horasValidade} horas.</p>`;
  const texto = `Ola, ${primeiroNome}! Confirme seu cadastro no Portal PBL acessando: ${link} (o link vale por ${horasValidade} horas).`;
  return {
    para: '',
    nomeDestinatario: nome,
    assunto: 'Confirme seu cadastro no Portal PBL',
    html: moldura('Confirme seu e-mail', corpo, 'Validar meu cadastro', link),
    texto
  };
}

export function montarEmailRecuperacao(nome: string, link: string, minutosValidade: number): Mensagem {
  const primeiroNome = nome.trim().split(/\s+/)[0] || 'estudante';
  const corpo = `
    <p style="margin:0 0 12px;line-height:1.6">Olá, ${esc(primeiroNome)}. Recebemos um pedido para redefinir a
    senha da sua conta no Portal PBL.</p>
    <p style="margin:0;line-height:1.6">Clique no botão abaixo para cadastrar uma nova senha. O link vale por
    ${minutosValidade} minutos e só pode ser usado uma vez. Se não foi você que pediu, ignore esta mensagem —
    sua senha atual continua valendo.</p>`;
  const texto = `Ola, ${primeiroNome}. Para redefinir sua senha do Portal PBL, acesse: ${link} (valido por ${minutosValidade} minutos, uso unico). Se nao foi voce que pediu, ignore esta mensagem.`;
  return {
    para: '',
    nomeDestinatario: nome,
    assunto: 'Redefinição de senha — Portal PBL',
    html: moldura('Redefinir sua senha', corpo, 'Criar nova senha', link),
    texto
  };
}

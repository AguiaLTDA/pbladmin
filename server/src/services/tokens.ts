/**
 * Tokens de uso único enviados por e-mail (validação de cadastro e
 * redefinição de senha).
 *
 * O banco guarda apenas o SHA-256 do token — o valor em claro existe só no
 * link que vai para a caixa de entrada do aluno. Assim um vazamento da tabela
 * não permite validar cadastros nem trocar senhas de ninguém.
 */
import crypto from 'crypto';
import { getAsync, runAsync } from '../config/db';

export type TipoToken = 'VERIFICACAO_EMAIL' | 'RECUPERACAO_SENHA';

/** Validade de cada tipo, em minutos. */
export const VALIDADE_MINUTOS: Record<TipoToken, number> = {
  // O aluno pode se cadastrar e só abrir o e-mail no dia seguinte.
  VERIFICACAO_EMAIL: 48 * 60,
  // Janela curta: é o que dá acesso a trocar a senha da conta.
  RECUPERACAO_SENHA: 60
};

function hashDoToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Gera um token novo para o usuário, invalidando os anteriores do mesmo tipo —
 * pedir um segundo link deve aposentar o primeiro.
 * Devolve o token em claro, que só aqui e no e-mail existe.
 */
export async function emitirToken(usuarioId: number, tipo: TipoToken): Promise<string> {
  await runAsync(
    `UPDATE tokens_email SET usado_em = CURRENT_TIMESTAMP
      WHERE usuario_id = ? AND tipo = ? AND usado_em IS NULL`,
    [usuarioId, tipo]
  );

  const token = crypto.randomBytes(32).toString('hex');
  const minutos = VALIDADE_MINUTOS[tipo];

  await runAsync(
    `INSERT INTO tokens_email (usuario_id, tipo, token_hash, expira_em)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP + (? || ' minutes')::interval)`,
    [usuarioId, tipo, hashDoToken(token), String(minutos)]
  );

  return token;
}

export interface TokenValido {
  id: number;
  usuario_id: number;
  nome: string;
  email: string;
}

/**
 * Valida o token sem consumi-lo. Devolve null quando não existe, já foi usado
 * ou expirou — de propósito sem distinguir os casos para quem chama de fora.
 */
export async function conferirToken(token: string, tipo: TipoToken): Promise<TokenValido | null> {
  if (!token || typeof token !== 'string') return null;

  const linha = await getAsync<TokenValido>(
    `SELECT t.id, t.usuario_id, u.nome, u.email
       FROM tokens_email t
       JOIN usuarios u ON t.usuario_id = u.id AND u.deletado_em IS NULL
      WHERE t.token_hash = ? AND t.tipo = ?
        AND t.usado_em IS NULL AND t.expira_em > CURRENT_TIMESTAMP`,
    [hashDoToken(token), tipo]
  );

  return linha || null;
}

/** Marca o token como consumido. Chamar só depois de a ação ter dado certo. */
export async function consumirToken(tokenId: number): Promise<void> {
  await runAsync(`UPDATE tokens_email SET usado_em = CURRENT_TIMESTAMP WHERE id = ?`, [tokenId]);
}

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getAsync, runAsync } from '../config/db';
import { AuthenticatedRequest, JWT_SECRET } from '../middleware/auth';
import { logAudit } from '../services/audit';
import {
  APP_URL,
  emailConfigurado,
  enviarEmail,
  montarEmailRecuperacao,
  montarEmailVerificacao
} from '../services/email';
import { VALIDADE_MINUTOS, conferirToken, consumirToken, emitirToken } from '../services/tokens';

/** Mensagem única do "esqueci minha senha": não revela se o e-mail tem conta. */
const RESPOSTA_RECUPERACAO =
  'Se este e-mail estiver cadastrado no portal, enviamos as instruções para redefinir a senha. ' +
  'Confira também a caixa de spam.';

/** Envia o link de validação de cadastro. Devolve false se o envio não saiu. */
export async function enviarLinkVerificacao(
  usuarioId: number,
  nome: string,
  email: string
): Promise<boolean> {
  if (!emailConfigurado()) return false;

  const token = await emitirToken(usuarioId, 'VERIFICACAO_EMAIL');
  const link = `${APP_URL}/#/verificar-email?token=${token}`;
  const horas = Math.round(VALIDADE_MINUTOS.VERIFICACAO_EMAIL / 60);
  const msg = montarEmailVerificacao(nome, link, horas);
  await enviarEmail({ ...msg, para: email });
  return true;
}

export async function login(req: AuthenticatedRequest, res: Response) {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
    }

    const user = await getAsync<{
      id: number;
      nome: string;
      email: string;
      senha_hash: string;
      perfil_id: number;
      perfil_nome: 'ADMIN' | 'PROFESSOR' | 'ALUNO';
      ativo: number;
      email_verificado_em: string | null;
      deletado_em: string | null;
    }>(
      `SELECT u.*, p.nome as perfil_nome 
       FROM usuarios u 
       JOIN perfis p ON u.perfil_id = p.id 
       WHERE LOWER(u.email) = LOWER(?) AND u.deletado_em IS NULL`,
      [email]
    );

    if (!user) {
      return res.status(401).json({ message: 'Credenciais inválidas. Verifique e-mail e senha.' });
    }

    if (!user.ativo) {
      return res.status(403).json({ message: 'Sua conta de usuário encontra-se desativada.' });
    }

    const match = await bcrypt.compare(senha, user.senha_hash);
    if (!match) {
      return res.status(401).json({ message: 'Credenciais inválidas. Verifique e-mail e senha.' });
    }

    // Só barra depois de a senha conferir: antes disso, a resposta revelaria a
    // qualquer um se aquele e-mail tem conta no portal. `codigo` permite à tela
    // de login oferecer o reenvio do link em vez de só mostrar o erro.
    if (!user.email_verificado_em) {
      return res.status(403).json({
        codigo: 'EMAIL_NAO_VERIFICADO',
        message:
          'Seu e-mail ainda não foi validado. Abra a mensagem que enviamos no seu cadastro e clique no link de confirmação.'
      });
    }

    const payload = {
      id: user.id,
      nome: user.nome,
      email: user.email,
      perfilId: user.perfil_id,
      perfilNome: user.perfil_nome
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });

    await logAudit(user.id, 'LOGIN', 'usuarios', user.id, { email: user.email });

    return res.json({
      token,
      usuario: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        perfilId: user.perfil_id,
        perfilNome: user.perfil_nome
      }
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Erro interno ao realizar autenticação.' });
  }
}

export async function getProfile(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ message: 'Não autenticado.' });

    const user = await getAsync<{
      id: number;
      nome: string;
      email: string;
      perfil_id: number;
      perfil_nome: 'ADMIN' | 'PROFESSOR' | 'ALUNO';
      ativo: number;
      criado_em: string;
    }>(
      `SELECT u.id, u.nome, u.email, u.perfil_id, p.nome as perfil_nome, u.ativo, u.criado_em,
              (ca.completed_at IS NOT NULL) as contexto_completo
       FROM usuarios u
       JOIN perfis p ON u.perfil_id = p.id
       LEFT JOIN contexto_aluno ca ON ca.usuario_id = u.id
       WHERE u.id = ? AND u.deletado_em IS NULL`,
      [req.user.id]
    );

    if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });

    // Mesmo contrato camelCase devolvido por POST /auth/login: o frontend lê
    // `perfilNome` para decidir as rotas de cada portal.
    return res.json({
      id: user.id,
      nome: user.nome,
      email: user.email,
      perfilId: user.perfil_id,
      perfilNome: user.perfil_nome,
      ativo: user.ativo,
      criado_em: user.criado_em,
      contextoCompleto: !!(user as any).contexto_completo
    });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao obter dados do perfil.' });
  }
}

export async function changePassword(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ message: 'Não autenticado.' });
    const { senhaAtual, novaSenha } = req.body;

    if (!senhaAtual || !novaSenha || novaSenha.length < 6) {
      return res.status(400).json({ message: 'A nova senha deve ter no mínimo 6 caracteres.' });
    }

    const user = await getAsync<{ senha_hash: string }>('SELECT senha_hash FROM usuarios WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });

    const match = await bcrypt.compare(senhaAtual, user.senha_hash);
    if (!match) {
      return res.status(400).json({ message: 'Senha atual incorreta.' });
    }

    const newHash = await bcrypt.hash(novaSenha, 10);
    await runAsync('UPDATE usuarios SET senha_hash = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?', [
      newHash,
      req.user.id
    ]);

    await logAudit(req.user.id, 'ALTERAR_SENHA', 'usuarios', req.user.id);
    return res.json({ message: 'Senha alterada com sucesso.' });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao alterar senha.' });
  }
}

// --- VALIDAÇÃO DE E-MAIL ----------------------------------------------------

/**
 * PUBLIC: confirma o e-mail a partir do token do link.
 *
 * É POST, e não GET, de propósito: antivírus e pré-visualizadores de e-mail
 * abrem links por conta própria, e um GET que consome o token gastaria a
 * validação antes de o aluno clicar. A página só dispara este POST.
 */
export async function verificarEmail(req: Request, res: Response) {
  try {
    const { token } = req.body;
    const valido = await conferirToken(String(token || ''), 'VERIFICACAO_EMAIL');

    if (!valido) {
      return res.status(400).json({
        codigo: 'TOKEN_INVALIDO',
        message: 'Este link de validação é inválido, já foi usado ou expirou. Peça um novo na tela de login.'
      });
    }

    await runAsync(
      `UPDATE usuarios SET email_verificado_em = CURRENT_TIMESTAMP, atualizado_em = CURRENT_TIMESTAMP
        WHERE id = ? AND email_verificado_em IS NULL`,
      [valido.usuario_id]
    );
    await consumirToken(valido.id);
    await logAudit(valido.usuario_id, 'VALIDAR_EMAIL', 'usuarios', valido.usuario_id, { email: valido.email });

    return res.json({
      message: 'E-mail validado com sucesso! Agora você já pode entrar no portal.',
      email: valido.email
    });
  } catch (err) {
    console.error('Erro ao validar e-mail:', err);
    return res.status(500).json({ message: 'Erro ao validar o e-mail.' });
  }
}

/** PUBLIC: reenvia o link de validação. Resposta única, para não revelar cadastros. */
export async function reenviarVerificacao(req: Request, res: Response) {
  const resposta = 'Se este e-mail estiver cadastrado e pendente de validação, enviamos um novo link.';
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Informe o e-mail do cadastro.' });

    const user = await getAsync<{ id: number; nome: string; email: string; email_verificado_em: string | null }>(
      `SELECT id, nome, email, email_verificado_em FROM usuarios
        WHERE LOWER(email) = LOWER(?) AND deletado_em IS NULL`,
      [email]
    );

    if (user && !user.email_verificado_em) {
      let enviado = false;
      try {
        enviado = await enviarLinkVerificacao(user.id, user.nome, user.email);
      } catch (erroEnvio) {
        // Falha do provedor não é erro do aluno: responde algo que ele possa
        // agir a respeito, em vez do 500 genérico.
        console.error('Falha ao reenviar validação de e-mail:', erroEnvio);
        return res.status(502).json({
          message:
            'O serviço de e-mail não respondeu agora. Tente novamente em alguns minutos — se persistir, procure a coordenação.'
        });
      }

      if (!enviado) {
        return res.status(503).json({
          message: 'O envio de e-mails ainda não está configurado no portal. Procure a coordenação.'
        });
      }
      await logAudit(user.id, 'REENVIAR_VALIDACAO_EMAIL', 'usuarios', user.id, { email: user.email });
    }

    return res.json({ message: resposta });
  } catch (err) {
    console.error('Erro ao reenviar validação de e-mail:', err);
    return res.status(500).json({ message: 'Erro ao reenviar o link de validação.' });
  }
}

// --- RECUPERAÇÃO DE SENHA ---------------------------------------------------

/**
 * PUBLIC: dispara o e-mail de redefinição de senha.
 *
 * Responde sempre a mesma coisa, com ou sem conta correspondente: uma resposta
 * diferente para e-mail inexistente entregaria a qualquer um a lista de quem
 * estuda aqui.
 */
export async function solicitarRecuperacaoSenha(req: Request, res: Response) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Informe o e-mail do seu cadastro.' });

    if (!emailConfigurado()) {
      return res.status(503).json({
        message: 'A recuperação de senha por e-mail ainda não está configurada no portal. Procure a coordenação.'
      });
    }

    const user = await getAsync<{ id: number; nome: string; email: string; ativo: number }>(
      `SELECT id, nome, email, ativo FROM usuarios WHERE LOWER(email) = LOWER(?) AND deletado_em IS NULL`,
      [email]
    );

    if (user?.ativo) {
      const token = await emitirToken(user.id, 'RECUPERACAO_SENHA');
      const link = `${APP_URL}/#/redefinir-senha?token=${token}`;
      const msg = montarEmailRecuperacao(user.nome, link, VALIDADE_MINUTOS.RECUPERACAO_SENHA);

      try {
        await enviarEmail({ ...msg, para: user.email });
        await logAudit(user.id, 'SOLICITAR_RECUPERACAO_SENHA', 'usuarios', user.id, { email: user.email });
      } catch (erroEnvio) {
        // Falha do provedor é problema nosso, não do aluno — registra e mantém
        // a resposta neutra para não expor a existência do cadastro.
        console.error('Falha ao enviar e-mail de recuperação:', erroEnvio);
      }
    }

    return res.json({ message: RESPOSTA_RECUPERACAO });
  } catch (err) {
    console.error('Erro ao solicitar recuperação de senha:', err);
    return res.status(500).json({ message: 'Erro ao processar o pedido de recuperação.' });
  }
}

/** PUBLIC: troca a senha a partir do token recebido por e-mail. */
export async function redefinirSenha(req: Request, res: Response) {
  try {
    const { token, novaSenha } = req.body;

    if (!novaSenha || String(novaSenha).length < 6) {
      return res.status(400).json({ message: 'A nova senha deve ter no mínimo 6 caracteres.' });
    }

    // Aceita os dois links que levam a definir senha: a recuperação pedida pelo
    // próprio usuário e o convite de primeiro acesso enviado pela coordenação.
    const valido =
      (await conferirToken(String(token || ''), 'RECUPERACAO_SENHA')) ||
      (await conferirToken(String(token || ''), 'PRIMEIRO_ACESSO'));
    if (!valido) {
      return res.status(400).json({
        codigo: 'TOKEN_INVALIDO',
        message: 'Este link de redefinição é inválido, já foi usado ou expirou. Peça um novo na tela de login.'
      });
    }

    const hash = await bcrypt.hash(String(novaSenha), 10);
    // Quem chegou até aqui provou que tem acesso à caixa de entrada, então a
    // troca de senha também vale como validação do e-mail.
    await runAsync(
      `UPDATE usuarios
          SET senha_hash = ?,
              email_verificado_em = COALESCE(email_verificado_em, CURRENT_TIMESTAMP),
              atualizado_em = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [hash, valido.usuario_id]
    );
    await consumirToken(valido.id);
    await logAudit(valido.usuario_id, 'REDEFINIR_SENHA', 'usuarios', valido.usuario_id, { email: valido.email });

    return res.json({ message: 'Senha redefinida com sucesso! Já pode entrar com a nova senha.' });
  } catch (err) {
    console.error('Erro ao redefinir senha:', err);
    return res.status(500).json({ message: 'Erro ao redefinir a senha.' });
  }
}

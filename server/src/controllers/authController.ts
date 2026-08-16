import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getAsync, runAsync } from '../config/db';
import { AuthenticatedRequest, JWT_SECRET } from '../middleware/auth';
import { logAudit } from '../services/audit';

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
      perfil_nome: string;
      ativo: number;
      criado_em: string;
    }>(
      `SELECT u.id, u.nome, u.email, p.nome as perfil_nome, u.ativo, u.criado_em 
       FROM usuarios u 
       JOIN perfis p ON u.perfil_id = p.id 
       WHERE u.id = ?`,
      [req.user.id]
    );

    return res.json(user);
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

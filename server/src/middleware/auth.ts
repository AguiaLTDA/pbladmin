import dotenv from 'dotenv';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Garante que as env vars já estejam carregadas mesmo se este módulo for importado
// (via a cadeia de rotas/controllers) antes do dotenv.config() de app.ts rodar.
dotenv.config();

const jwtSecretFromEnv = process.env.JWT_SECRET;
if (!jwtSecretFromEnv) {
  throw new Error(
    'JWT_SECRET não definido. Defina a variável de ambiente JWT_SECRET com um valor forte ' +
    '(ex.: openssl rand -hex 32) antes de iniciar o servidor.'
  );
}
export const JWT_SECRET: string = jwtSecretFromEnv;

export interface UserPayload {
  id: number;
  nome: string;
  email: string;
  perfilId: number;
  perfilNome: 'ADMIN' | 'PROFESSOR' | 'ALUNO';
}

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token de autenticação não fornecido.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Sessão inválida ou expirada. Faça login novamente.' });
    }
    req.user = decoded as UserPayload;
    next();
  });
};

export const requireRole = (...allowedRoles: Array<'ADMIN' | 'PROFESSOR' | 'ALUNO'>) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Usuário não autenticado.' });
    }

    if (!allowedRoles.includes(req.user.perfilNome)) {
      return res.status(403).json({
        message: `Acesso negado. Perfil '${req.user.perfilNome}' não possui permissão para este recurso.`
      });
    }

    next();
  };
};

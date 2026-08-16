import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'pbl-super-secret-key-2026';

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

import { Response } from 'express';
import { queryAsync } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

export async function listAuditLogs(req: AuthenticatedRequest, res: Response) {
  try {
    const { acao, busca } = req.query;

    let sql = `
      SELECT l.*, u.nome as usuario_nome, u.email as usuario_email, p.nome as perfil_nome
      FROM logs_auditoria l
      LEFT JOIN usuarios u ON l.usuario_id = u.id
      LEFT JOIN perfis p ON u.perfil_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (acao) {
      sql += ` AND l.acao = ?`;
      params.push(acao);
    }
    if (busca) {
      sql += ` AND (LOWER(l.recurso) LIKE LOWER(?) OR LOWER(u.nome) LIKE LOWER(?) OR LOWER(l.detalhes_json) LIKE LOWER(?))`;
      params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`);
    }

    sql += ` ORDER BY l.criado_em DESC LIMIT 200`;

    const logs = await queryAsync(sql, params);
    return res.json(logs);
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao buscar trilha de auditoria.' });
  }
}

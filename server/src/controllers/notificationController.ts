import { Response } from 'express';
import { queryAsync, runAsync } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

export async function listNotifications(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Não autenticado.' });

    const notifications = await queryAsync(
      `SELECT * FROM notificacoes WHERE usuario_id = ? ORDER BY criado_em DESC LIMIT 50`,
      [userId]
    );

    return res.json(notifications);
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao listar notificações.' });
  }
}

export async function markAsRead(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (id === 'all') {
      await runAsync(`UPDATE notificacoes SET lida = 1 WHERE usuario_id = ?`, [userId]);
    } else {
      await runAsync(`UPDATE notificacoes SET lida = 1 WHERE id = ? AND usuario_id = ?`, [id, userId]);
    }

    return res.json({ message: 'Notificação marcada como lida.' });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao atualizar notificação.' });
  }
}

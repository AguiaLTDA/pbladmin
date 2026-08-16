import { Response } from 'express';
import { queryAsync, runAsync, getAsync } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../services/audit';
import { calculateAudiencePreview, saveSegmentationAndTargetStudents, RuleInput } from '../services/segmentation';

// PREVIEW TARGET AUDIENCE
export async function previewAudience(req: AuthenticatedRequest, res: Response) {
  try {
    const { regras } = req.body; // Array of RuleInput
    if (!Array.isArray(regras)) {
      return res.status(400).json({ message: 'Lista de regras é obrigatória.' });
    }

    const preview = await calculateAudiencePreview(regras as RuleInput[]);
    return res.json(preview);
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao calcular prévia de público.' });
  }
}

// PUBLISH OR SCHEDULE ACTIVITY (ADMIN ONLY)
export async function publishActivity(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Não autenticado.' });

    const {
      tipoSegmentacao,
      regras,
      dataDisponibilizacao,
      prazoEntrega,
      agendadoPara
    } = req.body;

    if (!Array.isArray(regras) || regras.length === 0) {
      return res.status(400).json({ message: 'Defina ao menos uma regra de público para a atividade.' });
    }

    if (!prazoEntrega) {
      return res.status(400).json({ message: 'O prazo final de entrega é obrigatório.' });
    }

    const act = await getAsync<{ id: number; status: string; titulo: string }>(
      'SELECT id, status, titulo FROM atividades_pbl WHERE id = ?',
      [id]
    );

    if (!act) return res.status(404).json({ message: 'Atividade não encontrada.' });

    if (!['APROVADO', 'PUBLICADO', 'AGENDADO'].includes(act.status)) {
      return res.status(400).json({ message: 'Apenas atividades aprovadas pela administração podem ser publicadas.' });
    }

    // 1. Save Segmentation rules and resolve targeted students
    const audience = await saveSegmentationAndTargetStudents(
      Number(id),
      tipoSegmentacao || 'TURMA',
      regras as RuleInput[]
    );

    if (audience.totalAlunosUnicos === 0) {
      return res.status(400).json({ message: 'A segmentação configurada não alcança nenhum aluno ativo.' });
    }

    const now = new Date();
    const isSchedule = agendadoPara && new Date(agendadoPara) > now;
    const finalStatus = isSchedule ? 'AGENDADO' : 'PUBLICADO';

    // 2. Clear old publication records if republicating
    await runAsync(`DELETE FROM publicacoes WHERE atividade_id = ?`, [id]);

    // 3. Create publication record
    const pubRes = await runAsync(
      `INSERT INTO publicacoes (atividade_id, data_disponibilizacao, prazo_entrega, publicado_por, agendado_para, status_publicacao)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        dataDisponibilizacao || now.toISOString(),
        prazoEntrega,
        adminId,
        isSchedule ? agendadoPara : null,
        finalStatus
      ]
    );

    // 4. Update activity status
    await runAsync(`UPDATE atividades_pbl SET status = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`, [
      finalStatus,
      id
    ]);

    // 5. Notify all targeted students if published immediately
    if (finalStatus === 'PUBLICADO') {
      for (const aluno of audience.alunosIncluidos) {
        await runAsync(
          `INSERT INTO notificacoes (usuario_id, titulo, mensagem, link) VALUES (?, ?, ?, ?)`,
          [
            aluno.id,
            'Nova Atividade PBL Disponível',
            `A atividade "${act.titulo}" foi publicada para sua turma. Prazo: ${new Date(prazoEntrega).toLocaleDateString('pt-BR')}`,
            `/aluno/atividade/${id}`
          ]
        );
      }
    }

    await logAudit(adminId, `PUBLICAR_${finalStatus}`, 'atividades_pbl', String(id), {
      totalAlunosAlcançados: audience.totalAlunosUnicos,
      prazoEntrega
    });

    return res.json({
      message: isSchedule
        ? `Atividade agendada com sucesso para ${new Date(agendadoPara).toLocaleString('pt-BR')}.`
        : `Atividade publicada com sucesso para ${audience.totalAlunosUnicos} alunos.`,
      status: finalStatus,
      publicacaoId: pubRes.lastID,
      alunosAlcançados: audience.totalAlunosUnicos
    });
  } catch (err: any) {
    console.error('Publish activity error:', err);
    return res.status(500).json({ message: 'Erro ao publicar atividade.' });
  }
}

// SUSPEND OR ARCHIVE ACTIVITY
export async function changePublicationStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const adminId = req.user?.id;
    const { novoStatus } = req.body; // 'SUSPENSO', 'PUBLICADO', 'ENCERRADO', 'ARQUIVADO'

    if (!['SUSPENSO', 'PUBLICADO', 'ENCERRADO', 'ARQUIVADO'].includes(novoStatus)) {
      return res.status(400).json({ message: 'Status de publicação inválido.' });
    }

    await runAsync(`UPDATE atividades_pbl SET status = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`, [
      novoStatus,
      String(id)
    ]);

    await runAsync(`UPDATE publicacoes SET status_publicacao = ? WHERE atividade_id = ?`, [novoStatus, String(id)]);

    await logAudit(adminId || null, `ALTERAR_STATUS_PUBLICACAO_${novoStatus}`, 'atividades_pbl', String(id));
    return res.json({ message: `Status da atividade alterado para '${novoStatus}'.`, status: novoStatus });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao alterar status de publicação.' });
  }
}

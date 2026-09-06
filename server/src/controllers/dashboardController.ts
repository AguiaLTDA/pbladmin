import { Response } from 'express';
import { queryAsync, getAsync } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

export async function getDashboardData(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Não autenticado.' });

    if (user.perfilNome === 'ADMIN') {
      const statusCounts = await queryAsync<{ status: string; count: number }>(
        `SELECT status, COUNT(*) as count FROM atividades_pbl WHERE deletado_em IS NULL GROUP BY status`
      );

      const statusMap: Record<string, number> = {};
      statusCounts.forEach((r) => (statusMap[r.status] = r.count));

      const totalAlunos = await getAsync<{ count: number }>(
        `SELECT COUNT(DISTINCT aluno_id) as count FROM alunos_segmentados`
      );

      const totalEntregas = await getAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM entregas WHERE status IN ('ENVIADO', 'ATRASADO')`
      );

      const entregasPrazo = await getAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM entregas WHERE status = 'ENVIADO'`
      );

      const entregasAtraso = await getAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM entregas WHERE status = 'ATRASADO'`
      );

      const porCurso = await queryAsync(
        `SELECT c.nome as curso, COUNT(a.id) as total_atividades
         FROM atividades_pbl a
         JOIN cursos c ON a.curso_id = c.id
         WHERE a.deletado_em IS NULL
         GROUP BY c.id`
      );

      return res.json({
        kpis: {
          aguardandoAnalise: (statusMap['ENVIADO_ANALISE'] || 0) + (statusMap['REENVIADO'] || 0),
          ajustessolicitados: statusMap['AJUSTES_SOLICITADOS'] || 0,
          emAnalise: statusMap['EM_ANALISE'] || 0,
          aprovadas: statusMap['APROVADO'] || 0,
          agendadas: statusMap['AGENDADO'] || 0,
          publicadas: statusMap['PUBLICADO'] || 0,
          suspensas: statusMap['SUSPENSO'] || 0,
          alunosAlcancados: totalAlunos?.count || 0,
          totalEntregas: totalEntregas?.count || 0,
          entregasNoPrazo: entregasPrazo?.count || 0,
          entregasComAtraso: entregasAtraso?.count || 0
        },
        porCurso
      });
    }

    if (user.perfilNome === 'PROFESSOR') {
      // O professor não autora mais atividades PBL (isso é do Admin) — o painel dele
      // reflete só o que lhe cabe: entregas para avaliar e o arquivo orientador.
      const alcanceCondicao = `(
        a.professor_id = ?
        OR EXISTS (
          SELECT 1 FROM vinculos_professores vp
          WHERE vp.usuario_id = ? AND vp.ativo = 1 AND vp.disciplina_id = a.disciplina_id
        )
      )`;

      const publicadas = await getAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM atividades_pbl a
         WHERE a.deletado_em IS NULL AND a.status = 'PUBLICADO' AND ${alcanceCondicao}`,
        [user.id, user.id]
      );

      const totalAlunosProf = await getAsync<{ count: number }>(
        `SELECT COUNT(DISTINCT als.aluno_id) as count
         FROM alunos_segmentados als
         JOIN atividades_pbl a ON als.atividade_id = a.id
         WHERE a.status = 'PUBLICADO' AND ${alcanceCondicao}`,
        [user.id, user.id]
      );

      const entregasPendentes = await getAsync<{ count: number }>(
        `SELECT COUNT(*) as count
         FROM entregas e
         JOIN publicacoes pub ON e.publicacao_id = pub.id
         JOIN atividades_pbl a ON pub.atividade_id = a.id
         LEFT JOIN feedbacks fb ON fb.entrega_id = e.id AND fb.liberado_aluno = 1
         WHERE e.status IN ('ENVIADO', 'ATRASADO') AND fb.id IS NULL AND ${alcanceCondicao}`,
        [user.id, user.id]
      );

      const orientador = await getAsync<{ id: number }>(
        `SELECT id FROM arquivos_orientadores WHERE professor_id = ? AND ativo = 1`,
        [user.id]
      );

      return res.json({
        kpis: {
          publicadas: publicadas?.count || 0,
          alunosAlcancados: totalAlunosProf?.count || 0,
          entregasPendentes: entregasPendentes?.count || 0,
          temArquivoOrientador: !!orientador
        }
      });
    }

    if (user.perfilNome === 'ALUNO') {
      const activities = await queryAsync<any>(
        `SELECT a.id, pub.prazo_entrega, ent.status as entrega_status
         FROM alunos_segmentados als
         JOIN atividades_pbl a ON als.atividade_id = a.id
         JOIN publicacoes pub ON a.id = pub.atividade_id
         LEFT JOIN entregas ent ON pub.id = ent.publicacao_id AND ent.aluno_id = ?
         WHERE als.aluno_id = ? AND a.status = 'PUBLICADO' AND a.deletado_em IS NULL`,
        [user.id, user.id]
      );

      const now = new Date();
      let novas = 0;
      let emAndamento = 0;
      let concluidas = 0;
      let atrasadas = 0;

      activities.forEach((act: any) => {
        const prazo = new Date(act.prazo_entrega);
        if (act.entrega_status === 'ENVIADO') {
          concluidas++;
        } else if (act.entrega_status === 'RASCUNHO') {
          emAndamento++;
        } else if (prazo < now) {
          atrasadas++;
        } else {
          novas++;
        }
      });

      return res.json({
        kpis: {
          novas,
          emAndamento,
          concluidas,
          atrasadas,
          total: activities.length
        }
      });
    }

    return res.status(400).json({ message: 'Perfil não reconhecido.' });
  } catch (err) {
    console.error('Dashboard data error:', err);
    return res.status(500).json({ message: 'Erro ao gerar dados do dashboard.' });
  }
}

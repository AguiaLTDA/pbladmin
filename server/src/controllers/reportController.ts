import { Response } from 'express';
import { queryAsync } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

export async function getGeneralReport(req: AuthenticatedRequest, res: Response) {
  try {
    const { cursoId, professorId, status } = req.query;

    let sql = `
      SELECT a.codigo_unico, a.titulo, a.status, a.versao_atual,
             c.nome as curso_nome, d.nome as disciplina_nome,
             p.nome as professor_nome, a.criado_em,
             (SELECT COUNT(*) FROM alunos_segmentados als WHERE als.atividade_id = a.id) as total_alunos_alcancados,
             (SELECT COUNT(*) FROM publicacoes pub JOIN entregas e ON pub.id = e.publicacao_id WHERE pub.atividade_id = a.id AND e.status = 'ENVIADO') as total_entregas
      FROM atividades_pbl a
      JOIN cursos c ON a.curso_id = c.id
      JOIN disciplinas d ON a.disciplina_id = d.id
      JOIN usuarios p ON a.professor_id = p.id
      WHERE a.deletado_em IS NULL
    `;
    const params: any[] = [];

    if (cursoId) {
      sql += ` AND a.curso_id = ?`;
      params.push(cursoId);
    }
    if (professorId) {
      sql += ` AND a.professor_id = ?`;
      params.push(professorId);
    }
    if (status) {
      sql += ` AND a.status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY a.criado_em DESC`;

    const reportData = await queryAsync(sql, params);
    return res.json(reportData);
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao gerar relatório geral.' });
  }
}

export async function exportReportCSV(req: AuthenticatedRequest, res: Response) {
  try {
    const { tipo } = req.query; // 'ATIVIDADES', 'ENTREGAS', 'ALUNOS'

    if (tipo === 'ENTREGAS') {
      const rows = await queryAsync<any>(
        `SELECT a.codigo_unico, a.titulo, u.nome as aluno_nome, u.email as aluno_email,
                e.status as status_entrega, e.data_envio, e.comprovante_hash,
                fb.nota_escrita, fb.nota_oral, fb.nota_total
         FROM entregas e
         JOIN publicacoes pub ON e.publicacao_id = pub.id
         JOIN atividades_pbl a ON pub.atividade_id = a.id
         JOIN usuarios u ON e.aluno_id = u.id
         LEFT JOIN feedbacks fb ON e.id = fb.entrega_id
         ORDER BY e.data_envio DESC`
      );

      let csv = 'Codigo PBL;Titulo Atividade;Aluno;Email;Status Entrega;Data Envio;Comprovante Hash;Nota Escrita;Nota Oral;Nota Total\n';
      rows.forEach((r) => {
        csv += `"${r.codigo_unico}";"${r.titulo}";"${r.aluno_nome}";"${r.aluno_email}";"${r.status_entrega}";"${r.data_envio || ''}";"${r.comprovante_hash || ''}";"${r.nota_escrita || 0}";"${r.nota_oral || 0}";"${r.nota_total || 0}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="relatorio_entregas_pbl.csv"');
      return res.send('\uFEFF' + csv);
    }

    // Default: Activities CSV export
    const rows = await queryAsync<any>(
      `SELECT a.codigo_unico, a.titulo, c.nome as curso, d.nome as disciplina, p.nome as professor, a.status, a.versao_atual, a.criado_em
       FROM atividades_pbl a
       JOIN cursos c ON a.curso_id = c.id
       JOIN disciplinas d ON a.disciplina_id = d.id
       JOIN usuarios p ON a.professor_id = p.id
       WHERE a.deletado_em IS NULL
       ORDER BY a.criado_em DESC`
    );

    let csv = 'Codigo PBL;Titulo;Curso;Disciplina;Professor;Status;Versao Atual;Data Criacao\n';
    rows.forEach((r) => {
      csv += `"${r.codigo_unico}";"${r.titulo}";"${r.curso}";"${r.disciplina}";"${r.professor}";"${r.status}";"${r.versao_atual}";"${r.criado_em}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="relatorio_atividades_pbl.csv"');
    return res.send('\uFEFF' + csv);
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao exportar relatório em CSV.' });
  }
}

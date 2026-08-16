import { Response } from 'express';
import crypto from 'crypto';
import { queryAsync, runAsync, getAsync } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../services/audit';

// --- STUDENT PORTAL ENDPOINTS ---

// List student targeted activities
export async function getStudentActivities(req: AuthenticatedRequest, res: Response) {
  try {
    const studentId = req.user?.id;
    if (!studentId) return res.status(401).json({ message: 'Não autenticado.' });

    const { statusFiltro } = req.query; // 'PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'ATRASADA'

    let sql = `
      SELECT a.id, a.codigo_unico, a.titulo, c.nome as curso_nome, d.nome as disciplina_nome,
             p.nome as professor_nome, pub.id as publicacao_id, pub.data_disponibilizacao,
             pub.prazo_entrega, pub.status_publicacao,
             ent.id as entrega_id, ent.status as entrega_status, ent.data_envio, ent.comprovante_hash,
             fb.nota_total, fb.liberado_aluno
      FROM alunos_segmentados als
      JOIN atividades_pbl a ON als.atividade_id = a.id
      JOIN publicacoes pub ON a.id = pub.atividade_id
      JOIN cursos c ON a.curso_id = c.id
      JOIN disciplinas d ON a.disciplina_id = d.id
      JOIN usuarios p ON a.professor_id = p.id
      LEFT JOIN entregas ent ON pub.id = ent.publicacao_id AND ent.aluno_id = ?
      LEFT JOIN feedbacks fb ON ent.id = fb.entrega_id
      WHERE als.aluno_id = ? AND a.status = 'PUBLICADO' AND a.deletado_em IS NULL
    `;

    const activities = await queryAsync<any>(sql, [studentId, studentId]);

    const now = new Date();
    const formatted = activities.map((item: any) => {
      const prazo = new Date(item.prazo_entrega);
      let estadoAluno = 'PENDENTE';

      if (item.entrega_status === 'ENVIADO') {
        estadoAluno = 'CONCLUIDA';
      } else if (item.entrega_status === 'RASCUNHO') {
        estadoAluno = 'EM_ANDAMENTO';
      } else if (prazo < now && !item.entrega_status) {
        estadoAluno = 'ATRASADA';
      }

      return {
        ...item,
        estadoAluno
      };
    });

    if (statusFiltro) {
      const filtered = formatted.filter((item: any) => item.estadoAluno === statusFiltro);
      return res.json(filtered);
    }

    return res.json(formatted);
  } catch (err) {
    console.error('Error fetching student activities:', err);
    return res.status(500).json({ message: 'Erro ao listar atividades do aluno.' });
  }
}

// Get Single Student Activity Details (STRICT SECURITY CHECK)
export async function getStudentActivityDetails(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const studentId = req.user?.id;

    if (!studentId) return res.status(401).json({ message: 'Não autenticado.' });

    // SECURITY CHECK: Verify if student is in alunos_segmentados for this activity
    const access = await getAsync<{ id: number }>(
      'SELECT id FROM alunos_segmentados WHERE atividade_id = ? AND aluno_id = ?',
      [id, studentId]
    );

    if (!access) {
      return res.status(403).json({
        message: 'Acesso negado. Esta atividade PBL não foi direcionada para você ou sua turma.'
      });
    }

    const act = await getAsync<any>(
      `SELECT a.*, c.nome as curso_nome, d.nome as disciplina_nome, p.nome as professor_nome,
              pub.id as publicacao_id, pub.data_disponibilizacao, pub.prazo_entrega, pub.status_publicacao
       FROM atividades_pbl a
       JOIN publicacoes pub ON a.id = pub.atividade_id
       JOIN cursos c ON a.curso_id = c.id
       JOIN disciplinas d ON a.disciplina_id = d.id
       JOIN usuarios p ON a.professor_id = p.id
       WHERE a.id = ? AND a.status = 'PUBLICADO' AND a.deletado_em IS NULL`,
      [id]
    );

    if (!act) {
      return res.status(404).json({ message: 'Atividade não encontrada ou não publicada.' });
    }

    // Fetch published version details & steps
    const currentVersionRow = await getAsync<any>(
      `SELECT * FROM versoes_atividades WHERE atividade_id = ? AND numero_versao = ?`,
      [id, act.versao_atual]
    );

    let etapas: any[] = [];
    if (currentVersionRow) {
      etapas = await queryAsync(
        `SELECT * FROM etapas_pbl WHERE versao_atividade_id = ? ORDER BY ordem ASC`,
        [currentVersionRow.id]
      );
    }

    // Fetch approved files for this version
    const arquivos = await queryAsync(
      `SELECT ar.id, ar.nome_original, ar.tamanho_bytes, ar.mime_type, ar.categoria
       FROM arquivos_atividades aa
       JOIN arquivos ar ON aa.arquivo_id = ar.id
       WHERE aa.versao_atividade_id = ? AND aa.aprovado_pelo_admin = 1 AND ar.deletado_em IS NULL`,
      [currentVersionRow?.id || 0]
    );

    // Fetch existing submission for student if any
    const entrega = await getAsync<any>(
      `SELECT * FROM entregas WHERE publicacao_id = ? AND aluno_id = ?`,
      [act.publicacao_id, studentId]
    );

    let feedback = null;
    let arquivosEntrega: any[] = [];

    if (entrega) {
      feedback = await getAsync<any>(
        `SELECT fb.*, u.nome as avaliador_nome 
         FROM feedbacks fb 
         JOIN usuarios u ON fb.avaliador_id = u.id 
         WHERE fb.entrega_id = ? AND fb.liberado_aluno = 1`,
        [entrega.id]
      );

      arquivosEntrega = await queryAsync(
        `SELECT ar.id, ar.nome_original, ar.tamanho_bytes, ar.mime_type 
         FROM arquivos_entregas ae
         JOIN arquivos ar ON ae.arquivo_id = ar.id
         WHERE ae.entrega_id = ? AND ar.deletado_em IS NULL`,
        [entrega.id]
      );
    }

    return res.json({
      atividade: act,
      versao: currentVersionRow,
      etapas,
      arquivos,
      entrega,
      arquivosEntrega,
      feedback
    });
  } catch (err) {
    console.error('Error fetching student activity details:', err);
    return res.status(500).json({ message: 'Erro ao buscar detalhes da atividade.' });
  }
}

// SAVE OR SUBMIT STUDENT ANSWER (RASCUNHO OR FINAL ENVIADO)
export async function submitStudentAnswer(req: AuthenticatedRequest, res: Response) {
  try {
    const { atividadeId } = req.params;
    const studentId = req.user?.id;
    const { conteudoResposta, arquivoIds, finalSubmit } = req.body;

    if (!studentId) return res.status(401).json({ message: 'Não autenticado.' });

    // Verify access
    const access = await getAsync<{ id: number }>(
      'SELECT id FROM alunos_segmentados WHERE atividade_id = ? AND aluno_id = ?',
      [atividadeId, studentId]
    );

    if (!access) return res.status(403).json({ message: 'Acesso negado.' });

    const pub = await getAsync<{ id: number; prazo_entrega: string }>(
      'SELECT id, prazo_entrega FROM publicacoes WHERE atividade_id = ? AND status_publicacao = "PUBLICADO"',
      [atividadeId]
    );

    if (!pub) return res.status(404).json({ message: 'Publicação não encontrada.' });

    const status = finalSubmit ? 'ENVIADO' : 'RASCUNHO';
    const now = new Date();
    const isLate = new Date(pub.prazo_entrega) < now;
    const statusFinal = finalSubmit && isLate ? 'ATRASADO' : status;

    // Generate hash proof for final submission
    let receiptHash: string | null = null;
    if (finalSubmit) {
      receiptHash = `PBL-REC-${studentId}-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    }

    const existingEntrega = await getAsync<{ id: number; status: string }>(
      'SELECT id, status FROM entregas WHERE publicacao_id = ? AND aluno_id = ?',
      [pub.id, studentId]
    );

    let entregaId: number;

    if (existingEntrega) {
      if (existingEntrega.status === 'ENVIADO' && !finalSubmit) {
        return res.status(400).json({ message: 'Esta entrega já foi finalizada e não pode ser revertida para rascunho.' });
      }

      await runAsync(
        `UPDATE entregas SET 
          status = ?, conteudo_resposta = ?, data_envio = ?, comprovante_hash = COALESCE(?, comprovante_hash),
          atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [statusFinal, conteudoResposta || '', finalSubmit ? now.toISOString() : null, receiptHash, existingEntrega.id]
      );
      entregaId = existingEntrega.id;
    } else {
      const resIns = await runAsync(
        `INSERT INTO entregas (publicacao_id, aluno_id, status, conteudo_resposta, data_envio, comprovante_hash)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [pub.id, studentId, statusFinal, conteudoResposta || '', finalSubmit ? now.toISOString() : null, receiptHash]
      );
      entregaId = resIns.lastID;
    }

    // Attach student files
    if (Array.isArray(arquivoIds)) {
      await runAsync(`DELETE FROM arquivos_entregas WHERE entrega_id = ?`, [entregaId]);
      for (const fId of arquivoIds) {
        await runAsync(`INSERT INTO arquivos_entregas (entrega_id, arquivo_id) VALUES (?, ?)`, [entregaId, fId]);
      }
    }

    await logAudit(studentId, finalSubmit ? 'SUBMETER_ENTREGA_FINAL' : 'SALVAR_RASCUNHO_ENTREGA', 'entregas', entregaId, {
      comprovanteHash: receiptHash
    });

    return res.json({
      message: finalSubmit ? 'Entrega final realizada com sucesso!' : 'Rascunho da entrega salvo com sucesso.',
      entregaId,
      comprovanteHash: receiptHash,
      status: statusFinal
    });
  } catch (err: any) {
    console.error('Error submitting answer:', err);
    return res.status(500).json({ message: 'Erro ao registrar entrega.' });
  }
}

// --- TEACHER / ADMIN EVALUATION & FEEDBACK ---

// List submissions for an activity (Teacher / Admin)
export async function listSubmissionsForActivity(req: AuthenticatedRequest, res: Response) {
  try {
    const { atividadeId } = req.params;
    const user = req.user;

    const act = await getAsync<{ id: number; professor_id: number }>(
      'SELECT id, professor_id FROM atividades_pbl WHERE id = ?',
      [atividadeId]
    );

    if (!act) return res.status(404).json({ message: 'Atividade não encontrada.' });

    if (user?.perfilNome === 'PROFESSOR' && act.professor_id !== user.id) {
      return res.status(403).json({ message: 'Acesso negado. Esta atividade pertence a outro docente.' });
    }

    const pub = await getAsync<{ id: number }>('SELECT id FROM publicacoes WHERE atividade_id = ?', [atividadeId]);
    if (!pub) return res.json([]);

    const submissions = await queryAsync(
      `SELECT e.*, u.nome as aluno_nome, u.email as aluno_email,
              g.nome as grupo_nome, fb.nota_escrita, fb.nota_oral, fb.nota_total, fb.observacoes, fb.liberado_aluno
       FROM entregas e
       JOIN usuarios u ON e.aluno_id = u.id
       LEFT JOIN grupos g ON e.grupo_id = g.id
       LEFT JOIN feedbacks fb ON e.id = fb.entrega_id
       WHERE e.publicacao_id = ?
       ORDER BY e.data_envio DESC`,
      [pub.id]
    );

    return res.json(submissions);
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao listar entregas.' });
  }
}

// Submit Grade & Feedback for a Student Submission
export async function evaluateSubmission(req: AuthenticatedRequest, res: Response) {
  try {
    const { entregaId } = req.params;
    const evaluatorId = req.user?.id;
    const { notaEscrita, notaOral, observacoes, liberadoAluno } = req.body;

    if (!evaluatorId) return res.status(401).json({ message: 'Não autenticado.' });

    const entrega = await getAsync<{ id: number; aluno_id: number }>(
      'SELECT id, aluno_id FROM entregas WHERE id = ?',
      [entregaId]
    );

    if (!entrega) return res.status(404).json({ message: 'Entrega não encontrada.' });

    const nEscrita = Number(notaEscrita || 0);
    const nOral = Number(notaOral || 0);
    const nTotal = nEscrita + nOral;

    const existingFb = await getAsync<{ id: number }>('SELECT id FROM feedbacks WHERE entrega_id = ?', [entregaId]);

    if (existingFb) {
      await runAsync(
        `UPDATE feedbacks SET 
          nota_escrita = ?, nota_oral = ?, nota_total = ?, observacoes = ?, liberado_aluno = ?,
          avaliador_id = ?
         WHERE id = ?`,
        [nEscrita, nOral, nTotal, observacoes || '', liberadoAluno ? 1 : 0, evaluatorId, existingFb.id]
      );
    } else {
      await runAsync(
        `INSERT INTO feedbacks (entrega_id, avaliador_id, nota_escrita, nota_oral, nota_total, observacoes, liberado_aluno)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [entregaId, evaluatorId, nEscrita, nOral, nTotal, observacoes || '', liberadoAluno ? 1 : 0]
      );
    }

    if (liberadoAluno) {
      await runAsync(
        `INSERT INTO notificacoes (usuario_id, titulo, mensagem, link) VALUES (?, ?, ?, ?)`,
        [
          entrega.aluno_id,
          'Feedback e Nota Liberados',
          `Seu professor liberou a avaliação e feedback da sua atividade PBL. Nota Total: ${nTotal.toFixed(2)}`,
          `/aluno/atividades`
        ]
      );
    }

    await logAudit(evaluatorId, 'AVALIAR_ENTREGA', 'feedbacks', String(entregaId), { nTotal, liberadoAluno });
    return res.json({ message: 'Avaliação registrada com sucesso.', notaTotal: nTotal });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao avaliar entrega.' });
  }
}

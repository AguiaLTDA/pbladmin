import { Response } from 'express';
import crypto from 'crypto';
import { queryAsync, runAsync, getAsync } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../services/audit';
import { professorAlcancaAtividade } from '../services/horarioImport';
import { calculatePblWrittenPenalty, canResubmitEarlyPblWrittenSubmission, PBL_WRITTEN_RESUBMISSION_END } from '../services/pblWrittenPenalty';
import { SLIDES_PRESENTATION_DEADLINE, SLIDES_PRESENTATION_NATURE } from '../services/slidesPresentationDelivery';
import { entregaGrupoTurmaJoins, studentDeliveryCte } from '../services/studentGroupDelivery';
import { aplicaEscalaPbl, NOTA_MAXIMA_ESCRITA_PBL, NOTA_MAXIMA_ORAL_PBL } from '../config/escalaNotasPbl';

// --- STUDENT PORTAL ENDPOINTS ---

// List student targeted activities
export async function getStudentActivities(req: AuthenticatedRequest, res: Response) {
  try {
    const studentId = req.user?.id;
    if (!studentId) return res.status(401).json({ message: 'Não autenticado.' });

    const { statusFiltro } = req.query; // 'PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'ATRASADA'

    let sql = `
      ${studentDeliveryCte}
      SELECT a.id, a.codigo_unico, a.titulo, a.natureza, c.nome as curso_nome, d.nome as disciplina_nome,
             p.nome as professor_nome, pub.id as publicacao_id, pub.data_disponibilizacao,
             pub.prazo_entrega, pub.status_publicacao,
             ent.id as entrega_id, ent.status as entrega_status, ent.data_envio, ent.comprovante_hash,
             ent.entrega_compartilhada, ent.enviado_por_nome,
             fb.nota_total, fb.nota_oral, fb.liberado_aluno
      FROM alunos_segmentados als
      JOIN atividades_pbl a ON als.atividade_id = a.id
      JOIN publicacoes pub ON a.id = pub.atividade_id
      JOIN cursos c ON a.curso_id = c.id
      JOIN disciplinas d ON a.disciplina_id = d.id
      JOIN usuarios p ON a.professor_id = p.id
      LEFT JOIN entrega_aluno_visivel ent ON pub.id = ent.publicacao_id AND ent.viewer_id = als.aluno_id
      LEFT JOIN feedbacks fb ON ent.id = fb.entrega_id
      WHERE als.aluno_id = ? AND a.status = 'PUBLICADO' AND a.deletado_em IS NULL
    `;

    const activities = await queryAsync<any>(sql, [studentId, studentId]);

    const now = new Date();
    const formatted = activities.map((item: any) => {
      const prazo = new Date(item.prazo_entrega);
      let estadoAluno = 'PENDENTE';

      if (['ENVIADO', 'ATRASADO'].includes(item.entrega_status)) {
        estadoAluno = 'CONCLUIDA';
      } else if (item.entrega_status === 'RASCUNHO') {
        estadoAluno = 'EM_ANDAMENTO';
      } else if (prazo < now && !item.entrega_status) {
        estadoAluno = 'ATRASADA';
      }

      // Material informativo (atalho "enviar para grupo"): sem entrega própria,
      // não faz sentido tratar como pendente/atrasada — é só um aviso de leitura.
      if (item.natureza === 'INFORMATIVA' && !item.entrega_status) {
        estadoAluno = 'INFORMATIVA';
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
              pub.id as publicacao_id, pub.data_disponibilizacao, pub.prazo_entrega, pub.status_publicacao,
              pl.nome as periodo_nome,
              EXISTS (SELECT 1 FROM versoes_atividades va
                      JOIN arquivos_atividades aa ON aa.versao_atividade_id = va.id
                      JOIN arquivos ar ON ar.id = aa.arquivo_id
                      WHERE va.atividade_id = a.id AND va.numero_versao = a.versao_atual
                        AND ar.tipo_documento = 'PBL_1' AND ar.deletado_em IS NULL) as pbl_1
       FROM atividades_pbl a
       JOIN publicacoes pub ON a.id = pub.atividade_id
       JOIN cursos c ON a.curso_id = c.id
       JOIN disciplinas d ON a.disciplina_id = d.id
       JOIN usuarios p ON a.professor_id = p.id
       JOIN periodos_letivos pl ON pl.id = a.periodo_letivo_id
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
      `${studentDeliveryCte}
       SELECT * FROM entrega_aluno_visivel
        WHERE publicacao_id = ? AND viewer_id = ?`,
      [studentId, act.publicacao_id, studentId]
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

    // A turma do aluno acompanha a resposta porque os comentários do professor
    // sobre um material são endereçados a uma turma, não à atividade: sem este
    // id, a tela do aluno não teria como pedi-los.
    const matricula = await getAsync<{ turma_id: number; grupo_id: number | null }>(
      `SELECT m.turma_id, m.grupo_id FROM matriculas m
        JOIN turmas t ON t.id = m.turma_id
        WHERE m.usuario_id = ? AND m.ativo = 1 AND m.deletado_em IS NULL
          AND t.ativo = 1 AND t.deletado_em IS NULL
          AND t.curso_id = ? AND t.periodo_letivo_id = ?
        ORDER BY (m.grupo_id IS NOT NULL) DESC, m.grupo_id ASC, m.id ASC LIMIT 1`,
      [studentId, act.curso_id, act.periodo_letivo_id]
    );

    return res.json({
      atividade: act,
      versao: currentVersionRow,
      etapas,
      arquivos,
      entrega,
      podeReenviar: Boolean(
        entrega && !entrega.entrega_compartilhada && ['ENVIADO', 'ATRASADO'].includes(entrega.status) && act.pbl_1 &&
        act.periodo_nome === '2026/2' &&
        canResubmitEarlyPblWrittenSubmission(entrega.primeira_entrega_final_em)
      ),
      arquivosEntrega,
      feedback,
      turmaId: matricula?.turma_id ?? null,
      grupoId: matricula?.grupo_id ?? null
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

    const pub = await getAsync<{ id: number; prazo_entrega: string; pbl_1: boolean; periodo_nome: string; natureza: string }>(
      `SELECT pub.id, pub.prazo_entrega, pl.nome as periodo_nome, a.natureza,
              EXISTS (SELECT 1 FROM versoes_atividades va
                      JOIN arquivos_atividades aa ON aa.versao_atividade_id = va.id
                      JOIN arquivos ar ON ar.id = aa.arquivo_id
                      WHERE va.atividade_id = a.id AND va.numero_versao = a.versao_atual
                        AND ar.tipo_documento = 'PBL_1' AND ar.deletado_em IS NULL) as pbl_1
         FROM publicacoes pub
         JOIN atividades_pbl a ON a.id = pub.atividade_id
         JOIN periodos_letivos pl ON pl.id = a.periodo_letivo_id
        WHERE pub.atividade_id = ? AND pub.status_publicacao = 'PUBLICADO'
          AND a.status = 'PUBLICADO' AND a.deletado_em IS NULL`,
      [atividadeId]
    );

    if (!pub) return res.status(404).json({ message: 'Publicação não encontrada.' });

    const entregaCompartilhada = await getAsync<{ id: number }>(
      `${studentDeliveryCte}
       SELECT id FROM entrega_aluno_visivel
        WHERE publicacao_id = ? AND viewer_id = ? AND entrega_compartilhada = true
          AND status IN ('ENVIADO', 'ATRASADO')`,
      [studentId, pub.id, studentId]
    );
    if (entregaCompartilhada) {
      return res.status(409).json({ message: 'Seu grupo já realizou a entrega final. Consulte a resposta compartilhada.' });
    }

    const now = new Date();
    const isSlidesDelivery = pub.natureza === SLIDES_PRESENTATION_NATURE;
    const submittedFileIds = Array.isArray(arquivoIds) ? arquivoIds : [];
    if (isSlidesDelivery) {
      if (typeof conteudoResposta === 'string' && conteudoResposta.trim()) {
        return res.status(400).json({ message: 'Esta entrega aceita somente arquivos PowerPoint (.pptx), sem resposta em texto.' });
      }
      if (!submittedFileIds.every((fileId: unknown) => Number.isInteger(fileId) && Number(fileId) > 0) ||
        new Set(submittedFileIds).size !== submittedFileIds.length) {
        return res.status(400).json({ message: 'Selecione apenas arquivos PPTX válidos para esta entrega.' });
      }
      if (finalSubmit && submittedFileIds.length === 0) {
        return res.status(400).json({ message: 'Anexe ao menos um arquivo PowerPoint (.pptx) para finalizar a entrega.' });
      }
      if (finalSubmit && now > SLIDES_PRESENTATION_DEADLINE) {
        return res.status(400).json({ message: 'O prazo para enviar os slides terminou em 23/11/2026, às 23h59 (horário de Brasília).' });
      }
      if (submittedFileIds.length > 0) {
        const placeholders = submittedFileIds.map(() => '?').join(', ');
        const files = await queryAsync<{ id: number; nome_original: string; mime_type: string; enviado_por: number; deletado_em: string | null }>(
          `SELECT id, nome_original, mime_type, enviado_por, deletado_em
             FROM arquivos WHERE id IN (${placeholders})`, submittedFileIds
        );
        const validPptx = files.length === submittedFileIds.length && files.every((file) =>
          !file.deletado_em && file.enviado_por === studentId && /\.pptx$/i.test(file.nome_original) &&
          file.mime_type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        );
        if (!validPptx) {
          return res.status(400).json({ message: 'Esta entrega aceita somente arquivos .pptx enviados por você.' });
        }
      }
    }

    const status = finalSubmit ? 'ENVIADO' : 'RASCUNHO';
    const isLate = new Date(pub.prazo_entrega) < now;
    const statusFinal = finalSubmit && isLate ? 'ATRASADO' : status;

    // Generate hash proof for final submission
    let receiptHash: string | null = null;
    if (finalSubmit) {
      receiptHash = `PBL-REC-${studentId}-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    }

    // Entrega excluída pela coordenadoria não conta: o aluno recomeça numa entrega nova.
    const existingEntrega = await getAsync<{ id: number; status: string; primeira_entrega_final_em: string | null }>(
      'SELECT id, status, primeira_entrega_final_em FROM entregas WHERE publicacao_id = ? AND aluno_id = ? AND deletado_em IS NULL',
      [pub.id, studentId]
    );

    if (finalSubmit && existingEntrega && ['ENVIADO', 'ATRASADO'].includes(existingEntrega.status) &&
      pub.pbl_1 && pub.periodo_nome === '2026/2' && now.getTime() > PBL_WRITTEN_RESUBMISSION_END) {
      return res.status(400).json({ message: 'O prazo para reenviar o PBL escrito terminou em 15/11/2026.' });
    }

    let entregaId: number;

    if (existingEntrega) {
      if (['ENVIADO', 'ATRASADO'].includes(existingEntrega.status) && !finalSubmit) {
        return res.status(400).json({ message: 'Esta entrega já foi finalizada e não pode ser revertida para rascunho.' });
      }

      await runAsync(
        `UPDATE entregas SET 
          status = ?, conteudo_resposta = ?, data_envio = ?,
          primeira_entrega_final_em = COALESCE(primeira_entrega_final_em, ?),
          comprovante_hash = COALESCE(?, comprovante_hash),
          atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [statusFinal, conteudoResposta || '', finalSubmit ? now.toISOString() : null,
          finalSubmit ? now.toISOString() : null, receiptHash, existingEntrega.id]
      );
      entregaId = existingEntrega.id;
    } else {
      const resIns = await runAsync(
        `INSERT INTO entregas (publicacao_id, aluno_id, status, conteudo_resposta, data_envio, primeira_entrega_final_em, comprovante_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [pub.id, studentId, statusFinal, conteudoResposta || '', finalSubmit ? now.toISOString() : null,
          finalSubmit ? now.toISOString() : null, receiptHash]
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

// Grupos com atividades publicadas de slides ou PBL 1 ainda sem entrega final.
export async function listPendingGroups(_req: AuthenticatedRequest, res: Response) {
  try {
    const groups = await queryAsync<{ grupo_id: number; sem_slides: boolean; sem_escrito: boolean }>(
      `WITH atividades_publicadas AS (
         SELECT a.id, pub.id AS publicacao_id, a.curso_id, a.periodo_letivo_id,
                va.forma_realizacao, a.natureza = ? AS slides,
                a.natureza = 'AVALIATIVA' AND EXISTS (
                  SELECT 1 FROM arquivos_atividades aa
                  JOIN arquivos ar ON ar.id = aa.arquivo_id
                  WHERE aa.versao_atividade_id = va.id
                    AND ar.tipo_documento = 'PBL_1' AND ar.deletado_em IS NULL
                ) AS escrito
         FROM atividades_pbl a
         JOIN publicacoes pub ON pub.atividade_id = a.id AND pub.status_publicacao = 'PUBLICADO'
         JOIN versoes_atividades va ON va.atividade_id = a.id AND va.numero_versao = a.versao_atual
         WHERE a.status = 'PUBLICADO' AND a.deletado_em IS NULL
       ), grupo_atividades AS (
         SELECT DISTINCT g.id AS grupo_id, t.id AS turma_id, ap.id AS atividade_id,
                ap.publicacao_id, ap.slides, ap.escrito
         FROM atividades_publicadas ap
         JOIN alunos_segmentados als ON als.atividade_id = ap.id
         JOIN matriculas m ON m.usuario_id = als.aluno_id
           AND m.ativo = 1 AND m.deletado_em IS NULL
         JOIN turmas t ON t.id = m.turma_id
           AND t.ativo = 1 AND t.deletado_em IS NULL
           AND t.curso_id = ap.curso_id AND t.periodo_letivo_id = ap.periodo_letivo_id
         JOIN grupos g ON g.id = m.grupo_id AND g.turma_id = t.id
           AND g.ativo = 1 AND g.deletado_em IS NULL
         WHERE (ap.slides OR ap.escrito) AND NOT EXISTS (
           SELECT 1 FROM segmentacoes seg
           JOIN segmentacao_regras sr ON sr.segmentacao_id = seg.id
           WHERE seg.atividade_id = ap.id AND sr.entidade_tipo = 'grupo'
             AND sr.entidade_id = g.id AND sr.acao = 'EXCLUIR'
         )
           AND (
             EXISTS (
               SELECT 1 FROM segmentacoes seg
               JOIN segmentacao_regras sr ON sr.segmentacao_id = seg.id
               WHERE seg.atividade_id = ap.id AND sr.entidade_tipo = 'grupo'
                 AND sr.entidade_id = g.id AND sr.acao = 'INCLUIR'
             ) OR (
               ap.forma_realizacao = 'GRUPO' AND NOT EXISTS (
                 SELECT 1 FROM segmentacoes seg
                 JOIN segmentacao_regras sr ON sr.segmentacao_id = seg.id
                 WHERE seg.atividade_id = ap.id AND sr.entidade_tipo = 'grupo'
               )
             )
           )
       ), grupo_status AS (
         SELECT ga.*,
                EXISTS (
                  SELECT 1 FROM entregas e
                  WHERE e.publicacao_id = ga.publicacao_id
                    AND e.deletado_em IS NULL AND e.status IN ('ENVIADO', 'ATRASADO')
                    AND (e.grupo_id = ga.grupo_id OR (e.grupo_id IS NULL AND EXISTS (
                      SELECT 1 FROM alunos_segmentados als_autor
                      JOIN matriculas ma ON ma.usuario_id = als_autor.aluno_id
                        AND ma.ativo = 1 AND ma.deletado_em IS NULL
                        AND ma.grupo_id = ga.grupo_id AND ma.turma_id = ga.turma_id
                      WHERE als_autor.atividade_id = ga.atividade_id AND als_autor.aluno_id = e.aluno_id
                    )))
                ) AS entregue
         FROM grupo_atividades ga
       )
       SELECT grupo_id,
              BOOL_OR(slides AND NOT entregue) AS sem_slides,
              BOOL_OR(escrito AND NOT entregue) AS sem_escrito
         FROM grupo_status
         GROUP BY grupo_id
         ORDER BY grupo_id`,
      [SLIDES_PRESENTATION_NATURE]
    );

    return res.json(groups.map((group) => ({
      grupoId: group.grupo_id,
      semSlides: group.sem_slides,
      semEscrito: group.sem_escrito
    })));
  } catch (err) {
    console.error('Error fetching pending groups:', err);
    return res.status(500).json({ message: 'Erro ao listar pendências dos grupos.' });
  }
}

// Lista geral ou por atividade, mantendo o mesmo escopo docente.
export async function listSubmissionsForActivity(req: AuthenticatedRequest, res: Response) {
  try {
    const { atividadeId } = req.params;
    const user = req.user;

    const isTeacher = user?.perfilNome === 'PROFESSOR';
    const params: any[] = [];
    let filtroAtividade = "a.status = 'PUBLICADO' AND a.deletado_em IS NULL";

    if (atividadeId) {
      const act = await getAsync<{ id: number; professor_id: number; natureza: string }>(
        'SELECT id, professor_id, natureza FROM atividades_pbl WHERE id = ? AND deletado_em IS NULL',
        [atividadeId]
      );

      if (!act) return res.status(404).json({ message: 'Atividade não encontrada.' });

      if (isTeacher && !(await professorAlcancaAtividade(user!.id, String(atividadeId)))) {
        return res.status(403).json({
          message: 'Acesso negado. Esta atividade não pertence a você nem às turmas que você leciona.'
        });
      }

      const pub = await getAsync<{ id: number }>('SELECT id FROM publicacoes WHERE atividade_id = ?', [atividadeId]);
      if (!pub) return res.json([]);
      filtroAtividade = 'e.publicacao_id = ? AND a.deletado_em IS NULL';
      params.push(pub.id);
    }

    // Grupo e turma seguem a matrícula de quem enviou (entregaGrupoTurmaJoins), que já
    // devolve uma linha por entrega; DISTINCT ON (e.id) protege contra feedbacks duplicados.
    let sql = `
      SELECT DISTINCT ON (e.id)
             e.*, u.nome as aluno_nome, u.email as aluno_email,
             g.id as grupo_id, g.nome as grupo_nome,
             t.id as turma_id, t.nome as turma_nome, t.codigo as turma_codigo,
             fb.nota_escrita, fb.nota_escrita_original, fb.nota_oral, fb.nota_total, fb.observacoes, fb.liberado_aluno, fb.versao,
             pl.nome as periodo_nome, a.natureza,
             a.id as atividade_id, a.titulo as atividade_titulo, a.codigo_unico,
             EXISTS (SELECT 1 FROM versoes_atividades va JOIN arquivos_atividades aa ON aa.versao_atividade_id = va.id
                     JOIN arquivos ar ON ar.id = aa.arquivo_id
                     WHERE va.atividade_id = p.atividade_id AND va.numero_versao = a.versao_atual
                       AND a.natureza = 'AVALIATIVA' AND a.deletado_em IS NULL
                       AND ar.tipo_documento = 'PBL_1' AND ar.deletado_em IS NULL) as pbl_1,
             (ca.completed_at IS NOT NULL) as contexto_completo
      FROM entregas e
      JOIN publicacoes p ON p.id = e.publicacao_id
      JOIN atividades_pbl a ON a.id = p.atividade_id
      JOIN periodos_letivos pl ON pl.id = a.periodo_letivo_id
      JOIN usuarios u ON e.aluno_id = u.id
      LEFT JOIN contexto_aluno ca ON ca.usuario_id = e.aluno_id
      ${entregaGrupoTurmaJoins}
      LEFT JOIN feedbacks fb ON e.id = fb.entrega_id
      WHERE ${filtroAtividade} AND e.deletado_em IS NULL
    `;

    // O docente só recebe as entregas de alunos matriculados nas turmas que leciona.
    if (isTeacher) {
      if (!atividadeId) {
        // Mesmas três formas de alcançar uma atividade de professorAlcancaAtividade.
        sql += ` AND (
          a.professor_id = ? OR EXISTS (
            SELECT 1 FROM vinculos_professores vp
            JOIN matriculas m ON m.turma_id = vp.turma_id AND m.deletado_em IS NULL
            JOIN alunos_segmentados als ON als.aluno_id = m.usuario_id
            WHERE vp.usuario_id = ? AND vp.ativo = 1 AND als.atividade_id = a.id
          ) OR EXISTS (
            SELECT 1 FROM vinculos_professores vp
            WHERE vp.usuario_id = ? AND vp.ativo = 1 AND a.disciplina_id = vp.disciplina_id
          )
        )`;
        params.push(user!.id, user!.id, user!.id);
      }
      sql += ` AND EXISTS (
        SELECT 1 FROM matriculas m2
        JOIN vinculos_professores vp ON vp.turma_id = m2.turma_id
        WHERE m2.usuario_id = e.aluno_id AND m2.deletado_em IS NULL
          AND vp.usuario_id = ? AND vp.ativo = 1
      )`;
      params.push(user!.id);
    }

    sql = `SELECT * FROM (${sql} ORDER BY e.id) sub ORDER BY grupo_nome ASC, data_envio DESC`;

    const submissions = await queryAsync<any>(sql, params);

    // Busca os anexos em lote também na visão geral, sem uma consulta por entrega.
    const arquivos = submissions.length ? await queryAsync<any>(
      `SELECT ae.entrega_id, ar.id, ar.nome_original, ar.tamanho_bytes, ar.mime_type,
              ar.categoria, ar.hash_md5, ar.criado_em
       FROM arquivos_entregas ae
       JOIN arquivos ar ON ae.arquivo_id = ar.id
       WHERE ae.entrega_id = ANY(?::int[]) AND ar.deletado_em IS NULL
       ORDER BY ar.criado_em ASC, ar.id ASC`,
      [submissions.map((sub) => sub.id)]
    ) : [];
    const arquivosPorEntrega = new Map<number, any[]>();
    for (const { entrega_id, ...arquivo } of arquivos) {
      const anexos = arquivosPorEntrega.get(entrega_id) || [];
      anexos.push(arquivo);
      arquivosPorEntrega.set(entrega_id, anexos);
    }
    for (const sub of submissions) {
      sub.arquivos = arquivosPorEntrega.get(sub.id) || [];
    }

    return res.json(submissions);
  } catch (err) {
    console.error('Erro ao listar entregas:', err);
    return res.status(500).json({ message: 'Erro ao listar entregas.' });
  }
}

// Submit Grade & Feedback for a Student Submission
export async function evaluateSubmission(req: AuthenticatedRequest, res: Response) {
  try {
    const { entregaId } = req.params;
    const evaluatorId = req.user?.id;
    const { notaEscrita, notaOral, observacoes, liberadoAluno, versao } = req.body;

    if (!evaluatorId) return res.status(401).json({ message: 'Não autenticado.' });

    const entrega = await getAsync<{ id: number; aluno_id: number; atividade_id: number; data_envio: string | null; primeira_entrega_final_em: string | null; pbl_1: boolean; periodo_nome: string; natureza: string }>(
      `SELECT e.id, e.aluno_id, p.atividade_id, e.data_envio, e.primeira_entrega_final_em, a.natureza,
              pl.nome as periodo_nome,
              EXISTS (SELECT 1 FROM atividades_pbl a
                      JOIN versoes_atividades va ON va.atividade_id = a.id AND va.numero_versao = a.versao_atual
                      JOIN arquivos_atividades aa ON aa.versao_atividade_id = va.id
                      JOIN arquivos ar ON ar.id = aa.arquivo_id
                      WHERE a.id = p.atividade_id AND a.natureza = 'AVALIATIVA' AND a.deletado_em IS NULL
                        AND ar.tipo_documento = 'PBL_1' AND ar.deletado_em IS NULL) as pbl_1
       FROM entregas e
       JOIN publicacoes p ON e.publicacao_id = p.id
      JOIN atividades_pbl a ON a.id = p.atividade_id
       JOIN periodos_letivos pl ON pl.id = a.periodo_letivo_id
       WHERE e.id = ? AND e.deletado_em IS NULL`,
      [entregaId]
    );

    if (!entrega) return res.status(404).json({ message: 'Entrega não encontrada.' });

    if (entrega.natureza === SLIDES_PRESENTATION_NATURE) {
      return res.status(400).json({ message: 'Esta entrega é obrigatória, mas não recebe avaliação ou nota.' });
    }

    // O docente só avalia entregas de atividades/turmas sob sua responsabilidade.
    if (req.user?.perfilNome === 'PROFESSOR') {
      const podeAvaliar = await professorAlcancaAtividade(evaluatorId, entrega.atividade_id);
      if (!podeAvaliar) {
        return res.status(403).json({
          message: 'Acesso negado. Esta entrega não pertence às turmas que você leciona.'
        });
      }
    }

    // O professor só registra o comentário de revisão do PBL escrito: as notas são
    // lançadas pela coordenação e a nota oral vem do app de avaliações orais.
    if (req.user?.perfilNome === 'PROFESSOR') {
      return salvarComentarioRevisao(res, Number(entregaId), entrega.aluno_id, evaluatorId, observacoes, liberadoAluno, versao);
    }

    // A nota oral em branco fica NULL: "ainda não lançada", diferente de zero (ausência).
    const notaOriginal = Number(notaEscrita);
    const oralVazia = notaOral === undefined || notaOral === null || String(notaOral).trim() === '';
    const nOral = oralVazia ? null : Number(notaOral);
    if (notaEscrita === undefined || notaEscrita === null || String(notaEscrita).trim() === ''
      || !Number.isFinite(notaOriginal) || notaOriginal < 0 || (nOral !== null && (!Number.isFinite(nOral) || nOral < 0))) {
      return res.status(400).json({ message: 'Informe notas numéricas, sem valores negativos.' });
    }
    if (aplicaEscalaPbl(Boolean(entrega.pbl_1), entrega.periodo_nome)) {
      if (notaOriginal > NOTA_MAXIMA_ESCRITA_PBL) {
        return res.status(400).json({ message: 'A nota do PBL escrito vai de 0 a 1,0.' });
      }
      if (nOral !== null && nOral > NOTA_MAXIMA_ORAL_PBL) {
        return res.status(400).json({ message: 'A nota do PBL oral vai de 0 a 1,5.' });
      }
    }

    const penalidade = calculatePblWrittenPenalty(
      notaOriginal, Boolean(entrega.pbl_1) && entrega.periodo_nome === '2026/2',
      entrega.data_envio, entrega.primeira_entrega_final_em
    );
    const nEscrita = penalidade.penaltyPercent ? Math.round(penalidade.written * 100) / 100 : notaOriginal;
    const nTotal = nEscrita + (nOral ?? 0);

    // Trava de versão: quem abriu o modal antes de outro professor salvar recebe 409
    // em vez de apagar a nota alheia. Clientes antigos, sem `versao`, não são travados.
    const conflito = { message: 'Outro avaliador alterou esta avaliação enquanto ela estava aberta. Recarregue a lista e confira as notas antes de salvar.' };
    const conferirVersao = versao !== undefined;
    if (conferirVersao && versao !== null && !Number.isInteger(Number(versao))) {
      return res.status(400).json({ message: 'Versão da avaliação inválida. Recarregue a lista.' });
    }
    const existingFb = await getAsync<{ id: number; versao: number }>('SELECT id, versao FROM feedbacks WHERE entrega_id = ?', [entregaId]);

    if (existingFb) {
      if (conferirVersao && versao === null) return res.status(409).json(conflito);
      const atualizado = await runAsync(
        `UPDATE feedbacks SET
          nota_escrita = ?, nota_escrita_original = ?, nota_oral = ?, nota_total = ?, observacoes = ?, liberado_aluno = ?,
          avaliador_id = ?, versao = versao + 1
         WHERE id = ?${conferirVersao ? ' AND versao = ?' : ''}`,
        [nEscrita, penalidade.penaltyPercent ? notaOriginal : null, nOral, nTotal, observacoes || '', liberadoAluno ? 1 : 0,
          evaluatorId, existingFb.id, ...(conferirVersao ? [Number(versao)] : [])]
      );
      if (atualizado.changes === 0) return res.status(409).json(conflito);
    } else {
      let inserido: { changes: number };
      try {
        inserido = await runAsync(
          `INSERT INTO feedbacks (entrega_id, avaliador_id, nota_escrita, nota_escrita_original, nota_oral, nota_total, observacoes, liberado_aluno)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?
           WHERE NOT EXISTS (SELECT 1 FROM feedbacks WHERE entrega_id = ?)`,
          [entregaId, evaluatorId, nEscrita, penalidade.penaltyPercent ? notaOriginal : null, nOral, nTotal, observacoes || '', liberadoAluno ? 1 : 0, entregaId]
        );
      } catch (err: any) {
        // feedbacks_entrega_id_unico: outro avaliador criou a avaliação no mesmo instante.
        if (err?.code === '23505') return res.status(409).json(conflito);
        throw err;
      }
      if (inserido.changes === 0) return res.status(409).json(conflito);
    }

    if (liberadoAluno) {
      const mensagem = nOral === null
        ? `Seu professor liberou a avaliação e feedback da sua atividade PBL. Nota escrita: ${nEscrita.toFixed(2)}. A nota oral será lançada após a apresentação.`
        : `Seu professor liberou a avaliação e feedback da sua atividade PBL. Nota Total: ${nTotal.toFixed(2)}`;
      await runAsync(
        `INSERT INTO notificacoes (usuario_id, titulo, mensagem, link) VALUES (?, ?, ?, ?)`,
        [entrega.aluno_id, 'Feedback e Nota Liberados', mensagem, `/aluno/atividades`]
      );
    }

    await logAudit(evaluatorId, 'AVALIAR_ENTREGA', 'feedbacks', String(entregaId), { nTotal, liberadoAluno });
    return res.json({ message: 'Avaliação registrada com sucesso.', notaTotal: nTotal, notaEscritaOriginal: penalidade.penaltyPercent ? notaOriginal : null, descontoPercentual: penalidade.penaltyPercent });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao avaliar entrega.' });
  }
}

/**
 * PROFESSOR: grava só o comentário de revisão do PBL escrito (e se ele fica visível
 * ao aluno), sem tocar nas notas já lançadas. Na primeira revisão as notas ficam
 * NULL ("ainda não lançadas"), e não zero.
 */
async function salvarComentarioRevisao(
  res: Response, entregaId: number, alunoId: number, avaliadorId: number,
  observacoes: unknown, liberadoAluno: unknown, versao: unknown
) {
  const conflito = { message: 'Outro avaliador alterou esta avaliação enquanto ela estava aberta. Recarregue a lista antes de salvar.' };
  const conferirVersao = versao !== undefined;
  if (conferirVersao && versao !== null && !Number.isInteger(Number(versao))) {
    return res.status(400).json({ message: 'Versão da avaliação inválida. Recarregue a lista.' });
  }
  const texto = typeof observacoes === 'string' ? observacoes : '';
  const liberado = liberadoAluno ? 1 : 0;
  const existingFb = await getAsync<{ id: number }>('SELECT id FROM feedbacks WHERE entrega_id = ?', [entregaId]);

  if (existingFb) {
    if (conferirVersao && versao === null) return res.status(409).json(conflito);
    const atualizado = await runAsync(
      `UPDATE feedbacks SET observacoes = ?, liberado_aluno = ?, avaliador_id = ?, versao = versao + 1
       WHERE id = ?${conferirVersao ? ' AND versao = ?' : ''}`,
      [texto, liberado, avaliadorId, existingFb.id, ...(conferirVersao ? [Number(versao)] : [])]
    );
    if (atualizado.changes === 0) return res.status(409).json(conflito);
  } else {
    let inserido: { changes: number };
    try {
      inserido = await runAsync(
        `INSERT INTO feedbacks (entrega_id, avaliador_id, nota_escrita, nota_escrita_original, nota_oral, nota_total, observacoes, liberado_aluno)
         SELECT ?, ?, NULL, NULL, NULL, NULL, ?, ?
         WHERE NOT EXISTS (SELECT 1 FROM feedbacks WHERE entrega_id = ?)`,
        [entregaId, avaliadorId, texto, liberado, entregaId]
      );
    } catch (err: any) {
      if (err?.code === '23505') return res.status(409).json(conflito);
      throw err;
    }
    if (inserido.changes === 0) return res.status(409).json(conflito);
  }

  if (liberado) {
    await runAsync(
      `INSERT INTO notificacoes (usuario_id, titulo, mensagem, link) VALUES (?, ?, ?, ?)`,
      [alunoId, 'Comentário de revisão liberado', 'Seu professor liberou o comentário de revisão do PBL escrito.', `/aluno/atividades`]
    );
  }

  await logAudit(avaliadorId, 'COMENTAR_REVISAO_PBL_ESCRITO', 'feedbacks', String(entregaId), { liberadoAluno: Boolean(liberado) });
  return res.json({ message: 'Comentário de revisão registrado com sucesso.' });
}

/**
 * ADMIN: exclui uma entrega (relatório do aluno). A exclusão é lógica — a linha
 * sai de todas as telas, dashboards e relatórios, mas continua no banco e pode
 * ser restaurada. A nota/feedback e os arquivos anexados são preservados junto,
 * de modo que restaurar devolve a entrega completa. Depois de excluída, o aluno
 * volta a poder enviar aquela atividade do zero.
 */
export async function deleteSubmission(req: AuthenticatedRequest, res: Response) {
  try {
    const adminId = req.user?.id;
    const { entregaId } = req.params;

    const entrega = await getAsync<{ id: number; aluno_id: number; deletado_em: string | null }>(
      'SELECT id, aluno_id, deletado_em FROM entregas WHERE id = ?',
      [entregaId]
    );
    if (!entrega) return res.status(404).json({ message: 'Entrega não encontrada.' });
    if (entrega.deletado_em) return res.status(400).json({ message: 'Esta entrega já está excluída.' });

    await runAsync('UPDATE entregas SET deletado_em = CURRENT_TIMESTAMP WHERE id = ?', [entregaId]);

    await logAudit(adminId || null, 'EXCLUIR_ENTREGA', 'entregas', String(entregaId), {
      alunoId: entrega.aluno_id
    });
    return res.json({ message: 'Entrega excluída. Ela sai das telas, mas pode ser restaurada.' });
  } catch (err) {
    console.error('Erro ao excluir entrega:', err);
    return res.status(500).json({ message: 'Erro ao excluir a entrega.' });
  }
}

/** ADMIN: lista as entregas excluídas (a "lixeira"), para conferência ou restauração. */
export async function listDeletedSubmissions(req: AuthenticatedRequest, res: Response) {
  try {
    const list = await queryAsync(
      `SELECT e.id, e.status, e.data_envio, e.deletado_em,
              u.nome as aluno_nome, u.email as aluno_email,
              g.nome as grupo_nome,
              a.id as atividade_id, a.titulo as atividade_titulo, a.codigo_unico
       FROM entregas e
       JOIN usuarios u ON e.aluno_id = u.id
       JOIN publicacoes p ON e.publicacao_id = p.id
       JOIN atividades_pbl a ON p.atividade_id = a.id
       ${entregaGrupoTurmaJoins}
       WHERE e.deletado_em IS NOT NULL
       ORDER BY e.deletado_em DESC`
    );
    return res.json(list);
  } catch (err) {
    console.error('Erro ao listar entregas excluídas:', err);
    return res.status(500).json({ message: 'Erro ao listar as entregas excluídas.' });
  }
}

/** ADMIN: restaura uma entrega excluída. */
export async function restoreSubmission(req: AuthenticatedRequest, res: Response) {
  try {
    const adminId = req.user?.id;
    const { entregaId } = req.params;

    const entrega = await getAsync<{ id: number; publicacao_id: number; aluno_id: number; deletado_em: string | null }>(
      'SELECT id, publicacao_id, aluno_id, deletado_em FROM entregas WHERE id = ?',
      [entregaId]
    );
    if (!entrega) return res.status(404).json({ message: 'Entrega não encontrada.' });
    if (!entrega.deletado_em) return res.status(400).json({ message: 'Esta entrega não está excluída.' });

    // Se o aluno já refez a entrega depois da exclusão, restaurar criaria duas
    // entregas ativas para a mesma atividade — melhor barrar e explicar.
    const entregaAtiva = await getAsync<{ id: number }>(
      'SELECT id FROM entregas WHERE publicacao_id = ? AND aluno_id = ? AND deletado_em IS NULL',
      [entrega.publicacao_id, entrega.aluno_id]
    );
    if (entregaAtiva) {
      return res.status(409).json({
        message: 'O aluno já enviou uma nova entrega para esta atividade. Exclua a nova antes de restaurar esta.'
      });
    }

    await runAsync('UPDATE entregas SET deletado_em = NULL WHERE id = ?', [entregaId]);

    await logAudit(adminId || null, 'RESTAURAR_ENTREGA', 'entregas', String(entregaId), {
      alunoId: entrega.aluno_id
    });
    return res.json({ message: 'Entrega restaurada com sucesso.' });
  } catch (err) {
    console.error('Erro ao restaurar entrega:', err);
    return res.status(500).json({ message: 'Erro ao restaurar a entrega.' });
  }
}

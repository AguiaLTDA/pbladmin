/**
 * Resolve the one submission a student may see for each published activity.
 * Own drafts stay private; only final submissions are visible across a group.
 */
export const studentDeliveryCte = `
  WITH entrega_aluno_visivel AS (
    SELECT DISTINCT ON (pub.id, alvo.aluno_id)
           e.*, alvo.aluno_id AS viewer_id,
           (e.aluno_id <> alvo.aluno_id) AS entrega_compartilhada,
           autor.nome AS enviado_por_nome
    FROM alunos_segmentados alvo
    JOIN atividades_pbl a ON a.id = alvo.atividade_id
    JOIN publicacoes pub ON pub.atividade_id = a.id AND pub.status_publicacao = 'PUBLICADO'
    JOIN entregas e ON e.publicacao_id = pub.id AND e.deletado_em IS NULL
    JOIN alunos_segmentados alvo_autor
      ON alvo_autor.atividade_id = a.id AND alvo_autor.aluno_id = e.aluno_id
    JOIN usuarios autor ON autor.id = e.aluno_id
    LEFT JOIN versoes_atividades va
      ON va.atividade_id = a.id AND va.numero_versao = a.versao_atual
    WHERE alvo.aluno_id = ? AND a.status = 'PUBLICADO' AND a.deletado_em IS NULL
      AND (
        e.aluno_id = alvo.aluno_id
        OR (
          e.status IN ('ENVIADO', 'ATRASADO')
          AND EXISTS (
            SELECT 1
            FROM matriculas m_viewer
            JOIN grupos g ON g.id = m_viewer.grupo_id AND g.ativo = 1 AND g.deletado_em IS NULL
            JOIN turmas t ON t.id = g.turma_id AND t.ativo = 1 AND t.deletado_em IS NULL
            JOIN matriculas m_autor
              ON m_autor.grupo_id = g.id AND m_autor.turma_id = t.id
             AND m_autor.usuario_id = e.aluno_id AND m_autor.ativo = 1 AND m_autor.deletado_em IS NULL
            WHERE m_viewer.usuario_id = alvo.aluno_id
              AND m_viewer.turma_id = t.id AND m_viewer.ativo = 1 AND m_viewer.deletado_em IS NULL
              AND t.curso_id = a.curso_id AND t.periodo_letivo_id = a.periodo_letivo_id
              AND (e.grupo_id IS NULL OR e.grupo_id = g.id)
              AND NOT EXISTS (
                SELECT 1 FROM segmentacoes seg
                JOIN segmentacao_regras sr ON sr.segmentacao_id = seg.id
                WHERE seg.atividade_id = a.id AND sr.entidade_tipo = 'grupo'
                  AND sr.entidade_id = g.id AND sr.acao = 'EXCLUIR'
              )
              AND (
                EXISTS (
                  SELECT 1 FROM segmentacoes seg
                  JOIN segmentacao_regras sr ON sr.segmentacao_id = seg.id
                  WHERE seg.atividade_id = a.id AND sr.entidade_tipo = 'grupo'
                    AND sr.entidade_id = g.id AND sr.acao = 'INCLUIR'
                )
                OR (
                  va.forma_realizacao = 'GRUPO'
                  AND NOT EXISTS (
                    SELECT 1 FROM segmentacoes seg
                    JOIN segmentacao_regras sr ON sr.segmentacao_id = seg.id
                    WHERE seg.atividade_id = a.id AND sr.entidade_tipo = 'grupo'
                  )
                )
              )
          )
        )
      )
    ORDER BY pub.id, alvo.aluno_id,
      CASE WHEN e.status IN ('ENVIADO', 'ATRASADO') THEN 0 ELSE 1 END,
      COALESCE(e.primeira_entrega_final_em, e.data_envio, e.criado_em) ASC NULLS LAST,
      e.id ASC
  )`;

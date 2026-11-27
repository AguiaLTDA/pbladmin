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

/**
 * Grupo (`g`) e turma (`t`) de uma entrega para as telas da equipe. Exige os aliases
 * `e` (entregas) e `a` (atividades_pbl). A entrega real nasce sem grupo_id e acompanha
 * o grupo atual de quem enviou. O grupo só aparece quando `studentDeliveryCte` a
 * compartilharia com esse grupo: matrícula, turma e grupo ativos no curso e no período
 * da atividade, atividade em grupo (ou segmentada para o grupo) e grupo não excluído.
 * A turma cai para a melhor matrícula restante, inclusive inativa, quando não há grupo.
 */
export const entregaGrupoTurmaJoins = `
  LEFT JOIN LATERAL (
    SELECT cand.turma_id, cand.grupo_id FROM (
    SELECT m.id, m.turma_id,
           (m.ativo = 1 AND tm.ativo = 1 AND tm.deletado_em IS NULL) AS ativa,
           (tm.curso_id = a.curso_id AND tm.periodo_letivo_id = a.periodo_letivo_id) AS da_atividade,
           CASE WHEN m.ativo = 1 AND tm.ativo = 1 AND tm.deletado_em IS NULL
                 AND tm.curso_id = a.curso_id AND tm.periodo_letivo_id = a.periodo_letivo_id
                 AND NOT EXISTS (
                   SELECT 1 FROM segmentacoes seg
                   JOIN segmentacao_regras sr ON sr.segmentacao_id = seg.id
                   WHERE seg.atividade_id = a.id AND sr.entidade_tipo = 'grupo'
                     AND sr.entidade_id = gm.id AND sr.acao = 'EXCLUIR'
                 )
                 AND (
                   EXISTS (
                     SELECT 1 FROM segmentacoes seg
                     JOIN segmentacao_regras sr ON sr.segmentacao_id = seg.id
                     WHERE seg.atividade_id = a.id AND sr.entidade_tipo = 'grupo'
                       AND sr.entidade_id = gm.id AND sr.acao = 'INCLUIR'
                   )
                   OR (
                     EXISTS (
                       SELECT 1 FROM versoes_atividades va_g
                       WHERE va_g.atividade_id = a.id AND va_g.numero_versao = a.versao_atual
                         AND va_g.forma_realizacao = 'GRUPO'
                     )
                     AND NOT EXISTS (
                       SELECT 1 FROM segmentacoes seg
                       JOIN segmentacao_regras sr ON sr.segmentacao_id = seg.id
                       WHERE seg.atividade_id = a.id AND sr.entidade_tipo = 'grupo'
                     )
                   )
                 )
                THEN gm.id END AS grupo_id
    FROM matriculas m
    JOIN turmas tm ON tm.id = m.turma_id
    LEFT JOIN grupos gm ON gm.id = m.grupo_id AND gm.turma_id = m.turma_id
     AND gm.ativo = 1 AND gm.deletado_em IS NULL
    WHERE m.usuario_id = e.aluno_id AND m.deletado_em IS NULL
    ) cand
    ORDER BY (cand.grupo_id IS NOT NULL) DESC, cand.ativa DESC, cand.da_atividade DESC, cand.id DESC
    LIMIT 1
  ) mat_autor ON TRUE
  LEFT JOIN grupos g ON g.id = COALESCE(e.grupo_id, mat_autor.grupo_id)
  LEFT JOIN turmas t ON t.id = COALESCE(g.turma_id, mat_autor.turma_id)`;

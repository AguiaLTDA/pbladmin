import { PoolClient } from 'pg';
import { pool } from '../config/db';

export const SLIDES_PRESENTATION_DEADLINE = new Date('2026-11-19T23:59:59.999-03:00');
export const SLIDES_PRESENTATION_NATURE = 'OBRIGATORIA_SEM_NOTA';

/** Acrescenta a janela de slides e provisiona uma entrega por atividade PBL 1 publicada. */
export async function ensureSlidesPresentationDelivery(existingClient?: PoolClient): Promise<void> {
  const client = existingClient ?? await pool.connect();
  const ownsClient = !existingClient;

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(710261119)');

    const cronogramaAtual = await client.query(
      `SELECT id FROM cronograma_pbl WHERE id = 1 AND periodo = '2026/2'`
    );
    const etapaExistente = cronogramaAtual.rowCount ? await client.query(
      `SELECT id FROM cronograma_pbl_etapas
        WHERE titulo = 'Entrega obrigatória dos slides da apresentação (sem nota)' LIMIT 1`
    ) : undefined;
    if (cronogramaAtual.rowCount && etapaExistente?.rowCount === 0) {
      const apresentacao = await client.query(
        `SELECT posicao FROM cronograma_pbl_etapas WHERE ordem = 7 ORDER BY posicao, id LIMIT 1`
      );
      const ultima = apresentacao.rowCount ? null : await client.query(
        `SELECT COALESCE(MAX(posicao), 0) + 1 AS posicao FROM cronograma_pbl_etapas`
      );
      const posicao = apresentacao.rows[0]?.posicao ?? ultima?.rows[0]?.posicao ?? 1;
      await client.query('UPDATE cronograma_pbl_etapas SET posicao = posicao + 1 WHERE posicao >= $1', [posicao]);
      await client.query(
        `INSERT INTO cronograma_pbl_etapas (posicao, ordem, titulo, prazo_texto, fim, pontos)
         VALUES ($1, NULL, 'Entrega obrigatória dos slides da apresentação (sem nota)', 'somente .pptx, até 19 de novembro', '2026-11-19', NULL)`,
        [posicao]
      );
    }

    if (cronogramaAtual.rowCount) {
      // Corrige também a etapa sem número já publicada; repetir não renumera novamente.
      await client.query(`UPDATE cronograma_pbl_etapas SET ordem = ordem + 1
        WHERE ordem >= 7 AND EXISTS (
          SELECT 1 FROM cronograma_pbl_etapas
          WHERE titulo = 'Entrega obrigatória dos slides da apresentação (sem nota)' AND ordem IS NULL
        )`);
      await client.query(`UPDATE cronograma_pbl_etapas SET ordem = 7
        WHERE titulo = 'Entrega obrigatória dos slides da apresentação (sem nota)' AND ordem IS NULL`);
    }

    const fontes = await client.query<{ id: number; titulo: string; curso_id: number; disciplina_id: number; professor_id: number; periodo_letivo_id: number }>(
      `SELECT DISTINCT a.id, a.titulo, a.curso_id, a.disciplina_id, a.professor_id, a.periodo_letivo_id
         FROM atividades_pbl a
         JOIN periodos_letivos pl ON pl.id = a.periodo_letivo_id AND pl.nome = '2026/2'
         JOIN versoes_atividades va ON va.atividade_id = a.id AND va.numero_versao = a.versao_atual
         JOIN arquivos_atividades aa ON aa.versao_atividade_id = va.id
         JOIN arquivos ar ON ar.id = aa.arquivo_id AND ar.tipo_documento = 'PBL_1' AND ar.deletado_em IS NULL
         JOIN publicacoes pub ON pub.atividade_id = a.id AND pub.status_publicacao = 'PUBLICADO'
        WHERE a.status = 'PUBLICADO' AND a.natureza = 'AVALIATIVA' AND a.deletado_em IS NULL
          AND EXISTS (
            SELECT 1 FROM alunos_segmentados als JOIN usuarios u ON u.id = als.aluno_id
             WHERE als.atividade_id = a.id AND u.ativo = 1 AND u.deletado_em IS NULL
          )
          AND (
            NOT EXISTS (
              SELECT 1 FROM segmentacoes seg JOIN segmentacao_regras sr ON sr.segmentacao_id = seg.id
               WHERE seg.atividade_id = a.id AND sr.entidade_tipo = 'grupo' AND sr.acao = 'INCLUIR'
            )
            OR EXISTS (
              SELECT 1 FROM segmentacoes seg JOIN segmentacao_regras sr ON sr.segmentacao_id = seg.id
              JOIN grupos g ON g.id = sr.entidade_id AND g.ativo = 1 AND g.deletado_em IS NULL
              JOIN turmas t ON t.id = g.turma_id AND t.periodo_letivo_id = a.periodo_letivo_id
                AND t.ativo = 1 AND t.deletado_em IS NULL
               WHERE seg.atividade_id = a.id AND sr.entidade_tipo = 'grupo' AND sr.acao = 'INCLUIR'
            )
          )
        ORDER BY a.id`
    );

    for (const fonte of fontes.rows) {
      const codigo = `PBL-SLIDES-2026-2-ATIVIDADE-${fonte.id}`;
      await client.query(
        `INSERT INTO atividades_pbl
          (codigo_unico, titulo, curso_id, disciplina_id, professor_id, periodo_letivo_id, status, natureza, versao_atual)
         VALUES ($1, $2, $3, $4, $5, $6, 'PUBLICADO', $7, 1)
         ON CONFLICT (codigo_unico) DO NOTHING`,
        [codigo, `Slides da apresentação — ${fonte.titulo}`, fonte.curso_id, fonte.disciplina_id,
          fonte.professor_id, fonte.periodo_letivo_id, SLIDES_PRESENTATION_NATURE]
      );
      const atividadeResult = await client.query<{ id: number }>(
        'SELECT id FROM atividades_pbl WHERE codigo_unico = $1 AND deletado_em IS NULL', [codigo]
      );
      const atividadeId = atividadeResult.rows[0]?.id;
      if (!atividadeId) continue;

      await client.query(
        `INSERT INTO versoes_atividades (atividade_id, numero_versao, instrucoes_gerais, criado_por)
         SELECT $1, 1, 'Envie os slides da apresentação em formato PowerPoint (.pptx) até 19/11/2026, às 23h59min59s (horário de Brasília). Esta entrega é obrigatória e não recebe nota.', $2
          WHERE NOT EXISTS (SELECT 1 FROM versoes_atividades WHERE atividade_id = $1 AND numero_versao = 1)`,
        [atividadeId, fonte.professor_id]
      );

      const origens = await client.query<{ id: number; tipo_segmentacao: string }>(
        'SELECT id, tipo_segmentacao FROM segmentacoes WHERE atividade_id = $1 ORDER BY id', [fonte.id]
      );
      const destinos = await client.query<{ id: number }>(
        'SELECT id FROM segmentacoes WHERE atividade_id = $1 ORDER BY id', [atividadeId]
      );
      for (let i = 0; i < origens.rows.length; i++) {
        let destinoId = destinos.rows[i]?.id;
        if (!destinoId) {
          const inserted = await client.query<{ id: number }>(
            'INSERT INTO segmentacoes (atividade_id, tipo_segmentacao) VALUES ($1, $2) RETURNING id',
            [atividadeId, origens.rows[i].tipo_segmentacao]
          );
          destinoId = inserted.rows[0].id;
        }
        await client.query(
          `INSERT INTO segmentacao_regras (segmentacao_id, entidade_tipo, entidade_id, acao)
           SELECT $1, sr.entidade_tipo, sr.entidade_id, sr.acao FROM segmentacao_regras sr
            WHERE sr.segmentacao_id = $2
              AND NOT EXISTS (
                SELECT 1 FROM segmentacao_regras d
                 WHERE d.segmentacao_id = $1 AND d.entidade_tipo = sr.entidade_tipo
                   AND d.entidade_id = sr.entidade_id AND d.acao = sr.acao
              )`,
          [destinoId, origens.rows[i].id]
        );
      }

      await client.query(
        `INSERT INTO alunos_segmentados (atividade_id, aluno_id)
         SELECT $1, als.aluno_id FROM alunos_segmentados als
         JOIN usuarios u ON u.id = als.aluno_id AND u.ativo = 1 AND u.deletado_em IS NULL
         WHERE als.atividade_id = $2 ON CONFLICT (atividade_id, aluno_id) DO NOTHING`,
        [atividadeId, fonte.id]
      );
      await client.query(
        `INSERT INTO publicacoes (atividade_id, data_disponibilizacao, prazo_entrega, publicado_por, status_publicacao)
         SELECT $1, CURRENT_TIMESTAMP, $2, $3, 'PUBLICADO'
          WHERE NOT EXISTS (SELECT 1 FROM publicacoes WHERE atividade_id = $1 AND status_publicacao = 'PUBLICADO')`,
        [atividadeId, SLIDES_PRESENTATION_DEADLINE.toISOString(), fonte.professor_id]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    if (ownsClient) client.release();
  }
}

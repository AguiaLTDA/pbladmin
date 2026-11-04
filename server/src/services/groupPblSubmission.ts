import { getAsync, queryAsync, runAsync } from '../config/db';
import { CRONOGRAMA_PBL_PADRAO } from '../config/cronogramaPadrao';

const INSTRUCOES_PBL_1 =
  'Desenvolva a solução para a situação-problema e envie sua resposta ou arquivo pela área de entrega desta atividade.';

/** Prazo no último segundo do dia local, representado com o fuso de Brasília. */
export async function getPrazoPblEscrito(): Promise<string> {
  const etapa = await getAsync<{ fim: string }>(
    `SELECT fim FROM cronograma_pbl_etapas WHERE ordem = 4 ORDER BY posicao ASC, id ASC LIMIT 1`
  );
  const fim = etapa?.fim || CRONOGRAMA_PBL_PADRAO.etapas.find((e) => e.ordem === 4)?.fim;
  if (!fim || !/^\d{4}-\d{2}-\d{2}$/.test(fim) || Number.isNaN(Date.parse(`${fim}T23:59:59-03:00`))) {
    throw new Error('O cronograma não contém uma data válida para a entrega do PBL escrito.');
  }
  return new Date(`${fim}T23:59:59-03:00`).toISOString();
}

/** Corrige PBLs publicados que foram classificados como material informativo. */
export async function repararPblsInformativosDeGrupo(arquivoId?: number): Promise<void> {
  const filtroArquivo = arquivoId === undefined ? '' : 'AND ar.id = ?';
  const atividades = await queryAsync<{
    id: number;
    titulo: string;
    versao_id: number;
  }>(
    `SELECT DISTINCT a.id, a.titulo, va.id AS versao_id
       FROM atividades_pbl a
       JOIN versoes_atividades va ON va.atividade_id = a.id AND va.numero_versao = a.versao_atual
       JOIN arquivos_atividades aa ON aa.versao_atividade_id = va.id
       JOIN arquivos ar ON ar.id = aa.arquivo_id AND ar.deletado_em IS NULL AND ar.tipo_documento = 'PBL_1'
       JOIN publicacoes pub ON pub.atividade_id = a.id AND pub.status_publicacao = 'PUBLICADO'
      WHERE a.natureza = 'INFORMATIVA' AND a.status = 'PUBLICADO' AND a.deletado_em IS NULL
        AND EXISTS (
          SELECT 1 FROM segmentacoes seg
          JOIN segmentacao_regras sr ON sr.segmentacao_id = seg.id
           AND sr.entidade_tipo = 'grupo' AND sr.acao = 'INCLUIR'
          WHERE seg.atividade_id = a.id
        )
        ${filtroArquivo}
      ORDER BY a.id`,
    arquivoId === undefined ? [] : [arquivoId]
  );

  if (atividades.length === 0) return;
  const prazo = await getPrazoPblEscrito();

  for (const atividade of atividades) {
    await runAsync(
      `WITH atualizada AS (
         UPDATE atividades_pbl
            SET natureza = 'AVALIATIVA',
                titulo = 'PBL 1: ' || REGEXP_REPLACE(titulo, '^Material:[[:space:]]*', '', 'i'),
                atualizado_em = CURRENT_TIMESTAMP
          WHERE id = ? AND natureza = 'INFORMATIVA' AND status = 'PUBLICADO' AND deletado_em IS NULL
          RETURNING id, versao_atual
       ), versao AS (
         UPDATE versoes_atividades va SET instrucoes_gerais = ?
           FROM atualizada a
          WHERE va.atividade_id = a.id AND va.numero_versao = a.versao_atual
          RETURNING va.id
       )
       UPDATE publicacoes pub SET prazo_entrega = ?
        FROM atualizada a
       WHERE pub.atividade_id = a.id AND pub.status_publicacao = 'PUBLICADO'`,
      [atividade.id, INSTRUCOES_PBL_1, prazo]
    );
  }
}

export { INSTRUCOES_PBL_1 };

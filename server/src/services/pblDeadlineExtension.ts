import { runAsync } from '../config/db';

/** Prorrogação excepcional de 2026/2; preserva prazos personalizados e notas brutas. */
export async function prorrogarPblEscritoNovembro2026(): Promise<void> {
  await runAsync(`ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS nota_escrita_original DOUBLE PRECISION DEFAULT NULL`);

  await runAsync(
    `UPDATE cronograma_pbl_etapas SET fim = '2026-11-10',
       prazo_texto = 'até 10 de novembro (envios após 04/11 com desconto de 20% na nota escrita)'
     WHERE ordem = 4 AND fim = '2026-11-04'
       AND EXISTS (SELECT 1 FROM cronograma_pbl WHERE id = 1 AND periodo = '2026/2')`
  );

  // O vínculo com o arquivo PBL_1 distingue o escrito de materiais e apresentações.
  await runAsync(
    `UPDATE publicacoes pub SET prazo_entrega = '2026-11-10T23:59:59-03:00'::timestamptz
     FROM atividades_pbl a
     WHERE pub.atividade_id = a.id AND pub.status_publicacao = 'PUBLICADO'
       AND a.deletado_em IS NULL AND a.natureza = 'AVALIATIVA'
       AND pub.prazo_entrega = '2026-11-04T23:59:59-03:00'::timestamptz
       AND EXISTS (
         SELECT 1 FROM versoes_atividades va
         JOIN arquivos_atividades aa ON aa.versao_atividade_id = va.id
         JOIN arquivos ar ON ar.id = aa.arquivo_id
         WHERE va.atividade_id = a.id AND va.numero_versao = a.versao_atual
           AND ar.tipo_documento = 'PBL_1' AND ar.deletado_em IS NULL
       )`
  );

  // Um único UPDATE preserva a nota original e aplica o desconto uma única vez,
  // inclusive às avaliações existentes. Repetir a migração não acumula desconto.
  await runAsync(
    `UPDATE feedbacks fb SET nota_escrita_original = fb.nota_escrita,
       nota_escrita = ROUND((fb.nota_escrita * 0.8)::numeric, 2)::double precision,
       nota_total = ROUND((fb.nota_escrita * 0.8)::numeric, 2)::double precision + fb.nota_oral
     FROM entregas e
     JOIN publicacoes pub ON pub.id = e.publicacao_id
     JOIN atividades_pbl a ON a.id = pub.atividade_id
     WHERE fb.entrega_id = e.id AND fb.nota_escrita_original IS NULL
       AND e.deletado_em IS NULL AND a.deletado_em IS NULL AND a.natureza = 'AVALIATIVA'
       AND e.data_envio >= '2026-11-05T00:00:00-03:00'::timestamptz
       AND e.data_envio < '2026-11-11T00:00:00-03:00'::timestamptz
       AND EXISTS (
         SELECT 1 FROM versoes_atividades va
         JOIN arquivos_atividades aa ON aa.versao_atividade_id = va.id
         JOIN arquivos ar ON ar.id = aa.arquivo_id
         WHERE va.atividade_id = a.id AND va.numero_versao = a.versao_atual
           AND ar.tipo_documento = 'PBL_1' AND ar.deletado_em IS NULL
       )`
  );
}

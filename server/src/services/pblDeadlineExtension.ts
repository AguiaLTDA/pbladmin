import { runAsync } from '../config/db';

/** Prorrogação excepcional de 2026/2; preserva prazos personalizados e notas brutas. */
export async function prorrogarPblEscritoNovembro2026(): Promise<void> {
  await runAsync(`ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS nota_escrita_original DOUBLE PRECISION DEFAULT NULL`);
  await runAsync(`ALTER TABLE entregas ADD COLUMN IF NOT EXISTS primeira_entrega_final_em TIMESTAMPTZ DEFAULT NULL`);

  // Reconstrói a primeira final antiga pelo log; rascunhos não recebem data inicial.
  await runAsync(
    `UPDATE entregas e SET primeira_entrega_final_em = LEAST(e.data_envio,
       (SELECT MIN(la.criado_em) FROM logs_auditoria la
        WHERE la.recurso = 'entregas' AND la.recurso_id = e.id::text
          AND la.acao = 'SUBMETER_ENTREGA_FINAL'))
     WHERE e.status IN ('ENVIADO', 'ATRASADO') AND e.data_envio IS NOT NULL
       AND e.primeira_entrega_final_em IS NULL`
  );

  await runAsync(
    `UPDATE cronograma_pbl_etapas SET fim = '2026-11-15',
       prazo_texto = 'até 15 de novembro (envios após 04/11 com desconto de 20% na nota escrita)'
     WHERE ordem = 4 AND fim IN ('2026-11-04', '2026-11-10')
       AND EXISTS (SELECT 1 FROM cronograma_pbl WHERE id = 1 AND periodo = '2026/2')`
  );

  // O vínculo com o arquivo PBL_1 distingue o escrito de materiais e apresentações.
  await runAsync(
    `UPDATE publicacoes pub SET prazo_entrega = '2026-11-15T23:59:59-03:00'::timestamptz
     FROM atividades_pbl a
     JOIN periodos_letivos pl ON pl.id = a.periodo_letivo_id
     WHERE pub.atividade_id = a.id AND pub.status_publicacao = 'PUBLICADO'
       AND a.deletado_em IS NULL AND a.natureza = 'AVALIATIVA' AND pl.nome = '2026/2'
       AND pub.prazo_entrega IN (
         '2026-11-04T23:59:59-03:00'::timestamptz,
         '2026-11-10T23:59:59-03:00'::timestamptz
       )
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
    `UPDATE feedbacks fb SET nota_escrita = fb.nota_escrita_original,
       nota_total = fb.nota_escrita_original + fb.nota_oral, nota_escrita_original = NULL
     FROM entregas e
     JOIN publicacoes pub ON pub.id = e.publicacao_id
     JOIN atividades_pbl a ON a.id = pub.atividade_id
     JOIN periodos_letivos pl ON pl.id = a.periodo_letivo_id
     WHERE fb.entrega_id = e.id AND fb.nota_escrita_original IS NOT NULL
       AND e.deletado_em IS NULL AND a.deletado_em IS NULL AND a.natureza = 'AVALIATIVA'
       AND pl.nome = '2026/2'
       AND e.data_envio >= '2026-11-05T00:00:00-03:00'::timestamptz
       AND e.data_envio < '2026-11-16T00:00:00-03:00'::timestamptz
       AND e.primeira_entrega_final_em <= '2026-11-04T23:59:59.999-03:00'::timestamptz
       AND EXISTS (
         SELECT 1 FROM versoes_atividades va
         JOIN arquivos_atividades aa ON aa.versao_atividade_id = va.id
         JOIN arquivos ar ON ar.id = aa.arquivo_id
         WHERE va.atividade_id = a.id AND va.numero_versao = a.versao_atual
           AND ar.tipo_documento = 'PBL_1' AND ar.deletado_em IS NULL
       )`
  );

  await runAsync(
    `UPDATE feedbacks fb SET nota_escrita_original = fb.nota_escrita,
       nota_escrita = ROUND((fb.nota_escrita * 0.8)::numeric, 2)::double precision,
       nota_total = ROUND((fb.nota_escrita * 0.8)::numeric, 2)::double precision + fb.nota_oral
     FROM entregas e
     JOIN publicacoes pub ON pub.id = e.publicacao_id
     JOIN atividades_pbl a ON a.id = pub.atividade_id
     JOIN periodos_letivos pl ON pl.id = a.periodo_letivo_id
     WHERE fb.entrega_id = e.id AND fb.nota_escrita_original IS NULL
       AND e.deletado_em IS NULL AND a.deletado_em IS NULL AND a.natureza = 'AVALIATIVA'
       AND pl.nome = '2026/2'
       AND e.data_envio >= '2026-11-05T00:00:00-03:00'::timestamptz
       AND e.data_envio < '2026-11-16T00:00:00-03:00'::timestamptz
       AND e.primeira_entrega_final_em >= '2026-11-05T00:00:00-03:00'::timestamptz
       AND e.primeira_entrega_final_em < '2026-11-16T00:00:00-03:00'::timestamptz
       AND EXISTS (
         SELECT 1 FROM versoes_atividades va
         JOIN arquivos_atividades aa ON aa.versao_atividade_id = va.id
         JOIN arquivos ar ON ar.id = aa.arquivo_id
         WHERE va.atividade_id = a.id AND va.numero_versao = a.versao_atual
           AND ar.tipo_documento = 'PBL_1' AND ar.deletado_em IS NULL
       )`
  );
}

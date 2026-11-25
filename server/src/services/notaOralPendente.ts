import { getAsync, runAsync } from '../config/db';

/**
 * Prepara `feedbacks` para notas orais não lançadas e para a trava de versão.
 *
 * Até esta correção, a nota oral era obrigatória no mesmo modal da escrita e nascia 0,
 * antes das apresentações (a partir de 23/11/2026). Esses zeros provisórios viram NULL
 * ("aguardando apresentação"), só no PBL escrito de 2026/2, a única atividade com oral.
 * Um zero salvo a partir de 23/11 pode ser ausência real e é preservado. Idempotente: novas avaliações deixam log e não voltam a casar.
 */
export async function prepararNotasPblPendentes(): Promise<void> {
  await runAsync(`ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS versao INTEGER NOT NULL DEFAULT 0`);
  await runAsync(`ALTER TABLE feedbacks ALTER COLUMN nota_oral DROP DEFAULT`);
  await runAsync(
    `UPDATE feedbacks fb SET nota_oral = NULL, versao = fb.versao + 1
     FROM entregas e
     JOIN publicacoes pub ON pub.id = e.publicacao_id
     JOIN atividades_pbl a ON a.id = pub.atividade_id
     JOIN periodos_letivos pl ON pl.id = a.periodo_letivo_id
     WHERE fb.entrega_id = e.id AND fb.nota_oral = 0 AND pl.nome = '2026/2'
       AND EXISTS (
         SELECT 1 FROM versoes_atividades va
         JOIN arquivos_atividades aa ON aa.versao_atividade_id = va.id
         JOIN arquivos ar ON ar.id = aa.arquivo_id
         WHERE va.atividade_id = a.id AND va.numero_versao = a.versao_atual
           AND ar.tipo_documento = 'PBL_1' AND ar.deletado_em IS NULL
       )
       AND NOT EXISTS (
         SELECT 1 FROM logs_auditoria la
         WHERE la.acao = 'AVALIAR_ENTREGA' AND la.recurso = 'feedbacks'
           AND la.recurso_id = e.id::text
           AND la.criado_em >= '2026-11-23T00:00:00-03:00'::timestamptz
       )`
  );

  // Uma avaliação por entrega. Sem o índice, dois avaliadores criando ao mesmo tempo
  // poderiam gravar duas linhas. Duplicatas antigas impedem o índice: o boot segue e
  // avisa, para a coordenação conferir antes de a trava valer por completo.
  const duplicada = await getAsync<{ entrega_id: number }>(
    `SELECT entrega_id FROM feedbacks GROUP BY entrega_id HAVING COUNT(*) > 1 LIMIT 1`
  );
  if (duplicada) {
    console.warn(`feedbacks tem avaliações duplicadas (ex.: entrega ${duplicada.entrega_id}); índice único não criado.`);
    return;
  }
  await runAsync(`CREATE UNIQUE INDEX IF NOT EXISTS feedbacks_entrega_id_unico ON feedbacks (entrega_id)`);
}

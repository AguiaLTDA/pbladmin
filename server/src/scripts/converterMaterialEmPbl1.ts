/**
 * Converte os casos entregues aos grupos de "material de apoio" em PBL 1 com prazo.
 *
 * O atalho "enviar para grupo" nasceu para distribuir material de leitura, então
 * cria a atividade como INFORMATIVA e com prazo cinco anos à frente — um prazo
 * falso, que existe só para o portal não marcar o item como atrasado. Foi assim
 * que os 71 casos PBL subiram: o aluno os via com o selo MATERIAL e a frase
 * "não é necessário enviar resposta", que é o oposto do que um caso PBL pede.
 *
 * Este script corrige as três marcas disso, nas atividades que já estão no ar:
 *   1. `natureza` passa a AVALIATIVA — é o que faz o portal cobrar entrega;
 *   2. o título troca o prefixo "Material:" por "PBL 1:";
 *   3. `prazo_entrega` passa a ser a data real combinada com a coordenação.
 *
 * O alcance é deliberadamente estreito: só atividades INFORMATIVAS, publicadas,
 * segmentadas a GRUPO e cujo arquivo esteja classificado como PBL_1. Material de
 * apoio de verdade, enviado a um grupo, continuaria sendo material — converter
 * tudo que é informativo passaria por cima dele.
 *
 * Uso:
 *   npx tsx src/scripts/converterMaterialEmPbl1.ts
 *   npx tsx src/scripts/converterMaterialEmPbl1.ts --confirmar
 */
import { pool, queryAsync, runAsync } from '../config/db';

const confirmar = process.argv.includes('--confirmar');

/**
 * Fim do dia 04/11/2026, no horário de Brasília (UTC-3).
 *
 * A data combinada é "até 04/11", e prazo com hora zero venceria à meia-noite
 * de 03 para 04 — tirando o dia inteiro que o aluno entende ter.
 */
const PRAZO = new Date('2026-11-04T23:59:59-03:00');

async function alvos() {
  return queryAsync<{ id: number; titulo: string; arquivo: string | null; grupo: string | null }>(
    `SELECT DISTINCT a.id, a.titulo, ar.nome_original AS arquivo, g.nome AS grupo
       FROM atividades_pbl a
       JOIN segmentacoes seg ON seg.atividade_id = a.id
       JOIN segmentacao_regras sr ON sr.segmentacao_id = seg.id
            AND sr.entidade_tipo = 'grupo' AND sr.acao = 'INCLUIR'
       JOIN grupos g ON g.id = sr.entidade_id
       JOIN versoes_atividades va ON va.atividade_id = a.id
       JOIN arquivos_atividades aa ON aa.versao_atividade_id = va.id
       JOIN arquivos ar ON ar.id = aa.arquivo_id AND ar.deletado_em IS NULL
      WHERE a.natureza = 'INFORMATIVA'
        AND a.status = 'PUBLICADO'
        AND a.deletado_em IS NULL
        AND ar.tipo_documento = 'PBL_1'
      ORDER BY a.id`
  );
}

async function main() {
  const lista = await alvos();

  console.log(`\nModo: ${confirmar ? 'ALTERACAO REAL' : 'SIMULACAO (nada sera gravado)'}`);
  console.log(`Atividades a converter: ${lista.length}`);
  console.log(`Novo prazo de entrega: ${PRAZO.toISOString()} (04/11/2026, 23:59 de Brasilia)\n`);

  if (lista.length === 0) {
    console.log('Nada a fazer — nenhum material de grupo classificado como PBL_1 em aberto.');
    return;
  }

  lista.slice(0, 5).forEach((a) =>
    console.log(`  exemplo: [${a.id}] ${a.titulo}`)
  );
  if (lista.length > 5) console.log(`  ... e mais ${lista.length - 5}`);

  if (!confirmar) {
    console.log('\nSimulacao: nada foi gravado. Repita com --confirmar para aplicar.');
    return;
  }

  let convertidas = 0;
  let publicacoes = 0;

  for (const a of lista) {
    // `replace` com âncora no início evita mexer num "Material" que apareça no
    // meio do nome do arquivo.
    const novoTitulo = a.titulo.replace(/^Material:\s*/, 'PBL 1: ');

    await runAsync(
      `UPDATE atividades_pbl
          SET natureza = 'AVALIATIVA', titulo = ?, atualizado_em = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [novoTitulo, a.id]
    );
    convertidas++;

    const res = await runAsync(
      `UPDATE publicacoes SET prazo_entrega = ? WHERE atividade_id = ? AND status_publicacao = 'PUBLICADO'`,
      [PRAZO.toISOString(), a.id]
    );
    publicacoes += res.changes;
  }

  console.log(`\nConvertidas: ${convertidas} atividade(s) | prazo ajustado em ${publicacoes} publicacao(oes).`);

  const conferencia = await queryAsync<any>(
    `SELECT a.natureza, COUNT(*)::int AS qtd, MIN(p.prazo_entrega)::text AS prazo
       FROM atividades_pbl a
       JOIN segmentacoes seg ON seg.atividade_id = a.id
       JOIN segmentacao_regras sr ON sr.segmentacao_id = seg.id AND sr.entidade_tipo = 'grupo'
       LEFT JOIN publicacoes p ON p.atividade_id = a.id
      WHERE a.deletado_em IS NULL AND a.status = 'PUBLICADO'
      GROUP BY a.natureza`
  );
  console.log('\nEstado apos a conversao:');
  conferencia.forEach((c: any) => console.log(`  ${c.natureza}: ${c.qtd} | prazo ${c.prazo}`));
}

main()
  .catch((err) => {
    console.error('\nFalha na conversao:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

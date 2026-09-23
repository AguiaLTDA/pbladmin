/**
 * Reprojeta a audiência de todas as atividades direcionadas a grupos.
 *
 * Existe por causa do intervalo entre a publicação dos casos PBL e a entrada da
 * ressincronização automática: nesse período, remanejar um aluno mudava o grupo
 * dele sem mudar quem alcança o quê. Serve também como rede depois disso — se
 * um caminho novo mexer em `matriculas.grupo_id` sem chamar a ressincronização,
 * é este script que mostra o desvio.
 *
 * Roda em simulação por padrão: mostra o que está fora de sincronia sem gravar.
 *
 * Uso:
 *   npx tsx src/scripts/ressincronizarAudienciaGrupos.ts
 *   npx tsx src/scripts/ressincronizarAudienciaGrupos.ts --confirmar
 */
import { pool, queryAsync } from '../config/db';
import { ressincronizarAudiencia } from '../services/segmentation';

const confirmar = process.argv.includes('--confirmar');

interface Divergencia {
  aluno: string;
  grupo: string;
  arquivo: string | null;
  tipo: 'SEM_ACESSO' | 'ACESSO_INDEVIDO';
}

/**
 * Compara a audiência gravada com a composição atual dos grupos.
 *
 * Os dois sentidos importam e por motivos diferentes: quem está no grupo e não
 * alcança o caso apenas não recebe o que deveria; quem alcança o caso de um
 * grupo que já deixou está vendo material de outro grupo — que é o que o portal
 * promete impedir.
 */
async function levantarDivergencias(): Promise<Divergencia[]> {
  const semAcesso = await queryAsync<any>(
    `SELECT u.nome AS aluno, g.nome AS grupo, ar.nome_original AS arquivo
       FROM matriculas m
       -- Mesmo criterio de aluno que a audiencia usa. Sem ele, a matricula de um
       -- estudante ja excluido do portal aparece como divergencia eterna: ele
       -- continua apontando para o grupo, mas nenhuma audiencia vai inclui-lo.
       JOIN usuarios u ON u.id = m.usuario_id AND u.deletado_em IS NULL AND u.ativo = 1
       JOIN grupos g ON g.id = m.grupo_id AND g.deletado_em IS NULL
       JOIN segmentacao_regras sr
            ON sr.entidade_tipo = 'grupo' AND sr.entidade_id = g.id AND sr.acao = 'INCLUIR'
       JOIN segmentacoes seg ON seg.id = sr.segmentacao_id
       JOIN atividades_pbl a ON a.id = seg.atividade_id AND a.deletado_em IS NULL
       LEFT JOIN versoes_atividades va ON va.atividade_id = a.id
       LEFT JOIN arquivos_atividades aa ON aa.versao_atividade_id = va.id
       LEFT JOIN arquivos ar ON ar.id = aa.arquivo_id AND ar.deletado_em IS NULL
      WHERE m.deletado_em IS NULL AND m.ativo = 1
        AND NOT EXISTS (SELECT 1 FROM alunos_segmentados als
                         WHERE als.atividade_id = a.id AND als.aluno_id = m.usuario_id)`
  );

  const indevido = await queryAsync<any>(
    `SELECT u.nome AS aluno, g.nome AS grupo, ar.nome_original AS arquivo
       FROM alunos_segmentados als
       JOIN usuarios u ON u.id = als.aluno_id AND u.deletado_em IS NULL AND u.ativo = 1
       JOIN atividades_pbl a ON a.id = als.atividade_id AND a.deletado_em IS NULL
       JOIN segmentacoes seg ON seg.atividade_id = a.id
       JOIN segmentacao_regras sr ON sr.segmentacao_id = seg.id
            AND sr.entidade_tipo = 'grupo' AND sr.acao = 'INCLUIR'
       JOIN grupos g ON g.id = sr.entidade_id
       LEFT JOIN versoes_atividades va ON va.atividade_id = a.id
       LEFT JOIN arquivos_atividades aa ON aa.versao_atividade_id = va.id
       LEFT JOIN arquivos ar ON ar.id = aa.arquivo_id AND ar.deletado_em IS NULL
      WHERE NOT EXISTS (SELECT 1 FROM matriculas m
                         WHERE m.usuario_id = als.aluno_id AND m.grupo_id = g.id
                           AND m.deletado_em IS NULL AND m.ativo = 1)`
  );

  return [
    ...semAcesso.map((r: any) => ({ ...r, tipo: 'SEM_ACESSO' as const })),
    ...indevido.map((r: any) => ({ ...r, tipo: 'ACESSO_INDEVIDO' as const }))
  ];
}

function imprimir(titulo: string, divs: Divergencia[]) {
  const semAcesso = divs.filter((d) => d.tipo === 'SEM_ACESSO');
  const indevido = divs.filter((d) => d.tipo === 'ACESSO_INDEVIDO');
  console.log(`\n${titulo}`);
  console.log(`  Está no grupo e NÃO vê o caso dele: ${semAcesso.length}`);
  semAcesso.forEach((d) => console.log(`     ${d.aluno} | ${d.grupo}`));
  console.log(`  Vê o caso de grupo do qual NÃO faz parte: ${indevido.length}`);
  indevido.forEach((d) => console.log(`     ${d.aluno} | ${d.grupo}`));
}

async function main() {
  const antes = await levantarDivergencias();
  imprimir('ANTES', antes);

  if (!confirmar) {
    console.log('\nSimulação: nada foi gravado. Repita com --confirmar para corrigir.');
    return;
  }

  const atividades = await queryAsync<{ atividade_id: number }>(
    `SELECT DISTINCT seg.atividade_id
       FROM segmentacao_regras sr
       JOIN segmentacoes seg ON seg.id = sr.segmentacao_id
       JOIN atividades_pbl a ON a.id = seg.atividade_id AND a.deletado_em IS NULL
      WHERE sr.entidade_tipo = 'grupo'`
  );

  console.log(`\nReprojetando a audiência de ${atividades.length} atividade(s) por grupo...`);
  for (const { atividade_id } of atividades) {
    await ressincronizarAudiencia(atividade_id);
  }

  const depois = await levantarDivergencias();
  imprimir('DEPOIS', depois);

  const total = depois.length;
  console.log(
    total === 0
      ? '\nSincronizado: cada aluno alcança exatamente o caso do grupo em que está.'
      : `\nAinda restam ${total} divergência(s) — investigue antes de considerar resolvido.`
  );
}

main()
  .catch((err) => {
    console.error('\nFalha na ressincronização:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

import { queryAsync, runAsync } from '../config/db';

export interface RuleInput {
  entidadeTipo: 'curso' | 'disciplina' | 'turma' | 'grupo' | 'aluno';
  entidadeId: number;
  acao: 'INCLUIR' | 'EXCLUIR';
}

export interface SegmentationPreviewResult {
  totalAlunosUnicos: number;
  totalCursos: number;
  totalTurmas: number;
  totalGrupos: number;
  alunosIncluidos: Array<{ id: number; nome: string; email: string; turmaNome?: string }>;
  alunosExcluidos: Array<{ id: number; nome: string; email: string; motivo?: string }>;
}

export async function calculateAudiencePreview(regras: RuleInput[]): Promise<SegmentationPreviewResult> {
  let inclusosIds = new Set<number>();
  let excluidosIds = new Set<number>();

  let cursosSet = new Set<number>();
  let turmasSet = new Set<number>();
  let gruposSet = new Set<number>();

  for (const r of regras) {
    if (r.entidadeTipo === 'curso') cursosSet.add(r.entidadeId);
    if (r.entidadeTipo === 'turma') turmasSet.add(r.entidadeId);
    if (r.entidadeTipo === 'grupo') gruposSet.add(r.entidadeId);

    if (r.acao === 'INCLUIR') {
      let candidateIds: number[] = [];

      if (r.entidadeTipo === 'curso') {
        const rows = await queryAsync<{ usuario_id: number }>(
          `SELECT DISTINCT m.usuario_id 
           FROM matriculas m
           JOIN turmas t ON m.turma_id = t.id
           JOIN disciplinas d ON t.disciplina_id = d.id
           WHERE d.curso_id = ? AND m.deletado_em IS NULL`,
          [r.entidadeId]
        );
        candidateIds = rows.map((x) => x.usuario_id);
      } else if (r.entidadeTipo === 'disciplina') {
        const rows = await queryAsync<{ usuario_id: number }>(
          `SELECT DISTINCT m.usuario_id 
           FROM matriculas m
           JOIN turmas t ON m.turma_id = t.id
           WHERE t.disciplina_id = ? AND m.deletado_em IS NULL`,
          [r.entidadeId]
        );
        candidateIds = rows.map((x) => x.usuario_id);
      } else if (r.entidadeTipo === 'turma') {
        const rows = await queryAsync<{ usuario_id: number }>(
          `SELECT DISTINCT m.usuario_id FROM matriculas m WHERE m.turma_id = ? AND m.deletado_em IS NULL`,
          [r.entidadeId]
        );
        candidateIds = rows.map((x) => x.usuario_id);
      } else if (r.entidadeTipo === 'grupo') {
        const rows = await queryAsync<{ usuario_id: number }>(
          `SELECT DISTINCT m.usuario_id FROM matriculas m WHERE m.grupo_id = ? AND m.deletado_em IS NULL`,
          [r.entidadeId]
        );
        candidateIds = rows.map((x) => x.usuario_id);
      } else if (r.entidadeTipo === 'aluno') {
        candidateIds = [r.entidadeId];
      }

      candidateIds.forEach((id) => inclusosIds.add(id));
    } else if (r.acao === 'EXCLUIR') {
      if (r.entidadeTipo === 'aluno') {
        excluidosIds.add(r.entidadeId);
      }
    }
  }

  // Remove explicit exclusions
  excluidosIds.forEach((id) => {
    inclusosIds.delete(id);
  });

  // Fetch student details for included list
  const inclusosList: Array<{ id: number; nome: string; email: string; turmaNome?: string }> = [];
  if (inclusosIds.size > 0) {
    const idsArray = Array.from(inclusosIds);
    const placeholders = idsArray.map(() => '?').join(',');
    const rows = await queryAsync<{ id: number; nome: string; email: string; turma_nome: string }>(
      `SELECT u.id, u.nome, u.email, t.nome as turma_nome
       FROM usuarios u
       LEFT JOIN matriculas m ON u.id = m.usuario_id AND m.deletado_em IS NULL
       LEFT JOIN turmas t ON m.turma_id = t.id
       WHERE u.id IN (${placeholders}) AND u.deletado_em IS NULL`,
      idsArray
    );

    // Deduplicate in response list
    const added = new Set<number>();
    for (const r of rows) {
      if (!added.has(r.id)) {
        added.add(r.id);
        inclusosList.push({ id: r.id, nome: r.nome, email: r.email, turmaNome: r.turma_nome });
      }
    }
  }

  // Fetch student details for excluded list
  const excluidosList: Array<{ id: number; nome: string; email: string; motivo?: string }> = [];
  if (excluidosIds.size > 0) {
    const idsArray = Array.from(excluidosIds);
    const placeholders = idsArray.map(() => '?').join(',');
    const rows = await queryAsync<{ id: number; nome: string; email: string }>(
      `SELECT id, nome, email FROM usuarios WHERE id IN (${placeholders})`,
      idsArray
    );
    rows.forEach((r) => {
      excluidosList.push({ id: r.id, nome: r.nome, email: r.email, motivo: 'Exclusão manual configurada pelo Administrador' });
    });
  }

  return {
    totalAlunosUnicos: inclusosList.length,
    totalCursos: cursosSet.size,
    totalTurmas: turmasSet.size,
    totalGrupos: gruposSet.size,
    alunosIncluidos: inclusosList,
    alunosExcluidos: excluidosList
  };
}

export async function saveSegmentationAndTargetStudents(
  atividadeId: number,
  tipoSegmentacao: string,
  regras: RuleInput[]
) {
  // Clear old segmentation and target students
  const oldSeg = await queryAsync<{ id: number }>(`SELECT id FROM segmentacoes WHERE atividade_id = ?`, [atividadeId]);
  for (const s of oldSeg) {
    await runAsync(`DELETE FROM segmentacao_regras WHERE segmentacao_id = ?`, [s.id]);
  }
  await runAsync(`DELETE FROM segmentacoes WHERE atividade_id = ?`, [atividadeId]);
  await runAsync(`DELETE FROM alunos_segmentados WHERE atividade_id = ?`, [atividadeId]);

  // Insert segmentation parent
  const segRes = await runAsync(`INSERT INTO segmentacoes (atividade_id, tipo_segmentacao) VALUES (?, ?)`, [
    atividadeId,
    tipoSegmentacao
  ]);

  for (const r of regras) {
    await runAsync(
      `INSERT INTO segmentacao_regras (segmentacao_id, entidade_tipo, entidade_id, acao) VALUES (?, ?, ?, ?)`,
      [segRes.lastID, r.entidadeTipo, r.entidadeId, r.acao]
    );
  }

  // Resolve target audience and save to resolved table
  const audience = await calculateAudiencePreview(regras);
  for (const al of audience.alunosIncluidos) {
    await runAsync(
      `INSERT INTO alunos_segmentados (atividade_id, aluno_id) VALUES (?, ?) ON CONFLICT DO NOTHING`,
      [
      atividadeId,
      al.id
    ]);
  }

  return audience;
}

/**
 * Recalcula QUEM alcança uma atividade, a partir das regras que ela já tem.
 *
 * `alunos_segmentados` é uma fotografia: nasce quando a atividade é publicada e
 * não se move sozinha depois. Enquanto a audiência era "a turma", isso bastava.
 * Com o caso PBL individual por grupo, deixou de bastar — mover um aluno de
 * grupo passa a mudar a que material ele tem direito, e a fotografia antiga
 * produz os dois erros ao mesmo tempo: o aluno não vê o caso do grupo em que
 * entrou e continua vendo o caso do grupo de onde saiu.
 *
 * Difere de `saveSegmentationAndTargetStudents` de propósito: aquela refaz as
 * REGRAS (usada quando a coordenação redefine o público-alvo), esta preserva as
 * regras e só reprojeta a audiência. Aqui as regras estão certas — o que mudou
 * foi a composição dos grupos que elas apontam.
 */
export async function ressincronizarAudiencia(atividadeId: number): Promise<number> {
  const regras = await queryAsync<{ entidade_tipo: string; entidade_id: number; acao: string }>(
    `SELECT sr.entidade_tipo, sr.entidade_id, sr.acao
       FROM segmentacoes seg
       JOIN segmentacao_regras sr ON sr.segmentacao_id = seg.id
      WHERE seg.atividade_id = ?`,
    [atividadeId]
  );

  // Sem regras não há o que projetar. Apagar a audiência aqui tiraria o acesso de
  // quem já o tinha por causa de uma segmentação que talvez nem exista mais.
  if (regras.length === 0) return 0;

  const audiencia = await calculateAudiencePreview(
    regras.map((r) => ({
      entidadeTipo: r.entidade_tipo as RuleInput['entidadeTipo'],
      entidadeId: r.entidade_id,
      acao: r.acao as RuleInput['acao']
    }))
  );

  await runAsync(`DELETE FROM alunos_segmentados WHERE atividade_id = ?`, [atividadeId]);
  for (const al of audiencia.alunosIncluidos) {
    await runAsync(
      `INSERT INTO alunos_segmentados (atividade_id, aluno_id) VALUES (?, ?) ON CONFLICT DO NOTHING`,
      [atividadeId, al.id]
    );
  }

  return audiencia.alunosIncluidos.length;
}

/**
 * Ressincroniza tudo o que foi direcionado aos grupos informados.
 *
 * Chamada depois de qualquer mexida na composição de um grupo. Recebe a lista
 * de grupos afetados — numa troca são dois, o de origem e o de destino — porque
 * corrigir só o destino deixaria o aluno ainda enxergando o caso do grupo
 * anterior, que é o vazamento.
 *
 * Nunca derruba a operação que a chamou: remanejar um aluno é a ação que o
 * usuário pediu, e falhar o remanejamento inteiro porque a audiência não pôde
 * ser reprojetada seria pior que a audiência ficar desatualizada — que é o
 * estado em que o portal já vivia. O erro vai para o log.
 */
export async function ressincronizarAudienciaDosGrupos(grupoIds: Array<number | null | undefined>): Promise<void> {
  const ids = Array.from(new Set(grupoIds.filter((g): g is number => Number.isInteger(g as number))));
  if (ids.length === 0) return;

  try {
    const placeholders = ids.map(() => '?').join(',');
    const atividades = await queryAsync<{ atividade_id: number }>(
      `SELECT DISTINCT seg.atividade_id
         FROM segmentacao_regras sr
         JOIN segmentacoes seg ON seg.id = sr.segmentacao_id
         JOIN atividades_pbl a ON a.id = seg.atividade_id AND a.deletado_em IS NULL
        WHERE sr.entidade_tipo = 'grupo' AND sr.entidade_id IN (${placeholders})`,
      ids
    );

    for (const { atividade_id } of atividades) {
      await ressincronizarAudiencia(atividade_id);
    }
  } catch (err) {
    console.error('Falha ao ressincronizar a audiência dos grupos', ids, err);
  }
}

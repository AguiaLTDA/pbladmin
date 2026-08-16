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
    await runAsync(`INSERT OR IGNORE INTO alunos_segmentados (atividade_id, aluno_id) VALUES (?, ?)`, [
      atividadeId,
      al.id
    ]);
  }

  return audience;
}

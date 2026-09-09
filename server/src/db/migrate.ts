import { runAsync } from '../config/db';

// schema.sql já cria as tabelas no formato final; o único ajuste que não dá para expressar
// em CREATE TABLE IF NOT EXISTS é este índice único (parte da chave depende de COALESCE).
export async function runMigrations() {
  await runAsync(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_vinculo_prof_unico
       ON vinculos_professores (usuario_id, turma_id, COALESCE(disciplina_id, 0))`
  );

  // Bancos criados antes do campo `rotulo` não o têm em arquivos_orientadores.
  await runAsync(
    `ALTER TABLE arquivos_orientadores ADD COLUMN IF NOT EXISTS rotulo TEXT DEFAULT 'Arquivos Orientadores 01'`
  );

  // Idem para os campos de controle da réplica em atividades PBL.
  await runAsync(`ALTER TABLE arquivos_orientadores ADD COLUMN IF NOT EXISTS replicado_em TIMESTAMPTZ DEFAULT NULL`);
  await runAsync(`ALTER TABLE arquivos_orientadores ADD COLUMN IF NOT EXISTS replicado_por INTEGER DEFAULT NULL`);

  // Auto-matrícula do aluno (portal do aluno): uma matrícula ativa por turma,
  // e um nome de grupo único por turma — é o que permite o "sincronismo" de
  // membros (dois alunos que digitam o mesmo nome de grupo na mesma turma
  // caem na mesma linha de `grupos`, em vez de criar grupos duplicados).
  // Em `try/catch` porque bancos com dados anteriores a esta migração podem já
  // ter duplicatas (matrículas repetidas ou grupos homônimos na mesma turma);
  // nesse caso a constraint não é criada agora, mas o startup não é derrubado
  // para as demais sessões que compartilham este banco.
  try {
    await runAsync(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_matricula_aluno_turma_unica
         ON matriculas (usuario_id, turma_id) WHERE deletado_em IS NULL`
    );
  } catch (err) {
    console.warn('Não foi possível criar idx_matricula_aluno_turma_unica (prováveis duplicatas existentes):', err);
  }
  try {
    await runAsync(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_grupo_nome_turma_unico
         ON grupos (turma_id, LOWER(nome)) WHERE deletado_em IS NULL AND ativo = 1`
    );
  } catch (err) {
    console.warn('Não foi possível criar idx_grupo_nome_turma_unico (prováveis duplicatas existentes):', err);
  }

  // Bancos criados antes do autocadastro com senha própria não têm esta coluna em pre_cadastros.
  await runAsync(`ALTER TABLE pre_cadastros ADD COLUMN IF NOT EXISTS senha_hash TEXT DEFAULT NULL`);

  // Exclusão de entregas pela coordenadoria é lógica (recuperável), como no resto do schema.
  await runAsync(`ALTER TABLE entregas ADD COLUMN IF NOT EXISTS deletado_em TIMESTAMPTZ DEFAULT NULL`);

  // A revisão do arquivo orientador passou a ser segmentada também por turma
  // (antes só por disciplina). Fica nulo nos comentários antigos.
  await runAsync(`ALTER TABLE comentarios_orientador ADD COLUMN IF NOT EXISTS turma_id INTEGER DEFAULT NULL`);

  // A coordenadoria pode excluir um cadastro de estudante; como no resto do
  // schema, a exclusão é lógica e o registro pode ser restaurado.
  await runAsync(`ALTER TABLE pre_cadastros ADD COLUMN IF NOT EXISTS deletado_em TIMESTAMPTZ DEFAULT NULL`);
}

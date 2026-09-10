import { getAsync, runAsync } from '../config/db';

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

  // --- Validacao de e-mail e recuperacao de senha ---------------------------
  //
  // A coluna nasce nula (= nao verificado), mas as contas que ja existiam antes
  // desta trava precisam ser dispensadas: exigir a validacao delas trancaria
  // 101 alunos no meio do semestre. O backfill roda UMA unica vez, no boot em
  // que a coluna e criada — repetir a cada startup marcaria como verificado
  // justamente quem acabou de se cadastrar e ainda nao clicou no link.
  const colunaVerificacao = await getAsync<{ existe: string }>(
    `SELECT 1 as existe FROM information_schema.columns
      WHERE table_name = 'usuarios' AND column_name = 'email_verificado_em'`
  );
  if (!colunaVerificacao) {
    await runAsync(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_verificado_em TIMESTAMPTZ DEFAULT NULL`);
    const dispensadas = await runAsync(
      `UPDATE usuarios SET email_verificado_em = COALESCE(criado_em, CURRENT_TIMESTAMP)
        WHERE email_verificado_em IS NULL`
    );
    console.log(`Validacao de e-mail: ${dispensadas.changes} conta(s) pre-existente(s) marcada(s) como verificada(s).`);
  }

  // Trava de matricula duplicada no autocadastro. O controller ja recusa antes
  // de inserir; este indice e a garantia no banco contra corrida entre dois
  // cadastros simultaneos. Em try/catch porque a base de producao ja tem uma
  // matricula repetida de antes da trava — enquanto ela existir o indice nao e
  // criado, e a checagem do controller segue valendo. Resolvido o duplicado,
  // o proximo boot cria o indice sozinho.
  try {
    await runAsync(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_pre_cadastro_matricula_unica
         ON pre_cadastros (LOWER(matricula))
       WHERE deletado_em IS NULL AND matricula IS NOT NULL AND matricula != ''`
    );
  } catch (err) {
    const dups = await getAsync<{ total: string }>(
      `SELECT COUNT(*) as total FROM (
         SELECT LOWER(matricula) FROM pre_cadastros
          WHERE deletado_em IS NULL AND matricula IS NOT NULL AND matricula != ''
          GROUP BY LOWER(matricula) HAVING COUNT(*) > 1
       ) d`
    ).catch(() => undefined);
    console.warn(
      `Nao foi possivel criar idx_pre_cadastro_matricula_unica: ${dups?.total ?? '?'} matricula(s) duplicada(s) ` +
        'na base. A checagem no controller continua barrando cadastros novos.'
    );
  }

  // O semestre corrente é 2026/2. Bancos montados na primeira carga ficaram com o
  // período nomeado '2026/1' — renomear a linha existente (em vez de criar outra)
  // faz turmas, atividades e horários já vinculados a ela passarem a exibir 2026/2
  // de uma vez. Precisa rodar ANTES de importarHorarioAcademico (que procura o
  // período por PERIODO_LETIVO_HORARIO.nome), senão a importação criaria um
  // período novo e, junto, turmas duplicadas. O NOT EXISTS mantém idempotente e
  // evita dois períodos com o mesmo nome caso 2026/2 já exista.
  await runAsync(
    `UPDATE periodos_letivos
        SET nome = '2026/2', data_inicio = '2026-08-01', data_fim = '2026-12-19'
      WHERE nome = '2026/1'
        AND NOT EXISTS (SELECT 1 FROM periodos_letivos p2 WHERE p2.nome = '2026/2')`
  );
}

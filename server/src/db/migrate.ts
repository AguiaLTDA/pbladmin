import { getAsync, runAsync } from '../config/db';
import { CRONOGRAMA_PBL_PADRAO } from '../config/cronogramaPadrao';
import { AUTOAVALIACAO_JANELAS_PADRAO } from '../config/autoavaliacaoPadrao';

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

  // Bancos criados antes do atalho "enviar arquivo para grupo" não têm esta coluna.
  await runAsync(`ALTER TABLE atividades_pbl ADD COLUMN IF NOT EXISTS natureza TEXT DEFAULT 'AVALIATIVA'`);

  // Papel do documento no ciclo do PBL, escolhido por quem envia. Fica separado
  // de `categoria`, que é derivada do MIME e responde outra pergunta.
  await runAsync(`ALTER TABLE arquivos ADD COLUMN IF NOT EXISTS tipo_documento TEXT DEFAULT NULL`);
  await runAsync(`CREATE INDEX IF NOT EXISTS idx_arquivos_tipo_documento ON arquivos(tipo_documento)`);

  // Professor líder da turma, designado pela coordenação. Coluna (e não tabela)
  // porque é um por turma; nulo enquanto a coordenação não designar ninguém.
  await runAsync(`ALTER TABLE turmas ADD COLUMN IF NOT EXISTS professor_lider_id INTEGER DEFAULT NULL`);

  // Sugestões da docência sobre um material direcionado (ver comentário do bloco
  // 31 em schema.sql). Criada aqui também porque schema.sql só roda no seed.
  await runAsync(
    `CREATE TABLE IF NOT EXISTS sugestoes_material (
       id SERIAL PRIMARY KEY,
       arquivo_id INTEGER NOT NULL REFERENCES arquivos(id),
       turma_id INTEGER NOT NULL REFERENCES turmas(id),
       autor_id INTEGER NOT NULL REFERENCES usuarios(id),
       texto TEXT NOT NULL,
       deletado_em TIMESTAMPTZ DEFAULT NULL,
       criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
     )`
  );
  await runAsync(
    `CREATE INDEX IF NOT EXISTS idx_sugestoes_material_alvo ON sugestoes_material(arquivo_id, turma_id)`
  );

  // Cronograma oficial das atividades PBL (ver bloco 32 em schema.sql). Criado
  // aqui também porque schema.sql só roda no seed, e semeado com o padrão de
  // fábrica — que é exatamente o quadro que antes ficava fixo no cliente — para
  // que nenhum portal fique com o calendário em branco depois do deploy.
  await runAsync(
    `CREATE TABLE IF NOT EXISTS cronograma_pbl (
       id INTEGER PRIMARY KEY,
       periodo TEXT NOT NULL,
       total_avaliativo TEXT NOT NULL,
       atualizado_por INTEGER REFERENCES usuarios(id),
       atualizado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
     )`
  );
  await runAsync(
    `CREATE TABLE IF NOT EXISTS cronograma_pbl_etapas (
       id SERIAL PRIMARY KEY,
       posicao INTEGER NOT NULL,
       ordem INTEGER DEFAULT NULL,
       titulo TEXT NOT NULL,
       prazo_texto TEXT NOT NULL,
       fim TEXT NOT NULL,
       pontos TEXT DEFAULT NULL
     )`
  );
  await runAsync(
    `CREATE INDEX IF NOT EXISTS idx_cronograma_etapas_posicao ON cronograma_pbl_etapas(posicao)`
  );

  // Semeadura só na ausência de dados: uma vez que a coordenação editar o
  // cronograma, subir o servidor de novo não pode desfazer a edição dela.
  await runAsync(
    `INSERT INTO cronograma_pbl (id, periodo, total_avaliativo)
          VALUES (1, ?, ?)
     ON CONFLICT (id) DO NOTHING`,
    [CRONOGRAMA_PBL_PADRAO.periodo, CRONOGRAMA_PBL_PADRAO.totalAvaliativo]
  );

  const etapasExistentes = await getAsync<{ total: string }>(
    `SELECT COUNT(*) as total FROM cronograma_pbl_etapas`
  );
  if (Number(etapasExistentes?.total || 0) === 0) {
    let posicao = 0;
    for (const etapa of CRONOGRAMA_PBL_PADRAO.etapas) {
      posicao += 1;
      await runAsync(
        `INSERT INTO cronograma_pbl_etapas (posicao, ordem, titulo, prazo_texto, fim, pontos)
              VALUES (?, ?, ?, ?, ?, ?)`,
        [posicao, etapa.ordem, etapa.titulo, etapa.prazoTexto, etapa.fim, etapa.pontos || null]
      );
    }
  }

  // Retro-autoavaliação entre pares dos grupos PBL (ver bloco 33 em schema.sql).
  // Criada aqui também porque schema.sql só roda no seed, e semeada com a janela
  // de fábrica — mesma data já divulgada no cronograma oficial — para o portal
  // do aluno já nascer com o prazo certo em produção.
  await runAsync(
    `CREATE TABLE IF NOT EXISTS autoavaliacao_janelas (
       id SERIAL PRIMARY KEY,
       rodada INTEGER NOT NULL,
       titulo TEXT NOT NULL,
       abre_em TIMESTAMPTZ NOT NULL,
       fecha_em TIMESTAMPTZ NOT NULL,
       criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
     )`
  );
  await runAsync(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_autoavaliacao_janelas_rodada ON autoavaliacao_janelas(rodada)`
  );
  await runAsync(
    `CREATE TABLE IF NOT EXISTS autoavaliacoes (
       id SERIAL PRIMARY KEY,
       janela_id INTEGER NOT NULL REFERENCES autoavaliacao_janelas(id),
       grupo_id INTEGER NOT NULL REFERENCES grupos(id),
       avaliador_id INTEGER NOT NULL REFERENCES usuarios(id),
       avaliado_id INTEGER NOT NULL REFERENCES usuarios(id),
       nota SMALLINT NOT NULL CHECK (nota BETWEEN 1 AND 5),
       criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
       atualizado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
     )`
  );
  await runAsync(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_autoavaliacoes_par ON autoavaliacoes(janela_id, avaliador_id, avaliado_id)`
  );
  await runAsync(
    `CREATE INDEX IF NOT EXISTS idx_autoavaliacoes_avaliado ON autoavaliacoes(janela_id, avaliado_id)`
  );

  for (const janela of AUTOAVALIACAO_JANELAS_PADRAO) {
    await runAsync(
      `INSERT INTO autoavaliacao_janelas (rodada, titulo, abre_em, fecha_em)
            VALUES (?, ?, ?, ?)
       ON CONFLICT (rodada) DO NOTHING`,
      [janela.rodada, janela.titulo, janela.abreEm, janela.fechaEm]
    );
  }
}

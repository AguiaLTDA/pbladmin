import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { pool } from '../config/db';

vi.mock('../services/audit', () => ({ logAudit: vi.fn() }));
import { listDeletedSubmissions, listSubmissionsForActivity } from '../controllers/submissionController';
import { listRevisaoDocente } from '../controllers/academicController';
import { exportReportCSV } from '../controllers/reportController';

function resposta() {
  return {
    statusCode: 200, body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; },
    send(body: any) { this.body = body; return this; },
    setHeader() { return this; }
  };
}

// As entregas reais nascem sem grupo_id: a entrega acompanha o grupo atual de quem enviou.
// A listagem do professor precisa mostrar esse grupo, e não "Entrega individual".
describe.skipIf(process.env.PBL_MIGRATION_TEST !== 'true')('grupo e turma das entregas na listagem do professor', () => {
  const schema = `teste_lista_grupo_${process.pid}`;
  let originalPoolOptions: string | undefined;

  beforeAll(async () => {
    originalPoolOptions = pool.options.options;
    await pool.query(`CREATE SCHEMA ${schema}`);
    pool.options.options = `-c search_path=${schema}`;
    await pool.query(`
      SET search_path TO ${schema};
      CREATE TABLE periodos_letivos (id int PRIMARY KEY, nome text);
      CREATE TABLE usuarios (id int PRIMARY KEY, nome text, email text);
      CREATE TABLE contexto_aluno (usuario_id int, completed_at timestamptz);
      CREATE TABLE turmas (id int PRIMARY KEY, nome text, codigo text, curso_id int, periodo_letivo_id int, ativo int, deletado_em timestamptz);
      CREATE TABLE grupos (id int PRIMARY KEY, nome text, turma_id int, ativo int, deletado_em timestamptz);
      CREATE TABLE matriculas (id serial PRIMARY KEY, usuario_id int, turma_id int, grupo_id int, ativo int, deletado_em timestamptz);
      CREATE TABLE atividades_pbl (id int PRIMARY KEY, codigo_unico text, titulo text, natureza text, status text, curso_id int, disciplina_id int, periodo_letivo_id int, versao_atual int, deletado_em timestamptz);
      CREATE TABLE cursos (id int PRIMARY KEY, nome text);
      CREATE TABLE disciplinas (id int PRIMARY KEY, nome text, codigo text, curso_id int);
      CREATE TABLE comentarios_orientador (id int PRIMARY KEY, texto text, criado_em timestamptz, professor_id int, disciplina_id int, turma_id int, arquivo_orientador_id int);
      CREATE TABLE arquivos_orientadores (id int PRIMARY KEY, arquivo_id int, rotulo text);
      CREATE TABLE publicacoes (id int PRIMARY KEY, atividade_id int);
      CREATE TABLE versoes_atividades (id int PRIMARY KEY, atividade_id int, numero_versao int, forma_realizacao text);
      CREATE TABLE segmentacoes (id int PRIMARY KEY, atividade_id int);
      CREATE TABLE segmentacao_regras (segmentacao_id int, entidade_tipo text, entidade_id int, acao text);
      CREATE TABLE arquivos (id int PRIMARY KEY, nome_original text, tamanho_bytes int, mime_type text, categoria text, hash_md5 text, tipo_documento text, criado_em timestamptz DEFAULT now(), deletado_em timestamptz);
      CREATE TABLE arquivos_atividades (versao_atividade_id int, arquivo_id int);
      CREATE TABLE arquivos_entregas (entrega_id int, arquivo_id int);
      CREATE TABLE entregas (id int PRIMARY KEY, publicacao_id int, aluno_id int, grupo_id int, status text, data_envio timestamptz, comprovante_hash text, deletado_em timestamptz);
      CREATE TABLE feedbacks (id serial PRIMARY KEY, entrega_id int, avaliador_id int, criado_em timestamptz DEFAULT now(), nota_escrita float, nota_escrita_original float, nota_oral float, nota_total float, observacoes text, liberado_aluno int, versao int NOT NULL DEFAULT 0);

      INSERT INTO periodos_letivos VALUES (1, '2026/2'), (2, '2026/1');
      INSERT INTO usuarios VALUES (1, 'Ana', 'ana@x'), (2, 'Bia', 'bia@x'), (3, 'Caio', 'caio@x'), (4, 'Duda', 'duda@x'), (5, 'Eva', 'eva@x'), (6, 'Fabi', 'fabi@x'), (50, 'Prof. Jussara', 'jussara@x');
      INSERT INTO cursos VALUES (1, 'Administração'), (2, 'Ciências Contábeis');
      INSERT INTO disciplinas VALUES (1, 'Gestão', 'GES', 1);
      -- Turma 10 é a da atividade; 11 é de outro período; 12 é de outro curso.
      INSERT INTO turmas VALUES
        (10, 'ADM 1º', 'ADM1', 1, 1, 1, NULL),
        (11, 'ADM 1º (2026/1)', 'ADM1-OLD', 1, 2, 1, NULL),
        (12, 'Contábeis 3º', 'CONT3', 2, 1, 1, NULL);
      INSERT INTO grupos VALUES
        (100, 'Grupo Marcopolo', 10, 1, NULL),
        (101, 'Grupo Sicoob', 10, 1, NULL),
        (110, 'Grupo antigo', 11, 1, NULL),
        (120, 'Grupo de outro curso', 12, 1, NULL);
      INSERT INTO matriculas (usuario_id, turma_id, grupo_id, ativo, deletado_em) VALUES
        (1, 11, 110, 1, NULL),  -- Ana: matrícula de outro período, criada antes
        (1, 10, 100, 1, NULL),  -- Ana: grupo atual na turma da atividade
        (2, 12, 120, 1, NULL),  -- Bia: grupo em outro curso
        (2, 10, 101, 1, NULL),  -- Bia: grupo na turma da atividade
        (3, 10, NULL, 1, NULL), -- Caio: sem grupo
        (4, 10, 101, 1, NULL),  -- Duda: está no 101, mas a entrega gravou o 100
        (5, 10, 100, 0, NULL),  -- Eva: matrícula inativa
        (6, 10, 101, 1, NULL),  -- Fabi: matrícula com grupo
        (6, 10, NULL, 1, NULL); -- Fabi: matrícula mais recente, sem grupo
      -- 1: em grupo; 2: individual; 3: segmentada só para o grupo 101.
      INSERT INTO atividades_pbl VALUES
        (1, 'ADMCONT010301', 'PBL 1: Marcopolo', 'AVALIATIVA', 'PUBLICADO', 1, 1, 1, 1, NULL),
        (2, 'IND01', 'Exercício individual', 'AVALIATIVA', 'PUBLICADO', 1, 1, 1, 1, NULL),
        (3, 'SEG01', 'PBL 1: Sicoob', 'AVALIATIVA', 'PUBLICADO', 1, 1, 1, 1, NULL);
      INSERT INTO versoes_atividades VALUES (1, 1, 1, 'GRUPO'), (2, 2, 1, 'INDIVIDUAL'), (3, 3, 1, 'INDIVIDUAL');
      INSERT INTO segmentacoes VALUES (1, 3);
      INSERT INTO segmentacao_regras VALUES (1, 'grupo', 101, 'INCLUIR'), (1, 'grupo', 100, 'EXCLUIR');
      INSERT INTO publicacoes VALUES (1, 1), (2, 2), (3, 3);
      INSERT INTO entregas VALUES
        (1, 1, 1, NULL, 'ENVIADO', '2026-11-10', 'H1', NULL),
        (2, 1, 2, NULL, 'ENVIADO', '2026-11-11', 'H2', NULL),
        (3, 1, 3, NULL, 'ENVIADO', '2026-11-12', 'H3', NULL),
        (4, 1, 4, 100, 'ENVIADO', '2026-11-13', 'H4', NULL),
        (5, 1, 1, NULL, 'ENVIADO', '2026-11-14', 'H5', CURRENT_TIMESTAMP),
        (6, 2, 1, NULL, 'ENVIADO', '2026-11-15', 'H6', NULL),
        (7, 3, 1, NULL, 'ENVIADO', '2026-11-15', 'H7', NULL),
        (8, 3, 2, NULL, 'ENVIADO', '2026-11-15', 'H8', NULL),
        (9, 1, 5, NULL, 'ENVIADO', '2026-11-15', 'H9', NULL),
        (10, 1, 6, NULL, 'ENVIADO', '2026-11-15', 'H10', NULL);
      INSERT INTO feedbacks (entrega_id, avaliador_id, nota_escrita, nota_oral, nota_total, observacoes, liberado_aluno)
        VALUES (1, 50, 0.8, 0, 0.8, 'Bom trabalho', 0);
    `);
  });

  afterAll(async () => {
    pool.options.options = originalPoolOptions;
    await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await pool.end();
  });

  async function listar() {
    const res = resposta();
    await listSubmissionsForActivity({ params: {}, user: { id: 99, perfilNome: 'ADMIN' } } as any, res as any);
    expect(res.statusCode).toBe(200);
    return new Map<number, any>(res.body.map((sub: any) => [sub.id, sub]));
  }

  it('mostra o grupo e a turma atuais de quem enviou quando a entrega não gravou o grupo', async () => {
    const entregas = await listar();
    expect(entregas.get(1)).toMatchObject({ grupo_id: 100, grupo_nome: 'Grupo Marcopolo', turma_id: 10, turma_nome: 'ADM 1º' });
  });

  it('ignora grupos de matrículas em outro curso ou período', async () => {
    const entregas = await listar();
    expect(entregas.get(2)).toMatchObject({ grupo_id: 101, grupo_nome: 'Grupo Sicoob', turma_id: 10 });
  });

  it('mantém como individual o aluno sem grupo, com a turma da atividade', async () => {
    const entregas = await listar();
    expect(entregas.get(3)).toMatchObject({ grupo_id: null, grupo_nome: null, turma_id: 10 });
  });

  it('não atribui grupo quando a atividade é individual', async () => {
    const entregas = await listar();
    expect(entregas.get(6)).toMatchObject({ grupo_id: null, grupo_nome: null, turma_id: 10 });
  });

  it('segue a segmentação: grupo excluído fica individual, grupo incluído aparece', async () => {
    const entregas = await listar();
    expect(entregas.get(7)).toMatchObject({ grupo_id: null, grupo_nome: null, turma_id: 10 });
    expect(entregas.get(8)).toMatchObject({ grupo_id: 101, grupo_nome: 'Grupo Sicoob', turma_id: 10 });
  });

  it('mostra a turma de matrícula inativa, sem atribuir grupo', async () => {
    const entregas = await listar();
    expect(entregas.get(9)).toMatchObject({ grupo_id: null, grupo_nome: null, turma_id: 10, turma_nome: 'ADM 1º' });
  });

  it('prefere a matrícula com grupo à mais recente sem grupo', async () => {
    const entregas = await listar();
    expect(entregas.get(10)).toMatchObject({ grupo_id: 101, grupo_nome: 'Grupo Sicoob' });
  });

  it('respeita o grupo gravado na entrega', async () => {
    const entregas = await listar();
    expect(entregas.get(4)).toMatchObject({ grupo_id: 100, grupo_nome: 'Grupo Marcopolo', turma_id: 10 });
  });

  it('mostra o grupo de quem enviou também na lixeira', async () => {
    const res = resposta();
    await listDeletedSubmissions({ user: { id: 99, perfilNome: 'ADMIN' } } as any, res as any);
    expect(res.body).toEqual([expect.objectContaining({ id: 5, grupo_nome: 'Grupo Marcopolo' })]);
  });

  it('mostra o grupo e a turma de quem enviou na revisão docente do admin', async () => {
    const res = resposta();
    await listRevisaoDocente({ user: { id: 99, perfilNome: 'ADMIN' } } as any, res as any);
    expect(res.body.pblGrupos).toEqual([
      expect.objectContaining({ aluno_nome: 'Ana', grupo_nome: 'Grupo Marcopolo', turma_nome: 'ADM 1º' })
    ]);
  });

  it('inclui grupo e turma no CSV de entregas', async () => {
    const res = resposta();
    await exportReportCSV({ query: { tipo: 'ENTREGAS' }, user: { id: 99, perfilNome: 'ADMIN' } } as any, res as any);
    const linhas = String(res.body).replace('\uFEFF', '').trim().split('\n');
    expect(linhas[0]).toContain(';Grupo;Turma;');
    expect(linhas.find((l) => l.startsWith('"ADMCONT010301"') && l.includes('ana@x'))).toContain('"Grupo Marcopolo";"ADM 1º"');
  });
});

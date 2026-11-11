import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PoolClient } from 'pg';
import { pool } from '../config/db';
import { ensureSlidesPresentationDelivery } from '../services/slidesPresentationDelivery';

describe.skipIf(process.env.PBL_MIGRATION_TEST !== 'true')('entrega de slides em Postgres', () => {
  const schema = `teste_slides_pbl_${process.pid}`;
  let client: PoolClient;

  beforeAll(async () => {
    await pool.query(`CREATE SCHEMA ${schema}`);
    client = await pool.connect();
    await client.query(`SET search_path TO ${schema}`);
    await client.query(`
      CREATE TABLE periodos_letivos (id int PRIMARY KEY, nome text);
      CREATE TABLE cursos (id int PRIMARY KEY);
      CREATE TABLE disciplinas (id int PRIMARY KEY);
      CREATE TABLE usuarios (id int PRIMARY KEY, ativo int, deletado_em timestamptz);
      CREATE TABLE turmas (id int PRIMARY KEY, periodo_letivo_id int, ativo int, deletado_em timestamptz);
      CREATE TABLE grupos (id int PRIMARY KEY, turma_id int, ativo int, deletado_em timestamptz);
      CREATE TABLE atividades_pbl (
        id serial PRIMARY KEY, codigo_unico text UNIQUE NOT NULL, titulo text NOT NULL, curso_id int NOT NULL, disciplina_id int NOT NULL,
        professor_id int NOT NULL, periodo_letivo_id int NOT NULL, status text NOT NULL, natureza text NOT NULL, versao_atual int NOT NULL,
        deletado_em timestamptz
      );
      CREATE TABLE versoes_atividades (id serial PRIMARY KEY, atividade_id int NOT NULL, numero_versao int NOT NULL, instrucoes_gerais text, criado_por int NOT NULL);
      CREATE TABLE arquivos (id int PRIMARY KEY, tipo_documento text, deletado_em timestamptz);
      CREATE TABLE arquivos_atividades (versao_atividade_id int, arquivo_id int);
      CREATE TABLE publicacoes (
        id serial PRIMARY KEY, atividade_id int NOT NULL, data_disponibilizacao timestamptz NOT NULL,
        prazo_entrega timestamptz NOT NULL, publicado_por int NOT NULL, status_publicacao text
      );
      CREATE TABLE alunos_segmentados (id serial PRIMARY KEY, atividade_id int, aluno_id int, UNIQUE (atividade_id, aluno_id));
      CREATE TABLE segmentacoes (id serial PRIMARY KEY, atividade_id int NOT NULL, tipo_segmentacao text NOT NULL DEFAULT 'TURMA');
      CREATE TABLE segmentacao_regras (id serial PRIMARY KEY, segmentacao_id int NOT NULL, entidade_tipo text NOT NULL, entidade_id int NOT NULL, acao text NOT NULL DEFAULT 'INCLUIR');
      CREATE TABLE cronograma_pbl (id int PRIMARY KEY, periodo text NOT NULL);
      CREATE TABLE cronograma_pbl_etapas (id serial PRIMARY KEY, posicao int, ordem int, titulo text, prazo_texto text, fim text, pontos text);
      INSERT INTO periodos_letivos VALUES (1, '2026/2'), (2, '2026/1');
      INSERT INTO cursos VALUES (1);
      INSERT INTO disciplinas VALUES (1);
      INSERT INTO usuarios VALUES (1, 1, NULL), (2, 1, NULL), (3, 1, NULL);
      INSERT INTO turmas VALUES (1, 1, 1, NULL), (2, 1, 1, NULL), (3, 2, 1, NULL);
      INSERT INTO grupos VALUES (1, 1, 1, NULL), (2, 2, 1, NULL), (3, 3, 1, NULL), (4, 1, 0, NULL);
      INSERT INTO atividades_pbl VALUES
        (1, 'PBL-1-A', 'PBL 1 grupo A', 1, 1, 1, 1, 'PUBLICADO', 'AVALIATIVA', 1, NULL),
        (2, 'PBL-1-B', 'PBL 1 grupo B', 1, 1, 1, 1, 'PUBLICADO', 'AVALIATIVA', 1, NULL),
        (3, 'PBL-1-OLD', 'PBL antigo', 1, 1, 1, 2, 'PUBLICADO', 'AVALIATIVA', 1, NULL),
        (4, 'PBL-1-INACTIVE', 'PBL grupo inativo', 1, 1, 1, 1, 'PUBLICADO', 'AVALIATIVA', 1, NULL);
      INSERT INTO versoes_atividades (id, atividade_id, numero_versao, criado_por) VALUES (1, 1, 1, 1), (2, 2, 1, 1), (3, 3, 1, 1), (4, 4, 1, 1);
      INSERT INTO arquivos VALUES (1, 'PBL_1', NULL), (2, 'PBL_1', NULL), (3, 'PBL_1', NULL), (4, 'PBL_1', NULL);
      INSERT INTO arquivos_atividades VALUES (1, 1), (2, 2), (3, 3), (4, 4);
      INSERT INTO publicacoes (id, atividade_id, data_disponibilizacao, prazo_entrega, publicado_por, status_publicacao) VALUES
        (1, 1, CURRENT_TIMESTAMP, '2026-11-15T23:59:59-03:00', 1, 'PUBLICADO'),
        (2, 2, CURRENT_TIMESTAMP, '2026-11-15T23:59:59-03:00', 1, 'PUBLICADO'),
        (3, 3, CURRENT_TIMESTAMP, '2026-11-15T23:59:59-03:00', 1, 'PUBLICADO'),
        (4, 4, CURRENT_TIMESTAMP, '2026-11-15T23:59:59-03:00', 1, 'PUBLICADO');
      INSERT INTO alunos_segmentados (atividade_id, aluno_id) VALUES (1, 1), (1, 2), (2, 3), (3, 1), (4, 1);
      INSERT INTO segmentacoes (id, atividade_id) VALUES (1, 1), (2, 2), (3, 3), (4, 4);
      INSERT INTO segmentacao_regras (segmentacao_id, entidade_tipo, entidade_id, acao) VALUES
        (1, 'grupo', 1, 'INCLUIR'), (2, 'grupo', 2, 'INCLUIR'), (3, 'grupo', 3, 'INCLUIR'), (4, 'grupo', 4, 'INCLUIR');
      INSERT INTO cronograma_pbl VALUES (1, '2026/2');
      INSERT INTO cronograma_pbl_etapas (posicao, ordem, titulo, prazo_texto, fim, pontos) VALUES
        (7, 7, 'Apresentação do PBL oral', '23 a 27/11', '2026-11-27', '1,5 ponto'),
        (8, 8, 'Divulgação das notas', 'até 04/12', '2026-12-04', NULL);
      SELECT setval(pg_get_serial_sequence('atividades_pbl', 'id'), 4);
      SELECT setval(pg_get_serial_sequence('versoes_atividades', 'id'), 4);
      SELECT setval(pg_get_serial_sequence('publicacoes', 'id'), 4);
      SELECT setval(pg_get_serial_sequence('segmentacoes', 'id'), 4);
      SELECT setval(pg_get_serial_sequence('segmentacao_regras', 'id'), 4);
    `);
  });

  afterAll(async () => {
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    client.release();
  });

  it('provisiona uma entrega por atividade fonte, copia o público e preserva o cronograma ao repetir', async () => {
    await ensureSlidesPresentationDelivery(client);
    const criadas = await client.query('SELECT ordem FROM cronograma_pbl_etapas ORDER BY posicao');
    expect(criadas.rows.map((row) => row.ordem)).toEqual([7, 8, 9]);
    // Reproduz a etapa sem número já publicada, com as etapas seguintes em 7 e 8.
    await client.query(`UPDATE cronograma_pbl_etapas SET ordem = CASE
      WHEN titulo = 'Entrega obrigatória dos slides da apresentação (sem nota)' THEN NULL
      WHEN titulo = 'Apresentação do PBL oral' THEN 7 ELSE 8 END`);
    await ensureSlidesPresentationDelivery(client);
    await ensureSlidesPresentationDelivery(client);

    const slides = await client.query(`
      SELECT a.codigo_unico, a.natureza, pub.prazo_entrega, count(als.aluno_id)::int AS alunos
        FROM atividades_pbl a
        JOIN publicacoes pub ON pub.atividade_id = a.id
        JOIN alunos_segmentados als ON als.atividade_id = a.id
       WHERE a.codigo_unico LIKE 'PBL-SLIDES-%'
       GROUP BY a.id, pub.id ORDER BY a.codigo_unico
    `);
    expect(slides.rows).toHaveLength(2);
    expect(slides.rows.map((row) => row.alunos)).toEqual([2, 1]);
    expect(slides.rows.every((row) => row.natureza === 'OBRIGATORIA_SEM_NOTA')).toBe(true);
    expect(slides.rows.every((row) => row.prazo_entrega.toISOString() === '2026-11-20T02:59:59.999Z')).toBe(true);

    const regras = await client.query(`
      SELECT sr.entidade_tipo, sr.entidade_id FROM atividades_pbl a
      JOIN segmentacoes seg ON seg.atividade_id = a.id
      JOIN segmentacao_regras sr ON sr.segmentacao_id = seg.id
      WHERE a.codigo_unico LIKE 'PBL-SLIDES-%' ORDER BY a.codigo_unico, sr.entidade_id
    `);
    expect(regras.rows).toHaveLength(2);
    const etapas = await client.query('SELECT posicao, ordem, titulo, fim, pontos FROM cronograma_pbl_etapas ORDER BY posicao');
    expect(etapas.rows.map((row) => [row.posicao, row.ordem, row.titulo, row.fim, row.pontos])).toEqual([
      [7, 7, 'Entrega obrigatória dos slides da apresentação (sem nota)', '2026-11-19', null],
      [8, 8, 'Apresentação do PBL oral', '2026-11-27', '1,5 ponto'],
      [9, 9, 'Divulgação das notas', '2026-12-04', null]
    ]);
  });
});

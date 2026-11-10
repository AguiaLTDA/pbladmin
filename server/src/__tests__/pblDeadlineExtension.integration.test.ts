import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../config/db';
import { prorrogarPblEscritoNovembro2026 } from '../services/pblDeadlineExtension';

// Execute com PBL_MIGRATION_TEST=true e DB_* apontando para Postgres de teste.
describe.skipIf(process.env.PBL_MIGRATION_TEST !== 'true')('prorrogação PBL em Postgres', () => {
  const schema = `teste_prazo_pbl_${process.pid}`;
  beforeAll(async () => {
    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query(`SET search_path TO ${schema}`);
    await pool.query(`
      CREATE TABLE cronograma_pbl (id int, periodo text);
      CREATE TABLE cronograma_pbl_etapas (ordem int, fim text, prazo_texto text);
      CREATE TABLE periodos_letivos (id int, nome text);
      CREATE TABLE atividades_pbl (id int, natureza text, versao_atual int, deletado_em timestamptz, periodo_letivo_id int);
      CREATE TABLE versoes_atividades (id int, atividade_id int, numero_versao int);
      CREATE TABLE arquivos (id int, tipo_documento text, deletado_em timestamptz);
      CREATE TABLE arquivos_atividades (versao_atividade_id int, arquivo_id int);
      CREATE TABLE publicacoes (id int, atividade_id int, prazo_entrega timestamptz, status_publicacao text);
      CREATE TABLE entregas (id int, publicacao_id int, data_envio timestamptz, deletado_em timestamptz, status text);
      CREATE TABLE logs_auditoria (acao text, recurso text, recurso_id text, criado_em timestamptz);
      CREATE TABLE feedbacks (entrega_id int, nota_escrita double precision, nota_escrita_original double precision, nota_oral double precision, nota_total double precision);
      INSERT INTO cronograma_pbl VALUES (1, '2026/2');
      INSERT INTO cronograma_pbl_etapas VALUES (4, '2026-11-04', 'até 04 de novembro');
      INSERT INTO periodos_letivos VALUES (1, '2026/2'), (2, '2026/1');
      INSERT INTO atividades_pbl VALUES
        (1, 'AVALIATIVA', 1, NULL, 1), (2, 'AVALIATIVA', 1, NULL, 1), (3, 'AVALIATIVA', 1, NULL, 2);
      INSERT INTO versoes_atividades VALUES (1, 1, 1), (2, 2, 1), (3, 3, 1);
      INSERT INTO arquivos VALUES (1, 'PBL_1', NULL), (2, 'INFORMATIVO', NULL), (3, 'PBL_1', NULL);
      INSERT INTO arquivos_atividades VALUES (1, 1), (2, 2), (3, 3);
      INSERT INTO publicacoes VALUES
        (1, 1, '2026-11-04T23:59:59-03:00', 'PUBLICADO'),
        (2, 2, '2026-11-04T23:59:59-03:00', 'PUBLICADO'),
        (3, 1, '2026-11-08T23:59:59-03:00', 'PUBLICADO'),
        (4, 1, '2026-11-10T23:59:59-03:00', 'PUBLICADO'),
        (5, 3, '2026-11-10T23:59:59-03:00', 'PUBLICADO');
      INSERT INTO entregas (id, publicacao_id, data_envio, deletado_em, status) VALUES
        (1, 1, '2026-11-04T23:59:59.999-03:00', NULL, 'ENVIADO'),
        (2, 1, '2026-11-05T00:00:00-03:00', NULL, 'ENVIADO'),
        (3, 1, '2026-11-10T23:59:59.999-03:00', NULL, 'ENVIADO'),
        (4, 1, '2026-11-11T00:00:00-03:00', NULL, 'ENVIADO'),
        (5, 2, '2026-11-06T12:00:00-03:00', NULL, 'ENVIADO'),
        (6, 1, '2026-11-06T12:00:00-03:00', CURRENT_TIMESTAMP, 'ENVIADO'),
        (7, 4, '2026-11-11T00:00:00-03:00', NULL, 'ENVIADO'),
        (8, 4, '2026-11-15T23:59:59.999-03:00', NULL, 'ENVIADO'),
        (9, 4, '2026-11-16T00:00:00-03:00', NULL, 'ENVIADO'),
        (10, 5, '2026-11-06T12:00:00-03:00', NULL, 'ENVIADO'),
        (11, 1, NULL, NULL, 'RASCUNHO');
      INSERT INTO logs_auditoria VALUES
        ('SUBMETER_ENTREGA_FINAL', 'entregas', '1', '2026-11-05T00:00:00.001-03:00'),
        ('SUBMETER_ENTREGA_FINAL', 'entregas', '2', '2026-11-05T00:00:00.001-03:00'),
        ('SUBMETER_ENTREGA_FINAL', 'entregas', '3', '2026-11-04T18:00:00-03:00');
      INSERT INTO feedbacks SELECT id, 1, NULL, 1.5, 2.5 FROM entregas WHERE id <> 3;
      INSERT INTO feedbacks VALUES (3, 0.8, 1, 1.5, 2.3);
    `);
  });
  afterAll(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await pool.end();
  });

  it('prorroga só o prazo original e desconta só os elegíveis, sem acumular em nova execução', async () => {
    await prorrogarPblEscritoNovembro2026();
    await prorrogarPblEscritoNovembro2026();
    // Simula a etapa já migrada anteriormente de 04/11 para 10/11.
    await pool.query("UPDATE cronograma_pbl_etapas SET fim = '2026-11-10'");
    await prorrogarPblEscritoNovembro2026();
    const etapas = await pool.query('SELECT fim FROM cronograma_pbl_etapas');
    expect(etapas.rows[0].fim).toBe('2026-11-15');
    const publicacoes = await pool.query('SELECT prazo_entrega FROM publicacoes ORDER BY id');
    expect(publicacoes.rows.map((p) => p.prazo_entrega.toISOString())).toEqual([
      '2026-11-16T02:59:59.000Z', '2026-11-05T02:59:59.000Z', '2026-11-09T02:59:59.000Z',
      '2026-11-16T02:59:59.000Z', '2026-11-11T02:59:59.000Z'
    ]);
    const feedbacks = await pool.query('SELECT * FROM feedbacks ORDER BY entrega_id');
    for (const fb of feedbacks.rows) {
      const elegivel = [2, 4, 7, 8].includes(fb.entrega_id);
      expect(fb.nota_escrita).toBe(elegivel ? 0.8 : 1);
      expect(fb.nota_oral).toBe(1.5);
      expect(fb.nota_total).toBe(elegivel ? 2.3 : 2.5);
      expect(fb.nota_escrita_original).toBe(elegivel ? 1 : null);
    }
    const primeiraEntrega = await pool.query('SELECT id, primeira_entrega_final_em FROM entregas WHERE id IN (1, 3, 10, 11) ORDER BY id');
    expect(primeiraEntrega.rows.map((e) => e.primeira_entrega_final_em?.toISOString() ?? null)).toEqual([
      '2026-11-05T02:59:59.999Z', '2026-11-04T21:00:00.000Z', '2026-11-06T15:00:00.000Z', null
    ]);
    // Uma edição administrativa posterior não pode ser desfeita no próximo boot.
    await pool.query("UPDATE cronograma_pbl_etapas SET fim = '2026-11-12'");
    await prorrogarPblEscritoNovembro2026();
    expect((await pool.query('SELECT fim FROM cronograma_pbl_etapas')).rows[0].fim).toBe('2026-11-12');
  });
});

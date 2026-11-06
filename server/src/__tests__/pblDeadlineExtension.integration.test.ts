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
      CREATE TABLE atividades_pbl (id int, natureza text, versao_atual int, deletado_em timestamptz);
      CREATE TABLE versoes_atividades (id int, atividade_id int, numero_versao int);
      CREATE TABLE arquivos (id int, tipo_documento text, deletado_em timestamptz);
      CREATE TABLE arquivos_atividades (versao_atividade_id int, arquivo_id int);
      CREATE TABLE publicacoes (id int, atividade_id int, prazo_entrega timestamptz, status_publicacao text);
      CREATE TABLE entregas (id int, publicacao_id int, data_envio timestamptz, deletado_em timestamptz);
      CREATE TABLE feedbacks (entrega_id int, nota_escrita double precision, nota_oral double precision, nota_total double precision);
      INSERT INTO cronograma_pbl VALUES (1, '2026/2');
      INSERT INTO cronograma_pbl_etapas VALUES (4, '2026-11-04', 'até 04 de novembro');
      INSERT INTO atividades_pbl VALUES (1, 'AVALIATIVA', 1, NULL), (2, 'AVALIATIVA', 1, NULL);
      INSERT INTO versoes_atividades VALUES (1, 1, 1), (2, 2, 1);
      INSERT INTO arquivos VALUES (1, 'PBL_1', NULL), (2, 'INFORMATIVO', NULL);
      INSERT INTO arquivos_atividades VALUES (1, 1), (2, 2);
      INSERT INTO publicacoes VALUES
        (1, 1, '2026-11-04T23:59:59-03:00', 'PUBLICADO'),
        (2, 2, '2026-11-04T23:59:59-03:00', 'PUBLICADO'),
        (3, 1, '2026-11-08T23:59:59-03:00', 'PUBLICADO');
      INSERT INTO entregas VALUES
        (1, 1, '2026-11-04T23:59:59.999-03:00', NULL),
        (2, 1, '2026-11-05T00:00:00-03:00', NULL),
        (3, 1, '2026-11-10T23:59:59.999-03:00', NULL),
        (4, 1, '2026-11-11T00:00:00-03:00', NULL),
        (5, 2, '2026-11-06T12:00:00-03:00', NULL),
        (6, 1, '2026-11-06T12:00:00-03:00', CURRENT_TIMESTAMP);
      INSERT INTO feedbacks SELECT id, 1, 1.5, 2.5 FROM entregas;
    `);
  });
  afterAll(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await pool.end();
  });

  it('prorroga só o prazo original e desconta só os elegíveis, sem acumular em nova execução', async () => {
    await prorrogarPblEscritoNovembro2026();
    await prorrogarPblEscritoNovembro2026();
    const etapas = await pool.query('SELECT fim FROM cronograma_pbl_etapas');
    expect(etapas.rows[0].fim).toBe('2026-11-10');
    const publicacoes = await pool.query('SELECT prazo_entrega FROM publicacoes ORDER BY id');
    expect(publicacoes.rows.map((p) => p.prazo_entrega.toISOString())).toEqual([
      '2026-11-11T02:59:59.000Z', '2026-11-05T02:59:59.000Z', '2026-11-09T02:59:59.000Z'
    ]);
    const feedbacks = await pool.query('SELECT * FROM feedbacks ORDER BY entrega_id');
    for (const fb of feedbacks.rows) {
      const elegivel = [2, 3].includes(fb.entrega_id);
      expect(fb.nota_escrita).toBe(elegivel ? 0.8 : 1);
      expect(fb.nota_oral).toBe(1.5);
      expect(fb.nota_total).toBe(elegivel ? 2.3 : 2.5);
      expect(fb.nota_escrita_original).toBe(elegivel ? 1 : null);
    }
    // Uma edição administrativa posterior não pode ser desfeita no próximo boot.
    await pool.query("UPDATE cronograma_pbl_etapas SET fim = '2026-11-12'");
    await prorrogarPblEscritoNovembro2026();
    expect((await pool.query('SELECT fim FROM cronograma_pbl_etapas')).rows[0].fim).toBe('2026-11-12');
  });
});

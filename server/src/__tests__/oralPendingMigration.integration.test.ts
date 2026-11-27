import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../config/db';
import { prepararNotasPblPendentes } from '../services/notaOralPendente';
import { prorrogarPblEscritoNovembro2026 } from '../services/pblDeadlineExtension';

// Antes desta correção, a oral era obrigatória na avaliação da escrita e nascia 0.
// Zeros lançados antes das apresentações (23/11) viram "não lançada" (NULL).
describe.skipIf(process.env.PBL_MIGRATION_TEST !== 'true')('nota oral pendente em Postgres', () => {
  const schema = `teste_oral_pendente_${process.pid}`;
  let originalPoolOptions: string | undefined;

  beforeAll(async () => {
    originalPoolOptions = pool.options.options;
    await pool.query(`CREATE SCHEMA ${schema}`);
    pool.options.options = `-c search_path=${schema}`;
    await pool.query(`
      SET search_path TO ${schema};
      CREATE TABLE cronograma_pbl (id int, periodo text);
      CREATE TABLE cronograma_pbl_etapas (ordem int, fim text, prazo_texto text);
      CREATE TABLE periodos_letivos (id int, nome text);
      CREATE TABLE atividades_pbl (id int, natureza text, versao_atual int, deletado_em timestamptz, periodo_letivo_id int);
      CREATE TABLE versoes_atividades (id int, atividade_id int, numero_versao int);
      CREATE TABLE arquivos (id int, tipo_documento text, deletado_em timestamptz);
      CREATE TABLE arquivos_atividades (versao_atividade_id int, arquivo_id int);
      CREATE TABLE publicacoes (id int, atividade_id int, prazo_entrega timestamptz, status_publicacao text);
      CREATE TABLE entregas (id int, publicacao_id int, data_envio timestamptz, primeira_entrega_final_em timestamptz, deletado_em timestamptz, status text);
      CREATE TABLE logs_auditoria (acao text, recurso text, recurso_id text, criado_em timestamptz);
      CREATE TABLE feedbacks (id serial, entrega_id int, nota_escrita double precision DEFAULT 0, nota_escrita_original double precision,
        nota_oral double precision DEFAULT 0, nota_total double precision DEFAULT 0);
      INSERT INTO periodos_letivos VALUES (1, '2026/2'), (2, '2026/1');
      INSERT INTO atividades_pbl VALUES (1, 'AVALIATIVA', 1, NULL, 1), (2, 'AVALIATIVA', 1, NULL, 2), (3, 'AVALIATIVA', 1, NULL, 1);
      INSERT INTO versoes_atividades VALUES (1, 1, 1), (2, 2, 1), (3, 3, 1);
      INSERT INTO arquivos VALUES (1, 'PBL_1', NULL), (3, 'INFORMATIVO', NULL);
      INSERT INTO arquivos_atividades VALUES (1, 1), (2, 1), (3, 3);
      INSERT INTO publicacoes VALUES (1, 1, NULL, 'PUBLICADO'), (2, 2, NULL, 'PUBLICADO'), (3, 3, NULL, 'PUBLICADO');
      INSERT INTO entregas VALUES
        (1, 1, '2026-11-03', '2026-11-03', NULL, 'ENVIADO'),
        (2, 1, '2026-11-03', '2026-11-03', NULL, 'ENVIADO'),
        (3, 1, '2026-11-03', '2026-11-03', NULL, 'ENVIADO'),
        (4, 2, '2026-06-03', '2026-06-03', NULL, 'ENVIADO'),
        (5, 3, '2026-11-03', '2026-11-03', NULL, 'ENVIADO');
      INSERT INTO feedbacks (entrega_id, nota_escrita, nota_oral, nota_total) VALUES
        (1, 0.8, 0, 0.8),   -- zero provisório lançado com a escrita
        (2, 0.7, 0, 0.7),   -- zero confirmado depois das apresentações (ausência)
        (3, 0.9, 1.2, 2.1), -- oral lançada
        (4, 1.5, 0, 1.5),   -- outro período
        (5, 8, 0, 8);       -- atividade de 2026/2 sem PBL escrito
      INSERT INTO logs_auditoria VALUES
        ('AVALIAR_ENTREGA', 'feedbacks', '1', '2026-11-10T10:00:00-03:00'),
        ('AVALIAR_ENTREGA', 'feedbacks', '2', '2026-11-10T10:00:00-03:00'),
        ('AVALIAR_ENTREGA', 'feedbacks', '2', '2026-11-24T20:00:00-03:00');
    `);
  });

  afterAll(async () => {
    pool.options.options = originalPoolOptions;
    await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await pool.end();
  });

  async function feedbacks() {
    const { rows } = await pool.query(`SELECT entrega_id, nota_oral, nota_total, versao FROM feedbacks ORDER BY entrega_id`);
    return rows;
  }

  it('marca como não lançados só os zeros provisórios de 2026/2 e é idempotente', async () => {
    await prepararNotasPblPendentes();
    await prepararNotasPblPendentes();
    expect(await feedbacks()).toEqual([
      { entrega_id: 1, nota_oral: null, nota_total: 0.8, versao: 1 },
      { entrega_id: 2, nota_oral: 0, nota_total: 0.7, versao: 0 },
      { entrega_id: 3, nota_oral: 1.2, nota_total: 2.1, versao: 0 },
      { entrega_id: 4, nota_oral: 0, nota_total: 1.5, versao: 0 },
      { entrega_id: 5, nota_oral: 0, nota_total: 8, versao: 0 }
    ]);
  });

  it('cria o índice único de avaliação por entrega quando não há duplicatas', async () => {
    const { rows } = await pool.query(`SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'feedbacks_entrega_id_unico'`);
    expect(rows).toHaveLength(1);
  });

  it('cria novas avaliações sem oral lançada', async () => {
    const { rows } = await pool.query(`INSERT INTO feedbacks (entrega_id, nota_escrita, nota_total) VALUES (9, 0.5, 0.5) RETURNING nota_oral, versao`);
    expect(rows[0]).toEqual({ nota_oral: null, versao: 0 });
  });

  it('mantém o total da prorrogação quando a oral não foi lançada', async () => {
    await pool.query(`
      INSERT INTO cronograma_pbl VALUES (1, '2026/2');
      INSERT INTO entregas VALUES (10, 1, '2026-11-10', '2026-11-10', NULL, 'ENVIADO');
      INSERT INTO feedbacks (entrega_id, nota_escrita, nota_oral, nota_total) VALUES (10, 1.0, NULL, 1.0);
    `);
    await prorrogarPblEscritoNovembro2026();
    const { rows } = await pool.query(`SELECT nota_escrita, nota_oral, nota_total FROM feedbacks WHERE entrega_id = 10`);
    expect(rows[0]).toEqual({ nota_escrita: 0.8, nota_oral: null, nota_total: 0.8 });
  });
});

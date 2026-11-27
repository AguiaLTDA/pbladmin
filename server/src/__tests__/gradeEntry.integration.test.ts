import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { pool } from '../config/db';

vi.mock('../services/audit', () => ({ logAudit: vi.fn() }));
import { evaluateSubmission } from '../controllers/submissionController';
import { prepararNotasPblPendentes } from '../services/notaOralPendente';

function resposta() {
  return { statusCode: 200, body: undefined as any, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
}

// Exercita no Postgres real o INSERT condicional e a trava de versão da avaliação.
describe.skipIf(process.env.PBL_MIGRATION_TEST !== 'true')('lançamento de notas em Postgres', () => {
  const schema = `teste_lancamento_notas_${process.pid}`;
  let originalPoolOptions: string | undefined;

  beforeAll(async () => {
    originalPoolOptions = pool.options.options;
    await pool.query(`CREATE SCHEMA ${schema}`);
    pool.options.options = `-c search_path=${schema}`;
    await pool.query(`
      SET search_path TO ${schema};
      CREATE TABLE periodos_letivos (id int PRIMARY KEY, nome text);
      CREATE TABLE atividades_pbl (id int PRIMARY KEY, natureza text, versao_atual int, periodo_letivo_id int, deletado_em timestamptz);
      CREATE TABLE versoes_atividades (id int PRIMARY KEY, atividade_id int, numero_versao int);
      CREATE TABLE arquivos (id int PRIMARY KEY, tipo_documento text, deletado_em timestamptz);
      CREATE TABLE arquivos_atividades (versao_atividade_id int, arquivo_id int);
      CREATE TABLE publicacoes (id int PRIMARY KEY, atividade_id int);
      CREATE TABLE entregas (id int PRIMARY KEY, publicacao_id int, aluno_id int, data_envio timestamptz, primeira_entrega_final_em timestamptz, status text, deletado_em timestamptz);
      CREATE TABLE logs_auditoria (acao text, recurso text, recurso_id text, criado_em timestamptz);
      CREATE TABLE notificacoes (id serial PRIMARY KEY, usuario_id int, titulo text, mensagem text, link text);
      CREATE TABLE feedbacks (id serial PRIMARY KEY, entrega_id int NOT NULL, avaliador_id int NOT NULL,
        nota_escrita double precision DEFAULT 0, nota_escrita_original double precision DEFAULT NULL,
        nota_oral double precision DEFAULT 0, nota_total double precision DEFAULT 0,
        observacoes text, liberado_aluno int DEFAULT 0, criado_em timestamptz DEFAULT now());
      INSERT INTO periodos_letivos VALUES (1, '2026/2');
      INSERT INTO atividades_pbl VALUES (1, 'AVALIATIVA', 1, 1, NULL);
      INSERT INTO versoes_atividades VALUES (1, 1, 1);
      INSERT INTO arquivos VALUES (1, 'PBL_1', NULL);
      INSERT INTO arquivos_atividades VALUES (1, 1);
      INSERT INTO publicacoes VALUES (1, 1);
      INSERT INTO entregas VALUES
        (5, 1, 7, '2026-11-03T12:00:00-03:00', '2026-11-03T12:00:00-03:00', 'ENVIADO', NULL),
        (6, 1, 8, '2026-11-03T12:00:00-03:00', '2026-11-03T12:00:00-03:00', 'ENVIADO', NULL);
    `);
    await prepararNotasPblPendentes();
  });

  afterAll(async () => {
    pool.options.options = originalPoolOptions;
    await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await pool.end();
  });

  async function avaliar(entregaId: string, body: Record<string, unknown>, avaliador = 4) {
    const res = resposta();
    await evaluateSubmission({ params: { entregaId }, body, user: { id: avaliador, perfilNome: 'ADMIN' } } as any, res as any);
    return res;
  }

  async function feedbacksDa(entregaId: number) {
    const { rows } = await pool.query(
      `SELECT avaliador_id, nota_escrita, nota_oral, nota_total, versao FROM feedbacks WHERE entrega_id = $1`, [entregaId]
    );
    return rows;
  }

  it('cria a primeira avaliação com a oral não lançada', async () => {
    const res = await avaliar('5', { notaEscrita: 0.8, notaOral: null, liberadoAluno: false, versao: null });
    expect(res.statusCode).toBe(200);
    expect(await feedbacksDa(5)).toEqual([{ avaliador_id: 4, nota_escrita: 0.8, nota_oral: null, nota_total: 0.8, versao: 0 }]);
  });

  it('recusa a segunda criação e a edição com versão desatualizada, sem apagar a nota alheia', async () => {
    expect((await avaliar('5', { notaEscrita: 0.5, notaOral: null, liberadoAluno: false, versao: null }, 9)).statusCode).toBe(409);
    expect((await avaliar('5', { notaEscrita: 0.8, notaOral: 1.2, liberadoAluno: false, versao: 0 }, 4)).statusCode).toBe(200);
    expect((await avaliar('5', { notaEscrita: 0.5, notaOral: 0, liberadoAluno: false, versao: 0 }, 9)).statusCode).toBe(409);
    expect(await feedbacksDa(5)).toEqual([{ avaliador_id: 4, nota_escrita: 0.8, nota_oral: 1.2, nota_total: 2, versao: 1 }]);
  });

  it('não duplica a avaliação quando dois avaliadores criam ao mesmo tempo', async () => {
    const resultados = await Promise.all([
      avaliar('6', { notaEscrita: 0.7, notaOral: null, liberadoAluno: false, versao: null }, 4),
      avaliar('6', { notaEscrita: 0.6, notaOral: null, liberadoAluno: false, versao: null }, 9)
    ]);
    expect(resultados.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(await feedbacksDa(6)).toHaveLength(1);
  });
});

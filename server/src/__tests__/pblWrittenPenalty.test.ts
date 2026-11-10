import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAsync, runAsync, queryAsync, logAudit } = vi.hoisted(() => ({
  getAsync: vi.fn(), runAsync: vi.fn(), queryAsync: vi.fn(), logAudit: vi.fn()
}));
vi.mock('../config/db', () => ({ getAsync, runAsync, queryAsync }));
vi.mock('../services/audit', () => ({ logAudit }));
vi.mock('../services/horarioImport', () => ({ professorAlcancaAtividade: vi.fn() }));

import { calculatePblWrittenPenalty } from '../services/pblWrittenPenalty';
import { evaluateSubmission } from '../controllers/submissionController';

function resposta() {
  return { statusCode: 200, body: undefined as any, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
}

beforeEach(() => {
  vi.clearAllMocks();
  runAsync.mockResolvedValue({});
  logAudit.mockResolvedValue(undefined);
});

describe('desconto da nota escrita do PBL 1', () => {
  it('aplica 20% somente após 04/11 até o limite de 15/11, inclusive', () => {
    expect(calculatePblWrittenPenalty(10, true, '2026-11-05T00:00:00-03:00')).toEqual({ original: 10, written: 8, penaltyPercent: 20 });
    expect(calculatePblWrittenPenalty(10, true, '2026-11-04T23:59:59.999-03:00').written).toBe(10);
    expect(calculatePblWrittenPenalty(10, true, '2026-11-11T00:00:00-03:00').written).toBe(8);
    expect(calculatePblWrittenPenalty(10, true, '2026-11-15T23:59:59.999-03:00').written).toBe(8);
    expect(calculatePblWrittenPenalty(10, true, '2026-11-16T00:00:00-03:00').written).toBe(10);
  });

  it('não altera nota fora do PBL 1 e não aplica penalidade à nota oral', () => {
    expect(calculatePblWrittenPenalty(10, false, '2026-11-06T12:00:00-03:00').written).toBe(10);
    const evaluation = calculatePblWrittenPenalty(10, true, '2026-11-06T12:00:00-03:00');
    expect(evaluation.penaltyPercent).toBe(20);
    expect(evaluation.written + 5).toBe(13);
  });

  it('usa a primeira entrega final para isentar reenvios feitos até 15/11', () => {
    expect(calculatePblWrittenPenalty(
      10,
      true,
      '2026-11-15T12:00:00-03:00',
      '2026-11-04T23:59:59-03:00'
    )).toEqual({ original: 10, written: 10, penaltyPercent: 0 });
    expect(calculatePblWrittenPenalty(
      10,
      true,
      '2026-11-15T12:00:00-03:00',
      '2026-11-05T00:00:00-03:00'
    )).toEqual({ original: 10, written: 8, penaltyPercent: 20 });
  });

  it('grava nota escrita bruta e líquida, preservando nota oral e sem acumular desconto ao editar', async () => {
    getAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM entregas e')) return { id: 5, aluno_id: 7, atividade_id: 9, data_envio: '2026-11-15T12:00:00-03:00', primeira_entrega_final_em: '2026-11-04T23:59:59-03:00', pbl_1: true, periodo_nome: '2026/2' };
      return { id: 12 };
    });
    const res = resposta();
    await evaluateSubmission({ params: { entregaId: '5' }, body: { notaEscrita: 1, notaOral: 1.5, liberadoAluno: false }, user: { id: 4, perfilNome: 'ADMIN' } } as any, res as any);
    const update = runAsync.mock.calls[0];
    expect(getAsync.mock.calls[0][0]).toContain('primeira_entrega_final_em');
    expect(update[0]).toContain('nota_escrita_original = ?');
    expect(update[1]).toEqual([1, null, 1.5, 2.5, '', 0, 4, 12]);
    expect(res.body.notaTotal).toBe(2.5);

    getAsync.mockImplementation(async (sql: string) => sql.includes('FROM entregas e')
      ? { id: 5, aluno_id: 7, atividade_id: 9, data_envio: '2026-11-15T12:00:00-03:00', primeira_entrega_final_em: '2026-11-04T23:59:59-03:00', pbl_1: true, periodo_nome: '2026/2' }
      : { id: 12 });
    await evaluateSubmission({ params: { entregaId: '5' }, body: { notaEscrita: 1, notaOral: 1.5, liberadoAluno: false }, user: { id: 4, perfilNome: 'ADMIN' } } as any, res as any);
    expect(runAsync.mock.calls[1][1]).toEqual([1, null, 1.5, 2.5, '', 0, 4, 12]);
  });

  it('não desconta atividades fora de PBL 1', async () => {
    getAsync.mockImplementation(async (sql: string) => sql.includes('FROM entregas e')
      ? { id: 5, aluno_id: 7, atividade_id: 9, data_envio: '2026-11-06T12:00:00-03:00', pbl_1: false }
      : undefined);
    const res = resposta();
    await evaluateSubmission({ params: { entregaId: '5' }, body: { notaEscrita: 10, notaOral: 3, liberadoAluno: false }, user: { id: 4, perfilNome: 'ADMIN' } } as any, res as any);
    expect(runAsync.mock.calls[0][1]).toEqual(['5', 4, 10, null, 3, 13, '', 0]);
  });

  it('não aplica a exceção de 2026/2 a uma atividade de outro período', async () => {
    getAsync.mockImplementation(async (sql: string) => sql.includes('FROM entregas e')
      ? { id: 5, aluno_id: 7, atividade_id: 9, data_envio: '2026-11-15T12:00:00-03:00', primeira_entrega_final_em: '2026-11-04T18:00:00-03:00', pbl_1: true, periodo_nome: '2026/1' }
      : undefined);
    const res = resposta();

    await evaluateSubmission({ params: { entregaId: '5' }, body: { notaEscrita: 10, notaOral: 3, liberadoAluno: false }, user: { id: 4, perfilNome: 'ADMIN' } } as any, res as any);

    expect(runAsync.mock.calls[0][1]).toEqual(['5', 4, 10, null, 3, 13, '', 0]);
  });
});

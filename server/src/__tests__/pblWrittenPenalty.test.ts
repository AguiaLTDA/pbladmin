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
  it('aplica 20% somente após 04/11 até o limite de 10/11, inclusive', () => {
    expect(calculatePblWrittenPenalty(10, true, '2026-11-05T00:00:00-03:00')).toEqual({ original: 10, written: 8, penaltyPercent: 20 });
    expect(calculatePblWrittenPenalty(10, true, '2026-11-04T23:59:59.999-03:00').written).toBe(10);
    expect(calculatePblWrittenPenalty(10, true, '2026-11-10T23:59:59.999-03:00').written).toBe(8);
    expect(calculatePblWrittenPenalty(10, true, '2026-11-11T00:00:00-03:00').written).toBe(10);
  });

  it('não altera nota fora do PBL 1 e não aplica penalidade à nota oral', () => {
    expect(calculatePblWrittenPenalty(10, false, '2026-11-06T12:00:00-03:00').written).toBe(10);
    const evaluation = calculatePblWrittenPenalty(10, true, '2026-11-06T12:00:00-03:00');
    expect(evaluation.penaltyPercent).toBe(20);
    expect(evaluation.written + 5).toBe(13);
  });

  it('grava nota escrita bruta e líquida, preservando nota oral e sem acumular desconto ao editar', async () => {
    getAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM entregas e')) return { id: 5, aluno_id: 7, atividade_id: 9, data_envio: '2026-11-06T12:00:00-03:00', pbl_1: true };
      return { id: 12 };
    });
    const res = resposta();
    await evaluateSubmission({ params: { entregaId: '5' }, body: { notaEscrita: 1, notaOral: 1.5, liberadoAluno: false }, user: { id: 4, perfilNome: 'ADMIN' } } as any, res as any);
    const update = runAsync.mock.calls[0];
    expect(update[0]).toContain('nota_escrita_original = ?');
    expect(update[1]).toEqual([0.8, 1, 1.5, 2.3, '', 0, 4, 12]);
    expect(res.body.notaTotal).toBe(2.3);

    getAsync.mockImplementation(async (sql: string) => sql.includes('FROM entregas e')
      ? { id: 5, aluno_id: 7, atividade_id: 9, data_envio: '2026-11-06T12:00:00-03:00', pbl_1: true }
      : { id: 12 });
    await evaluateSubmission({ params: { entregaId: '5' }, body: { notaEscrita: 1, notaOral: 1.5, liberadoAluno: false }, user: { id: 4, perfilNome: 'ADMIN' } } as any, res as any);
    expect(runAsync.mock.calls[1][1]).toEqual([0.8, 1, 1.5, 2.3, '', 0, 4, 12]);
  });

  it('não desconta atividades fora de PBL 1', async () => {
    getAsync.mockImplementation(async (sql: string) => sql.includes('FROM entregas e')
      ? { id: 5, aluno_id: 7, atividade_id: 9, data_envio: '2026-11-06T12:00:00-03:00', pbl_1: false }
      : undefined);
    const res = resposta();
    await evaluateSubmission({ params: { entregaId: '5' }, body: { notaEscrita: 10, notaOral: 3, liberadoAluno: false }, user: { id: 4, perfilNome: 'ADMIN' } } as any, res as any);
    expect(runAsync.mock.calls[0][1]).toEqual(['5', 4, 10, null, 3, 13, '', 0]);
  });
});

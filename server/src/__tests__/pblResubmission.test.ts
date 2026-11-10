import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getAsync, queryAsync, runAsync, logAudit } = vi.hoisted(() => ({
  getAsync: vi.fn(), queryAsync: vi.fn(), runAsync: vi.fn(), logAudit: vi.fn()
}));
vi.mock('../config/db', () => ({ getAsync, queryAsync, runAsync }));
vi.mock('../services/audit', () => ({ logAudit }));
vi.mock('../services/horarioImport', () => ({ professorAlcancaAtividade: vi.fn() }));

import { submitStudentAnswer } from '../controllers/submissionController';

function resposta() {
  return { statusCode: 200, body: undefined as any, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-15T12:00:00-03:00'));
  vi.clearAllMocks();
  queryAsync.mockResolvedValue([]);
  runAsync.mockResolvedValue({ lastID: 12, changes: 1 });
  logAudit.mockResolvedValue(undefined);
});

afterEach(() => vi.useRealTimers());

function setupExistingPblEntrega(firstFinal: string) {
  getAsync
    .mockResolvedValueOnce({ id: 1 })
    .mockResolvedValueOnce({ id: 8, prazo_entrega: '2026-11-15T23:59:59-03:00', pbl_1: true, periodo_nome: '2026/2' })
    .mockResolvedValueOnce({ id: 12, status: 'ENVIADO', primeira_entrega_final_em: firstFinal });
}

describe('reenvio do PBL escrito', () => {
  it('permite até 15/11 quem entregou até 04/11, preserva a primeira data e ignora data enviada pelo cliente', async () => {
    setupExistingPblEntrega('2026-11-04T18:00:00-03:00');
    const res = resposta();

    await submitStudentAnswer({
      params: { atividadeId: '9' },
      body: { conteudoResposta: 'revisada', finalSubmit: true, primeiraEntregaFinalEm: '2026-11-15T12:00:00-03:00' },
      user: { id: 7, perfilNome: 'ALUNO' }
    } as any, res as any);

    expect(res.statusCode).toBe(200);
    const update = runAsync.mock.calls[0];
    expect(update[0]).toContain('primeira_entrega_final_em = COALESCE');
    expect(update[1]).toContain('2026-11-15T15:00:00.000Z');
    expect(update[1]).not.toContain('2026-11-15T12:00:00-03:00');
  });

  it('bloqueia reenvio PBL após 15/11 também no servidor', async () => {
    vi.setSystemTime(new Date('2026-11-16T00:00:00-03:00'));
    setupExistingPblEntrega('2026-11-04T18:00:00-03:00');
    const res = resposta();

    await submitStudentAnswer({
      params: { atividadeId: '9' },
      body: { conteudoResposta: 'revisada', finalSubmit: true },
      user: { id: 7, perfilNome: 'ALUNO' }
    } as any, res as any);

    expect(res.statusCode).toBe(400);
    expect(runAsync).not.toHaveBeenCalled();
  });

  it.each(['ENVIADO', 'ATRASADO'])('não permite converter entrega %s em rascunho', async (status) => {
    getAsync
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({ id: 8, prazo_entrega: '2026-11-15T23:59:59-03:00', pbl_1: true, periodo_nome: '2026/2' })
      .mockResolvedValueOnce({ id: 12, status, primeira_entrega_final_em: '2026-11-04T18:00:00-03:00' });
    const res = resposta();

    await submitStudentAnswer({
      params: { atividadeId: '9' },
      body: { conteudoResposta: '', finalSubmit: false },
      user: { id: 7, perfilNome: 'ALUNO' }
    } as any, res as any);

    expect(res.statusCode).toBe(400);
    expect(runAsync).not.toHaveBeenCalled();
  });
});

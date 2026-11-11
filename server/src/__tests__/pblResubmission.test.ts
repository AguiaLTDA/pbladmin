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

  it('exige arquivo PPTX válido antes de finalizar a entrega de slides', async () => {
    vi.setSystemTime(new Date('2026-11-19T12:00:00-03:00'));
    getAsync
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({
        id: 20, prazo_entrega: '2026-11-20T02:59:59.999Z', natureza: 'OBRIGATORIA_SEM_NOTA'
      });
    const res = resposta();

    await submitStudentAnswer({
      params: { atividadeId: '20' }, body: { conteudoResposta: 'texto', arquivoIds: [], finalSubmit: true },
      user: { id: 7, perfilNome: 'ALUNO' }
    } as any, res as any);

    expect(res.statusCode).toBe(400);
    expect(runAsync).not.toHaveBeenCalled();
  });

  it.each([
    { nome_original: 'slides.pdf', mime_type: 'application/pdf' },
    { nome_original: 'slides.pptx', mime_type: 'application/pdf' }
  ])('rejeita anexo que não seja PPTX ($nome_original)', async (arquivo) => {
    vi.setSystemTime(new Date('2026-11-19T12:00:00-03:00'));
    getAsync
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({
        id: 20, prazo_entrega: '2026-11-20T02:59:59.999Z', natureza: 'OBRIGATORIA_SEM_NOTA'
      });
    queryAsync.mockResolvedValue([{ id: 33, enviado_por: 7, ...arquivo }]);
    const res = resposta();

    await submitStudentAnswer({
      params: { atividadeId: '20' }, body: { arquivoIds: [33], finalSubmit: true },
      user: { id: 7, perfilNome: 'ALUNO' }
    } as any, res as any);

    expect(res.statusCode).toBe(400);
    expect(runAsync).not.toHaveBeenCalled();
  });

  it.each([
    { enviado_por: 8, nome_original: 'slides.pptx', mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
    { enviado_por: 7, nome_original: 'slides.pptx', mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', deletado_em: new Date() }
  ])('não aceita arquivo PPTX que não pertença ao aluno ou esteja excluído', async (file) => {
    vi.setSystemTime(new Date('2026-11-19T12:00:00-03:00'));
    getAsync
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({
        id: 20, prazo_entrega: '2026-11-20T02:59:59.999Z', natureza: 'OBRIGATORIA_SEM_NOTA'
      });
    queryAsync.mockResolvedValue([{ id: 33, ...file }]);
    const res = resposta();

    await submitStudentAnswer({
      params: { atividadeId: '20' }, body: { arquivoIds: [33], finalSubmit: true },
      user: { id: 7, perfilNome: 'ALUNO' }
    } as any, res as any);

    expect(res.statusCode).toBe(400);
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('aceita PPTX próprio até o último milissegundo e bloqueia depois do prazo de slides', async () => {
    vi.setSystemTime(new Date('2026-11-19T23:59:59.999-03:00'));
    getAsync
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({
        id: 20, prazo_entrega: '2026-11-20T02:59:59.999Z', natureza: 'OBRIGATORIA_SEM_NOTA'
      })
      .mockResolvedValueOnce(undefined);
    queryAsync.mockResolvedValue([{
      id: 33, enviado_por: 7, nome_original: 'slides.pptx',
      mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    }]);
    const accepted = resposta();
    await submitStudentAnswer({
      params: { atividadeId: '20' }, body: { arquivoIds: [33], finalSubmit: true },
      user: { id: 7, perfilNome: 'ALUNO' }
    } as any, accepted as any);
    expect(accepted.statusCode).toBe(200);

    vi.setSystemTime(new Date('2026-11-20T00:00:00-03:00'));
    getAsync.mockReset();
    getAsync
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({
        id: 20, prazo_entrega: '2026-11-20T02:59:59.999Z', natureza: 'OBRIGATORIA_SEM_NOTA'
      });
    runAsync.mockClear();
    const late = resposta();
    await submitStudentAnswer({
      params: { atividadeId: '20' }, body: { arquivoIds: [33], finalSubmit: true },
      user: { id: 7, perfilNome: 'ALUNO' }
    } as any, late as any);
    expect(late.statusCode).toBe(400);
    expect(runAsync).not.toHaveBeenCalled();
  });
});

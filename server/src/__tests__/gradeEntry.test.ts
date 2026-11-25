import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAsync, runAsync, queryAsync, logAudit } = vi.hoisted(() => ({
  getAsync: vi.fn(), runAsync: vi.fn(), queryAsync: vi.fn(), logAudit: vi.fn()
}));
vi.mock('../config/db', () => ({ getAsync, runAsync, queryAsync }));
vi.mock('../services/audit', () => ({ logAudit }));
vi.mock('../services/horarioImport', () => ({ professorAlcancaAtividade: vi.fn() }));

import { evaluateSubmission } from '../controllers/submissionController';

function resposta() {
  return { statusCode: 200, body: undefined as any, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
}

const ENTREGA_PBL = {
  id: 5, aluno_id: 7, atividade_id: 9, natureza: 'AVALIATIVA', pbl_1: true, periodo_nome: '2026/2',
  data_envio: '2026-11-03T12:00:00-03:00', primeira_entrega_final_em: '2026-11-03T12:00:00-03:00'
};

function comFeedback(feedback: { id: number; versao: number } | undefined) {
  getAsync.mockImplementation(async (sql: string) => (sql.includes('FROM entregas e') ? ENTREGA_PBL : feedback));
}

beforeEach(() => {
  vi.resetAllMocks();
  runAsync.mockResolvedValue({ lastID: 0, changes: 1 });
  logAudit.mockResolvedValue(undefined);
});

async function avaliarComoAdmin(body: Record<string, unknown>) {
  const res = resposta();
  await evaluateSubmission({ params: { entregaId: '5' }, body, user: { id: 4, perfilNome: 'ADMIN' } } as any, res as any);
  return res;
}

describe('lançamento das notas do PBL escrito e oral', () => {
  it('recusa nota escrita acima de 1,0 no PBL de 2026/2', async () => {
    comFeedback(undefined);
    const res = await avaliarComoAdmin({ notaEscrita: 8, notaOral: '', liberadoAluno: false, versao: null });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain('1,0');
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('recusa nota oral acima de 1,5 e notas negativas', async () => {
    comFeedback(undefined);
    expect((await avaliarComoAdmin({ notaEscrita: 0.9, notaOral: 2, liberadoAluno: false, versao: null })).statusCode).toBe(400);
    expect((await avaliarComoAdmin({ notaEscrita: -0.1, notaOral: '', liberadoAluno: false, versao: null })).statusCode).toBe(400);
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('grava a nota oral em branco como não lançada e soma só a escrita', async () => {
    comFeedback(undefined);
    const res = await avaliarComoAdmin({ notaEscrita: 0.8, notaOral: '', liberadoAluno: false, versao: null });
    expect(res.statusCode).toBe(200);
    const [sql, params] = runAsync.mock.calls[0];
    expect(sql).toContain('INSERT INTO feedbacks');
    expect(sql).toContain('WHERE NOT EXISTS');
    expect(params.slice(0, 7)).toEqual(['5', 4, 0.8, null, null, 0.8, '']);
    expect(res.body.notaTotal).toBe(0.8);
  });

  it('avisa ao aluno que a oral será lançada depois quando libera só a escrita', async () => {
    comFeedback(undefined);
    await avaliarComoAdmin({ notaEscrita: 0.8, notaOral: '', liberadoAluno: true, versao: null });
    const notificacao = runAsync.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO notificacoes'));
    expect(notificacao?.[1][2]).toContain('Nota escrita: 0.80');
    expect(notificacao?.[1][2]).toContain('nota oral será lançada após a apresentação');
  });

  it('atualiza com trava de versão e recusa avaliação desatualizada', async () => {
    comFeedback({ id: 12, versao: 3 });
    runAsync.mockResolvedValueOnce({ lastID: 0, changes: 0 });
    const res = await avaliarComoAdmin({ notaEscrita: 0.8, notaOral: 1.2, liberadoAluno: false, versao: 2 });
    expect(res.statusCode).toBe(409);
    const [sql, params] = runAsync.mock.calls[0];
    expect(sql).toContain('versao = versao + 1');
    expect(sql).toContain('AND versao = ?');
    expect(params.slice(-2)).toEqual([12, 2]);
    expect(runAsync).toHaveBeenCalledOnce();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('recusa criar a avaliação se outro professor a criou enquanto o modal estava aberto', async () => {
    comFeedback({ id: 12, versao: 1 });
    const res = await avaliarComoAdmin({ notaEscrita: 0.8, notaOral: '', liberadoAluno: false, versao: null });
    expect(res.statusCode).toBe(409);
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('recusa quando a inserção perde a corrida para outro professor', async () => {
    comFeedback(undefined);
    runAsync.mockResolvedValueOnce({ lastID: 0, changes: 0 });
    const res = await avaliarComoAdmin({ notaEscrita: 0.8, notaOral: '', liberadoAluno: true, versao: null });
    expect(res.statusCode).toBe(409);
    expect(runAsync).toHaveBeenCalledOnce();
  });

  it('responde 409 quando o índice único barra a segunda criação simultânea', async () => {
    comFeedback(undefined);
    runAsync.mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }));
    const res = await avaliarComoAdmin({ notaEscrita: 0.8, notaOral: '', liberadoAluno: false, versao: null });
    expect(res.statusCode).toBe(409);
  });

  it('recusa versão que não é número', async () => {
    comFeedback({ id: 12, versao: 1 });
    const res = await avaliarComoAdmin({ notaEscrita: 0.8, notaOral: '', liberadoAluno: false, versao: 'abc' });
    expect(res.statusCode).toBe(400);
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('recusa nota escrita em branco em vez de gravar zero', async () => {
    comFeedback(undefined);
    const res = await avaliarComoAdmin({ notaEscrita: '', notaOral: '', liberadoAluno: false, versao: null });
    expect(res.statusCode).toBe(400);
  });

  it('não arredonda o total de períodos anteriores', async () => {
    getAsync.mockImplementation(async (sql: string) => (sql.includes('FROM entregas e') ? { ...ENTREGA_PBL, periodo_nome: '2026/1' } : undefined));
    const res = await avaliarComoAdmin({ notaEscrita: 1.885, notaOral: 1.24, liberadoAluno: false, versao: null });
    expect(res.body.notaTotal).toBeCloseTo(3.125, 10);
  });

  it('mantém escala livre em períodos anteriores ao manual de 2026/2', async () => {
    getAsync.mockImplementation(async (sql: string) => (sql.includes('FROM entregas e') ? { ...ENTREGA_PBL, periodo_nome: '2026/1' } : undefined));
    const res = await avaliarComoAdmin({ notaEscrita: 1.885, notaOral: 1.24, liberadoAluno: false, versao: null });
    expect(res.statusCode).toBe(200);
  });
});


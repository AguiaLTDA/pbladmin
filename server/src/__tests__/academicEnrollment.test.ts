import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo-de-teste';

const mocks = vi.hoisted(() => ({
  getAsync: vi.fn(),
  runAsync: vi.fn(),
  queryAsync: vi.fn(),
  logAudit: vi.fn(),
  ressincronizarAudienciaDosGrupos: vi.fn(),
  eventos: [] as string[]
}));

vi.mock('../config/db', () => ({
  getAsync: mocks.getAsync,
  runAsync: mocks.runAsync,
  queryAsync: mocks.queryAsync,
  execAsync: vi.fn(async () => undefined),
  pool: {}
}));

vi.mock('../services/audit', () => ({ logAudit: mocks.logAudit }));
vi.mock('../services/horarioImport', () => ({ importarHorarioAcademico: vi.fn() }));
vi.mock('../services/segmentation', () => ({
  ressincronizarAudienciaDosGrupos: mocks.ressincronizarAudienciaDosGrupos
}));

import { enrollStudent } from '../controllers/academicController';

function resposta_() {
  const r: any = {
    statusCode: 200,
    corpo: undefined,
    status(code: number) {
      r.statusCode = code;
      return r;
    },
    json(payload: any) {
      mocks.eventos.push('response');
      r.corpo = payload;
      return r;
    }
  };
  return r;
}

function requisicao(body: Record<string, any>) {
  return { user: { id: 7, perfilNome: 'ADMIN' }, body, params: {}, query: {} } as any;
}

async function matricular(body: Record<string, any>) {
  const res = resposta_();
  await enrollStudent(requisicao(body), res);
  return res;
}

beforeEach(() => {
  mocks.getAsync.mockReset();
  mocks.runAsync.mockReset();
  mocks.queryAsync.mockReset();
  mocks.logAudit.mockReset();
  mocks.ressincronizarAudienciaDosGrupos.mockReset();
  mocks.eventos.length = 0;
  mocks.getAsync.mockResolvedValue({ total: '0' });
  mocks.runAsync.mockImplementation(async (sql: string) => {
    mocks.eventos.push(sql.includes('UPDATE matriculas') ? 'update' : 'insert');
    return { lastID: 31, changes: 1 };
  });
  mocks.logAudit.mockImplementation(async () => {
    mocks.eventos.push('audit');
  });
  mocks.ressincronizarAudienciaDosGrupos.mockImplementation(async () => {
    mocks.eventos.push('resync');
  });
});

describe('enrollStudent sincroniza a audiência de atividades por grupo', () => {
  it('sincroniza o grupo de destino ao criar uma matrícula', async () => {
    mocks.getAsync.mockResolvedValueOnce({ total: '0' }).mockResolvedValueOnce(undefined);

    const res = await matricular({ usuarioId: 42, turmaId: 3, grupoId: 9 });

    expect(res.statusCode).toBe(201);
    expect(mocks.ressincronizarAudienciaDosGrupos).toHaveBeenCalledWith([9]);
    expect(mocks.eventos.indexOf('insert')).toBeLessThan(mocks.eventos.indexOf('resync'));
    expect(mocks.eventos.indexOf('resync')).toBeLessThan(mocks.eventos.indexOf('response'));
  });

  it('sincroniza os grupos de origem e destino ao transferir matrícula', async () => {
    mocks.getAsync.mockResolvedValueOnce({ total: '0' }).mockResolvedValueOnce({ id: 12, grupo_id: 8 });

    const res = await matricular({ usuarioId: 42, turmaId: 3, grupoId: 9 });

    expect(res.statusCode).toBe(200);
    expect(mocks.ressincronizarAudienciaDosGrupos).toHaveBeenCalledWith([9, 8]);
    expect(mocks.eventos.indexOf('update')).toBeLessThan(mocks.eventos.indexOf('resync'));
    expect(mocks.eventos.indexOf('resync')).toBeLessThan(mocks.eventos.indexOf('response'));
  });

  it('sincroniza a origem ao remover o aluno do grupo', async () => {
    mocks.getAsync.mockResolvedValueOnce({ id: 12, grupo_id: 8 });

    const res = await matricular({ usuarioId: 42, turmaId: 3, grupoId: null });

    expect(res.statusCode).toBe(200);
    expect(mocks.ressincronizarAudienciaDosGrupos).toHaveBeenCalledWith([null, 8]);
    expect(mocks.eventos.indexOf('update')).toBeLessThan(mocks.eventos.indexOf('resync'));
    expect(mocks.eventos.indexOf('resync')).toBeLessThan(mocks.eventos.indexOf('response'));
  });

  it('mantém matrícula nova sem grupo e sincroniza o destino nulo', async () => {
    mocks.getAsync.mockResolvedValueOnce(undefined);

    const res = await matricular({ usuarioId: 42, turmaId: 3 });

    expect(res.statusCode).toBe(201);
    expect(mocks.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO matriculas'),
      [42, 3, null]
    );
    expect(mocks.ressincronizarAudienciaDosGrupos).toHaveBeenCalledWith([null]);
    expect(mocks.eventos.indexOf('insert')).toBeLessThan(mocks.eventos.indexOf('resync'));
    expect(mocks.eventos.indexOf('resync')).toBeLessThan(mocks.eventos.indexOf('response'));
  });

  it('preserva o bloqueio quando o grupo de destino está lotado', async () => {
    mocks.getAsync.mockResolvedValueOnce({ total: '5' });

    const res = await matricular({ usuarioId: 42, turmaId: 3, grupoId: 9 });

    expect(res.statusCode).toBe(409);
    expect(mocks.runAsync).not.toHaveBeenCalled();
    expect(mocks.ressincronizarAudienciaDosGrupos).not.toHaveBeenCalled();
  });
});

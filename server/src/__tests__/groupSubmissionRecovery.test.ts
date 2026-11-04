import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAsync, queryAsync, runAsync, repararPblsInformativosDeGrupo, ressincronizarAudiencia } = vi.hoisted(() => ({
  getAsync: vi.fn(),
  queryAsync: vi.fn(),
  runAsync: vi.fn(),
  repararPblsInformativosDeGrupo: vi.fn(),
  ressincronizarAudiencia: vi.fn()
}));

vi.mock('../config/db', () => ({ getAsync, queryAsync, runAsync }));
vi.mock('../services/groupPblSubmission', () => ({ repararPblsInformativosDeGrupo }));
vi.mock('../services/segmentation', () => ({ ressincronizarAudiencia }));

import { runMigrations } from '../db/migrate';

describe('recuperação de entregas por grupo na inicialização', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('information_schema.columns')) return { existe: '1' };
      if (sql.includes('COUNT(*) as total FROM cronograma_pbl_etapas')) return { total: '1' };
      return undefined;
    });
    queryAsync.mockResolvedValue([
      { atividade_id: 31 },
      { atividade_id: 44 }
    ]);
    runAsync.mockResolvedValue({ lastID: 0, changes: 0 });
    repararPblsInformativosDeGrupo.mockResolvedValue(undefined);
    ressincronizarAudiencia.mockResolvedValue(undefined);
  });

  it('repara casos PBL informativos e refaz a audiência das atividades de grupo publicadas', async () => {
    await runMigrations();

    expect(repararPblsInformativosDeGrupo).toHaveBeenCalledOnce();
    expect(queryAsync).toHaveBeenCalledWith(expect.stringContaining("a.status = 'PUBLICADO'"));
    expect(queryAsync).toHaveBeenCalledWith(expect.stringContaining('a.deletado_em IS NULL'));
    expect(queryAsync).toHaveBeenCalledWith(expect.stringContaining("sr.entidade_tipo = 'grupo'"));
    expect(queryAsync).toHaveBeenCalledWith(expect.stringContaining("sr.acao = 'INCLUIR'"));

    const semeaduraCronograma = runAsync.mock.calls.findIndex(([sql]) =>
      sql.includes('INSERT INTO cronograma_pbl (id, periodo, total_avaliativo)')
    );
    expect(semeaduraCronograma).toBeGreaterThanOrEqual(0);
    expect(repararPblsInformativosDeGrupo.mock.invocationCallOrder[0]).toBeGreaterThan(
      runAsync.mock.invocationCallOrder[semeaduraCronograma]
    );
    expect(ressincronizarAudiencia.mock.calls.map(([id]) => id)).toEqual([31, 44]);
  });

  it('propaga falha na correção dos PBLs para impedir a inicialização com recuperação incompleta', async () => {
    const falha = new Error('Falha ao converter atividades PBL');
    repararPblsInformativosDeGrupo.mockRejectedValue(falha);

    await expect(runMigrations()).rejects.toBe(falha);
    expect(ressincronizarAudiencia).not.toHaveBeenCalled();
  });

  it('propaga falha na ressincronização de audiência para impedir recuperação parcial', async () => {
    const falha = new Error('Falha ao reconstruir a audiência');
    ressincronizarAudiencia.mockRejectedValue(falha);

    await expect(runMigrations()).rejects.toBe(falha);
    expect(repararPblsInformativosDeGrupo).toHaveBeenCalledOnce();
    expect(ressincronizarAudiencia).toHaveBeenCalledOnce();
  });
});

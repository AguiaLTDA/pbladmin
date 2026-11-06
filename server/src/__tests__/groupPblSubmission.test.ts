import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryAsync, runAsync, getAsync, logAudit, calculateAudiencePreview, saveSegmentationAndTargetStudents, uploadToDrive } = vi.hoisted(() => ({
  queryAsync: vi.fn(), runAsync: vi.fn(), getAsync: vi.fn(), logAudit: vi.fn(),
  calculateAudiencePreview: vi.fn(), saveSegmentationAndTargetStudents: vi.fn(), uploadToDrive: vi.fn()
}));

vi.mock('../config/db', () => ({ queryAsync, runAsync, getAsync }));
vi.mock('../services/audit', () => ({ logAudit }));
vi.mock('../services/segmentation', () => ({ calculateAudiencePreview, saveSegmentationAndTargetStudents }));
vi.mock('../services/googleDrive', () => ({ uploadToDrive, downloadFromDrive: vi.fn(), moverParaExcluidosNoDrive: vi.fn() }));

import { repararPblsInformativosDeGrupo } from '../services/groupPblSubmission';
import { definirTipoDocumento, enviarArquivoParaGrupo } from '../controllers/fileController';

function resposta() {
  const res: any = { statusCode: 200, body: undefined, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
  return res;
}

function request(params: any = {}, body: any = {}) {
  return { params, body, user: { id: 4, perfilNome: 'ADMIN' } } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  queryAsync.mockResolvedValue([]);
  getAsync.mockResolvedValue(undefined);
  runAsync.mockResolvedValue({ lastID: 11, changes: 1 });
  calculateAudiencePreview.mockResolvedValue({ totalAlunosUnicos: 2 });
  saveSegmentationAndTargetStudents.mockResolvedValue({ alunosIncluidos: [{ id: 22 }] });
});

describe('PBL 1 enviado a grupo', () => {
  it('cria atividade avaliativa com prazo do cronograma e texto de entrega', async () => {
    getAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('cronograma_pbl_etapas')) return { fim: '2026-11-08' };
      if (sql.includes('FROM arquivos')) return { id: 8, nome_original: 'caso.pdf', tipo_documento: 'PBL_1' };
      if (sql.includes('FROM grupos')) return { id: 9, nome: 'Equipe A', turma_id: 5, turma_nome: 'Turma 1', periodo_letivo_id: 2 };
      if (sql.includes('FROM vinculos_professores')) return { professor_id: 3, disciplina_id: 6, curso_id: 7 };
      return undefined;
    });
    const res = resposta();
    await enviarArquivoParaGrupo(request({ id: '8' }, { grupoId: 9 }), res);

    const atividade = runAsync.mock.calls.find(([sql]) => sql.includes('INSERT INTO atividades_pbl'));
    const versao = runAsync.mock.calls.find(([sql]) => sql.includes('INSERT INTO versoes_atividades'));
    const publicacao = runAsync.mock.calls.find(([sql]) => sql.includes('INSERT INTO publicacoes'));
    expect(atividade?.[0]).toContain('?, 1)');
    expect(atividade?.[1]?.[6]).toBe('AVALIATIVA');
    expect(atividade?.[1]?.[1]).toMatch(/^PBL 1:/);
    expect(versao?.[1]?.[1]).toMatch(/entrega/i);
    expect(versao?.[1]?.[1]).not.toMatch(/não é necessário/i);
    expect(publicacao?.[1]?.[2]).toBe('2026-11-09T02:59:59.000Z');
    expect(res.statusCode).toBe(201);
  });

  it('mantém material de apoio informativo', async () => {
    getAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM arquivos')) return { id: 8, nome_original: 'guia.pdf', tipo_documento: 'INFORMATIVO' };
      if (sql.includes('FROM grupos')) return { id: 9, nome: 'Equipe A', turma_id: 5, turma_nome: 'Turma 1', periodo_letivo_id: 2 };
      if (sql.includes('FROM vinculos_professores')) return { professor_id: 3, disciplina_id: 6, curso_id: 7 };
      return undefined;
    });
    const res = resposta();
    await enviarArquivoParaGrupo(request({ id: '8' }, { grupoId: 9 }), res);
    const atividade = runAsync.mock.calls.find(([sql]) => sql.includes('INSERT INTO atividades_pbl'));
    expect(atividade?.[1]?.[6]).toBe('INFORMATIVA');
    expect(atividade?.[1]?.[1]).toMatch(/^Material:/);
    expect(res.statusCode).toBe(201);
  });

  it('não cria atividade PBL 1 se a data de entrega do cronograma for inválida', async () => {
    getAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('cronograma_pbl_etapas')) return { fim: 'data-invalida' };
      if (sql.includes('FROM arquivos')) return { id: 8, nome_original: 'caso.pdf', tipo_documento: 'PBL_1' };
      if (sql.includes('FROM grupos')) return { id: 9, nome: 'Equipe A', turma_id: 5, turma_nome: 'Turma 1', periodo_letivo_id: 2 };
      if (sql.includes('FROM vinculos_professores')) return { professor_id: 3, disciplina_id: 6, curso_id: 7 };
      return undefined;
    });
    const res = resposta();

    await enviarArquivoParaGrupo(request({ id: '8' }, { grupoId: 9 }), res);

    expect(res.statusCode).toBe(500);
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('usa o prazo padrão se cronograma não tiver etapa quatro', async () => {
    queryAsync.mockImplementation(async (sql: string) => sql.includes('SELECT DISTINCT a.id') ? [{
      id: 71, titulo: 'Material: Caso — Equipe A', versao_atual: 1, natureza: 'INFORMATIVA', status: 'PUBLICADO', arquivo_id: 8
    }] : []);
    await repararPblsInformativosDeGrupo(8);
    const update = runAsync.mock.calls.find(([sql]) => sql.includes('WITH atualizada'));
    expect(update?.[1]?.[0]).toBe(71);
    expect(update?.[1]?.[1]).toMatch(/solução/);
    expect(update?.[1]?.[2]).toBe('2026-11-11T02:59:59.000Z');
  });

  it('reclassificar arquivo PBL 1 converte atividade existente', async () => {
    getAsync.mockImplementation(async (sql: string) => sql.includes('cronograma_pbl_etapas') ? { fim: '2026-11-08' } : { id: 8 });
    queryAsync.mockImplementation(async (sql: string) => sql.includes('SELECT DISTINCT a.id') ? [{
      id: 71, titulo: 'Material: Caso — Equipe A', versao_atual: 1, natureza: 'INFORMATIVA', status: 'PUBLICADO', arquivo_id: 8
    }] : []);
    const res = resposta();
    await definirTipoDocumento(request({ id: '8' }, { tipoDocumento: 'PBL_1' }), res);
    const update = runAsync.mock.calls.find(([sql]) => sql.includes('WITH atualizada'));
    expect(update?.[1]).toEqual([71, expect.stringContaining('envie sua resposta'), '2026-11-09T02:59:59.000Z']);
    expect(res.statusCode).toBe(200);
  });

  it('não toca atividades que já são avaliativas', async () => {
    queryAsync.mockImplementation(async (sql: string) => sql.includes('SELECT DISTINCT a.id') ? [] : []);
    await repararPblsInformativosDeGrupo(8);
    expect(runAsync).not.toHaveBeenCalled();
  });
});

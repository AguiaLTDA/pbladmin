import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAsync, queryAsync, professorAlcancaAtividade } = vi.hoisted(() => ({
  getAsync: vi.fn(), queryAsync: vi.fn(), professorAlcancaAtividade: vi.fn()
}));
vi.mock('../config/db', () => ({ getAsync, queryAsync, runAsync: vi.fn() }));
vi.mock('../services/audit', () => ({ logAudit: vi.fn() }));
vi.mock('../services/horarioImport', () => ({ professorAlcancaAtividade }));

import { getStudentActivities, listSubmissionsForActivity, listPendingGroups } from '../controllers/submissionController';

function resposta() {
  return { statusCode: 200, body: undefined as any, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('listagem geral de entregas', () => {
  it('lista grupos elegíveis com pendências publicadas de slides ou escrito', async () => {
    queryAsync.mockResolvedValueOnce([
      { grupo_id: 9, sem_slides: true, sem_escrito: false },
      { grupo_id: 12, sem_slides: false, sem_escrito: true }
    ]);
    const res = resposta();

    await listPendingGroups({ params: {}, user: { id: 4, perfilNome: 'ADMIN' } } as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      { grupoId: 9, semSlides: true, semEscrito: false },
      { grupoId: 12, semSlides: false, semEscrito: true }
    ]);
    expect(queryAsync).toHaveBeenCalledOnce();
    const [sql, params] = queryAsync.mock.calls[0];
    expect(sql).toContain("a.status = 'PUBLICADO'");
    expect(sql).toContain("pub.status_publicacao = 'PUBLICADO'");
    expect(sql).toContain('als.atividade_id = ap.id');
    expect(sql).toContain('m.ativo = 1 AND m.deletado_em IS NULL');
    expect(sql).toContain('t.ativo = 1 AND t.deletado_em IS NULL');
    expect(sql).toContain('t.curso_id = ap.curso_id AND t.periodo_letivo_id = ap.periodo_letivo_id');
    expect(sql).toContain("sr.acao = 'EXCLUIR'");
    expect(sql).toContain("sr.acao = 'INCLUIR'");
    expect(sql).toContain('e.grupo_id IS NULL');
    expect(sql).toContain("e.status IN ('ENVIADO', 'ATRASADO')");
    expect(sql).toContain('a.versao_atual');
    expect(params).toEqual(['OBRIGATORIA_SEM_NOTA']);
  });

  it('lista atividades publicadas e seus arquivos em lote, preservando entregas sem anexos', async () => {
    queryAsync.mockResolvedValueOnce([
      { id: 1, atividade_id: 10, atividade_titulo: 'Slides', codigo_unico: 'A10', natureza: 'OBRIGATORIA_SEM_NOTA' },
      { id: 2, atividade_id: 20, atividade_titulo: 'Relatório', codigo_unico: 'A20', natureza: 'AVALIATIVA' }
    ]).mockResolvedValueOnce([
      { entrega_id: 1, id: 7, nome_original: 'slides.pdf' },
      { entrega_id: 1, id: 8, nome_original: 'slides.pptx' }
    ]);
    const res = resposta();
    await listSubmissionsForActivity({ params: {}, user: { id: 4, perfilNome: 'ADMIN' } } as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      expect.objectContaining({ atividade_id: 10, arquivos: [expect.objectContaining({ id: 7 }), expect.objectContaining({ id: 8 })] }),
      expect.objectContaining({ atividade_id: 20, arquivos: [] })
    ]);
    expect(getAsync).not.toHaveBeenCalled();
    expect(queryAsync).toHaveBeenCalledTimes(2);
    const [sql, params] = queryAsync.mock.calls[0];
    expect(sql).toContain("a.status = 'PUBLICADO'");
    expect(sql).toContain('a.deletado_em IS NULL');
    expect(sql).toContain('e.deletado_em IS NULL');
    expect(sql).toContain('a.id as atividade_id');
    expect(params).toEqual([]);
    expect(queryAsync.mock.calls[1][0]).toContain('ar.deletado_em IS NULL');
    expect(queryAsync.mock.calls[1][1]).toEqual([[1, 2]]);
  });

  it('restringe professor às atividades acessíveis e aos alunos das turmas vinculadas', async () => {
    queryAsync.mockResolvedValue([]);
    const res = resposta();
    await listSubmissionsForActivity({ params: {}, user: { id: 42, perfilNome: 'PROFESSOR' } } as any, res as any);

    expect(res.body).toEqual([]);
    const [sql, params] = queryAsync.mock.calls[0];
    expect(sql).toContain('a.professor_id = ?');
    expect(sql).toContain('als.atividade_id = a.id');
    expect(sql).toContain('a.disciplina_id = vp.disciplina_id');
    expect(sql).toContain('m2.usuario_id = e.aluno_id');
    expect(params).toEqual([42, 42, 42, 42]);
    expect(queryAsync).toHaveBeenCalledOnce();
  });

  it('preserva a autorização da rota por atividade', async () => {
    getAsync.mockResolvedValueOnce({ id: 10 });
    professorAlcancaAtividade.mockResolvedValue(false);
    const res = resposta();
    await listSubmissionsForActivity({ params: { atividadeId: '10' }, user: { id: 42, perfilNome: 'PROFESSOR' } } as any, res as any);
    expect(res.statusCode).toBe(403);
    expect(queryAsync).not.toHaveBeenCalled();
  });

  it('preserva a listagem por publicação de uma atividade específica', async () => {
    getAsync.mockResolvedValueOnce({ id: 10 }).mockResolvedValueOnce({ id: 50 });
    queryAsync.mockResolvedValue([]);
    const res = resposta();
    await listSubmissionsForActivity({ params: { atividadeId: '10' }, user: { id: 4, perfilNome: 'ADMIN' } } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(queryAsync.mock.calls[0][0]).toContain('e.publicacao_id = ?');
    expect(queryAsync.mock.calls[0][1]).toEqual([50]);
  });

  it('traz a nota oral na lista do aluno para distinguir nota parcial de final', async () => {
    queryAsync.mockResolvedValue([]);
    const res = resposta();
    await getStudentActivities({ query: {}, user: { id: 7, perfilNome: 'ALUNO' } } as any, res as any);
    expect(queryAsync.mock.calls[0][0]).toContain('fb.nota_oral');
  });
});

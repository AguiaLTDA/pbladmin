import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PoolClient } from 'pg';
import { vi } from 'vitest';
import { pool } from '../config/db';
import { studentDeliveryCte } from '../services/studentGroupDelivery';
import { getStudentActivities, getStudentActivityDetails, submitStudentAnswer } from '../controllers/submissionController';
import { getDashboardData } from '../controllers/dashboardController';

const { downloadFromDrive } = vi.hoisted(() => ({ downloadFromDrive: vi.fn() }));
vi.mock('../services/googleDrive', () => ({ uploadToDrive: vi.fn(), downloadFromDrive, moverParaExcluidosNoDrive: vi.fn() }));
vi.mock('../services/audit', () => ({ logAudit: vi.fn() }));
import { downloadFile } from '../controllers/fileController';

describe.skipIf(process.env.PBL_MIGRATION_TEST !== 'true')('visibilidade de entregas compartilhadas por grupo', () => {
  const schema = `teste_entrega_grupo_${process.pid}`;
  let client: PoolClient;
  let originalPoolOptions: string | undefined;

  beforeAll(async () => {
    originalPoolOptions = pool.options.options;
    pool.options.options = `-c search_path=${schema}`;
    await pool.query(`CREATE SCHEMA ${schema}`);
    client = await pool.connect();
    await client.query(`SET search_path TO ${schema}`);
    await client.query(`
      CREATE TABLE turmas (id int PRIMARY KEY, curso_id int, periodo_letivo_id int, ativo int, deletado_em timestamptz);
      CREATE TABLE periodos_letivos (id int PRIMARY KEY, nome text);
      CREATE TABLE usuarios (id int PRIMARY KEY, nome text, perfil_id int);
      CREATE TABLE cursos (id int PRIMARY KEY, nome text);
      CREATE TABLE disciplinas (id int PRIMARY KEY, nome text);
      CREATE TABLE grupos (id int PRIMARY KEY, turma_id int, ativo int, deletado_em timestamptz);
      CREATE TABLE atividades_pbl (id int PRIMARY KEY, codigo_unico text, titulo text, natureza text DEFAULT 'AVALIATIVA', curso_id int, disciplina_id int, professor_id int, periodo_letivo_id int, versao_atual int, status text DEFAULT 'PUBLICADO', deletado_em timestamptz);
      CREATE TABLE versoes_atividades (id int PRIMARY KEY, atividade_id int, numero_versao int, forma_realizacao text, instrucoes_gerais text);
      CREATE TABLE publicacoes (id int PRIMARY KEY, atividade_id int, data_disponibilizacao timestamptz DEFAULT CURRENT_TIMESTAMP, prazo_entrega timestamptz DEFAULT CURRENT_TIMESTAMP + interval '1 day', status_publicacao text DEFAULT 'PUBLICADO');
      CREATE TABLE alunos_segmentados (id serial PRIMARY KEY, atividade_id int, aluno_id int);
      CREATE TABLE segmentacoes (id int PRIMARY KEY, atividade_id int);
      CREATE TABLE segmentacao_regras (segmentacao_id int, entidade_tipo text, entidade_id int, acao text);
      CREATE TABLE matriculas (id serial PRIMARY KEY, usuario_id int, turma_id int, grupo_id int, ativo int, deletado_em timestamptz);
      CREATE TABLE entregas (id int PRIMARY KEY, publicacao_id int, aluno_id int, grupo_id int, status text, primeira_entrega_final_em timestamptz, data_envio timestamptz, comprovante_hash text, criado_em timestamptz, deletado_em timestamptz);
      CREATE TABLE feedbacks (id int PRIMARY KEY, entrega_id int, avaliador_id int, nota_total numeric, liberado_aluno int, observacoes text);
      CREATE TABLE etapas_pbl (id int PRIMARY KEY, versao_atividade_id int, ordem int);
      CREATE TABLE arquivos (id int PRIMARY KEY, nome_original text, tamanho_bytes int, mime_type text, categoria text, tipo_documento text, deletado_em timestamptz, caminho_armazenado text, enviado_por int);
      CREATE TABLE arquivos_atividades (id serial PRIMARY KEY, versao_atividade_id int, arquivo_id int, aprovado_pelo_admin int);
      CREATE TABLE arquivos_entregas (id serial PRIMARY KEY, entrega_id int, arquivo_id int);
      CREATE TABLE arquivos_institucionais (id serial PRIMARY KEY, arquivo_id int);
      INSERT INTO periodos_letivos VALUES (1,'2026/2'),(2,'2026/1');
      INSERT INTO usuarios VALUES (1,'Ana',2),(2,'Bia',2),(3,'Caio',2),(4,'Duda',2);
      INSERT INTO cursos VALUES (1,'Curso 1'),(2,'Curso 2');
      INSERT INTO disciplinas VALUES (1,'Disciplina 1');
      INSERT INTO turmas VALUES (10,1,1,1,NULL),(11,1,2,1,NULL),(12,2,1,1,NULL),(13,1,1,0,NULL);
      INSERT INTO grupos VALUES (100,10,1,NULL),(101,10,1,NULL),(200,11,1,NULL),(300,12,1,NULL),(400,13,1,NULL),(500,10,0,NULL);
      INSERT INTO atividades_pbl VALUES
        (1,'A1','Atividade 1','AVALIATIVA',1,1,3,1,1,'PUBLICADO',NULL),
        (2,'A2','Atividade 2','AVALIATIVA',1,1,3,1,1,'PUBLICADO',NULL),
        (3,'A3','Atividade 3','AVALIATIVA',1,1,3,1,1,'PUBLICADO',NULL),
        (4,'A4','Atividade 4','AVALIATIVA',1,1,3,1,1,'PUBLICADO',NULL),
        (5,'A5','Atividade 5','AVALIATIVA',1,1,3,1,1,'PUBLICADO',NULL),
        (6,'A6','Atividade 6','AVALIATIVA',1,1,3,1,1,'PUBLICADO',NULL),
        (7,'A7','Atividade 7','AVALIATIVA',1,1,3,1,1,'PUBLICADO',NULL),
        (8,'A8','Atividade 8','AVALIATIVA',1,1,3,1,1,'PUBLICADO',NULL),
        (9,'A9','Atividade 9','AVALIATIVA',1,1,3,1,1,'PUBLICADO',NULL);
      INSERT INTO versoes_atividades VALUES (1,1,1,'INDIVIDUAL',NULL),(2,2,1,'GRUPO',NULL),(3,3,1,'INDIVIDUAL',NULL),(4,4,1,'INDIVIDUAL',NULL),(5,5,1,'GRUPO',NULL),(6,6,1,'GRUPO',NULL),(7,7,1,'GRUPO',NULL),(8,8,1,'GRUPO',NULL),(9,9,1,'GRUPO',NULL);
      INSERT INTO publicacoes VALUES (1,1),(2,2),(3,3),(4,4),(5,5),(6,6),(7,7),(8,8),(9,9);
      INSERT INTO alunos_segmentados (atividade_id, aluno_id) VALUES
        (1,1),(1,2),(1,3),(1,4),(2,1),(2,2),(3,1),(3,2),(4,1),(4,2),(5,1),(5,2),(6,1),(6,2),(7,1),(7,2),(8,1),(8,2),(9,1),(9,2);
      INSERT INTO segmentacoes VALUES (1,1),(2,4),(3,9);
      INSERT INTO segmentacao_regras VALUES (1,'grupo',100,'INCLUIR'),(2,'grupo',101,'INCLUIR'),(3,'grupo',100,'EXCLUIR');
      INSERT INTO matriculas VALUES
        (DEFAULT,1,10,100,1,NULL),(DEFAULT,2,10,100,1,NULL),(DEFAULT,3,10,101,1,NULL),(DEFAULT,4,11,200,1,NULL),
        (DEFAULT,5,10,100,1,NULL),(DEFAULT,6,10,100,1,NULL),(DEFAULT,7,10,100,0,NULL),(DEFAULT,8,10,100,1,CURRENT_TIMESTAMP);
      INSERT INTO entregas VALUES
        (1,1,1,100,'ATRASADO','2026-11-10','2026-11-10','HASH-1','2026-11-10',NULL),
        (2,2,1,100,'ENVIADO','2026-11-10','2026-11-10','HASH-2','2026-11-10',NULL),
        (3,3,1,NULL,'ENVIADO','2026-11-10','2026-11-10','HASH-3','2026-11-10',NULL),
        (4,4,1,100,'ENVIADO','2026-11-10','2026-11-10','HASH-4','2026-11-10',NULL),
        (5,5,1,100,'RASCUNHO',NULL,NULL,NULL,'2026-11-10',NULL),
        (6,6,1,100,'ENVIADO','2026-11-10','2026-11-10','HASH-6','2026-11-10',CURRENT_TIMESTAMP),
        (7,7,1,500,'ENVIADO','2026-11-10','2026-11-10','HASH-7','2026-11-10',NULL),
        (8,8,1,NULL,'ENVIADO','2026-11-10','2026-11-10','HASH-8','2026-11-10',NULL),
        (10,9,1,100,'ENVIADO','2026-11-10','2026-11-10','HASH-10','2026-11-10',NULL),
        (9,5,2,100,'RASCUNHO',NULL,NULL,NULL,'2026-11-11',NULL);
      INSERT INTO arquivos VALUES (77,'resposta.pdf',123,'application/pdf','PDF',NULL,NULL,'/drive/77',1);
      INSERT INTO arquivos_entregas (entrega_id, arquivo_id) VALUES (1,77);
      INSERT INTO feedbacks VALUES (1,1,3,8,1,'Bom trabalho');
    `);
  });

  afterAll(async () => {
    await pool.query('SET search_path TO public');
    pool.options.options = originalPoolOptions;
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    client.release();
  });

  it('compartilha finais de grupos direcionados, inclusive legadas, sem vazar para outro grupo/período ou rascunho', async () => {
    const rows = await client.query(`${studentDeliveryCte.replace('?', '$1')} SELECT publicacao_id, viewer_id, id, status FROM entrega_aluno_visivel ORDER BY publicacao_id`, [2]);
    expect(rows.rows.map((row) => [row.publicacao_id, row.id, row.status])).toEqual([
      [1, 1, 'ATRASADO'], [2, 2, 'ENVIADO'], [5, 9, 'RASCUNHO'], [8, 8, 'ENVIADO']
    ]);
    expect(rows.rows.some((row) => [3, 4, 6, 7, 9].includes(row.publicacao_id))).toBe(false);
  });

  it('expõe a entrega final compartilhada como concluída na lista e no dashboard do aluno', async () => {
    const res: any = { statusCode: 200, body: undefined, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
    await getStudentActivities({ user: { id: 2, perfilNome: 'ALUNO' }, query: {} } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.find((row: any) => row.publicacao_id === 1)).toMatchObject({ entrega_status: 'ATRASADO', estadoAluno: 'CONCLUIDA', entrega_compartilhada: true, enviado_por_nome: 'Ana' });
    expect(res.body.find((row: any) => row.publicacao_id === 5)).toMatchObject({ entrega_status: 'RASCUNHO', estadoAluno: 'EM_ANDAMENTO', entrega_compartilhada: false });
    expect(res.body.find((row: any) => row.publicacao_id === 4).entrega_id).toBeNull();

    const dashboard: any = { statusCode: 200, body: undefined, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
    await getDashboardData({ user: { id: 2, perfilNome: 'ALUNO' } } as any, dashboard);
    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.body.kpis).toMatchObject({ concluidas: 3, emAndamento: 1, total: 9 });
  });

  it('entrega ao colega detalhes, anexos e feedback liberado da entrega do grupo', async () => {
    const res: any = { statusCode: 200, body: undefined, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
    await getStudentActivityDetails({ params: { id: '1' }, user: { id: 2, perfilNome: 'ALUNO' } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.entrega).toMatchObject({ id: 1, status: 'ATRASADO', entrega_compartilhada: true, enviado_por_nome: 'Ana', comprovante_hash: 'HASH-1' });
    expect(res.body.arquivosEntrega).toEqual([expect.objectContaining({ id: 77, nome_original: 'resposta.pdf' })]);
    expect(res.body.feedback).toMatchObject({ observacoes: 'Bom trabalho', liberado_aluno: 1 });
  });

  it('recusa novo envio quando outro integrante já finalizou pelo grupo', async () => {
    const res: any = { statusCode: 200, body: undefined, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
    await submitStudentAnswer({ params: { atividadeId: '1' }, body: { conteudoResposta: 'segunda resposta', finalSubmit: true }, user: { id: 2, perfilNome: 'ALUNO' } } as any, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.message).toMatch(/grupo já realizou a entrega final/i);
    const rows = await client.query('SELECT id, aluno_id, comprovante_hash FROM entregas WHERE publicacao_id = 1 ORDER BY id');
    expect(rows.rows).toEqual([{ id: 1, aluno_id: 1, comprovante_hash: 'HASH-1' }]);
  });

  it('autoriza download de anexo compartilhado e nega colega de outro grupo antes do Drive', async () => {
    const stream: any = { on: vi.fn(), pipe: vi.fn() };
    downloadFromDrive.mockResolvedValue(stream);
    const resposta = () => ({
      statusCode: 200, body: undefined as any, headersSent: false,
      status(code: number) { this.statusCode = code; return this; },
      json(body: any) { this.body = body; return this; },
      setHeader: vi.fn()
    });
    const autorizado = resposta();
    await downloadFile({ params: { id: '77' }, user: { id: 2, perfilNome: 'ALUNO' } } as any, autorizado as any);
    expect(autorizado.statusCode).toBe(200);
    expect(stream.pipe).toHaveBeenCalledOnce();
    expect(downloadFromDrive).toHaveBeenCalledOnce();

    downloadFromDrive.mockClear();
    const negado = resposta();
    await downloadFile({ params: { id: '77' }, user: { id: 3, perfilNome: 'ALUNO' } } as any, negado as any);
    expect(negado.statusCode).toBe(403);
    expect(downloadFromDrive).not.toHaveBeenCalled();
  });
});

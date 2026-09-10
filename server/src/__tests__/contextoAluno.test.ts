import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * O controller importa o pool do Postgres na carga do módulo, e `auth.ts` exige
 * JWT_SECRET. Os dois são substituídos aqui para que os testes rodem sem banco
 * e sem .env: o que está sob teste é a regra de completude, não o driver.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo-de-teste';

/** Banco em memória: uma única linha de contexto_aluno, manipulada por SQL simplificado. */
const banco: { linha: Record<string, any> | null } = { linha: null };

vi.mock('../config/db', () => ({
  getAsync: vi.fn(async () => banco.linha ?? undefined),
  runAsync: vi.fn(async (sql: string, params: any[] = []) => {
    const agora = new Date().toISOString();

    if (/^\s*insert/i.test(sql)) {
      const colunas = sql.match(/\(usuario_id, ([^)]*)\)/)?.[1].split(',').map((c) => c.trim()) ?? [];
      banco.linha = { id: 1, usuario_id: params[0], completed_at: null };
      colunas.forEach((coluna, i) => {
        banco.linha![coluna] = params[i + 1];
      });
      return { lastID: 1, changes: 1 };
    }

    if (/completed_at = CURRENT_TIMESTAMP/i.test(sql)) {
      if (banco.linha && banco.linha.completed_at === null) banco.linha.completed_at = agora;
      return { lastID: 0, changes: 1 };
    }

    if (/completed_at = NULL/i.test(sql)) {
      if (banco.linha) banco.linha.completed_at = null;
      return { lastID: 0, changes: 1 };
    }

    // UPDATE dos campos do formulário
    const colunas = sql.match(/SET ([\s\S]*?) WHERE/i)?.[1]
      .split(',')
      .map((p) => p.trim().split('=')[0].trim())
      .filter((c) => c !== 'atualizado_em') ?? [];
    colunas.forEach((coluna, i) => {
      if (banco.linha) banco.linha[coluna] = params[i];
    });
    return { lastID: 0, changes: 1 };
  }),
  queryAsync: vi.fn(async () => []),
  execAsync: vi.fn(async () => undefined),
  pool: {}
}));

vi.mock('../services/audit', () => ({ logAudit: vi.fn(async () => undefined) }));

import {
  MIN_CARACTERES_RESPOSTA,
  MIN_RESPOSTAS_PARA_MEDALHA,
  TOTAL_PERGUNTAS_CONTEXTO,
  contarRespostas,
  contextoEstaCompleto
} from '../config/contextoAluno';
import { getMeuContexto, salvarContexto } from '../controllers/contextoAlunoController';

const ALUNO_ID = 42;

/** Texto longo o bastante para contar como resposta de verdade. */
const resposta = (rotulo: string) => `${rotulo} `.repeat(10).trim();

function requisicao(body: Record<string, any>) {
  return { user: { id: ALUNO_ID, perfilNome: 'ALUNO' }, body, params: {}, query: {} } as any;
}

function resposta_() {
  const r: any = {
    statusCode: 200,
    corpo: undefined,
    status(code: number) {
      r.statusCode = code;
      return r;
    },
    json(payload: any) {
      r.corpo = payload;
      return r;
    }
  };
  return r;
}

async function salvar(body: Record<string, any>) {
  const res = resposta_();
  await salvarContexto(requisicao(body), res);
  return res;
}

beforeEach(() => {
  banco.linha = null;
});

describe('regra de completude (config/contextoAluno)', () => {
  it('conta apenas respostas com conteúdo real', () => {
    expect(contarRespostas(null)).toBe(0);
    expect(contarRespostas({ daily_tasks: '   ' })).toBe(0);
    expect(contarRespostas({ daily_tasks: 'curto' })).toBe(0); // abaixo do piso de caracteres
    expect(contarRespostas({ daily_tasks: resposta('a') })).toBe(1);
  });

  it('exige o mínimo configurado, nem uma resposta a menos', () => {
    const parcial: Record<string, string> = {};
    for (let i = 0; i < MIN_RESPOSTAS_PARA_MEDALHA - 1; i++) {
      parcial[`campo${i}`] = resposta('x');
    }
    expect(contextoEstaCompleto(parcial)).toBe(false);
  });

  it('o piso de caracteres e o total de perguntas são coerentes', () => {
    expect(MIN_CARACTERES_RESPOSTA).toBeGreaterThan(0);
    expect(MIN_RESPOSTAS_PARA_MEDALHA).toBeLessThanOrEqual(TOTAL_PERGUNTAS_CONTEXTO);
  });
});

describe('criação e atualização do contexto', () => {
  it('cria o contexto com respostas parciais e não concede a medalha', async () => {
    const res = await salvar({
      work_sector: 'Logística',
      company_size: 'pequena',
      daily_tasks: resposta('conferência de cargas')
    });

    expect(res.statusCode).toBe(200);
    expect(res.corpo.existe).toBe(true);
    expect(res.corpo.respondidas).toBe(1);
    expect(res.corpo.completed).toBe(false);
    expect(res.corpo.completedAt).toBeNull();
    expect(res.corpo.medalha).toBeNull();
    expect(res.corpo.ganhouMedalha).toBe(false);
  });

  it('recusa porte de empresa fora da lista', async () => {
    const res = await salvar({ company_size: 'gigantesca' });
    expect(res.statusCode).toBe(400);
    expect(banco.linha).toBeNull();
  });

  it('salvar em duas etapas acumula as respostas em vez de sobrescrever', async () => {
    await salvar({ daily_tasks: resposta('a'), workplace_challenges: resposta('b') });
    const res = await salvar({ relevant_experience: resposta('c') });

    expect(res.corpo.respondidas).toBe(3);
    expect(res.corpo.dailyTasks).not.toBe('');
  });
});

describe('concessão da medalha', () => {
  it('carimba completed_at exatamente quando o critério é atingido', async () => {
    // Uma resposta abaixo do mínimo: ainda sem medalha.
    await salvar({
      daily_tasks: resposta('a'),
      workplace_challenges: resposta('b'),
      relevant_experience: resposta('c')
    });
    expect(banco.linha?.completed_at).toBeNull();

    // A quarta resposta fecha o critério.
    const res = await salvar({ key_learnings: resposta('d') });

    expect(res.corpo.respondidas).toBe(MIN_RESPOSTAS_PARA_MEDALHA);
    expect(res.corpo.completed).toBe(true);
    expect(res.corpo.completedAt).not.toBeNull();
    expect(res.corpo.ganhouMedalha).toBe(true);
    expect(res.corpo.medalha?.codigo).toBe('CONTEXTO_COMPLETO');
  });

  it('não reescreve completed_at quando o aluno edita e segue completo', async () => {
    await salvar({
      daily_tasks: resposta('a'),
      workplace_challenges: resposta('b'),
      relevant_experience: resposta('c'),
      key_learnings: resposta('d')
    });
    const conquistadaEm = banco.linha?.completed_at;
    expect(conquistadaEm).toBeTruthy();

    // Edita um texto e ainda acrescenta uma resposta: a data original permanece.
    const res = await salvar({
      daily_tasks: resposta('a revisada'),
      course_connection: resposta('e')
    });

    expect(res.corpo.completedAt).toBe(conquistadaEm);
    expect(res.corpo.completed).toBe(true);
    expect(res.corpo.ganhouMedalha).toBe(false);
    expect(res.corpo.perdeuMedalha).toBe(false);
  });

  it('revoga a medalha se o aluno apagar respostas e cair abaixo do mínimo', async () => {
    await salvar({
      daily_tasks: resposta('a'),
      workplace_challenges: resposta('b'),
      relevant_experience: resposta('c'),
      key_learnings: resposta('d')
    });
    expect(banco.linha?.completed_at).toBeTruthy();

    const res = await salvar({ key_learnings: '', relevant_experience: '' });

    expect(res.corpo.respondidas).toBe(2);
    expect(res.corpo.completed).toBe(false);
    expect(res.corpo.completedAt).toBeNull();
    expect(res.corpo.perdeuMedalha).toBe(true);
    expect(res.corpo.medalha).toBeNull();
  });

  it('reconquista a medalha depois de revogada', async () => {
    await salvar({
      daily_tasks: resposta('a'),
      workplace_challenges: resposta('b'),
      relevant_experience: resposta('c'),
      key_learnings: resposta('d')
    });
    await salvar({ key_learnings: '', relevant_experience: '' });

    const res = await salvar({ key_learnings: resposta('d'), career_goals: resposta('f') });

    expect(res.corpo.completed).toBe(true);
    expect(res.corpo.ganhouMedalha).toBe(true);
  });
});

describe('leitura do contexto', () => {
  it('devolve o formulário vazio e o progresso zerado quando o aluno nunca respondeu', async () => {
    const res = resposta_();
    await getMeuContexto(requisicao({}), res);

    expect(res.corpo.existe).toBe(false);
    expect(res.corpo.respondidas).toBe(0);
    expect(res.corpo.completed).toBe(false);
    expect(res.corpo.totalPerguntas).toBe(TOTAL_PERGUNTAS_CONTEXTO);
    expect(res.corpo.minimoParaMedalha).toBe(MIN_RESPOSTAS_PARA_MEDALHA);
  });
});

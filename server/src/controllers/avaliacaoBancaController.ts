import { Response } from 'express';
import { timingSafeEqual } from 'crypto';
import { getAsync, queryAsync } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../services/audit';

// Perguntas do formulário da banca (as sete do formulário de julho + material de apoio),
// agrupadas nos critérios do PBL oral do Manual do Aluno (seção 6). Cada critério vale
// a média das suas perguntas (1 a 5) / 5 × peso: domínio do conteúdo 0,5; clareza e
// organização da exposição 0,3; qualidade do material de apoio 0,2; resposta à
// arguição 0,3 — total 1,3. "Trabalho em equipe" é registrado, mas não tem peso no
// manual. A presença na Expo UNIVC (0,2) completa o 1,5 e não é avaliada pela banca.
export const CRITERIOS_BANCA = [
  'score_clarity',
  'score_mastery',
  'score_solution',
  'score_coherence',
  'score_organization',
  'score_material',
  'score_questions',
  'score_teamwork'
] as const;
type Questao = (typeof CRITERIOS_BANCA)[number];
const GRUPOS_MANUAL: { peso: number; questoes: Questao[] }[] = [
  { peso: 0.5, questoes: ['score_mastery', 'score_solution', 'score_coherence'] }, // domínio do conteúdo
  { peso: 0.3, questoes: ['score_clarity', 'score_organization'] }, // clareza e organização da exposição
  { peso: 0.2, questoes: ['score_material'] }, // qualidade do material de apoio
  { peso: 0.3, questoes: ['score_questions'] } // resposta à arguição
];
export const NOTA_MAXIMA_BANCA = 1.3;

const STATUS_BANCA = ['approved', 'approved_with_notes', 'rejected'];

const SELECT_AVALIACAO = `
  SELECT ab.id, ab.grupo_id, g.nome AS grupo_nome, t.id AS turma_id, t.nome AS turma_nome,
         c.nome AS curso_nome, ab.avaliador_id,
         COALESCE(u.nome, ab.avaliador_nome) AS avaliador_nome,
         COALESCE(u.email, ab.avaliador_email) AS avaliador_email,
         CASE WHEN ab.avaliador_id IS NULL THEN 'publico' ELSE 'plataforma' END AS origem,
         TO_CHAR(ab.dia, 'YYYY-MM-DD') AS dia, ab.sala,
         ${CRITERIOS_BANCA.map((k) => `ab.${k}`).join(', ')},
         ab.pontos_fortes, ab.pontos_melhoria, ab.nao_contribuiram,
         ab.nota_final::float AS nota_final, ab.status, ab.criado_em, ab.atualizado_em
    FROM avaliacoes_banca ab
    JOIN grupos g ON g.id = ab.grupo_id
    JOIN turmas t ON t.id = g.turma_id
    LEFT JOIN cursos c ON c.id = t.curso_id
    LEFT JOIN usuarios u ON u.id = ab.avaliador_id`;

// Turmas e grupos participantes do PBL: grupos ativos com ao menos um aluno matriculado.
export async function listarGruposBanca(_req: AuthenticatedRequest, res: Response) {
  try {
    const grupos = await queryAsync(
      `SELECT g.id, g.nome, t.id AS turma_id, t.nome AS turma_nome, c.nome AS curso_nome,
              COUNT(DISTINCT m.usuario_id)::int AS alunos,
              STRING_AGG(DISTINCT u.nome, ', ' ORDER BY u.nome) AS integrantes
         FROM grupos g
         JOIN turmas t ON t.id = g.turma_id AND t.deletado_em IS NULL
         LEFT JOIN cursos c ON c.id = t.curso_id
         JOIN matriculas m ON m.grupo_id = g.id AND m.deletado_em IS NULL
         JOIN usuarios u ON u.id = m.usuario_id AND u.deletado_em IS NULL
        WHERE g.deletado_em IS NULL AND g.ativo = 1
        GROUP BY g.id, t.id, c.nome
        ORDER BY t.nome, g.nome`
    );
    return res.json(grupos);
  } catch (err) {
    console.error('Erro ao listar grupos da banca:', err);
    return res.status(500).json({ message: 'Erro ao listar grupos.' });
  }
}

const texto = (v: unknown, max = 2000) => {
  const s = typeof v === 'string' ? v.trim().slice(0, max) : '';
  return s || null;
};

type CorpoValidado = {
  grupoId: number;
  dia: string;
  sala: string | null;
  notas: number[];
  notaFinal: number | null;
  status: string;
  pontosFortes: string | null;
  pontosMelhoria: string | null;
  naoContribuiram: string | null;
};

// Validação comum ao formulário logado e ao público. Devolve a mensagem de erro (400/404) ou os dados.
async function validarCorpo(grupoIdBruto: unknown, body: any): Promise<{ erro: string; status: number } | CorpoValidado> {
  const grupoId = Number(grupoIdBruto);
  const grupo = Number.isInteger(grupoId)
    ? await getAsync<{ id: number }>('SELECT id FROM grupos WHERE id = ? AND deletado_em IS NULL AND ativo = 1', [grupoId])
    : undefined;
  if (!grupo) return { erro: 'Grupo não encontrado.', status: 404 };

  // Dia e sala da banca (escolha livre; sala nula = fora da programação).
  const dia = typeof body.dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dia) ? body.dia : null;
  if (!dia) return { erro: 'Selecione o dia da banca.', status: 400 };

  const notas: number[] = [];
  for (const k of CRITERIOS_BANCA) {
    const v = Number(body[k]);
    if (!Number.isInteger(v) || v < 1 || v > 5) return { erro: 'Avalie todos os critérios de 1 a 5.', status: 400 };
    notas.push(v);
  }

  if (!STATUS_BANCA.includes(body.status)) return { erro: 'Informe se o trabalho foi aprovado.', status: 400 };

  let notaFinal: number | null = null;
  if (body.nota_final !== undefined && body.nota_final !== null && body.nota_final !== '') {
    notaFinal = Number(String(body.nota_final).replace(',', '.'));
    if (!Number.isFinite(notaFinal) || notaFinal < 0 || notaFinal > NOTA_MAXIMA_BANCA) {
      return { erro: 'A nota final da banca deve ficar entre 0 e 1,3.', status: 400 };
    }
  }

  return {
    grupoId,
    dia,
    sala: texto(body.sala, 120),
    notas,
    notaFinal,
    status: body.status,
    pontosFortes: texto(body.pontos_fortes),
    pontosMelhoria: texto(body.pontos_melhoria),
    naoContribuiram: texto(body.nao_contribuiram)
  };
}

const COLUNAS_INSERT = `grupo_id, avaliador_id, avaliador_nome, avaliador_email, dia, sala, ${CRITERIOS_BANCA.join(', ')},
          pontos_fortes, pontos_melhoria, nao_contribuiram, nota_final, status`;
const SET_UPDATE = `dia = EXCLUDED.dia,
         sala = EXCLUDED.sala,
         avaliador_nome = EXCLUDED.avaliador_nome,
         ${CRITERIOS_BANCA.map((k) => `${k} = EXCLUDED.${k}`).join(', ')},
         pontos_fortes = EXCLUDED.pontos_fortes,
         pontos_melhoria = EXCLUDED.pontos_melhoria,
         nao_contribuiram = EXCLUDED.nao_contribuiram,
         nota_final = EXCLUDED.nota_final,
         status = EXCLUDED.status,
         atualizado_em = CURRENT_TIMESTAMP`;

async function gravar(
  v: CorpoValidado,
  avaliador: { id: number | null; nome: string | null; email: string | null }
): Promise<{ id: number; inserido: boolean } | undefined> {
  // Logado: uma avaliação por (grupo, usuário). Público: uma por (grupo, e-mail digitado).
  const conflito = avaliador.id
    ? 'ON CONFLICT (grupo_id, avaliador_id)'
    : 'ON CONFLICT (grupo_id, LOWER(avaliador_email)) WHERE avaliador_id IS NULL';
  return getAsync<{ id: number; inserido: boolean }>(
    `INSERT INTO avaliacoes_banca (${COLUNAS_INSERT})
     VALUES (${Array(6 + CRITERIOS_BANCA.length + 5).fill('?').join(', ')})
     ${conflito} DO UPDATE SET ${SET_UPDATE}
     RETURNING id, (xmax = 0) AS inserido`,
    [
      v.grupoId,
      avaliador.id,
      avaliador.nome,
      avaliador.email,
      v.dia,
      v.sala,
      ...v.notas,
      v.pontosFortes,
      v.pontosMelhoria,
      v.naoContribuiram,
      v.notaFinal,
      v.status
    ]
  );
}

// Conteúdo completo do envio na auditoria: o reenvio sobrescreve a avaliação,
// e a trilha guarda cada versão.
function detalhesAuditoria(v: CorpoValidado, gravado: { id: number; inserido: boolean } | undefined, extra: object) {
  return {
    operacao: gravado?.inserido ? 'CRIADA' : 'ATUALIZADA',
    grupoId: v.grupoId,
    dia: v.dia,
    sala: v.sala,
    notas: Object.fromEntries(CRITERIOS_BANCA.map((k, i) => [k, v.notas[i]])),
    notaSugerida: notaSugerida(v.notas),
    notaFinal: v.notaFinal,
    status: v.status,
    pontosFortes: v.pontosFortes,
    pontosMelhoria: v.pontosMelhoria,
    naoContribuiram: v.naoContribuiram,
    ...extra
  };
}

// --- Token do formulário público ---
let tokenEmCache: string | null = null;
async function tokenPublico(): Promise<string | null> {
  if (tokenEmCache) return tokenEmCache;
  const linha = await getAsync<{ token: string }>('SELECT token FROM banca_formulario_publico WHERE id = 1');
  tokenEmCache = linha?.token ?? null;
  return tokenEmCache;
}

async function tokenValido(recebido: unknown): Promise<boolean> {
  if (typeof recebido !== 'string' || !/^[0-9a-f]{32}$/.test(recebido)) return false;
  const esperado = await tokenPublico();
  if (!esperado) return false;
  return timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));
}

const LINK_INVALIDO = { message: 'Link do formulário inválido. Peça o link atualizado à coordenação.' };

// IP real de quem acessa. A API (Render) fica atrás do Cloudflare, que sobrescreve
// CF-Connecting-IP na entrada; sem ele, cai no primeiro X-Forwarded-For e no req.ip.
export function ipCliente(req: AuthenticatedRequest): string {
  const h = req.headers;
  const primeiro = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.split(',')[0]?.trim();
  return primeiro(h['cf-connecting-ip']) || primeiro(h['true-client-ip']) || primeiro(h['x-forwarded-for']) || req.ip || 'desconhecido';
}

const sessaoDe = (v: unknown) => (typeof v === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(v) ? v : null);

async function registrarEventoPublico(
  req: AuthenticatedRequest,
  evento: 'ACESSO' | 'IDENTIFICACAO' | 'ENVIO' | 'ACESSO_NEGADO',
  dados: { sessao?: string | null; email?: string | null; nome?: string | null; grupoId?: number | null; avaliacaoId?: number | null; detalhes?: object } = {}
) {
  try {
    const ua = req.headers['user-agent'];
    await queryAsync(
      `INSERT INTO banca_publica_auditoria (evento, sessao, email, nome, ip, user_agent, grupo_id, avaliacao_id, detalhes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        evento,
        dados.sessao ?? null,
        dados.email ?? null,
        dados.nome ?? null,
        ipCliente(req),
        typeof ua === 'string' ? ua.slice(0, 400) : null,
        dados.grupoId ?? null,
        dados.avaliacaoId ?? null,
        dados.detalhes ? JSON.stringify({ ...dados.detalhes, xForwardedFor: req.headers['x-forwarded-for'] ?? null }) : JSON.stringify({ xForwardedFor: req.headers['x-forwarded-for'] ?? null })
      ]
    );
  } catch (err) {
    // A auditoria nunca derruba o formulário.
    console.error('Falha ao registrar auditoria do link público da banca:', err);
  }
}

async function exigirToken(req: AuthenticatedRequest, res: Response, sessao: string | null): Promise<boolean> {
  if (await tokenValido(req.params.token)) return true;
  const t = typeof req.params.token === 'string' ? req.params.token : '';
  await registrarEventoPublico(req, 'ACESSO_NEGADO', { sessao, detalhes: { tokenInicio: t.slice(0, 6), rota: req.path } });
  res.status(404).json(LINK_INVALIDO);
  return false;
}

const validarIdentidade = (body: any): { erro: string } | { email: string; nome: string } => {
  const email = texto(body.avaliador_email, 255)?.toLowerCase() ?? null;
  const nome = texto(body.avaliador_nome, 120);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { erro: 'Informe um e-mail válido.' };
  if (!nome || nome.length < 2) return { erro: 'Informe o nome do(a) avaliador(a).' };
  return { email, nome };
};

// Abertura do link público: chamada pela página assim que carrega, antes da
// identificação — registra o acesso (IP real, navegador, horário) mesmo de quem
// desiste sem se identificar, e confere o token para a página avisar na hora.
export async function registrarAcessoPublico(req: AuthenticatedRequest, res: Response) {
  try {
    const sessao = sessaoDe((req.body || {}).sessao);
    if (!(await exigirToken(req, res, sessao))) return;
    await registrarEventoPublico(req, 'ACESSO', { sessao });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao registrar acesso ao link público da banca:', err);
    return res.status(500).json({ message: 'Erro ao abrir o formulário.' });
  }
}

// Identificação obrigatória antes de abrir o formulário público (registra e-mail e nome da visita).
export async function identificarAvaliadorPublico(req: AuthenticatedRequest, res: Response) {
  try {
    const body = req.body || {};
    const sessao = sessaoDe(body.sessao);
    if (!(await exigirToken(req, res, sessao))) return;
    const id = validarIdentidade(body);
    if ('erro' in id) return res.status(400).json({ message: id.erro });
    await registrarEventoPublico(req, 'IDENTIFICACAO', { sessao, email: id.email, nome: id.nome });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Erro na identificação do formulário público da banca:', err);
    return res.status(500).json({ message: 'Erro ao registrar a identificação.' });
  }
}

// Nota da banca (0 a 1,3): para cada critério do manual, média das suas perguntas / 5 × peso.
const notaSugerida = (notas: number[]) => {
  const valor = (q: Questao) => notas[CRITERIOS_BANCA.indexOf(q)];
  return Number(
    GRUPOS_MANUAL.reduce(
      (s, g) => s + (g.questoes.reduce((t, q) => t + valor(q), 0) / g.questoes.length / 5) * g.peso,
      0
    ).toFixed(2)
  );
};

export async function salvarAvaliacaoBanca(req: AuthenticatedRequest, res: Response) {
  try {
    const avaliadorId = req.user?.id;
    if (!avaliadorId) return res.status(401).json({ message: 'Não autenticado.' });

    const v = await validarCorpo(req.params.grupoId, req.body || {});
    if ('erro' in v) return res.status(v.status).json({ message: v.erro });

    const gravado = await gravar(v, { id: avaliadorId, nome: null, email: null });
    await logAudit(avaliadorId, 'AVALIAR_BANCA', 'avaliacoes_banca', gravado?.id,
      detalhesAuditoria(v, gravado, { origem: 'plataforma' }), ipCliente(req));
    return res.json({ id: gravado?.id, notaSugerida: notaSugerida(v.notas), message: 'Avaliação registrada.' });
  } catch (err) {
    console.error('Erro ao salvar avaliação da banca:', err);
    return res.status(500).json({ message: 'Erro ao salvar a avaliação.' });
  }
}

// Formulário público (sem login), no mesmo padrão do formulário de julho:
// o avaliador se identifica com e-mail e nome. Reenviar com o mesmo e-mail para o
// mesmo grupo atualiza a avaliação anterior.
export async function salvarAvaliacaoBancaPublica(req: AuthenticatedRequest, res: Response) {
  try {
    const body = req.body || {};
    const sessao = sessaoDe(body.sessao);
    if (!(await exigirToken(req, res, sessao))) return;
    const id = validarIdentidade(body);
    if ('erro' in id) return res.status(400).json({ message: id.erro });
    const { email, nome } = id;

    const v = await validarCorpo(body.grupo_id, body);
    if ('erro' in v) return res.status(v.status).json({ message: v.erro });

    const gravado = await gravar(v, { id: null, nome, email });
    const detalhes = detalhesAuditoria(v, gravado, { origem: 'publico', avaliadorEmail: email, avaliadorNome: nome });
    await registrarEventoPublico(req, 'ENVIO', { sessao, email, nome, grupoId: v.grupoId, avaliacaoId: gravado?.id ?? null, detalhes });
    await logAudit(null, 'AVALIAR_BANCA_PUBLICA', 'avaliacoes_banca', gravado?.id, detalhes, ipCliente(req));
    return res.json({ id: gravado?.id, notaSugerida: notaSugerida(v.notas), message: 'Avaliação registrada.' });
  } catch (err) {
    console.error('Erro ao salvar avaliação pública da banca:', err);
    return res.status(500).json({ message: 'Erro ao salvar a avaliação.' });
  }
}

export async function listarMinhasAvaliacoesBanca(req: AuthenticatedRequest, res: Response) {
  try {
    const rows = await queryAsync(
      `${SELECT_AVALIACAO} WHERE ab.avaliador_id = ? ORDER BY ab.atualizado_em DESC`,
      [req.user?.id]
    );
    return res.json(rows);
  } catch (err) {
    console.error('Erro ao listar avaliações da banca do avaliador:', err);
    return res.status(500).json({ message: 'Erro ao listar suas avaliações.' });
  }
}

export async function listarAvaliacoesBanca(_req: AuthenticatedRequest, res: Response) {
  try {
    const rows = await queryAsync(`${SELECT_AVALIACAO} ORDER BY ab.dia NULLS LAST, ab.sala, t.nome, g.nome, COALESCE(u.nome, ab.avaliador_nome)`);
    return res.json(rows);
  } catch (err) {
    console.error('Erro ao listar avaliações da banca:', err);
    return res.status(500).json({ message: 'Erro ao listar as avaliações.' });
  }
}

export async function listarGruposBancaPublico(req: AuthenticatedRequest, res: Response) {
  try {
    // O acesso já foi registrado na abertura da página (registrarAcessoPublico).
    const sessao = sessaoDe(req.query.sessao);
    if (!(await exigirToken(req, res, sessao))) return;
  } catch (err) {
    console.error('Erro ao validar o link público da banca:', err);
    return res.status(500).json({ message: 'Erro ao carregar o formulário.' });
  }
  // Inclui os nomes dos alunos para o avaliador conferir os integrantes do grupo.
  return listarGruposBanca(req, res);
}

// Admin: token atual do link público (para montar e copiar a URL no painel).
export async function obterLinkPublicoBanca(_req: AuthenticatedRequest, res: Response) {
  try {
    const token = await tokenPublico();
    if (!token) return res.status(404).json({ message: 'Link público ainda não gerado. Reinicie o servidor.' });
    return res.json({ token });
  } catch (err) {
    console.error('Erro ao obter o link público da banca:', err);
    return res.status(500).json({ message: 'Erro ao obter o link público.' });
  }
}

// Admin: auditoria do link público — acessos, identificações, envios e tentativas negadas.
// O e-mail de cada evento vem do próprio evento ou da identificação feita na mesma sessão.
export async function listarAuditoriaBancaPublica(_req: AuthenticatedRequest, res: Response) {
  try {
    const rows = await queryAsync(
      `SELECT a.id, a.evento, a.sessao, a.ip, a.user_agent, a.criado_em, a.avaliacao_id, a.detalhes,
              COALESCE(a.email, idf.email) AS email,
              COALESCE(a.nome, idf.nome) AS nome,
              g.nome AS grupo_nome, t.nome AS turma_nome
         FROM banca_publica_auditoria a
         LEFT JOIN LATERAL (
           SELECT i.email, i.nome FROM banca_publica_auditoria i
            WHERE a.sessao IS NOT NULL AND i.sessao = a.sessao AND i.email IS NOT NULL
            ORDER BY i.criado_em DESC LIMIT 1
         ) idf ON TRUE
         LEFT JOIN grupos g ON g.id = a.grupo_id
         LEFT JOIN turmas t ON t.id = g.turma_id
        ORDER BY a.criado_em DESC
        LIMIT 2000`
    );
    return res.json(rows);
  } catch (err) {
    console.error('Erro ao listar a auditoria do link público da banca:', err);
    return res.status(500).json({ message: 'Erro ao listar a auditoria.' });
  }
}

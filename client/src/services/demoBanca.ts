// Dados fictícios da Avaliação da Banca para o modo de demonstração (VITE_DEMO_MODE).
// As avaliações enviadas ficam no localStorage deste navegador, só para a demo.
import type { AvaliacaoBanca, GrupoBanca } from '../components/FormularioAvaliacaoBanca';
// Mesmo cálculo de notaBanca (critérios e pesos do manual), local para evitar ciclo de import com api.ts.
const notaBanca = (a: AvaliacaoBanca) =>
  Number(
    (((a.score_mastery + a.score_solution + a.score_coherence) / 3 / 5) * 0.5 +
      ((a.score_clarity + a.score_organization) / 2 / 5) * 0.3 +
      (a.score_material / 5) * 0.2 +
      (a.score_questions / 5) * 0.3).toFixed(2)
  );

const CHAVE = 'pbl_demo_avaliacoes_banca_v6';
const CHAVE_AUDITORIA = 'pbl_demo_auditoria_link_publico_v3';
/** Token fixo da demo: link público em #/banca/<este token>. */
export const TOKEN_DEMO = '0123456789abcdef0123456789abcdef';

const turmas = [
  { id: 4, nome: '2º Administração', curso: 'Administração', grupos: ['ADM-2 Marcopolo', 'ADM2 - LLER', 'ADM2-KA3', 'ADM2002'] },
  { id: 8, nome: '2º Agronomia', curso: 'Agronomia', grupos: ['AGRO_2026_42', 'AGRO002', 'AGRO2 - RMR', 'Engenheiros', 'Grupo agro 2026', 'Grupo da Lu-Agro', 'grupo pbl 2', 'SAROBA'] },
  { id: 12, nome: '2º Análise e Desenv. de Sistemas', curso: 'ADS', grupos: ['ADS Júnior', 'ADS2.Rodrigo', 'Escaladores', 'Grupo Alfa', 'grupo do enzo', 'Grupo Hotel', 'grupo kassio maria e luis', 'The box'] },
  { id: 14, nome: '2º Ciências Contábeis', curso: 'Ciências Contábeis', grupos: ['CC-18', 'CC2 CONTABILIDADE', 'Grupo', 'GRUPO CONTABEIS', 'Logos'] },
  { id: 19, nome: '2º Engenharia de Produção', curso: 'Engenharia de Produção', grupos: ['ENGPROD-2026/2', 'Grupo MJG', 'Núcleo de produção'] },
  { id: 21, nome: '2º Engenharia Mecânica', curso: 'Engenharia Mecânica', grupos: ['Engenheiros2.0', 'EngMec', 'ENGPROD-2026/2'] },
  { id: 5, nome: '4º Administração', curso: 'Administração', grupos: ['ADM04 - Divas e Eduardo', 'ADM4-MAL', 'Deborah e Cecília', 'LLER'] },
  { id: 9, nome: '4º Agronomia', curso: 'Agronomia', grupos: ['AGRO_2026_', 'Agro-04DSC', 'AGRO-4+', 'ENGAGRO01', 'Engkms-30', 'Grupo Cuiudo', 'GRUPOMEC-AGRO'] },
  { id: 13, nome: '4º Análise e Desenv. de Sistemas', curso: 'ADS', grupos: ['ADS4 Gopycha', 'ADS4ANGELI', 'ADS4techgroup', 'ADSDJ', 'Banana', 'GRUPO PBL DO MARCOS'] },
  { id: 15, nome: '4º Ciências Contábeis', curso: 'Ciências Contábeis', grupos: ['Grupo de CC 2 e 4'] },
  { id: 18, nome: '4º Comunicação Social', curso: 'Comunicação Social', grupos: ['Grupo PubliProp', 'PUBLI 6 - SHI', 'Publi4', 'PUBLI7'] },
  { id: 20, nome: '4º Engenharia de Produção', curso: 'Engenharia de Produção', grupos: ['Engenharia ProMec', 'Grupo 001'] },
  { id: 22, nome: '4º Engenharia Mecânica', curso: 'Engenharia Mecânica', grupos: ['Solução Planejada'] },
  { id: 6, nome: '6º Administração', curso: 'Administração', grupos: ['ADM6.1'] },
  { id: 10, nome: '6º Agronomia', curso: 'Agronomia', grupos: ['Agro sexto', 'GRUPO ANA, PEDRO E CARLOS', 'Trupe da laranja'] },
  { id: 16, nome: '6º Ciências Contábeis', curso: 'Ciências Contábeis', grupos: ['CC6', 'Grupo Quântico'] },
  { id: 11, nome: '8º Agronomia', curso: 'Agronomia', grupos: ['3A - Agro', 'Grupo agro 8', 'Grupo Agronomia'] },
  { id: 24, nome: '8º Engenharia Mecânica', curso: 'Engenharia Mecânica', grupos: ['Grupo mec', 'Tailor'] }
];

const nomes = ['Ana Souza', 'Bruno Lima', 'Carla Dias', 'Diego Rocha', 'Elisa Prado', 'Felipe Melo', 'Gabi Torres', 'Hugo Alves'];

const GRUPOS: GrupoBanca[] = turmas.flatMap((t, ti) =>
  t.grupos.map((nome, gi) => {
    const qtd = 3 + ((ti + gi) % 3);
    const integrantes = Array.from({ length: qtd }, (_, k) => nomes[(ti * 3 + gi + k) % nomes.length]);
    return {
      id: t.id * 100 + gi + 1,
      nome,
      turma_id: t.id,
      turma_nome: t.nome,
      curso_nome: t.curso,
      alunos: qtd,
      integrantes: integrantes.join(', ')
    };
  })
);

const AVALIADORES = [
  { id: 2, nome: 'Profa. Jussara Matos', email: 'prof.jussara@pbl.edu.br' },
  { id: 3, nome: 'Prof. Luciano Santos', email: 'prof.luciano@pbl.edu.br' },
  { id: 4, nome: 'Prof. Nilvans Silva', email: 'prof.nilvans@pbl.edu.br' }
];

function semente(): AvaliacaoBanca[] {
  const salaDe: Record<number, string> = { 4: 'Prédio C, Sala 04', 13: 'Prédio B, Sala 003', 14: 'Prédio B, Sala 009' };
  const exemplos: Array<[number, number, number[], number | null, AvaliacaoBanca['status'], string]> = [
    [401, 3, [5, 4, 4, 5, 4, 4, 4, 5], null, 'approved', 'Problema bem delimitado e dados da empresa.'],
    [401, 4, [4, 4, 5, 4, 3, 4, 4, 4], 1.1, 'approved', 'Boa proposta de solução.'],
    [402, 3, [3, 3, 4, 3, 3, 4, 2, 3], null, 'approved_with_notes', 'Tema relevante.'],
    [402, 4, [3, 2, 3, 3, 4, 4, 3, 3], 0.8, 'approved_with_notes', 'Slides organizados.'],
    [1301, 2, [5, 5, 5, 4, 5, 5, 5, 4], 1.3, 'approved', 'Protótipo funcionando na apresentação.'],
    [1302, 2, [2, 2, 3, 2, 3, 3, 2, 2], null, 'rejected', 'Equipe pontual.'],
    [1401, 2, [4, 4, 4, 4, 4, 4, 3, 4], null, 'approved', 'Domínio dos conceitos de custos.']
  ];
  return exemplos.map(([grupoId, avaliadorId, notas, notaFinal, status, fortes], i) => {
    const g = GRUPOS.find((x) => x.id === grupoId)!;
    const a = AVALIADORES.find((x) => x.id === avaliadorId)!;
    const quando = new Date(Date.UTC(2026, 10, 24, 22, 10 + i * 7)).toISOString();
    return {
      id: i + 1,
      grupo_id: g.id,
      grupo_nome: g.nome,
      turma_id: g.turma_id,
      turma_nome: g.turma_nome,
      curso_nome: g.curso_nome,
      avaliador_id: a.id,
      avaliador_nome: a.nome,
      avaliador_email: a.email,
      dia: '2026-11-24',
      sala: salaDe[g.turma_id] ?? null,
      score_clarity: notas[0],
      score_mastery: notas[1],
      score_solution: notas[2],
      score_coherence: notas[3],
      score_organization: notas[4],
      score_material: notas[5],
      score_questions: notas[6],
      score_teamwork: notas[7],
      pontos_fortes: fortes,
      pontos_melhoria: status === 'approved' ? null : 'Aprofundar a análise de viabilidade.',
      nao_contribuiram: status === 'rejected' ? 'Um integrante não apresentou.' : null,
      nota_final: notaFinal,
      status,
      criado_em: quando,
      atualizado_em: quando
    };
  });
}

function carregar(): AvaliacaoBanca[] {
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (salvo) return JSON.parse(salvo);
  } catch {
    /* sem localStorage: usa a semente */
  }
  return semente();
}

function gravar(lista: AvaliacaoBanca[]) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch {
    /* demo: segue só em memória */
  }
}

function usuarioAtual() {
  try {
    const u = JSON.parse(localStorage.getItem('pbl_user_data') || '{}');
    return { id: Number(u.id) || 999, nome: u.nome || 'Avaliador(a) demo', email: u.email || 'demo@pbl.edu.br' };
  } catch {
    return { id: 999, nome: 'Avaliador(a) demo', email: 'demo@pbl.edu.br' };
  }
}

/** Responde as rotas /banca/* no modo demo; devolve undefined para outras rotas. */
export function responderBancaDemo(endpoint: string, options: RequestInit): unknown {
  const metodo = (options.method || 'GET').toUpperCase();
  const [caminho, query = ''] = endpoint.split('?');
  // Formulário público: token conferido, sem nomes de alunos e com auditoria do link.
  const pub = caminho.match(/^\/public\/banca\/([0-9a-f]{32})\/(grupos|identificacao|avaliacao)$/);
  if (pub) {
    const body = metodo === 'POST' ? JSON.parse(String(options.body || '{}')) : {};
    const sessao = body.sessao ?? new URLSearchParams(query).get('sessao');
    if (pub[1] !== TOKEN_DEMO) {
      registrarEvento({ evento: 'ACESSO_NEGADO', sessao, detalhes: { tokenInicio: pub[1].slice(0, 6) } });
      throw new Error('Link do formulário inválido. Peça o link atualizado à coordenação.');
    }
    if (pub[2] === 'grupos') {
      registrarEvento({ evento: 'ACESSO', sessao });
      return GRUPOS.map(({ integrantes, ...g }) => ({ ...g, integrantes: null }));
    }
    const email = String(body.avaliador_email || '').trim().toLowerCase();
    const nome = String(body.avaliador_nome || '').trim();
    if (pub[2] === 'identificacao') {
      registrarEvento({ evento: 'IDENTIFICACAO', sessao, email, nome });
      return { ok: true };
    }
    const r = salvarDemo(Number(body.grupo_id), body, { id: null, nome, email });
    const a = carregar().find((x) => x.id === r.id)!;
    registrarEvento({
      evento: 'ENVIO', sessao, email, nome, grupo_nome: a.grupo_nome, turma_nome: a.turma_nome, avaliacao_id: a.id,
      detalhes: detalhesDe(a, r.operacao)
    });
    return r;
  }
  if (!endpoint.startsWith('/banca/')) return undefined;

  if (endpoint === '/banca/grupos') return GRUPOS;
  if (endpoint === '/banca/link-publico') return { token: TOKEN_DEMO };
  if (endpoint === '/banca/auditoria-publica') return carregarAuditoria();
  if (endpoint === '/banca/avaliacoes') return carregar();
  if (endpoint === '/banca/minhas') {
    const eu = usuarioAtual();
    return carregar()
      .filter((a) => a.avaliador_id === eu.id)
      .sort((x, y) => y.atualizado_em.localeCompare(x.atualizado_em));
  }

  const m = endpoint.match(/^\/banca\/grupos\/(\d+)\/avaliacao$/);
  if (m && metodo === 'PUT') {
    return salvarDemo(Number(m[1]), JSON.parse(String(options.body || '{}')), usuarioAtual());
  }

  throw new Error('Rota de demonstração da banca não encontrada.');
}

function salvarDemo(
  grupoId: number,
  body: any,
  avaliador: { id: number | null; nome: string; email: string }
) {
  const g = GRUPOS.find((x) => x.id === grupoId);
  if (!g) throw new Error('Grupo não encontrado.');
  const lista = carregar();
  const agora = new Date().toISOString();
  // Logado: uma avaliação por (grupo, usuário). Público: uma por (grupo, e-mail).
  const existente = lista.find((a) =>
    a.grupo_id === g.id &&
    (avaliador.id != null ? a.avaliador_id === avaliador.id : a.origem === 'publico' && a.avaliador_email === avaliador.email)
  );
  const notaFinal = body.nota_final == null || body.nota_final === '' ? null : Number(body.nota_final);
  const nova: AvaliacaoBanca = {
    id: existente?.id ?? Math.max(0, ...lista.map((a) => a.id)) + 1,
    grupo_id: g.id,
    grupo_nome: g.nome,
    turma_id: g.turma_id,
    turma_nome: g.turma_nome,
    curso_nome: g.curso_nome,
    avaliador_id: avaliador.id,
    avaliador_nome: avaliador.nome,
    avaliador_email: avaliador.email,
    origem: avaliador.id != null ? 'plataforma' : 'publico',
    dia: body.dia ?? null,
    sala: body.sala ?? null,
    score_clarity: Number(body.score_clarity),
    score_mastery: Number(body.score_mastery),
    score_solution: Number(body.score_solution),
    score_coherence: Number(body.score_coherence),
    score_organization: Number(body.score_organization),
    score_material: Number(body.score_material),
    score_questions: Number(body.score_questions),
    score_teamwork: Number(body.score_teamwork),
    pontos_fortes: body.pontos_fortes?.trim() || null,
    pontos_melhoria: body.pontos_melhoria?.trim() || null,
    nao_contribuiram: body.nao_contribuiram?.trim() || null,
    nota_final: notaFinal,
    status: body.status,
    criado_em: existente?.criado_em ?? agora,
    atualizado_em: agora
  };
  gravar(existente ? lista.map((a) => (a.id === existente.id ? nova : a)) : [...lista, nova]);
  return { id: nova.id, operacao: (existente ? 'ATUALIZADA' : 'CRIADA') as 'CRIADA' | 'ATUALIZADA', message: 'Demonstração: avaliação salva só neste navegador.', demo: true };
}

function detalhesDe(a: AvaliacaoBanca, operacao: 'CRIADA' | 'ATUALIZADA') {
  return {
    operacao,
    dia: a.dia,
    sala: a.sala,
    notas: {
      score_clarity: a.score_clarity, score_mastery: a.score_mastery, score_solution: a.score_solution,
      score_coherence: a.score_coherence, score_organization: a.score_organization, score_material: a.score_material,
      score_questions: a.score_questions, score_teamwork: a.score_teamwork
    },
    notaSugerida: notaBanca(a),
    notaFinal: a.nota_final,
    status: a.status,
    pontosFortes: a.pontos_fortes,
    pontosMelhoria: a.pontos_melhoria,
    naoContribuiram: a.nao_contribuiram
  };
}

type EventoDemo = {
  id: number; evento: string; sessao: string | null; email: string | null; nome: string | null; ip: string;
  user_agent: string; criado_em: string; avaliacao_id: number | null; grupo_nome: string | null;
  turma_nome: string | null; detalhes: object | null;
};

function carregarAuditoria(): EventoDemo[] {
  try {
    const salvo = localStorage.getItem(CHAVE_AUDITORIA);
    if (salvo) return JSON.parse(salvo);
  } catch {
    /* sem localStorage */
  }
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
  const base = { ip: '177.10.20.30', user_agent: ua, avaliacao_id: null, grupo_nome: null, turma_nome: null, detalhes: null };
  return [
    { ...base, id: 3, evento: 'ACESSO_NEGADO', sessao: 'demo-sessao-2', email: null, nome: null, ip: '45.6.7.8', criado_em: '2026-11-24T22:40:00.000Z', detalhes: { tokenInicio: 'aaaaaa' } },
    { ...base, id: 2, evento: 'IDENTIFICACAO', sessao: 'demo-sessao-1', email: 'avaliadora.externa@ivc.br', nome: 'Avaliadora Externa', criado_em: '2026-11-24T22:21:00.000Z' },
    { ...base, id: 1, evento: 'ACESSO', sessao: 'demo-sessao-1', email: 'avaliadora.externa@ivc.br', nome: 'Avaliadora Externa', criado_em: '2026-11-24T22:20:00.000Z' }
  ];
}

function registrarEvento(e: Partial<EventoDemo> & { evento: string }) {
  const atual = carregarAuditoria();
  // Na demo, o e-mail da sessão é preenchido como o servidor faz (pela identificação da mesma visita).
  const idf = atual.find((x) => x.sessao && x.sessao === e.sessao && x.email);
  const novo: EventoDemo = {
    id: Math.max(0, ...atual.map((r) => r.id)) + 1,
    sessao: null, email: idf?.email ?? null, nome: idf?.nome ?? null, ip: '127.0.0.1',
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    criado_em: new Date().toISOString(), avaliacao_id: null, grupo_nome: null, turma_nome: null, detalhes: null,
    ...Object.fromEntries(Object.entries(e).filter(([, v]) => v !== undefined && v !== '')),
  } as EventoDemo;
  try {
    localStorage.setItem(CHAVE_AUDITORIA, JSON.stringify([novo, ...atual]));
  } catch {
    /* demo sem persistência */
  }
}

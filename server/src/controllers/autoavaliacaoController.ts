import { Response } from 'express';
import { queryAsync, runAsync, getAsync } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

interface JanelaRow {
  id: number;
  rodada: number;
  titulo: string;
  abre_em: string;
  fecha_em: string;
}

type StatusJanela = 'ABERTA' | 'FUTURA' | 'ENCERRADA';

function formatarDataHoraBR(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function statusDaJanela(janela: JanelaRow, agora: Date): StatusJanela {
  const abre = new Date(janela.abre_em);
  const fecha = new Date(janela.fecha_em);
  if (agora < abre) return 'FUTURA';
  if (agora > fecha) return 'ENCERRADA';
  return 'ABERTA';
}

/**
 * A rodada "corrente" é a mais próxima que ainda não fechou (aberta ou
 * futura); se todas já fecharam, cai na última encerrada — assim o portal
 * sempre tem algo para mostrar (mesmo que seja "prazo encerrado"), em vez de
 * uma tela em branco entre o fim de uma rodada e o cadastro da próxima.
 */
async function resolverJanelaCorrente(janelaId?: number): Promise<JanelaRow | undefined> {
  if (janelaId) {
    return getAsync<JanelaRow>(`SELECT * FROM autoavaliacao_janelas WHERE id = ?`, [janelaId]);
  }
  const proxima = await getAsync<JanelaRow>(
    `SELECT * FROM autoavaliacao_janelas WHERE fecha_em >= CURRENT_TIMESTAMP ORDER BY abre_em ASC LIMIT 1`
  );
  if (proxima) return proxima;
  return getAsync<JanelaRow>(`SELECT * FROM autoavaliacao_janelas ORDER BY fecha_em DESC LIMIT 1`);
}

/** Lista todas as rodadas cadastradas — alimenta o seletor de rodada nas telas de revisão. */
export async function listarJanelas(_req: AuthenticatedRequest, res: Response) {
  try {
    const janelas = await queryAsync<JanelaRow>(`SELECT * FROM autoavaliacao_janelas ORDER BY abre_em ASC`);
    const agora = new Date();
    return res.json(
      janelas.map((j) => ({
        id: j.id,
        rodada: j.rodada,
        titulo: j.titulo,
        abreEm: j.abre_em,
        fechaEm: j.fecha_em,
        status: statusDaJanela(j, agora)
      }))
    );
  } catch (err) {
    console.error('Erro ao listar janelas de autoavaliação:', err);
    return res.status(500).json({ message: 'Erro ao listar as rodadas de autoavaliação.' });
  }
}

/** Qualquer autenticado: a rodada corrente e se está aberta agora — usado pelo portal do aluno. */
export async function getJanelaAtual(req: AuthenticatedRequest, res: Response) {
  try {
    const janelaId = req.query.janelaId ? Number(req.query.janelaId) : undefined;
    const janela = await resolverJanelaCorrente(janelaId);
    if (!janela) {
      return res.json({ janela: null, status: 'INEXISTENTE' as const });
    }
    return res.json({
      janela: {
        id: janela.id,
        rodada: janela.rodada,
        titulo: janela.titulo,
        abreEm: janela.abre_em,
        fechaEm: janela.fecha_em
      },
      status: statusDaJanela(janela, new Date())
    });
  } catch (err) {
    console.error('Erro ao consultar a janela de autoavaliação:', err);
    return res.status(500).json({ message: 'Erro ao consultar o prazo da autoavaliação.' });
  }
}

/**
 * ALUNO: uma entrada por matrícula ativa com grupo definido, com os colegas do
 * grupo (todos, menos o próprio aluno) e a nota que ele já deu a cada um na
 * rodada corrente, se houver.
 */
export async function getMeuGrupoParaAvaliar(req: AuthenticatedRequest, res: Response) {
  try {
    const alunoId = req.user?.id;
    if (!alunoId) return res.status(401).json({ message: 'Não autenticado.' });

    const janela = await resolverJanelaCorrente();
    if (!janela) {
      return res.json({ janela: null, status: 'INEXISTENTE', turmas: [] });
    }
    const status = statusDaJanela(janela, new Date());

    const matriculas = await queryAsync<{
      turma_id: number;
      turma_nome: string;
      grupo_id: number;
      grupo_nome: string;
    }>(
      `SELECT m.turma_id, t.nome as turma_nome, g.id as grupo_id, g.nome as grupo_nome
         FROM matriculas m
         JOIN turmas t ON m.turma_id = t.id AND t.deletado_em IS NULL
         JOIN grupos g ON m.grupo_id = g.id AND g.deletado_em IS NULL
        WHERE m.usuario_id = ? AND m.deletado_em IS NULL
        ORDER BY t.nome ASC`,
      [alunoId]
    );

    const turmas = await Promise.all(
      matriculas.map(async (m) => {
        const colegas = await queryAsync<{ id: number; nome: string; nota: number | null }>(
          `SELECT u.id, u.nome,
                  (SELECT a.nota FROM autoavaliacoes a
                    WHERE a.janela_id = ? AND a.avaliador_id = ? AND a.avaliado_id = u.id) as nota
             FROM matriculas mm
             JOIN usuarios u ON mm.usuario_id = u.id AND u.deletado_em IS NULL
            WHERE mm.grupo_id = ? AND mm.deletado_em IS NULL AND mm.usuario_id != ?
            ORDER BY u.nome ASC`,
          [janela.id, alunoId, m.grupo_id, alunoId]
        );
        return {
          turmaId: m.turma_id,
          turmaNome: m.turma_nome,
          grupoId: m.grupo_id,
          grupoNome: m.grupo_nome,
          colegas: colegas.map((c) => ({ id: c.id, nome: c.nome, nota: c.nota })),
          completo: colegas.length > 0 && colegas.every((c) => c.nota !== null)
        };
      })
    );

    return res.json({
      janela: {
        id: janela.id,
        rodada: janela.rodada,
        titulo: janela.titulo,
        abreEm: janela.abre_em,
        fechaEm: janela.fecha_em
      },
      status,
      turmas
    });
  } catch (err) {
    console.error('Erro ao carregar o grupo para autoavaliação:', err);
    return res.status(500).json({ message: 'Erro ao carregar os dados da sua autoavaliação.' });
  }
}

/**
 * ALUNO: grava (ou atualiza) as notas dadas aos colegas de UM grupo, na rodada
 * corrente. Recusa fora da janela e recusa notas para quem não é (mais)
 * colega do mesmo grupo — o aluno só avalia quem está com ele agora.
 */
export async function salvarAvaliacoes(req: AuthenticatedRequest, res: Response) {
  try {
    const alunoId = req.user?.id;
    if (!alunoId) return res.status(401).json({ message: 'Não autenticado.' });

    const { grupoId, notas } = req.body as { grupoId?: number; notas?: Record<string, number> };
    if (!grupoId || !notas || typeof notas !== 'object') {
      return res.status(400).json({ message: 'Informe o grupo e as notas dos colegas.' });
    }

    const janela = await resolverJanelaCorrente();
    if (!janela) return res.status(404).json({ message: 'Nenhuma rodada de autoavaliação está cadastrada.' });

    // O servidor é a autoridade sobre o prazo — mesmo que a tela do aluno já
    // esconda o formulário fora da janela, esta checagem impede o envio via
    // requisição direta antes de abrir ou depois de fechado.
    const statusAtual = statusDaJanela(janela, new Date());
    if (statusAtual !== 'ABERTA') {
      const abre = formatarDataHoraBR(janela.abre_em);
      const fecha = formatarDataHoraBR(janela.fecha_em);
      const mensagem =
        statusAtual === 'FUTURA'
          ? `A "${janela.titulo}" ainda não abriu. O período de resposta vai de ${abre} até ${fecha}.`
          : `A "${janela.titulo}" já foi encerrada. O período de resposta foi de ${abre} até ${fecha}.`;
      return res.status(403).json({
        codigo: statusAtual === 'FUTURA' ? 'JANELA_AINDA_NAO_ABERTA' : 'JANELA_ENCERRADA',
        message: mensagem
      });
    }

    const minhaMatricula = await getAsync<{ id: number }>(
      `SELECT id FROM matriculas
        WHERE usuario_id = ? AND grupo_id = ? AND deletado_em IS NULL`,
      [alunoId, grupoId]
    );
    if (!minhaMatricula) {
      return res.status(403).json({ message: 'Você não pertence a este grupo.' });
    }

    const colegas = await queryAsync<{ usuario_id: number }>(
      `SELECT usuario_id FROM matriculas
        WHERE grupo_id = ? AND deletado_em IS NULL AND usuario_id != ?`,
      [grupoId, alunoId]
    );
    const idsColegas = new Set(colegas.map((c) => c.usuario_id));

    const entradas = Object.entries(notas);
    for (const [avaliadoIdStr, notaRaw] of entradas) {
      const avaliadoId = Number(avaliadoIdStr);
      const nota = Number(notaRaw);
      if (!idsColegas.has(avaliadoId)) {
        return res.status(400).json({ message: 'Só é possível avaliar quem está no seu grupo atualmente.' });
      }
      if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
        return res.status(400).json({ message: 'Cada avaliação vai de 1 a 5 estrelas.' });
      }
    }

    for (const [avaliadoIdStr, notaRaw] of entradas) {
      const avaliadoId = Number(avaliadoIdStr);
      const nota = Number(notaRaw);
      await runAsync(
        `INSERT INTO autoavaliacoes (janela_id, grupo_id, avaliador_id, avaliado_id, nota)
              VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (janela_id, avaliador_id, avaliado_id)
         DO UPDATE SET nota = EXCLUDED.nota, grupo_id = EXCLUDED.grupo_id, atualizado_em = CURRENT_TIMESTAMP`,
        [janela.id, grupoId, alunoId, avaliadoId, nota]
      );
    }

    return res.json({ message: 'Autoavaliação registrada com sucesso.' });
  } catch (err) {
    console.error('Erro ao salvar autoavaliação:', err);
    return res.status(500).json({ message: 'Erro ao salvar sua autoavaliação.' });
  }
}

/**
 * ADMIN/PROFESSOR: panorama de quem já fez a autoavaliação, por aluno e por
 * grupo, na rodada informada (ou na corrente). Segue o mesmo recorte de
 * `listarContextos`: a coordenação vê a instituição inteira, o docente só os
 * alunos das turmas que leciona. A tela filtra por curso/turma/grupo em cima
 * deste payload único.
 */
export async function listarStatusAutoavaliacao(req: AuthenticatedRequest, res: Response) {
  try {
    const janelaId = req.query.janelaId ? Number(req.query.janelaId) : undefined;
    const janela = await resolverJanelaCorrente(janelaId);
    if (!janela) {
      return res.json({ janela: null, status: 'INEXISTENTE', alunos: [] });
    }

    const condicoes: string[] = ['u.deletado_em IS NULL', 'm.deletado_em IS NULL', "p.nome = 'ALUNO'", 'g.id IS NOT NULL'];
    const params: any[] = [];

    if (req.user?.perfilNome === 'PROFESSOR') {
      condicoes.push(
        `m.turma_id IN (
           SELECT vp.turma_id FROM vinculos_professores vp
            WHERE vp.usuario_id = ? AND vp.ativo = 1
         )`
      );
      params.push(req.user.id);
    }

    const linhas = await queryAsync<any>(
      `SELECT DISTINCT ON (u.id)
              u.id, u.nome, u.email,
              c.id as curso_id, c.nome as curso_nome,
              t.id as turma_id, t.nome as turma_nome,
              g.id as grupo_id, g.nome as grupo_nome
         FROM matriculas m
         JOIN usuarios u ON m.usuario_id = u.id
         JOIN perfis p ON u.perfil_id = p.id
         JOIN turmas t ON m.turma_id = t.id AND t.deletado_em IS NULL
         JOIN cursos c ON t.curso_id = c.id
         JOIN grupos g ON m.grupo_id = g.id AND g.deletado_em IS NULL
        WHERE ${condicoes.join(' AND ')}
        ORDER BY u.id, m.criado_em DESC`,
      params
    );

    const membrosPorGrupo = new Map<number, number[]>();
    linhas.forEach((l) => {
      const lista = membrosPorGrupo.get(l.grupo_id) || [];
      lista.push(l.id);
      membrosPorGrupo.set(l.grupo_id, lista);
    });

    const avaliacoes = await queryAsync<{ avaliador_id: number; avaliado_id: number; nota: number }>(
      `SELECT avaliador_id, avaliado_id, nota FROM autoavaliacoes WHERE janela_id = ?`,
      [janela.id]
    );
    const dadasPor = new Map<number, Map<number, number>>();
    const recebidasPor = new Map<number, number[]>();
    avaliacoes.forEach((a) => {
      if (!dadasPor.has(a.avaliador_id)) dadasPor.set(a.avaliador_id, new Map());
      dadasPor.get(a.avaliador_id)!.set(a.avaliado_id, a.nota);
      const lista = recebidasPor.get(a.avaliado_id) || [];
      lista.push(a.nota);
      recebidasPor.set(a.avaliado_id, lista);
    });

    const alunos = linhas.map((l) => {
      const colegas = (membrosPorGrupo.get(l.grupo_id) || []).filter((id) => id !== l.id);
      const notasDadasMap = dadasPor.get(l.id) || new Map();
      const notasDadas = colegas.filter((id) => notasDadasMap.has(id)).length;
      const notasRecebidas = recebidasPor.get(l.id) || [];
      const mediaRecebida = notasRecebidas.length
        ? notasRecebidas.reduce((soma, n) => soma + n, 0) / notasRecebidas.length
        : null;

      return {
        id: l.id,
        nome: l.nome,
        email: l.email,
        cursoId: l.curso_id,
        cursoNome: l.curso_nome,
        turmaId: l.turma_id,
        turmaNome: l.turma_nome,
        grupoId: l.grupo_id,
        grupoNome: l.grupo_nome,
        totalColegas: colegas.length,
        notasDadas,
        completo: colegas.length === 0 || notasDadas === colegas.length,
        totalNotasRecebidas: notasRecebidas.length,
        mediaRecebida
      };
    });

    return res.json({
      janela: {
        id: janela.id,
        rodada: janela.rodada,
        titulo: janela.titulo,
        abreEm: janela.abre_em,
        fechaEm: janela.fecha_em
      },
      status: statusDaJanela(janela, new Date()),
      alunos
    });
  } catch (err) {
    console.error('Erro ao listar status da autoavaliação:', err);
    return res.status(500).json({ message: 'Erro ao carregar o panorama da autoavaliação.' });
  }
}

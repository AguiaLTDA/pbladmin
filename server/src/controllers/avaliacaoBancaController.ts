import { Response } from 'express';
import { getAsync, queryAsync } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../services/audit';

// Formulário de avaliação da banca do PBL oral (o mesmo usado nas bancas de julho).
export const CRITERIOS_BANCA = [
  'score_clarity',
  'score_mastery',
  'score_solution',
  'score_coherence',
  'score_organization',
  'score_questions',
  'score_teamwork'
] as const;

const STATUS_BANCA = ['approved', 'approved_with_notes', 'rejected'];

const SELECT_AVALIACAO = `
  SELECT ab.id, ab.grupo_id, g.nome AS grupo_nome, t.id AS turma_id, t.nome AS turma_nome,
         c.nome AS curso_nome, ab.avaliador_id, u.nome AS avaliador_nome, u.email AS avaliador_email,
         TO_CHAR(ab.dia, 'YYYY-MM-DD') AS dia, ab.sala,
         ${CRITERIOS_BANCA.map((k) => `ab.${k}`).join(', ')},
         ab.pontos_fortes, ab.pontos_melhoria, ab.nao_contribuiram,
         ab.nota_final::float AS nota_final, ab.status, ab.criado_em, ab.atualizado_em
    FROM avaliacoes_banca ab
    JOIN grupos g ON g.id = ab.grupo_id
    JOIN turmas t ON t.id = g.turma_id
    LEFT JOIN cursos c ON c.id = t.curso_id
    JOIN usuarios u ON u.id = ab.avaliador_id`;

// Turmas e grupos participantes do PBL: grupos ativos com ao menos um aluno matriculado.
export async function listarGruposBanca(_req: AuthenticatedRequest, res: Response) {
  try {
    const grupos = await queryAsync(
      `SELECT g.id, g.nome, t.id AS turma_id, t.nome AS turma_nome, c.nome AS curso_nome,
              COUNT(DISTINCT m.usuario_id)::int AS alunos,
              STRING_AGG(DISTINCT u.nome, ', ') AS integrantes
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

export async function salvarAvaliacaoBanca(req: AuthenticatedRequest, res: Response) {
  try {
    const avaliadorId = req.user?.id;
    if (!avaliadorId) return res.status(401).json({ message: 'Não autenticado.' });

    const grupoId = Number(req.params.grupoId);
    const body = req.body || {};

    const grupo = await getAsync<{ id: number }>(
      'SELECT id FROM grupos WHERE id = ? AND deletado_em IS NULL AND ativo = 1',
      [grupoId]
    );
    if (!grupo) return res.status(404).json({ message: 'Grupo não encontrado.' });

    const notas: number[] = [];
    for (const k of CRITERIOS_BANCA) {
      const v = Number(body[k]);
      if (!Number.isInteger(v) || v < 1 || v > 5) {
        return res.status(400).json({ message: 'Avalie todos os critérios de 1 a 5.' });
      }
      notas.push(v);
    }

    if (!STATUS_BANCA.includes(body.status)) {
      return res.status(400).json({ message: 'Informe se o trabalho foi aprovado.' });
    }

    let notaFinal: number | null = null;
    if (body.nota_final !== undefined && body.nota_final !== null && body.nota_final !== '') {
      notaFinal = Number(String(body.nota_final).replace(',', '.'));
      if (!Number.isFinite(notaFinal) || notaFinal < 0 || notaFinal > 1.5) {
        return res.status(400).json({ message: 'A nota final deve ficar entre 0 e 1,5.' });
      }
    }

    const texto = (v: unknown, max = 2000) => {
      const s = typeof v === 'string' ? v.trim().slice(0, max) : '';
      return s || null;
    };

    // Dia e sala da banca (o professor escolhe livremente; sala nula = fora da programação).
    const dia = typeof body.dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dia) ? body.dia : null;
    if (!dia) return res.status(400).json({ message: 'Selecione o dia da banca.' });
    const sala = texto(body.sala, 120);

    const linha = await getAsync<{ id: number }>(
      `INSERT INTO avaliacoes_banca
         (grupo_id, avaliador_id, dia, sala, ${CRITERIOS_BANCA.join(', ')},
          pontos_fortes, pontos_melhoria, nao_contribuiram, nota_final, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (grupo_id, avaliador_id) DO UPDATE SET
         dia = EXCLUDED.dia,
         sala = EXCLUDED.sala,
         ${CRITERIOS_BANCA.map((k) => `${k} = EXCLUDED.${k}`).join(', ')},
         pontos_fortes = EXCLUDED.pontos_fortes,
         pontos_melhoria = EXCLUDED.pontos_melhoria,
         nao_contribuiram = EXCLUDED.nao_contribuiram,
         nota_final = EXCLUDED.nota_final,
         status = EXCLUDED.status,
         atualizado_em = CURRENT_TIMESTAMP
       RETURNING id`,
      [
        grupoId,
        avaliadorId,
        dia,
        sala,
        ...notas,
        texto(body.pontos_fortes),
        texto(body.pontos_melhoria),
        texto(body.nao_contribuiram),
        notaFinal,
        body.status
      ]
    );

    const media = notas.reduce((s, n) => s + n, 0) / notas.length;
    await logAudit(avaliadorId, 'AVALIAR_BANCA', 'avaliacoes_banca', linha?.id, {
      grupoId,
      dia,
      sala,
      media: Number(media.toFixed(2)),
      notaFinal,
      status: body.status
    });

    return res.json({ id: linha?.id, notaSugerida: Number((media * 0.3).toFixed(2)), message: 'Avaliação registrada.' });
  } catch (err) {
    console.error('Erro ao salvar avaliação da banca:', err);
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
    const rows = await queryAsync(`${SELECT_AVALIACAO} ORDER BY ab.dia NULLS LAST, ab.sala, t.nome, g.nome, u.nome`);
    return res.json(rows);
  } catch (err) {
    console.error('Erro ao listar avaliações da banca:', err);
    return res.status(500).json({ message: 'Erro ao listar as avaliações.' });
  }
}

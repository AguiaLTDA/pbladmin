import { Response } from 'express';
import { getAsync, runAsync } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../services/audit';
import {
  CAMPOS_CONTEXTO,
  CAMPOS_TEXTO_CONTEXTO,
  MEDALHA_CONTEXTO_COMPLETO,
  MIN_CARACTERES_RESPOSTA,
  MIN_RESPOSTAS_PARA_MEDALHA,
  TAMANHOS_EMPRESA,
  TOTAL_PERGUNTAS_CONTEXTO,
  contarRespostas,
  contextoEstaCompleto
} from '../config/contextoAluno';

interface LinhaContexto {
  id: number;
  usuario_id: number;
  completed_at: string | null;
  [campo: string]: any;
}

/**
 * Formato devolvido ao cliente: as respostas mais o que a interface precisa
 * para desenhar o progresso e a medalha, já calculado aqui para que servidor e
 * tela nunca discordem sobre o que é "completo".
 */
function montarResposta(linha: LinhaContexto | undefined, usuarioId: number) {
  const respondidas = contarRespostas(linha);
  const completo = !!linha?.completed_at;

  return {
    usuarioId,
    existe: !!linha,
    workSector: linha?.work_sector ?? null,
    companySize: linha?.company_size ?? null,
    dailyTasks: linha?.daily_tasks ?? '',
    workplaceChallenges: linha?.workplace_challenges ?? '',
    relevantExperience: linha?.relevant_experience ?? '',
    keyLearnings: linha?.key_learnings ?? '',
    courseConnection: linha?.course_connection ?? '',
    careerGoals: linha?.career_goals ?? '',
    completed: completo,
    completedAt: linha?.completed_at ?? null,
    respondidas,
    totalPerguntas: TOTAL_PERGUNTAS_CONTEXTO,
    minimoParaMedalha: MIN_RESPOSTAS_PARA_MEDALHA,
    minimoCaracteres: MIN_CARACTERES_RESPOSTA,
    medalha: completo ? MEDALHA_CONTEXTO_COMPLETO : null
  };
}

async function buscarLinha(usuarioId: number) {
  return getAsync<LinhaContexto>('SELECT * FROM contexto_aluno WHERE usuario_id = ?', [usuarioId]);
}

/**
 * Normaliza o corpo da requisição: só as colunas conhecidas passam, string
 * vazia vira NULL e o resto é ignorado em silêncio. Como todas as perguntas são
 * opcionais, não há campo obrigatório a validar — o que precisa de trava é o
 * `company_size`, que alimenta um select fechado.
 */
function extrairCampos(body: any): { valores: Record<string, string | null>; erro?: string } {
  const valores: Record<string, string | null> = {};

  for (const campo of CAMPOS_CONTEXTO) {
    if (!(campo in body)) continue;
    const bruto = body[campo];
    if (bruto === null || bruto === undefined) {
      valores[campo] = null;
      continue;
    }
    if (typeof bruto !== 'string') {
      return { valores, erro: `O campo ${campo} deve ser texto.` };
    }
    const limpo = bruto.trim();
    valores[campo] = limpo === '' ? null : limpo;
  }

  if (valores.company_size && !TAMANHOS_EMPRESA.includes(valores.company_size as any)) {
    return { valores, erro: `Porte de empresa inválido. Use um de: ${TAMANHOS_EMPRESA.join(', ')}.` };
  }
  if (valores.work_sector && valores.work_sector.length > 100) {
    return { valores, erro: 'O setor de atuação deve ter no máximo 100 caracteres.' };
  }

  return { valores };
}

/** O contexto do próprio aluno logado. */
export async function getMeuContexto(req: AuthenticatedRequest, res: Response) {
  try {
    const usuarioId = req.user?.id;
    if (!usuarioId) return res.status(401).json({ message: 'Não autenticado.' });

    const linha = await buscarLinha(usuarioId);
    return res.json(montarResposta(linha, usuarioId));
  } catch (err) {
    console.error('Erro ao buscar contexto do aluno:', err);
    return res.status(500).json({ message: 'Erro ao buscar o contexto do aluno.' });
  }
}

/**
 * Contexto de um aluno específico. Coordenação e docentes leem para escrever
 * casos PBL aderentes; o próprio aluno também cai aqui se pedir o próprio id.
 */
export async function getContextoDeAluno(req: AuthenticatedRequest, res: Response) {
  try {
    const solicitante = req.user;
    if (!solicitante) return res.status(401).json({ message: 'Não autenticado.' });

    const alvo = Number(req.params.usuarioId);
    if (!Number.isInteger(alvo) || alvo <= 0) {
      return res.status(400).json({ message: 'Identificador de aluno inválido.' });
    }

    // O contexto é um relato pessoal: aluno só enxerga o próprio.
    if (solicitante.perfilNome === 'ALUNO' && solicitante.id !== alvo) {
      return res.status(403).json({ message: 'Você só pode consultar o seu próprio contexto.' });
    }

    const linha = await buscarLinha(alvo);
    return res.json(montarResposta(linha, alvo));
  } catch (err) {
    console.error('Erro ao buscar contexto do aluno:', err);
    return res.status(500).json({ message: 'Erro ao buscar o contexto do aluno.' });
  }
}

/**
 * Grava o contexto do aluno logado. Serve para POST e PUT: como cada aluno tem
 * no máximo uma linha, "criar" e "atualizar" são a mesma operação e distinguir
 * as duas só produziria erro 409 em quem clicou salvar duas vezes.
 *
 * A completude é recalculada a cada gravação. `completed_at` é carimbado na
 * primeira vez que o critério é atingido e preservado enquanto continuar sendo
 * atendido — reescrevê-lo a cada save faria a data da conquista andar junto com
 * a última edição. Se o aluno apagar respostas e cair abaixo do mínimo, a
 * medalha é revogada (volta a NULL) e será reconquistada quando ele completar
 * de novo.
 */
export async function salvarContexto(req: AuthenticatedRequest, res: Response) {
  try {
    const usuarioId = req.user?.id;
    if (!usuarioId) return res.status(401).json({ message: 'Não autenticado.' });

    const { valores, erro } = extrairCampos(req.body || {});
    if (erro) return res.status(400).json({ message: erro });

    const anterior = await buscarLinha(usuarioId);

    if (!anterior) {
      const colunas = Object.keys(valores);
      if (colunas.length === 0) {
        return res.status(400).json({ message: 'Nenhum campo do contexto foi enviado.' });
      }
      await runAsync(
        `INSERT INTO contexto_aluno (usuario_id, ${colunas.join(', ')})
         VALUES (?, ${colunas.map(() => '?').join(', ')})`,
        [usuarioId, ...colunas.map((c) => valores[c])]
      );
    } else {
      const colunas = Object.keys(valores);
      if (colunas.length > 0) {
        await runAsync(
          `UPDATE contexto_aluno
              SET ${colunas.map((c) => `${c} = ?`).join(', ')}, atualizado_em = CURRENT_TIMESTAMP
            WHERE usuario_id = ?`,
          [...colunas.map((c) => valores[c]), usuarioId]
        );
      }
    }

    const atual = await buscarLinha(usuarioId);
    const completoAgora = contextoEstaCompleto(atual);
    const jaTinhaMedalha = !!anterior?.completed_at;

    let ganhouMedalha = false;
    let perdeuMedalha = false;

    if (completoAgora && !jaTinhaMedalha) {
      await runAsync(
        'UPDATE contexto_aluno SET completed_at = CURRENT_TIMESTAMP WHERE usuario_id = ? AND completed_at IS NULL',
        [usuarioId]
      );
      ganhouMedalha = true;

      // TODO(carga-horária-complementar): o portal ainda não tem módulo de
      // atividades complementares (a única `carga_horaria` do sistema é a
      // estimada da atividade PBL, que é outra coisa). Quando esse módulo
      // existir, é aqui que se registra a atividade "Contexto do Aluno - PBL"
      // para este usuarioId, valendo HORAS_COMPLEMENTARES_CONTEXTO horas.

      await logAudit(usuarioId, 'MEDALHA_CONCEDIDA', 'contexto_aluno', usuarioId, {
        medalha: MEDALHA_CONTEXTO_COMPLETO.codigo
      }).catch(() => undefined);
    } else if (!completoAgora && jaTinhaMedalha) {
      // Aluno apagou respostas e caiu abaixo do mínimo: a medalha deixa de valer
      // enquanto o contexto estiver incompleto.
      await runAsync('UPDATE contexto_aluno SET completed_at = NULL WHERE usuario_id = ?', [usuarioId]);
      perdeuMedalha = true;

      // TODO(carga-horária-complementar): revogar aqui o registro de horas
      // complementares criado na concessão, quando o módulo existir.

      await logAudit(usuarioId, 'MEDALHA_REVOGADA', 'contexto_aluno', usuarioId, {
        medalha: MEDALHA_CONTEXTO_COMPLETO.codigo
      }).catch(() => undefined);
    }

    const final = await buscarLinha(usuarioId);
    return res.json({
      ...montarResposta(final, usuarioId),
      ganhouMedalha,
      perdeuMedalha,
      message: ganhouMedalha
        ? `Contexto salvo. Você conquistou a medalha ${MEDALHA_CONTEXTO_COMPLETO.titulo}!`
        : 'Contexto salvo.'
    });
  } catch (err) {
    console.error('Erro ao salvar contexto do aluno:', err);
    return res.status(500).json({ message: 'Erro ao salvar o contexto do aluno.' });
  }
}

/**
 * Medalhas de um aluno. Hoje o portal tem uma só; a resposta já vem como lista
 * para que novas conquistas entrem sem quebrar quem consome o endpoint.
 */
export async function listarMedalhas(req: AuthenticatedRequest, res: Response) {
  try {
    const solicitante = req.user;
    if (!solicitante) return res.status(401).json({ message: 'Não autenticado.' });

    const alvo = req.params.usuarioId ? Number(req.params.usuarioId) : solicitante.id;
    if (!Number.isInteger(alvo) || alvo <= 0) {
      return res.status(400).json({ message: 'Identificador de aluno inválido.' });
    }
    if (solicitante.perfilNome === 'ALUNO' && solicitante.id !== alvo) {
      return res.status(403).json({ message: 'Você só pode consultar as suas próprias medalhas.' });
    }

    const linha = await getAsync<{ completed_at: string | null }>(
      'SELECT completed_at FROM contexto_aluno WHERE usuario_id = ?',
      [alvo]
    );

    const medalhas = linha?.completed_at
      ? [{ ...MEDALHA_CONTEXTO_COMPLETO, conquistadaEm: linha.completed_at }]
      : [];

    return res.json({ usuarioId: alvo, medalhas });
  } catch (err) {
    console.error('Erro ao listar medalhas:', err);
    return res.status(500).json({ message: 'Erro ao listar as medalhas.' });
  }
}


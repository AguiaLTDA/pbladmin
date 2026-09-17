import { Response } from 'express';
import { queryAsync, runAsync, getAsync } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../services/audit';
import { CRONOGRAMA_PBL_PADRAO } from '../config/cronogramaPadrao';

/**
 * Cronograma oficial das atividades PBL. Uma única fonte para os três portais:
 * a coordenação edita no portal administrativo (PUT, só ADMIN) e professor e
 * aluno leem o resultado (GET, qualquer autenticado). É por isso que o
 * cronograma saiu das constantes do cliente e virou tabela.
 */

interface EtapaEntrada {
  ordem?: number | string | null;
  titulo?: string;
  prazoTexto?: string;
  fim?: string;
  pontos?: string | null;
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

/** Texto de prazo automático quando a coordenação preenche só a data. */
function prazoTextoPadrao(fim: string): string {
  const [, mes, dia] = fim.split('-');
  const nomeMes = MESES[Number(mes) - 1];
  if (!nomeMes || !dia) return `até ${fim}`;
  return `até ${dia} de ${nomeMes}`;
}

function limpar(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

export async function getCronograma(_req: AuthenticatedRequest, res: Response) {
  try {
    const cabecalho = await getAsync<{ periodo: string; total_avaliativo: string; atualizado_em: string }>(
      `SELECT periodo, total_avaliativo, atualizado_em FROM cronograma_pbl WHERE id = 1`
    );

    const etapas = await queryAsync<{
      ordem: number | null;
      titulo: string;
      prazo_texto: string;
      fim: string;
      pontos: string | null;
    }>(`SELECT ordem, titulo, prazo_texto, fim, pontos
          FROM cronograma_pbl_etapas
         ORDER BY posicao ASC, id ASC`);

    // Banco ainda não semeado (ou esvaziado à mão): devolve o padrão de fábrica
    // em vez de um quadro vazio nos portais do aluno e do professor.
    if (!cabecalho && etapas.length === 0) {
      return res.json({ ...CRONOGRAMA_PBL_PADRAO, atualizadoEm: null });
    }

    return res.json({
      periodo: cabecalho?.periodo || CRONOGRAMA_PBL_PADRAO.periodo,
      totalAvaliativo: cabecalho?.total_avaliativo || CRONOGRAMA_PBL_PADRAO.totalAvaliativo,
      atualizadoEm: cabecalho?.atualizado_em || null,
      etapas: etapas.map((e) => ({
        ordem: e.ordem === null || e.ordem === undefined ? null : Number(e.ordem),
        titulo: e.titulo,
        prazoTexto: e.prazo_texto,
        fim: e.fim,
        pontos: e.pontos || undefined
      }))
    });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao buscar o cronograma PBL.' });
  }
}

export async function updateCronograma(req: AuthenticatedRequest, res: Response) {
  try {
    const periodo = limpar(req.body?.periodo);
    const totalAvaliativo = limpar(req.body?.totalAvaliativo);
    const entradas: EtapaEntrada[] = Array.isArray(req.body?.etapas) ? req.body.etapas : [];

    if (!periodo) return res.status(400).json({ message: 'Informe o semestre do cronograma.' });
    if (!totalAvaliativo) {
      return res.status(400).json({ message: 'Informe o total das entregas avaliativas.' });
    }
    if (entradas.length === 0) {
      return res.status(400).json({ message: 'O cronograma precisa de pelo menos uma etapa.' });
    }

    // Valida TUDO antes de gravar qualquer coisa: uma etapa inválida no meio da
    // lista não pode deixar o cronograma pela metade nos portais.
    const etapas = entradas.map((entrada, indice) => {
      const titulo = limpar(entrada.titulo);
      const fim = limpar(entrada.fim);

      if (!titulo) throw new Error(`Etapa ${indice + 1}: informe o título.`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fim)) {
        throw new Error(`Etapa ${indice + 1} ("${titulo}"): informe a data final da etapa.`);
      }

      const ordemBruta = entrada.ordem;
      const ordem =
        ordemBruta === null || ordemBruta === undefined || limpar(String(ordemBruta)) === ''
          ? null
          : Number(ordemBruta);
      if (ordem !== null && (!Number.isFinite(ordem) || ordem < 0)) {
        throw new Error(`Etapa ${indice + 1} ("${titulo}"): a numeração deve ser um número.`);
      }

      return {
        posicao: indice + 1,
        ordem,
        titulo,
        prazoTexto: limpar(entrada.prazoTexto) || prazoTextoPadrao(fim),
        fim,
        pontos: limpar(entrada.pontos) || null
      };
    });

    await runAsync(
      `INSERT INTO cronograma_pbl (id, periodo, total_avaliativo, atualizado_por, atualizado_em)
            VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE
              SET periodo = EXCLUDED.periodo,
                  total_avaliativo = EXCLUDED.total_avaliativo,
                  atualizado_por = EXCLUDED.atualizado_por,
                  atualizado_em = CURRENT_TIMESTAMP`,
      [periodo, totalAvaliativo, req.user?.id || null]
    );

    // Substituição completa: a tela do admin manda a lista inteira, então
    // apagar e regravar mantém posição, remoções e inclusões consistentes.
    await runAsync(`DELETE FROM cronograma_pbl_etapas`);
    for (const etapa of etapas) {
      await runAsync(
        `INSERT INTO cronograma_pbl_etapas (posicao, ordem, titulo, prazo_texto, fim, pontos)
              VALUES (?, ?, ?, ?, ?, ?)`,
        [etapa.posicao, etapa.ordem, etapa.titulo, etapa.prazoTexto, etapa.fim, etapa.pontos]
      );
    }

    await logAudit(req.user?.id || null, 'ATUALIZAR_CRONOGRAMA_PBL', 'cronograma_pbl');

    return res.json({
      message: 'Cronograma atualizado. Professores e alunos já veem as novas datas.',
      periodo,
      totalAvaliativo,
      etapas: etapas.map((e) => ({
        ordem: e.ordem,
        titulo: e.titulo,
        prazoTexto: e.prazoTexto,
        fim: e.fim,
        pontos: e.pontos || undefined
      }))
    });
  } catch (err: any) {
    // Erros de validação viram 400 com a mensagem da etapa; o resto é 500.
    if (err instanceof Error && err.message.startsWith('Etapa ')) {
      return res.status(400).json({ message: err.message });
    }
    return res.status(500).json({ message: 'Erro ao salvar o cronograma PBL.' });
  }
}

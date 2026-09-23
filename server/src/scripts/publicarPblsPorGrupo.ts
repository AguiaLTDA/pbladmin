/**
 * Publica os PDFs de `pbl1prof/PBL_Casos_Por_Grupo` para os respectivos grupos.
 *
 * Reusa as MESMAS funções que a coordenação aciona pela tela — `uploadFile` e
 * `enviarArquivoParaGrupo` — em vez de reproduzir os INSERTs por fora. É o que
 * garante que um PDF publicado por aqui fique indistinguível de um publicado
 * pelo Gerenciador de Arquivos: mesma linha em `arquivos`, mesma atividade
 * informativa, mesma segmentação por grupo, mesma auditoria. Qualquer regra que
 * mudar no controller vale para este script no mesmo instante.
 *
 * O grupo de destino é resolvido por POSIÇÃO dentro da turma (`ORDER BY g.id`),
 * que é a ordem usada na geração dos PDFs, e o nome é conferido por semelhança
 * antes de gravar. Casar por nome puro não serve: alguns grupos têm nome digitado
 * com erro de acentuação ou espaçamento, e casar por id fixo no arquivo quebraria
 * se a coordenação recriasse um grupo.
 *
 * Uso:
 *   npx tsx src/scripts/publicarPblsPorGrupo.ts --dry-run
 *   npx tsx src/scripts/publicarPblsPorGrupo.ts --turma COMSOC-4
 *   npx tsx src/scripts/publicarPblsPorGrupo.ts --turma AGRO-2 --grupo "AGRO_2026_42"
 *   npx tsx src/scripts/publicarPblsPorGrupo.ts --todas --confirmar
 *
 * Sem `--confirmar`, roda sempre em simulação: nada sobe ao Drive nem ao banco.
 */
import fs from 'fs';
import path from 'path';
import { pool, queryAsync, getAsync } from '../config/db';
import { uploadFile, enviarArquivoParaGrupo } from '../controllers/fileController';
import { AuthenticatedRequest } from '../middleware/auth';

const RAIZ = path.resolve(__dirname, '..', '..', '..', 'pbl1prof', 'PBL_Casos_Por_Grupo');
const MANIFESTO = path.join(RAIZ, '_gerador', 'manifesto.json');

interface ItemManifesto {
  turmaCodigo: string;
  indiceGrupo: number;
  grupoNome: string;
  arquivo: string;
  tipoDocumento: string;
  reserva: boolean;
}

const args = process.argv.slice(2);
const temFlag = (f: string) => args.includes(f);
const valorFlag = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

const confirmar = temFlag('--confirmar');
const turmaFiltro = valorFlag('--turma');
// Trocar o PDF de UM grupo é operação corriqueira da coordenação — caso errado,
// versão corrigida, grupo remontado. Sem este recorte seria preciso republicar a
// turma inteira para acertar um arquivo, mexendo em grupos que estavam certos.
const grupoFiltro = valorFlag('--grupo');
const todas = temFlag('--todas');
// Republica por cima do que ja esta la. So faz sentido quando o PDF mudou.
const forcar = temFlag('--forcar');

/** Aproxima nomes para conferência: sem acento, sem caixa, sem espaço duplicado. */
function normalizar(txt: string): string {
  return txt
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Semelhança entre dois nomes, de 0 a 1, por distância de edição.
 *
 * Serve para separar "mesmo grupo escrito com erro de digitação" de "grupo
 * diferente" — uma comparação exata reprovaria o primeiro caso, e ignorar a
 * checagem deixaria passar o segundo.
 */
function proximidade(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;

  const linha = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let anterior = linha[0];
    linha[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = linha[j];
      linha[j] = Math.min(
        linha[j] + 1,
        linha[j - 1] + 1,
        anterior + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      anterior = temp;
    }
  }
  return 1 - linha[b.length] / Math.max(a.length, b.length);
}

/** Coleta a resposta do controller sem precisar de um servidor HTTP no meio. */
function fakeRes() {
  const estado: { status: number; body: any } = { status: 200, body: null };
  const res: any = {
    status(code: number) {
      estado.status = code;
      return res;
    },
    json(payload: any) {
      estado.body = payload;
      return res;
    }
  };
  return { res, estado };
}

async function main() {
  if (!fs.existsSync(MANIFESTO)) {
    throw new Error(`Manifesto não encontrado em ${MANIFESTO}. Gere-o em _gerador antes de publicar.`);
  }

  const itens: ItemManifesto[] = JSON.parse(fs.readFileSync(MANIFESTO, 'utf-8'));

  if (!turmaFiltro && !todas) {
    console.log('Informe --turma <CODIGO> para publicar uma turma, ou --todas para publicar tudo.');
    console.log('Turmas no manifesto:', [...new Set(itens.map((i) => i.turmaCodigo))].join(', '));
    return;
  }

  // A coordenação é a autora da publicação, como seria pela tela. Sem um ADMIN
  // real não há a quem atribuir o upload nem a auditoria — então o script para.
  const admin = await getAsync<{ id: number; nome: string }>(
    `SELECT u.id, u.nome FROM usuarios u JOIN perfis p ON p.id = u.perfil_id
      WHERE p.nome = 'ADMIN' AND u.ativo = 1 ORDER BY u.id ASC LIMIT 1`
  );
  if (!admin) throw new Error('Nenhum usuário ADMIN ativo encontrado para registrar a publicação.');

  const alvo = itens.filter(
    (i) =>
      !i.reserva &&
      (todas || i.turmaCodigo === turmaFiltro) &&
      (!grupoFiltro || normalizar(i.grupoNome).includes(normalizar(grupoFiltro)))
  );

  if (grupoFiltro && alvo.length === 0) {
    console.log(`Nenhum grupo do manifesto casa com "${grupoFiltro}".`);
    return;
  }
  const reservas = itens.filter((i) => i.reserva && (todas || i.turmaCodigo === turmaFiltro));

  console.log(`\nModo: ${confirmar ? 'PUBLICAÇÃO REAL' : 'SIMULAÇÃO (nada será gravado)'}`);
  console.log(`Autor da publicação: ${admin.nome} (id ${admin.id})`);
  console.log(`Itens a publicar: ${alvo.length}${reservas.length ? ` | ignorados por serem de reserva: ${reservas.length}` : ''}\n`);

  let ok = 0;
  let jaEstavam = 0;
  const problemas: string[] = [];

  for (const item of alvo) {
    const rotulo = `${item.turmaCodigo} · ${item.grupoNome}`;

    const grupos = await queryAsync<{ id: number; nome: string }>(
      `SELECT g.id, g.nome
         FROM grupos g
         JOIN turmas t ON t.id = g.turma_id
        WHERE t.codigo = ? AND g.ativo = 1 AND g.deletado_em IS NULL
          AND t.ativo = 1 AND t.deletado_em IS NULL
        ORDER BY g.id ASC`,
      [item.turmaCodigo]
    );

    const grupo = grupos[item.indiceGrupo];
    if (!grupo) {
      problemas.push(`${rotulo}: a turma tem ${grupos.length} grupo(s); o índice ${item.indiceGrupo} não existe mais.`);
      continue;
    }

    // Divergência de nome não impede por si só — a posição é a referência —, mas
    // precisa aparecer. Diferença PEQUENA é esperada: vários nomes de grupo têm
    // erro de digitação na base ("Fernado", "pestana", vírgula sem espaço) e
    // foram grafados corretamente no PDF. Diferença GRANDE é outra coisa: sinal
    // de que a lista de grupos mudou desde a geração, e aí publicar às cegas
    // entregaria o caso de um grupo a outro — que é justamente o que não pode
    // acontecer. Por isso a primeira só avisa e a segunda interrompe o item.
    const semelhanca = proximidade(normalizar(grupo.nome), normalizar(item.grupoNome));
    if (semelhanca < 1) {
      const grave = semelhanca < 0.85;
      problemas.push(
        `${rotulo}: nome divergente na base ("${grupo.nome}", semelhança ${(semelhanca * 100).toFixed(0)}%).` +
          (grave
            ? ' Diferença grande demais — item NÃO publicado. Confira o grupo antes de repetir.'
            : ' Diferença pequena (grafia); tratado como o mesmo grupo.')
      );
      if (grave) continue;
    }

    // Ja publicado? Pula. Sem isso, repetir o comando para retomar de onde parou
    // -- que e o uso natural depois de uma falha no meio da lista -- reenviaria
    // ao Drive copias identicas das que ja estao la e trocaria a atividade do
    // grupo por outra igual, zerando a data de recebimento que o aluno ve.
    // `--forcar` existe para o caso legitimo oposto: o PDF mudou e precisa subir
    // de novo com o mesmo nome.
    const jaPublicado = await getAsync<{ id: number }>(
      `SELECT ar.id
         FROM segmentacao_regras sr
         JOIN segmentacoes seg ON seg.id = sr.segmentacao_id
         JOIN atividades_pbl a ON a.id = seg.atividade_id AND a.deletado_em IS NULL
         JOIN versoes_atividades va ON va.atividade_id = a.id
         JOIN arquivos_atividades aa ON aa.versao_atividade_id = va.id
         JOIN arquivos ar ON ar.id = aa.arquivo_id AND ar.deletado_em IS NULL
        WHERE sr.entidade_tipo = 'grupo' AND sr.entidade_id = ? AND sr.acao = 'INCLUIR'
          AND ar.nome_original = ?
        LIMIT 1`,
      [grupo.id, item.arquivo]
    );

    if (jaPublicado && !forcar) {
      console.log(`[ja publicado] ${rotulo} -> arquivo id ${jaPublicado.id}`);
      jaEstavam++;
      continue;
    }

    const caminho = path.join(RAIZ, item.arquivo);
    if (!fs.existsSync(caminho)) {
      problemas.push(`${rotulo}: arquivo ausente (${item.arquivo}).`);
      continue;
    }

    const buffer = fs.readFileSync(caminho);

    if (!confirmar) {
      console.log(`[simulado] ${rotulo} -> grupo id ${grupo.id} | ${item.arquivo} (${(buffer.length / 1024).toFixed(0)} KB)`);
      ok++;
      continue;
    }

    const reqUpload = {
      user: { id: admin.id, perfilNome: 'ADMIN' },
      file: {
        originalname: item.arquivo,
        size: buffer.length,
        mimetype: 'application/pdf',
        buffer
      },
      body: { tipoDocumento: item.tipoDocumento }
    } as unknown as AuthenticatedRequest;

    const up = fakeRes();
    await uploadFile(reqUpload, up.res);
    if (up.estado.status !== 201 || !up.estado.body?.id) {
      problemas.push(`${rotulo}: falha no upload — ${up.estado.body?.message || 'sem detalhe'}`);
      continue;
    }
    const arquivoId = up.estado.body.id as number;

    const reqEnvio = {
      user: { id: admin.id, perfilNome: 'ADMIN' },
      params: { id: String(arquivoId) },
      // `substituir` troca o material anterior do grupo em vez de acumular dois
      // PBLs concorrentes na tela do aluno.
      body: { grupoId: grupo.id, substituir: true }
    } as unknown as AuthenticatedRequest;

    const env = fakeRes();
    await enviarArquivoParaGrupo(reqEnvio, env.res);
    if (env.estado.status >= 400) {
      problemas.push(`${rotulo}: arquivo ${arquivoId} subiu, mas não foi vinculado — ${env.estado.body?.message || 'sem detalhe'}`);
      continue;
    }

    console.log(`[publicado] ${rotulo} -> grupo id ${grupo.id} | arquivo id ${arquivoId}`);
    ok++;
  }

  console.log(`\nConcluído: ${ok}/${alvo.length} item(ns).`);
  if (problemas.length) {
    console.log(`\nPontos de atenção (${problemas.length}):`);
    problemas.forEach((p) => console.log(' - ' + p));
  }
  if (!confirmar && ok > 0) {
    console.log('\nNada foi gravado. Repita com --confirmar para publicar de verdade.');
  }
}

main()
  .catch((err) => {
    console.error('\nFalha na publicação:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

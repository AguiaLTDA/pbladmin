/**
 * Importa em lote os PDFs de pbl1prof/ e vincula cada um, por aproximação de
 * nome, ao professor correspondente como "Arquivos Orientadores 01".
 *
 * Por padrão roda em modo simulação (dry-run): só mostra os casamentos de
 * nome encontrados, sem enviar nada ao Google Drive nem gravar no banco.
 * Rode com --commit para executar de fato o upload + vínculo.
 *
 * Uso:
 *   npx tsx src/scripts/importOrientadorFiles.ts            (simulação)
 *   npx tsx src/scripts/importOrientadorFiles.ts --commit    (grava de fato)
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getAsync, queryAsync, runAsync } from '../config/db';
import { uploadToDrive } from '../services/googleDrive';
import { logAudit } from '../services/audit';
import { initAndSeedDb } from '../db/seed';
import { runMigrations } from '../db/migrate';

const ROTULO_LOTE = 'Arquivos Orientadores 01';
const PASTA_PDFS = path.resolve(__dirname, '../../../pbl1prof');

// Abaixo deste score (Jaccard sobre o conjunto de palavras do nome) o arquivo
// não é vinculado automaticamente — fica só reportado como "sem correspondência".
const LIMIAR_MINIMO = 0.5;
// Abaixo deste score o vínculo é feito, mas sinalizado como baixa confiança.
const LIMIAR_ALTA_CONFIANCA = 0.85;

interface Professor {
  id: number;
  nome: string;
  email: string;
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos (marcas diacríticas combinantes)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nomeDoArquivo(filename: string): string {
  const semExtensao = filename.replace(/\.pdf$/i, '');
  const semPrefixo = semExtensao.replace(/^PBL[_\s-]*/i, '');
  return semPrefixo.replace(/_/g, ' ').trim();
}

function jaccard(a: string, b: string): number {
  const setA = new Set(normalizar(a).split(' ').filter(Boolean));
  const setB = new Set(normalizar(b).split(' ').filter(Boolean));
  const intersecao = [...setA].filter((w) => setB.has(w)).length;
  const uniao = new Set([...setA, ...setB]).size;
  return uniao === 0 ? 0 : intersecao / uniao;
}

interface Casamento {
  arquivo: string;
  nomeExtraido: string;
  professor: Professor | null;
  score: number;
}

async function encontrarCasamentos(): Promise<Casamento[]> {
  const professores = await queryAsync<Professor>(
    `SELECT id, nome, email FROM usuarios WHERE perfil_id = 2 AND deletado_em IS NULL`
  );

  const arquivos = fs
    .readdirSync(PASTA_PDFS)
    .filter((f) => f.toLowerCase().endsWith('.pdf'));

  const resultados: Casamento[] = [];

  for (const arquivo of arquivos) {
    const nomeExtraido = nomeDoArquivo(arquivo);
    let melhor: Professor | null = null;
    let melhorScore = 0;

    for (const p of professores) {
      const score = jaccard(nomeExtraido, p.nome);
      if (score > melhorScore) {
        melhorScore = score;
        melhor = p;
      }
    }

    resultados.push({
      arquivo,
      nomeExtraido,
      professor: melhorScore >= LIMIAR_MINIMO ? melhor : null,
      score: melhorScore
    });
  }

  return resultados;
}

function relatar(casamentos: Casamento[]) {
  console.log('\n=== Casamento de arquivos x professores (pbl1prof/) ===\n');
  for (const c of casamentos) {
    if (!c.professor) {
      console.log(`[SEM CORRESPONDÊNCIA] ${c.arquivo}  (nome extraído: "${c.nomeExtraido}")`);
      continue;
    }
    const confianca = c.score >= LIMIAR_ALTA_CONFIANCA ? 'alta' : 'BAIXA — conferir';
    console.log(
      `[${confianca.toUpperCase()}] ${c.arquivo}  →  ${c.professor.nome} <${c.professor.email}>  (score ${c.score.toFixed(2)})`
    );
  }
  const semMatch = casamentos.filter((c) => !c.professor).length;
  const baixaConfianca = casamentos.filter((c) => c.professor && c.score < LIMIAR_ALTA_CONFIANCA).length;
  console.log(
    `\nTotal: ${casamentos.length} arquivos | ${casamentos.length - semMatch} com correspondência | ${baixaConfianca} de baixa confiança | ${semMatch} sem correspondência\n`
  );
}

async function commitar(casamentos: Casamento[]) {
  const admin = await getAsync<{ id: number }>(
    `SELECT id FROM usuarios WHERE perfil_id = 1 AND ativo = 1 AND deletado_em IS NULL ORDER BY id ASC LIMIT 1`
  );
  if (!admin) {
    throw new Error('Nenhum usuário ADMIN ativo encontrado para registrar como responsável pelo vínculo.');
  }

  for (const c of casamentos) {
    if (!c.professor) continue;

    const caminhoCompleto = path.join(PASTA_PDFS, c.arquivo);
    const buffer = fs.readFileSync(caminhoCompleto);
    const hashMd5 = crypto.createHash('md5').update(buffer).digest('hex');

    const driveFilename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.pdf`;
    const driveFileId = await uploadToDrive(buffer, driveFilename, 'application/pdf');

    const arquivoIns = await runAsync(
      `INSERT INTO arquivos (nome_original, caminho_armazenado, tamanho_bytes, mime_type, categoria, hash_md5, enviado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [c.arquivo, driveFileId, buffer.length, 'application/pdf', 'PDF', hashMd5, admin.id]
    );

    await runAsync(`UPDATE arquivos_orientadores SET ativo = 0 WHERE professor_id = ? AND ativo = 1`, [
      c.professor.id
    ]);
    const vinculoIns = await runAsync(
      `INSERT INTO arquivos_orientadores (professor_id, arquivo_id, vinculado_por, rotulo, ativo)
       VALUES (?, ?, ?, ?, 1)`,
      [c.professor.id, arquivoIns.lastID, admin.id, ROTULO_LOTE]
    );

    await logAudit(admin.id, 'IMPORTAR_ARQUIVO_ORIENTADOR_LOTE', 'arquivos_orientadores', vinculoIns.lastID, {
      arquivo: c.arquivo,
      professorId: c.professor.id,
      score: c.score,
      rotulo: ROTULO_LOTE
    });

    console.log(`Vinculado: ${c.arquivo} → ${c.professor.nome} (arquivo #${arquivoIns.lastID}, vínculo #${vinculoIns.lastID})`);
  }
}

async function main() {
  const commit = process.argv.includes('--commit');

  // Garante que schema.sql (nova tabela comentarios_orientador) e a migração
  // (nova coluna arquivos_orientadores.rotulo) já foram aplicadas ao banco —
  // idempotente, não afeta dados existentes.
  await initAndSeedDb();
  await runMigrations();

  const casamentos = await encontrarCasamentos();
  relatar(casamentos);

  if (!commit) {
    console.log('Modo simulação (dry-run) — nada foi enviado ao Drive nem gravado no banco.');
    console.log('Revise os casamentos acima; rode com --commit para efetivar o upload e o vínculo.\n');
    return;
  }

  console.log('Modo --commit: enviando arquivos ao Google Drive e gravando os vínculos...\n');
  await commitar(casamentos);
  console.log('\nImportação concluída.');
}

main()
  .catch((err) => {
    console.error('Erro ao importar arquivos orientadores:', err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());

/**
 * Envia "MANUAL DO ALUNO PBL.pdf" (raiz do repo) ao Google Drive e o registra
 * como arquivo institucional sob a chave 'MANUAL_ALUNO_PBL' — o mesmo arquivo
 * fica disponível para download em qualquer usuário autenticado (ver bypass
 * em fileController.downloadFile), sem exigir vínculo com turma/atividade.
 *
 * Uso: npx tsx src/scripts/uploadManualAlunoPBL.ts
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getAsync, runAsync } from '../config/db';
import { uploadToDrive } from '../services/googleDrive';
import { logAudit } from '../services/audit';
import { initAndSeedDb } from '../db/seed';
import { runMigrations } from '../db/migrate';

const CHAVE = 'MANUAL_ALUNO_PBL';
const CAMINHO_PDF = path.resolve(__dirname, '../../../MANUAL DO ALUNO PBL.pdf');

async function main() {
  await initAndSeedDb();
  await runMigrations();

  if (!fs.existsSync(CAMINHO_PDF)) {
    throw new Error(`Arquivo não encontrado: ${CAMINHO_PDF}`);
  }

  const admin = await getAsync<{ id: number }>(
    `SELECT id FROM usuarios WHERE perfil_id = 1 AND ativo = 1 AND deletado_em IS NULL ORDER BY id ASC LIMIT 1`
  );
  if (!admin) throw new Error('Nenhum usuário ADMIN ativo encontrado.');

  const buffer = fs.readFileSync(CAMINHO_PDF);
  const hashMd5 = crypto.createHash('md5').update(buffer).digest('hex');
  const nomeOriginal = path.basename(CAMINHO_PDF);

  const driveFilename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.pdf`;
  console.log(`Enviando "${nomeOriginal}" ao Google Drive...`);
  const driveFileId = await uploadToDrive(buffer, driveFilename, 'application/pdf');

  const arquivoIns = await runAsync(
    `INSERT INTO arquivos (nome_original, caminho_armazenado, tamanho_bytes, mime_type, categoria, hash_md5, enviado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [nomeOriginal, driveFileId, buffer.length, 'application/pdf', 'PDF', hashMd5, admin.id]
  );

  const existente = await getAsync<{ id: number }>(`SELECT id FROM arquivos_institucionais WHERE chave = ?`, [CHAVE]);
  if (existente) {
    await runAsync(
      `UPDATE arquivos_institucionais SET arquivo_id = ?, atualizado_por = ?, atualizado_em = CURRENT_TIMESTAMP WHERE chave = ?`,
      [arquivoIns.lastID, admin.id, CHAVE]
    );
  } else {
    await runAsync(`INSERT INTO arquivos_institucionais (chave, arquivo_id, atualizado_por) VALUES (?, ?, ?)`, [
      CHAVE,
      arquivoIns.lastID,
      admin.id
    ]);
  }

  await logAudit(admin.id, 'DEFINIR_ARQUIVO_INSTITUCIONAL', 'arquivos_institucionais', CHAVE, {
    arquivoId: arquivoIns.lastID,
    nomeOriginal
  });

  console.log(`OK: "${nomeOriginal}" registrado como arquivo institucional '${CHAVE}' (arquivo #${arquivoIns.lastID}).`);
}

main()
  .catch((err) => {
    console.error('Erro ao enviar o manual do aluno PBL:', err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());

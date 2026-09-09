import { Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { queryAsync, runAsync, getAsync } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../services/audit';
import { uploadToDrive, downloadFromDrive } from '../services/googleDrive';

// Arquivos ficam em buffer só até serem enviados ao Google Drive — nada é gravado em disco local.
const storage = multer.memoryStorage();

// File filter check for allowed formats & executable blocking
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const forbiddenExts = ['.exe', '.bat', '.sh', '.cmd', '.js', '.vbs', '.msi', '.com', '.scr', '.ps1'];

  if (forbiddenExts.includes(ext)) {
    return cb(new Error('Formato de arquivo potencialmente perigoso não permitido.'));
  }

  cb(null, true);
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max limit
});

function getCategoryFromMime(mime: string, filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (mime.includes('pdf') || ext === '.pdf') return 'PDF';
  if (mime.includes('word') || ext.includes('doc')) return 'DOCUMENTO';
  if (mime.includes('sheet') || mime.includes('excel') || ext.includes('xls')) return 'PLANILHA';
  if (mime.includes('presentation') || ext.includes('ppt')) return 'APRESENTACAO';
  if (mime.includes('image')) return 'IMAGEM';
  if (mime.includes('video')) return 'VIDEO';
  if (mime.includes('zip') || mime.includes('rar') || ext === '.zip') return 'ZIP';
  return 'OUTROS';
}

// UPLOAD ENDPOINT
export async function uploadFile(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Não autenticado.' });

    if (!req.file) {
      return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
    }

    const { originalname, size, mimetype, buffer } = req.file;

    const hashMd5 = crypto.createHash('md5').update(buffer).digest('hex');
    const category = getCategoryFromMime(mimetype, originalname);

    const ext = path.extname(originalname);
    const driveFilename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    const driveFileId = await uploadToDrive(buffer, driveFilename, mimetype);

    const resIns = await runAsync(
      `INSERT INTO arquivos (nome_original, caminho_armazenado, tamanho_bytes, mime_type, categoria, hash_md5, enviado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [originalname, driveFileId, size, mimetype, category, hashMd5, userId]
    );

    await logAudit(userId, 'UPLOAD_ARQUIVO', 'arquivos', resIns.lastID, { originalname, size, category });

    return res.status(201).json({
      id: resIns.lastID,
      nomeOriginal: originalname,
      tamanhoBytes: size,
      mimeType: mimetype,
      categoria: category,
      hashMd5
    });
  } catch (err: any) {
    console.error('File upload error:', err);
    return res.status(500).json({ message: err.message || 'Erro ao realizar upload do arquivo.' });
  }
}

// PROTECTED DOWNLOAD STREAM ENDPOINT
export async function downloadFile(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!user) return res.status(401).json({ message: 'Não autenticado.' });

    const fileRow = await getAsync<{
      id: number;
      nome_original: string;
      caminho_armazenado: string;
      mime_type: string;
      enviado_por: number;
      deletado_em: string | null;
    }>('SELECT * FROM arquivos WHERE id = ?', [id]);

    if (!fileRow || fileRow.deletado_em !== null) {
      return res.status(404).json({ message: 'Arquivo não encontrado ou removido.' });
    }

    // Arquivos institucionais (ex.: Manual do Aluno PBL) são de leitura livre para
    // qualquer usuário autenticado — pulam as checagens de posse/turma abaixo.
    const ehArquivoInstitucional = await getAsync<{ id: number }>(
      `SELECT id FROM arquivos_institucionais WHERE arquivo_id = ?`,
      [id]
    );

    // Permission Authorization check:
    // If Student: verify if file belongs to a Published activity directed to them or their own submission
    if (user.perfilNome === 'ALUNO' && !ehArquivoInstitucional) {
      const isOwner = fileRow.enviado_por === user.id;

      const isActivityFile = await getAsync<{ id: number }>(
        `SELECT aa.id 
         FROM arquivos_atividades aa
         JOIN versoes_atividades va ON aa.versao_atividade_id = va.id
         JOIN atividades_pbl a ON va.atividade_id = a.id
         JOIN alunos_segmentados als ON a.id = als.atividade_id
         WHERE aa.arquivo_id = ? AND aa.aprovado_pelo_admin = 1
           AND a.status = 'PUBLICADO' AND a.deletado_em IS NULL AND als.aluno_id = ?`,
        [id, user.id]
      );

      if (!isOwner && !isActivityFile) {
        return res.status(403).json({ message: 'Acesso negado para este arquivo.' });
      }
    }

    // Se PROFESSOR: só o que ele enviou, o material das próprias atividades PBL
    // e os anexos das entregas de alunos das turmas que ele leciona.
    if (user.perfilNome === 'PROFESSOR' && !ehArquivoInstitucional) {
      const isOwner = fileRow.enviado_por === user.id;

      const isMaterialProprio = await getAsync<{ id: number }>(
        `SELECT aa.id
         FROM arquivos_atividades aa
         JOIN versoes_atividades va ON aa.versao_atividade_id = va.id
         JOIN atividades_pbl a ON va.atividade_id = a.id
         LEFT JOIN vinculos_professores vp
                ON vp.disciplina_id = a.disciplina_id AND vp.usuario_id = ? AND vp.ativo = 1
         WHERE aa.arquivo_id = ? AND (a.professor_id = ? OR vp.id IS NOT NULL)`,
        [user.id, id, user.id]
      );

      const isEntregaDaMinhaTurma = await getAsync<{ id: number }>(
        `SELECT ae.id
         FROM arquivos_entregas ae
         JOIN entregas e ON ae.entrega_id = e.id AND e.deletado_em IS NULL
         JOIN matriculas m ON m.usuario_id = e.aluno_id AND m.deletado_em IS NULL
         JOIN vinculos_professores vp ON vp.turma_id = m.turma_id
         WHERE ae.arquivo_id = ? AND vp.usuario_id = ? AND vp.ativo = 1`,
        [id, user.id]
      );

      const isMeuArquivoOrientador = await getAsync<{ id: number }>(
        `SELECT id FROM arquivos_orientadores WHERE arquivo_id = ? AND professor_id = ? AND ativo = 1`,
        [id, user.id]
      );

      // Material que a coordenação direcionou explicitamente a este docente.
      const foiDirecionadoAMim = await getAsync<{ id: number }>(
        `SELECT id FROM arquivos_direcionados WHERE arquivo_id = ? AND professor_id = ?`,
        [id, user.id]
      );

      if (
        !isOwner &&
        !isMaterialProprio &&
        !isEntregaDaMinhaTurma &&
        !isMeuArquivoOrientador &&
        !foiDirecionadoAMim
      ) {
        return res.status(403).json({
          message: 'Acesso negado. Este arquivo não pertence às suas atividades nem às turmas que você leciona.'
        });
      }
    }

    let driveStream: NodeJS.ReadableStream;
    try {
      driveStream = await downloadFromDrive(fileRow.caminho_armazenado);
    } catch (err) {
      console.error('Erro ao buscar arquivo no Google Drive:', err);
      return res.status(404).json({ message: 'Arquivo não encontrado no Google Drive.' });
    }

    await logAudit(user.id, 'DOWNLOAD_ARQUIVO', 'arquivos', String(id));

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileRow.nome_original)}"`);
    res.setHeader('Content-Type', fileRow.mime_type);
    driveStream.on('error', (err) => {
      console.error('Erro ao transmitir arquivo do Google Drive:', err);
      if (!res.headersSent) res.status(500).json({ message: 'Erro ao transferir arquivo.' });
    });
    return driveStream.pipe(res);
  } catch (err) {
    console.error('File download error:', err);
    return res.status(500).json({ message: 'Erro ao transferir arquivo.' });
  }
}

// SOFT DELETE FILE
export async function deleteFile(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    // O docente só remove arquivos que ele mesmo enviou; o admin remove qualquer um.
    if (req.user?.perfilNome === 'PROFESSOR') {
      const own = await getAsync<{ id: number }>('SELECT id FROM arquivos WHERE id = ? AND enviado_por = ?', [
        String(id),
        userId
      ]);
      if (!own) {
        return res.status(403).json({ message: 'Acesso negado. Você só pode excluir arquivos enviados por você.' });
      }
    }

    await runAsync('UPDATE arquivos SET deletado_em = CURRENT_TIMESTAMP WHERE id = ?', [String(id)]);
    await logAudit(userId || null, 'EXCLUSAO_LOGICA_ARQUIVO', 'arquivos', String(id));

    return res.json({ message: 'Arquivo movido para a lixeira (exclusão lógica).' });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao excluir arquivo.' });
  }
}

// LIST FILES IN FILE MANAGER (ADMIN)
export async function listAllFiles(req: AuthenticatedRequest, res: Response) {
  try {
    const files = await queryAsync(
      `SELECT ar.*, u.nome as enviado_por_nome,
              (SELECT COUNT(*) FROM arquivos_direcionados ad WHERE ad.arquivo_id = ar.id) as total_direcionamentos
       FROM arquivos ar
       JOIN usuarios u ON ar.enviado_por = u.id
       WHERE ar.deletado_em IS NULL
       ORDER BY ar.criado_em DESC`
    );
    return res.json(files);
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao listar arquivos.' });
  }
}

// --- DIRECIONAMENTO DE ARQUIVOS PARA DOCENTES ---
// A coordenação escolhe o arquivo, um ou mais professores e, com base nas
// turmas de cada um, a que curso/turma/disciplina/grupo o material se refere.
// Só o professor destinatário vê e baixa — o aluno continua recebendo material
// exclusivamente pela atividade PBL publicada.

/** ADMIN: direciona um arquivo a professores, com os alvos escolhidos. */
export async function direcionarArquivo(req: AuthenticatedRequest, res: Response) {
  try {
    const adminId = req.user?.id;
    const { id } = req.params;
    const { professorIds, turmaIds, disciplinaIds, grupoIds, observacao } = req.body;

    if (!Array.isArray(professorIds) || professorIds.length === 0) {
      return res.status(400).json({ message: 'Selecione pelo menos um professor.' });
    }

    const arquivo = await getAsync<{ id: number; nome_original: string }>(
      `SELECT id, nome_original FROM arquivos WHERE id = ? AND deletado_em IS NULL`,
      [id]
    );
    if (!arquivo) return res.status(404).json({ message: 'Arquivo não encontrado.' });

    const turmas: number[] = Array.isArray(turmaIds) ? turmaIds.map(Number) : [];
    const disciplinas: number[] = Array.isArray(disciplinaIds) ? disciplinaIds.map(Number) : [];
    const grupos: number[] = Array.isArray(grupoIds) ? grupoIds.map(Number) : [];

    let criados = 0;
    let jaExistiam = 0;
    const ignorados: string[] = [];

    for (const professorIdBruto of professorIds) {
      const professorId = Number(professorIdBruto);

      const professor = await getAsync<{ id: number; nome: string }>(
        `SELECT u.id, u.nome FROM usuarios u JOIN perfis p ON u.perfil_id = p.id
         WHERE u.id = ? AND p.nome = 'PROFESSOR' AND u.deletado_em IS NULL`,
        [professorId]
      );
      if (!professor) continue;

      // Só aceita alvos que realmente pertencem ao vínculo do docente — evita
      // direcionar material de uma turma que não é dele.
      const turmasDoProfessor = turmas.length
        ? (
            await queryAsync<{ turma_id: number }>(
              `SELECT DISTINCT turma_id FROM vinculos_professores
               WHERE usuario_id = ? AND ativo = 1 AND turma_id = ANY(?)`,
              [professorId, turmas]
            )
          ).map((r) => r.turma_id)
        : [];

      // Se o admin pediu turmas e nenhuma é deste docente, ele é pulado com
      // aviso — cair num direcionamento sem alvo esconderia o erro do admin.
      if (turmas.length > 0 && turmasDoProfessor.length === 0) {
        ignorados.push(professor.nome);
        continue;
      }

      // Sem turma escolhida, grava uma linha "só para o professor" (alvos nulos).
      const alvos: (number | null)[] = turmas.length > 0 ? turmasDoProfessor : [null];

      for (const turmaId of alvos) {
        const turma = turmaId
          ? await getAsync<{ curso_id: number | null }>(`SELECT curso_id FROM turmas WHERE id = ?`, [turmaId])
          : null;

        // Disciplina e grupo só entram se combinarem com a turma da linha.
        const disciplinaId = turmaId
          ? (
              await getAsync<{ disciplina_id: number }>(
                `SELECT disciplina_id FROM vinculos_professores
                 WHERE usuario_id = ? AND turma_id = ? AND ativo = 1
                   AND disciplina_id = ANY(?) LIMIT 1`,
                [professorId, turmaId, disciplinas.length ? disciplinas : [0]]
              )
            )?.disciplina_id || null
          : null;

        const grupoId = turmaId
          ? (
              await getAsync<{ id: number }>(
                `SELECT id FROM grupos WHERE turma_id = ? AND deletado_em IS NULL AND id = ANY(?) LIMIT 1`,
                [turmaId, grupos.length ? grupos : [0]]
              )
            )?.id || null
          : null;

        // Repetir o mesmo direcionamento não deve empilhar linhas iguais.
        const duplicado = await getAsync<{ id: number }>(
          `SELECT id FROM arquivos_direcionados
           WHERE arquivo_id = ? AND professor_id = ?
             AND COALESCE(turma_id, 0) = COALESCE(?, 0)
             AND COALESCE(disciplina_id, 0) = COALESCE(?, 0)
             AND COALESCE(grupo_id, 0) = COALESCE(?, 0)`,
          [id, professorId, turmaId, disciplinaId, grupoId]
        );
        if (duplicado) {
          jaExistiam += 1;
          continue;
        }

        await runAsync(
          `INSERT INTO arquivos_direcionados
             (arquivo_id, professor_id, curso_id, turma_id, disciplina_id, grupo_id, observacao, direcionado_por)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, professorId, turma?.curso_id || null, turmaId, disciplinaId, grupoId, observacao || null, adminId]
        );
        criados += 1;
      }
    }

    const avisoIgnorados = ignorados.length
      ? ` Fora: ${ignorados.join(', ')} — não leciona nas turmas escolhidas.`
      : '';

    if (criados === 0) {
      return res.status(400).json({
        message: jaExistiam
          ? `Este arquivo já estava direcionado assim.${avisoIgnorados}`
          : `Nenhum direcionamento criado.${avisoIgnorados || ' Verifique os professores escolhidos.'}`
      });
    }

    await logAudit(adminId || null, 'DIRECIONAR_ARQUIVO', 'arquivos_direcionados', String(id), {
      arquivo: arquivo.nome_original,
      professores: professorIds.length,
      linhas: criados,
      ignorados
    });

    return res.status(201).json({
      message: `Arquivo direcionado (${criados} destino${criados === 1 ? '' : 's'}).${avisoIgnorados}`,
      criados,
      jaExistiam,
      ignorados
    });
  } catch (err) {
    console.error('Erro ao direcionar arquivo:', err);
    return res.status(500).json({ message: 'Erro ao direcionar o arquivo.' });
  }
}

/** ADMIN: direcionamentos já registrados de um arquivo. */
export async function listarDirecionamentos(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const list = await queryAsync(
      `SELECT ad.id, ad.observacao, ad.criado_em,
              u.id as professor_id, u.nome as professor_nome, u.email as professor_email,
              c.nome as curso_nome, t.nome as turma_nome, t.codigo as turma_codigo,
              d.nome as disciplina_nome, g.nome as grupo_nome
       FROM arquivos_direcionados ad
       JOIN usuarios u ON ad.professor_id = u.id
       LEFT JOIN cursos c ON ad.curso_id = c.id
       LEFT JOIN turmas t ON ad.turma_id = t.id
       LEFT JOIN disciplinas d ON ad.disciplina_id = d.id
       LEFT JOIN grupos g ON ad.grupo_id = g.id
       WHERE ad.arquivo_id = ?
       ORDER BY u.nome ASC, ad.criado_em DESC`,
      [id]
    );
    return res.json(list);
  } catch (err) {
    console.error('Erro ao listar direcionamentos:', err);
    return res.status(500).json({ message: 'Erro ao listar os direcionamentos.' });
  }
}

/** ADMIN: remove um direcionamento (o arquivo em si permanece no gerenciador). */
export async function removerDirecionamento(req: AuthenticatedRequest, res: Response) {
  try {
    const { direcionamentoId } = req.params;
    const alvo = await getAsync<{ id: number; arquivo_id: number }>(
      `SELECT id, arquivo_id FROM arquivos_direcionados WHERE id = ?`,
      [direcionamentoId]
    );
    if (!alvo) return res.status(404).json({ message: 'Direcionamento não encontrado.' });

    await runAsync(`DELETE FROM arquivos_direcionados WHERE id = ?`, [direcionamentoId]);
    await logAudit(req.user?.id || null, 'REMOVER_DIRECIONAMENTO_ARQUIVO', 'arquivos_direcionados', String(direcionamentoId), {
      arquivoId: alvo.arquivo_id
    });

    return res.json({ message: 'Direcionamento removido.' });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao remover o direcionamento.' });
  }
}

/** PROFESSOR: os materiais que a coordenação direcionou a ele. */
export async function listarMeusDirecionados(req: AuthenticatedRequest, res: Response) {
  try {
    const professorId = req.user?.id;
    const list = await queryAsync(
      `SELECT ad.id, ad.observacao, ad.criado_em,
              ar.id as arquivo_id, ar.nome_original, ar.tamanho_bytes, ar.mime_type, ar.categoria,
              c.nome as curso_nome, t.nome as turma_nome, t.codigo as turma_codigo,
              d.nome as disciplina_nome, g.nome as grupo_nome,
              quem.nome as direcionado_por_nome
       FROM arquivos_direcionados ad
       JOIN arquivos ar ON ad.arquivo_id = ar.id AND ar.deletado_em IS NULL
       LEFT JOIN cursos c ON ad.curso_id = c.id
       LEFT JOIN turmas t ON ad.turma_id = t.id
       LEFT JOIN disciplinas d ON ad.disciplina_id = d.id
       LEFT JOIN grupos g ON ad.grupo_id = g.id
       LEFT JOIN usuarios quem ON ad.direcionado_por = quem.id
       WHERE ad.professor_id = ?
       ORDER BY ad.criado_em DESC`,
      [professorId]
    );
    return res.json(list);
  } catch (err) {
    console.error('Erro ao listar materiais direcionados:', err);
    return res.status(500).json({ message: 'Erro ao listar os materiais direcionados a você.' });
  }
}

/**
 * Arquivos institucionais: um "slot" nomeado (ex.: 'MANUAL_ALUNO_PBL') que aponta
 * para o `arquivo` vigente. Qualquer usuário autenticado pode consultar/baixar
 * (ver bypass em downloadFile acima); só o ADMIN troca o arquivo do slot.
 */
export async function getInstitutionalFile(req: AuthenticatedRequest, res: Response) {
  try {
    const { chave } = req.params;
    const row = await getAsync(
      `SELECT ai.chave, ai.atualizado_em,
              ar.id as arquivo_id, ar.nome_original, ar.tamanho_bytes, ar.mime_type, ar.categoria
       FROM arquivos_institucionais ai
       JOIN arquivos ar ON ai.arquivo_id = ar.id AND ar.deletado_em IS NULL
       WHERE ai.chave = ?`,
      [chave]
    );
    return res.json(row || null);
  } catch (err) {
    console.error('Erro ao buscar arquivo institucional:', err);
    return res.status(500).json({ message: 'Erro ao buscar o arquivo institucional.' });
  }
}

/** ADMIN: define (ou substitui) o arquivo vigente de um slot institucional. */
export async function setInstitutionalFile(req: AuthenticatedRequest, res: Response) {
  try {
    const { chave } = req.params;
    const { arquivoId } = req.body;
    const adminId = req.user?.id;
    if (!arquivoId) return res.status(400).json({ message: 'Arquivo é obrigatório.' });

    const arquivo = await getAsync<{ id: number }>(`SELECT id FROM arquivos WHERE id = ? AND deletado_em IS NULL`, [
      arquivoId
    ]);
    if (!arquivo) return res.status(404).json({ message: 'Arquivo não encontrado.' });

    const existente = await getAsync<{ id: number }>(`SELECT id FROM arquivos_institucionais WHERE chave = ?`, [
      chave
    ]);

    if (existente) {
      await runAsync(
        `UPDATE arquivos_institucionais SET arquivo_id = ?, atualizado_por = ?, atualizado_em = CURRENT_TIMESTAMP WHERE chave = ?`,
        [arquivoId, adminId || null, chave]
      );
    } else {
      await runAsync(
        `INSERT INTO arquivos_institucionais (chave, arquivo_id, atualizado_por) VALUES (?, ?, ?)`,
        [chave, arquivoId, adminId || null]
      );
    }

    await logAudit(adminId || null, 'DEFINIR_ARQUIVO_INSTITUCIONAL', 'arquivos_institucionais', String(chave), {
      arquivoId
    });
    return res.json({ message: 'Arquivo institucional atualizado com sucesso.' });
  } catch (err) {
    console.error('Erro ao definir arquivo institucional:', err);
    return res.status(500).json({ message: 'Erro ao definir o arquivo institucional.' });
  }
}

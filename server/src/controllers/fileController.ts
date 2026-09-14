import { Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { queryAsync, runAsync, getAsync } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../services/audit';
import { uploadToDrive, downloadFromDrive } from '../services/googleDrive';
import { calculateAudiencePreview, saveSegmentationAndTargetStudents } from '../services/segmentation';

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
    // Os destinos vêm agregados para a tela poder filtrar por turma/grupo e
    // sinalizar o que já foi distribuído, sem uma consulta por linha.
    const files = await queryAsync<any>(
      `SELECT ar.*, u.nome as enviado_por_nome,
              (SELECT COUNT(*) FROM arquivos_direcionados ad WHERE ad.arquivo_id = ar.id) as total_direcionamentos,
              (SELECT COUNT(DISTINCT ad.turma_id) FROM arquivos_direcionados ad
                WHERE ad.arquivo_id = ar.id AND ad.turma_id IS NOT NULL) as total_turmas,
              (SELECT COUNT(DISTINCT ad.grupo_id) FROM arquivos_direcionados ad
                WHERE ad.arquivo_id = ar.id AND ad.grupo_id IS NOT NULL) as total_grupos,
              (SELECT COALESCE(json_agg(DISTINCT t.nome), '[]'::json) FROM arquivos_direcionados ad
                 JOIN turmas t ON ad.turma_id = t.id
                WHERE ad.arquivo_id = ar.id) as turmas_destino,
              (SELECT COALESCE(json_agg(DISTINCT g.nome), '[]'::json) FROM arquivos_direcionados ad
                 JOIN grupos g ON ad.grupo_id = g.id
                WHERE ad.arquivo_id = ar.id) as grupos_destino,
              (SELECT COALESCE(json_agg(DISTINCT ad.turma_id), '[]'::json) FROM arquivos_direcionados ad
                WHERE ad.arquivo_id = ar.id AND ad.turma_id IS NOT NULL) as turmas_destino_ids
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
    const { professorIds, cursoIds, turmaIds, disciplinaIds, grupoIds, observacao } = req.body;

    const arquivo = await getAsync<{ id: number; nome_original: string }>(
      `SELECT id, nome_original FROM arquivos WHERE id = ? AND deletado_em IS NULL`,
      [id]
    );
    if (!arquivo) return res.status(404).json({ message: 'Arquivo não encontrado.' });

    let turmas: number[] = Array.isArray(turmaIds) ? turmaIds.map(Number) : [];

    // Curso escolhido sem turma = todas as turmas ativas daquele curso. Evita
    // que distribuir para um curso inteiro vire a seleção manual de oito turmas.
    const cursos: number[] = Array.isArray(cursoIds) ? cursoIds.map(Number) : [];
    if (cursos.length > 0 && turmas.length === 0) {
      const doCurso = await queryAsync<{ id: number }>(
        `SELECT id FROM turmas WHERE curso_id = ANY(?) AND deletado_em IS NULL AND ativo = 1`,
        [cursos]
      );
      turmas = doCurso.map((t) => t.id);
    }

    // O critério de entrada passou a ser curso/turma: o docente é consequência do
    // vínculo, não uma escolha que a coordenação precise fazer antes. Informar
    // professorIds continua valendo como refinamento — útil para direcionar a um
    // docente específico de uma turma com vários.
    let destinatarios: number[] = Array.isArray(professorIds) ? professorIds.map(Number) : [];

    if (destinatarios.length === 0) {
      if (turmas.length === 0) {
        return res.status(400).json({ message: 'Escolha ao menos um curso ou uma turma de destino.' });
      }
      const docentes = await queryAsync<{ usuario_id: number }>(
        `SELECT DISTINCT vp.usuario_id
           FROM vinculos_professores vp
           JOIN usuarios u ON u.id = vp.usuario_id AND u.deletado_em IS NULL
          WHERE vp.turma_id = ANY(?) AND vp.ativo = 1`,
        [turmas]
      );
      destinatarios = docentes.map((d) => d.usuario_id);

      if (destinatarios.length === 0) {
        return res.status(400).json({
          message: 'Nenhum docente ativo está vinculado às turmas escolhidas. Vincule um professor antes de direcionar.'
        });
      }
    }

    const disciplinas: number[] = Array.isArray(disciplinaIds) ? disciplinaIds.map(Number) : [];
    const grupos: number[] = Array.isArray(grupoIds) ? grupoIds.map(Number) : [];

    let criados = 0;
    let jaExistiam = 0;
    const ignorados: string[] = [];

    for (const professorIdBruto of destinatarios) {
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

/**
 * Atalho "Enviar arquivo para o grupo": em vez de o admin montar uma atividade
 * PBL inteira só para carregar um PDF, isto cria por trás dos panos uma
 * atividade mínima (RASCUNHO efêmero), anexa o arquivo, segmenta por esse
 * grupo e já publica — assim o material aparece imediatamente em "Materiais
 * de Apoio" na tela de detalhes da atividade para cada aluno do grupo.
 *
 * Efeito colateral aceito conscientemente (explicado ao admin na tela): isso
 * cria uma linha real em atividades_pbl, então ela aparece nos relatórios e
 * nas listagens como qualquer outra atividade. O título e o código levam um
 * prefixo (ver ROTULO_MATERIAL/PREFIXO_CODIGO) só para ficar reconhecível.
 */
const ROTULO_MATERIAL = 'Material';
const PREFIXO_CODIGO = 'MAT';

export async function enviarArquivoParaGrupo(req: AuthenticatedRequest, res: Response) {
  try {
    const adminId = req.user?.id;
    const { id } = req.params;
    const { grupoId, substituir } = req.body;
    if (!adminId) return res.status(401).json({ message: 'Não autenticado.' });
    if (!grupoId) return res.status(400).json({ message: 'Selecione o grupo de destino.' });

    const arquivo = await getAsync<{ id: number; nome_original: string }>(
      `SELECT id, nome_original FROM arquivos WHERE id = ? AND deletado_em IS NULL`,
      [id]
    );
    if (!arquivo) return res.status(404).json({ message: 'Arquivo não encontrado.' });

    const grupo = await getAsync<{ id: number; nome: string; turma_id: number; turma_nome: string; periodo_letivo_id: number }>(
      `SELECT g.id, g.nome, g.turma_id, t.nome as turma_nome, t.periodo_letivo_id
       FROM grupos g
       JOIN turmas t ON g.turma_id = t.id
       WHERE g.id = ? AND g.ativo = 1 AND g.deletado_em IS NULL AND t.deletado_em IS NULL`,
      [grupoId]
    );
    if (!grupo) return res.status(404).json({ message: 'Grupo não encontrado.' });

    // Precisa de um professor+disciplina reais para preencher a atividade —
    // usa o primeiro vínculo ativo da turma do grupo (a turma deve ter pelo
    // menos um docente vinculado antes de usar este atalho).
    const vinculo = await getAsync<{ professor_id: number; disciplina_id: number; disciplina_nome: string; curso_id: number }>(
      `SELECT vp.usuario_id as professor_id, vp.disciplina_id, d.nome as disciplina_nome, d.curso_id
       FROM vinculos_professores vp
       JOIN disciplinas d ON vp.disciplina_id = d.id
       WHERE vp.turma_id = ? AND vp.ativo = 1 AND vp.disciplina_id IS NOT NULL
       ORDER BY vp.id ASC LIMIT 1`,
      [grupo.turma_id]
    );
    if (!vinculo) {
      return res.status(400).json({
        message: `A turma "${grupo.turma_nome}" ainda não tem professor/disciplina vinculados. Vincule antes de enviar um arquivo para este grupo.`
      });
    }

    // Confere ANTES de criar qualquer linha — assim, se o grupo estiver vazio,
    // não sobra atividade/versão/anexo órfão para desfazer.
    const preview = await calculateAudiencePreview([{ entidadeTipo: 'grupo', entidadeId: grupo.id, acao: 'INCLUIR' }]);
    if (preview.totalAlunosUnicos === 0) {
      return res.status(400).json({ message: `O grupo "${grupo.nome}" ainda não tem alunos matriculados.` });
    }

    // Material anterior do mesmo grupo. Reenviar sem tratar isso acumularia
    // atividades informativas e o aluno veria dois materiais concorrentes, sem
    // saber qual vale.
    const anteriores = await queryAsync<{ id: number; titulo: string }>(
      `SELECT DISTINCT a.id, a.titulo
         FROM atividades_pbl a
         JOIN segmentacoes seg ON seg.atividade_id = a.id
         JOIN segmentacao_regras sr ON sr.segmentacao_id = seg.id
        WHERE a.natureza = 'INFORMATIVA' AND a.deletado_em IS NULL
          AND sr.entidade_tipo = 'grupo' AND sr.entidade_id = ? AND sr.acao = 'INCLUIR'`,
      [grupo.id]
    );

    if (anteriores.length > 0 && !substituir) {
      return res.status(409).json({
        codigo: 'GRUPO_JA_TEM_MATERIAL',
        message:
          `O grupo "${grupo.nome}" já recebeu ${anteriores.length} material(is). ` +
          'Reenvie com a opção de substituir para trocar, ou mantenha os dois conscientemente.',
        materiaisAtuais: anteriores.map((a) => a.titulo)
      });
    }

    const codigoUnico = `PBL-${PREFIXO_CODIGO}-${Date.now().toString(36).toUpperCase()}`;
    const titulo = `${ROTULO_MATERIAL}: ${arquivo.nome_original} — ${grupo.nome}`;

    const atRes = await runAsync(
      `INSERT INTO atividades_pbl (codigo_unico, titulo, curso_id, disciplina_id, professor_id, periodo_letivo_id, status, natureza, versao_atual)
       VALUES (?, ?, ?, ?, ?, ?, 'RASCUNHO', 'INFORMATIVA', 1)`,
      [codigoUnico, titulo, vinculo.curso_id, vinculo.disciplina_id, vinculo.professor_id, grupo.periodo_letivo_id]
    );
    const atividadeId = atRes.lastID;

    const verRes = await runAsync(
      `INSERT INTO versoes_atividades (atividade_id, numero_versao, instrucoes_gerais, observacoes_internas_admin, criado_por)
       VALUES (?, 1, ?, ?, ?)`,
      [
        atividadeId,
        `Este é um material de apoio disponibilizado pela coordenação para o grupo "${grupo.nome}". Não é necessário responder ou enviar entrega — basta consultar o(s) arquivo(s) em "Materiais de Apoio".`,
        `Atividade gerada automaticamente pelo atalho "Enviar arquivo para grupo" (arquivo #${arquivo.id}). Não requer avaliação.`,
        adminId
      ]
    );

    await runAsync(
      `INSERT INTO arquivos_atividades (versao_atividade_id, arquivo_id, aprovado_pelo_admin, versao_material)
       VALUES (?, ?, 1, 'v1')`,
      [verRes.lastID, arquivo.id]
    );

    // Já confirmamos acima que o grupo tem gente — isto só persiste a segmentação e
    // resolve alunos_segmentados (recalcula a mesma audiência da checagem anterior).
    const audience = await saveSegmentationAndTargetStudents(atividadeId, 'GRUPO', [
      { entidadeTipo: 'grupo', entidadeId: grupo.id, acao: 'INCLUIR' }
    ]);

    const agora = new Date();
    const prazoDistante = new Date(agora.getTime());
    prazoDistante.setFullYear(prazoDistante.getFullYear() + 5); // material sem prazo real — só evita marcar "atrasado".

    const pubRes = await runAsync(
      `INSERT INTO publicacoes (atividade_id, data_disponibilizacao, prazo_entrega, publicado_por, status_publicacao)
       VALUES (?, ?, ?, ?, 'PUBLICADO')`,
      [atividadeId, agora.toISOString(), prazoDistante.toISOString(), adminId]
    );

    await runAsync(`UPDATE atividades_pbl SET status = 'PUBLICADO', atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`, [
      atividadeId
    ]);

    for (const aluno of audience.alunosIncluidos) {
      await runAsync(`INSERT INTO notificacoes (usuario_id, titulo, mensagem, link) VALUES (?, ?, ?, ?)`, [
        aluno.id,
        'Novo material disponível',
        `A coordenação disponibilizou "${arquivo.nome_original}" para o grupo ${grupo.nome}.`,
        `/aluno/atividade/${atividadeId}`
      ]);
    }

    // O material chega ao aluno pela atividade publicada, mas o docente da turma
    // não tinha por onde vê-lo: "Materiais Recebidos" lê arquivos_direcionados, e
    // este atalho não gravava nada ali. Sem isto, o professor descobriria pelo
    // aluno que a coordenação mandou algo para o grupo dele.
    //
    // Vale para TODOS os docentes ativos da turma, não só aquele cujo vínculo foi
    // emprestado para preencher a atividade: todos lecionam para aquele grupo, e
    // a checagem de download por disciplina alcançaria apenas um deles.
    const docentesDaTurma = await queryAsync<{ usuario_id: number; disciplina_id: number | null }>(
      `SELECT DISTINCT ON (vp.usuario_id) vp.usuario_id, vp.disciplina_id
         FROM vinculos_professores vp
         JOIN usuarios u ON u.id = vp.usuario_id AND u.deletado_em IS NULL
        WHERE vp.turma_id = ? AND vp.ativo = 1
        ORDER BY vp.usuario_id, vp.id ASC`,
      [grupo.turma_id]
    );

    for (const docente of docentesDaTurma) {
      await runAsync(
        `INSERT INTO arquivos_direcionados
           (arquivo_id, professor_id, curso_id, turma_id, disciplina_id, grupo_id, observacao, direcionado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          arquivo.id,
          docente.usuario_id,
          vinculo.curso_id,
          grupo.turma_id,
          docente.disciplina_id,
          grupo.id,
          `Material enviado pela coordenação ao grupo "${grupo.nome}" da turma ${grupo.turma_nome}. ` +
            'Os alunos do grupo já receberam este arquivo como material de apoio.',
          adminId
        ]
      );

      await runAsync(`INSERT INTO notificacoes (usuario_id, titulo, mensagem, link) VALUES (?, ?, ?, ?)`, [
        docente.usuario_id,
        'Material enviado a um grupo da sua turma',
        `A coordenação disponibilizou "${arquivo.nome_original}" ao grupo ${grupo.nome} (${grupo.turma_nome}).`,
        '/professor/materiais'
      ]);
    }

    // Só agora, com a nova publicada, as anteriores saem de cena: inverter a
    // ordem deixaria o grupo momentaneamente sem material se algo falhasse.
    let substituidas = 0;
    if (substituir && anteriores.length > 0) {
      for (const antiga of anteriores) {
        await runAsync(
          `UPDATE atividades_pbl SET status = 'SUSPENSO', deletado_em = CURRENT_TIMESTAMP,
                  atualizado_em = CURRENT_TIMESTAMP
            WHERE id = ? AND deletado_em IS NULL`,
          [antiga.id]
        );
        await runAsync(
          `UPDATE publicacoes SET status_publicacao = 'SUSPENSO' WHERE atividade_id = ?`,
          [antiga.id]
        );
        substituidas++;
      }
      await logAudit(adminId, 'SUBSTITUIR_MATERIAL_GRUPO', 'grupos', grupo.id, {
        grupoId: grupo.id,
        removidas: anteriores.map((a) => a.id),
        novaAtividadeId: atividadeId
      });
    }

    await logAudit(adminId, 'ENVIAR_ARQUIVO_PARA_GRUPO', 'atividades_pbl', atividadeId, {
      arquivoId: arquivo.id,
      grupoId: grupo.id,
      publicacaoId: pubRes.lastID,
      totalAlunos: audience.totalAlunosUnicos,
      docentesNotificados: docentesDaTurma.length
    });

    const parteDocente = docentesDaTurma.length
      ? ` ${docentesDaTurma.length} docente(s) da turma também receberam acesso ao material.`
      : ' Nenhum docente ativo vinculado à turma foi encontrado para receber o material.';

    return res.status(201).json({
      message:
        `Material publicado para ${audience.totalAlunosUnicos} aluno(s) do grupo "${grupo.nome}".` +
        parteDocente +
        (substituidas > 0 ? ` ${substituidas} material(is) anterior(es) do grupo foram substituídos.` : ''),
      atividadeId,
      codigoUnico,
      totalAlunos: audience.totalAlunosUnicos,
      totalDocentes: docentesDaTurma.length,
      substituidas
    });
  } catch (err) {
    console.error('Erro ao enviar arquivo para o grupo:', err);
    return res.status(500).json({ message: 'Erro ao enviar o arquivo para o grupo.' });
  }
}

/**
 * Quais grupos já receberam material, com o que receberam.
 *
 * Serve ao sinal na tela: antes de enviar, a coordenação precisa ver de relance
 * que um grupo já foi atendido — sem isso, distribuir quinze arquivos por trinta
 * grupos vira exercício de memória.
 */
export async function listarGruposComMaterial(_req: AuthenticatedRequest, res: Response) {
  try {
    const linhas = await queryAsync<any>(
      `SELECT sr.entidade_id AS grupo_id,
              a.id AS atividade_id, a.titulo, a.criado_em,
              ar.id AS arquivo_id, ar.nome_original
         FROM atividades_pbl a
         JOIN segmentacoes seg ON seg.atividade_id = a.id
         JOIN segmentacao_regras sr ON sr.segmentacao_id = seg.id
         LEFT JOIN versoes_atividades va ON va.atividade_id = a.id
         LEFT JOIN arquivos_atividades aa ON aa.versao_atividade_id = va.id
         LEFT JOIN arquivos ar ON ar.id = aa.arquivo_id AND ar.deletado_em IS NULL
        WHERE a.natureza = 'INFORMATIVA' AND a.deletado_em IS NULL
          AND sr.entidade_tipo = 'grupo' AND sr.acao = 'INCLUIR'
        ORDER BY sr.entidade_id, a.criado_em DESC`
    );

    // Um grupo pode ter recebido mais de um material; a tela quer o resumo.
    const porGrupo = new Map<number, { grupoId: number; total: number; materiais: any[] }>();
    for (const l of linhas) {
      const atual = porGrupo.get(l.grupo_id) || { grupoId: l.grupo_id, total: 0, materiais: [] };
      atual.total++;
      atual.materiais.push({
        atividadeId: l.atividade_id,
        titulo: l.titulo,
        arquivoId: l.arquivo_id,
        arquivoNome: l.nome_original,
        criadoEm: l.criado_em
      });
      porGrupo.set(l.grupo_id, atual);
    }

    return res.json(Array.from(porGrupo.values()));
  } catch (err) {
    console.error('Erro ao listar grupos com material:', err);
    return res.status(500).json({ message: 'Erro ao listar os grupos que já receberam material.' });
  }
}

/**
 * Quem alcança os comentários de um material: a coordenação, o docente vinculado
 * à turma e o aluno matriculado nela. O aluno de outra turma não entra — o
 * comentário é dirigido a uma turma específica, não ao arquivo em geral.
 */
async function podeVerComentarios(
  user: { id: number; perfilNome: string },
  turmaId: number
): Promise<boolean> {
  if (user.perfilNome === 'ADMIN') return true;

  if (user.perfilNome === 'PROFESSOR') {
    const vinculo = await getAsync<{ id: number }>(
      `SELECT id FROM vinculos_professores WHERE usuario_id = ? AND turma_id = ? AND ativo = 1`,
      [user.id, turmaId]
    );
    return !!vinculo;
  }

  const matricula = await getAsync<{ id: number }>(
    `SELECT id FROM matriculas WHERE usuario_id = ? AND turma_id = ? AND deletado_em IS NULL`,
    [user.id, turmaId]
  );
  return !!matricula;
}

export async function listarComentariosMaterial(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Não autenticado.' });

    const arquivoId = Number(req.params.id);
    const turmaId = Number(req.query.turmaId);
    if (!Number.isInteger(arquivoId) || !Number.isInteger(turmaId)) {
      return res.status(400).json({ message: 'Informe o arquivo e a turma.' });
    }

    if (!(await podeVerComentarios(user, turmaId))) {
      return res.status(403).json({ message: 'Você não tem vínculo com esta turma.' });
    }

    const comentarios = await queryAsync<any>(
      `SELECT cm.id, cm.texto, cm.criado_em, cm.grupo_id, cm.autor_id,
              u.nome AS autor_nome, p.nome AS autor_perfil, g.nome AS grupo_nome
         FROM comentarios_material cm
         JOIN usuarios u ON cm.autor_id = u.id
         JOIN perfis p ON u.perfil_id = p.id
         LEFT JOIN grupos g ON cm.grupo_id = g.id
        WHERE cm.arquivo_id = ? AND cm.turma_id = ? AND cm.deletado_em IS NULL
        ORDER BY cm.criado_em ASC`,
      [arquivoId, turmaId]
    );

    return res.json(comentarios);
  } catch (err) {
    console.error('Erro ao listar comentários do material:', err);
    return res.status(500).json({ message: 'Erro ao listar os comentários.' });
  }
}

/** Só o docente da turma (e a coordenação) escreve; o aluno lê. */
export async function comentarMaterial(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Não autenticado.' });

    const arquivoId = Number(req.params.id);
    const { turmaId, grupoId, texto } = req.body;
    const turma = Number(turmaId);

    if (!Number.isInteger(arquivoId) || !Number.isInteger(turma)) {
      return res.status(400).json({ message: 'Informe o arquivo e a turma.' });
    }
    const conteudo = String(texto || '').trim();
    if (!conteudo) return res.status(400).json({ message: 'Escreva o comentário antes de publicar.' });
    if (conteudo.length > 4000) {
      return res.status(400).json({ message: 'O comentário deve ter no máximo 4000 caracteres.' });
    }

    if (user.perfilNome === 'PROFESSOR') {
      const vinculo = await getAsync<{ id: number }>(
        `SELECT id FROM vinculos_professores WHERE usuario_id = ? AND turma_id = ? AND ativo = 1`,
        [user.id, turma]
      );
      if (!vinculo) return res.status(403).json({ message: 'Você não leciona nesta turma.' });
    }

    const arquivo = await getAsync<{ id: number; nome_original: string }>(
      `SELECT id, nome_original FROM arquivos WHERE id = ? AND deletado_em IS NULL`,
      [arquivoId]
    );
    if (!arquivo) return res.status(404).json({ message: 'Arquivo não encontrado.' });

    const ins = await runAsync(
      `INSERT INTO comentarios_material (arquivo_id, turma_id, grupo_id, autor_id, texto)
       VALUES (?, ?, ?, ?, ?)`,
      [arquivoId, turma, grupoId ? Number(grupoId) : null, user.id, conteudo]
    );

    // O comentário existe para ser lido: sem aviso, ficaria esperando o aluno
    // reabrir por conta própria um material que ele já consultou.
    const alunos = await queryAsync<{ usuario_id: number }>(
      `SELECT DISTINCT usuario_id FROM matriculas
        WHERE turma_id = ? AND deletado_em IS NULL` + (grupoId ? ' AND grupo_id = ?' : ''),
      grupoId ? [turma, Number(grupoId)] : [turma]
    );

    for (const aluno of alunos) {
      await runAsync(`INSERT INTO notificacoes (usuario_id, titulo, mensagem, link) VALUES (?, ?, ?, ?)`, [
        aluno.usuario_id,
        'Comentário do professor sobre um material',
        `${user.nome} comentou sobre "${arquivo.nome_original}".`,
        '/aluno/atividades'
      ]);
    }

    await logAudit(user.id, 'COMENTAR_MATERIAL', 'comentarios_material', ins.lastID, {
      arquivoId,
      turmaId: turma,
      grupoId: grupoId || null,
      alunosNotificados: alunos.length
    });

    return res.status(201).json({
      id: ins.lastID,
      message: `Comentário publicado para ${alunos.length} aluno(s) da turma.`
    });
  } catch (err) {
    console.error('Erro ao comentar material:', err);
    return res.status(500).json({ message: 'Erro ao publicar o comentário.' });
  }
}

/** O autor apaga o próprio comentário; a coordenação apaga qualquer um. */
export async function excluirComentarioMaterial(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Não autenticado.' });

    const comentarioId = Number(req.params.comentarioId);
    const comentario = await getAsync<{ id: number; autor_id: number }>(
      `SELECT id, autor_id FROM comentarios_material WHERE id = ? AND deletado_em IS NULL`,
      [comentarioId]
    );
    if (!comentario) return res.status(404).json({ message: 'Comentário não encontrado.' });

    if (user.perfilNome !== 'ADMIN' && comentario.autor_id !== user.id) {
      return res.status(403).json({ message: 'Você só pode remover os próprios comentários.' });
    }

    await runAsync(`UPDATE comentarios_material SET deletado_em = CURRENT_TIMESTAMP WHERE id = ?`, [comentarioId]);
    await logAudit(user.id, 'EXCLUIR_COMENTARIO_MATERIAL', 'comentarios_material', comentarioId);

    return res.json({ message: 'Comentário removido.' });
  } catch (err) {
    console.error('Erro ao excluir comentário:', err);
    return res.status(500).json({ message: 'Erro ao remover o comentário.' });
  }
}

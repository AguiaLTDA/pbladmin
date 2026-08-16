import { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { queryAsync, runAsync, getAsync } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../services/audit';

const uploadsDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, uniqueName);
  }
});

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

    const { originalname, filename, size, mimetype, path: filePath } = req.file;

    // Calculate MD5 hash
    const fileBuffer = fs.readFileSync(filePath);
    const hashMd5 = crypto.createHash('md5').update(fileBuffer).digest('hex');

    const category = getCategoryFromMime(mimetype, originalname);

    const resIns = await runAsync(
      `INSERT INTO arquivos (nome_original, caminho_armazenado, tamanho_bytes, mime_type, categoria, hash_md5, enviado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [originalname, filename, size, mimetype, category, hashMd5, userId]
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

    // Permission Authorization check:
    // If Student: verify if file belongs to a Published activity directed to them or their own submission
    if (user.perfilNome === 'ALUNO') {
      const isOwner = fileRow.enviado_por === user.id;

      const isActivityFile = await getAsync<{ id: number }>(
        `SELECT aa.id 
         FROM arquivos_atividades aa
         JOIN versoes_atividades va ON aa.versao_atividade_id = va.id
         JOIN atividades_pbl a ON va.atividade_id = a.id
         JOIN alunos_segmentados als ON a.id = als.atividade_id
         WHERE aa.arquivo_id = ? AND aa.aprovado_pelo_admin = 1 
           AND a.status = 'PUBLICADO' AND als.aluno_id = ?`,
        [id, user.id]
      );

      if (!isOwner && !isActivityFile) {
        return res.status(403).json({ message: 'Acesso negado para este arquivo.' });
      }
    }

    const fullPath = path.resolve(uploadsDir, fileRow.caminho_armazenado);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: 'Arquivo físico não encontrado no servidor.' });
    }

    await logAudit(user.id, 'DOWNLOAD_ARQUIVO', 'arquivos', String(id));

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileRow.nome_original)}"`);
    res.setHeader('Content-Type', fileRow.mime_type);
    return res.sendFile(fullPath);
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
      `SELECT ar.*, u.nome as enviado_por_nome 
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

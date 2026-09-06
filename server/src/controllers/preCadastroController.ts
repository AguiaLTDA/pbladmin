import { Response, Request } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { queryAsync, runAsync, getAsync } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../services/audit';

function gerarSenhaTemporaria(): string {
  // 10 caracteres alfanuméricos, fáceis de ditar/transcrever para o aluno.
  return crypto.randomBytes(8).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
}

// PUBLIC: autocadastro de estudante (antes do login)
export async function criarPreCadastro(req: Request, res: Response) {
  try {
    const { nome, email, matricula, cpf, telefone, curso, turma, periodo, origem, senha } = req.body;

    if (!nome || !email || !matricula || !curso) {
      return res.status(400).json({ message: 'Nome, e-mail, matrícula e curso são obrigatórios.' });
    }
    if (senha && String(senha).length < 6) {
      return res.status(400).json({ message: 'A senha deve ter no mínimo 6 caracteres.' });
    }

    const contaExistente = await getAsync<{ id: number }>('SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?)', [
      email
    ]);
    if (contaExistente) {
      return res.status(409).json({ message: 'Já existe uma conta com este e-mail. Faça login normalmente.' });
    }

    const pendenteExistente = await getAsync<{ id: number }>(
      `SELECT id FROM pre_cadastros WHERE LOWER(email) = LOWER(?) AND status IN ('PENDENTE', 'APROVADO')`,
      [email]
    );
    if (pendenteExistente) {
      return res.status(409).json({ message: 'Já existe um cadastro em análise para este e-mail.' });
    }

    // O aluno já escolhe a própria senha no autocadastro — só guardamos o hash aqui.
    // Se vier em branco (ex.: pré-cadastro criado pelo admin sem definir senha), a
    // aprovação cai de volta no fluxo antigo de gerar uma senha temporária.
    const senhaHash = senha ? await bcrypt.hash(String(senha), 10) : null;

    const resInsert = await runAsync(
      `INSERT INTO pre_cadastros (nome, email, matricula, cpf, telefone, curso, turma, periodo, origem, senha_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nome,
        email,
        matricula,
        cpf || null,
        telefone || null,
        curso,
        turma || null,
        periodo || null,
        origem || 'AUTOCADASTRO',
        senhaHash
      ]
    );

    return res.status(201).json({
      id: resInsert.lastID,
      status: 'PENDENTE',
      message: senhaHash
        ? 'Cadastro recebido. Após a validação da secretaria, você já poderá entrar com o e-mail e a senha que definiu.'
        : 'Cadastro recebido. Aguarde a validação da secretaria para liberar seu acesso.'
    });
  } catch (err) {
    console.error('Erro ao criar pré-cadastro:', err);
    return res.status(500).json({ message: 'Erro ao registrar o cadastro.' });
  }
}

// ADMIN: lista pré-cadastros (com filtro opcional de status)
export async function listarPreCadastros(req: AuthenticatedRequest, res: Response) {
  try {
    const { status } = req.query;
    // Nunca expõe `senha_hash` para o frontend — mesmo hasheada, não tem por que sair do servidor.
    let sql = `SELECT id, nome, email, matricula, cpf, telefone, curso, turma, periodo, origem, status,
                      usuario_id, aprovado_por, justificativa_rejeicao, criado_em, atualizado_em
               FROM pre_cadastros`;
    const params: any[] = [];

    if (status) {
      sql += ` WHERE status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY criado_em DESC`;

    const lista = await queryAsync(sql, params);
    return res.json(lista);
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao listar pré-cadastros.' });
  }
}

// ADMIN: aprova o pré-cadastro e cria a conta real do aluno
export async function aprovarPreCadastro(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    const preCadastro = await getAsync<{
      id: number;
      nome: string;
      email: string;
      status: string;
      senha_hash: string | null;
    }>('SELECT * FROM pre_cadastros WHERE id = ?', [id]);

    if (!preCadastro) return res.status(404).json({ message: 'Pré-cadastro não encontrado.' });
    if (preCadastro.status !== 'PENDENTE') {
      return res.status(400).json({ message: `Este pré-cadastro já foi ${preCadastro.status.toLowerCase()}.` });
    }

    const contaExistente = await getAsync<{ id: number }>(
      'SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?)',
      [preCadastro.email]
    );
    if (contaExistente) {
      return res.status(409).json({ message: 'Já existe uma conta de usuário com este e-mail.' });
    }

    const perfilAluno = await getAsync<{ id: number }>(`SELECT id FROM perfis WHERE nome = 'ALUNO'`);
    if (!perfilAluno) {
      return res.status(500).json({ message: 'Perfil ALUNO não está configurado no sistema.' });
    }

    // O aluno já escolheu a própria senha no autocadastro — só nesse caso não existe
    // `senha_hash` (ex.: pré-cadastro antigo ou criado pelo admin sem senha) é que
    // caímos de volta no fluxo de gerar uma senha temporária para repassar ao aluno.
    const senhaTemporaria = preCadastro.senha_hash ? undefined : gerarSenhaTemporaria();
    const senhaHash = preCadastro.senha_hash || (await bcrypt.hash(senhaTemporaria as string, 10));

    const novoUsuario = await runAsync(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil_id, ativo) VALUES (?, ?, ?, ?, 1)`,
      [preCadastro.nome, preCadastro.email, senhaHash, perfilAluno.id]
    );

    await runAsync(
      `UPDATE pre_cadastros
       SET status = 'APROVADO', usuario_id = ?, aprovado_por = ?, atualizado_em = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [novoUsuario.lastID, req.user?.id || null, id]
    );

    await logAudit(req.user?.id || null, 'APROVAR_PRE_CADASTRO', 'pre_cadastros', id, {
      email: preCadastro.email,
      usuarioId: novoUsuario.lastID
    });

    return res.json({
      message: senhaTemporaria
        ? 'Cadastro aprovado. Conta de aluno criada com sucesso.'
        : 'Cadastro aprovado. O aluno já pode entrar com a senha que definiu no cadastro.',
      usuarioId: novoUsuario.lastID,
      email: preCadastro.email,
      senhaTemporaria
    });
  } catch (err) {
    console.error('Erro ao aprovar pré-cadastro:', err);
    return res.status(500).json({ message: 'Erro ao aprovar o pré-cadastro.' });
  }
}

// ADMIN: rejeita o pré-cadastro
export async function rejeitarPreCadastro(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { justificativa } = req.body;

    const preCadastro = await getAsync<{ id: number; status: string }>('SELECT * FROM pre_cadastros WHERE id = ?', [
      id
    ]);
    if (!preCadastro) return res.status(404).json({ message: 'Pré-cadastro não encontrado.' });
    if (preCadastro.status !== 'PENDENTE') {
      return res.status(400).json({ message: `Este pré-cadastro já foi ${preCadastro.status.toLowerCase()}.` });
    }

    await runAsync(
      `UPDATE pre_cadastros
       SET status = 'REJEITADO', justificativa_rejeicao = ?, aprovado_por = ?, atualizado_em = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [justificativa || null, req.user?.id || null, id]
    );

    await logAudit(req.user?.id || null, 'REJEITAR_PRE_CADASTRO', 'pre_cadastros', id, { justificativa });

    return res.json({ message: 'Pré-cadastro rejeitado.' });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao rejeitar o pré-cadastro.' });
  }
}

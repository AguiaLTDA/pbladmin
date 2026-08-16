import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { queryAsync, runAsync, getAsync } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../services/audit';

// --- USUÁRIOS ---
export async function listUsers(req: AuthenticatedRequest, res: Response) {
  try {
    const { perfil, busca } = req.query;
    let sql = `
      SELECT u.id, u.nome, u.email, u.perfil_id, p.nome as perfil_nome, u.ativo, u.criado_em 
      FROM usuarios u 
      JOIN perfis p ON u.perfil_id = p.id 
      WHERE u.deletado_em IS NULL
    `;
    const params: any[] = [];

    if (perfil) {
      sql += ` AND p.nome = ?`;
      params.push(perfil);
    }
    if (busca) {
      sql += ` AND (LOWER(u.nome) LIKE LOWER(?) OR LOWER(u.email) LIKE LOWER(?))`;
      params.push(`%${busca}%`, `%${busca}%`);
    }
    sql += ` ORDER BY u.nome ASC`;

    const users = await queryAsync(sql, params);
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao listar usuários.' });
  }
}

export async function createUser(req: AuthenticatedRequest, res: Response) {
  try {
    const { nome, email, senha, perfilId } = req.body;
    if (!nome || !email || !senha || !perfilId) {
      return res.status(400).json({ message: 'Nome, e-mail, senha e perfil são obrigatórios.' });
    }

    const existing = await getAsync('SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?)', [email]);
    if (existing) {
      return res.status(400).json({ message: 'E-mail já cadastrado.' });
    }

    const hash = await bcrypt.hash(senha, 10);
    const resInsert = await runAsync(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil_id, ativo) VALUES (?, ?, ?, ?, 1)`,
      [nome, email, hash, perfilId]
    );

    await logAudit(req.user?.id || null, 'CRIAR_USUARIO', 'usuarios', resInsert.lastID, { nome, email, perfilId });
    return res.status(201).json({ id: resInsert.lastID, message: 'Usuário cadastrado com sucesso.' });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao cadastrar usuário.' });
  }
}

export async function toggleUserStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const user = await getAsync<{ ativo: number }>('SELECT ativo FROM usuarios WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });

    const newStatus = user.ativo ? 0 : 1;
    await runAsync('UPDATE usuarios SET ativo = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, String(id)]);

    await logAudit(req.user?.id || null, newStatus ? 'ATIVAR_USUARIO' : 'DESATIVAR_USUARIO', 'usuarios', String(id));
    return res.json({ message: `Usuário ${newStatus ? 'ativado' : 'desativado'} com sucesso.` });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao alterar status do usuário.' });
  }
}

// --- CURSOS & DISCIPLINAS ---
export async function listCourses(req: AuthenticatedRequest, res: Response) {
  try {
    const courses = await queryAsync(`SELECT * FROM cursos WHERE deletado_em IS NULL ORDER BY nome ASC`);
    return res.json(courses);
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao listar cursos.' });
  }
}

export async function createCourse(req: AuthenticatedRequest, res: Response) {
  try {
    const { codigo, nome, descricao } = req.body;
    if (!codigo || !nome) return res.status(400).json({ message: 'Código e nome são obrigatórios.' });

    const resInsert = await runAsync(`INSERT INTO cursos (codigo, nome, descricao) VALUES (?, ?, ?)`, [
      codigo,
      nome,
      descricao
    ]);
    await logAudit(req.user?.id || null, 'CRIAR_CURSO', 'cursos', resInsert.lastID, { codigo, nome });
    return res.status(201).json({ id: resInsert.lastID, message: 'Curso criado com sucesso.' });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao criar curso.' });
  }
}

export async function listDisciplines(req: AuthenticatedRequest, res: Response) {
  try {
    const { cursoId } = req.query;
    let sql = `
      SELECT d.*, c.nome as curso_nome 
      FROM disciplinas d 
      JOIN cursos c ON d.curso_id = c.id 
      WHERE d.deletado_em IS NULL
    `;
    const params: any[] = [];
    if (cursoId) {
      sql += ` AND d.curso_id = ?`;
      params.push(cursoId);
    }
    sql += ` ORDER BY d.nome ASC`;

    const list = await queryAsync(sql, params);
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao listar disciplinas.' });
  }
}

export async function createDiscipline(req: AuthenticatedRequest, res: Response) {
  try {
    const { codigo, nome, cursoId } = req.body;
    if (!codigo || !nome || !cursoId) {
      return res.status(400).json({ message: 'Código, nome e curso são obrigatórios.' });
    }
    const resInsert = await runAsync(`INSERT INTO disciplinas (codigo, nome, curso_id) VALUES (?, ?, ?)`, [
      codigo,
      nome,
      cursoId
    ]);
    await logAudit(req.user?.id || null, 'CRIAR_DISCIPLINA', 'disciplinas', resInsert.lastID, { codigo, nome });
    return res.status(201).json({ id: resInsert.lastID, message: 'Disciplina criada com sucesso.' });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao criar disciplina.' });
  }
}

// --- TURMAS & GRUPOS ---
export async function listClasses(req: AuthenticatedRequest, res: Response) {
  try {
    const { disciplinaId, periodoId } = req.query;
    let sql = `
      SELECT t.*, d.nome as disciplina_nome, d.codigo as disciplina_codigo, c.nome as curso_nome, p.nome as periodo_nome,
             (SELECT COUNT(*) FROM matriculas m WHERE m.turma_id = t.id AND m.deletado_em IS NULL) as total_alunos
      FROM turmas t 
      JOIN disciplinas d ON t.disciplina_id = d.id 
      JOIN cursos c ON d.curso_id = c.id
      JOIN periodos_letivos p ON t.periodo_letivo_id = p.id
      WHERE t.deletado_em IS NULL
    `;
    const params: any[] = [];
    if (disciplinaId) {
      sql += ` AND t.disciplina_id = ?`;
      params.push(disciplinaId);
    }
    if (periodoId) {
      sql += ` AND t.periodo_letivo_id = ?`;
      params.push(periodoId);
    }
    sql += ` ORDER BY t.nome ASC`;

    const list = await queryAsync(sql, params);
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao listar turmas.' });
  }
}

export async function createClass(req: AuthenticatedRequest, res: Response) {
  try {
    const { codigo, nome, disciplinaId, periodoLetivoId } = req.body;
    if (!codigo || !nome || !disciplinaId || !periodoLetivoId) {
      return res.status(400).json({ message: 'Código, nome, disciplina e período letivo são obrigatórios.' });
    }

    const resInsert = await runAsync(
      `INSERT INTO turmas (codigo, nome, disciplina_id, periodo_letivo_id) VALUES (?, ?, ?, ?)`,
      [codigo, nome, disciplinaId, periodoLetivoId]
    );

    await logAudit(req.user?.id || null, 'CRIAR_TURMA', 'turmas', resInsert.lastID, { codigo, nome });
    return res.status(201).json({ id: resInsert.lastID, message: 'Turma criada com sucesso.' });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao criar turma.' });
  }
}

export async function listGroups(req: AuthenticatedRequest, res: Response) {
  try {
    const { turmaId } = req.query;
    let sql = `
      SELECT g.*, t.nome as turma_nome,
             (SELECT COUNT(*) FROM matriculas m WHERE m.grupo_id = g.id AND m.deletado_em IS NULL) as total_integrantes
      FROM grupos g
      JOIN turmas t ON g.turma_id = t.id
      WHERE g.deletado_em IS NULL
    `;
    const params: any[] = [];
    if (turmaId) {
      sql += ` AND g.turma_id = ?`;
      params.push(turmaId);
    }
    sql += ` ORDER BY g.nome ASC`;

    const list = await queryAsync(sql, params);
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao listar grupos.' });
  }
}

export async function createGroup(req: AuthenticatedRequest, res: Response) {
  try {
    const { nome, turmaId } = req.body;
    if (!nome || !turmaId) return res.status(400).json({ message: 'Nome do grupo e turma são obrigatórios.' });

    const resInsert = await runAsync(`INSERT INTO grupos (nome, turma_id) VALUES (?, ?)`, [nome, turmaId]);
    await logAudit(req.user?.id || null, 'CRIAR_GRUPO', 'grupos', resInsert.lastID, { nome, turmaId });
    return res.status(201).json({ id: resInsert.lastID, message: 'Grupo criado com sucesso.' });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao criar grupo.' });
  }
}

// --- VÍNCULOS E MATRÍCULAS ---
export async function bindProfessor(req: AuthenticatedRequest, res: Response) {
  try {
    const { usuarioId, turmaId } = req.body;
    if (!usuarioId || !turmaId) return res.status(400).json({ message: 'Professor e Turma são obrigatórios.' });

    await runAsync(`INSERT OR IGNORE INTO vinculos_professores (usuario_id, turma_id) VALUES (?, ?)`, [
      usuarioId,
      turmaId
    ]);
    await logAudit(req.user?.id || null, 'VINCULAR_PROFESSOR', 'vinculos_professores', undefined, { usuarioId, turmaId });
    return res.json({ message: 'Professor vinculado à turma com sucesso.' });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao vincular professor.' });
  }
}

export async function enrollStudent(req: AuthenticatedRequest, res: Response) {
  try {
    const { usuarioId, turmaId, grupoId } = req.body;
    if (!usuarioId || !turmaId) return res.status(400).json({ message: 'Aluno e Turma são obrigatórios.' });

    const resInsert = await runAsync(
      `INSERT INTO matriculas (usuario_id, turma_id, grupo_id) VALUES (?, ?, ?)`,
      [usuarioId, turmaId, grupoId || null]
    );

    await logAudit(req.user?.id || null, 'MATRICULAR_ALUNO', 'matriculas', resInsert.lastID, { usuarioId, turmaId });
    return res.status(201).json({ message: 'Aluno matriculado com sucesso.' });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao matricular aluno.' });
  }
}

export async function listPeriods(req: AuthenticatedRequest, res: Response) {
  try {
    const list = await queryAsync(`SELECT * FROM periodos_letivos ORDER BY nome DESC`);
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao listar períodos letivos.' });
  }
}

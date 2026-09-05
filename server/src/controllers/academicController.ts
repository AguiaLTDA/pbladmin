import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { queryAsync, runAsync, getAsync } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../services/audit';
import { importarHorarioAcademico } from '../services/horarioImport';

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
      SELECT t.*, d.nome as disciplina_nome, d.codigo as disciplina_codigo,
             COALESCE(c.nome, cd.nome) as curso_nome, p.nome as periodo_nome,
             (SELECT COUNT(*) FROM matriculas m WHERE m.turma_id = t.id AND m.deletado_em IS NULL) as total_alunos
      FROM turmas t
      LEFT JOIN disciplinas d ON t.disciplina_id = d.id
      LEFT JOIN cursos c ON t.curso_id = c.id
      LEFT JOIN cursos cd ON d.curso_id = cd.id
      JOIN periodos_letivos p ON t.periodo_letivo_id = p.id
      WHERE t.deletado_em IS NULL
    `;
    const params: any[] = [];

    // O docente só enxerga as turmas em que leciona, conforme o horário acadêmico.
    if (req.user?.perfilNome === 'PROFESSOR') {
      sql += ` AND EXISTS (
        SELECT 1 FROM vinculos_professores vp
        WHERE vp.turma_id = t.id AND vp.usuario_id = ? AND vp.ativo = 1
      )`;
      params.push(req.user.id);
    }

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

    // O docente só enxerga os grupos das turmas em que leciona.
    if (req.user?.perfilNome === 'PROFESSOR') {
      sql += ` AND EXISTS (
        SELECT 1 FROM vinculos_professores vp
        WHERE vp.turma_id = g.turma_id AND vp.usuario_id = ? AND vp.ativo = 1
      )`;
      params.push(req.user.id);
    }

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
    const { usuarioId, turmaId, disciplinaId } = req.body;
    if (!usuarioId || !turmaId) return res.status(400).json({ message: 'Professor e Turma são obrigatórios.' });

    await runAsync(
      `INSERT INTO vinculos_professores (usuario_id, turma_id, disciplina_id, origem, ativo)
       VALUES (?, ?, ?, 'MANUAL', 1) ON CONFLICT DO NOTHING`,
      [usuarioId, turmaId, disciplinaId || null]
    );
    await logAudit(req.user?.id || null, 'VINCULAR_PROFESSOR', 'vinculos_professores', undefined, {
      usuarioId,
      turmaId,
      disciplinaId: disciplinaId || null
    });
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

// --- HORÁRIO ACADÊMICO ---

const ORDEM_DIAS = `CASE h.dia_semana
    WHEN 'SEGUNDA' THEN 1 WHEN 'TERCA' THEN 2 WHEN 'QUARTA' THEN 3
    WHEN 'QUINTA' THEN 4 WHEN 'SEXTA' THEN 5 ELSE 9 END`;

/**
 * Grade de aulas. O ADMIN enxerga toda a grade; o PROFESSOR enxerga
 * exclusivamente as aulas em que consta como docente.
 */
export async function listSchedule(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;
    const { cursoId, dia, professorId, turmaId } = req.query;

    let sql = `
      SELECT h.id, h.dia_semana, h.hora_inicio, h.hora_fim, h.turno, h.modalidade,
             h.modulo, h.local, h.juncao,
             c.id as curso_id, c.nome as curso_nome,
             d.id as disciplina_id, d.nome as disciplina_nome,
             u.id as professor_id, u.nome as professor_nome,
             pl.nome as periodo_nome,
             (SELECT STRING_AGG(t.nome, ' | ')
                FROM horarios_turmas ht JOIN turmas t ON ht.turma_id = t.id
               WHERE ht.horario_id = h.id) as turmas_nomes
      FROM horarios_academicos h
      JOIN cursos c ON h.curso_id = c.id
      JOIN disciplinas d ON h.disciplina_id = d.id
      JOIN usuarios u ON h.professor_id = u.id
      JOIN periodos_letivos pl ON h.periodo_letivo_id = pl.id
      WHERE h.ativo = 1
    `;
    const params: any[] = [];

    // Isolamento por perfil: docente só vê a própria grade.
    if (user?.perfilNome === 'PROFESSOR') {
      sql += ` AND h.professor_id = ?`;
      params.push(user.id);
    } else if (professorId) {
      sql += ` AND h.professor_id = ?`;
      params.push(professorId);
    }

    if (cursoId) {
      sql += ` AND h.curso_id = ?`;
      params.push(cursoId);
    }
    if (dia) {
      sql += ` AND h.dia_semana = ?`;
      params.push(String(dia).toUpperCase());
    }
    if (turmaId) {
      sql += ` AND EXISTS (SELECT 1 FROM horarios_turmas ht WHERE ht.horario_id = h.id AND ht.turma_id = ?)`;
      params.push(turmaId);
    }

    sql += ` ORDER BY c.nome ASC, ${ORDEM_DIAS}, h.hora_inicio ASC`;

    const list = await queryAsync(sql, params);
    return res.json(list);
  } catch (err) {
    console.error('Erro ao listar horário acadêmico:', err);
    return res.status(500).json({ message: 'Erro ao listar o horário acadêmico.' });
  }
}

/** Turmas e disciplinas do docente autenticado, derivadas do horário acadêmico. */
export async function listMyBindings(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Não autenticado.' });

    // O admin pode inspecionar o vínculo de um docente específico.
    const alvoId = user.perfilNome === 'ADMIN' && req.query.professorId ? Number(req.query.professorId) : user.id;

    const turmas = await queryAsync(
      `SELECT t.id, t.codigo, t.nome, t.periodo_curso, t.turno,
              c.nome as curso_nome, pl.nome as periodo_nome,
              (SELECT COUNT(*) FROM matriculas m WHERE m.turma_id = t.id AND m.deletado_em IS NULL) as total_alunos,
              (SELECT STRING_AGG(d.nome, ' | ')
                 FROM vinculos_professores v2
                 JOIN disciplinas d ON v2.disciplina_id = d.id
                WHERE v2.usuario_id = vp.usuario_id AND v2.turma_id = t.id AND v2.ativo = 1) as disciplinas_nomes
       FROM vinculos_professores vp
       JOIN turmas t ON vp.turma_id = t.id
       LEFT JOIN cursos c ON t.curso_id = c.id
       JOIN periodos_letivos pl ON t.periodo_letivo_id = pl.id
       WHERE vp.usuario_id = ? AND vp.ativo = 1 AND t.deletado_em IS NULL
       GROUP BY t.id, c.id, pl.id, vp.usuario_id
       ORDER BY c.nome ASC, t.periodo_curso ASC`,
      [alvoId]
    );

    const disciplinas = await queryAsync(
      `SELECT DISTINCT d.id, d.nome, d.codigo, c.nome as curso_nome
       FROM vinculos_professores vp
       JOIN disciplinas d ON vp.disciplina_id = d.id
       JOIN cursos c ON d.curso_id = c.id
       WHERE vp.usuario_id = ? AND vp.ativo = 1 AND d.deletado_em IS NULL
       ORDER BY c.nome ASC, d.nome ASC`,
      [alvoId]
    );

    return res.json({ professorId: alvoId, turmas, disciplinas });
  } catch (err) {
    console.error('Erro ao listar vínculos do docente:', err);
    return res.status(500).json({ message: 'Erro ao listar vínculos do docente.' });
  }
}

/** Reprocessa a grade acadêmica e recalcula os vínculos de origem 'HORARIO'. */
export async function reimportSchedule(req: AuthenticatedRequest, res: Response) {
  try {
    const stats = await importarHorarioAcademico();
    await logAudit(req.user?.id || null, 'IMPORTAR_HORARIO_ACADEMICO', 'horarios_academicos', undefined, stats);
    return res.json({ message: 'Horário acadêmico reimportado e vínculos recalculados.', ...stats });
  } catch (err: any) {
    console.error('Erro ao reimportar horário:', err);
    return res.status(500).json({ message: err.message || 'Erro ao reimportar o horário acadêmico.' });
  }
}

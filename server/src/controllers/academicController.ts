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

    const users = await queryAsync<any>(sql, params);
    // O frontend espera perfilId/perfilNome (camelCase); o SQL devolve snake_case.
    const mapped = users.map((u) => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      perfilId: u.perfil_id,
      perfilNome: u.perfil_nome,
      ativo: u.ativo,
      criado_em: u.criado_em
    }));
    return res.json(mapped);
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

// --- AUTO-MATRÍCULA E GRUPO (PORTAL DO ALUNO) ---
// O aluno se matricula na própria turma e informa o nome do grupo ao qual
// pertence. Se já existir um grupo com esse nome (mesma turma), o aluno entra
// nele — é assim que o sistema sincroniza os integrantes de um mesmo grupo
// sem que ninguém precise criar o grupo manualmente antes.

/** ALUNO: lista as próprias matrículas (turma + grupo, quando houver). */
export async function listMyEnrollment(req: AuthenticatedRequest, res: Response) {
  try {
    const alunoId = req.user?.id;
    if (!alunoId) return res.status(401).json({ message: 'Não autenticado.' });

    const list = await queryAsync(
      `SELECT m.id as matricula_id, t.id as turma_id, t.nome as turma_nome, t.codigo as turma_codigo,
              g.id as grupo_id, g.nome as grupo_nome
       FROM matriculas m
       JOIN turmas t ON m.turma_id = t.id
       LEFT JOIN grupos g ON m.grupo_id = g.id AND g.deletado_em IS NULL
       WHERE m.usuario_id = ? AND m.deletado_em IS NULL AND t.deletado_em IS NULL
       ORDER BY t.nome ASC`,
      [alunoId]
    );
    return res.json(list);
  } catch (err) {
    console.error('Erro ao listar matrículas do aluno:', err);
    return res.status(500).json({ message: 'Erro ao listar suas matrículas.' });
  }
}

/**
 * ALUNO: matricula-se (ou atualiza a matrícula existente) na turma escolhida
 * e entra no grupo informado. `grupoId` seleciona um grupo já existente na
 * turma; `grupoNome` procura um grupo com esse nome (sem diferenciar
 * maiúsculas/acentuação de caixa) e só cria um novo se nenhum existir.
 */
export async function selfEnroll(req: AuthenticatedRequest, res: Response) {
  try {
    const alunoId = req.user?.id;
    if (!alunoId) return res.status(401).json({ message: 'Não autenticado.' });

    const { turmaId, grupoId, grupoNome } = req.body;
    if (!turmaId) return res.status(400).json({ message: 'Selecione a turma.' });
    if (!grupoId && !String(grupoNome || '').trim()) {
      return res.status(400).json({ message: 'Selecione um grupo existente ou informe o nome do novo grupo.' });
    }

    const turma = await getAsync<{ id: number }>(
      `SELECT id FROM turmas WHERE id = ? AND deletado_em IS NULL AND ativo = 1`,
      [turmaId]
    );
    if (!turma) return res.status(404).json({ message: 'Turma não encontrada.' });

    let grupoFinalId: number;
    if (grupoId) {
      const grupo = await getAsync<{ id: number }>(
        `SELECT id FROM grupos WHERE id = ? AND turma_id = ? AND deletado_em IS NULL`,
        [grupoId, turmaId]
      );
      if (!grupo) return res.status(404).json({ message: 'Grupo não encontrado nesta turma.' });
      grupoFinalId = grupo.id;
    } else {
      const nomeNormalizado = String(grupoNome).trim();
      const existente = await getAsync<{ id: number }>(
        `SELECT id FROM grupos WHERE turma_id = ? AND LOWER(nome) = LOWER(?) AND deletado_em IS NULL`,
        [turmaId, nomeNormalizado]
      );
      if (existente) {
        grupoFinalId = existente.id;
      } else {
        const ins = await runAsync(`INSERT INTO grupos (nome, turma_id) VALUES (?, ?)`, [nomeNormalizado, turmaId]);
        grupoFinalId = ins.lastID;
      }
    }

    const matriculaExistente = await getAsync<{ id: number }>(
      `SELECT id FROM matriculas WHERE usuario_id = ? AND turma_id = ? AND deletado_em IS NULL`,
      [alunoId, turmaId]
    );
    if (matriculaExistente) {
      await runAsync(`UPDATE matriculas SET grupo_id = ? WHERE id = ?`, [grupoFinalId, matriculaExistente.id]);
    } else {
      await runAsync(`INSERT INTO matriculas (usuario_id, turma_id, grupo_id) VALUES (?, ?, ?)`, [
        alunoId,
        turmaId,
        grupoFinalId
      ]);
    }

    await logAudit(alunoId, 'AUTO_MATRICULA_GRUPO', 'matriculas', undefined, { turmaId, grupoId: grupoFinalId });

    const membros = await queryAsync(
      `SELECT u.id, u.nome, u.email
       FROM matriculas m
       JOIN usuarios u ON m.usuario_id = u.id
       WHERE m.grupo_id = ? AND m.deletado_em IS NULL
       ORDER BY u.nome ASC`,
      [grupoFinalId]
    );

    return res.status(200).json({
      message: 'Matrícula e grupo confirmados com sucesso.',
      grupoId: grupoFinalId,
      membros
    });
  } catch (err) {
    console.error('Erro na auto-matrícula do aluno:', err);
    return res.status(500).json({ message: 'Erro ao confirmar sua matrícula e grupo.' });
  }
}

/** Lista os integrantes (nome/e-mail) de um grupo — usado para o aluno conferir os colegas antes de entrar. */
export async function listGroupMembers(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const grupo = await getAsync<{ id: number }>(`SELECT id FROM grupos WHERE id = ? AND deletado_em IS NULL`, [id]);
    if (!grupo) return res.status(404).json({ message: 'Grupo não encontrado.' });

    const membros = await queryAsync(
      `SELECT u.id, u.nome, u.email
       FROM matriculas m
       JOIN usuarios u ON m.usuario_id = u.id
       WHERE m.grupo_id = ? AND m.deletado_em IS NULL
       ORDER BY u.nome ASC`,
      [id]
    );
    return res.json(membros);
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao listar integrantes do grupo.' });
  }
}

/**
 * ALUNO: busca colegas por nome ou e-mail para indicar diretamente para o
 * próprio grupo (em vez de depender de os dois digitarem o mesmo nome de
 * grupo). Exige pelo menos 3 caracteres e não lista o próprio requisitante,
 * para não virar uma listagem geral do corpo discente.
 */
export async function searchStudents(req: AuthenticatedRequest, res: Response) {
  try {
    const alunoId = req.user?.id;
    const termo = String(req.query.q || '').trim();
    if (termo.length < 3) {
      return res.status(400).json({ message: 'Digite ao menos 3 caracteres para buscar.' });
    }

    const resultados = await queryAsync(
      `SELECT u.id, u.nome, u.email
       FROM usuarios u
       JOIN perfis p ON u.perfil_id = p.id
       WHERE p.nome = 'ALUNO' AND u.ativo = 1 AND u.deletado_em IS NULL
         AND u.id != ?
         AND (LOWER(u.nome) LIKE LOWER(?) OR LOWER(u.email) LIKE LOWER(?))
       ORDER BY u.nome ASC
       LIMIT 8`,
      [alunoId, `%${termo}%`, `%${termo}%`]
    );
    return res.json(resultados);
  } catch (err) {
    console.error('Erro ao buscar colegas:', err);
    return res.status(500).json({ message: 'Erro ao buscar colegas.' });
  }
}

/**
 * ALUNO: indica um colega para o próprio grupo — matricula-o (se ainda não
 * estiver) na turma do grupo e o vincula a este grupo. Só quem já pertence ao
 * grupo pode chamar esta rota. Se o colega já estiver em OUTRO grupo ativo
 * nesta turma, a indicação é recusada: mover alguém de grupo sem que ele
 * mesmo peça evitaria que o próprio colega perceba/concorde com a troca.
 */
export async function addGroupMember(req: AuthenticatedRequest, res: Response) {
  try {
    const alunoId = req.user?.id;
    if (!alunoId) return res.status(401).json({ message: 'Não autenticado.' });

    const { id } = req.params;
    const { usuarioId } = req.body;
    if (!usuarioId) return res.status(400).json({ message: 'Selecione o colega que deseja indicar.' });

    const grupo = await getAsync<{ id: number; turma_id: number }>(
      `SELECT id, turma_id FROM grupos WHERE id = ? AND deletado_em IS NULL`,
      [id]
    );
    if (!grupo) return res.status(404).json({ message: 'Grupo não encontrado.' });

    const requisitanteNoGrupo = await getAsync<{ id: number }>(
      `SELECT id FROM matriculas WHERE usuario_id = ? AND grupo_id = ? AND deletado_em IS NULL`,
      [alunoId, grupo.id]
    );
    if (!requisitanteNoGrupo) {
      return res.status(403).json({ message: 'Você só pode indicar colegas para um grupo ao qual já pertence.' });
    }

    const colega = await getAsync<{ id: number }>(
      `SELECT u.id FROM usuarios u JOIN perfis p ON u.perfil_id = p.id
       WHERE u.id = ? AND p.nome = 'ALUNO' AND u.ativo = 1 AND u.deletado_em IS NULL`,
      [usuarioId]
    );
    if (!colega) return res.status(404).json({ message: 'Aluno não encontrado.' });

    const matriculaColega = await getAsync<{ id: number; grupo_id: number | null }>(
      `SELECT id, grupo_id FROM matriculas WHERE usuario_id = ? AND turma_id = ? AND deletado_em IS NULL`,
      [usuarioId, grupo.turma_id]
    );

    if (matriculaColega) {
      if (matriculaColega.grupo_id === grupo.id) {
        return res.status(200).json({ message: 'Este colega já está no grupo.' });
      }
      if (matriculaColega.grupo_id) {
        return res.status(409).json({
          message: 'Este colega já pertence a outro grupo nesta turma. Peça para ele trocar de grupo pelo próprio portal dele.'
        });
      }
      await runAsync(`UPDATE matriculas SET grupo_id = ? WHERE id = ?`, [grupo.id, matriculaColega.id]);
    } else {
      await runAsync(`INSERT INTO matriculas (usuario_id, turma_id, grupo_id) VALUES (?, ?, ?)`, [
        usuarioId,
        grupo.turma_id,
        grupo.id
      ]);
    }

    await logAudit(alunoId, 'INDICAR_COLEGA_GRUPO', 'matriculas', undefined, { grupoId: grupo.id, usuarioId });

    const membros = await queryAsync(
      `SELECT u.id, u.nome, u.email
       FROM matriculas m
       JOIN usuarios u ON m.usuario_id = u.id
       WHERE m.grupo_id = ? AND m.deletado_em IS NULL
       ORDER BY u.nome ASC`,
      [grupo.id]
    );

    return res.status(200).json({ message: 'Colega adicionado ao grupo com sucesso.', membros });
  } catch (err) {
    console.error('Erro ao indicar colega para o grupo:', err);
    return res.status(500).json({ message: 'Erro ao indicar o colega para o grupo.' });
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

// --- ARQUIVO ORIENTADOR VINCULADO À CONTA DO PROFESSOR ---
// Suprido pelo Admin: liga um arquivo já enviado a uma conta de professor já
// existente. Só um vínculo ativo por professor — o admin ou o próprio
// professor podem substituí-lo, o que desativa o vínculo anterior.

async function desativarOrientadorAtivo(professorId: number) {
  await runAsync(`UPDATE arquivos_orientadores SET ativo = 0 WHERE professor_id = ? AND ativo = 1`, [professorId]);
}

/** ADMIN: vincula (ou substitui) o arquivo orientador de um professor. */
export async function linkOrientadorFile(req: AuthenticatedRequest, res: Response) {
  try {
    const { professorId, arquivoId, rotulo } = req.body;
    if (!professorId || !arquivoId) {
      return res.status(400).json({ message: 'Professor e arquivo são obrigatórios.' });
    }

    const professor = await getAsync<{ id: number }>(
      `SELECT id FROM usuarios WHERE id = ? AND perfil_id = 2 AND deletado_em IS NULL`,
      [professorId]
    );
    if (!professor) return res.status(404).json({ message: 'Professor não encontrado.' });

    const arquivo = await getAsync<{ id: number }>(`SELECT id FROM arquivos WHERE id = ? AND deletado_em IS NULL`, [
      arquivoId
    ]);
    if (!arquivo) return res.status(404).json({ message: 'Arquivo não encontrado.' });

    await desativarOrientadorAtivo(professorId);
    const ins = await runAsync(
      `INSERT INTO arquivos_orientadores (professor_id, arquivo_id, vinculado_por, rotulo, ativo) VALUES (?, ?, ?, ?, 1)`,
      [professorId, arquivoId, req.user?.id || null, rotulo || 'Arquivos Orientadores 01']
    );

    await logAudit(req.user?.id || null, 'VINCULAR_ARQUIVO_ORIENTADOR', 'arquivos_orientadores', ins.lastID, {
      professorId,
      arquivoId
    });
    return res.status(201).json({ id: ins.lastID, message: 'Arquivo orientador vinculado ao professor com sucesso.' });
  } catch (err) {
    console.error('Erro ao vincular arquivo orientador:', err);
    return res.status(500).json({ message: 'Erro ao vincular arquivo orientador.' });
  }
}

/** ADMIN: lista todos os professores e o arquivo orientador atualmente vinculado a cada um. */
export async function listOrientadorFiles(req: AuthenticatedRequest, res: Response) {
  try {
    const list = await queryAsync(
      `SELECT u.id as professor_id, u.nome as professor_nome, u.email as professor_email,
              ao.id as vinculo_id, ao.criado_em as vinculado_em, ao.rotulo, ao.replicado_em,
              ar.id as arquivo_id, ar.nome_original, ar.tamanho_bytes, ar.mime_type, ar.categoria,
              vb.nome as vinculado_por_nome
       FROM usuarios u
       LEFT JOIN arquivos_orientadores ao ON ao.professor_id = u.id AND ao.ativo = 1
       LEFT JOIN arquivos ar ON ao.arquivo_id = ar.id AND ar.deletado_em IS NULL
       LEFT JOIN usuarios vb ON ao.vinculado_por = vb.id
       WHERE u.perfil_id = 2 AND u.deletado_em IS NULL
       ORDER BY u.nome ASC`
    );
    return res.json(list);
  } catch (err) {
    console.error('Erro ao listar arquivos orientadores:', err);
    return res.status(500).json({ message: 'Erro ao listar arquivos orientadores.' });
  }
}

/** ADMIN: remove o vínculo ativo do professor (sem substituir por outro arquivo). */
export async function unlinkOrientadorFile(req: AuthenticatedRequest, res: Response) {
  try {
    const { professorId } = req.params;
    await desativarOrientadorAtivo(Number(professorId));
    await logAudit(req.user?.id || null, 'DESVINCULAR_ARQUIVO_ORIENTADOR', 'arquivos_orientadores', String(professorId));
    return res.json({ message: 'Arquivo orientador desvinculado do professor.' });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao desvincular arquivo orientador.' });
  }
}

/** PROFESSOR: consulta o próprio arquivo orientador vigente. */
export async function getMyOrientadorFile(req: AuthenticatedRequest, res: Response) {
  try {
    const professorId = req.user?.id;
    const row = await getAsync(
      `SELECT ao.id as vinculo_id, ao.criado_em as vinculado_em, ao.rotulo,
              ar.id as arquivo_id, ar.nome_original, ar.tamanho_bytes, ar.mime_type, ar.categoria
       FROM arquivos_orientadores ao
       JOIN arquivos ar ON ao.arquivo_id = ar.id AND ar.deletado_em IS NULL
       WHERE ao.professor_id = ? AND ao.ativo = 1`,
      [professorId]
    );
    return res.json(row || null);
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao buscar o arquivo orientador.' });
  }
}

/**
 * PROFESSOR: envia uma sugestão/comentário de revisão sobre o arquivo
 * orientador vigente, amarrada a uma das disciplinas que leciona. É um
 * registro de retorno (append-only) — não existe edição posterior.
 */
export async function addOrientadorComment(req: AuthenticatedRequest, res: Response) {
  try {
    const professorId = req.user?.id;
    const { disciplinaId, texto } = req.body;
    if (!professorId) return res.status(401).json({ message: 'Não autenticado.' });
    if (!disciplinaId || !texto || !String(texto).trim()) {
      return res.status(400).json({ message: 'Disciplina e texto da sugestão são obrigatórios.' });
    }

    const vinculoAtivo = await getAsync<{ id: number }>(
      `SELECT id FROM arquivos_orientadores WHERE professor_id = ? AND ativo = 1`,
      [professorId]
    );
    if (!vinculoAtivo) {
      return res.status(404).json({ message: 'Você ainda não possui um arquivo orientador vinculado.' });
    }

    const disciplinaPermitida = await getAsync<{ id: number }>(
      `SELECT id FROM vinculos_professores WHERE usuario_id = ? AND disciplina_id = ? AND ativo = 1`,
      [professorId, disciplinaId]
    );
    if (!disciplinaPermitida) {
      return res.status(403).json({ message: 'Esta disciplina não está entre as que você leciona.' });
    }

    const ins = await runAsync(
      `INSERT INTO comentarios_orientador (arquivo_orientador_id, professor_id, disciplina_id, texto)
       VALUES (?, ?, ?, ?)`,
      [vinculoAtivo.id, professorId, disciplinaId, String(texto).trim()]
    );

    await logAudit(professorId, 'SUGERIR_ALTERACAO_ARQUIVO_ORIENTADOR', 'comentarios_orientador', ins.lastID, {
      disciplinaId
    });
    return res.status(201).json({ id: ins.lastID, message: 'Sugestão enviada para a coordenação.' });
  } catch (err) {
    console.error('Erro ao registrar sugestão do arquivo orientador:', err);
    return res.status(500).json({ message: 'Erro ao enviar a sugestão.' });
  }
}

/** PROFESSOR: histórico das próprias sugestões sobre o arquivo orientador. */
export async function listMyOrientadorComments(req: AuthenticatedRequest, res: Response) {
  try {
    const professorId = req.user?.id;
    const list = await queryAsync(
      `SELECT co.id, co.texto, co.criado_em, d.nome as disciplina_nome, d.codigo as disciplina_codigo
       FROM comentarios_orientador co
       JOIN disciplinas d ON co.disciplina_id = d.id
       WHERE co.professor_id = ?
       ORDER BY co.criado_em DESC`,
      [professorId]
    );
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao buscar suas sugestões.' });
  }
}

/**
 * ADMIN: lista todas as sugestões/comentários dos professores sobre os
 * arquivos orientadores, para a aba "Revisão pelos Professores" (organizada
 * no frontend por docente e por disciplina). Somente consulta — o admin não
 * edita o conteúdo aqui.
 */
export async function listOrientadorReviews(req: AuthenticatedRequest, res: Response) {
  try {
    const list = await queryAsync(
      `SELECT co.id, co.texto, co.criado_em,
              u.id as professor_id, u.nome as professor_nome, u.email as professor_email,
              d.id as disciplina_id, d.nome as disciplina_nome, d.codigo as disciplina_codigo,
              c.nome as curso_nome,
              ar.nome_original as arquivo_nome, ao.rotulo
       FROM comentarios_orientador co
       JOIN usuarios u ON co.professor_id = u.id
       JOIN disciplinas d ON co.disciplina_id = d.id
       LEFT JOIN cursos c ON d.curso_id = c.id
       JOIN arquivos_orientadores ao ON co.arquivo_orientador_id = ao.id
       JOIN arquivos ar ON ao.arquivo_id = ar.id
       ORDER BY u.nome ASC, d.nome ASC, co.criado_em DESC`
    );
    return res.json(list);
  } catch (err) {
    console.error('Erro ao listar revisões dos professores:', err);
    return res.status(500).json({ message: 'Erro ao listar as revisões dos professores.' });
  }
}

/**
 * PROFESSOR: edita o arquivo orientador — substitui a versão vigente por um
 * arquivo já enviado via /files/upload. O vínculo anterior é desativado, não
 * apagado, preservando o histórico de quem vinculou o quê e quando.
 */
export async function replaceMyOrientadorFile(req: AuthenticatedRequest, res: Response) {
  try {
    const professorId = req.user?.id;
    const { arquivoId } = req.body;
    if (!professorId) return res.status(401).json({ message: 'Não autenticado.' });
    if (!arquivoId) return res.status(400).json({ message: 'Arquivo é obrigatório.' });

    const arquivo = await getAsync<{ id: number; enviado_por: number }>(
      `SELECT id, enviado_por FROM arquivos WHERE id = ? AND deletado_em IS NULL`,
      [arquivoId]
    );
    if (!arquivo) return res.status(404).json({ message: 'Arquivo não encontrado.' });
    if (arquivo.enviado_por !== professorId) {
      return res.status(403).json({ message: 'Você só pode vincular um arquivo enviado por você mesmo.' });
    }

    await desativarOrientadorAtivo(professorId);
    const ins = await runAsync(
      `INSERT INTO arquivos_orientadores (professor_id, arquivo_id, vinculado_por, ativo) VALUES (?, ?, ?, 1)`,
      [professorId, arquivoId, professorId]
    );

    await logAudit(professorId, 'EDITAR_ARQUIVO_ORIENTADOR', 'arquivos_orientadores', ins.lastID, { arquivoId });
    return res.status(201).json({ id: ins.lastID, message: 'Arquivo orientador atualizado com sucesso.' });
  } catch (err) {
    console.error('Erro ao editar arquivo orientador:', err);
    return res.status(500).json({ message: 'Erro ao editar o arquivo orientador.' });
  }
}

/**
 * ADMIN: aprova o arquivo orientador vigente de um professor e o replica em
 * novas atividades PBL (uma por disciplina que ele leciona), já com as
 * turmas correspondentes pré-designadas via segmentação e o próprio PDF do
 * kit anexado como material de referência. As atividades nascem em
 * RASCUNHO — o admin ainda preenche o conteúdo pedagógico e segue o fluxo
 * normal de aprovação/publicação. Só pode ser executado uma vez por vínculo
 * (evita duplicar atividades); vincular um novo arquivo permite replicar de novo.
 */
export async function aprovarEReplicarOrientador(req: AuthenticatedRequest, res: Response) {
  try {
    const adminId = req.user?.id;
    const { professorId } = req.params;
    if (!adminId) return res.status(401).json({ message: 'Não autenticado.' });

    const vinculo = await getAsync<{ id: number; arquivo_id: number; rotulo: string; replicado_em: string | null }>(
      `SELECT id, arquivo_id, rotulo, replicado_em FROM arquivos_orientadores WHERE professor_id = ? AND ativo = 1`,
      [professorId]
    );
    if (!vinculo) {
      return res.status(404).json({ message: 'Este professor não possui arquivo orientador vinculado.' });
    }
    if (vinculo.replicado_em) {
      return res.status(400).json({
        message: 'Este arquivo orientador já foi aprovado e replicado. Vincule uma nova versão para replicar novamente.'
      });
    }

    const professor = await getAsync<{ id: number; nome: string }>(
      `SELECT id, nome FROM usuarios WHERE id = ? AND perfil_id = 2 AND deletado_em IS NULL`,
      [professorId]
    );
    if (!professor) return res.status(404).json({ message: 'Professor não encontrado.' });

    const vinculosDisciplina = await queryAsync<{
      disciplina_id: number;
      disciplina_nome: string;
      curso_id: number;
      periodo_letivo_id: number;
      turma_id: number;
      turma_nome: string;
    }>(
      `SELECT DISTINCT vp.disciplina_id, d.nome as disciplina_nome, d.curso_id,
              t.periodo_letivo_id, t.id as turma_id, t.nome as turma_nome
       FROM vinculos_professores vp
       JOIN turmas t ON vp.turma_id = t.id
       JOIN disciplinas d ON vp.disciplina_id = d.id
       WHERE vp.usuario_id = ? AND vp.ativo = 1 AND vp.disciplina_id IS NOT NULL
         AND t.deletado_em IS NULL AND d.deletado_em IS NULL`,
      [professorId]
    );

    if (vinculosDisciplina.length === 0) {
      return res.status(400).json({
        message: 'Este professor não possui disciplinas/turmas vinculadas — nada para replicar.'
      });
    }

    // Agrupa por disciplina + período letivo: uma atividade PBL por grupo,
    // reunindo todas as turmas daquele grupo para a segmentação.
    const grupos = new Map<
      string,
      { disciplinaId: number; disciplinaNome: string; cursoId: number; periodoLetivoId: number; turmas: { id: number; nome: string }[] }
    >();
    for (const v of vinculosDisciplina) {
      const chave = `${v.disciplina_id}-${v.periodo_letivo_id}`;
      if (!grupos.has(chave)) {
        grupos.set(chave, {
          disciplinaId: v.disciplina_id,
          disciplinaNome: v.disciplina_nome,
          cursoId: v.curso_id,
          periodoLetivoId: v.periodo_letivo_id,
          turmas: []
        });
      }
      grupos.get(chave)!.turmas.push({ id: v.turma_id, nome: v.turma_nome });
    }

    const atividadesCriadas: { id: number; disciplinaNome: string; totalTurmas: number }[] = [];
    let contador = 0;

    for (const grupo of grupos.values()) {
      contador += 1;
      const codigoUnico = `PBL-${Date.now().toString(36).toUpperCase()}-${contador}`;
      const titulo = `${vinculo.rotulo || 'Arquivo Orientador'} — ${grupo.disciplinaNome}`;

      const sugestoes = await queryAsync<{ texto: string; criado_em: string }>(
        `SELECT texto, criado_em FROM comentarios_orientador
         WHERE arquivo_orientador_id = ? AND disciplina_id = ? ORDER BY criado_em ASC`,
        [vinculo.id, grupo.disciplinaId]
      );
      const observacoesInternas =
        sugestoes.length > 0
          ? `Sugestões do professor ${professor.nome} sobre o material (via Arquivo Orientador):\n` +
            sugestoes.map((s) => `- ${new Date(s.criado_em).toLocaleDateString('pt-BR')}: ${s.texto}`).join('\n')
          : null;

      const atRes = await runAsync(
        `INSERT INTO atividades_pbl (codigo_unico, titulo, curso_id, disciplina_id, professor_id, periodo_letivo_id, status, versao_atual)
         VALUES (?, ?, ?, ?, ?, ?, 'RASCUNHO', 1)`,
        [codigoUnico, titulo, grupo.cursoId, grupo.disciplinaId, professorId, grupo.periodoLetivoId]
      );
      const atividadeId = atRes.lastID;

      const verRes = await runAsync(
        `INSERT INTO versoes_atividades (atividade_id, numero_versao, observacoes_internas_admin, criado_por)
         VALUES (?, 1, ?, ?)`,
        [atividadeId, observacoesInternas, adminId]
      );

      await runAsync(
        `INSERT INTO arquivos_atividades (versao_atividade_id, arquivo_id, aprovado_pelo_admin, versao_material)
         VALUES (?, ?, 1, ?)`,
        [verRes.lastID, vinculo.arquivo_id, vinculo.rotulo || 'Arquivos Orientadores 01']
      );

      const segRes = await runAsync(`INSERT INTO segmentacoes (atividade_id, tipo_segmentacao) VALUES (?, 'TURMA')`, [
        atividadeId
      ]);
      for (const t of grupo.turmas) {
        await runAsync(
          `INSERT INTO segmentacao_regras (segmentacao_id, entidade_tipo, entidade_id, acao) VALUES (?, 'turma', ?, 'INCLUIR')`,
          [segRes.lastID, t.id]
        );
      }

      atividadesCriadas.push({ id: atividadeId, disciplinaNome: grupo.disciplinaNome, totalTurmas: grupo.turmas.length });
    }

    await runAsync(`UPDATE arquivos_orientadores SET replicado_em = CURRENT_TIMESTAMP, replicado_por = ? WHERE id = ?`, [
      adminId,
      vinculo.id
    ]);

    await runAsync(
      `INSERT INTO notificacoes (usuario_id, titulo, mensagem, link) VALUES (?, ?, ?, ?)`,
      [
        professorId,
        'Arquivo Orientador aprovado',
        `Seu material orientativo foi aprovado pela coordenação e originou ${atividadesCriadas.length} nova(s) atividade(s) PBL.`,
        `/professor/atividades`
      ]
    );

    await logAudit(adminId, 'APROVAR_REPLICAR_ARQUIVO_ORIENTADOR', 'arquivos_orientadores', vinculo.id, {
      professorId,
      atividadesCriadas
    });

    return res.status(201).json({
      message: `Arquivo orientador aprovado e replicado em ${atividadesCriadas.length} atividade(s) PBL.`,
      atividades: atividadesCriadas
    });
  } catch (err) {
    console.error('Erro ao aprovar e replicar arquivo orientador:', err);
    return res.status(500).json({ message: 'Erro ao aprovar e replicar o arquivo orientador.' });
  }
}

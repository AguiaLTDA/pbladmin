import bcrypt from 'bcryptjs';
import { getAsync, queryAsync, runAsync } from '../config/db';
import {
  AulaHorario,
  HORARIO_ACADEMICO,
  PERIODO_LETIVO_HORARIO,
  SIGLAS_CURSO
} from '../db/horarioAcademico';

const PERFIL_PROFESSOR = 2;

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function slug(texto: string, max = 40): string {
  return semAcento(texto)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max);
}

function siglaCurso(curso: string): string {
  return SIGLAS_CURSO[curso] || slug(curso, 8);
}

/** '2º Administração' -> 2 */
function periodoDaTurma(rotulo: string): number | null {
  const m = rotulo.match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

/** 'Nilvans Fernandes Borges' -> 'prof.nilvans.borges@pbl.edu.br' */
function emailDoProfessor(nome: string): string {
  const partes = semAcento(nome)
    .toLowerCase()
    .split(/\s+/)
    .filter((p) => p.length > 2 && !['dos', 'das', 'de', 'da', 'do', 'e'].includes(p));
  const primeiro = partes[0] || 'docente';
  const ultimo = partes.length > 1 ? partes[partes.length - 1] : '';
  const local = ultimo ? `${primeiro}.${ultimo}` : primeiro;
  return `prof.${local}@pbl.edu.br`;
}

interface ImportStats {
  cursos: number;
  disciplinas: number;
  turmas: number;
  professores: number;
  professoresCriados: number;
  aulas: number;
  vinculos: number;
}

/**
 * Importa a grade de horário acadêmico e deriva dela os vínculos
 * Professor <-> Turma <-> Disciplina.
 *
 * Idempotente: registros de origem 'HORARIO' são recalculados a cada execução;
 * vínculos manuais criados pelo admin são preservados.
 */
export async function importarHorarioAcademico(
  aulas: AulaHorario[] = HORARIO_ACADEMICO
): Promise<ImportStats> {
  const stats: ImportStats = {
    cursos: 0,
    disciplinas: 0,
    turmas: 0,
    professores: 0,
    professoresCriados: 0,
    aulas: 0,
    vinculos: 0
  };

  // 1. Período letivo da grade
  let periodo = await getAsync<{ id: number }>('SELECT id FROM periodos_letivos WHERE nome = ?', [
    PERIODO_LETIVO_HORARIO.nome
  ]);
  if (!periodo) {
    const ins = await runAsync(
      `INSERT INTO periodos_letivos (nome, data_inicio, data_fim, ativo) VALUES (?, ?, ?, 1)`,
      [PERIODO_LETIVO_HORARIO.nome, PERIODO_LETIVO_HORARIO.dataInicio, PERIODO_LETIVO_HORARIO.dataFim]
    );
    periodo = { id: ins.lastID };
  }
  const periodoLetivoId = periodo.id;

  // 2. Limpa o que foi derivado da grade em execuções anteriores
  await runAsync(`DELETE FROM horarios_turmas WHERE horario_id IN (SELECT id FROM horarios_academicos)`);
  await runAsync(`DELETE FROM horarios_academicos`);
  await runAsync(`DELETE FROM vinculos_professores WHERE origem = 'HORARIO'`);

  const senhaPadrao = await bcrypt.hash('prof123', 10);

  const cacheCurso = new Map<string, number>();
  const cacheDisciplina = new Map<string, number>();
  const cacheTurma = new Map<string, number>();
  const cacheProfessor = new Map<string, number>();

  async function idDoCurso(nome: string): Promise<number> {
    const cached = cacheCurso.get(nome);
    if (cached) return cached;

    const codigo = siglaCurso(nome);
    let row = await getAsync<{ id: number }>(
      'SELECT id FROM cursos WHERE codigo = ? OR LOWER(nome) = LOWER(?)',
      [codigo, nome]
    );
    if (!row) {
      const ins = await runAsync(`INSERT INTO cursos (codigo, nome, descricao, ativo) VALUES (?, ?, ?, 1)`, [
        codigo,
        nome,
        `Curso de ${nome} — grade noturna importada do horário acadêmico.`
      ]);
      row = { id: ins.lastID };
      stats.cursos++;
    }
    cacheCurso.set(nome, row.id);
    return row.id;
  }

  async function idDaDisciplina(nomeCurso: string, nomeDisciplina: string): Promise<number> {
    const chave = `${nomeCurso}::${nomeDisciplina}`;
    const cached = cacheDisciplina.get(chave);
    if (cached) return cached;

    const cursoId = await idDoCurso(nomeCurso);
    const codigo = `${siglaCurso(nomeCurso)}-${slug(nomeDisciplina, 28)}`;

    let row = await getAsync<{ id: number }>(
      'SELECT id FROM disciplinas WHERE curso_id = ? AND LOWER(nome) = LOWER(?) AND deletado_em IS NULL',
      [cursoId, nomeDisciplina]
    );
    if (!row) {
      const ins = await runAsync(`INSERT INTO disciplinas (codigo, nome, curso_id, ativo) VALUES (?, ?, ?, 1)`, [
        codigo,
        nomeDisciplina,
        cursoId
      ]);
      row = { id: ins.lastID };
      stats.disciplinas++;
    }
    cacheDisciplina.set(chave, row.id);
    return row.id;
  }

  async function idDaTurma(nomeCurso: string, rotuloTurma: string, turno: string): Promise<number> {
    const cached = cacheTurma.get(rotuloTurma);
    if (cached) return cached;

    const cursoId = await idDoCurso(nomeCurso);
    const periodoCurso = periodoDaTurma(rotuloTurma);
    const codigo = `${siglaCurso(nomeCurso)}-${periodoCurso ?? slug(rotuloTurma, 6)}`;

    let row = await getAsync<{ id: number }>(
      'SELECT id FROM turmas WHERE codigo = ? AND periodo_letivo_id = ? AND deletado_em IS NULL',
      [codigo, periodoLetivoId]
    );
    if (!row) {
      const ins = await runAsync(
        `INSERT INTO turmas (codigo, nome, curso_id, periodo_curso, turno, periodo_letivo_id, ativo)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [codigo, rotuloTurma, cursoId, periodoCurso, turno, periodoLetivoId]
      );
      row = { id: ins.lastID };
      stats.turmas++;
    } else {
      await runAsync(`UPDATE turmas SET nome = ?, curso_id = ?, periodo_curso = ?, turno = ? WHERE id = ?`, [
        rotuloTurma,
        cursoId,
        periodoCurso,
        turno,
        row.id
      ]);
    }
    cacheTurma.set(rotuloTurma, row.id);
    return row.id;
  }

  async function idDoProfessor(nome: string): Promise<number> {
    const cached = cacheProfessor.get(nome);
    if (cached) return cached;

    // 1) casa pelo nome exato; 2) pelo e-mail derivado; 3) cria.
    let row = await getAsync<{ id: number }>(
      'SELECT id FROM usuarios WHERE LOWER(nome) = LOWER(?) AND deletado_em IS NULL',
      [nome]
    );

    if (!row) {
      const email = emailDoProfessor(nome);
      row = await getAsync<{ id: number }>('SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?)', [email]);

      if (!row) {
        const ins = await runAsync(
          `INSERT INTO usuarios (nome, email, senha_hash, perfil_id, ativo) VALUES (?, ?, ?, ?, 1)`,
          [nome, email, senhaPadrao, PERFIL_PROFESSOR]
        );
        row = { id: ins.lastID };
        stats.professoresCriados++;
      }
    }

    cacheProfessor.set(nome, row.id);
    stats.professores = cacheProfessor.size;
    return row.id;
  }

  // 3. Grava a grade e deriva os vínculos
  for (const a of aulas) {
    const cursoId = await idDoCurso(a.curso);
    const disciplinaId = await idDaDisciplina(a.curso, a.disciplina);
    const professorId = await idDoProfessor(a.professor);

    const horario = await runAsync(
      `INSERT INTO horarios_academicos (
        curso_id, disciplina_id, professor_id, periodo_letivo_id, dia_semana,
        hora_inicio, hora_fim, turno, modalidade, modulo, local, juncao, ativo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        cursoId,
        disciplinaId,
        professorId,
        periodoLetivoId,
        a.dia,
        a.horaInicio,
        a.horaFim,
        a.turno,
        a.modalidade,
        a.modulo,
        a.local,
        a.juncao
      ]
    );
    stats.aulas++;

    for (const rotulo of a.turmas) {
      const turmaId = await idDaTurma(a.curso, rotulo, a.turno);

      await runAsync(
        `INSERT INTO horarios_turmas (horario_id, turma_id) VALUES (?, ?) ON CONFLICT DO NOTHING`,
        [horario.lastID, turmaId]
      );

      const vinculo = await runAsync(
        `INSERT INTO vinculos_professores (usuario_id, turma_id, disciplina_id, origem, ativo)
         VALUES (?, ?, ?, 'HORARIO', 1) ON CONFLICT DO NOTHING`,
        [professorId, turmaId, disciplinaId]
      );
      if (vinculo.changes > 0) stats.vinculos++;
    }
  }

  return stats;
}

/** Turmas em que o docente leciona, segundo o horário acadêmico. */
export async function turmasDoProfessor(professorId: number): Promise<number[]> {
  const rows = await queryAsync<{ turma_id: number }>(
    `SELECT DISTINCT vp.turma_id
     FROM vinculos_professores vp
     JOIN turmas t ON vp.turma_id = t.id
     WHERE vp.usuario_id = ? AND vp.ativo = 1 AND t.deletado_em IS NULL`,
    [professorId]
  );
  return rows.map((r) => r.turma_id);
}

/** Disciplinas que o docente leciona, segundo o horário acadêmico. */
export async function disciplinasDoProfessor(professorId: number): Promise<number[]> {
  const rows = await queryAsync<{ disciplina_id: number }>(
    `SELECT DISTINCT vp.disciplina_id
     FROM vinculos_professores vp
     WHERE vp.usuario_id = ? AND vp.ativo = 1 AND vp.disciplina_id IS NOT NULL`,
    [professorId]
  );
  return rows.map((r) => r.disciplina_id);
}

/**
 * Regra central de autorização do docente: ele alcança uma atividade PBL se
 * a criou OU se a atividade foi segmentada para alguma turma que ele leciona.
 */
export async function professorAlcancaAtividade(professorId: number, atividadeId: number | string): Promise<boolean> {
  const row = await getAsync<{ total: number }>(
    `SELECT COUNT(*) as total FROM (
        SELECT 1 FROM atividades_pbl a
        WHERE a.id = ? AND a.professor_id = ?

        UNION

        SELECT 1
        FROM vinculos_professores vp
        JOIN matriculas m ON m.turma_id = vp.turma_id AND m.deletado_em IS NULL
        JOIN alunos_segmentados als ON als.aluno_id = m.usuario_id
        WHERE vp.usuario_id = ? AND vp.ativo = 1 AND als.atividade_id = ?

        UNION

        SELECT 1
        FROM vinculos_professores vp
        JOIN atividades_pbl a ON a.disciplina_id = vp.disciplina_id
        WHERE vp.usuario_id = ? AND vp.ativo = 1 AND a.id = ?
     )`,
    [atividadeId, professorId, professorId, atividadeId, professorId, atividadeId]
  );
  return (row?.total || 0) > 0;
}

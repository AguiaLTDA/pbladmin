import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { BookOpen, Layers, Users, Plus, UserCheck, GraduationCap } from 'lucide-react';

export const AcademicAdminView: React.FC = () => {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'cursos' | 'disciplinas' | 'turmas' | 'grupos' | 'vinculos'>('turmas');

  const [courses, setCourses] = useState<any[]>([]);
  const [disciplines, setDisciplines] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [professors, setProfessors] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);

  // Modais Forms
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');

  const [showClassModal, setShowClassModal] = useState(false);
  const [classCode, setClassCode] = useState('');
  const [className, setClassName] = useState('');
  const [classDisciplineId, setClassDisciplineId] = useState<number | ''>('');

  const [showBindModal, setShowBindModal] = useState(false);
  const [bindProfId, setBindProfId] = useState<number | ''>('');
  const [bindClassId, setBindClassId] = useState<number | ''>('');

  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollStudentId, setEnrollStudentId] = useState<number | ''>('');
  const [enrollClassId, setEnrollClassId] = useState<number | ''>('');
  const [enrollGroupId, setEnrollGroupId] = useState<number | ''>('');

  const reloadData = () => {
    Promise.all([
      apiRequest('/academic/courses'),
      apiRequest('/academic/disciplines'),
      apiRequest('/academic/classes'),
      apiRequest('/academic/groups'),
      apiRequest('/academic/users?perfil=PROFESSOR'),
      apiRequest('/academic/users?perfil=ALUNO'),
      apiRequest('/academic/periods')
    ])
      .then(([c, d, cl, g, p, s, per]) => {
        setCourses(c);
        setDisciplines(d);
        setClasses(cl);
        setGroups(g);
        setProfessors(p);
        setStudents(s);
        setPeriods(per);
      })
      .catch((err) => showToast(err.message, 'error'));
  };

  useEffect(() => {
    reloadData();
  }, []);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/academic/courses', {
        method: 'POST',
        body: JSON.stringify({ codigo: courseCode, nome: courseName })
      });
      showToast('Curso criado com sucesso!', 'success');
      setShowCourseModal(false);
      setCourseCode('');
      setCourseName('');
      reloadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classDisciplineId || periods.length === 0) return;
    try {
      await apiRequest('/academic/classes', {
        method: 'POST',
        body: JSON.stringify({
          codigo: classCode,
          nome: className,
          disciplinaId: Number(classDisciplineId),
          periodoLetivoId: periods[0].id
        })
      });
      showToast('Turma criada com sucesso!', 'success');
      setShowClassModal(false);
      setClassCode('');
      setClassName('');
      reloadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleBindProfessor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bindProfId || !bindClassId) return;
    try {
      await apiRequest('/academic/bind-professor', {
        method: 'POST',
        body: JSON.stringify({ usuarioId: Number(bindProfId), turmaId: Number(bindClassId) })
      });
      showToast('Professor vinculado à turma!', 'success');
      setShowBindModal(false);
      reloadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollStudentId || !enrollClassId) return;
    try {
      await apiRequest('/academic/enroll-student', {
        method: 'POST',
        body: JSON.stringify({
          usuarioId: Number(enrollStudentId),
          turmaId: Number(enrollClassId),
          grupoId: enrollGroupId ? Number(enrollGroupId) : null
        })
      });
      showToast('Aluno matriculado na turma com sucesso!', 'success');
      setShowEnrollModal(false);
      reloadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Estrutura Acadêmica Institucional</h2>
          <p className="text-muted text-sm">
            Gestão de Cursos, Disciplinas, Turmas, Grupos PBL, Matrículas e Vínculos Docentes.
          </p>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('turmas')}
          className={`btn btn-sm ${activeTab === 'turmas' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Users size={16} /> Turmas ({classes.length})
        </button>

        <button
          onClick={() => setActiveTab('cursos')}
          className={`btn btn-sm ${activeTab === 'cursos' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <BookOpen size={16} /> Cursos ({courses.length})
        </button>

        <button
          onClick={() => setActiveTab('disciplinas')}
          className={`btn btn-sm ${activeTab === 'disciplinas' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Layers size={16} /> Disciplinas ({disciplines.length})
        </button>

        <button
          onClick={() => setActiveTab('grupos')}
          className={`btn btn-sm ${activeTab === 'grupos' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Grupos PBL ({groups.length})
        </button>
      </div>

      {/* Conteúdo da Aba Turmas */}
      {activeTab === 'turmas' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <span className="font-bold text-sm">Lista de Turmas Cadastradas:</span>
            <div className="flex gap-2">
              <button onClick={() => setShowBindModal(true)} className="btn btn-secondary btn-sm">
                <UserCheck size={16} /> Vincular Professor
              </button>
              <button onClick={() => setShowEnrollModal(true)} className="btn btn-secondary btn-sm">
                <GraduationCap size={16} /> Matricular Aluno
              </button>
              <button onClick={() => setShowClassModal(true)} className="btn btn-primary btn-sm">
                <Plus size={16} /> Nova Turma
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nome da Turma</th>
                  <th>Disciplina</th>
                  <th>Curso</th>
                  <th>Período Letivo</th>
                  <th>Total de Alunos</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id}>
                    <td><strong style={{ color: 'var(--primary)' }}>{c.codigo}</strong></td>
                    <td><div className="font-bold">{c.nome}</div></td>
                    <td>{c.disciplina_nome}</td>
                    <td>{c.curso_nome}</td>
                    <td>{c.periodo_nome}</td>
                    <td>{c.total_alunos} alunos</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Conteúdo da Aba Cursos */}
      {activeTab === 'cursos' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <span className="font-bold text-sm">Cursos Institucionais:</span>
            <button onClick={() => setShowCourseModal(true)} className="btn btn-primary btn-sm">
              <Plus size={16} /> Criar Novo Curso
            </button>
          </div>

          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nome do Curso</th>
                  <th>Descrição</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.codigo}</strong></td>
                    <td><div className="font-bold">{c.nome}</div></td>
                    <td>{c.descricao || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Conteúdo da Aba Disciplinas */}
      {activeTab === 'disciplinas' && (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nome da Disciplina</th>
                <th>Curso Relacionado</th>
              </tr>
            </thead>
            <tbody>
              {disciplines.map((d) => (
                <tr key={d.id}>
                  <td><strong>{d.codigo}</strong></td>
                  <td><div className="font-bold">{d.nome}</div></td>
                  <td>{d.curso_nome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Conteúdo da Aba Grupos */}
      {activeTab === 'grupos' && (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Nome do Grupo PBL</th>
                <th>Turma Pertencente</th>
                <th>Integrantes</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id}>
                  <td><div className="font-bold">{g.nome}</div></td>
                  <td>{g.turma_nome}</td>
                  <td>{g.total_integrantes} alunos</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modais de Criação */}
      {showClassModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="font-bold">Cadastrar Nova Turma</h3>
              <button onClick={() => setShowClassModal(false)} className="btn btn-sm btn-secondary">X</button>
            </div>
            <form onSubmit={handleCreateClass}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label required">Código da Turma</label>
                  <input type="text" className="form-control" placeholder="Ex: ADM-20261" value={classCode} onChange={(e) => setClassCode(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label required">Nome da Turma</label>
                  <input type="text" className="form-control" placeholder="Ex: Turma A - Matutino" value={className} onChange={(e) => setClassName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label required">Disciplina</label>
                  <select className="form-control" value={classDisciplineId} onChange={(e: any) => setClassDisciplineId(e.target.value)} required>
                    <option value="">-- Selecione a disciplina --</option>
                    {disciplines.map((d) => <option key={d.id} value={d.id}>{d.nome} ({d.curso_nome})</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowClassModal(false)} className="btn btn-secondary">Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar Turma</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBindModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="font-bold">Vincular Professor à Turma</h3>
              <button onClick={() => setShowBindModal(false)} className="btn btn-sm btn-secondary">X</button>
            </div>
            <form onSubmit={handleBindProfessor}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label required">Professor</label>
                  <select className="form-control" value={bindProfId} onChange={(e: any) => setBindProfId(e.target.value)} required>
                    <option value="">-- Selecione o docente --</option>
                    {professors.map((p) => <option key={p.id} value={p.id}>{p.nome} ({p.email})</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label required">Turma</label>
                  <select className="form-control" value={bindClassId} onChange={(e: any) => setBindClassId(e.target.value)} required>
                    <option value="">-- Selecione a turma --</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.codigo})</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowBindModal(false)} className="btn btn-secondary">Cancelar</button>
                <button type="submit" className="btn btn-primary">Confirmar Vínculo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEnrollModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="font-bold">Matricular Aluno na Turma</h3>
              <button onClick={() => setShowEnrollModal(false)} className="btn btn-sm btn-secondary">X</button>
            </div>
            <form onSubmit={handleEnrollStudent}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label required">Aluno</label>
                  <select className="form-control" value={enrollStudentId} onChange={(e: any) => setEnrollStudentId(e.target.value)} required>
                    <option value="">-- Selecione o aluno --</option>
                    {students.map((s) => <option key={s.id} value={s.id}>{s.nome} ({s.email})</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label required">Turma</label>
                  <select className="form-control" value={enrollClassId} onChange={(e: any) => setEnrollClassId(e.target.value)} required>
                    <option value="">-- Selecione a turma --</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.codigo})</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Grupo PBL (Opcional)</label>
                  <select className="form-control" value={enrollGroupId} onChange={(e: any) => setEnrollGroupId(e.target.value)}>
                    <option value="">-- Sem Grupo --</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.nome} ({g.turma_nome})</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowEnrollModal(false)} className="btn btn-secondary">Cancelar</button>
                <button type="submit" className="btn btn-primary">Matricular Aluno</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

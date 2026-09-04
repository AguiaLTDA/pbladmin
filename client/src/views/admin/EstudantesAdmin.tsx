import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '../../context/ToastContext';
import { FormularioEstudante } from '../../components/FormularioEstudante';
import {
  listStudents,
  registerStudent,
  syncPendingRegistrations,
  getPendingRegistrations,
  isGoogleSheetsConfigured
} from '../../services/googleSheets';
import { StudentRegistration, StudentRegistrationInput } from '../../types';
import { CURSOS_DISPONIVEIS } from '../../constants/academico';
import { UserPlus, Search, RefreshCw, Table2, CloudOff, Download } from 'lucide-react';

export const EstudantesAdminView: React.FC = () => {
  const { showToast } = useToast();

  const [estudantes, setEstudantes] = useState<StudentRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [busca, setBusca] = useState('');
  const [cursoFiltro, setCursoFiltro] = useState('');
  const [pendentes, setPendentes] = useState(0);

  const carregar = async () => {
    setLoading(true);
    try {
      const lista = await listStudents();
      setEstudantes(lista);
      setPendentes(getPendingRegistrations().length);
    } catch (err: any) {
      showToast(err.message || 'Erro ao ler a planilha.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const handleCadastrar = async (dados: StudentRegistrationInput) => {
    setSubmitting(true);
    try {
      const res = await registerStudent(dados);
      showToast(res.message, res.sincronizado ? 'success' : 'warning');
      setShowModal(false);
      await carregar();
    } catch (err: any) {
      showToast(err.message || 'Não foi possível cadastrar o estudante.', 'error');
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const handleSincronizar = async () => {
    const res = await syncPendingRegistrations();
    showToast(
      res.enviados
        ? `${res.enviados} cadastro(s) enviados para a planilha.`
        : 'Nenhum cadastro pendente foi enviado.',
      res.enviados ? 'success' : 'warning'
    );
    await carregar();
  };

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return estudantes.filter((e) => {
      if (cursoFiltro && e.curso !== cursoFiltro) return false;
      if (!termo) return true;
      return [e.nome, e.email, e.matricula, e.turma].some((campo) =>
        String(campo || '').toLowerCase().includes(termo)
      );
    });
  }, [estudantes, busca, cursoFiltro]);

  const exportarCsv = () => {
    const colunas = [
      'ID',
      'Data',
      'Nome',
      'E-mail',
      'Matrícula',
      'CPF',
      'Telefone',
      'Curso',
      'Turma',
      'Período',
      'Status'
    ];

    const linhas = filtrados.map((e) =>
      [e.id, e.criadoEm, e.nome, e.email, e.matricula, e.cpf, e.telefone, e.curso, e.turma, e.periodo, e.status]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(';')
    );

    const blob = new Blob([[colunas.join(';'), ...linhas].join('\n')], {
      type: 'text/csv;charset=utf-8;'
    });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `estudantes-pbl-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Cadastro de Estudantes</h2>
          <p className="text-muted text-sm">
            Registros gravados na planilha do Google Sheets da secretaria acadêmica.
          </p>
        </div>

        <div className="flex gap-2">
          <button onClick={carregar} className="btn btn-secondary" disabled={loading}>
            <RefreshCw size={18} />
            Atualizar
          </button>
          <button onClick={exportarCsv} className="btn btn-secondary" disabled={!filtrados.length}>
            <Download size={18} />
            Exportar CSV
          </button>
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <UserPlus size={18} />
            Cadastrar Estudante
          </button>
        </div>
      </div>

      {!isGoogleSheetsConfigured && (
        <div
          className="card mb-4 flex items-center gap-2"
          style={{
            padding: '0.85rem 1rem',
            background: '#fff7ed',
            border: '1px solid #fdba74',
            color: '#9a3412'
          }}
        >
          <CloudOff size={18} />
          <span className="text-sm">
            Integração com o Google Sheets não configurada. Defina <code>VITE_GOOGLE_SHEETS_URL</code>{' '}
            e <code>VITE_GOOGLE_SHEETS_TOKEN</code> no <code>.env</code> do client e nos Secrets do
            GitHub.
          </span>
        </div>
      )}

      {pendentes > 0 && (
        <div
          className="card mb-4 flex items-center justify-between gap-2"
          style={{ padding: '0.85rem 1rem', background: '#fefce8', border: '1px solid #fde047' }}
        >
          <span className="text-sm">
            <strong>{pendentes}</strong> cadastro(s) aguardando sincronização com a planilha.
          </span>
          <button
            onClick={handleSincronizar}
            className="btn btn-sm btn-primary"
            disabled={!isGoogleSheetsConfigured}
          >
            Sincronizar agora
          </button>
        </div>
      )}

      <div className="card mb-4" style={{ padding: '1rem' }}>
        <div className="flex flex-wrap gap-4 items-center">
          <div style={{ flex: 1, minWidth: '240px' }} className="flex items-center gap-2">
            <Search size={18} className="text-muted" />
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por nome, e-mail, matrícula ou turma..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          <div style={{ minWidth: '240px' }}>
            <select
              className="form-control"
              value={cursoFiltro}
              onChange={(e) => setCursoFiltro(e.target.value)}
            >
              <option value="">Todos os Cursos</option>
              {CURSOS_DISPONIVEIS.map((curso) => (
                <option key={curso} value={curso}>
                  {curso}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted">Lendo a planilha do Google Sheets...</div>
      ) : filtrados.length === 0 ? (
        <div className="card text-center py-8">
          <Table2 size={40} className="text-muted" style={{ margin: '0 auto 1rem' }} />
          <h3 className="font-bold mb-2">Nenhum estudante cadastrado ainda</h3>
          <p className="text-muted text-sm">
            Use o botão "Cadastrar Estudante" ou compartilhe o link público de autocadastro (
            <code>#/cadastro</code>) com a turma.
          </p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Nome Completo</th>
                <th>E-mail</th>
                <th>Matrícula</th>
                <th>Curso</th>
                <th>Turma / Período</th>
                <th>Cadastrado em</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((e) => (
                <tr key={e.id}>
                  <td className="font-bold">{e.nome}</td>
                  <td>{e.email}</td>
                  <td>{e.matricula}</td>
                  <td>{e.curso}</td>
                  <td>{[e.turma, e.periodo].filter(Boolean).join(' • ') || '-'}</td>
                  <td>{e.criadoEm || '-'}</td>
                  <td>
                    <span
                      className={`user-role-badge role-${
                        e.status === 'PENDENTE' ? 'professor' : 'aluno'
                      }`}
                    >
                      {e.status || 'PENDENTE'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="text-muted text-sm" style={{ marginTop: '0.75rem' }}>
            Exibindo {filtrados.length} de {estudantes.length} estudante(s).
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="font-bold flex items-center gap-2">
                <UserPlus size={20} color="var(--primary)" />
                Cadastrar Estudante na Planilha
              </h3>
              <button onClick={() => setShowModal(false)} className="btn btn-sm btn-secondary">
                X
              </button>
            </div>

            <div className="modal-body">
              <FormularioEstudante
                onSubmit={handleCadastrar}
                submitting={submitting}
                origem="ADMIN"
                textoBotao="Salvar no Google Sheets"
                onCancel={() => setShowModal(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

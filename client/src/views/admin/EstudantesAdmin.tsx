import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '../../context/ToastContext';
import { FormularioEstudante } from '../../components/FormularioEstudante';
import { apiRequest } from '../../services/api';
import { StudentRegistration, StudentRegistrationInput } from '../../types';
import { CURSOS_DISPONIVEIS } from '../../constants/academico';
import { UserPlus, Search, RefreshCw, Table2, Download, Check, X, KeyRound } from 'lucide-react';

export const EstudantesAdminView: React.FC = () => {
  const { showToast } = useToast();

  const [estudantes, setEstudantes] = useState<StudentRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [busca, setBusca] = useState('');
  const [cursoFiltro, setCursoFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [credenciaisGeradas, setCredenciaisGeradas] = useState<{ email: string; senhaTemporaria: string } | null>(
    null
  );

  const carregar = async () => {
    setLoading(true);
    try {
      const lista = await apiRequest<StudentRegistration[]>('/admin/pre-cadastros');
      setEstudantes(lista);
    } catch (err: any) {
      showToast(err.message || 'Erro ao listar pré-cadastros.', 'error');
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
      const res = await apiRequest<{ message: string }>('/public/pre-cadastro', {
        method: 'POST',
        body: JSON.stringify({ ...dados, origem: 'ADMIN' })
      });
      showToast(res.message, 'success');
      setShowModal(false);
      await carregar();
    } catch (err: any) {
      showToast(err.message || 'Não foi possível cadastrar o estudante.', 'error');
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const handleAprovar = async (item: StudentRegistration) => {
    if (!window.confirm(`Aprovar o cadastro de ${item.nome} e criar a conta de aluno dele?`)) return;

    try {
      const res = await apiRequest<{ email: string; senhaTemporaria: string; message: string }>(
        `/admin/pre-cadastros/${item.id}/aprovar`,
        { method: 'POST' }
      );
      showToast(res.message, 'success');
      setCredenciaisGeradas({ email: res.email, senhaTemporaria: res.senhaTemporaria });
      await carregar();
    } catch (err: any) {
      showToast(err.message || 'Não foi possível aprovar o cadastro.', 'error');
    }
  };

  const handleRejeitar = async (item: StudentRegistration) => {
    const justificativa = window.prompt(`Motivo da rejeição do cadastro de ${item.nome} (opcional):`);
    if (justificativa === null) return; // cancelou o prompt

    try {
      const res = await apiRequest<{ message: string }>(`/admin/pre-cadastros/${item.id}/rejeitar`, {
        method: 'POST',
        body: JSON.stringify({ justificativa })
      });
      showToast(res.message, 'success');
      await carregar();
    } catch (err: any) {
      showToast(err.message || 'Não foi possível rejeitar o cadastro.', 'error');
    }
  };

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return estudantes.filter((e) => {
      if (cursoFiltro && e.curso !== cursoFiltro) return false;
      if (statusFiltro && e.status !== statusFiltro) return false;
      if (!termo) return true;
      return [e.nome, e.email, e.matricula, e.turma].some((campo) =>
        String(campo || '').toLowerCase().includes(termo)
      );
    });
  }, [estudantes, busca, cursoFiltro, statusFiltro]);

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
      [e.id, e.criado_em, e.nome, e.email, e.matricula, e.cpf, e.telefone, e.curso, e.turma, e.periodo, e.status]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(';')
    );

    const blob = new Blob([[colunas.join(';'), ...linhas].join('\n')], {
      type: 'text/csv;charset=utf-8;'
    });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `pre-cadastros-pbl-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const pendentesCount = estudantes.filter((e) => e.status === 'PENDENTE').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Cadastro de Estudantes</h2>
          <p className="text-muted text-sm">
            Pré-cadastros recebidos pelo portal, aguardando aprovação para virarem contas reais de aluno.
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
            Novo Pré-Cadastro
          </button>
        </div>
      </div>

      {pendentesCount > 0 && (
        <div
          className="card mb-4 flex items-center gap-2"
          style={{ padding: '0.85rem 1rem', background: '#fefce8', border: '1px solid #fde047' }}
        >
          <span className="text-sm">
            <strong>{pendentesCount}</strong> pré-cadastro(s) aguardando aprovação.
          </span>
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

          <div style={{ minWidth: '200px' }}>
            <select
              className="form-control"
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
            >
              <option value="">Todos os Status</option>
              <option value="PENDENTE">Pendente</option>
              <option value="APROVADO">Aprovado</option>
              <option value="REJEITADO">Rejeitado</option>
            </select>
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
        <div className="text-center py-8 text-muted">Carregando pré-cadastros...</div>
      ) : filtrados.length === 0 ? (
        <div className="card text-center py-8">
          <Table2 size={40} className="text-muted" style={{ margin: '0 auto 1rem' }} />
          <h3 className="font-bold mb-2">Nenhum pré-cadastro encontrado</h3>
          <p className="text-muted text-sm">
            Use o botão "Novo Pré-Cadastro" ou compartilhe o link público de autocadastro (
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
                <th>Ações</th>
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
                  <td>{e.criado_em ? new Date(e.criado_em).toLocaleString('pt-BR') : '-'}</td>
                  <td>
                    <span
                      className={`user-role-badge role-${e.status === 'PENDENTE' ? 'professor' : 'aluno'}`}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td>
                    {e.status === 'PENDENTE' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAprovar(e)}
                          className="btn btn-sm btn-primary"
                          title="Aprovar e criar conta de aluno"
                        >
                          <Check size={14} />
                          Aprovar
                        </button>
                        <button
                          onClick={() => handleRejeitar(e)}
                          className="btn btn-sm btn-secondary"
                          title="Rejeitar cadastro"
                        >
                          <X size={14} />
                          Rejeitar
                        </button>
                      </div>
                    ) : (
                      <span className="text-muted text-sm">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="text-muted text-sm" style={{ marginTop: '0.75rem' }}>
            Exibindo {filtrados.length} de {estudantes.length} pré-cadastro(s).
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="font-bold flex items-center gap-2">
                <UserPlus size={20} color="var(--primary)" />
                Novo Pré-Cadastro de Estudante
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
                textoBotao="Registrar Pré-Cadastro"
                onCancel={() => setShowModal(false)}
              />
            </div>
          </div>
        </div>
      )}

      {credenciaisGeradas && (
        <div className="modal-overlay">
          <div className="modal-container" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 className="font-bold flex items-center gap-2">
                <KeyRound size={20} color="var(--primary)" />
                Conta criada com sucesso
              </h3>
            </div>
            <div className="modal-body">
              <p className="text-sm mb-4">
                Repasse estas credenciais ao estudante — a senha só é exibida esta vez, ela não fica
                salva em nenhum outro lugar.
              </p>
              <div className="card" style={{ padding: '1rem', background: '#f8f9f5' }}>
                <p className="text-sm mb-2">
                  <strong>E-mail:</strong> {credenciaisGeradas.email}
                </p>
                <p className="text-sm">
                  <strong>Senha temporária:</strong>{' '}
                  <code style={{ fontSize: '1rem' }}>{credenciaisGeradas.senhaTemporaria}</code>
                </p>
              </div>
              <button
                onClick={() => setCredenciaisGeradas(null)}
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '1.25rem' }}
              >
                Já anotei, fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

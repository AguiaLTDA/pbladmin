import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '../../context/ToastContext';
import { FormularioEstudante } from '../../components/FormularioEstudante';
import { apiRequest } from '../../services/api';
import { StudentRegistration, StudentRegistrationInput } from '../../types';
import { CURSOS_DISPONIVEIS } from '../../constants/academico';
import {
  UserPlus,
  Search,
  RefreshCw,
  Table2,
  Download,
  Check,
  X,
  KeyRound,
  Trash2,
  RotateCcw,
  AlertTriangle,
  Pencil
} from 'lucide-react';

/**
 * Situação do aluno quanto ao grupo PBL, para o alerta ao lado do nome.
 *
 * Só alerta quem já tem conta no portal: um cadastro PENDENTE ainda não
 * deveria estar em grupo, e a coluna de status já diz isso — repetir o alerta
 * ali só tiraria força do aviso de quem realmente está pendurado.
 */
function situacaoGrupo(e: StudentRegistration): { alerta: boolean; titulo: string } {
  if (!e.usuario_id) return { alerta: false, titulo: '' };
  if (e.grupos_nomes) return { alerta: false, titulo: `Grupo PBL: ${e.grupos_nomes}` };
  if (Number(e.total_matriculas || 0) === 0) {
    // A turma exibida na linha é a que o aluno digitou no cadastro; sem
    // matrícula no portal ele não aparece em nenhuma turma de verdade.
    return {
      alerta: true,
      titulo:
        'Sem grupo PBL — o aluno ainda não se matriculou em nenhuma turma no portal ' +
        '(a turma da linha é a que ele informou no cadastro).'
    };
  }
  return {
    alerta: true,
    titulo: 'Sem grupo PBL — o aluno já está matriculado na turma, mas ainda não escolheu nem criou um grupo.'
  };
}

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
  const [editando, setEditando] = useState<StudentRegistration | null>(null);
  const [excluidos, setExcluidos] = useState<StudentRegistration[]>([]);
  const [mostrarLixeira, setMostrarLixeira] = useState(false);

  const carregarExcluidos = async () => {
    try {
      const lista = await apiRequest<StudentRegistration[]>('/admin/pre-cadastros/excluidos');
      setExcluidos(lista);
    } catch {
      setExcluidos([]);
    }
  };

  const carregar = async () => {
    setLoading(true);
    try {
      const lista = await apiRequest<StudentRegistration[]>('/admin/pre-cadastros');
      setEstudantes(lista);
      await carregarExcluidos();
    } catch (err: any) {
      showToast(err.message || 'Erro ao listar os estudantes.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const handleEditar = async (dados: StudentRegistrationInput) => {
    if (!editando) return;

    setSubmitting(true);
    try {
      const res = await apiRequest<{ message: string }>(`/admin/pre-cadastros/${editando.id}`, {
        method: 'PUT',
        body: JSON.stringify(dados)
      });
      showToast(res.message, 'success');
      setEditando(null);
      await carregar();
    } catch (err: any) {
      showToast(err.message || 'Não foi possível salvar as alterações.', 'error');
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const handleExcluir = async (item: StudentRegistration) => {
    const aviso = item.usuario_id
      ? `Excluir o cadastro de ${item.nome}? Ele perde o acesso ao portal e sai das turmas e grupos. Dá para restaurar depois.`
      : `Excluir o cadastro de ${item.nome}? Dá para restaurar depois.`;
    if (!window.confirm(aviso)) return;

    try {
      const res = await apiRequest<{ message: string }>(`/admin/pre-cadastros/${item.id}`, { method: 'DELETE' });
      showToast(res.message, 'success');
      await carregar();
    } catch (err: any) {
      showToast(err.message || 'Não foi possível excluir o cadastro.', 'error');
    }
  };

  const handleRestaurar = async (item: StudentRegistration) => {
    try {
      const res = await apiRequest<{ message: string }>(`/admin/pre-cadastros/${item.id}/restaurar`, {
        method: 'POST'
      });
      showToast(res.message, 'success');
      await carregar();
    } catch (err: any) {
      showToast(err.message || 'Não foi possível restaurar o cadastro.', 'error');
    }
  };

  const handleCadastrar = async (dados: StudentRegistrationInput) => {
    setSubmitting(true);
    try {
      const res = await apiRequest<{ message: string; email?: string; senhaTemporaria?: string }>(
        '/public/pre-cadastro',
        { method: 'POST', body: JSON.stringify({ ...dados, origem: 'ADMIN' }) }
      );
      showToast(res.message, 'success');
      setShowModal(false);
      // Só existe senha temporária quando o admin não definiu uma no formulário.
      if (res.senhaTemporaria && res.email) {
        setCredenciaisGeradas({ email: res.email, senhaTemporaria: res.senhaTemporaria });
      }
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
      const res = await apiRequest<{ email: string; senhaTemporaria?: string; message: string }>(
        `/admin/pre-cadastros/${item.id}/aprovar`,
        { method: 'POST' }
      );
      showToast(res.message, 'success');
      // Só existe senha temporária quando o aluno não definiu a própria no autocadastro.
      if (res.senhaTemporaria) {
        setCredenciaisGeradas({ email: res.email, senhaTemporaria: res.senhaTemporaria });
      }
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
            Estudantes cadastrados pelo portal. A conta é criada e liberada na hora — a
            coordenação acompanha aqui e pode desativar acessos em Gestão de Usuários.
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

      {pendentesCount > 0 && (
        <div
          className="card mb-4 flex items-center gap-2"
          style={{ padding: '0.85rem 1rem', background: '#fefce8', border: '1px solid #fde047' }}
        >
          <span className="text-sm">
            <strong>{pendentesCount}</strong> cadastro(s) da fila antiga ainda sem conta criada.
            Aprove para gerar o acesso — novos cadastros já entram liberados.
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
        <div className="text-center py-8 text-muted">Carregando estudantes...</div>
      ) : filtrados.length === 0 ? (
        <div className="card text-center py-8">
          <Table2 size={40} className="text-muted" style={{ margin: '0 auto 1rem' }} />
          <h3 className="font-bold mb-2">Nenhum estudante cadastrado</h3>
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
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((e) => {
                const grupo = situacaoGrupo(e);

                return (
                <tr key={e.id}>
                  <td className="font-bold">
                    <span className="flex items-center gap-2">
                      {e.nome}
                      {grupo.alerta && (
                        <span
                          title={grupo.titulo}
                          aria-label={grupo.titulo}
                          style={{ display: 'inline-flex', color: '#d97706', flexShrink: 0 }}
                        >
                          <AlertTriangle size={16} />
                        </span>
                      )}
                    </span>
                  </td>
                  <td>{e.email}</td>
                  <td>{e.matricula}</td>
                  <td>{e.curso}</td>
                  <td>
                    <div>{[e.turma, e.periodo].filter(Boolean).join(' • ') || '-'}</div>
                    {e.grupos_nomes ? (
                      <div className="text-muted text-sm">{e.grupos_nomes}</div>
                    ) : (
                      grupo.alerta && <div className="text-sm" style={{ color: '#b45309' }}>Sem grupo</div>
                    )}
                  </td>
                  <td>{e.criado_em ? new Date(e.criado_em).toLocaleString('pt-BR') : '-'}</td>
                  <td>
                    <span
                      className={`user-role-badge role-${e.status === 'PENDENTE' ? 'professor' : 'aluno'}`}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                      {e.status === 'PENDENTE' && (
                        <>
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
                        </>
                      )}
                      <button
                        onClick={() => setEditando(e)}
                        className="btn btn-sm btn-secondary"
                        title="Corrigir os dados do cadastro, inclusive o e-mail"
                      >
                        <Pencil size={14} />
                        Editar
                      </button>
                      <button
                        onClick={() => handleExcluir(e)}
                        className="btn btn-sm btn-danger"
                        title="Excluir o cadastro e revogar o acesso (recuperável)"
                      >
                        <Trash2 size={14} />
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>

          <div className="text-muted text-sm" style={{ marginTop: '0.75rem' }}>
            Exibindo {filtrados.length} de {estudantes.length} estudante(s).
          </div>
        </div>
      )}

      {/* Modal de edição do cadastro */}
      {editando && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="font-bold flex items-center gap-2">
                <Pencil size={20} color="var(--primary)" />
                Editar cadastro de {editando.nome}
              </h3>
            </div>

            <div className="modal-body">
              <p className="text-muted text-sm mb-4">
                Corrigir o e-mail invalida a confirmação anterior e envia um link novo para o
                endereço corrigido — o aluno precisa clicar nele para voltar a entrar. A senha não
                se altera aqui: para isso use Gestão de Usuários &gt; Redefinir senha.
              </p>

              <FormularioEstudante
                onSubmit={handleEditar}
                submitting={submitting}
                origem={editando.origem || 'ADMIN'}
                textoBotao="Salvar alterações"
                onCancel={() => setEditando(null)}
                ocultarSenha
                valoresIniciais={{
                  nome: editando.nome,
                  email: editando.email,
                  matricula: editando.matricula,
                  cpf: editando.cpf || '',
                  telefone: editando.telefone || '',
                  curso: editando.curso,
                  turma: editando.turma || '',
                  periodo: editando.periodo || ''
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Lixeira de cadastros excluídos */}
      <div className="card" style={{ padding: '1rem', marginTop: '1rem' }}>
        <div className="flex items-center justify-between gap-2" style={{ flexWrap: 'wrap' }}>
          <h3 className="font-bold flex items-center gap-2">
            <Trash2 size={18} color="var(--primary)" /> Cadastros excluídos ({excluidos.length})
          </h3>
          <button onClick={() => setMostrarLixeira((v) => !v)} className="btn btn-secondary btn-sm">
            {mostrarLixeira ? 'Ocultar' : 'Ver excluídos'}
          </button>
        </div>

        {mostrarLixeira && (
          <div style={{ marginTop: '0.75rem' }}>
            {excluidos.length === 0 ? (
              <span className="text-muted text-sm">Nenhum cadastro excluído.</span>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>E-mail</th>
                      <th>Matrícula</th>
                      <th>Curso</th>
                      <th>Excluído em</th>
                      <th style={{ textAlign: 'right' }}>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excluidos.map((e) => (
                      <tr key={e.id}>
                        <td className="font-bold">{e.nome}</td>
                        <td>{e.email}</td>
                        <td>{e.matricula}</td>
                        <td>{e.curso}</td>
                        <td>{e.deletado_em ? new Date(e.deletado_em).toLocaleString('pt-BR') : '-'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button onClick={() => handleRestaurar(e)} className="btn btn-primary btn-sm">
                            <RotateCcw size={14} /> Restaurar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="font-bold flex items-center gap-2">
                <UserPlus size={20} color="var(--primary)" />
                Cadastrar Estudante
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
                textoBotao="Criar Conta do Estudante"
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

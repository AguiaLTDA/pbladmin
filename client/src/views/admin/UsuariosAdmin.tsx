import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { User, PerfilRole } from '../../types';
import { useToast } from '../../context/ToastContext';
import { Users, UserPlus, Search, ShieldCheck, CheckCircle, XCircle } from 'lucide-react';

export const UsuariosAdminView: React.FC = () => {
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [perfilFiltro, setPerfilFiltro] = useState('');
  const [busca, setBusca] = useState('');

  // Modal Novo Usuário
  const [showModal, setShowModal] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [perfilId, setPerfilId] = useState<number>(3); // Default Aluno
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = () => {
    setLoading(true);
    let query = '/academic/users?';
    if (perfilFiltro) query += `perfil=${perfilFiltro}&`;
    if (busca) query += `busca=${encodeURIComponent(busca)}&`;

    apiRequest<User[]>(query)
      .then((res) => setUsers(res))
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, [perfilFiltro]);

  const handleToggleStatus = async (id: number, currentName: string) => {
    try {
      const res = await apiRequest(`/academic/users/${id}/toggle-status`, { method: 'PUT' });
      showToast(res.message, 'success');
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiRequest('/academic/users', {
        method: 'POST',
        body: JSON.stringify({ nome, email, senha, perfilId })
      });
      showToast('Usuário cadastrado com sucesso!', 'success');
      setShowModal(false);
      setNome('');
      setEmail('');
      setSenha('');
      fetchUsers();
    } catch (err: any) {
      showToast(err.message || 'Erro ao criar usuário.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Gestão de Usuários e Perfis</h2>
          <p className="text-muted text-sm">
            Administração de contas de Administradores, Professores e Alunos com controle de ativação.
          </p>
        </div>

        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <UserPlus size={18} />
          Cadastrar Novo Usuário
        </button>
      </div>

      <div className="card mb-4" style={{ padding: '1rem' }}>
        <div className="flex flex-wrap gap-4 items-center">
          <div style={{ flex: 1, minWidth: '240px' }} className="flex items-center gap-2">
            <Search size={18} className="text-muted" />
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por nome ou e-mail..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
            />
          </div>

          <div style={{ minWidth: '180px' }}>
            <select
              className="form-control"
              value={perfilFiltro}
              onChange={(e) => setPerfilFiltro(e.target.value)}
            >
              <option value="">Todos os Perfis</option>
              <option value="ADMIN">Administradores</option>
              <option value="PROFESSOR">Professores</option>
              <option value="ALUNO">Alunos</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted">Carregando usuários...</div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Nome Completo</th>
                <th>E-mail Institucional</th>
                <th>Perfil de Acesso</th>
                <th>Status</th>
                <th>Data de Cadastro</th>
                <th style={{ textAlign: 'right' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="font-bold">{u.nome}</div>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`user-role-badge role-${u.perfilNome.toLowerCase()}`}>
                      {u.perfilNome}
                    </span>
                  </td>
                  <td>
                    {u.ativo ? (
                      <span className="flex items-center gap-1 text-sm font-bold" style={{ color: '#16a34a' }}>
                        <CheckCircle size={14} /> Ativo
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-sm font-bold" style={{ color: '#dc2626' }}>
                        <XCircle size={14} /> Inativo
                      </span>
                    )}
                  </td>
                  <td>{u.criado_em ? new Date(u.criado_em).toLocaleDateString('pt-BR') : '-'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => handleToggleStatus(u.id, u.nome)}
                      className={`btn btn-sm ${u.ativo ? 'btn-danger' : 'btn-success'}`}
                    >
                      {u.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Novo Usuário */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="font-bold flex items-center gap-2">
                <UserPlus size={20} color="var(--primary)" />
                Cadastrar Novo Usuário
              </h3>
              <button onClick={() => setShowModal(false)} className="btn btn-sm btn-secondary">X</button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label required">Nome Completo</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ex: Prof. Roberto Alves"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label required">E-mail Institucional</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="roberto.alves@pbl.edu.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label required">Senha Inicial</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="••••••••"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label required">Perfil de Acesso</label>
                  <select
                    className="form-control"
                    value={perfilId}
                    onChange={(e) => setPerfilId(Number(e.target.value))}
                  >
                    <option value={1}>Administrador</option>
                    <option value={2}>Professor</option>
                    <option value={3}>Aluno</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Salvando...' : 'Salvar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

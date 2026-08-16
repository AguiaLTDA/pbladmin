import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiRequest } from '../../services/api';
import { User, KeyRound, Save, ShieldCheck } from 'lucide-react';

export const PerfilView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senhaAtual || !novaSenha) {
      showToast('Preencha a senha atual e a nova senha.', 'warning');
      return;
    }

    if (novaSenha.length < 6) {
      showToast('A nova senha deve possuir no mínimo 6 caracteres.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest('/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({ senhaAtual, novaSenha })
      });
      showToast(res.message, 'success');
      setSenhaAtual('');
      setNovaSenha('');
    } catch (err: any) {
      showToast(err.message || 'Erro ao alterar senha.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Perfil do Usuário & Acesso</h2>
          <p className="text-muted text-sm">Gerencie suas informações cadastrais e alteração de credenciais.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        <div className="card">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <User size={18} color="var(--primary)" />
            Dados Pessoais
          </h3>

          <div className="form-group">
            <label className="form-label text-muted">Nome Completo</label>
            <input type="text" className="form-control" value={user.nome} readOnly style={{ background: 'var(--bg-main)' }} />
          </div>

          <div className="form-group">
            <label className="form-label text-muted">E-mail Institucional</label>
            <input type="email" className="form-control" value={user.email} readOnly style={{ background: 'var(--bg-main)' }} />
          </div>

          <div className="form-group">
            <label className="form-label text-muted">Perfil de Acesso</label>
            <div>
              <span className={`user-role-badge role-${user.perfilNome.toLowerCase()}`}>
                {user.perfilNome}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <KeyRound size={18} color="var(--primary)" />
            Alteração de Senha
          </h3>

          <form onSubmit={handleChangePassword}>
            <div className="form-group mb-3">
              <label className="form-label required">Senha Atual</label>
              <input
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                required
              />
            </div>

            <div className="form-group mb-4">
              <label className="form-label required">Nova Senha (Mínimo 6 caracteres)</label>
              <input
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                required
              />
            </div>

            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: '100%' }}>
              <Save size={18} />
              {submitting ? 'Alterando...' : 'Atualizar Senha'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

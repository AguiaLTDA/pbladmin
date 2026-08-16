import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ShieldCheck, GraduationCap, UserCheck, KeyRound, Mail, ArrowRight } from 'lucide-react';

interface LoginProps {
  navigate: (path: string) => void;
}

export const LoginView: React.FC<LoginProps> = ({ navigate }) => {
  const { login } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !senha) {
      showToast('Preencha o e-mail e a senha.', 'warning');
      return;
    }

    setLoading(true);
    try {
      await login(email, senha);
      showToast('Autenticação realizada com sucesso!', 'success');
      
      const userSaved = JSON.parse(localStorage.getItem('pbl_user_data') || '{}');
      if (userSaved.perfilNome === 'ADMIN') navigate('/admin/dashboard');
      else if (userSaved.perfilNome === 'PROFESSOR') navigate('/professor/dashboard');
      else navigate('/aluno/dashboard');
    } catch (err: any) {
      showToast(err.message || 'Falha ao realizar login.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (userEmail: string, userPass: string) => {
    setEmail(userEmail);
    setSenha(userPass);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        padding: '1.5rem',
        color: '#f8fafc'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '960px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          background: 'rgba(21, 28, 44, 0.85)',
          backdropFilter: 'blur(16px)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden'
        }}
      >
        {/* Lado Esquerdo - Boas-Vindas Institucionais */}
        <div
          style={{
            padding: '3rem 2.5rem',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(168, 85, 247, 0.15))',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.5rem 1rem',
                borderRadius: '9999px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                fontSize: '0.85rem',
                fontWeight: 600,
                marginBottom: '2rem'
              }}
            >
              <ShieldCheck size={16} color="#38bdf8" />
              <span>Ambiente Institucional de PBL</span>
            </div>

            <h1 style={{ fontSize: '2.2rem', fontWeight: 700, marginBottom: '1rem', lineHeight: 1.2 }}>
              Problem-Based Learning
            </h1>

            <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '2rem' }}>
              Plataforma integrada de gestão de conteúdo educacional baseada em resolução de problemas reais com revisão administrativa, segmentação inteligente e controle de entregas.
            </p>
          </div>

          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '1rem' }}>
              Credenciais Rápidas de Demonstração (Clique para preencher)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={() => fillCredentials('admin@pbl.edu.br', 'admin123')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.65rem 1rem',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#fca5a5',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '0.85rem'
                }}
              >
                <ShieldCheck size={18} />
                <div>
                  <div style={{ fontWeight: 700 }}>Entrar como Administrador</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>admin@pbl.edu.br</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => fillCredentials('prof.jussara@pbl.edu.br', 'prof123')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.65rem 1rem',
                  borderRadius: '10px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  color: '#c7d2fe',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '0.85rem'
                }}
              >
                <UserCheck size={18} />
                <div>
                  <div style={{ fontWeight: 700 }}>Entrar como Professor</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>prof.jussara@pbl.edu.br</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => fillCredentials('aluno.ketlly@pbl.edu.br', 'aluno123')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.65rem 1rem',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#6ee7b7',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '0.85rem'
                }}
              >
                <GraduationCap size={18} />
                <div>
                  <div style={{ fontWeight: 700 }}>Entrar como Aluno (Ketlly Beatriz)</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>aluno.ketlly@pbl.edu.br</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Lado Direito - Formulário de Login */}
        <div style={{ padding: '3rem 2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.5rem' }}>Acessar Conta</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '2rem' }}>
            Digite seus dados institucionais para entrar na plataforma.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label required" style={{ color: '#e2e8f0' }}>E-mail Institucional</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748b' }} />
                <input
                  type="email"
                  className="form-control"
                  style={{ paddingLeft: '40px', background: '#0f172a', borderColor: '#334155', color: 'white' }}
                  placeholder="seu.email@pbl.edu.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label required" style={{ color: '#e2e8f0' }}>Senha de Acesso</label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748b' }} />
                <input
                  type="password"
                  className="form-control"
                  style={{ paddingLeft: '40px', background: '#0f172a', borderColor: '#334155', color: 'white' }}
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.8rem', fontSize: '1rem', marginTop: '1rem' }}
            >
              {loading ? 'Autenticando...' : 'Entrar no Sistema'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
            Esqueceu sua senha? Entre em contato com a Secretaria Acadêmica.
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ShieldCheck, GraduationCap, UserCheck, KeyRound, Mail, ArrowRight, BookOpen, Award, Layers } from 'lucide-react';

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
        background: 'linear-gradient(135deg, #092f1e 0%, #061e13 100%)',
        padding: '1.5rem',
        color: '#f8f9f5'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1000px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          background: '#ffffff',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
          color: 'var(--text-main)'
        }}
      >
        {/* Lado Esquerdo - Boas-Vindas Institucionais UNIVC */}
        <div
          style={{
            padding: '3rem 2.5rem',
            background: 'linear-gradient(135deg, #092f1e 0%, #0c422b 100%)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            color: 'white'
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0.85rem',
                borderRadius: '9999px',
                background: '#fdeee9',
                color: '#d94a34',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                marginBottom: '1.75rem'
              }}
            >
              <ShieldCheck size={14} color="#d94a34" />
              <span>ENTREGA DE PBL • UNIVC</span>
            </div>

            <h1
              style={{
                fontFamily: "'DM Serif Display', Georgia, serif",
                fontSize: '2.4rem',
                fontWeight: 400,
                marginBottom: '1rem',
                lineHeight: 1.2,
                color: '#ffffff'
              }}
            >
              Submissão de Trabalhos do <span style={{ color: '#d94a34' }}>PBL</span>.
            </h1>

            <p style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.925rem', lineHeight: 1.6, marginBottom: '2rem' }}>
              Toda entrega referente a um projeto de atividade baseado na metodologia de <strong>Aprendizagem Baseada em Problemas</strong> — uma prática real, moderna do mercado, conduzida pelo Centro Universitário <strong>UNIVC</strong>.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '2rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.08)', padding: '0.75rem', borderRadius: '10px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ffffff' }}>Prática</div>
                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.7)' }}>Estudos Reais</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.08)', padding: '0.75rem', borderRadius: '10px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ffffff' }}>Mercado</div>
                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.7)' }}>Desafios</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.08)', padding: '0.75rem', borderRadius: '10px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ffffff' }}>Colaborativo</div>
                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.7)' }}>Equipes</div>
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.85rem' }}>
              Credenciais Rápidas de Acesso (Clique para preencher)
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
                  borderRadius: '12px',
                  background: 'rgba(217, 74, 52, 0.2)',
                  border: '1px solid rgba(217, 74, 52, 0.4)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '0.85rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <ShieldCheck size={18} color="#d94a34" />
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
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '0.85rem'
                }}
              >
                <UserCheck size={18} color="#ffffff" />
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
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '0.85rem'
                }}
              >
                <GraduationCap size={18} color="#ffffff" />
                <div>
                  <div style={{ fontWeight: 700 }}>Entrar como Aluno (Ketlly Beatriz)</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>aluno.ketlly@pbl.edu.br</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Lado Direito - Formulário de Login */}
        <div style={{ padding: '3rem 2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#ffffff' }}>
          <div className="mb-4">
            <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '1.8rem', fontWeight: 400, color: 'var(--primary)', marginBottom: '0.35rem' }}>
              Acessar o Portal
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Digite suas credenciais do Centro Universitário UNIVC.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label required">E-mail Institucional</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#809088' }} />
                <input
                  type="email"
                  className="form-control"
                  style={{ paddingLeft: '40px' }}
                  placeholder="seu.email@pbl.edu.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label required">Senha de Acesso</label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#809088' }} />
                <input
                  type="password"
                  className="form-control"
                  style={{ paddingLeft: '40px' }}
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
              style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', marginTop: '1rem' }}
            >
              {loading ? 'Autenticando...' : 'Acessar Formulário'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div style={{ marginTop: '2.5rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            © UNIVC — Centro Universitário Vale do Cricaré. Todos os direitos reservados.
          </div>
        </div>
      </div>
    </div>
  );
};

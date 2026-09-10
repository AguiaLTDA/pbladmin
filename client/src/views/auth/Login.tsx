import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiRequest } from '../../services/api';
import { KeyRound, Mail, ArrowRight, Eye, EyeOff, Layers, Users, Target, MailWarning } from 'lucide-react';
import { BrandLogo } from '../../components/BrandLogo';

interface LoginProps {
  navigate: (path: string) => void;
}

const PILARES = [
  {
    icon: Target,
    titulo: 'Problema real',
    texto: 'Casos vindos de organizações da região, não exercícios de laboratório.'
  },
  {
    icon: Users,
    titulo: 'Trabalho em equipe',
    texto: 'Grupos acompanhados pelo docente da disciplina, do diagnóstico à entrega.'
  },
  {
    icon: Layers,
    titulo: 'Percurso avaliado',
    texto: 'Etapas, critérios e devolutiva registrados de ponta a ponta.'
  }
];

export const LoginView: React.FC<LoginProps> = ({ navigate }) => {
  const { login } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  // Guarda o aviso de cadastro pendente para oferecer o reenvio do link. Só
  // aparece quando o backend confirma que a senha está certa e falta validar.
  const [pendenteValidacao, setPendenteValidacao] = useState<string | null>(null);
  const [reenviando, setReenviando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !senha) {
      showToast('Preencha o e-mail e a senha.', 'warning');
      return;
    }

    setLoading(true);
    setPendenteValidacao(null);
    try {
      await login(email, senha);
      showToast('Autenticação realizada com sucesso.', 'success');

      const userSaved = JSON.parse(localStorage.getItem('pbl_user_data') || '{}');
      if (userSaved.perfilNome === 'ADMIN') navigate('/admin/dashboard');
      else if (userSaved.perfilNome === 'PROFESSOR') navigate('/professor/dashboard');
      else navigate('/aluno/dashboard');
    } catch (err: any) {
      if (err?.codigo === 'EMAIL_NAO_VERIFICADO') {
        setPendenteValidacao(email);
      }
      showToast(err.message || 'Falha ao realizar login.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReenviar = async () => {
    setReenviando(true);
    try {
      const res = await apiRequest<{ message: string }>('/public/reenviar-verificacao', {
        method: 'POST',
        body: JSON.stringify({ email: pendenteValidacao })
      });
      showToast(res.message, 'success');
    } catch (err: any) {
      showToast(err.message || 'Não foi possível reenviar o e-mail.', 'error');
    } finally {
      setReenviando(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-shell">
        {/* ---------------- Painel institucional ---------------- */}
        <aside className="login-institucional">
          <div className="login-institucional-topo">
            <BrandLogo variante="escura" tamanho="lg" />
          </div>

          <div className="login-institucional-corpo">
            <span className="login-eyebrow">Aprendizagem Baseada em Problemas</span>

            <h1 className="login-titulo">
              Portal de Atividades <span className="login-titulo-destaque">PBL</span>
            </h1>

            <p className="login-descricao">
              Ambiente institucional para elaboração, revisão pedagógica, publicação e
              avaliação das atividades de Aprendizagem Baseada em Problemas do Centro
              Universitário Vale do Cricaré.
            </p>

            <ul className="login-pilares">
              {PILARES.map(({ icon: Icone, titulo, texto }) => (
                <li key={titulo} className="login-pilar">
                  <span className="login-pilar-icone">
                    <Icone size={17} strokeWidth={2.2} />
                  </span>
                  <div>
                    <strong>{titulo}</strong>
                    <span>{texto}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="login-institucional-rodape">
            Coordenadoria Acadêmica · Centro Universitário Vale do Cricaré
          </p>
        </aside>

        {/* ---------------- Formulário de acesso ---------------- */}
        <section className="login-acesso">
          <header className="login-acesso-cabecalho">
            <h2>Acessar o portal</h2>
            <p>Use as credenciais institucionais fornecidas pela coordenação.</p>
          </header>

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label required" htmlFor="login-email">
                E-mail institucional
              </label>
              <div className="login-campo">
                <Mail size={17} className="login-campo-icone" aria-hidden="true" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  className="form-control"
                  placeholder="seu.nome@pbl.edu.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label required" htmlFor="login-senha">
                Senha de acesso
              </label>
              <div className="login-campo">
                <KeyRound size={17} className="login-campo-icone" aria-hidden="true" />
                <input
                  id="login-senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="form-control login-campo-senha"
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="login-toggle-senha"
                  onClick={() => setMostrarSenha((v) => !v)}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  title={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {mostrarSenha ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'right', marginBottom: '1rem' }}>
              <a
                href="#/recuperar-senha"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/recuperar-senha');
                }}
                className="text-sm"
              >
                Esqueci minha senha
              </a>
            </div>

            {pendenteValidacao && (
              <div className="card mb-4" style={{ background: '#fffbeb', border: '1px solid #fef3c7' }}>
                <div className="flex items-center gap-2 mb-2">
                  <MailWarning size={18} color="#b45309" />
                  <strong style={{ color: '#b45309' }}>Cadastro aguardando validação</strong>
                </div>
                <p className="text-sm text-muted" style={{ marginTop: 0 }}>
                  Enviamos um link de confirmação para <strong>{pendenteValidacao}</strong>. Abra a
                  mensagem e clique no link para liberar o acesso — confira também a caixa de spam.
                </p>
                <button
                  type="button"
                  onClick={handleReenviar}
                  disabled={reenviando}
                  className="btn btn-secondary btn-sm"
                >
                  {reenviando ? 'Reenviando…' : 'Reenviar e-mail de validação'}
                </button>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary login-submit">
              {loading ? 'Autenticando…' : 'Entrar no portal'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="login-secundario">
            Ainda não tem cadastro?{' '}
            <a
              href="#/cadastro"
              onClick={(e) => {
                e.preventDefault();
                navigate('/cadastro');
              }}
            >
              Cadastre-se como estudante
            </a>
          </div>

          <p className="login-copyright">
            © {new Date().getFullYear()} UNIVC — Centro Universitário Vale do Cricaré.
            <br />
            Todos os direitos reservados.
          </p>
        </section>
      </div>
    </div>
  );
};

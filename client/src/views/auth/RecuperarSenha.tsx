import React, { useState } from 'react';
import { apiRequest } from '../../services/api';
import { Mail, ArrowLeft, Send, CheckCircle2 } from 'lucide-react';
import { BrandLogo } from '../../components/BrandLogo';

interface Props {
  navigate: (path: string) => void;
}

/**
 * Pedido de redefinição de senha (público).
 *
 * A tela mostra a mesma confirmação com ou sem cadastro correspondente — é o
 * backend que decide se envia. Dizer "e-mail não encontrado" aqui transformaria
 * o formulário em um verificador de quem estuda na instituição.
 */
export const RecuperarSenhaView: React.FC<Props> = ({ navigate }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErro('Informe o e-mail do seu cadastro.');
      return;
    }

    setLoading(true);
    setErro(null);
    try {
      await apiRequest('/public/recuperar-senha', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() })
      });
      setEnviado(true);
    } catch (err: any) {
      setErro(err.message || 'Não foi possível processar o pedido agora.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-shell login-shell-simples">
        <section className="login-acesso">
          <div style={{ marginBottom: '1.25rem' }}>
            <BrandLogo variante="clara" tamanho="md" />
          </div>

          {enviado ? (
            <>
              <header className="login-acesso-cabecalho">
                <h2 className="flex items-center gap-2">
                  <CheckCircle2 size={22} color="#059669" />
                  Verifique seu e-mail
                </h2>
                <p>
                  Se <strong>{email.trim()}</strong> estiver cadastrado no portal, enviamos as instruções
                  para criar uma nova senha. O link vale por 1 hora e só pode ser usado uma vez.
                </p>
              </header>

              <div className="card mb-4" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <p className="text-sm" style={{ margin: 0, color: '#1e40af' }}>
                  Não chegou? Confira a caixa de spam e o lixo eletrônico. Se o e-mail do seu cadastro
                  estiver errado, só a coordenação pode corrigi-lo.
                </p>
              </div>

              <button onClick={() => navigate('/login')} className="btn btn-primary login-submit">
                Voltar para o login
              </button>
            </>
          ) : (
            <>
              <header className="login-acesso-cabecalho">
                <h2>Esqueci minha senha</h2>
                <p>
                  Informe o e-mail do seu cadastro. Enviaremos um link para você criar uma nova senha.
                </p>
              </header>

              <form onSubmit={handleSubmit} noValidate>
                <div className="form-group">
                  <label className="form-label required" htmlFor="recuperar-email">
                    E-mail do cadastro
                  </label>
                  <div className="login-campo">
                    <Mail size={17} className="login-campo-icone" aria-hidden="true" />
                    <input
                      id="recuperar-email"
                      type="email"
                      autoComplete="username"
                      className="form-control"
                      placeholder="seu.nome@exemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {erro && (
                  <div className="card mb-4" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                    <p className="text-sm" style={{ margin: 0, color: '#991b1b' }}>
                      {erro}
                    </p>
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn btn-primary login-submit">
                  {loading ? 'Enviando…' : 'Enviar link de redefinição'}
                  {!loading && <Send size={17} />}
                </button>
              </form>
            </>
          )}

          {/* No estado de confirmação o botão acima já leva ao login — repetir o
              link logo abaixo só duplicaria a mesma ação. */}
          {!enviado && (
            <div className="login-secundario">
              <a
                href="#/login"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/login');
                }}
                className="flex items-center gap-1"
              >
                <ArrowLeft size={14} /> Voltar para o login
              </a>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

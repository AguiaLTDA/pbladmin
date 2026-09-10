import React, { useState } from 'react';
import { apiRequest } from '../../services/api';
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';
import { BrandLogo } from '../../components/BrandLogo';

interface Props {
  navigate: (path: string) => void;
  token: string;
}

/** Cadastro da nova senha a partir do token recebido por e-mail. */
export const RedefinirSenhaView: React.FC<Props> = ({ navigate, token }) => {
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (senha.length < 6) {
      setErro('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    // Confere aqui e não só no servidor: um erro de digitação na senha nova
    // deixaria o aluno sem acesso e com o token já consumido.
    if (senha !== confirmacao) {
      setErro('As duas senhas não são iguais. Confira a digitação.');
      return;
    }

    setLoading(true);
    setErro(null);
    try {
      await apiRequest('/public/redefinir-senha', {
        method: 'POST',
        body: JSON.stringify({ token, novaSenha: senha })
      });
      setPronto(true);
    } catch (err: any) {
      setErro(err.message || 'Não foi possível redefinir a senha.');
    } finally {
      setLoading(false);
    }
  };

  const semToken = !token;

  return (
    <div className="login-page">
      <div className="login-shell login-shell-simples">
        <section className="login-acesso">
          <div style={{ marginBottom: '1.25rem' }}>
            <BrandLogo variante="clara" tamanho="md" />
          </div>

          {semToken ? (
            <>
              <header className="login-acesso-cabecalho">
                <h2 className="flex items-center gap-2">
                  <AlertTriangle size={22} color="#d97706" />
                  Link incompleto
                </h2>
                <p>
                  Este endereço não traz o código de redefinição. Abra o link direto do e-mail que
                  recebemos ou peça um novo em "Esqueci minha senha".
                </p>
              </header>
              <button onClick={() => navigate('/recuperar-senha')} className="btn btn-primary login-submit">
                Pedir um novo link
              </button>
            </>
          ) : pronto ? (
            <>
              <header className="login-acesso-cabecalho">
                <h2 className="flex items-center gap-2">
                  <CheckCircle2 size={22} color="#059669" />
                  Senha redefinida
                </h2>
                <p>Sua nova senha já está valendo. Entre no portal com ela.</p>
              </header>
              <button onClick={() => navigate('/login')} className="btn btn-primary login-submit">
                Ir para o login
              </button>
            </>
          ) : (
            <>
              <header className="login-acesso-cabecalho">
                <h2>Criar nova senha</h2>
                <p>Escolha uma senha de no mínimo 6 caracteres.</p>
              </header>

              <form onSubmit={handleSubmit} noValidate>
                <div className="form-group">
                  <label className="form-label required" htmlFor="nova-senha">
                    Nova senha
                  </label>
                  <div className="login-campo">
                    <KeyRound size={17} className="login-campo-icone" aria-hidden="true" />
                    <input
                      id="nova-senha"
                      type={mostrarSenha ? 'text' : 'password'}
                      autoComplete="new-password"
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
                    >
                      {mostrarSenha ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label required" htmlFor="confirmar-senha">
                    Repita a nova senha
                  </label>
                  <div className="login-campo">
                    <KeyRound size={17} className="login-campo-icone" aria-hidden="true" />
                    <input
                      id="confirmar-senha"
                      type={mostrarSenha ? 'text' : 'password'}
                      autoComplete="new-password"
                      className="form-control"
                      placeholder="••••••••"
                      value={confirmacao}
                      onChange={(e) => setConfirmacao(e.target.value)}
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
                  {loading ? 'Salvando…' : 'Salvar nova senha'}
                </button>
              </form>
            </>
          )}

          {/* Concluído, o botão acima já leva ao login. */}
          {!pronto && (
            <div className="login-secundario">
              <a
                href="#/login"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/login');
                }}
              >
                Voltar para o login
              </a>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

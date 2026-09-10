import React, { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../services/api';
import { CheckCircle2, AlertTriangle, Loader } from 'lucide-react';
import { BrandLogo } from '../../components/BrandLogo';

interface Props {
  navigate: (path: string) => void;
  token: string;
}

/**
 * Página aberta pelo link do e-mail de cadastro. Ela dispara a validação no
 * backend assim que carrega — o link em si é só um GET nesta página, então
 * pré-visualizadores e antivírus que abrem o endereço não gastam o token.
 */
export const VerificarEmailView: React.FC<Props> = ({ navigate, token }) => {
  const [estado, setEstado] = useState<'validando' | 'ok' | 'falha'>(token ? 'validando' : 'falha');
  const [mensagem, setMensagem] = useState(
    token ? '' : 'Este endereço não traz o código de validação. Abra o link direto do e-mail que enviamos.'
  );
  // StrictMode roda o efeito duas vezes em desenvolvimento; sem esta guarda a
  // segunda chamada encontraria o token já consumido e mostraria erro.
  const jaChamou = useRef(false);

  useEffect(() => {
    if (!token || jaChamou.current) return;
    jaChamou.current = true;

    apiRequest<{ message: string }>('/public/verificar-email', {
      method: 'POST',
      body: JSON.stringify({ token })
    })
      .then((res) => {
        setEstado('ok');
        setMensagem(res.message);
      })
      .catch((err: any) => {
        setEstado('falha');
        setMensagem(err.message || 'Não foi possível validar o e-mail.');
      });
  }, [token]);

  return (
    <div className="login-page">
      <div className="login-shell login-shell-simples">
        <section className="login-acesso">
          <div style={{ marginBottom: '1.25rem' }}>
            <BrandLogo variante="clara" tamanho="md" />
          </div>

          <header className="login-acesso-cabecalho">
            {estado === 'validando' && (
              <>
                <h2 className="flex items-center gap-2">
                  <Loader size={22} />
                  Validando seu e-mail…
                </h2>
                <p>Só um instante.</p>
              </>
            )}

            {estado === 'ok' && (
              <>
                <h2 className="flex items-center gap-2">
                  <CheckCircle2 size={22} color="#059669" />
                  Cadastro validado
                </h2>
                <p>{mensagem}</p>
              </>
            )}

            {estado === 'falha' && (
              <>
                <h2 className="flex items-center gap-2">
                  <AlertTriangle size={22} color="#d97706" />
                  Não foi possível validar
                </h2>
                <p>{mensagem}</p>
              </>
            )}
          </header>

          {estado !== 'validando' && (
            <button onClick={() => navigate('/login')} className="btn btn-primary login-submit">
              Ir para o login
            </button>
          )}

          {estado === 'falha' && (
            <p className="text-muted text-sm" style={{ marginTop: '1rem' }}>
              Na tela de login, entre com seu e-mail e senha: se o cadastro ainda estiver pendente,
              o portal oferece o reenvio do link de validação.
            </p>
          )}
        </section>
      </div>
    </div>
  );
};

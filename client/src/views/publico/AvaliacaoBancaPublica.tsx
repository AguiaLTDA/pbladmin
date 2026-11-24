import React, { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2, UserCheck } from 'lucide-react';
import { BrandLogo } from '../../components/BrandLogo';
import { FormularioAvaliacaoBanca, formatarNota } from '../../components/FormularioAvaliacaoBanca';
import { apiRequest } from '../../services/api';

const CHAVE_IDENTIDADE = 'pbl_banca_avaliador';

function lerIdentidade(): { email: string; nome: string } {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_IDENTIDADE) || '{}');
    return { email: typeof v.email === 'string' ? v.email : '', nome: typeof v.nome === 'string' ? v.nome : '' };
  } catch {
    return { email: '', nome: '' };
  }
}

function novaSessao(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* segue para o fallback */
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Formulário público de avaliação da banca do PBL oral (link /<token>, sem login),
 * no padrão do formulário de julho. O avaliador se identifica com e-mail e nome
 * antes de ver o formulário; acesso, identificação e envios ficam na auditoria
 * do link público, no painel do admin.
 */
export const AvaliacaoBancaPublicaView: React.FC<{ token: string }> = ({ token }) => {
  const sessao = useMemo(novaSessao, []);
  const [identidade, setIdentidade] = useState(lerIdentidade);
  const [identificado, setIdentificado] = useState<{ email: string; nome: string } | null>(null);
  const [identificando, setIdentificando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<{ grupoNome: string; nota: number | null } | null>(null);
  // Remonta o formulário a cada "Enviar outra resposta".
  const [rodada, setRodada] = useState(0);

  async function identificar(e: React.FormEvent) {
    e.preventDefault();
    const email = identidade.email.trim().toLowerCase();
    const nome = identidade.nome.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErro('Informe um e-mail válido.');
    if (nome.length < 2) return setErro('Informe o nome do(a) avaliador(a).');
    setErro(null);
    setIdentificando(true);
    try {
      await apiRequest(`/public/banca/${token}/identificacao`, {
        method: 'POST',
        body: JSON.stringify({ sessao, avaliador_email: email, avaliador_nome: nome })
      });
      try {
        localStorage.setItem(CHAVE_IDENTIDADE, JSON.stringify({ email, nome }));
      } catch {
        /* sem localStorage: só não lembra na próxima visita */
      }
      setIdentificado({ email, nome });
    } catch (err: any) {
      setErro(err.message || 'Não foi possível abrir o formulário.');
    } finally {
      setIdentificando(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary, #f4f6f5)', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <header className="mb-4">
          <div style={{ marginBottom: '1rem' }}>
            <BrandLogo variante="clara" tamanho="md" />
          </div>
          <h1 style={{ fontSize: '1.6rem', marginBottom: '0.35rem' }}>Formulário de Avaliação de PBL</h1>
          <p className="text-muted">
            Prezado(a) Avaliador(a), seja bem-vindo(a). Sua participação é fundamental para o desenvolvimento
            acadêmico dos nossos estudantes.
          </p>
        </header>

        {!identificado ? (
          <form className="card" onSubmit={identificar} noValidate>
            <h3 className="font-bold mb-1">Identificação</h3>
            <p className="text-muted text-sm mb-3">
              Informe seu e-mail e nome para abrir o formulário. Eles ficam registrados em cada avaliação enviada.
            </p>
            <div className="form-group">
              <label className="form-label required" htmlFor="banca-email">E-mail</label>
              <input id="banca-email" type="email" className="form-control" autoComplete="email" maxLength={255}
                value={identidade.email} onChange={(e) => setIdentidade({ ...identidade, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label required" htmlFor="banca-nome">Nome do(a) avaliador(a)</label>
              <input id="banca-nome" className="form-control" autoComplete="name" maxLength={120}
                value={identidade.nome} onChange={(e) => setIdentidade({ ...identidade, nome: e.target.value })} />
            </div>
            {erro && <p className="text-sm mb-3" style={{ color: '#dc2626' }}>{erro}</p>}
            <button type="submit" className="btn btn-primary" disabled={identificando}>
              {identificando ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} Continuar
            </button>
          </form>
        ) : (
          <>
            <div className="card mb-4 flex flex-wrap items-center justify-between gap-2" style={{ padding: '0.85rem 1rem' }}>
              <span className="text-sm flex items-center gap-2">
                <UserCheck size={16} /> Avaliando como <strong>{identificado.nome}</strong> ({identificado.email})
              </span>
              <button type="button" className="btn btn-secondary btn-sm"
                onClick={() => { setIdentificado(null); setEnviado(null); }}>
                Trocar
              </button>
            </div>

            {enviado ? (
              <div className="card text-center" style={{ padding: '2rem 1.5rem' }}>
                <CheckCircle2 size={40} color="#059669" style={{ margin: '0 auto 0.75rem' }} />
                <h2 style={{ fontSize: '1.3rem' }}>Envio confirmado</h2>
                <p className="text-muted mb-4">
                  Nota da banca para o grupo{enviado.grupoNome ? ` ${enviado.grupoNome}` : ''}:{' '}
                  <strong style={{ color: 'var(--text-primary, inherit)' }}>{formatarNota(enviado.nota)}</strong> (de 0 a 1,3)
                </p>
                <button type="button" className="btn btn-primary" style={{ margin: '0 auto' }}
                  onClick={() => {
                    setEnviado(null);
                    setRodada((r) => r + 1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}>
                  Enviar outra resposta
                </button>
              </div>
            ) : (
              <>
                <div className="card mb-4 text-sm">
                  <h3 className="font-bold mb-2">Instruções</h3>
                  <p className="mb-1">
                    <strong>Fluxo:</strong> escolha o dia e a sala da sua banca; o formulário mostra apenas as turmas
                    daquela sala.
                  </p>
                  <p className="mb-1">
                    <strong>Critérios:</strong> avalie cada item de <strong>1 (Insuficiente)</strong> a{' '}
                    <strong>5 (Excelente)</strong>. As perguntas seguem os critérios do PBL oral do Manual do Aluno:
                    domínio do conteúdo (0,5), clareza e organização da exposição (0,3), qualidade do material de apoio
                    (0,2) e resposta à arguição (0,3).
                  </p>
                  <p className="mb-0">
                    <strong>Individualidade:</strong> preencha um formulário por grupo avaliado. Reenviar para o mesmo
                    grupo com o mesmo e-mail substitui a avaliação anterior.
                  </p>
                </div>
                <FormularioAvaliacaoBanca
                  key={rodada}
                  publico={{ token, sessao, email: identificado.email, nome: identificado.nome }}
                  onSalvo={(r) => r && setEnviado(r)}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

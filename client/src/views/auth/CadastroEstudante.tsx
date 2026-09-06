import React, { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { FormularioEstudante } from '../../components/FormularioEstudante';
import { apiRequest } from '../../services/api';
import { StudentRegistrationInput } from '../../types';
import { GraduationCap, ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '../../components/BrandLogo';

interface CadastroEstudanteProps {
  navigate: (path: string) => void;
}

export const CadastroEstudanteView: React.FC<CadastroEstudanteProps> = ({ navigate }) => {
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [concluido, setConcluido] = useState<{ id: number } | null>(null);

  const handleSubmit = async (dados: StudentRegistrationInput) => {
    setSubmitting(true);
    try {
      const res = await apiRequest<{ id: number; message: string }>('/public/pre-cadastro', {
        method: 'POST',
        body: JSON.stringify(dados)
      });
      showToast(res.message, 'success');
      setConcluido({ id: res.id });
    } catch (err: any) {
      showToast(err.message || 'Não foi possível concluir o cadastro.', 'error');
      throw err;
    } finally {
      setSubmitting(false);
    }
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
          maxWidth: '640px',
          background: '#ffffff',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
          color: 'var(--text-main)'
        }}
      >
        <div style={{ padding: '2rem 2.5rem', background: 'linear-gradient(135deg, #092f1e 0%, #0c422b 100%)', color: 'white' }}>
          {/* Porta de entrada pública: a marca institucional vem primeiro. */}
          <div
            style={{
              paddingBottom: '1.25rem',
              marginBottom: '1.25rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.14)'
            }}
          >
            <BrandLogo variante="escura" tamanho="md" />
          </div>

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
              marginBottom: '1rem'
            }}
          >
            <GraduationCap size={14} color="#d94a34" />
            <span>CADASTRO DE ESTUDANTE</span>
          </div>

          <h1
            style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: '1.9rem',
              fontWeight: 400,
              marginBottom: '0.5rem',
              color: '#ffffff'
            }}
          >
            Cadastre-se na Plataforma PBL
          </h1>

          <p style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            Preencha seus dados acadêmicos e já escolha a senha de acesso — seu login é o
            e-mail informado abaixo. O registro é enviado para a secretaria e, após a
            validação, você já entra no portal com essas mesmas credenciais.
          </p>
        </div>

        <div style={{ padding: '2rem 2.5rem' }}>
          {concluido ? (
            <div className="text-center">
              <CheckCircle2 size={56} color="#16a34a" style={{ margin: '0 auto 1rem' }} />
              <h2 className="font-bold text-lg mb-2">Cadastro recebido!</h2>
              <p className="text-muted text-sm mb-4">
                Protocolo <strong>#{concluido.id}</strong>. Seu cadastro foi registrado e aguarda a
                validação da secretaria. Assim que for aprovado, entre no portal com o e-mail e a
                senha que você acabou de definir.
              </p>

              <div className="flex gap-2" style={{ justifyContent: 'center' }}>
                <button onClick={() => setConcluido(null)} className="btn btn-secondary">
                  Cadastrar outro estudante
                </button>
                <button onClick={() => navigate('/login')} className="btn btn-primary">
                  Ir para o Login
                </button>
              </div>
            </div>
          ) : (
            <>
              <FormularioEstudante
                onSubmit={handleSubmit}
                submitting={submitting}
                origem="AUTOCADASTRO"
                senhaObrigatoria
              />

              <div
                className="flex items-center gap-2 text-muted"
                style={{ marginTop: '1.5rem', fontSize: '0.75rem' }}
              >
                <ShieldCheck size={14} />
                <span>Seus dados são usados exclusivamente para fins acadêmicos na UNIVC.</span>
              </div>

              <button
                onClick={() => navigate('/login')}
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '1rem' }}
              >
                <ArrowLeft size={16} />
                Voltar para o login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

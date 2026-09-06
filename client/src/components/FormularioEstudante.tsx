import React, { useState } from 'react';
import { StudentRegistrationInput } from '../types';
import { CURSOS_DISPONIVEIS, PERIODOS_DISPONIVEIS } from '../constants/academico';
import { Eye, EyeOff } from 'lucide-react';

interface FormularioEstudanteProps {
  onSubmit: (dados: StudentRegistrationInput) => Promise<void>;
  submitting: boolean;
  origem: string;
  textoBotao?: string;
  onCancel?: () => void;
  /** Autocadastro público: o aluno precisa sair já com login (e-mail) e senha definidos. */
  senhaObrigatoria?: boolean;
}

const ESTADO_INICIAL: StudentRegistrationInput = {
  nome: '',
  email: '',
  matricula: '',
  cpf: '',
  telefone: '',
  curso: '',
  turma: '',
  periodo: ''
};

export const FormularioEstudante: React.FC<FormularioEstudanteProps> = ({
  onSubmit,
  submitting,
  origem,
  textoBotao = 'Finalizar Cadastro',
  onCancel,
  senhaObrigatoria = false
}) => {
  const [dados, setDados] = useState<StudentRegistrationInput>(ESTADO_INICIAL);
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState<string | null>(null);

  const setCampo = (campo: keyof StudentRegistrationInput, valor: string) =>
    setDados((atual) => ({ ...atual, [campo]: valor }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroSenha(null);

    if (senhaObrigatoria && !senha) {
      setErroSenha('Defina a senha de acesso ao portal.');
      return;
    }
    if (senha && senha.length < 6) {
      setErroSenha('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (senha && senha !== confirmarSenha) {
      setErroSenha('As senhas não coincidem.');
      return;
    }

    await onSubmit({ ...dados, origem, senha: senha || undefined });
    setDados(ESTADO_INICIAL);
    setSenha('');
    setConfirmarSenha('');
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label required">Nome Completo</label>
        <input
          type="text"
          className="form-control"
          placeholder="Ex: Maria Eduarda Santos"
          value={dados.nome}
          onChange={(e) => setCampo('nome', e.target.value)}
          required
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="form-group" style={{ flex: 1, minWidth: '240px' }}>
          <label className="form-label required">E-mail</label>
          <input
            type="email"
            className="form-control"
            placeholder="maria.santos@pbl.edu.br"
            value={dados.email}
            onChange={(e) => setCampo('email', e.target.value)}
            required
          />
        </div>

        <div className="form-group" style={{ flex: 1, minWidth: '180px' }}>
          <label className="form-label required">Matrícula</label>
          <input
            type="text"
            className="form-control"
            placeholder="Ex: 2026001234"
            value={dados.matricula}
            onChange={(e) => setCampo('matricula', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="form-group" style={{ flex: 1, minWidth: '180px' }}>
          <label className={`form-label${senhaObrigatoria ? ' required' : ''}`}>Senha de acesso</label>
          <div style={{ position: 'relative' }}>
            <input
              type={mostrarSenha ? 'text' : 'password'}
              className="form-control"
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required={senhaObrigatoria}
              style={{ paddingRight: '2.5rem' }}
            />
            <button
              type="button"
              onClick={() => setMostrarSenha((v) => !v)}
              aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              title={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              style={{
                position: 'absolute',
                right: '0.6rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted, #6b7280)',
                display: 'flex'
              }}
            >
              {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="form-group" style={{ flex: 1, minWidth: '180px' }}>
          <label className={`form-label${senhaObrigatoria ? ' required' : ''}`}>Confirmar senha</label>
          <input
            type={mostrarSenha ? 'text' : 'password'}
            className="form-control"
            placeholder="Repita a senha"
            autoComplete="new-password"
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            required={senhaObrigatoria}
          />
        </div>
      </div>

      {erroSenha && (
        <div className="text-sm" style={{ color: '#d94a34', marginTop: '-0.5rem', marginBottom: '0.75rem' }}>
          {erroSenha}
        </div>
      )}

      {!senhaObrigatoria && (
        <div className="text-muted text-sm" style={{ marginTop: '-0.5rem', marginBottom: '0.75rem' }}>
          Deixe em branco para gerar uma senha temporária automaticamente na aprovação.
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <div className="form-group" style={{ flex: 1, minWidth: '180px' }}>
          <label className="form-label">CPF</label>
          <input
            type="text"
            className="form-control"
            placeholder="000.000.000-00"
            value={dados.cpf}
            onChange={(e) => setCampo('cpf', e.target.value)}
          />
        </div>

        <div className="form-group" style={{ flex: 1, minWidth: '180px' }}>
          <label className="form-label">Telefone</label>
          <input
            type="tel"
            className="form-control"
            placeholder="(27) 99999-0000"
            value={dados.telefone}
            onChange={(e) => setCampo('telefone', e.target.value)}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label required">Curso</label>
        <select
          className="form-control"
          value={dados.curso}
          onChange={(e) => setCampo('curso', e.target.value)}
          required
        >
          <option value="">Selecione o curso...</option>
          {CURSOS_DISPONIVEIS.map((curso) => (
            <option key={curso} value={curso}>
              {curso}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="form-group" style={{ flex: 1, minWidth: '180px' }}>
          <label className="form-label">Turma</label>
          <input
            type="text"
            className="form-control"
            placeholder="Ex: ADMCONT-01"
            value={dados.turma}
            onChange={(e) => setCampo('turma', e.target.value)}
          />
        </div>

        <div className="form-group" style={{ flex: 1, minWidth: '180px' }}>
          <label className="form-label">Período</label>
          <select
            className="form-control"
            value={dados.periodo}
            onChange={(e) => setCampo('periodo', e.target.value)}
          >
            <option value="">Selecione...</option>
            {PERIODOS_DISPONIVEIS.map((periodo) => (
              <option key={periodo} value={periodo}>
                {periodo}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2" style={{ marginTop: '1rem' }}>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-secondary">
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="btn btn-primary"
          style={{ flex: 1, padding: '0.85rem', fontSize: '1rem' }}
        >
          {submitting ? 'Enviando...' : textoBotao}
        </button>
      </div>
    </form>
  );
};

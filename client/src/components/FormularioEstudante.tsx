import React, { useState } from 'react';
import { StudentRegistrationInput } from '../types';
import { CURSOS_DISPONIVEIS, PERIODOS_DISPONIVEIS } from '../constants/academico';

interface FormularioEstudanteProps {
  onSubmit: (dados: StudentRegistrationInput) => Promise<void>;
  submitting: boolean;
  origem: string;
  textoBotao?: string;
  onCancel?: () => void;
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
  onCancel
}) => {
  const [dados, setDados] = useState<StudentRegistrationInput>(ESTADO_INICIAL);

  const setCampo = (campo: keyof StudentRegistrationInput, valor: string) =>
    setDados((atual) => ({ ...atual, [campo]: valor }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ ...dados, origem });
    setDados(ESTADO_INICIAL);
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

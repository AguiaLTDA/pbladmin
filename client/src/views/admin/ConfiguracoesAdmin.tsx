import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { MandatoryFieldConfig } from '../../types';
import { useToast } from '../../context/ToastContext';
import { Settings, Save, CheckSquare, Square } from 'lucide-react';

export const ConfiguracoesAdminView: React.FC = () => {
  const { showToast } = useToast();
  const [fields, setFields] = useState<MandatoryFieldConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiRequest<MandatoryFieldConfig[]>('/pbl/mandatory-fields')
      .then((res) => setFields(res))
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = (id: number) => {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, obrigatorio: f.obrigatorio ? 0 : 1 } : f))
    );
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      await apiRequest('/pbl/mandatory-fields', {
        method: 'PUT',
        body: JSON.stringify({ campos: fields })
      });
      showToast('Configuração de campos obrigatórios salva com sucesso!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar configurações.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Configurações da Plataforma PBL</h2>
          <p className="text-muted text-sm">
            Defina quais campos do formulário de submissão do professor são de preenchimento obrigatório para envio para análise.
          </p>
        </div>

        <button onClick={handleSave} disabled={submitting} className="btn btn-primary">
          <Save size={18} />
          {submitting ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted">Carregando configurações...</div>
      ) : (
        <div className="card">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Settings size={18} color="var(--primary)" />
            Campos do Formulário PBL (Professor)
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {fields.map((f) => (
              <div
                key={f.id}
                onClick={() => handleToggle(f.id)}
                className="flex items-center justify-between p-3 cursor-pointer"
                style={{
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: f.obrigatorio ? 'var(--primary-light)' : 'var(--bg-main)',
                  transition: 'all 0.15s ease'
                }}
              >
                <div>
                  <div className="font-bold text-sm">{f.rotulo}</div>
                  <div className="text-muted text-xs">Identificador técnico: <code>{f.nome_campo}</code></div>
                </div>

                <div className="flex items-center gap-2 font-bold text-sm" style={{ color: f.obrigatorio ? 'var(--primary)' : 'var(--text-muted)' }}>
                  {f.obrigatorio ? <CheckSquare size={20} color="var(--primary)" /> : <Square size={20} />}
                  <span>{f.obrigatorio ? 'Obrigatório' : 'Opcional'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

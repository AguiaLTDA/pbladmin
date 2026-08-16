import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { PBLActivity } from '../../types';
import { useToast } from '../../context/ToastContext';
import { PlusCircle, Edit3, Send, Eye, Clock, AlertTriangle, Layers } from 'lucide-react';

interface Props {
  navigate: (path: string) => void;
}

export const MinhasAtividadesProfessorView: React.FC<Props> = ({ navigate }) => {
  const { showToast } = useToast();
  const [activities, setActivities] = useState<PBLActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = () => {
    setLoading(true);
    apiRequest<PBLActivity[]>('/pbl/activities')
      .then((res) => setActivities(res))
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const handleSubmitForAnalysis = async (id: number) => {
    try {
      const res = await apiRequest(`/pbl/activities/${id}/submit`, { method: 'POST' });
      showToast(res.message, 'success');
      fetchActivities();
    } catch (err: any) {
      showToast(err.message || 'Erro ao submeter para análise.', 'error');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Minhas Atividades PBL</h2>
          <p className="text-muted text-sm">
            Gerencie seus rascunhos, submeta para validação da administração e acompanhe o status de análise.
          </p>
        </div>

        <button onClick={() => navigate('/professor/criar-pbl')} className="btn btn-primary">
          <PlusCircle size={18} />
          Nova Atividade PBL
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted">Carregando suas atividades...</div>
      ) : activities.length === 0 ? (
        <div className="card text-center py-8">
          <Layers size={36} className="text-muted mb-2" style={{ margin: '0 auto' }} />
          <h3 className="font-bold">Nenhuma atividade criada ainda</h3>
          <p className="text-muted text-sm">Clique em 'Nova Atividade PBL' para começar a estrutura do seu projeto.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Título da Atividade PBL</th>
                <th>Curso / Disciplina</th>
                <th>Status</th>
                <th>Versão</th>
                <th>Atualização</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((act) => (
                <tr key={act.id}>
                  <td><strong style={{ color: 'var(--primary)' }}>{act.codigo_unico}</strong></td>
                  <td>
                    <div className="font-bold">{act.titulo}</div>
                  </td>
                  <td>
                    <div>{act.curso_nome}</div>
                    <div className="text-muted text-sm">{act.disciplina_nome}</div>
                  </td>
                  <td>
                    <span className={`status-badge status-${act.status}`}>
                      {act.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>v{act.versao_atual}</td>
                  <td>{new Date(act.atualizado_em).toLocaleDateString('pt-BR')}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex justify-end gap-2">
                      {['RASCUNHO', 'AJUSTES_SOLICITADOS'].includes(act.status) && (
                        <>
                          <button
                            onClick={() => navigate(`/professor/editar-pbl/${act.id}`)}
                            className="btn btn-secondary btn-sm"
                            title="Editar Formulário PBL"
                          >
                            <Edit3 size={14} /> Editar
                          </button>

                          <button
                            onClick={() => handleSubmitForAnalysis(act.id)}
                            className="btn btn-primary btn-sm"
                            title="Enviar para Análise da Administração"
                          >
                            <Send size={14} /> Enviar
                          </button>
                        </>
                      )}

                      {!['RASCUNHO', 'AJUSTES_SOLICITADOS'].includes(act.status) && (
                        <button
                          onClick={() => navigate(`/professor/detalhes-pbl/${act.id}`)}
                          className="btn btn-secondary btn-sm"
                        >
                          <Eye size={14} /> Visualizar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

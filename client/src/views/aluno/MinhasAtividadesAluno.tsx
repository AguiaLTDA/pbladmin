import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { GraduationCap, Clock, CheckCircle2, AlertTriangle, ArrowRight, Eye, Calendar } from 'lucide-react';

interface Props {
  navigate: (path: string) => void;
}

export const MinhasAtividadesAlunoView: React.FC<Props> = ({ navigate }) => {
  const { showToast } = useToast();
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');

  const fetchActivities = () => {
    setLoading(true);
    let query = '/submissions/student/activities?';
    if (filtro) query += `statusFiltro=${filtro}&`;

    apiRequest<any[]>(query)
      .then((res) => setActivities(res))
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchActivities();
  }, [filtro]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Minhas Atividades PBL</h2>
          <p className="text-muted text-sm">
            Atividades disponibilizadas e validadas pela administração especificamente para sua turma.
          </p>
        </div>
      </div>

      <div className="card mb-4" style={{ padding: '1rem' }}>
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold">Filtrar por Situação:</span>
          <select
            className="form-control"
            style={{ maxWidth: '240px' }}
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          >
            <option value="">Todas as Atividades</option>
            <option value="PENDENTE">Pendentes</option>
            <option value="EM_ANDAMENTO">Em Andamento (Rascunho)</option>
            <option value="CONCLUIDA">Entregas Concluídas</option>
            <option value="ATRASADA">Atrasadas</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted">Carregando suas atividades...</div>
      ) : activities.length === 0 ? (
        <div className="card text-center py-8">
          <GraduationCap size={36} className="text-muted mb-2" style={{ margin: '0 auto' }} />
          <h3 className="font-bold">Nenhuma atividade encontrada</h3>
          <p className="text-muted text-sm">Você não possui atividades pendentes no filtro selecionado.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {activities.map((act) => {
            const isConcluida = act.estadoAluno === 'CONCLUIDA';
            const isAtrasada = act.estadoAluno === 'ATRASADA';
            const isEmAndamento = act.estadoAluno === 'EM_ANDAMENTO';

            return (
              <div
                key={act.id}
                className="card flex flex-col justify-between"
                style={{
                  borderTop: `4px solid ${
                    isConcluida ? '#10b981' : isAtrasada ? '#ef4444' : isEmAndamento ? '#f59e0b' : '#3b82f6'
                  }`
                }}
              >
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-xs" style={{ color: 'var(--primary)' }}>
                      {act.codigo_unico}
                    </span>
                    <span
                      className="status-badge"
                      style={{
                        background: isConcluida ? '#dcfce7' : isAtrasada ? '#fee2e2' : isEmAndamento ? '#fef3c7' : '#e0f2fe',
                        color: isConcluida ? '#15803d' : isAtrasada ? '#b91c1c' : isEmAndamento ? '#b45309' : '#0369a1'
                      }}
                    >
                      {act.estadoAluno}
                    </span>
                  </div>

                  <h3 className="font-bold mb-2" style={{ fontSize: '1.1rem' }}>
                    {act.titulo}
                  </h3>

                  <div className="text-sm text-muted mb-4">
                    <div><strong>Curso:</strong> {act.curso_nome}</div>
                    <div><strong>Disciplina:</strong> {act.disciplina_nome}</div>
                    <div><strong>Professor:</strong> {act.professor_nome}</div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1 text-sm text-muted mb-4 p-2" style={{ background: 'var(--bg-main)', borderRadius: '6px' }}>
                    <Calendar size={16} />
                    <span>Prazo de Entrega: <strong>{new Date(act.prazo_entrega).toLocaleString('pt-BR')}</strong></span>
                  </div>

                  {act.nota_total !== undefined && act.liberado_aluno === 1 && (
                    <div className="p-2 mb-3" style={{ background: '#dcfce7', borderRadius: '6px', color: '#15803d', fontWeight: 'bold', fontSize: '0.85rem' }}>
                      Nota Final Liberada: {act.nota_total.toFixed(2)} pts
                    </div>
                  )}

                  <button
                    onClick={() => navigate(`/aluno/atividade/${act.id}`)}
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                  >
                    <Eye size={16} />
                    Abrir Atividade & Entregar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

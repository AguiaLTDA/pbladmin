import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Calendar, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  navigate: (path: string) => void;
}

export const CalendarioPrazosAlunoView: React.FC<Props> = ({ navigate }) => {
  const { showToast } = useToast();
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<any[]>('/submissions/student/activities')
      .then((res) => {
        // Sort by deadline date ascending
        const sorted = [...res].sort(
          (a, b) => new Date(a.prazo_entrega).getTime() - new Date(b.prazo_entrega).getTime()
        );
        setActivities(sorted);
      })
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Calendário e Linha do Tempo de Prazos</h2>
          <p className="text-muted text-sm">Cronograma de entregas das suas atividades PBL organizadas por data de vencimento.</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted">Carregando linha do tempo de prazos...</div>
      ) : activities.length === 0 ? (
        <div className="card text-center py-8">
          <Calendar size={36} className="text-muted mb-2" style={{ margin: '0 auto' }} />
          <h3 className="font-bold">Nenhum prazo cadastrado</h3>
          <p className="text-muted text-sm">Você não possui atividades com prazos pendentes.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {activities.map((act) => {
            const prazoDate = new Date(act.prazo_entrega);
            const isLate = prazoDate < new Date() && act.entrega_status !== 'ENVIADO';

            return (
              <div
                key={act.id}
                className="card flex items-center justify-between"
                style={{
                  borderLeft: `6px solid ${
                    act.entrega_status === 'ENVIADO' ? '#10b981' : isLate ? '#ef4444' : '#3b82f6'
                  }`
                }}
              >
                <div className="flex items-center gap-4">
                  <div
                    style={{
                      padding: '0.85rem 1.25rem',
                      borderRadius: '12px',
                      background: 'var(--bg-main)',
                      textAlign: 'center',
                      minWidth: '100px'
                    }}
                  >
                    <div className="font-bold text-xs text-muted">VENCIMENTO</div>
                    <div className="font-bold text-sm" style={{ color: 'var(--primary)' }}>
                      {prazoDate.toLocaleDateString('pt-BR')}
                    </div>
                    <div className="text-xs text-muted">{prazoDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>

                  <div>
                    <span className="font-bold text-xs text-muted">{act.codigo_unico} • {act.curso_nome}</span>
                    <h3 className="font-bold" style={{ fontSize: '1.1rem' }}>{act.titulo}</h3>
                    <span className="text-sm text-muted">Professor: {act.professor_nome}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className="status-badge"
                    style={{
                      background: act.entrega_status === 'ENVIADO' ? '#dcfce7' : isLate ? '#fee2e2' : '#e0f2fe',
                      color: act.entrega_status === 'ENVIADO' ? '#15803d' : isLate ? '#b91c1c' : '#0369a1'
                    }}
                  >
                    {act.entrega_status === 'ENVIADO' ? 'CONCLUÍDO' : isLate ? 'ATRASADO' : 'PENDENTE'}
                  </span>

                  <button onClick={() => navigate(`/aluno/atividade/${act.id}`)} className="btn btn-secondary btn-sm">
                    Abrir Detalhes
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

import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Calendar, Clock, Send, CheckCircle2, ArrowLeft, AlertCircle } from 'lucide-react';

interface Props {
  activityId: string;
  navigate: (path: string) => void;
}

export const AgendamentoPublicacaoView: React.FC<Props> = ({ activityId, navigate }) => {
  const { showToast } = useToast();

  const [prazoEntrega, setPrazoEntrega] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30); // Default +30 days
    return d.toISOString().slice(0, 16);
  });

  const [agendarFuturo, setAgendarFuturo] = useState(false);
  const [agendadoPara, setAgendadoPara] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activity, setActivity] = useState<any>(null);

  useEffect(() => {
    apiRequest(`/pbl/activities/${activityId}`)
      .then((res) => setActivity(res.atividade))
      .catch((err) => showToast(err.message, 'error'));
  }, [activityId]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();

    const segDataRaw = localStorage.getItem(`pbl_segmentation_${activityId}`);
    if (!segDataRaw) {
      showToast('Nenhuma regra de público encontrada. Volte para a etapa de segmentação.', 'warning');
      return;
    }

    const { regras } = JSON.parse(segDataRaw);

    if (!prazoEntrega) {
      showToast('O prazo final de entrega é obrigatório.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest(`/publication/activities/${activityId}/publish`, {
        method: 'POST',
        body: JSON.stringify({
          tipoSegmentacao: 'MISTO',
          regras,
          prazoEntrega: new Date(prazoEntrega).toISOString(),
          agendadoPara: agendarFuturo && agendadoPara ? new Date(agendadoPara).toISOString() : null
        })
      });

      showToast(res.message, 'success');
      localStorage.removeItem(`pbl_segmentation_${activityId}`);
      navigate('/admin/caixa-entrada');
    } catch (err: any) {
      showToast(err.message || 'Erro ao publicar atividade.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate(`/admin/segmentacao/${activityId}`)} className="btn btn-secondary btn-sm">
          <ArrowLeft size={16} />
          Voltar para Segmentação
        </button>
        <span className="font-bold text-sm text-muted">ETAPA 3 DE 3: PUBLICAÇÃO & PRAZOS</span>
      </div>

      <div className="card mb-4">
        <h2 style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>Configuração de Disponibilização e Prazos</h2>
        <p className="text-muted text-sm">
          Defina o prazo final de entrega para os alunos e escolha entre publicar imediatamente ou agendar para uma data futura.
        </p>
      </div>

      {activity && (
        <div className="card mb-4" style={{ background: 'var(--primary-light)' }}>
          <span className="font-bold text-sm">Atividade Pronta para Publicação:</span>
          <h3 className="font-bold" style={{ color: 'var(--primary)' }}>{activity.titulo}</h3>
          <span className="text-sm text-muted">Código: {activity.codigo_unico}</span>
        </div>
      )}

      <form onSubmit={handlePublish} className="card">
        <div className="form-group mb-4">
          <label className="form-label required">Prazo Final de Entrega para os Alunos</label>
          <div style={{ position: 'relative' }}>
            <Calendar size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748b' }} />
            <input
              type="datetime-local"
              className="form-control"
              style={{ paddingLeft: '40px' }}
              value={prazoEntrega}
              onChange={(e) => setPrazoEntrega(e.target.value)}
              required
            />
          </div>
          <span className="text-muted text-xs">Após esta data, entregas serão marcadas como 'ATRASADA'.</span>
        </div>

        <div className="form-group mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={agendarFuturo}
              onChange={(e) => setAgendarFuturo(e.target.checked)}
            />
            <span className="font-bold text-sm">Agendar publicação para uma data/hora futura</span>
          </label>
        </div>

        {agendarFuturo && (
          <div className="form-group mb-4" style={{ padding: '1rem', background: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <label className="form-label required">Data e Hora do Agendamento Futuro</label>
            <div style={{ position: 'relative' }}>
              <Clock size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748b' }} />
              <input
                type="datetime-local"
                className="form-control"
                style={{ paddingLeft: '40px' }}
                value={agendadoPara}
                onChange={(e) => setAgendadoPara(e.target.value)}
                required={agendarFuturo}
              />
            </div>
            <span className="text-muted text-xs">A atividade só ficará visível aos alunos a partir do momento agendado.</span>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={() => navigate('/admin/caixa-entrada')} className="btn btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={submitting} className="btn btn-success" style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}>
            <Send size={18} />
            {submitting ? 'Publicando...' : agendarFuturo ? 'Confirmar Agendamento' : 'Publicar Atividade Agora'}
          </button>
        </div>
      </form>
    </div>
  );
};

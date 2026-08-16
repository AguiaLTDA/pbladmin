import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { GraduationCap, Clock, CheckCircle2, AlertTriangle, ArrowRight, Sparkles } from 'lucide-react';

interface AlunoDashboardData {
  kpis: {
    novas: number;
    emAndamento: number;
    concluidas: number;
    atrasadas: number;
    total: number;
  };
}

interface Props {
  navigate: (path: string) => void;
}

export const DashboardAlunoView: React.FC<Props> = ({ navigate }) => {
  const [data, setData] = useState<AlunoDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<AlunoDashboardData>('/dashboard')
      .then((res) => setData(res))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4 text-center">Carregando portal do aluno...</div>;

  const k = data?.kpis;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Portal do Aluno — Meu Painel PBL</h2>
          <p className="text-muted text-sm">Acompanhe suas atividades disponibilizadas, prazos e entregas efetuadas.</p>
        </div>

        <button onClick={() => navigate('/aluno/atividades')} className="btn btn-primary">
          <GraduationCap size={18} />
          Ver Minhas Atividades
        </button>
      </div>

      {/* Cards de KPIs */}
      <div className="grid-kpi">
        <div className="kpi-card" style={{ '--kpi-color': '#0284c7', '--kpi-bg': '#e0f2fe' } as React.CSSProperties}>
          <div className="kpi-icon-wrapper">
            <Sparkles size={24} />
          </div>
          <div>
            <div className="kpi-value">{k?.novas || 0}</div>
            <div className="kpi-label">Atividades Novas / Pendentes</div>
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-color': '#d97706', '--kpi-bg': '#fef3c7' } as React.CSSProperties}>
          <div className="kpi-icon-wrapper">
            <Clock size={24} />
          </div>
          <div>
            <div className="kpi-value">{k?.emAndamento || 0}</div>
            <div className="kpi-label">Rascunho em Andamento</div>
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-color': '#16a34a', '--kpi-bg': '#dcfce7' } as React.CSSProperties}>
          <div className="kpi-icon-wrapper">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="kpi-value">{k?.concluidas || 0}</div>
            <div className="kpi-label">Entregas Concluídas</div>
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-color': '#ef4444', '--kpi-bg': '#fee2e2' } as React.CSSProperties}>
          <div className="kpi-icon-wrapper">
            <AlertTriangle size={24} />
          </div>
          <div>
            <div className="kpi-value">{k?.atrasadas || 0}</div>
            <div className="kpi-label">Atividades Atrasadas</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        <div className="card">
          <h3 className="font-bold mb-3">Ações do Aluno</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button onClick={() => navigate('/aluno/atividades')} className="btn btn-secondary justify-between">
              <span>Acessar Atividades Direcionadas</span>
              <ArrowRight size={16} />
            </button>

            <button onClick={() => navigate('/aluno/calendario')} className="btn btn-secondary justify-between">
              <span>Consultar Calendário de Prazos</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { FileEdit, Clock, AlertTriangle, Send, Users, PlusCircle, ArrowRight } from 'lucide-react';

interface ProfessorDashboardData {
  kpis: {
    rascunhos: number;
    emAnalise: number;
    ajustesPendentes: number;
    publicadas: number;
    alunosAlcancados: number;
  };
}

interface Props {
  navigate: (path: string) => void;
}

export const DashboardProfessorView: React.FC<Props> = ({ navigate }) => {
  const [data, setData] = useState<ProfessorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<ProfessorDashboardData>('/dashboard')
      .then((res) => setData(res))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4 text-center">Carregando painel do docente...</div>;

  const k = data?.kpis;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Portal do Professor — Visão Geral</h2>
          <p className="text-muted text-sm">Acompanhe a criação, submissão para análise e resultado das suas atividades PBL.</p>
        </div>

        <button onClick={() => navigate('/professor/criar-pbl')} className="btn btn-primary">
          <PlusCircle size={18} />
          Criar Nova Atividade PBL
        </button>
      </div>

      {/* Grid de KPIs */}
      <div className="grid-kpi">
        <div className="kpi-card" style={{ '--kpi-color': '#64748b', '--kpi-bg': '#f1f5f9' } as React.CSSProperties}>
          <div className="kpi-icon-wrapper">
            <FileEdit size={24} />
          </div>
          <div>
            <div className="kpi-value">{k?.rascunhos || 0}</div>
            <div className="kpi-label">Rascunhos em Edição</div>
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-color': '#0284c7', '--kpi-bg': '#e0f2fe' } as React.CSSProperties}>
          <div className="kpi-icon-wrapper">
            <Clock size={24} />
          </div>
          <div>
            <div className="kpi-value">{k?.emAnalise || 0}</div>
            <div className="kpi-label">Em Análise Administrativa</div>
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-color': '#d97706', '--kpi-bg': '#fef3c7' } as React.CSSProperties}>
          <div className="kpi-icon-wrapper">
            <AlertTriangle size={24} />
          </div>
          <div>
            <div className="kpi-value">{k?.ajustesPendentes || 0}</div>
            <div className="kpi-label">Ajustes Solicitados</div>
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-color': '#059669', '--kpi-bg': '#d1fae5' } as React.CSSProperties}>
          <div className="kpi-icon-wrapper">
            <Send size={24} />
          </div>
          <div>
            <div className="kpi-value">{k?.publicadas || 0}</div>
            <div className="kpi-label">Atividades Publicadas</div>
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-color': '#7c3aed', '--kpi-bg': '#f3e8ff' } as React.CSSProperties}>
          <div className="kpi-icon-wrapper">
            <Users size={24} />
          </div>
          <div>
            <div className="kpi-value">{k?.alunosAlcancados || 0}</div>
            <div className="kpi-label">Alunos Alcançados</div>
          </div>
        </div>
      </div>

      {/* Ações e Alertas */}
      {k?.ajustesPendentes! > 0 && (
        <div className="card mb-4" style={{ background: '#fffbeb', border: '1px solid #fef3c7' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle color="#d97706" size={20} />
              <div>
                <strong style={{ color: '#b45309' }}>Você possui {k?.ajustesPendentes} atividade(s) com solicitação de ajuste!</strong>
                <p className="text-sm text-muted">Acesse suas atividades para visualizar a justificativa do administrador e reenviar.</p>
              </div>
            </div>
            <button onClick={() => navigate('/professor/atividades')} className="btn btn-warning btn-sm">
              Ver Ajustes Pendentes
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        <div className="card">
          <h3 className="font-bold mb-3">Atalhos do Docente</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button onClick={() => navigate('/professor/criar-pbl')} className="btn btn-secondary justify-between">
              <span>Criar Nova Atividade PBL</span>
              <ArrowRight size={16} />
            </button>

            <button onClick={() => navigate('/professor/atividades')} className="btn btn-secondary justify-between">
              <span>Gerenciar Minhas Atividades</span>
              <ArrowRight size={16} />
            </button>

            <button onClick={() => navigate('/professor/entregas')} className="btn btn-secondary justify-between">
              <span>Acompanhar Entregas & Lançar Notas</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

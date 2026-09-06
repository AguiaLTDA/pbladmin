import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { Send, Users, Award, BookOpen, ArrowRight, AlertTriangle } from 'lucide-react';

interface ProfessorDashboardData {
  kpis: {
    publicadas: number;
    alunosAlcancados: number;
    entregasPendentes: number;
    temArquivoOrientador: boolean;
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
      <div className="mb-4">
        <h2 style={{ fontSize: '1.4rem' }}>Portal do Professor — Visão Geral</h2>
        <p className="text-muted text-sm">
          Acompanhe as entregas das turmas que você leciona e o seu arquivo orientador.
        </p>
      </div>

      {/* Grid de KPIs */}
      <div className="grid-kpi">
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

        <div className="kpi-card" style={{ '--kpi-color': '#d97706', '--kpi-bg': '#fef3c7' } as React.CSSProperties}>
          <div className="kpi-icon-wrapper">
            <Award size={24} />
          </div>
          <div>
            <div className="kpi-value">{k?.entregasPendentes || 0}</div>
            <div className="kpi-label">Entregas Pendentes de Avaliação</div>
          </div>
        </div>
      </div>

      {/* Alerta de entregas pendentes */}
      {k?.entregasPendentes! > 0 && (
        <div className="card mb-4" style={{ background: '#fffbeb', border: '1px solid #fef3c7' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle color="#d97706" size={20} />
              <div>
                <strong style={{ color: '#b45309' }}>
                  Você possui {k?.entregasPendentes} entrega(s) aguardando avaliação!
                </strong>
                <p className="text-sm text-muted">Corrija e libere a nota para o aluno visualizar no portal.</p>
              </div>
            </div>
            <button onClick={() => navigate('/professor/entregas')} className="btn btn-warning btn-sm">
              Avaliar Agora
            </button>
          </div>
        </div>
      )}

      {/* Alerta de arquivo orientador pendente */}
      {!k?.temArquivoOrientador && (
        <div className="card mb-4" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen color="#1d4ed8" size={20} />
              <div>
                <strong style={{ color: '#1e40af' }}>Nenhum arquivo orientador vinculado ainda.</strong>
                <p className="text-sm text-muted">A coordenação ainda não vinculou um material à sua conta.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        <div className="card">
          <h3 className="font-bold mb-3">Atalhos do Docente</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button onClick={() => navigate('/professor/entregas')} className="btn btn-secondary justify-between">
              <span>Acompanhar Entregas & Lançar Notas</span>
              <ArrowRight size={16} />
            </button>

            <button onClick={() => navigate('/professor/arquivo-orientador')} className="btn btn-secondary justify-between">
              <span>Revisar Arquivo Orientador</span>
              <ArrowRight size={16} />
            </button>

            <button onClick={() => navigate('/professor/turmas')} className="btn btn-secondary justify-between">
              <span>Minhas Turmas & Horário</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

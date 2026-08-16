import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import {
  Inbox,
  AlertTriangle,
  CheckCircle,
  Send,
  Users,
  FileText,
  Clock,
  ArrowRight,
  TrendingUp
} from 'lucide-react';

interface DashboardData {
  kpis: {
    aguardandoAnalise: number;
    ajustessolicitados: number;
    emAnalise: number;
    aprovadas: number;
    agendadas: number;
    publicadas: number;
    suspensas: number;
    alunosAlcancados: number;
    totalEntregas: number;
    entregasNoPrazo: number;
    entregasComAtraso: number;
  };
  porCurso: Array<{ curso: string; total_atividades: number }>;
}

interface Props {
  navigate: (path: string) => void;
}

export const DashboardAdminView: React.FC<Props> = ({ navigate }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<DashboardData>('/dashboard')
      .then((res) => setData(res))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-4 text-center">Carregando indicadores do painel administrativo...</div>;
  }

  const k = data?.kpis;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Painel de Gestão Administrativa</h2>
          <p className="text-muted text-sm">Visão geral do fluxo de submissão, revisão, publicação e alcance dos alunos.</p>
        </div>
        <button onClick={() => navigate('/admin/caixa-entrada')} className="btn btn-primary">
          <Inbox size={18} />
          Ver Caixa de Entrada ({k?.aguardandoAnalise || 0})
        </button>
      </div>

      {/* Grid de KPIs principais */}
      <div className="grid-kpi">
        <div className="kpi-card" style={{ '--kpi-color': '#0284c7', '--kpi-bg': '#e0f2fe' } as React.CSSProperties}>
          <div className="kpi-icon-wrapper">
            <Inbox size={24} />
          </div>
          <div>
            <div className="kpi-value">{k?.aguardandoAnalise || 0}</div>
            <div className="kpi-label">Aguardando Análise</div>
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-color': '#d97706', '--kpi-bg': '#fef3c7' } as React.CSSProperties}>
          <div className="kpi-icon-wrapper">
            <AlertTriangle size={24} />
          </div>
          <div>
            <div className="kpi-value">{k?.ajustessolicitados || 0}</div>
            <div className="kpi-label">Ajustes Solicitados</div>
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-color': '#16a34a', '--kpi-bg': '#dcfce7' } as React.CSSProperties}>
          <div className="kpi-icon-wrapper">
            <CheckCircle size={24} />
          </div>
          <div>
            <div className="kpi-value">{k?.aprovadas || 0}</div>
            <div className="kpi-label">Aprovadas (Prontas)</div>
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-color': '#059669', '--kpi-bg': '#d1fae5' } as React.CSSProperties}>
          <div className="kpi-icon-wrapper">
            <Send size={24} />
          </div>
          <div>
            <div className="kpi-value">{k?.publicadas || 0}</div>
            <div className="kpi-label">Publicadas Ativas</div>
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

        <div className="kpi-card" style={{ '--kpi-color': '#2563eb', '--kpi-bg': '#dbeafe' } as React.CSSProperties}>
          <div className="kpi-icon-wrapper">
            <FileText size={24} />
          </div>
          <div>
            <div className="kpi-value">{k?.totalEntregas || 0}</div>
            <div className="kpi-label">Entregas Recebidas</div>
          </div>
        </div>
      </div>

      {/* Seção Inferior com Gráficos e Ações Rápidas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title flex items-center gap-2">
              <TrendingUp size={18} color="#2563eb" />
              Distribuição por Curso
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {data?.porCurso.map((c, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div className="flex justify-between text-sm">
                  <span className="font-bold">{c.curso}</span>
                  <span className="text-muted">{c.total_atividades} atividades</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(c.total_atividades * 20, 100)}%`,
                      background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                      borderRadius: '4px'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Ações Rápidas de Gestão</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button onClick={() => navigate('/admin/caixa-entrada')} className="btn btn-secondary justify-between">
              <span className="flex items-center gap-2">
                <Inbox size={16} />
                Revisar Fila de Análise
              </span>
              <ArrowRight size={16} />
            </button>

            <button onClick={() => navigate('/admin/academic')} className="btn btn-secondary justify-between">
              <span className="flex items-center gap-2">
                <Users size={16} />
                Cadastrar Cursos, Turmas e Professores
              </span>
              <ArrowRight size={16} />
            </button>

            <button onClick={() => navigate('/admin/relatorios')} className="btn btn-secondary justify-between">
              <span className="flex items-center gap-2">
                <FileText size={16} />
                Exportar Relatórios em CSV
              </span>
              <ArrowRight size={16} />
            </button>

            <button onClick={() => navigate('/admin/configuracoes')} className="btn btn-secondary justify-between">
              <span className="flex items-center gap-2">
                <Clock size={16} />
                Configurar Campos Obrigatórios do PBL
              </span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

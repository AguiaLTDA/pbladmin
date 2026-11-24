import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { CronogramaPBL } from '../../components/CronogramaPBL';
import { ManualAlunoPBLButton } from '../../components/ManualAlunoPBLButton';
import { Send, Users, Award, ArrowRight, AlertTriangle, GraduationCap, Layers, Star, ClipboardCheck } from 'lucide-react';
import { SALAS_BANCA } from '../../constants/salasBanca';

interface ProfessorDashboardData {
  kpis: {
    publicadas: number;
    alunosAlcancados: number;
    alunosRelacionados: number;
    gruposRelacionados: number;
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
          Acompanhe as entregas e os casos PBL dos grupos das turmas em que você leciona.
        </p>
      </div>

      {/* Destaque das bancas do PBL oral: some sozinho depois do último dia de banca. */}
      {(() => {
        const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
        const ultimo = SALAS_BANCA[SALAS_BANCA.length - 1]?.data;
        if (!ultimo || hoje > ultimo) return null;
        const diaDeHoje = SALAS_BANCA.find((d) => d.data === hoje);
        return (
          <div
            className="card mb-4"
            style={{
              background: 'linear-gradient(135deg, var(--primary, #092f1e) 0%, #166534 100%)',
              color: '#fff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap'
            }}
          >
            <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
              <div
                style={{
                  background: 'rgba(255,255,255,0.18)',
                  borderRadius: '12px',
                  padding: '0.75rem',
                  display: 'flex'
                }}
              >
                <ClipboardCheck size={28} />
              </div>
              <div>
                <h3 className="font-bold" style={{ fontSize: '1.15rem', color: '#fff', margin: 0 }}>
                  Bancas do PBL oral — 24 a 27/11
                </h3>
                <p style={{ margin: '0.25rem 0 0', opacity: 0.9, fontSize: '0.9rem' }}>
                  {diaDeHoje
                    ? `Hoje (${diaDeHoje.rotulo}) há bancas em ${diaDeHoje.salas.length} ${diaDeHoje.salas.length === 1 ? 'sala' : 'salas'}. Escolha o dia e a sala e avalie cada grupo pelo formulário.`
                    : 'Escolha o dia e a sala da sua banca e avalie cada grupo pelo formulário.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/professor/avaliacao-banca')}
              className="btn"
              style={{ background: '#fff', color: 'var(--primary, #092f1e)', fontWeight: 700 }}
            >
              Avaliar grupos agora <ArrowRight size={16} />
            </button>
          </div>
        );
      })()}

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

        <button
          type="button"
          onClick={() => navigate('/professor/alunos')}
          className="kpi-card kpi-card-clicavel"
          style={{ '--kpi-color': '#0891b2', '--kpi-bg': '#cffafe' } as React.CSSProperties}
          title="Ver a lista de alunos das suas turmas e o contexto profissional de cada um"
        >
          <div className="kpi-icon-wrapper">
            <GraduationCap size={24} />
          </div>
          <div>
            <div className="kpi-value">{k?.alunosRelacionados || 0}</div>
            <div className="kpi-label">Alunos Relacionados</div>
            <div className="kpi-acao">Ver lista <ArrowRight size={12} /></div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/professor/grupos')}
          className="kpi-card kpi-card-clicavel"
          style={{ '--kpi-color': '#4f46e5', '--kpi-bg': '#e0e7ff' } as React.CSSProperties}
          title="Ver os grupos PBL das suas turmas e quem já preencheu o contexto"
        >
          <div className="kpi-icon-wrapper">
            <Layers size={24} />
          </div>
          <div>
            <div className="kpi-value">{k?.gruposRelacionados || 0}</div>
            <div className="kpi-label">Grupos Relacionados</div>
            <div className="kpi-acao">Ver grupos <ArrowRight size={12} /></div>
          </div>
        </button>

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

      <CronogramaPBL />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        <div className="card">
          <h3 className="font-bold mb-3">Atalhos do Docente</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button onClick={() => navigate('/professor/entregas')} className="btn btn-secondary justify-between">
              <span>Acompanhar Entregas & Lançar Notas</span>
              <ArrowRight size={16} />
            </button>

            <button onClick={() => navigate('/professor/pbls-grupos')} className="btn btn-secondary justify-between">
              <span>PBLs dos Meus Grupos</span>
              <ArrowRight size={16} />
            </button>

            <button onClick={() => navigate('/professor/turmas')} className="btn btn-secondary justify-between">
              <span>Minhas Turmas & Horário</span>
              <ArrowRight size={16} />
            </button>

            <button onClick={() => navigate('/professor/autoavaliacao-grupos')} className="btn btn-secondary justify-between">
              <span className="flex items-center gap-2">
                <Star size={16} />
                Autoavaliação dos Grupos que Participo
              </span>
              <ArrowRight size={16} />
            </button>

            <ManualAlunoPBLButton />
          </div>
        </div>
      </div>
    </div>
  );
};

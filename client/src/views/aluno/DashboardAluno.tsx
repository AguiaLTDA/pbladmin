import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { GraduationCap, Clock, CheckCircle2, AlertTriangle, ArrowRight, Sparkles, Award, Star } from 'lucide-react';
import { ManualAlunoPBLButton } from '../../components/ManualAlunoPBLButton';
import { ComunicadoPBLEscrito } from '../../components/ComunicadoPBLEscrito';
import { useAuth } from '../../context/AuthContext';
import { MeuGrupoAutoavaliacao } from '../../types';

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
  const { user } = useAuth();
  const [data, setData] = useState<AlunoDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoavaliacao, setAutoavaliacao] = useState<MeuGrupoAutoavaliacao | null>(null);
  const [autoavaliacaoCarregando, setAutoavaliacaoCarregando] = useState(true);
  const [autoavaliacaoFalhou, setAutoavaliacaoFalhou] = useState(false);

  useEffect(() => {
    apiRequest<AlunoDashboardData>('/dashboard')
      .then((res) => setData(res))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    apiRequest<MeuGrupoAutoavaliacao>('/autoavaliacao/meu-grupo')
      .then((res) => setAutoavaliacao(res))
      .catch(() => setAutoavaliacaoFalhou(true))
      .finally(() => setAutoavaliacaoCarregando(false));
  }, []);

  if (loading) return <div className="p-4 text-center">Carregando portal do aluno...</div>;

  const k = data?.kpis;
  const gruposAvaliaveis = autoavaliacao?.turmas.filter((turma) => turma.colegas.length > 0) || [];
  const gruposConcluidos = gruposAvaliaveis.filter(
    (turma) => turma.completo && turma.colegas.every((colega) => colega.nota !== null)
  ).length;
  const autoavaliacaoConcluida = Boolean(
    autoavaliacao?.janela && autoavaliacao.status !== 'FUTURA' && autoavaliacao.status !== 'INEXISTENTE' &&
    gruposAvaliaveis.length > 0 && gruposConcluidos === gruposAvaliaveis.length
  );
  const janelaAutoavaliacao = autoavaliacao?.janela;
  let resumoAutoavaliacao = 'Consultando o status da sua autoavaliação…';
  let acaoAutoavaliacao = 'Consultar autoavaliação';
  if (!autoavaliacaoCarregando) {
    if (autoavaliacaoFalhou) {
      resumoAutoavaliacao = 'Não foi possível carregar o status agora.';
    } else if (!janelaAutoavaliacao || autoavaliacao?.status === 'INEXISTENTE') {
      resumoAutoavaliacao = 'Não há uma rodada de autoavaliação cadastrada no momento.';
    } else if (autoavaliacao?.status === 'FUTURA') {
      resumoAutoavaliacao = `${janelaAutoavaliacao.titulo} ainda não abriu.`;
    } else if (autoavaliacao?.status === 'ENCERRADA') {
      resumoAutoavaliacao = !autoavaliacao?.turmas.length
        ? 'Você não tinha um grupo disponível nesta rodada.'
        : !gruposAvaliaveis.length
          ? `${janelaAutoavaliacao.titulo} foi encerrada. Sem colegas para avaliar.`
          : autoavaliacaoConcluida
            ? `Sua avaliação foi registrada — ${gruposConcluidos} de ${gruposAvaliaveis.length} avaliações de grupo concluídas.`
            : `${janelaAutoavaliacao.titulo} foi encerrada. ${gruposConcluidos} de ${gruposAvaliaveis.length} avaliações registradas.`;
      acaoAutoavaliacao = 'Ver autoavaliação';
    } else if (!autoavaliacao?.turmas.length) {
      resumoAutoavaliacao = 'Você ainda não está em um grupo disponível para avaliar colegas.';
      acaoAutoavaliacao = 'Ver autoavaliação';
    } else if (!gruposAvaliaveis.length) {
      resumoAutoavaliacao = 'Sem colegas para avaliar nos seus grupos.';
      acaoAutoavaliacao = 'Ver autoavaliação';
    } else if (autoavaliacaoConcluida) {
      resumoAutoavaliacao = `Sua autoavaliação foi registrada — ${gruposConcluidos} de ${gruposAvaliaveis.length} avaliações de grupo concluídas.`;
      acaoAutoavaliacao = 'Ver autoavaliação';
    } else {
      resumoAutoavaliacao = `${gruposConcluidos} de ${gruposAvaliaveis.length} avaliações de grupo concluídas.`;
      acaoAutoavaliacao = 'Fazer autoavaliação';
    }
  }

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

      <ComunicadoPBLEscrito />

      {/* Chamariz do Contexto do Aluno: some assim que a medalha é conquistada,
          para não virar ruído permanente no painel de quem já respondeu. */}
      {user && !user.contextoCompleto && (
        <div
          className="card flex items-center justify-between gap-2"
          style={{ marginBottom: '1.5rem', borderLeft: '4px solid #b45309' }}
        >
          <div className="flex items-center gap-2">
            <Award size={22} color="#b45309" />
            <div>
              <div className="font-bold">Conte sua realidade profissional</div>
              <p className="text-muted text-sm" style={{ margin: 0 }}>
                Responda o Contexto do Aluno para que os casos PBL fiquem parecidos com o que você
                vive no trabalho — e ganhe a medalha Contexto Completo, que pode valer horas de
                atividade complementar.
              </p>
            </div>
          </div>

          <button onClick={() => navigate('/aluno/contexto')} className="btn btn-secondary">
            Responder
            <ArrowRight size={16} />
          </button>
        </div>
      )}

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

            <ManualAlunoPBLButton />
          </div>
        </div>

        <div className="card" style={{ borderLeft: `4px solid ${autoavaliacaoConcluida ? 'var(--success, #16a34a)' : autoavaliacao?.status === 'ABERTA' && gruposAvaliaveis.length > 0 ? '#d97706' : 'var(--border-color, #e5e7eb)'}` }}>
          <div className="flex items-start gap-3 mb-3">
            {autoavaliacaoConcluida ? (
              <CheckCircle2 size={24} color="var(--success, #16a34a)" style={{ flexShrink: 0 }} />
            ) : autoavaliacao?.status === 'FUTURA' || autoavaliacao?.status === 'ENCERRADA' || autoavaliacao?.status === 'ABERTA' && gruposAvaliaveis.length > 0 ? (
              <Clock size={24} color="#b45309" style={{ flexShrink: 0 }} />
            ) : (
              <Star size={24} color="var(--text-muted, #64748b)" style={{ flexShrink: 0 }} />
            )}
            <div>
              <h3 className="font-bold mb-1">
                {autoavaliacaoConcluida ? 'Autoavaliação concluída' : 'Autoavaliação do Grupo'}
              </h3>
              {janelaAutoavaliacao?.titulo && <div className="text-xs text-muted mb-1">{janelaAutoavaliacao.titulo}</div>}
              <p className="text-sm text-muted" style={{ margin: 0 }}>{resumoAutoavaliacao}</p>
            </div>
          </div>
          <button onClick={() => navigate('/aluno/autoavaliacao')} className="btn btn-secondary justify-between" style={{ width: '100%' }}>
            <span>{acaoAutoavaliacao}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

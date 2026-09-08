import React from 'react';
import { CRONOGRAMA_PBL, EtapaCronogramaPBL } from '../constants/academico';
import { CalendarDays, CheckCircle2, Clock, Award } from 'lucide-react';

type SituacaoEtapa = 'ENCERRADA' | 'PROXIMA' | 'PREVISTA';

/** Etapa encerrada = último dia já passou. A primeira que sobra é a "próxima". */
function calcularSituacoes(etapas: EtapaCronogramaPBL[]): SituacaoEtapa[] {
  const agora = new Date();
  let proximaMarcada = false;

  return etapas.map((etapa) => {
    const fim = new Date(`${etapa.fim}T23:59:59`);
    if (fim < agora) return 'ENCERRADA';
    if (!proximaMarcada) {
      proximaMarcada = true;
      return 'PROXIMA';
    }
    return 'PREVISTA';
  });
}

const ESTILO_SITUACAO: Record<SituacaoEtapa, { rotulo: string; fundo: string; cor: string; borda: string }> = {
  ENCERRADA: { rotulo: 'ENCERRADA', fundo: '#f1f5f9', cor: '#475569', borda: '#cbd5e1' },
  PROXIMA: { rotulo: 'PRÓXIMO PRAZO', fundo: '#fef3c7', cor: '#b45309', borda: '#f59e0b' },
  PREVISTA: { rotulo: 'PREVISTA', fundo: '#e0f2fe', cor: '#0369a1', borda: '#7dd3fc' }
};

/**
 * Cronograma oficial das atividades PBL do semestre. A mesma peça aparece no
 * portal do professor e no do aluno, para que os dois vejam as mesmas datas.
 */
export const CronogramaPBL: React.FC = () => {
  const { periodo, totalAvaliativo, etapas } = CRONOGRAMA_PBL;
  const situacoes = calcularSituacoes(etapas);

  return (
    <div className="card mb-4" style={{ padding: '1.25rem' }}>
      {/* O CSS do projeto não tem utilitário de wrap/gap fino, então o que é
          estrutural (envolver em telas estreitas) vai em style, não em className. */}
      <div
        className="flex items-center justify-between gap-2"
        style={{ flexWrap: 'wrap', marginBottom: '0.35rem' }}
      >
        <h3 className="font-bold flex items-center gap-2">
          <CalendarDays size={18} color="var(--primary)" />
          Cronograma das Atividades PBL
        </h3>
        <span className="pill-tag pill-tag-green">Semestre {periodo}</span>
      </div>

      <p className="text-muted text-sm" style={{ marginBottom: '0.85rem' }}>
        Datas definidas pela coordenação para todas as turmas. As etapas com pontuação somam{' '}
        <strong>{totalAvaliativo}</strong> na nota da disciplina.
      </p>

      <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {etapas.map((etapa, indice) => {
          const situacao = situacoes[indice];
          const estilo = ESTILO_SITUACAO[situacao];

          return (
            <li
              key={etapa.titulo}
              className="flex items-center"
              style={{
                flexWrap: 'wrap',
                gap: '0.6rem',
                padding: '0.7rem 0.85rem',
                marginBottom: '0.5rem',
                borderRadius: '10px',
                borderLeft: `5px solid ${estilo.borda}`,
                background: 'var(--bg-main)',
                opacity: situacao === 'ENCERRADA' ? 0.75 : 1
              }}
            >
              <div
                className="font-bold"
                style={{
                  minWidth: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  background: estilo.fundo,
                  color: estilo.cor,
                  fontSize: '0.85rem'
                }}
                aria-hidden="true"
              >
                {etapa.ordem === null ? '•' : etapa.ordem}
              </div>

              {/* `flex: 1 1 150px` + minWidth 0 deixa o texto encolher em vez de
                  empurrar os selos para fora do card no celular. */}
              <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                <div className="font-bold text-sm">{etapa.titulo}</div>
                <div className="text-muted text-sm flex items-center" style={{ gap: '0.25rem' }}>
                  {situacao === 'ENCERRADA' ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                  {etapa.prazoTexto}
                </div>
              </div>

              {etapa.pontos && (
                <span className="pill-tag flex items-center" style={{ gap: '0.25rem', flexShrink: 0 }}>
                  <Award size={12} /> {etapa.pontos}
                </span>
              )}

              <span
                className="status-badge"
                style={{ background: estilo.fundo, color: estilo.cor, flexShrink: 0 }}
              >
                {estilo.rotulo}
              </span>
            </li>
          );
        })}
      </ol>

      <div
        className="flex items-center gap-2 font-bold text-sm"
        style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-color, #e5e7eb)' }}
      >
        <Award size={16} color="var(--primary)" />
        Total das entregas avaliativas: {totalAvaliativo} / nota da disciplina
      </div>
    </div>
  );
};

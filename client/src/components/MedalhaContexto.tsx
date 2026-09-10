import React from 'react';
import { Award } from 'lucide-react';

interface MedalhaContextoProps {
  /** Só renderiza quando verdadeiro — a medalha não existe como "vazia". */
  completo?: boolean;
  tamanho?: number;
  /** Exibe o rótulo escrito ao lado do ícone (listagens densas usam só o ícone). */
  comRotulo?: boolean;
}

const TOOLTIP = 'Contexto do aluno completo — pode contar como carga horária complementar.';

/**
 * Medalha exibida ao lado do nome do aluno que completou o Contexto do Aluno.
 *
 * Retorna null quando o contexto não está completo: quem chama pode inserir o
 * componente direto no JSX, sem envolver em condicional, e a ausência da
 * medalha nunca ocupa espaço na linha.
 */
export const MedalhaContexto: React.FC<MedalhaContextoProps> = ({
  completo,
  tamanho = 14,
  comRotulo = false
}) => {
  if (!completo) return null;

  return (
    <span
      className="medalha-contexto"
      title={TOOLTIP}
      role="img"
      aria-label={`Contexto Completo. ${TOOLTIP}`}
    >
      <Award size={tamanho} aria-hidden="true" />
      {comRotulo && <span>Contexto Completo</span>}
    </span>
  );
};

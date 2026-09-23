import React from 'react';
import { Star } from 'lucide-react';

interface SeletorEstrelasProps {
  valor: number | null;
  onChange?: (nota: number) => void;
  tamanho?: number;
  somenteLeitura?: boolean;
}

/**
 * Cinco estrelas clicáveis (1 a 5). Em modo somente leitura (painel do
 * professor/admin) não reage a clique, só mostra a nota recebida.
 */
export const SeletorEstrelas: React.FC<SeletorEstrelasProps> = ({
  valor,
  onChange,
  tamanho = 22,
  somenteLeitura = false
}) => {
  return (
    <div className="flex items-center gap-1" role={somenteLeitura ? undefined : 'radiogroup'}>
      {[1, 2, 3, 4, 5].map((estrela) => {
        const preenchida = valor !== null && estrela <= valor;
        return (
          <button
            key={estrela}
            type="button"
            disabled={somenteLeitura}
            onClick={() => onChange?.(estrela)}
            title={`${estrela} estrela${estrela > 1 ? 's' : ''}`}
            aria-label={`${estrela} estrela${estrela > 1 ? 's' : ''}`}
            style={{
              background: 'none',
              border: 'none',
              padding: 2,
              cursor: somenteLeitura ? 'default' : 'pointer',
              lineHeight: 0
            }}
          >
            <Star
              size={tamanho}
              fill={preenchida ? '#f59e0b' : 'none'}
              color={preenchida ? '#f59e0b' : '#cbd5e1'}
            />
          </button>
        );
      })}
    </div>
  );
};

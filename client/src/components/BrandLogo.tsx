import React, { useState } from 'react';

/**
 * Marca institucional do Centro Universitário Vale do Cricaré (UNIVC).
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ PARA APLICAR O LOGO OFICIAL, salve os dois arquivos em              │
 * │   client/public/marca/univc-verde.png   → fundos claros             │
 * │   client/public/marca/univc-branco.png  → fundos escuros            │
 * │ Mais nada precisa mudar: todas as telas consomem este componente.   │
 * │ (SVG é preferível a PNG; se usar .svg, ajuste as constantes abaixo.)│
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Enquanto os arquivos não existirem, entra automaticamente o wordmark
 * tipográfico de contingência (mesmas cores institucionais). A troca é
 * transparente: se o arquivo falhar ao carregar, o fallback assume — a tela
 * nunca fica com um ícone quebrado.
 */

const BASE = import.meta.env.BASE_URL;

/** Logo oficial por contexto de fundo. `null` = só o wordmark tipográfico. */
const LOGO_OFICIAL: Record<Variante, string | null> = {
  clara: `${BASE}marca/univc-verde.png`,
  escura: `${BASE}marca/univc-branco.png`
};

type Variante = 'clara' | 'escura';
type Tamanho = 'sm' | 'md' | 'lg';

interface BrandLogoProps {
  /** `escura` = aplicada sobre fundo escuro (texto branco). */
  variante?: Variante;
  tamanho?: Tamanho;
  /** Oculta o texto e mantém apenas o símbolo (sidebar recolhida, favicon). */
  somenteSimbolo?: boolean;
  className?: string;
}

/**
 * `simbolo` dimensiona o brasão de contingência (quadrado); `lockup` dimensiona
 * o arquivo oficial, que é horizontal (~2,9:1) e por isso pede menos altura
 * para ocupar a mesma presença visual.
 */
const ESCALAS: Record<Tamanho, { simbolo: number; lockup: number; sigla: string; linha: string; gap: string }> = {
  sm: { simbolo: 30, lockup: 30, sigla: '1rem', linha: '0.54rem', gap: '0.55rem' },
  md: { simbolo: 40, lockup: 42, sigla: '1.35rem', linha: '0.6rem', gap: '0.7rem' },
  lg: { simbolo: 60, lockup: 64, sigla: '2rem', linha: '0.72rem', gap: '0.9rem' }
};

/**
 * Símbolo de contingência: escudo acadêmico com o "V" do Vale do Cricaré.
 * Geometria simples de propósito — legível a 24px e neutra o bastante para
 * conviver com a marca oficial quando ela chegar.
 */
const SimboloEscudo: React.FC<{ size: number; variante: Variante }> = ({ size, variante }) => {
  const contorno = variante === 'escura' ? '#ffffff' : '#092f1e';
  const fundo = variante === 'escura' ? 'rgba(255,255,255,0.08)' : '#eaf2ee';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="Brasão UNIVC"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M24 3.5 41.5 9.8v14.4c0 9.9-7 17.9-17.5 20.8C13.5 42.1 6.5 34.1 6.5 24.2V9.8L24 3.5Z"
        fill={fundo}
        stroke={contorno}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      {/* Faixa dourada: referência ao selo institucional */}
      <path d="M6.5 19.2h35" stroke="#c5a059" strokeWidth="2.4" strokeLinecap="round" />
      {/* "V" de Vale do Cricaré, em terracota */}
      <path
        d="M16 24.5 24 36l8-11.5"
        stroke="#d94a34"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variante = 'clara',
  tamanho = 'md',
  somenteSimbolo = false,
  className
}) => {
  const [logoIndisponivel, setLogoIndisponivel] = useState(false);
  const escala = ESCALAS[tamanho];

  const corSigla = variante === 'escura' ? '#ffffff' : 'var(--primary)';
  const corLinha = variante === 'escura' ? 'rgba(255,255,255,0.72)' : 'var(--text-muted)';

  // Caminho feliz: logo oficial disponível para este contexto de fundo.
  // O arquivo oficial já é um lockup (símbolo + wordmark), então `somenteSimbolo`
  // não se aplica a ele — nesse caso usamos o brasão de contingência.
  const arquivoOficial = LOGO_OFICIAL[variante];

  if (arquivoOficial && !logoIndisponivel && !somenteSimbolo) {
    return (
      <img
        src={arquivoOficial}
        alt="Centro Universitário Vale do Cricaré — UNIVC"
        className={className}
        onError={() => setLogoIndisponivel(true)}
        style={{
          height: escala.lockup,
          width: 'auto',
          maxWidth: '100%',
          objectFit: 'contain',
          display: 'block'
        }}
      />
    );
  }

  return (
    <div
      className={className}
      style={{ display: 'flex', alignItems: 'center', gap: escala.gap, minWidth: 0 }}
    >
      <SimboloEscudo size={escala.simbolo} variante={variante} />

      {!somenteSimbolo && (
        <div style={{ minWidth: 0, lineHeight: 1.1 }}>
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: escala.sigla,
              fontWeight: 400,
              letterSpacing: '0.06em',
              color: corSigla
            }}
          >
            UNIVC
          </div>
          <div
            style={{
              fontSize: escala.linha,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.13em',
              color: corLinha,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            Vale do Cricaré
          </div>
        </div>
      )}
    </div>
  );
};

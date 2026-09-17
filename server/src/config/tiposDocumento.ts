/**
 * Tipos de documento do repositório de materiais.
 *
 * Distinto de `arquivos.categoria`, que é derivada do MIME (PDF, IMAGEM, VIDEO)
 * e responde "que espécie de arquivo é este". Aqui a pergunta é outra: "qual o
 * papel deste documento no ciclo do PBL" — e só quem envia sabe responder, por
 * isso o campo é escolhido no upload e não inferido.
 *
 * A lista é fechada de propósito: com texto livre, a mesma coisa viraria
 * "Feedback", "feedback" e "retorno" em três semanas, e o filtro deixaria de
 * servir para qualquer coisa.
 */
export const TIPOS_DOCUMENTO = [
  { valor: 'INFORMATIVO', rotulo: 'Informativo' },
  // Pré-PBL 1: o material que a coordenação manda ANTES do PBL 1 para a docência
  // conferir e sugerir mudanças. É o único tipo com um canal de sugestões próprio
  // (ver `sugestoes_material`), por isso precisa de um valor separado de PBL_1.
  { valor: 'PRE_PBL_1', rotulo: 'Pré-PBL 1' },
  { valor: 'PBL_1', rotulo: 'PBL 1' },
  { valor: 'ORIENTACAO_ESCRITO', rotulo: 'Orientação — Escrito' },
  { valor: 'FEEDBACK', rotulo: 'Feedback' },
  { valor: 'PBL_ORAL', rotulo: 'PBL Oral' }
] as const;

export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]['valor'];

export const VALORES_TIPO_DOCUMENTO = TIPOS_DOCUMENTO.map((t) => t.valor) as readonly string[];

/** Aceita o valor; devolve null quando vier vazio ou fora da lista. */
export const normalizarTipoDocumento = (valor: unknown): TipoDocumento | null => {
  if (typeof valor !== 'string') return null;
  const limpo = valor.trim().toUpperCase();
  return (VALORES_TIPO_DOCUMENTO as string[]).includes(limpo) ? (limpo as TipoDocumento) : null;
};

export const rotuloTipoDocumento = (valor: string | null | undefined): string =>
  TIPOS_DOCUMENTO.find((t) => t.valor === valor)?.rotulo || 'Sem tipo definido';

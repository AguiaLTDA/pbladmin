/**
 * Escala do PBL no Manual do Aluno de 2026/2: o escrito vale até 1,0 e o oral até 1,5.
 * Períodos anteriores usavam outra escala (a planilha de 2026/1 tem escritas de 1,885),
 * por isso o limite só vale para o PBL escrito a partir de 2026/2.
 */
export const PRIMEIRO_PERIODO_ESCALA_PBL = '2026/2';
export const NOTA_MAXIMA_ESCRITA_PBL = 1.0;
export const NOTA_MAXIMA_ORAL_PBL = 1.5;

export function aplicaEscalaPbl(pbl1: boolean, periodoNome: string | null | undefined): boolean {
  return pbl1 && Boolean(periodoNome) && String(periodoNome) >= PRIMEIRO_PERIODO_ESCALA_PBL;
}

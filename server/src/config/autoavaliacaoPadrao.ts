/**
 * Janela de fábrica da retro-autoavaliação entre pares dos grupos PBL — mesmas
 * datas já divulgadas na etapa "Autoavaliação interna do grupo (1ª rodada)" do
 * cronograma oficial (ver `cronogramaPadrao.ts`), agora com horário de abertura
 * e fechamento reais para o servidor liberar/bloquear o formulário sozinho.
 *
 * Só é usada para semear `autoavaliacao_janelas` (uma linha por rodada, via
 * `ON CONFLICT (rodada) DO NOTHING`) — depois disso a autoridade é o banco.
 */
export interface JanelaAutoavaliacaoPadrao {
  rodada: number;
  titulo: string;
  abreEm: string;
  fechaEm: string;
}

export const AUTOAVALIACAO_JANELAS_PADRAO: JanelaAutoavaliacaoPadrao[] = [
  {
    rodada: 1,
    titulo: 'Autoavaliação interna do grupo (1ª rodada)',
    abreEm: '2026-10-26T00:00:00-03:00',
    fechaEm: '2026-11-03T23:59:59-03:00'
  },
  {
    rodada: 2,
    titulo: 'Autoavaliação interna do grupo (2ª rodada)',
    abreEm: '2026-11-16T00:00:00-03:00',
    fechaEm: '2026-11-22T23:59:59-03:00'
  }
];

/**
 * Cronograma PBL de fábrica — o mesmo que ficava fixo em
 * client/src/constants/academico.ts (fonte: seção 6 do "Manual do Aluno PBL").
 *
 * Só é usado para semear `cronograma_pbl`/`cronograma_pbl_etapas` na primeira
 * subida. A partir daí a autoridade é o banco, editado pela coordenação — a
 * migração nunca sobrescreve etapas já existentes.
 */
export interface EtapaCronogramaPadrao {
  ordem: number | null;
  titulo: string;
  prazoTexto: string;
  /** Último dia da etapa, em ISO; usado para marcar o que já venceu. */
  fim: string;
  pontos?: string;
}

export const CRONOGRAMA_PBL_PADRAO: {
  periodo: string;
  totalAvaliativo: string;
  etapas: EtapaCronogramaPadrao[];
} = {
  periodo: '2026/2',
  totalAvaliativo: '2,5 pontos',
  etapas: [
    { ordem: 1, titulo: 'Cadastro dos grupos', prazoTexto: 'até 11 de setembro', fim: '2026-09-11' },
    {
      ordem: 2,
      titulo: 'Entrega do PDF com a situação-problema',
      prazoTexto: 'até 23 de setembro',
      fim: '2026-09-23'
    },
    {
      ordem: 3,
      titulo: 'Autoavaliação interna do grupo (1ª rodada)',
      prazoTexto: 'de 26 de outubro a 03 de novembro',
      fim: '2026-11-03'
    },
    {
      ordem: 4,
      titulo: 'Entrega do PBL escrito',
      prazoTexto: 'até 04 de novembro',
      fim: '2026-11-04',
      pontos: '1,0 ponto'
    },
    {
      ordem: 5,
      titulo: 'Devolutiva do professor sobre o texto entregue',
      prazoTexto: 'até 13 de novembro',
      fim: '2026-11-13'
    },
    {
      ordem: 6,
      titulo: 'Autoavaliação interna do grupo (2ª rodada)',
      prazoTexto: 'de 16 a 22 de novembro',
      fim: '2026-11-22'
    },
    {
      ordem: 7,
      titulo: 'Apresentação do PBL oral',
      prazoTexto: 'de 23 a 27 de novembro',
      fim: '2026-11-27',
      pontos: '1,5 ponto'
    },
    {
      ordem: 8,
      titulo: 'Divulgação das notas e feedback final do semestre',
      prazoTexto: 'até 04 de dezembro',
      fim: '2026-12-04'
    }
  ]
};

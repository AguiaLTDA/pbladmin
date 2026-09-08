/** Cursos ofertados — mesma lista das planilhas em `Por Curso/`. */
export const CURSOS_DISPONIVEIS = [
  'Administração',
  'Administração e Ciências Contábeis',
  'Agronomia',
  'Análise e Desenvolvimento de Sistemas',
  'Ciências Contábeis',
  'Comunicação Social',
  'Engenharia de Produção',
  'Engenharia Mecânica'
];

/**
 * Teto de integrantes por grupo PBL. Serve para a interface avisar antes de o
 * aluno tentar; quem realmente barra é o servidor (`MAX_INTEGRANTES_GRUPO` em
 * server/src/controllers/academicController.ts) — mantenha os dois iguais.
 */
export const MAX_INTEGRANTES_GRUPO = 5;

/**
 * Cronograma oficial das atividades PBL do semestre, divulgado pela coordenação.
 * É a mesma fonte para o portal do professor e o do aluno — ao virar o semestre,
 * basta atualizar este bloco (`fim` é a data usada para marcar o que já venceu).
 */
export interface EtapaCronogramaPBL {
  /** Numeração divulgada pela coordenação; a etapa preparatória não é numerada. */
  ordem: number | null;
  titulo: string;
  prazoTexto: string;
  /** Último dia da etapa, em ISO, usado só para calcular o que já encerrou. */
  fim: string;
  pontos?: string;
}

export const CRONOGRAMA_PBL: {
  periodo: string;
  totalAvaliativo: string;
  etapas: EtapaCronogramaPBL[];
} = {
  periodo: '2026/2',
  totalAvaliativo: '2,5 pontos',
  etapas: [
    {
      ordem: null,
      titulo: 'Cadastro dos grupos',
      prazoTexto: 'até 08 de setembro',
      fim: '2026-09-08'
    },
    {
      ordem: 1,
      titulo: 'Entrega do PDF com a situação-problema',
      prazoTexto: 'até 15 de setembro',
      fim: '2026-09-15'
    },
    {
      ordem: 2,
      titulo: 'Entrega do PBL escrito',
      prazoTexto: 'até 04 de novembro',
      fim: '2026-11-04',
      pontos: '1,0 ponto'
    },
    {
      ordem: 3,
      titulo: 'Devolutiva do professor sobre o texto entregue',
      prazoTexto: 'até 13 de novembro',
      fim: '2026-11-13'
    },
    {
      ordem: 4,
      titulo: 'Apresentação do PBL oral',
      prazoTexto: 'de 23 a 27 de novembro',
      fim: '2026-11-27',
      pontos: '1,5 ponto'
    },
    {
      ordem: 5,
      titulo: 'Divulgação das notas e feedback final do semestre',
      prazoTexto: 'até 04 de dezembro',
      fim: '2026-12-04'
    }
  ]
};

export const PERIODOS_DISPONIVEIS = [
  '1º Período',
  '2º Período',
  '3º Período',
  '4º Período',
  '5º Período',
  '6º Período',
  '7º Período',
  '8º Período',
  '9º Período',
  '10º Período'
];

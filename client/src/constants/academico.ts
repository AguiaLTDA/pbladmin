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
 * Cronograma oficial das atividades PBL do semestre.
 *
 * A fonte de verdade agora é o BANCO, editado pela coordenação em
 * /admin/cronograma e lido por todos os portais via GET /api/cronograma
 * (ver client/src/services/cronograma.ts). O bloco abaixo ficou só como padrão
 * de fábrica: é o que aparece enquanto a resposta não chega, se o backend
 * estiver fora do ar, ou na vitrine estática do GitHub Pages. Para mudar as
 * datas do semestre, use a tela do admin — não edite aqui.
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

export const CRONOGRAMA_PBL_PADRAO: {
  periodo: string;
  totalAvaliativo: string;
  etapas: EtapaCronogramaPBL[];
} = {
  periodo: '2026/2',
  totalAvaliativo: '2,5 pontos',
  // Fonte: seção 6 (Cronograma e Entregas) do "Manual do Aluno PBL".
  etapas: [
    {
      ordem: 1,
      titulo: 'Cadastro dos grupos',
      prazoTexto: 'até 11 de setembro',
      fim: '2026-09-11'
    },
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

/**
 * Tipos de documento do repositório. Espelha server/src/config/tiposDocumento.ts
 * — os dois lados precisam concordar sobre os valores gravados.
 */
export const TIPOS_DOCUMENTO = [
  { valor: 'INFORMATIVO', rotulo: 'Informativo' },
  { valor: 'PBL_1', rotulo: 'PBL 1' },
  { valor: 'ORIENTACAO_ESCRITO', rotulo: 'Orientação — Escrito' },
  { valor: 'FEEDBACK', rotulo: 'Feedback' },
  { valor: 'PBL_ORAL', rotulo: 'PBL Oral' }
] as const;

export const rotuloTipoDocumento = (valor?: string | null): string =>
  TIPOS_DOCUMENTO.find((t) => t.valor === valor)?.rotulo || 'Sem tipo';

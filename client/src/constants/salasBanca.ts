// Salas das bancas do PBL oral (24 a 27/11/2026) e as turmas que se apresentam em cada uma.
// Fontes da verdade:
// - terça: "Bancas_PBL_24_e_25_11_2026.xlsx" (aba "PBL Terça 24-11");
// - quarta: versão revisada de "Bancas_PBL_24_e_25_11_2026.xlsx" recebida em 25/11/2026 (aba "PBL Quarta 25-11");
// - quinta e sexta: "Programacao_PBL_Reorganizada_Salas_24_a_27_Nov_2026.xlsx".
// O professor escolhe dia e sala livremente; a sala só filtra as turmas oferecidas.
// Os nomes das turmas são os do banco do PBL (ex.: "4º ADS" = "4º Análise e Desenv. de Sistemas").

export interface DiaBanca {
  data: string; // YYYY-MM-DD
  rotulo: string;
  salas: SalaBanca[];
}

export interface SalaBanca {
  sala: string;
  turmas: string[];
  /**
   * Para turmas divididas entre salas: os grupos (nome no banco) que se apresentam nesta sala.
   * Turma ausente aqui mostra todos os seus grupos.
   */
  grupos?: Record<string, string[]>;
}

const normalizarNome = (nome: string) => nome.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

/**
 * Filtra os grupos da turma pela sala. Se a sala não restringe a turma, ou se nenhum nome
 * bater com o banco (grupo renomeado), devolve todos para não travar a banca.
 */
export function filtrarGruposDaSala<T extends { nome: string }>(
  grupos: T[],
  sala: SalaBanca | undefined,
  turmaNome: string | undefined
): T[] {
  const permitidos = turmaNome ? sala?.grupos?.[turmaNome] : undefined;
  if (!permitidos) return grupos;
  const nomes = new Set(permitidos.map(normalizarNome));
  const filtrados = grupos.filter((g) => nomes.has(normalizarNome(g.nome)));
  return filtrados.length > 0 ? filtrados : grupos;
}

export const SALAS_BANCA: DiaBanca[] = [
  {
    data: '2026-11-24',
    rotulo: 'Terça-feira — 24/11',
    salas: [
      { sala: 'Prédio B, Sala 003', turmas: ['4º Análise e Desenv. de Sistemas'] },
      { sala: 'Prédio B, Sala 009', turmas: ['2º Ciências Contábeis', '6º Ciências Contábeis'] },
      { sala: 'Prédio B, Sala 011', turmas: ['2º Engenharia de Produção', '2º Engenharia Mecânica'] },
      { sala: 'Prédio C, Sala 04', turmas: ['6º Agronomia', '6º Administração', '2º Administração'] }
    ]
  },
  {
    data: '2026-11-25',
    rotulo: 'Quarta-feira — 25/11',
    salas: [
      {
        sala: 'Prédio C, Sala 004',
        turmas: ['2º Análise e Desenv. de Sistemas'],
        grupos: {
          '2º Análise e Desenv. de Sistemas': [
            'ADS Júnior',
            'ADS2.Rodrigo',
            'Escaladores',
            'Grupo Alfa',
            'grupo do enzo',
            'Grupo Hotel'
          ]
        }
      },
      {
        sala: 'Prédio B, Sala 005',
        turmas: ['2º Agronomia'],
        grupos: {
          '2º Agronomia': ['AGRO_2026_42', 'AGRO002', 'AGRO2 - RMR', 'Engenheiros', 'Grupo agro 2026', 'SAROBA']
        }
      },
      {
        sala: 'Prédio B, Sala 009',
        turmas: ['8º Agronomia', '2º Agronomia'],
        grupos: { '2º Agronomia': ['Grupo da Lu-Agro', 'grupo pbl 2'] }
      },
      {
        sala: 'Prédio B, Sala 011',
        turmas: [
          '8º Engenharia Mecânica',
          '4º Engenharia Mecânica',
          '2º Análise e Desenv. de Sistemas',
          '4º Ciências Contábeis'
        ],
        grupos: { '2º Análise e Desenv. de Sistemas': ['grupo kassio maria e luis', 'The box'] }
      }
    ]
  },
  {
    data: '2026-11-26',
    rotulo: 'Quinta-feira — 26/11',
    salas: [{ sala: 'Prédio B, Sala 003', turmas: ['4º Engenharia de Produção', '4º Administração'] }]
  },
  {
    data: '2026-11-27',
    rotulo: 'Sexta-feira — 27/11',
    salas: [{ sala: 'Prédio B, Sala 003', turmas: ['4º Agronomia'] }]
  }
];

/** Opção de escape: sala fora da programação libera todas as turmas participantes. */
export const OUTRA_SALA = '__outra__';

export const rotuloDiaBanca = (data: string | null | undefined) =>
  SALAS_BANCA.find((d) => d.data === data)?.rotulo ??
  (data ? new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR') : '—');

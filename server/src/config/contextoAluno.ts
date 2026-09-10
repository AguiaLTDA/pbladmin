/**
 * Regras do "Contexto do Aluno" — o formulário em que o estudante conta a
 * própria realidade profissional para que os casos PBL sejam escritos perto do
 * que ele vive.
 *
 * Tudo que decide "o contexto está completo?" mora aqui, e só aqui. O
 * controller, os testes e o texto exibido ao aluno leem destas constantes, de
 * modo que mudar a exigência (hoje 4 de 6 perguntas abertas) é editar um número
 * neste arquivo, sem caçar a regra espalhada pelo código.
 */

/**
 * Campos abertos que contam para a completude. `work_sector` e `company_size`
 * ficam de fora de propósito: são um select e um texto curto, respondê-los não
 * demonstra a reflexão que a medalha pretende reconhecer.
 */
export const CAMPOS_TEXTO_CONTEXTO = [
  'daily_tasks',
  'workplace_challenges',
  'relevant_experience',
  'key_learnings',
  'course_connection',
  'career_goals'
] as const;

export type CampoTextoContexto = (typeof CAMPOS_TEXTO_CONTEXTO)[number];

/** Campos gravados mas que não contam para a medalha. */
export const CAMPOS_PERFIL_CONTEXTO = ['work_sector', 'company_size'] as const;

/** Todas as colunas editáveis pelo aluno, na ordem em que aparecem no formulário. */
export const CAMPOS_CONTEXTO = [...CAMPOS_PERFIL_CONTEXTO, ...CAMPOS_TEXTO_CONTEXTO] as const;

export type CampoContexto = (typeof CAMPOS_CONTEXTO)[number];

/** Valores aceitos em `company_size`. Fora desta lista, o campo é recusado. */
export const TAMANHOS_EMPRESA = ['mei', 'pequena', 'media', 'grande', 'nao_se_aplica'] as const;

/**
 * Quantas das perguntas abertas precisam estar respondidas para o contexto
 * contar como completo e o aluno ganhar a medalha.
 */
export const MIN_RESPOSTAS_PARA_MEDALHA = 4;

/**
 * Uma resposta de duas letras não é uma resposta. Este piso evita que a medalha
 * saia por "sim" repetido quatro vezes, sem exigir redação do aluno.
 */
export const MIN_CARACTERES_RESPOSTA = 15;

/** Horas de atividade complementar que a medalha pode valer. */
export const HORAS_COMPLEMENTARES_CONTEXTO = 2;

/** Identidade da medalha, compartilhada entre a API e a interface. */
export const MEDALHA_CONTEXTO_COMPLETO = {
  codigo: 'CONTEXTO_COMPLETO',
  titulo: 'Contexto Completo',
  descricao: 'Contexto do aluno completo — pode contar como carga horária complementar.',
  icone: 'award',
  horasComplementares: HORAS_COMPLEMENTARES_CONTEXTO
} as const;

/** Uma resposta só conta se tiver conteúdo real, não espaço em branco. */
export const respostaPreenchida = (valor: unknown): boolean =>
  typeof valor === 'string' && valor.trim().length >= MIN_CARACTERES_RESPOSTA;

/** Quantas das perguntas abertas deste contexto estão respondidas. */
export const contarRespostas = (contexto: Record<string, unknown> | null | undefined): number => {
  if (!contexto) return 0;
  return CAMPOS_TEXTO_CONTEXTO.filter((campo) => respostaPreenchida(contexto[campo])).length;
};

/** A regra, em uma linha: o contexto atende ao critério da medalha? */
export const contextoEstaCompleto = (contexto: Record<string, unknown> | null | undefined): boolean =>
  contarRespostas(contexto) >= MIN_RESPOSTAS_PARA_MEDALHA;

/** Total de perguntas abertas — usado no indicador "X de Y respondidas". */
export const TOTAL_PERGUNTAS_CONTEXTO = CAMPOS_TEXTO_CONTEXTO.length;

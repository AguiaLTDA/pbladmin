/**
 * Horário Acadêmico Noturno — UNIVC / Vale do Cricaré
 *
 * Fonte: grade de aulas por curso fornecida pela coordenação.
 * Esta é a FONTE DA VERDADE do vínculo Professor <-> Turma <-> Disciplina.
 * O importador (services/horarioImport.ts) cria cursos, disciplinas, turmas,
 * usuários docentes e popula `horarios_academicos` + `vinculos_professores`.
 *
 * Convenções:
 *  - `turmas`: rótulos como '2º Administração'. Uma aula em junção atende
 *    várias turmas simultaneamente — todas ganham vínculo com o professor.
 *  - `dia`: SEGUNDA | TERCA | QUARTA | QUINTA | SEXTA | CALENDARIO
 *    ('CALENDARIO' = "Conforme calendário", sem dia fixo).
 *  - `modalidade`: PRESENCIAL | EAD.
 *  - `local`: null quando a grade não define sala (Projeto Integrador).
 */

export type DiaSemana = 'SEGUNDA' | 'TERCA' | 'QUARTA' | 'QUINTA' | 'SEXTA' | 'CALENDARIO';
export type Modalidade = 'PRESENCIAL' | 'EAD';

export interface AulaHorario {
  curso: string;
  disciplina: string;
  modulo: string;
  professor: string;
  turmas: string[];
  dia: DiaSemana;
  horaInicio: string;
  horaFim: string;
  turno: string;
  modalidade: Modalidade;
  local: string | null;
  juncao: string | null;
}

const H_INI = '19:00';
const H_FIM = '22:00';

/** Atalho: monta a aula com os padrões do turno noturno (19h às 22h). */
function aula(
  curso: string,
  dia: DiaSemana,
  disciplina: string,
  turmas: string[],
  modulo: string,
  professor: string,
  local: string | null,
  juncao: string | null = null,
  modalidade: Modalidade = 'PRESENCIAL'
): AulaHorario {
  return {
    curso,
    disciplina,
    modulo,
    professor,
    turmas,
    dia,
    horaInicio: H_INI,
    horaFim: H_FIM,
    turno: 'NOTURNO',
    modalidade,
    local,
    juncao
  };
}

const ADM = 'Administração';
const AGR = 'Agronomia';
const ADS = 'Análise e Desenvolvimento de Sistemas';
const CCO = 'Ciências Contábeis';
const CSO = 'Comunicação Social';
const EPR = 'Engenharia de Produção';
const EME = 'Engenharia Mecânica';

const BUSINESS_TOOLS = 'Business Tools';
const PEOPLE_SKILLS = 'People Skills';
const RECURSOS_LOG = 'Recursos, Logística e Materiais';
const PERICIA = 'Perícia e Práticas Avançadas';
const SUSTENTABILIDADE = 'Sustentabilidade e Conservação de Recursos Naturais';
const AGRO_AVANCADA = 'Agronomia Avançada';
const WEB = 'Desenvolvimento de Aplicações WEB';
const MOBILE = 'Desenvolvimento Mobile';
const MODELAGEM = 'Modelagem e Controle de Processos';
const ENG40 = 'Engenharia 4.0';

const AVA = 'AVA/UNIVC';

// Junções recorrentes entre cursos de exatas.
const JUNCAO_2 = 'Junção com 2º Agronomia, Eng. Mecânica e Eng. de Produção';
const JUNCAO_4 = 'Junção com 4º Agronomia, Eng. Mecânica e Eng. de Produção';

// --- ADMINISTRAÇÃO (8 aulas) ---
const administracao: AulaHorario[] = [
  aula(ADM, 'SEGUNDA', 'Tratamento e Dinâmica de Dados', ['2º Administração', '4º Administração'], BUSINESS_TOOLS, 'Felipe Oliveira Souza', AVA, 'Junção com 2º e 4º Administração', 'EAD'),
  aula(ADM, 'SEGUNDA', 'Gestão de Negócios Internacionais', ['6º Administração', '8º Administração'], RECURSOS_LOG, 'Walece Negris Pereira', 'Sala 119 Asa Sul – Prédio A', 'Aula em junção · 2 turmas: 6º Administração, 8º Administração'),
  aula(ADM, 'TERCA', 'Práticas, Processos e Ferramentas de Administração', ['2º Administração', '4º Administração'], BUSINESS_TOOLS, 'Walece Negris Pereira', 'Sala A205 Anexo – Prédio A', 'Junção com 2º e 4º Administração'),
  aula(ADM, 'TERCA', 'Gerenciamento da Cadeia de Suprimentos', ['6º Administração', '8º Administração'], RECURSOS_LOG, 'Caroline Tedesco Santos', 'Sala 119 Asa Sul – Prédio A', 'Aula em junção · 2 turmas: 6º Administração, 8º Administração'),
  aula(ADM, 'QUARTA', 'Gestão do Clima e Cultura nas Organizações', ['2º Administração', '4º Administração'], BUSINESS_TOOLS, 'Nilvans Fernandes Borges', 'Sala A205 Anexo – Prédio A', 'Junção com 2º e 4º Administração'),
  aula(ADM, 'QUARTA', 'Logística Empresarial', ['6º Administração', '8º Administração'], RECURSOS_LOG, 'Estevão Luiz de Oliveira Gonçalves', 'Sala 119 Asa Sul – Prédio A', 'Aula em junção · 2 turmas: 6º Administração, 8º Administração'),
  aula(ADM, 'QUINTA', 'Gestão de Recursos Materiais e Patrimoniais', ['2º Administração', '4º Administração'], BUSINESS_TOOLS, 'Nilvans Fernandes Borges', 'Sala A205 Anexo – Prédio A', 'Junção com 2º e 4º Administração'),
  aula(ADM, 'QUINTA', 'SMS - Saúde, Segurança e Meio Ambiente', ['6º Administração'], RECURSOS_LOG, 'Caroline Tedesco Santos', AVA, null, 'EAD')
];

// --- AGRONOMIA (15 aulas) ---
const agronomia: AulaHorario[] = [
  aula(AGR, 'SEGUNDA', 'Economia', ['2º Agronomia'], PEOPLE_SKILLS, 'Nilvans Fernandes Borges', 'Sala 201 – Prédio D (2º Piso)', JUNCAO_2),
  aula(AGR, 'SEGUNDA', 'Termodinâmica', ['4º Agronomia'], PEOPLE_SKILLS, 'Estevão Luiz de Oliveira Gonçalves', 'Sala 203 – Prédio D (2º Piso)', JUNCAO_4),
  aula(AGR, 'SEGUNDA', 'Fertilidade do Solo e Nutrição Mineral de Plantas', ['6º Agronomia', '8º Agronomia'], `${SUSTENTABILIDADE} - ${AGRO_AVANCADA}`, 'Yan Vinturini Vieira Dantas', 'Sala 202 – Prédio D (2º Piso)', 'Aula em junção · 2 turmas: 6º Agronomia, 8º Agronomia'),
  aula(AGR, 'TERCA', 'Termodinâmica', ['2º Agronomia'], PEOPLE_SKILLS, 'Estevão Luiz de Oliveira Gonçalves', 'Sala 201 – Prédio D (2º Piso)', JUNCAO_2),
  aula(AGR, 'TERCA', 'Economia', ['4º Agronomia'], PEOPLE_SKILLS, 'Nilvans Fernandes Borges', 'Sala 203 – Prédio D (2º Piso)', JUNCAO_4),
  aula(AGR, 'TERCA', 'Agroecologia e Desenvolvimento Sustentável', ['6º Agronomia'], SUSTENTABILIDADE, 'Poliana Rangel Costa', 'Sala 202 – Prédio D (2º Piso)', null),
  aula(AGR, 'TERCA', 'Manejo Integrado de Pragas e Doenças', ['8º Agronomia'], AGRO_AVANCADA, 'Yan Vinturini Vieira Dantas', 'Sala 207 – Prédio C (2º Piso)', null),
  aula(AGR, 'QUARTA', 'Ergonomia e Desenho Universal', ['2º Agronomia'], PEOPLE_SKILLS, 'Donizette Borges Junior', 'Sala 201 – Prédio D (2º Piso)', JUNCAO_2),
  aula(AGR, 'QUARTA', 'Eletromagnetismo e Ondas', ['4º Agronomia'], PEOPLE_SKILLS, 'Estevão Luiz de Oliveira Gonçalves', AVA, null, 'EAD'),
  aula(AGR, 'QUARTA', 'Manejo e Conservação do Solo e da Água', ['6º Agronomia'], SUSTENTABILIDADE, 'Poliana Rangel Costa', 'Sala 202 – Prédio D (2º Piso)', null),
  aula(AGR, 'QUARTA', 'Fitopatologia', ['8º Agronomia'], AGRO_AVANCADA, 'Luis Felipe Oliveira Ribeiro', 'Sala 207 – Prédio C (2º Piso)', null),
  aula(AGR, 'QUINTA', 'Eletromagnetismo e Ondas', ['2º Agronomia'], PEOPLE_SKILLS, 'Estevão Luiz de Oliveira Gonçalves', AVA, null, 'EAD'),
  aula(AGR, 'QUINTA', 'Ergonomia e Desenho Universal', ['4º Agronomia'], PEOPLE_SKILLS, 'Donizette Borges Junior', 'Sala 203 – Prédio D (2º Piso)', JUNCAO_4),
  aula(AGR, 'QUINTA', 'Irrigação e Drenagem', ['6º Agronomia'], SUSTENTABILIDADE, 'Luis Felipe Oliveira Ribeiro', 'Sala 202 – Prédio D (2º Piso)', null),
  aula(AGR, 'SEXTA', 'Máquinas e Implementos Agrícolas', ['2º Agronomia', '4º Agronomia'], PEOPLE_SKILLS, 'Luis Felipe Oliveira Ribeiro', 'Sala 008 – Bloco B', 'Aula em junção · 2 turmas: 2º Agronomia, 4º Agronomia')
];

// --- ANÁLISE E DESENVOLVIMENTO DE SISTEMAS (12 aulas) ---
const analiseSistemas: AulaHorario[] = [
  aula(ADS, 'SEGUNDA', 'Desenvolvimento de Aplicações WEB', ['2º Análise e Desenv. de Sistemas'], WEB, 'Carlos Antônio Pereira dos Santos', 'Sala 002 – Prédio B', null),
  aula(ADS, 'SEGUNDA', 'Auditoria e Segurança de Sistemas', ['4º Análise e Desenv. de Sistemas'], WEB, 'Cristiano Stocco Gaigher', 'Sala 003 – Prédio C (Térreo)', null),
  aula(ADS, 'TERCA', 'Arquitetura de Computadores', ['2º Análise e Desenv. de Sistemas'], WEB, 'Cristiano Stocco Gaigher', 'Sala 002 – Prédio B', null),
  aula(ADS, 'TERCA', 'Desenvolvimento Mobile', ['4º Análise e Desenv. de Sistemas'], MOBILE, 'Carlos Antônio Pereira dos Santos', 'Sala 003 – Prédio C (Térreo)', null),
  aula(ADS, 'QUARTA', 'Programação em Bloco', ['2º Análise e Desenv. de Sistemas'], WEB, 'Rafael Candido Cardoso', 'Sala 002 – Prédio B', null),
  aula(ADS, 'QUARTA', 'Interface de Programação de Aplicações (API)', ['4º Análise e Desenv. de Sistemas'], MOBILE, 'Carlos Antônio Pereira dos Santos', 'Sala 003 – Prédio C (Térreo)', null),
  aula(ADS, 'QUINTA', 'Sistemas Operacionais', ['2º Análise e Desenv. de Sistemas'], WEB, 'Cristiano Stocco Gaigher', 'Sala 002 – Prédio B', null),
  aula(ADS, 'QUINTA', 'Tecnologias e Inovações Aplicadas ADS', ['4º Análise e Desenv. de Sistemas'], MOBILE, 'Cristiano Stocco Gaigher', AVA, null, 'EAD'),
  aula(ADS, 'SEXTA', 'Metodologia da Pesquisa Científica', ['2º Análise e Desenv. de Sistemas'], WEB, 'Felipe Oliveira Souza', AVA, null, 'EAD'),
  aula(ADS, 'SEXTA', 'Ética e Legislação Aplicada à Informática', ['4º Análise e Desenv. de Sistemas'], MOBILE, 'Rodrigo Ghirardelli Souza', AVA, null, 'EAD'),
  aula(ADS, 'CALENDARIO', 'Projeto Integrador - Aplicações WEB', ['2º Análise e Desenv. de Sistemas'], WEB, 'Rafael Candido Cardoso', null, null),
  aula(ADS, 'CALENDARIO', 'Projeto Integrador – Desenvolvimento Mobile', ['4º Análise e Desenv. de Sistemas'], MOBILE, 'Carlos Antônio Pereira dos Santos', null, null)
];

// --- CIÊNCIAS CONTÁBEIS (12 aulas) ---
const cienciasContabeis: AulaHorario[] = [
  aula(CCO, 'SEGUNDA', 'Princípios de Contabilidade e NBC', ['2º Ciências Contábeis', '4º Ciências Contábeis'], BUSINESS_TOOLS, 'Maria da Penha Rodrigues Amaral', 'Sala 106 – Prédio C (1º Piso)', 'Junção com 2º e 4º Ciências Contábeis'),
  aula(CCO, 'SEGUNDA', 'Planejamento Tributário', ['6º Ciências Contábeis', '8º Ciências Contábeis'], PERICIA, 'Jussara Placido Rangel Pereira', 'Sala 105 – Prédio C (1º Piso)', 'Aula em junção · 2 turmas: 6º Ciências Contábeis, 8º Ciências Contábeis'),
  aula(CCO, 'TERCA', 'Contabilidade Empresarial I', ['2º Ciências Contábeis', '4º Ciências Contábeis'], BUSINESS_TOOLS, 'Jussara Placido Rangel Pereira', 'Sala 106 – Prédio C (1º Piso)', 'Junção com 2º e 4º Ciências Contábeis'),
  aula(CCO, 'TERCA', 'Compliance e Governança Corporativa', ['6º Ciências Contábeis'], PERICIA, 'Maria da Penha Rodrigues Amaral', 'Sala 105 – Prédio C (1º Piso)', null),
  aula(CCO, 'TERCA', 'Costumer Experience - Qualidade', ['8º Ciências Contábeis'], PERICIA, 'Caroline Tedesco Santos', AVA, null, 'EAD'),
  aula(CCO, 'QUARTA', 'Projetos Digitais', ['2º Ciências Contábeis', '4º Ciências Contábeis'], BUSINESS_TOOLS, 'Serli Santos Silva', 'Sala 106 – Prédio C (1º Piso)', 'Junção com 2º e 4º Ciências Contábeis'),
  aula(CCO, 'QUARTA', 'Perícia Contábil', ['6º Ciências Contábeis', '8º Ciências Contábeis'], PERICIA, 'Jussara Placido Rangel Pereira', 'Sala 105 – Prédio C (1º Piso)', 'Aula em junção · 2 turmas: 6º Ciências Contábeis, 8º Ciências Contábeis'),
  aula(CCO, 'QUINTA', 'Teoria Geral da Administração', ['2º Ciências Contábeis', '4º Ciências Contábeis'], BUSINESS_TOOLS, 'Walece Negris Pereira', 'Sala 106 – Prédio C (1º Piso)', 'Junção com 2º e 4º Ciências Contábeis'),
  aula(CCO, 'QUINTA', 'Costumer Experience - Qualidade', ['6º Ciências Contábeis'], PERICIA, 'Caroline Tedesco Santos', AVA, null, 'EAD'),
  aula(CCO, 'QUINTA', 'Direito Empresarial', ['8º Ciências Contábeis'], PERICIA, 'Jakeline Martins Silva Rocha', AVA, null, 'EAD'),
  aula(CCO, 'SEXTA', 'Direito Empresarial', ['2º Ciências Contábeis', '4º Ciências Contábeis'], BUSINESS_TOOLS, 'Jakeline Martins Silva Rocha', AVA, 'Junção com 2º e 4º Ciências Contábeis', 'EAD'),
  aula(CCO, 'SEXTA', 'Gestão de Micro e Pequenas Empresas', ['6º Ciências Contábeis'], PERICIA, 'Walece Negris Pereira', 'Sala 009 – Bloco B', null)
];

// --- COMUNICAÇÃO SOCIAL (5 aulas) ---
const comunicacaoSocial: AulaHorario[] = [
  aula(CSO, 'SEGUNDA', 'Planejamento de Mídia', ['4º Comunicação Social'], BUSINESS_TOOLS, 'Serli Santos Silva', 'Sala 120 Asa Sul – Prédio A', null),
  aula(CSO, 'TERCA', 'Assessoria de Imprensa e Mídia Training', ['4º Comunicação Social'], BUSINESS_TOOLS, 'Aline Coradini de Souza', 'Sala 120 Asa Sul – Prédio A', null),
  aula(CSO, 'QUARTA', 'Projeto Integrador Mídias Interativas e Sociais', ['4º Comunicação Social'], BUSINESS_TOOLS, 'Aline Coradini de Souza', 'Sala 120 Asa Sul – Prédio A', null),
  aula(CSO, 'QUINTA', 'Sistemas de Informação e Business Intelligence', ['4º Comunicação Social'], BUSINESS_TOOLS, 'Cristiano Stocco Gaigher', AVA, null, 'EAD'),
  aula(CSO, 'SEXTA', 'Comunicação Digital', ['4º Comunicação Social'], BUSINESS_TOOLS, 'Felipe Oliveira Souza', AVA, null, 'EAD')
];

// --- ENGENHARIA DE PRODUÇÃO (9 aulas) ---
const engenhariaProducao: AulaHorario[] = [
  aula(EPR, 'SEGUNDA', 'Economia', ['2º Engenharia de Produção'], PEOPLE_SKILLS, 'Nilvans Fernandes Borges', 'Sala 201 – Prédio D (2º Piso)', JUNCAO_2),
  aula(EPR, 'SEGUNDA', 'Termodinâmica', ['4º Engenharia de Produção'], PEOPLE_SKILLS, 'Estevão Luiz de Oliveira Gonçalves', 'Sala 203 – Prédio D (2º Piso)', JUNCAO_4),
  aula(EPR, 'TERCA', 'Termodinâmica', ['2º Engenharia de Produção'], PEOPLE_SKILLS, 'Estevão Luiz de Oliveira Gonçalves', 'Sala 201 – Prédio D (2º Piso)', JUNCAO_2),
  aula(EPR, 'TERCA', 'Economia', ['4º Engenharia de Produção'], PEOPLE_SKILLS, 'Nilvans Fernandes Borges', 'Sala 203 – Prédio D (2º Piso)', JUNCAO_4),
  aula(EPR, 'QUARTA', 'Ergonomia e Desenho Universal', ['2º Engenharia de Produção'], PEOPLE_SKILLS, 'Donizette Borges Junior', 'Sala 201 – Prédio D (2º Piso)', JUNCAO_2),
  aula(EPR, 'QUARTA', 'Eletromagnetismo e Ondas', ['4º Engenharia de Produção'], PEOPLE_SKILLS, 'Estevão Luiz de Oliveira Gonçalves', AVA, null, 'EAD'),
  aula(EPR, 'QUINTA', 'Costumer Experience – Qualidade', ['2º Engenharia de Produção'], PEOPLE_SKILLS, 'Caroline Tedesco Santos', AVA, null, 'EAD'),
  aula(EPR, 'QUINTA', 'Ergonomia e Desenho Universal', ['4º Engenharia de Produção'], PEOPLE_SKILLS, 'Donizette Borges Junior', 'Sala 203 – Prédio D (2º Piso)', JUNCAO_4),
  aula(EPR, 'SEXTA', 'Eletromagnetismo e Ondas', ['2º Engenharia de Produção'], PEOPLE_SKILLS, 'Estevão Luiz de Oliveira Gonçalves', AVA, null, 'EAD')
];

// --- ENGENHARIA MECÂNICA (15 aulas) ---
const engenhariaMecanica: AulaHorario[] = [
  aula(EME, 'SEGUNDA', 'Economia', ['2º Engenharia Mecânica'], PEOPLE_SKILLS, 'Nilvans Fernandes Borges', 'Sala 201 – Prédio D (2º Piso)', JUNCAO_2),
  aula(EME, 'SEGUNDA', 'Termodinâmica', ['4º Engenharia Mecânica'], PEOPLE_SKILLS, 'Estevão Luiz de Oliveira Gonçalves', 'Sala 203 – Prédio D (2º Piso)', JUNCAO_4),
  aula(EME, 'SEGUNDA', 'Transferência de Calor', ['6º Engenharia Mecânica'], MODELAGEM, 'Donizette Borges Junior', 'Sala 001 – Prédio C (Térreo)', null),
  aula(EME, 'SEGUNDA', 'Refrigeração, Condicionamento de Ar e Ventilação', ['8º Engenharia Mecânica'], ENG40, 'Emílio Cesar Sangali', 'Sala 121 Asa Sul – Prédio A', null),
  aula(EME, 'TERCA', 'Termodinâmica', ['2º Engenharia Mecânica'], PEOPLE_SKILLS, 'Estevão Luiz de Oliveira Gonçalves', 'Sala 201 – Prédio D (2º Piso)', JUNCAO_2),
  aula(EME, 'TERCA', 'Economia', ['4º Engenharia Mecânica'], PEOPLE_SKILLS, 'Nilvans Fernandes Borges', 'Sala 203 – Prédio D (2º Piso)', JUNCAO_4),
  aula(EME, 'TERCA', 'Equações Diferenciais e Séries', ['6º Engenharia Mecânica'], MODELAGEM, 'Luciano Vignatti', 'Sala 101 – Prédio C (1º Piso)', null),
  aula(EME, 'TERCA', 'Simulação Computacional Avançada', ['8º Engenharia Mecânica'], ENG40, 'Donizette Borges Junior', 'Sala 121 Asa Sul – Prédio A', null),
  aula(EME, 'QUARTA', 'Ergonomia e Desenho Universal', ['2º Engenharia Mecânica'], PEOPLE_SKILLS, 'Donizette Borges Junior', 'Sala 201 – Prédio D (2º Piso)', JUNCAO_2),
  aula(EME, 'QUARTA', 'Eletromagnetismo e Ondas', ['4º Engenharia Mecânica'], PEOPLE_SKILLS, 'Estevão Luiz de Oliveira Gonçalves', AVA, null, 'EAD'),
  aula(EME, 'QUARTA', 'Probabilidade e Estatística', ['6º Engenharia Mecânica', '8º Engenharia Mecânica'], `${MODELAGEM} - ${ENG40}`, 'Luciano Vignatti', 'Sala 121 Asa Sul – Prédio A', 'Aula em junção · 2 turmas: 6º Engenharia Mecânica, 8º Engenharia Mecânica'),
  aula(EME, 'QUINTA', 'Costumer Experience – Qualidade', ['2º Engenharia Mecânica'], PEOPLE_SKILLS, 'Caroline Tedesco Santos', AVA, null, 'EAD'),
  aula(EME, 'QUINTA', 'Ergonomia e Desenho Universal', ['4º Engenharia Mecânica'], PEOPLE_SKILLS, 'Donizette Borges Junior', 'Sala 203 – Prédio D (2º Piso)', JUNCAO_4),
  aula(EME, 'QUINTA', 'Automação, Hidráulica e Pneumática', ['6º Engenharia Mecânica'], `${MODELAGEM} - ${ENG40}`, 'Emílio Cesar Sangali', 'Sala 121 Asa Sul – Prédio A', null),
  aula(EME, 'SEXTA', 'Eletromagnetismo e Ondas', ['2º Engenharia Mecânica'], PEOPLE_SKILLS, 'Estevão Luiz de Oliveira Gonçalves', AVA, null, 'EAD')
];

export const HORARIO_ACADEMICO: AulaHorario[] = [
  ...administracao,
  ...agronomia,
  ...analiseSistemas,
  ...cienciasContabeis,
  ...comunicacaoSocial,
  ...engenhariaProducao,
  ...engenhariaMecanica
];

/** Siglas usadas para gerar `cursos.codigo` e o prefixo de `turmas.codigo`. */
export const SIGLAS_CURSO: Record<string, string> = {
  [ADM]: 'ADM',
  [AGR]: 'AGRO',
  [ADS]: 'ADS',
  [CCO]: 'CCONT',
  [CSO]: 'COMSOC',
  [EPR]: 'ENGPROD',
  [EME]: 'ENGMEC'
};

export const PERIODO_LETIVO_HORARIO = {
  nome: '2026/1',
  dataInicio: '2026-02-02',
  dataFim: '2026-06-30'
};

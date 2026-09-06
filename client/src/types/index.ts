export type PerfilRole = 'ADMIN' | 'PROFESSOR' | 'ALUNO';

export interface User {
  id: number;
  nome: string;
  email: string;
  perfilId: number;
  perfilNome: PerfilRole;
  ativo?: number;
  criado_em?: string;
}

export type PBLStatus =
  | 'RASCUNHO'
  | 'ENVIADO_ANALISE'
  | 'EM_ANALISE'
  | 'AJUSTES_SOLICITADOS'
  | 'REENVIADO'
  | 'APROVADO'
  | 'AGENDADO'
  | 'PUBLICADO'
  | 'SUSPENSO'
  | 'ENCERRADO'
  | 'ARQUIVADO'
  | 'REPROVADO';

export interface PBLStep {
  id?: number;
  ordem: number;
  titulo: string;
  descricao: string;
  obrigatoria: boolean;
}

export interface PBLVersion {
  id: number;
  atividade_id: number;
  numero_versao: number;
  contexto_problema: string;
  problema_central: string;
  objetivos_aprendizagem: string;
  competencias_habilidades: string;
  conhecimentos_previos: string;
  instrucoes_gerais: string;
  perguntas_norteadoras: string;
  produtos_esperados: string;
  forma_realizacao: 'INDIVIDUAL' | 'GRUPO';
  criterios_avaliacao: string;
  rubrica_json?: string;
  carga_horaria_estimada: number;
  observacoes_professor?: string;
  observacoes_internas_admin?: string;
  criado_por: number;
  criado_por_nome?: string;
  criado_em: string;
}

export interface PBLActivity {
  id: number;
  codigo_unico: string;
  titulo: string;
  curso_id: number;
  curso_nome?: string;
  disciplina_id: number;
  disciplina_nome?: string;
  disciplina_codigo?: string;
  professor_id: number;
  professor_nome?: string;
  professor_email?: string;
  periodo_letivo_id: number;
  periodo_nome?: string;
  status: PBLStatus;
  versao_atual: number;
  criado_em: string;
  atualizado_em: string;

  // Publication data if published
  publicacao_id?: number;
  data_disponibilizacao?: string;
  prazo_entrega?: string;
  status_publicacao?: string;
}

export interface FileItem {
  id: number;
  nome_original: string;
  caminho_armazenado?: string;
  tamanho_bytes: number;
  mime_type: string;
  categoria: string;
  hash_md5?: string;
  enviado_por_nome?: string;
  aprovado_pelo_admin?: number;
  versao_material?: string;
  criado_em?: string;
}

export interface SubmissionFile {
  id: number;
  nome_original: string;
  tamanho_bytes: number;
  mime_type: string;
  categoria?: string;
  hash_md5?: string;
  criado_em?: string;
}

export interface StudentSubmission {
  id: number;
  publicacao_id: number;
  aluno_id: number;
  aluno_nome?: string;
  aluno_email?: string;
  grupo_id?: number;
  grupo_nome?: string;
  turma_id?: number;
  turma_nome?: string;
  turma_codigo?: string;
  arquivos?: SubmissionFile[];
  status: 'RASCUNHO' | 'ENVIADO' | 'ATRASADO';
  conteudo_resposta?: string;
  data_envio?: string;
  comprovante_hash?: string;
  nota_escrita?: number;
  nota_oral?: number;
  nota_total?: number;
  observacoes?: string;
  liberado_aluno?: number;
}

export interface NotificationItem {
  id: number;
  usuario_id: number;
  titulo: string;
  mensagem: string;
  link?: string;
  lida: number;
  criado_em: string;
}

export interface MandatoryFieldConfig {
  id: number;
  nome_campo: string;
  rotulo: string;
  obrigatorio: number;
}

export interface RuleInput {
  entidadeTipo: 'curso' | 'disciplina' | 'turma' | 'grupo' | 'aluno';
  entidadeId: number;
  acao: 'INCLUIR' | 'EXCLUIR';
}

export interface StudentRegistrationInput {
  nome: string;
  email: string;
  matricula: string;
  cpf?: string;
  telefone?: string;
  curso: string;
  turma?: string;
  periodo?: string;
  origem?: string;
  senha?: string;
}

export interface StudentRegistration extends StudentRegistrationInput {
  id: number;
  criado_em: string;
  status: 'PENDENTE' | 'APROVADO' | 'REJEITADO';
  usuario_id?: number | null;
  justificativa_rejeicao?: string | null;
}

// --- AUTO-MATRÍCULA E GRUPO PBL (PORTAL DO ALUNO) ---

export interface TurmaOption {
  id: number;
  codigo: string;
  nome: string;
  disciplina_nome?: string;
  curso_nome?: string;
  periodo_nome?: string;
}

export interface GrupoOption {
  id: number;
  nome: string;
  turma_id: number;
  turma_nome?: string;
  total_integrantes?: number;
}

export interface GrupoMembro {
  id: number;
  nome: string;
  email: string;
}

export interface MinhaMatricula {
  matricula_id: number;
  turma_id: number;
  turma_nome: string;
  turma_codigo: string;
  grupo_id: number | null;
  grupo_nome: string | null;
}

// --- HORÁRIO ACADÊMICO & VÍNCULOS DO DOCENTE ---

export type DiaSemana = 'SEGUNDA' | 'TERCA' | 'QUARTA' | 'QUINTA' | 'SEXTA' | 'CALENDARIO';

export interface ScheduleEntry {
  id: number;
  dia_semana: DiaSemana;
  hora_inicio: string;
  hora_fim: string;
  turno: string;
  modalidade: 'PRESENCIAL' | 'EAD';
  modulo?: string;
  local?: string | null;
  juncao?: string | null;
  curso_id: number;
  curso_nome: string;
  disciplina_id: number;
  disciplina_nome: string;
  professor_id: number;
  professor_nome: string;
  periodo_nome?: string;
  turmas_nomes?: string | null;
}

export interface ProfessorClassBinding {
  id: number;
  codigo: string;
  nome: string;
  periodo_curso?: number | null;
  turno?: string;
  curso_nome?: string;
  periodo_nome?: string;
  total_alunos: number;
  disciplinas_nomes?: string | null;
}

export interface ProfessorBindings {
  professorId: number;
  turmas: ProfessorClassBinding[];
  disciplinas: Array<{ id: number; nome: string; codigo: string; curso_nome: string }>;
}

// --- ARQUIVO ORIENTADOR VINCULADO À CONTA DO PROFESSOR ---

export interface OrientadorFile {
  vinculo_id: number;
  vinculado_em: string;
  rotulo?: string;
  arquivo_id: number;
  nome_original: string;
  tamanho_bytes: number;
  mime_type: string;
  categoria?: string;
}

export interface OrientadorFileAdminRow {
  professor_id: number;
  professor_nome: string;
  professor_email: string;
  vinculo_id: number | null;
  vinculado_em: string | null;
  rotulo: string | null;
  replicado_em: string | null;
  arquivo_id: number | null;
  nome_original: string | null;
  tamanho_bytes: number | null;
  mime_type: string | null;
  categoria: string | null;
  vinculado_por_nome: string | null;
}

export interface OrientadorReplicacaoResultado {
  message: string;
  atividades: Array<{ id: number; disciplinaNome: string; totalTurmas: number }>;
}

// --- SUGESTÕES/REVISÃO DO PROFESSOR SOBRE O ARQUIVO ORIENTADOR ---

export interface OrientadorComment {
  id: number;
  texto: string;
  criado_em: string;
  disciplina_nome: string;
  disciplina_codigo?: string;
}

export interface OrientadorReviewRow {
  id: number;
  texto: string;
  criado_em: string;
  professor_id: number;
  professor_nome: string;
  professor_email: string;
  disciplina_id: number;
  disciplina_nome: string;
  disciplina_codigo?: string;
  curso_nome?: string;
  arquivo_nome?: string;
  rotulo?: string;
}

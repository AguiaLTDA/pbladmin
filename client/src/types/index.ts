export type PerfilRole = 'ADMIN' | 'PROFESSOR' | 'ALUNO';

export interface User {
  id: number;
  nome: string;
  email: string;
  perfilId: number;
  perfilNome: PerfilRole;
  ativo?: number;
  criado_em?: string;
  /** Aluno que preencheu o Contexto do Aluno o bastante para ganhar a medalha. */
  contextoCompleto?: boolean;
  /**
   * CONCLUIDO = já confirmou o e-mail (convite ou "esqueci minha senha").
   * PENDENTE = convite de primeiro acesso enviado, ainda dentro do prazo.
   * EXPIRADO = convite enviado e vencido sem uso.
   * SEM_CONVITE = nunca recebeu convite de primeiro acesso (conta antiga/local).
   */
  statusAcesso?: 'CONCLUIDO' | 'PENDENTE' | 'EXPIRADO' | 'SEM_CONVITE';
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
  /** 'INFORMATIVA' = atalho "enviar arquivo para grupo" (sem entrega esperada). */
  natureza?: 'AVALIATIVA' | 'INFORMATIVA';
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
  /** Papel do documento no ciclo do PBL, escolhido no upload. */
  tipo_documento?: string | null;
  hash_md5?: string;
  enviado_por_nome?: string;
  aprovado_pelo_admin?: number;
  versao_material?: string;
  criado_em?: string;
  /** Quantos docentes já receberam este arquivo (gerenciador do admin). */
  total_direcionamentos?: number | string;
  total_turmas?: number | string;
  total_grupos?: number | string;
  turmas_destino?: string[];
  grupos_destino?: string[];
  turmas_destino_ids?: number[];
}

/** Resumo do que um grupo já recebeu, para sinalizar antes de enviar de novo. */
export interface GrupoComMaterial {
  grupoId: number;
  total: number;
  /** Já recebeu ao menos um material classificado como PBL 1 — vira o selo na lista de grupos. */
  temPbl1: boolean;
  materiais: {
    atividadeId: number;
    titulo: string;
    arquivoId: number | null;
    arquivoNome: string | null;
    tipoDocumento: string | null;
    criadoEm: string;
  }[];
}

/** Comentário público do docente sobre um material, lido pela turma. */
export interface ComentarioMaterial {
  id: number;
  texto: string;
  criado_em: string;
  grupo_id: number | null;
  autor_id: number;
  autor_nome: string;
  autor_perfil: 'ADMIN' | 'PROFESSOR' | 'ALUNO';
  grupo_nome: string | null;
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
  /** Medalha de Contexto Completo do aluno, para exibir ao lado do nome. */
  contexto_completo?: boolean;
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

/** Entrega na lixeira da coordenadoria (exclusão lógica, restaurável). */
export interface EntregaExcluida {
  /** Medalha de Contexto Completo do aluno, para exibir ao lado do nome. */
  contexto_completo?: boolean;
  id: number;
  status: string;
  data_envio?: string | null;
  deletado_em: string;
  aluno_nome: string;
  aluno_email: string;
  grupo_nome?: string | null;
  atividade_id: number;
  atividade_titulo: string;
  codigo_unico: string;
}

/** Atividade PBL na lixeira da coordenadoria. */
export interface AtividadeExcluida {
  id: number;
  codigo_unico: string;
  titulo: string;
  status: PBLStatus;
  deletado_em: string;
  curso_nome?: string;
  disciplina_nome?: string;
  professor_nome?: string;
}

/** Direcionamento de um arquivo do gerenciador a um docente. */
export interface DirecionamentoArquivo {
  id: number;
  observacao?: string | null;
  criado_em: string;
  professor_id: number;
  professor_nome: string;
  professor_email?: string;
  curso_nome?: string | null;
  turma_nome?: string | null;
  turma_codigo?: string | null;
  disciplina_nome?: string | null;
  grupo_nome?: string | null;
  /** Ids do alvo — necessários para comentar sobre o material na turma certa. */
  turma_id?: number | null;
  grupo_id?: number | null;
}

/** Material que a coordenação direcionou ao professor autenticado. */
export interface MaterialDirecionado extends DirecionamentoArquivo {
  arquivo_id: number;
  nome_original: string;
  tamanho_bytes: number;
  mime_type: string;
  categoria?: string;
  tipo_documento?: string | null;
  direcionado_por_nome?: string | null;
  professor_lider_id?: number | null;
  professor_lider_nome?: string | null;
}

/**
 * Sugestão da docência sobre um material direcionado (ex.: Pré-PBL 1).
 * Diferente de `ComentarioMaterial`, que é lido pelos alunos: esta só alcança a
 * coordenação e os demais docentes da mesma turma.
 */
export interface SugestaoMaterial {
  id: number;
  texto: string;
  criado_em: string;
  autor_id: number;
  autor_nome: string;
  autor_perfil: 'ADMIN' | 'PROFESSOR';
  autor_e_lider?: boolean | null;
}

export interface SugestoesMaterialPayload {
  liderId: number | null;
  liderNome: string | null;
  sugestoes: SugestaoMaterial[];
}

/** Linha do painel da coordenação com as sugestões de todas as turmas. */
export interface SugestaoMaterialAdminRow extends SugestaoMaterial {
  arquivo_id: number;
  nome_original: string;
  tipo_documento?: string | null;
  turma_id: number;
  turma_nome: string;
  curso_nome?: string | null;
  professor_lider_nome?: string | null;
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
  /** Preenchido apenas nos cadastros que estão na lixeira. */
  deletado_em?: string | null;
  /** Grupos PBL ativos do aluno, separados por ' • '. Nulo = ainda sem grupo. */
  grupos_nomes?: string | null;
  /** Matrículas ativas do aluno. Vem como string do Postgres (COUNT). */
  total_matriculas?: number | string | null;
}

// --- AUTO-MATRÍCULA E GRUPO PBL (PORTAL DO ALUNO) ---

export interface TurmaOption {
  id: number;
  codigo: string;
  nome: string;
  disciplina_nome?: string;
  curso_nome?: string;
  periodo_nome?: string;
  professor_lider_id?: number | null;
  professor_lider_nome?: string | null;
}

/** Docente vinculado a uma turma — base do seletor de professor líder. */
export interface TurmaProfessor {
  turma_id: number;
  professor_id: number;
  professor_nome: string;
  professor_email?: string;
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
  contexto_completo?: boolean;
}

/** Respostas do aluno sobre a própria realidade profissional. Todas opcionais. */
export interface ContextoAlunoInput {
  work_sector?: string;
  company_size?: string;
  daily_tasks?: string;
  workplace_challenges?: string;
  relevant_experience?: string;
  key_learnings?: string;
  course_connection?: string;
  career_goals?: string;
}

export interface MedalhaAluno {
  codigo: string;
  titulo: string;
  descricao: string;
  icone: string;
  horasComplementares: number;
  conquistadaEm?: string;
}

/**
 * O que a API devolve: as respostas mais o progresso e a medalha já calculados
 * no servidor, para que a tela nunca discorde dele sobre o que é "completo".
 */
export interface ContextoAluno {
  usuarioId: number;
  existe: boolean;
  workSector: string | null;
  companySize: string | null;
  dailyTasks: string;
  workplaceChallenges: string;
  relevantExperience: string;
  keyLearnings: string;
  courseConnection: string;
  careerGoals: string;
  completed: boolean;
  completedAt: string | null;
  respondidas: number;
  totalPerguntas: number;
  minimoParaMedalha: number;
  minimoCaracteres: number;
  medalha: MedalhaAluno | null;
  ganhouMedalha?: boolean;
  perdeuMedalha?: boolean;
  message?: string;
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
  /** Docente designado pela coordenação como líder desta turma. */
  professor_lider_id?: number | null;
  professor_lider_nome?: string | null;
}

export interface ProfessorBindings {
  professorId: number;
  turmas: ProfessorClassBinding[];
  disciplinas: Array<{ id: number; nome: string; codigo: string; curso_nome: string }>;
}

// --- ARQUIVOS INSTITUCIONAIS (ex.: Manual do Aluno PBL) ---

export interface InstitutionalFile {
  chave: string;
  atualizado_em: string;
  arquivo_id: number;
  nome_original: string;
  tamanho_bytes: number;
  mime_type: string;
  categoria?: string;
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
  turma_nome?: string | null;
  turma_codigo?: string | null;
  curso_nome?: string | null;
}

/** Revisão do PBL dos grupos = o feedback/nota que o docente lançou na entrega. */
export interface RevisaoPBLGrupo {
  id: number;
  texto?: string | null;
  nota_escrita?: number;
  nota_oral?: number;
  nota_total?: number;
  liberado_aluno?: number;
  criado_em: string;
  professor_id: number;
  professor_nome: string;
  professor_email?: string;
  aluno_nome: string;
  aluno_email?: string;
  grupo_nome?: string | null;
  turma_nome?: string | null;
  turma_codigo?: string | null;
  disciplina_nome: string;
  disciplina_codigo?: string;
  curso_nome?: string;
  atividade_id: number;
  atividade_titulo: string;
  codigo_unico: string;
}

export interface RevisaoDocentePayload {
  orientador: OrientadorReviewRow[];
  pblGrupos: RevisaoPBLGrupo[];
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
  turma_id?: number | null;
  turma_nome?: string | null;
  turma_codigo?: string | null;
  curso_nome?: string;
  arquivo_nome?: string;
  rotulo?: string;
}

/** Uma linha do panorama de contextos que a coordenação enxerga. */
export interface ContextoAlunoResumo {
  id: number;
  nome: string;
  email: string;
  cursoId: number;
  cursoNome: string;
  turmaId: number;
  turmaNome: string;
  turmaCodigo: string;
  grupoId: number | null;
  grupoNome: string | null;
  respondeu: boolean;
  completed: boolean;
  completedAt: string | null;
  atualizadoEm: string | null;
  respondidas: number;
  workSector: string | null;
  companySize: string | null;
  dailyTasks: string;
  workplaceChallenges: string;
  relevantExperience: string;
  keyLearnings: string;
  courseConnection: string;
  careerGoals: string;
}

export interface PanoramaContextos {
  totalPerguntas: number;
  minimoParaMedalha: number;
  resumo: { alunos: number; completos: number; iniciados: number; semResposta: number };
  alunos: ContextoAlunoResumo[];
}

// --- RETRO-AUTOAVALIAÇÃO ENTRE PARES DOS GRUPOS PBL ---

export type StatusJanelaAutoavaliacao = 'ABERTA' | 'FUTURA' | 'ENCERRADA' | 'INEXISTENTE';

export interface JanelaAutoavaliacao {
  id: number;
  rodada: number;
  titulo: string;
  abreEm: string;
  fechaEm: string;
  status?: StatusJanelaAutoavaliacao;
}

export interface ColegaParaAvaliar {
  id: number;
  nome: string;
  nota: number | null;
}

export interface TurmaParaAutoavaliar {
  turmaId: number;
  turmaNome: string;
  grupoId: number;
  grupoNome: string;
  colegas: ColegaParaAvaliar[];
  completo: boolean;
}

export interface MeuGrupoAutoavaliacao {
  janela: JanelaAutoavaliacao | null;
  status: StatusJanelaAutoavaliacao;
  turmas: TurmaParaAutoavaliar[];
}

export interface AlunoStatusAutoavaliacao {
  id: number;
  nome: string;
  email: string;
  cursoId: number;
  cursoNome: string;
  turmaId: number;
  turmaNome: string;
  grupoId: number;
  grupoNome: string;
  totalColegas: number;
  notasDadas: number;
  completo: boolean;
  totalNotasRecebidas: number;
  mediaRecebida: number | null;
}

export interface PanoramaAutoavaliacao {
  janela: JanelaAutoavaliacao | null;
  status: StatusJanelaAutoavaliacao;
  alunos: AlunoStatusAutoavaliacao[];
}

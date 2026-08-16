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

export interface StudentSubmission {
  id: number;
  publicacao_id: number;
  aluno_id: number;
  aluno_nome?: string;
  aluno_email?: string;
  grupo_id?: number;
  grupo_nome?: string;
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

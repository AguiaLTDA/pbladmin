PRAGMA foreign_keys = ON;

-- 1. Perfis de Acesso
CREATE TABLE IF NOT EXISTS perfis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT UNIQUE NOT NULL, -- 'ADMIN', 'PROFESSOR', 'ALUNO'
  descricao TEXT
);

-- 2. Usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  perfil_id INTEGER NOT NULL,
  ativo INTEGER DEFAULT 1,
  deletado_em DATETIME DEFAULT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (perfil_id) REFERENCES perfis(id)
);

-- 3. Cursos
CREATE TABLE IF NOT EXISTS cursos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo INTEGER DEFAULT 1,
  deletado_em DATETIME DEFAULT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Disciplinas
CREATE TABLE IF NOT EXISTS disciplinas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  curso_id INTEGER NOT NULL,
  ativo INTEGER DEFAULT 1,
  deletado_em DATETIME DEFAULT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (curso_id) REFERENCES cursos(id)
);

-- 5. Períodos Letivos
CREATE TABLE IF NOT EXISTS periodos_letivos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL, -- e.g. "2026/1"
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  ativo INTEGER DEFAULT 1,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Turmas
CREATE TABLE IF NOT EXISTS turmas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  disciplina_id INTEGER NOT NULL,
  periodo_letivo_id INTEGER NOT NULL,
  ativo INTEGER DEFAULT 1,
  deletado_em DATETIME DEFAULT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id),
  FOREIGN KEY (periodo_letivo_id) REFERENCES periodos_letivos(id)
);

-- 7. Grupos PBL dentro das turmas
CREATE TABLE IF NOT EXISTS grupos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  turma_id INTEGER NOT NULL,
  ativo INTEGER DEFAULT 1,
  deletado_em DATETIME DEFAULT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (turma_id) REFERENCES turmas(id)
);

-- 8. Matrículas de Alunos
CREATE TABLE IF NOT EXISTS matriculas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  turma_id INTEGER NOT NULL,
  grupo_id INTEGER DEFAULT NULL,
  ativo INTEGER DEFAULT 1,
  deletado_em DATETIME DEFAULT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (turma_id) REFERENCES turmas(id),
  FOREIGN KEY (grupo_id) REFERENCES grupos(id)
);

-- 9. Vínculos de Professores a Turmas/Disciplinas
CREATE TABLE IF NOT EXISTS vinculos_professores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  turma_id INTEGER NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (turma_id) REFERENCES turmas(id)
);

-- 10. Atividades PBL (Registro Principal)
CREATE TABLE IF NOT EXISTS atividades_pbl (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo_unico TEXT UNIQUE NOT NULL,
  titulo TEXT NOT NULL,
  curso_id INTEGER NOT NULL,
  disciplina_id INTEGER NOT NULL,
  professor_id INTEGER NOT NULL,
  periodo_letivo_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'RASCUNHO', 
  -- RASCUNHO, ENVIADO_ANALISE, EM_ANALISE, AJUSTES_SOLICITADOS, REENVIADO, APROVADO, AGENDADO, PUBLICADO, SUSPENSO, ENCERRADO, ARQUIVADO, REPROVADO
  versao_atual INTEGER DEFAULT 1,
  deletado_em DATETIME DEFAULT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (curso_id) REFERENCES cursos(id),
  FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id),
  FOREIGN KEY (professor_id) REFERENCES usuarios(id),
  FOREIGN KEY (periodo_letivo_id) REFERENCES periodos_letivos(id)
);

-- 11. Versões das Atividades PBL
CREATE TABLE IF NOT EXISTS versoes_atividades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  atividade_id INTEGER NOT NULL,
  numero_versao INTEGER NOT NULL,
  contexto_problema TEXT,
  problema_central TEXT,
  objetivos_aprendizagem TEXT,
  competencias_habilidades TEXT,
  conhecimentos_previos TEXT,
  instrucoes_gerais TEXT,
  perguntas_norteadoras TEXT,
  produtos_esperados TEXT,
  forma_realizacao TEXT DEFAULT 'INDIVIDUAL', -- 'INDIVIDUAL' ou 'GRUPO'
  criterios_avaliacao TEXT,
  rubrica_json TEXT, -- JSON com matriz/rubrica
  carga_horaria_estimada INTEGER DEFAULT 10,
  observacoes_professor TEXT,
  observacoes_internas_admin TEXT,
  criado_por INTEGER NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (atividade_id) REFERENCES atividades_pbl(id),
  FOREIGN KEY (criado_por) REFERENCES usuarios(id)
);

-- 12. Etapas da Atividade PBL
CREATE TABLE IF NOT EXISTS etapas_pbl (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  versao_atividade_id INTEGER NOT NULL,
  ordem INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  obrigatoria INTEGER DEFAULT 1,
  FOREIGN KEY (versao_atividade_id) REFERENCES versoes_atividades(id) ON DELETE CASCADE
);

-- 13. Gerenciador Central de Arquivos
CREATE TABLE IF NOT EXISTS arquivos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_original TEXT NOT NULL,
  caminho_armazenado TEXT NOT NULL,
  tamanho_bytes INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  categoria TEXT DEFAULT 'OUTROS', -- 'PDF', 'DOCUMENTO', 'PLANILHA', 'APRESENTACAO', 'IMAGEM', 'VIDEO', 'ZIP'
  hash_md5 TEXT,
  enviado_por INTEGER NOT NULL,
  deletado_em DATETIME DEFAULT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (enviado_por) REFERENCES usuarios(id)
);

-- 14. Anexos das Versões de Atividades
CREATE TABLE IF NOT EXISTS arquivos_atividades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  versao_atividade_id INTEGER NOT NULL,
  arquivo_id INTEGER NOT NULL,
  aprovado_pelo_admin INTEGER DEFAULT 0,
  versao_material TEXT DEFAULT 'v1',
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (versao_atividade_id) REFERENCES versoes_atividades(id),
  FOREIGN KEY (arquivo_id) REFERENCES arquivos(id)
);

-- 15. Configuração de Campos Obrigatórios do PBL
CREATE TABLE IF NOT EXISTS config_campos_obrigatorios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_campo TEXT UNIQUE NOT NULL,
  rotulo TEXT NOT NULL,
  obrigatorio INTEGER DEFAULT 1,
  atualizado_por INTEGER,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (atualizado_por) REFERENCES usuarios(id)
);

-- 16. Segmentação de Atividades
CREATE TABLE IF NOT EXISTS segmentacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  atividade_id INTEGER NOT NULL,
  tipo_segmentacao TEXT NOT NULL DEFAULT 'TURMA', -- 'CURSO', 'DISCIPLINA', 'TURMA', 'GRUPO', 'ALUNO_INDIVIDUAL', 'MISTO'
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (atividade_id) REFERENCES atividades_pbl(id)
);

-- 17. Regras de Segmentação (Inclusões e Exclusões)
CREATE TABLE IF NOT EXISTS segmentacao_regras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  segmentacao_id INTEGER NOT NULL,
  entidade_tipo TEXT NOT NULL, -- 'curso', 'disciplina', 'turma', 'grupo', 'aluno'
  entidade_id INTEGER NOT NULL,
  acao TEXT NOT NULL DEFAULT 'INCLUIR', -- 'INCLUIR' ou 'EXCLUIR'
  FOREIGN KEY (segmentacao_id) REFERENCES segmentacoes(id) ON DELETE CASCADE
);

-- 18. Alunos Segmentados (Tabela Resolvida de Alcance)
CREATE TABLE IF NOT EXISTS alunos_segmentados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  atividade_id INTEGER NOT NULL,
  aluno_id INTEGER NOT NULL,
  calculado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (atividade_id) REFERENCES atividades_pbl(id),
  FOREIGN KEY (aluno_id) REFERENCES usuarios(id),
  UNIQUE(atividade_id, aluno_id)
);

-- 19. Análises Administrativas
CREATE TABLE IF NOT EXISTS analises_administrativas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  atividade_id INTEGER NOT NULL,
  versao_analisada INTEGER NOT NULL,
  analista_id INTEGER NOT NULL,
  decisao TEXT NOT NULL, -- 'APROVADO', 'REPROVADO', 'AJUSTES_SOLICITADOS'
  justificativa TEXT NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (atividade_id) REFERENCES atividades_pbl(id),
  FOREIGN KEY (analista_id) REFERENCES usuarios(id)
);

-- 20. Comentários de Revisão
CREATE TABLE IF NOT EXISTS comentarios_revisao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  atividade_id INTEGER NOT NULL,
  autor_id INTEGER NOT NULL,
  texto TEXT NOT NULL,
  privado_admin INTEGER DEFAULT 0,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (atividade_id) REFERENCES atividades_pbl(id),
  FOREIGN KEY (autor_id) REFERENCES usuarios(id)
);

-- 21. Publicações de Atividades
CREATE TABLE IF NOT EXISTS publicacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  atividade_id INTEGER NOT NULL,
  data_disponibilizacao DATETIME NOT NULL,
  prazo_entrega DATETIME NOT NULL,
  publicado_por INTEGER NOT NULL,
  agendado_para DATETIME DEFAULT NULL,
  status_publicacao TEXT DEFAULT 'PUBLICADO', -- 'AGENDADO', 'PUBLICADO', 'SUSPENSO', 'ENCERRADO'
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (atividade_id) REFERENCES atividades_pbl(id),
  FOREIGN KEY (publicado_por) REFERENCES usuarios(id)
);

-- 22. Entregas dos Alunos
CREATE TABLE IF NOT EXISTS entregas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  publicacao_id INTEGER NOT NULL,
  aluno_id INTEGER NOT NULL,
  grupo_id INTEGER DEFAULT NULL,
  status TEXT DEFAULT 'RASCUNHO', -- 'RASCUNHO', 'ENVIADO', 'ATRASADO'
  conteudo_resposta TEXT,
  data_envio DATETIME DEFAULT NULL,
  comprovante_hash TEXT UNIQUE DEFAULT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (publicacao_id) REFERENCES publicacoes(id),
  FOREIGN KEY (aluno_id) REFERENCES usuarios(id),
  FOREIGN KEY (grupo_id) REFERENCES grupos(id)
);

-- 23. Anexos das Entregas dos Alunos
CREATE TABLE IF NOT EXISTS arquivos_entregas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entrega_id INTEGER NOT NULL,
  arquivo_id INTEGER NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entrega_id) REFERENCES entregas(id),
  FOREIGN KEY (arquivo_id) REFERENCES arquivos(id)
);

-- 24. Feedbacks e Notas das Entregas
CREATE TABLE IF NOT EXISTS feedbacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entrega_id INTEGER NOT NULL,
  avaliador_id INTEGER NOT NULL,
  nota_escrita REAL DEFAULT 0,
  nota_oral REAL DEFAULT 0,
  nota_total REAL DEFAULT 0,
  observacoes TEXT,
  liberado_aluno INTEGER DEFAULT 0,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entrega_id) REFERENCES entregas(id),
  FOREIGN KEY (avaliador_id) REFERENCES usuarios(id)
);

-- 25. Notificações do Sistema
CREATE TABLE IF NOT EXISTS notificacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  link TEXT DEFAULT NULL,
  lida INTEGER DEFAULT 0,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- 26. Log de Auditoria
CREATE TABLE IF NOT EXISTS logs_auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER,
  acao TEXT NOT NULL,
  recurso TEXT NOT NULL,
  recurso_id TEXT,
  detalhes_json TEXT,
  ip_address TEXT DEFAULT '127.0.0.1',
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

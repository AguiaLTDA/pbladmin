-- 1. Perfis de Acesso
CREATE TABLE IF NOT EXISTS perfis (
  id SERIAL PRIMARY KEY,
  nome TEXT UNIQUE NOT NULL, -- 'ADMIN', 'PROFESSOR', 'ALUNO'
  descricao TEXT
);

-- 2. Usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  perfil_id INTEGER NOT NULL,
  ativo INTEGER DEFAULT 1,
  deletado_em TIMESTAMPTZ DEFAULT NULL,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (perfil_id) REFERENCES perfis(id)
);

-- 3. Cursos
CREATE TABLE IF NOT EXISTS cursos (
  id SERIAL PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo INTEGER DEFAULT 1,
  deletado_em TIMESTAMPTZ DEFAULT NULL,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Disciplinas
CREATE TABLE IF NOT EXISTS disciplinas (
  id SERIAL PRIMARY KEY,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  curso_id INTEGER NOT NULL,
  ativo INTEGER DEFAULT 1,
  deletado_em TIMESTAMPTZ DEFAULT NULL,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (curso_id) REFERENCES cursos(id)
);

-- 5. Períodos Letivos
CREATE TABLE IF NOT EXISTS periodos_letivos (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL, -- e.g. "2026/1"
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  ativo INTEGER DEFAULT 1,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. Turmas
-- Turma = coorte do curso num período (ex.: "2º Administração"), não uma disciplina isolada.
-- `disciplina_id` permanece opcional para compatibilidade com turmas legadas de disciplina única.
CREATE TABLE IF NOT EXISTS turmas (
  id SERIAL PRIMARY KEY,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  curso_id INTEGER,
  disciplina_id INTEGER DEFAULT NULL,
  periodo_curso INTEGER DEFAULT NULL, -- 2, 4, 6, 8 ...
  turno TEXT DEFAULT 'NOTURNO',
  periodo_letivo_id INTEGER NOT NULL,
  ativo INTEGER DEFAULT 1,
  deletado_em TIMESTAMPTZ DEFAULT NULL,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (curso_id) REFERENCES cursos(id),
  FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id),
  FOREIGN KEY (periodo_letivo_id) REFERENCES periodos_letivos(id)
);

-- 7. Grupos PBL dentro das turmas
CREATE TABLE IF NOT EXISTS grupos (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  turma_id INTEGER NOT NULL,
  ativo INTEGER DEFAULT 1,
  deletado_em TIMESTAMPTZ DEFAULT NULL,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (turma_id) REFERENCES turmas(id)
);

-- 8. Matrículas de Alunos
CREATE TABLE IF NOT EXISTS matriculas (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL,
  turma_id INTEGER NOT NULL,
  grupo_id INTEGER DEFAULT NULL,
  ativo INTEGER DEFAULT 1,
  deletado_em TIMESTAMPTZ DEFAULT NULL,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (turma_id) REFERENCES turmas(id),
  FOREIGN KEY (grupo_id) REFERENCES grupos(id)
);

-- 9. Vínculos de Professores a Turmas/Disciplinas
-- Origem 'HORARIO' = derivado automaticamente da grade acadêmica; 'MANUAL' = criado pelo admin.
CREATE TABLE IF NOT EXISTS vinculos_professores (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL,
  turma_id INTEGER NOT NULL,
  disciplina_id INTEGER DEFAULT NULL,
  origem TEXT DEFAULT 'MANUAL',
  ativo INTEGER DEFAULT 1,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (turma_id) REFERENCES turmas(id),
  FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id)
);

-- O índice único de vínculos é criado em db/migrate.ts.

-- 9.1 Grade de Horário Acadêmico (fonte do vínculo Professor <-> Turma <-> Disciplina)
CREATE TABLE IF NOT EXISTS horarios_academicos (
  id SERIAL PRIMARY KEY,
  curso_id INTEGER NOT NULL,
  disciplina_id INTEGER NOT NULL,
  professor_id INTEGER NOT NULL,
  periodo_letivo_id INTEGER NOT NULL,
  dia_semana TEXT NOT NULL, -- SEGUNDA, TERCA, QUARTA, QUINTA, SEXTA, CALENDARIO
  hora_inicio TEXT NOT NULL,
  hora_fim TEXT NOT NULL,
  turno TEXT DEFAULT 'NOTURNO',
  modalidade TEXT DEFAULT 'PRESENCIAL', -- PRESENCIAL, EAD
  modulo TEXT,
  local TEXT,
  juncao TEXT,
  ativo INTEGER DEFAULT 1,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (curso_id) REFERENCES cursos(id),
  FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id),
  FOREIGN KEY (professor_id) REFERENCES usuarios(id),
  FOREIGN KEY (periodo_letivo_id) REFERENCES periodos_letivos(id)
);

-- 9.2 Turmas atendidas por cada aula (uma aula em junção atende várias turmas)
CREATE TABLE IF NOT EXISTS horarios_turmas (
  id SERIAL PRIMARY KEY,
  horario_id INTEGER NOT NULL,
  turma_id INTEGER NOT NULL,
  FOREIGN KEY (horario_id) REFERENCES horarios_academicos(id) ON DELETE CASCADE,
  FOREIGN KEY (turma_id) REFERENCES turmas(id),
  UNIQUE(horario_id, turma_id)
);

-- 10. Atividades PBL (Registro Principal)
CREATE TABLE IF NOT EXISTS atividades_pbl (
  id SERIAL PRIMARY KEY,
  codigo_unico TEXT UNIQUE NOT NULL,
  titulo TEXT NOT NULL,
  curso_id INTEGER NOT NULL,
  disciplina_id INTEGER NOT NULL,
  professor_id INTEGER NOT NULL,
  periodo_letivo_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'RASCUNHO',
  -- RASCUNHO, ENVIADO_ANALISE, EM_ANALISE, AJUSTES_SOLICITADOS, REENVIADO, APROVADO, AGENDADO, PUBLICADO, SUSPENSO, ENCERRADO, ARQUIVADO, REPROVADO
  versao_atual INTEGER DEFAULT 1,
  deletado_em TIMESTAMPTZ DEFAULT NULL,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (curso_id) REFERENCES cursos(id),
  FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id),
  FOREIGN KEY (professor_id) REFERENCES usuarios(id),
  FOREIGN KEY (periodo_letivo_id) REFERENCES periodos_letivos(id)
);

-- 11. Versões das Atividades PBL
CREATE TABLE IF NOT EXISTS versoes_atividades (
  id SERIAL PRIMARY KEY,
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
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (atividade_id) REFERENCES atividades_pbl(id),
  FOREIGN KEY (criado_por) REFERENCES usuarios(id)
);

-- 12. Etapas da Atividade PBL
CREATE TABLE IF NOT EXISTS etapas_pbl (
  id SERIAL PRIMARY KEY,
  versao_atividade_id INTEGER NOT NULL,
  ordem INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  obrigatoria INTEGER DEFAULT 1,
  FOREIGN KEY (versao_atividade_id) REFERENCES versoes_atividades(id) ON DELETE CASCADE
);

-- 13. Gerenciador Central de Arquivos
CREATE TABLE IF NOT EXISTS arquivos (
  id SERIAL PRIMARY KEY,
  nome_original TEXT NOT NULL,
  caminho_armazenado TEXT NOT NULL,
  tamanho_bytes INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  categoria TEXT DEFAULT 'OUTROS', -- 'PDF', 'DOCUMENTO', 'PLANILHA', 'APRESENTACAO', 'IMAGEM', 'VIDEO', 'ZIP'
  hash_md5 TEXT,
  enviado_por INTEGER NOT NULL,
  deletado_em TIMESTAMPTZ DEFAULT NULL,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (enviado_por) REFERENCES usuarios(id)
);

-- 14. Anexos das Versões de Atividades
CREATE TABLE IF NOT EXISTS arquivos_atividades (
  id SERIAL PRIMARY KEY,
  versao_atividade_id INTEGER NOT NULL,
  arquivo_id INTEGER NOT NULL,
  aprovado_pelo_admin INTEGER DEFAULT 0,
  versao_material TEXT DEFAULT 'v1',
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (versao_atividade_id) REFERENCES versoes_atividades(id),
  FOREIGN KEY (arquivo_id) REFERENCES arquivos(id)
);

-- 15. Configuração de Campos Obrigatórios do PBL
CREATE TABLE IF NOT EXISTS config_campos_obrigatorios (
  id SERIAL PRIMARY KEY,
  nome_campo TEXT UNIQUE NOT NULL,
  rotulo TEXT NOT NULL,
  obrigatorio INTEGER DEFAULT 1,
  atualizado_por INTEGER,
  atualizado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (atualizado_por) REFERENCES usuarios(id)
);

-- 16. Segmentação de Atividades
CREATE TABLE IF NOT EXISTS segmentacoes (
  id SERIAL PRIMARY KEY,
  atividade_id INTEGER NOT NULL,
  tipo_segmentacao TEXT NOT NULL DEFAULT 'TURMA', -- 'CURSO', 'DISCIPLINA', 'TURMA', 'GRUPO', 'ALUNO_INDIVIDUAL', 'MISTO'
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (atividade_id) REFERENCES atividades_pbl(id)
);

-- 17. Regras de Segmentação (Inclusões e Exclusões)
CREATE TABLE IF NOT EXISTS segmentacao_regras (
  id SERIAL PRIMARY KEY,
  segmentacao_id INTEGER NOT NULL,
  entidade_tipo TEXT NOT NULL, -- 'curso', 'disciplina', 'turma', 'grupo', 'aluno'
  entidade_id INTEGER NOT NULL,
  acao TEXT NOT NULL DEFAULT 'INCLUIR', -- 'INCLUIR' ou 'EXCLUIR'
  FOREIGN KEY (segmentacao_id) REFERENCES segmentacoes(id) ON DELETE CASCADE
);

-- 18. Alunos Segmentados (Tabela Resolvida de Alcance)
CREATE TABLE IF NOT EXISTS alunos_segmentados (
  id SERIAL PRIMARY KEY,
  atividade_id INTEGER NOT NULL,
  aluno_id INTEGER NOT NULL,
  calculado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (atividade_id) REFERENCES atividades_pbl(id),
  FOREIGN KEY (aluno_id) REFERENCES usuarios(id),
  UNIQUE(atividade_id, aluno_id)
);

-- 19. Análises Administrativas
CREATE TABLE IF NOT EXISTS analises_administrativas (
  id SERIAL PRIMARY KEY,
  atividade_id INTEGER NOT NULL,
  versao_analisada INTEGER NOT NULL,
  analista_id INTEGER NOT NULL,
  decisao TEXT NOT NULL, -- 'APROVADO', 'REPROVADO', 'AJUSTES_SOLICITADOS'
  justificativa TEXT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (atividade_id) REFERENCES atividades_pbl(id),
  FOREIGN KEY (analista_id) REFERENCES usuarios(id)
);

-- 20. Comentários de Revisão
CREATE TABLE IF NOT EXISTS comentarios_revisao (
  id SERIAL PRIMARY KEY,
  atividade_id INTEGER NOT NULL,
  autor_id INTEGER NOT NULL,
  texto TEXT NOT NULL,
  privado_admin INTEGER DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (atividade_id) REFERENCES atividades_pbl(id),
  FOREIGN KEY (autor_id) REFERENCES usuarios(id)
);

-- 21. Publicações de Atividades
CREATE TABLE IF NOT EXISTS publicacoes (
  id SERIAL PRIMARY KEY,
  atividade_id INTEGER NOT NULL,
  data_disponibilizacao TIMESTAMPTZ NOT NULL,
  prazo_entrega TIMESTAMPTZ NOT NULL,
  publicado_por INTEGER NOT NULL,
  agendado_para TIMESTAMPTZ DEFAULT NULL,
  status_publicacao TEXT DEFAULT 'PUBLICADO', -- 'AGENDADO', 'PUBLICADO', 'SUSPENSO', 'ENCERRADO'
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (atividade_id) REFERENCES atividades_pbl(id),
  FOREIGN KEY (publicado_por) REFERENCES usuarios(id)
);

-- 22. Entregas dos Alunos
CREATE TABLE IF NOT EXISTS entregas (
  id SERIAL PRIMARY KEY,
  publicacao_id INTEGER NOT NULL,
  aluno_id INTEGER NOT NULL,
  grupo_id INTEGER DEFAULT NULL,
  status TEXT DEFAULT 'RASCUNHO', -- 'RASCUNHO', 'ENVIADO', 'ATRASADO'
  conteudo_resposta TEXT,
  data_envio TIMESTAMPTZ DEFAULT NULL,
  comprovante_hash TEXT UNIQUE DEFAULT NULL,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (publicacao_id) REFERENCES publicacoes(id),
  FOREIGN KEY (aluno_id) REFERENCES usuarios(id),
  FOREIGN KEY (grupo_id) REFERENCES grupos(id)
);

-- 23. Anexos das Entregas dos Alunos
CREATE TABLE IF NOT EXISTS arquivos_entregas (
  id SERIAL PRIMARY KEY,
  entrega_id INTEGER NOT NULL,
  arquivo_id INTEGER NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entrega_id) REFERENCES entregas(id),
  FOREIGN KEY (arquivo_id) REFERENCES arquivos(id)
);

-- 24. Feedbacks e Notas das Entregas
CREATE TABLE IF NOT EXISTS feedbacks (
  id SERIAL PRIMARY KEY,
  entrega_id INTEGER NOT NULL,
  avaliador_id INTEGER NOT NULL,
  nota_escrita DOUBLE PRECISION DEFAULT 0,
  nota_oral DOUBLE PRECISION DEFAULT 0,
  nota_total DOUBLE PRECISION DEFAULT 0,
  observacoes TEXT,
  liberado_aluno INTEGER DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entrega_id) REFERENCES entregas(id),
  FOREIGN KEY (avaliador_id) REFERENCES usuarios(id)
);

-- 25. Notificações do Sistema
CREATE TABLE IF NOT EXISTS notificacoes (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  link TEXT DEFAULT NULL,
  lida INTEGER DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- 26. Log de Auditoria
CREATE TABLE IF NOT EXISTS logs_auditoria (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER,
  acao TEXT NOT NULL,
  recurso TEXT NOT NULL,
  recurso_id TEXT,
  detalhes_json TEXT,
  ip_address TEXT DEFAULT '127.0.0.1',
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

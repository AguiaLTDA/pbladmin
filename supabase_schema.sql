-- ==============================================================================
-- ESQUEMA COMPLETO DA PLATAFORMA PBL - SUPABASE (POSTGRESQL)
-- ==============================================================================

-- 1. Perfis de Acesso
CREATE TABLE IF NOT EXISTS perfis (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome TEXT UNIQUE NOT NULL, -- 'ADMIN', 'PROFESSOR', 'ALUNO'
  descricao TEXT
);

-- 2. Usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  perfil_id BIGINT NOT NULL REFERENCES perfis(id),
  ativo INTEGER DEFAULT 1,
  deletado_em TIMESTAMPTZ DEFAULT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Cursos
CREATE TABLE IF NOT EXISTS cursos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo INTEGER DEFAULT 1,
  deletado_em TIMESTAMPTZ DEFAULT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Disciplinas
CREATE TABLE IF NOT EXISTS disciplinas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  curso_id BIGINT NOT NULL REFERENCES cursos(id),
  ativo INTEGER DEFAULT 1,
  deletado_em TIMESTAMPTZ DEFAULT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Períodos Letivos
CREATE TABLE IF NOT EXISTS periodos_letivos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome TEXT NOT NULL, -- ex: "2026/1"
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  ativo INTEGER DEFAULT 1,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Turmas
CREATE TABLE IF NOT EXISTS turmas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  disciplina_id BIGINT NOT NULL REFERENCES disciplinas(id),
  periodo_letivo_id BIGINT NOT NULL REFERENCES periodos_letivos(id),
  ativo INTEGER DEFAULT 1,
  deletado_em TIMESTAMPTZ DEFAULT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Grupos PBL dentro das turmas
CREATE TABLE IF NOT EXISTS grupos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome TEXT NOT NULL,
  turma_id BIGINT NOT NULL REFERENCES turmas(id),
  ativo INTEGER DEFAULT 1,
  deletado_em TIMESTAMPTZ DEFAULT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Matrículas de Alunos
CREATE TABLE IF NOT EXISTS matriculas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id),
  turma_id BIGINT NOT NULL REFERENCES turmas(id),
  grupo_id BIGINT DEFAULT NULL REFERENCES grupos(id),
  ativo INTEGER DEFAULT 1,
  deletado_em TIMESTAMPTZ DEFAULT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Vínculos de Professores a Turmas
CREATE TABLE IF NOT EXISTS vinculos_professores (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id),
  turma_id BIGINT NOT NULL REFERENCES turmas(id),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Atividades PBL (Registro Principal)
CREATE TABLE IF NOT EXISTS atividades_pbl (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo_unico TEXT UNIQUE NOT NULL,
  titulo TEXT NOT NULL,
  curso_id BIGINT NOT NULL REFERENCES cursos(id),
  disciplina_id BIGINT NOT NULL REFERENCES disciplinas(id),
  professor_id BIGINT NOT NULL REFERENCES usuarios(id),
  periodo_letivo_id BIGINT NOT NULL REFERENCES periodos_letivos(id),
  status TEXT NOT NULL DEFAULT 'RASCUNHO',
  versao_atual INTEGER DEFAULT 1,
  deletado_em TIMESTAMPTZ DEFAULT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Versões das Atividades PBL
CREATE TABLE IF NOT EXISTS versoes_atividades (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  atividade_id BIGINT NOT NULL REFERENCES atividades_pbl(id),
  numero_versao INTEGER NOT NULL,
  contexto_problema TEXT,
  problema_central TEXT,
  objetivos_aprendizagem TEXT,
  competencias_habilidades TEXT,
  conhecimentos_previos TEXT,
  instrucoes_gerais TEXT,
  perguntas_norteadoras TEXT,
  produtos_esperados TEXT,
  forma_realizacao TEXT DEFAULT 'INDIVIDUAL',
  criterios_avaliacao TEXT,
  rubrica_json TEXT,
  carga_horaria_estimada INTEGER DEFAULT 10,
  observacoes_professor TEXT,
  observacoes_internas_admin TEXT,
  criado_por BIGINT NOT NULL REFERENCES usuarios(id),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Etapas da Atividade PBL
CREATE TABLE IF NOT EXISTS etapas_pbl (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  versao_atividade_id BIGINT NOT NULL REFERENCES versoes_atividades(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  obrigatoria INTEGER DEFAULT 1
);

-- 13. Gerenciador Central de Arquivos
CREATE TABLE IF NOT EXISTS arquivos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome_original TEXT NOT NULL,
  caminho_armazenado TEXT NOT NULL,
  tamanho_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  categoria TEXT DEFAULT 'OUTROS',
  hash_md5 TEXT,
  enviado_por BIGINT NOT NULL REFERENCES usuarios(id),
  deletado_em TIMESTAMPTZ DEFAULT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Anexos das Versões de Atividades
CREATE TABLE IF NOT EXISTS arquivos_atividades (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  versao_atividade_id BIGINT NOT NULL REFERENCES versoes_atividades(id),
  arquivo_id BIGINT NOT NULL REFERENCES arquivos(id),
  aprovado_pelo_admin INTEGER DEFAULT 0,
  versao_material TEXT DEFAULT 'v1',
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Configuração de Campos Obrigatórios do PBL
CREATE TABLE IF NOT EXISTS config_campos_obrigatorios (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome_campo TEXT UNIQUE NOT NULL,
  rotulo TEXT NOT NULL,
  obrigatorio INTEGER DEFAULT 1,
  atualizado_por BIGINT REFERENCES usuarios(id),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Segmentação de Atividades
CREATE TABLE IF NOT EXISTS segmentacoes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  atividade_id BIGINT NOT NULL REFERENCES atividades_pbl(id),
  tipo_segmentacao TEXT NOT NULL DEFAULT 'TURMA',
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 17. Regras de Segmentação (Inclusões e Exclusões)
CREATE TABLE IF NOT EXISTS segmentacao_regras (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  segmentacao_id BIGINT NOT NULL REFERENCES segmentacoes(id) ON DELETE CASCADE,
  entidade_tipo TEXT NOT NULL,
  entidade_id BIGINT NOT NULL,
  acao TEXT NOT NULL DEFAULT 'INCLUIR'
);

-- 18. Alunos Segmentados (Tabela Resolvida de Alcance)
CREATE TABLE IF NOT EXISTS alunos_segmentados (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  atividade_id BIGINT NOT NULL REFERENCES atividades_pbl(id),
  aluno_id BIGINT NOT NULL REFERENCES usuarios(id),
  calculado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(atividade_id, aluno_id)
);

-- 19. Análises Administrativas
CREATE TABLE IF NOT EXISTS analises_administrativas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  atividade_id BIGINT NOT NULL REFERENCES atividades_pbl(id),
  versao_analisada INTEGER NOT NULL,
  analista_id BIGINT NOT NULL REFERENCES usuarios(id),
  decisao TEXT NOT NULL,
  justificativa TEXT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 20. Comentários de Revisão
CREATE TABLE IF NOT EXISTS comentarios_revisao (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  atividade_id BIGINT NOT NULL REFERENCES atividades_pbl(id),
  autor_id BIGINT NOT NULL REFERENCES usuarios(id),
  texto TEXT NOT NULL,
  privado_admin INTEGER DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 21. Publicações de Atividades
CREATE TABLE IF NOT EXISTS publicacoes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  atividade_id BIGINT NOT NULL REFERENCES atividades_pbl(id),
  data_disponibilizacao TIMESTAMPTZ NOT NULL,
  prazo_entrega TIMESTAMPTZ NOT NULL,
  publicado_por BIGINT NOT NULL REFERENCES usuarios(id),
  agendado_para TIMESTAMPTZ DEFAULT NULL,
  status_publicacao TEXT DEFAULT 'PUBLICADO',
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 22. Entregas dos Alunos
CREATE TABLE IF NOT EXISTS entregas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  publicacao_id BIGINT NOT NULL REFERENCES publicacoes(id),
  aluno_id BIGINT NOT NULL REFERENCES usuarios(id),
  grupo_id BIGINT DEFAULT NULL REFERENCES grupos(id),
  status TEXT DEFAULT 'RASCUNHO',
  conteudo_resposta TEXT,
  data_envio TIMESTAMPTZ DEFAULT NULL,
  comprovante_hash TEXT UNIQUE DEFAULT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 23. Anexos das Entregas dos Alunos
CREATE TABLE IF NOT EXISTS arquivos_entregas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entrega_id BIGINT NOT NULL REFERENCES entregas(id),
  arquivo_id BIGINT NOT NULL REFERENCES arquivos(id),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 24. Feedbacks e Notas das Entregas
CREATE TABLE IF NOT EXISTS feedbacks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entrega_id BIGINT NOT NULL REFERENCES entregas(id),
  avaliador_id BIGINT NOT NULL REFERENCES usuarios(id),
  nota_escrita DOUBLE PRECISION DEFAULT 0,
  nota_oral DOUBLE PRECISION DEFAULT 0,
  nota_total DOUBLE PRECISION DEFAULT 0,
  observacoes TEXT,
  liberado_aluno INTEGER DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 25. Notificações do Sistema
CREATE TABLE IF NOT EXISTS notificacoes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id),
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  link TEXT DEFAULT NULL,
  lida INTEGER DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 26. Log de Auditoria
CREATE TABLE IF NOT EXISTS logs_auditoria (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id BIGINT REFERENCES usuarios(id),
  acao TEXT NOT NULL,
  recurso TEXT NOT NULL,
  recurso_id TEXT,
  detalhes_json TEXT,
  ip_address TEXT DEFAULT '127.0.0.1',
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- CRIAR BUCKET DE STORAGE NO SUPABASE (pbl-files)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('pbl-files', 'pbl-files', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Acesso Público para Storage Bucket
CREATE POLICY "Leitura Publica PBL Files" ON storage.objects FOR SELECT USING (bucket_id = 'pbl-files');
CREATE POLICY "Upload Publico PBL Files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'pbl-files');
CREATE POLICY "Update Publico PBL Files" ON storage.objects FOR UPDATE WITH CHECK (bucket_id = 'pbl-files');
CREATE POLICY "Delete Publico PBL Files" ON storage.objects FOR DELETE USING (bucket_id = 'pbl-files');

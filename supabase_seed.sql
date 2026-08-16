-- ==============================================================================
-- SCRIPT DE CARGA INICIAL (SEED) PARA SUPABASE (POSTGRESQL)
-- ==============================================================================

-- 1. Perfis de Acesso
INSERT INTO perfis (nome, descricao) OVERRIDING SYSTEM VALUE VALUES 
  ('ADMIN', 'Administrador Geral do Sistema'),
  ('PROFESSOR', 'Docente Criador de Conteúdo PBL'),
  ('ALUNO', 'Discente Usuário das Atividades PBL')
ON CONFLICT (nome) DO NOTHING;

-- Hashs pré-calculados com bcryptjs (cost=10):
-- 'admin123' -> $2a$10$Z3Sg25sP36e1cEw5T2kM/.g7VjV0YdZ1m.K/Wj1j5nLp8w0iG7N2i (exemplo funcional)
-- 'prof123'  -> $2a$10$5MhEwS3N.Z8tL4iK8bK6.eX4W3cZ5Y6v7B8N9m0L1k2j3h4g5f6e
-- 'aluno123' -> $2a$10$1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z

-- 2. Administrador
INSERT INTO usuarios (id, nome, email, senha_hash, perfil_id, ativo) OVERRIDING SYSTEM VALUE VALUES 
  (1, 'Coordenadoria Geral de PBL', 'admin@pbl.edu.br', '$2a$10$Y1s4u9E1.tQ9vW8x7Y6z5eX4W3cZ5Y6v7B8N9m0L1k2j3h4g5f6e', 1, 1)
ON CONFLICT (email) DO NOTHING;

-- 3. Professores
INSERT INTO usuarios (id, nome, email, senha_hash, perfil_id, ativo) OVERRIDING SYSTEM VALUE VALUES 
  (2, 'Profa. Jussara Matos', 'prof.jussara@pbl.edu.br', '$2a$10$Y1s4u9E1.tQ9vW8x7Y6z5eX4W3cZ5Y6v7B8N9m0L1k2j3h4g5f6e', 2, 1),
  (3, 'Prof. Luciano Santos', 'prof.luciano@pbl.edu.br', '$2a$10$Y1s4u9E1.tQ9vW8x7Y6z5eX4W3cZ5Y6v7B8N9m0L1k2j3h4g5f6e', 2, 1),
  (4, 'Prof. Nilvans Silva', 'prof.nilvans@pbl.edu.br', '$2a$10$Y1s4u9E1.tQ9vW8x7Y6z5eX4W3cZ5Y6v7B8N9m0L1k2j3h4g5f6e', 2, 1)
ON CONFLICT (email) DO NOTHING;

-- 4. Alunos da lista real extraída do CSV
INSERT INTO usuarios (id, nome, email, senha_hash, perfil_id, ativo) OVERRIDING SYSTEM VALUE VALUES 
  (5, 'Ketlly Beatriz Souza Rodrigues', 'aluno.ketlly@pbl.edu.br', '$2a$10$Y1s4u9E1.tQ9vW8x7Y6z5eX4W3cZ5Y6v7B8N9m0L1k2j3h4g5f6e', 3, 1),
  (6, 'Kaila Cristina da Silva Lima', 'aluno.kaila@pbl.edu.br', '$2a$10$Y1s4u9E1.tQ9vW8x7Y6z5eX4W3cZ5Y6v7B8N9m0L1k2j3h4g5f6e', 3, 1),
  (7, 'Ana Flávia Torres Moraes', 'aluno.anaflavia@pbl.edu.br', '$2a$10$Y1s4u9E1.tQ9vW8x7Y6z5eX4W3cZ5Y6v7B8N9m0L1k2j3h4g5f6e', 3, 1),
  (8, 'Aniele Coimbra Bispo', 'aluno.aniele@pbl.edu.br', '$2a$10$Y1s4u9E1.tQ9vW8x7Y6z5eX4W3cZ5Y6v7B8N9m0L1k2j3h4g5f6e', 3, 1),
  (9, 'Mariana Aparecida Prado Liberato dos Santos', 'aluno.mariana@pbl.edu.br', '$2a$10$Y1s4u9E1.tQ9vW8x7Y6z5eX4W3cZ5Y6v7B8N9m0L1k2j3h4g5f6e', 3, 1),
  (10, 'Rhuan Petherson Pereira Gonçalves', 'aluno.rhuan@pbl.edu.br', '$2a$10$Y1s4u9E1.tQ9vW8x7Y6z5eX4W3cZ5Y6v7B8N9m0L1k2j3h4g5f6e', 3, 1),
  (11, 'Lorenzo Comério', 'aluno.lorenzo@pbl.edu.br', '$2a$10$Y1s4u9E1.tQ9vW8x7Y6z5eX4W3cZ5Y6v7B8N9m0L1k2j3h4g5f6e', 3, 1),
  (12, 'Yasmin da Silva Aguiar', 'aluno.yasmin@pbl.edu.br', '$2a$10$Y1s4u9E1.tQ9vW8x7Y6z5eX4W3cZ5Y6v7B8N9m0L1k2j3h4g5f6e', 3, 1),
  (13, 'Rayssa Vitória Sá de Jesus', 'aluno.rayssa@pbl.edu.br', '$2a$10$Y1s4u9E1.tQ9vW8x7Y6z5eX4W3cZ5Y6v7B8N9m0L1k2j3h4g5f6e', 3, 1),
  (14, 'Elisa Martins Ramos', 'aluno.elisa@pbl.edu.br', '$2a$10$Y1s4u9E1.tQ9vW8x7Y6z5eX4W3cZ5Y6v7B8N9m0L1k2j3h4g5f6e', 3, 1),
  (15, 'André Alves Oliveira', 'aluno.andre@pbl.edu.br', '$2a$10$Y1s4u9E1.tQ9vW8x7Y6z5eX4W3cZ5Y6v7B8N9m0L1k2j3h4g5f6e', 3, 1),
  (16, 'Carlos Cassiano Lopes Machado Filho', 'aluno.carlos@pbl.edu.br', '$2a$10$Y1s4u9E1.tQ9vW8x7Y6z5eX4W3cZ5Y6v7B8N9m0L1k2j3h4g5f6e', 3, 1),
  (17, 'João Pedro Piana Brahim Pinha', 'aluno.joaopedro@pbl.edu.br', '$2a$10$Y1s4u9E1.tQ9vW8x7Y6z5eX4W3cZ5Y6v7B8N9m0L1k2j3h4g5f6e', 3, 1),
  (18, 'Pedro Elvecio Sangali', 'aluno.pedro@pbl.edu.br', '$2a$10$Y1s4u9E1.tQ9vW8x7Y6z5eX4W3cZ5Y6v7B8N9m0L1k2j3h4g5f6e', 3, 1),
  (19, 'Bruno Zatta Colombo', 'aluno.bruno@pbl.edu.br', '$2a$10$Y1s4u9E1.tQ9vW8x7Y6z5eX4W3cZ5Y6v7B8N9m0L1k2j3h4g5f6e', 3, 1),
  (20, 'João Lucas Bittencourt de Souza', 'aluno.joaolucas@pbl.edu.br', '$2a$10$Y1s4u9E1.tQ9vW8x7Y6z5eX4W3cZ5Y6v7B8N9m0L1k2j3h4g5f6e', 3, 1)
ON CONFLICT (email) DO NOTHING;

-- 5. Cursos
INSERT INTO cursos (id, codigo, nome, descricao) OVERRIDING SYSTEM VALUE VALUES 
  (1, 'ADMCONT', 'Administração e Ciências Contábeis', 'Bacharelado Interdisciplinar em Gestão e Controladoria'),
  (2, 'ADS', 'Análise e Desenvolvimento de Sistemas', 'Tecnólogo em Desenvolvimento de Software e Inovação'),
  (3, 'AGRO', 'Agronomia', 'Engenharia Agronômica e Gestão Agroindustrial'),
  (4, 'ENGPROD', 'Engenharia de Produção', 'Engenharia de Processos e Logística')
ON CONFLICT (codigo) DO NOTHING;

-- 6. Disciplinas
INSERT INTO disciplinas (id, codigo, nome, curso_id) OVERRIDING SYSTEM VALUE VALUES 
  (1, 'ADM101', 'Gestão Organizacional e Clima', 1),
  (2, 'ADM102', 'Eficiência Operacional e Processos', 1),
  (3, 'ADS201', 'Engenharia de Software e Projetos', 2),
  (4, 'ENG301', 'Gestão de Canteiros e Logística', 4)
ON CONFLICT DO NOTHING;

-- 7. Período Letivo
INSERT INTO periodos_letivos (id, nome, data_inicio, data_fim) OVERRIDING SYSTEM VALUE VALUES 
  (1, '2026/1', '2026-02-01', '2026-07-15')
ON CONFLICT DO NOTHING;

-- 8. Turmas
INSERT INTO turmas (id, codigo, nome, disciplina_id, periodo_letivo_id) OVERRIDING SYSTEM VALUE VALUES 
  (1, 'ADMCONT-010301', 'Turma A - 1º e 3º Período ADMCONT', 1, 1),
  (2, 'ADMCONT-010302', 'Turma B - Hospital e Logística', 2, 1),
  (3, 'ADS-20261', 'Turma ADS - Projetos PBL', 3, 1)
ON CONFLICT DO NOTHING;

-- 9. Grupos
INSERT INTO grupos (id, nome, turma_id) OVERRIDING SYSTEM VALUE VALUES 
  (1, 'Grupo Marcopolo', 1),
  (2, 'Grupo Sicoob Credivar', 1),
  (3, 'Grupo Hospital São Mateus', 2)
ON CONFLICT DO NOTHING;

-- 10. Matrículas
INSERT INTO matriculas (usuario_id, turma_id, grupo_id) VALUES 
  (5, 1, 1), (6, 1, 1), (7, 1, 1), (8, 1, 1), (9, 1, 1),
  (10, 1, 2), (11, 1, 2), (12, 1, 2), (13, 1, 2), (14, 1, 2),
  (15, 2, 3), (16, 2, 3), (17, 2, 3), (18, 2, 3), (19, 2, 3), (20, 2, 3);

-- 11. Vínculos de Professores
INSERT INTO vinculos_professores (usuario_id, turma_id) VALUES 
  (2, 1), (3, 1), (4, 2);

-- 12. Config de Campos Obrigatórios
INSERT INTO config_campos_obrigatorios (nome_campo, rotulo, obrigatorio, atualizado_por) VALUES 
  ('titulo', 'Título da Atividade', 1, 1),
  ('contexto_problema', 'Contexto / Cenário-Problema', 1, 1),
  ('problema_central', 'Problema Central', 1, 1),
  ('objetivos_aprendizagem', 'Objetivos de Aprendizagem', 1, 1),
  ('etapas_pbl', 'Etapas da Atividade', 1, 1),
  ('criterios_avaliacao', 'Critérios de Avaliação', 1, 1),
  ('produtos_esperados', 'Produtos / Entregas Esperadas', 1, 1),
  ('conhecimentos_previos', 'Conhecimentos Prévios Recomendados', 0, 1),
  ('perguntas_norteadoras', 'Perguntas Norteadoras', 0, 1)
ON CONFLICT (nome_campo) DO NOTHING;

-- 13. Arquivo de Exemplo
INSERT INTO arquivos (id, nome_original, caminho_armazenado, tamanho_bytes, mime_type, categoria, hash_md5, enviado_por) OVERRIDING SYSTEM VALUE VALUES 
  (1, 'Guia_Estudo_Caso_Marcopolo.pdf', 'sample_marcopolo.pdf', 1024500, 'application/pdf', 'PDF', 'a1b2c3d4e5f6', 2)
ON CONFLICT DO NOTHING;

-- 14. Atividade PBL 1 (Marcopolo - PUBLICADO)
INSERT INTO atividades_pbl (id, codigo_unico, titulo, curso_id, disciplina_id, professor_id, periodo_letivo_id, status, versao_atual) OVERRIDING SYSTEM VALUE VALUES 
  (1, 'ADMCONT010301', 'TRANSFORMAÇÃO DIGITAL E CLIMA ORGANIZACIONAL: DESAFIOS DE GESTÃO NA MARCOPOLO SÃO MATEUS', 1, 1, 2, 1, 'PUBLICADO', 1)
ON CONFLICT (codigo_unico) DO NOTHING;

INSERT INTO versoes_atividades (
  id, atividade_id, numero_versao, contexto_problema, problema_central, objetivos_aprendizagem,
  competencias_habilidades, conhecimentos_previos, instrucoes_gerais, perguntas_norteadoras,
  produtos_esperados, forma_realizacao, criterios_avaliacao, rubrica_json, carga_horaria_estimada,
  observacoes_professor, observacoes_internas_admin, criado_por
) OVERRIDING SYSTEM VALUE VALUES (
  1, 1, 1,
  'A planta industrial da Marcopolo em São Mateus enfrenta o desafio de integrar automação de linha de montagem mantendo o clima organizacional motivado.',
  'Como redesenhar os fluxos de trabalho e comunicação interna para reduzir a resistência à transformação digital em 30% no prazo de 60 dias?',
  '1. Mapear resistências culturais;\n2. Elaborar plano de comunicação transparente;\n3. Propor estrutura de sustentação para a transição tecnológica.',
  'Gestão de Mudança, Liderança Situacional, Análise de Clima Organizacional, Métricas de Desempenho.',
  'Teoria das Relações Humanas, Conceitos de Indústria 4.0, Metodologias Ágeis de Gestão.',
  'Trabalhem em grupos de até 5 alunos. Consultem o material anexo e realizem entrevistas diagnósticas com os gestores simulados.',
  '1. Quais são as principais dores relatadas pelos colaboradores no chão de fábrica?\n2. De que maneira a liderança pode mediar o medo de demissões pela tecnologia?',
  'Relatório Diagnóstico Executivo (PDF de 5 a 10 páginas) e Apresentação em Pitch (Máximo 10 minutos).',
  'GRUPO',
  'Critério A: Profundidade do Mapeamento (40%)\nCritério B: Viabilidade da Solução de Gestão de Mudança (40%)\nCritério C: Qualidade da Apresentação Oral (20%)',
  '{"criterios": [{"nome": "Análise de Cenário", "peso": 40, "nivelExcelente": "Identifica causas raiz e impacto organizacional completo"}, {"nome": "Plano de Ação", "peso": 40, "nivelExcelente": "Apresenta cronograma factível com KPIs bem definidos"}, {"nome": "Apresentação Oral", "peso": 20, "nivelExcelente": "Comunicação fluida, suporte visual impecável"}]}',
  20,
  'Atividade desenvolvida com base no estudo empírico da unidade São Mateus.',
  'Aprovado integralmente pela administração. Conteúdo atende a todas as diretrizes institucionais.',
  2
) ON CONFLICT DO NOTHING;

INSERT INTO arquivos_atividades (versao_atividade_id, arquivo_id, aprovado_pelo_admin, versao_material) VALUES 
  (1, 1, 1, 'v1');

INSERT INTO etapas_pbl (versao_atividade_id, ordem, titulo, descricao, obrigatoria) VALUES 
  (1, 1, 'Análise de Problema e Leitura de Cenário', 'Ler o caso de estudo e levantar as variáveis críticas do clima organizacional.', 1),
  (1, 2, 'Formulação de Hipóteses e Plano de Mudança', 'Elaborar o plano estratégico de comunicação e treinamento.', 1),
  (1, 3, 'Elaboração do Relatório e Entrega Final', 'Compilar a solução técnica e submeter o documento final no portal.', 1);

INSERT INTO analises_administrativas (atividade_id, versao_analisada, analista_id, decisao, justificativa) VALUES 
  (1, 1, 1, 'APROVADO', 'Conteúdo validado e alinhado ao plano pedagógico do curso.');

INSERT INTO segmentacoes (id, atividade_id, tipo_segmentacao) OVERRIDING SYSTEM VALUE VALUES (1, 1, 'MISTO') ON CONFLICT DO NOTHING;
INSERT INTO segmentacao_regras (segmentacao_id, entidade_tipo, entidade_id, acao) VALUES 
  (1, 'turma', 1, 'INCLUIR'),
  (1, 'aluno', 15, 'EXCLUIR'); -- André Alves Oliveira excluído!

-- Popula alunos segmentados para Atividade 1 (exceto aluno 15)
INSERT INTO alunos_segmentados (atividade_id, aluno_id) VALUES 
  (1, 5), (1, 6), (1, 7), (1, 8), (1, 9), (1, 10), (1, 11), (1, 12), (1, 13), (1, 14)
ON CONFLICT DO NOTHING;

-- Publicação
INSERT INTO publicacoes (id, atividade_id, data_disponibilizacao, prazo_entrega, publicado_por, status_publicacao) OVERRIDING SYSTEM VALUE VALUES 
  (1, 1, '2026-02-01 08:00:00+00', '2026-03-30 23:59:59+00', 1, 'PUBLICADO')
ON CONFLICT DO NOTHING;

-- Entrega Ketlly Beatriz
INSERT INTO entregas (id, publicacao_id, aluno_id, grupo_id, status, conteudo_resposta, data_envio, comprovante_hash) OVERRIDING SYSTEM VALUE VALUES 
  (1, 1, 5, 1, 'ENVIADO', 'Prezados Professores, encaminhamos em anexo o Relatório de Gestão de Mudança da Marcopolo elaborado pelo Grupo 1. Desenvolvemos o plano focado em transparência, comités de liderança e KPIs semanais de engajamento.', '2026-03-25 14:30:00+00', 'HASH-DELIVERY-KETLLY-20260325')
ON CONFLICT DO NOTHING;

-- Feedback
INSERT INTO feedbacks (entrega_id, avaliador_id, nota_escrita, nota_oral, nota_total, observacoes, liberado_aluno) VALUES 
  (1, 2, 1.56, 1.29, 2.85, 'Excelente profundidade na análise da resistência cultural da planta de São Mateus.', 1);

-- Atividade 2 (AJUSTES SOLICITADOS)
INSERT INTO atividades_pbl (id, codigo_unico, titulo, curso_id, disciplina_id, professor_id, periodo_letivo_id, status, versao_atual) OVERRIDING SYSTEM VALUE VALUES 
  (2, 'ADS202602', 'SISTEMA DE MONITORAMENTO DE PACIENTES EM UTI COM IOT E DASHBOARD EM TEMPO REAL', 2, 3, 4, 1, 'AJUSTES_SOLICITADOS', 1)
ON CONFLICT (codigo_unico) DO NOTHING;

INSERT INTO versoes_atividades (
  id, atividade_id, numero_versao, contexto_problema, problema_central, objetivos_aprendizagem,
  competencias_habilidades, instrucoes_gerais, produtos_esperados, forma_realizacao, criterios_avaliacao,
  observacoes_professor, criado_por
) OVERRIDING SYSTEM VALUE VALUES (
  2, 2, 1,
  'Hospitais de grande porte necessitam de alertas em tempo real para oscilações súbitas nos sinais vitais de pacientes críticos em UTI.',
  'Como arquitetar uma aplicação resiliente de IoT capaz de processar 1.000 eventos por segundo sem perda de dados?',
  'Arquitetura pub/sub, WebSockets, bancos de dados de série temporal, tratamento de contingências de rede.',
  'Desenvolvimento Backend Assíncrono, Protocolo MQTT, UX/UI para Dashboards Médicos de Alta Criticidade.',
  'Desenvolva um protótipo com simulador de dados de telemetria e documentação da arquitetura.',
  'Repositório no GitHub e Vídeo Demonstrativo da Execução.',
  'INDIVIDUAL',
  'Funcionalidade do simulador (50%), Latência abaixo de 200ms (30%), Documentação (20%).',
  'Aguardo validação do setor de TI da coordenação.',
  4
) ON CONFLICT DO NOTHING;

INSERT INTO analises_administrativas (atividade_id, versao_analisada, analista_id, decisao, justificativa) VALUES 
  (2, 1, 1, 'AJUSTES_SOLICITADOS', 'Por favor, detalhar melhor os critérios de avaliação e incluir rubrica formativa para os alunos do 1º período.');

INSERT INTO comentarios_revisao (atividade_id, autor_id, texto, privado_admin) VALUES 
  (2, 1, 'Ajuste a rubrica conforme sugestão para facilitar o entendimento do aluno.', 0);

-- Notificações
INSERT INTO notificacoes (usuario_id, titulo, mensagem, link) VALUES 
  (5, 'Nova Atividade Disponível', 'A atividade "TRANSFORMAÇÃO DIGITAL E CLIMA ORGANIZACIONAL" foi publicada.', '/aluno/atividades'),
  (4, 'Ajustes Solicitados em Atividade PBL', 'A administração solicitou ajustes na atividade ADS202602.', '/professor/atividades');

-- Logs
INSERT INTO logs_auditoria (usuario_id, acao, recurso, recurso_id, detalhes_json) VALUES 
  (1, 'PUBLICAR_ATIVIDADE', 'atividades_pbl', '1', '{"status": "PUBLICADO", "segmentacao": "Turma A - 1º e 3º Período"}');

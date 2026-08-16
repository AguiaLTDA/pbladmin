import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { db, execAsync, runAsync, getAsync } from '../config/db';

export async function initAndSeedDb() {
  console.log('--- Starting Database Initialization & Seeding ---');

  // Read schema.sql from src or dist directory
  let schemaPath = path.resolve(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    schemaPath = path.resolve(__dirname, '../../src/db/schema.sql');
  }
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  // Execute schema DDL
  await execAsync(schemaSql);
  console.log('Schema DDL executed successfully.');

  // Check if users already exist
  const existingUser = await getAsync<{ count: number }>('SELECT COUNT(*) as count FROM usuarios');
  if (existingUser && existingUser.count > 0) {
    console.log('Database already contains seed data. Skipping seed step.');
    return;
  }

  // 1. Seed Perfis
  await runAsync(`INSERT INTO perfis (id, nome, descricao) VALUES 
    (1, 'ADMIN', 'Administrador Geral do Sistema'),
    (2, 'PROFESSOR', 'Docente Criador de Conteúdo PBL'),
    (3, 'ALUNO', 'Discente Usuário das Atividades PBL')`);

  const passwordHashAdmin = await bcrypt.hash('admin123', 10);
  const passwordHashProf = await bcrypt.hash('prof123', 10);
  const passwordHashAluno = await bcrypt.hash('aluno123', 10);

  // 2. Seed Admin
  const adminResult = await runAsync(
    `INSERT INTO usuarios (nome, email, senha_hash, perfil_id, ativo) VALUES (?, ?, ?, ?, 1)`,
    ['Coordenadoria Geral de PBL', 'admin@pbl.edu.br', passwordHashAdmin, 1]
  );
  const adminId = adminResult.lastID;

  // 3. Seed Professors
  const profJussara = await runAsync(
    `INSERT INTO usuarios (nome, email, senha_hash, perfil_id, ativo) VALUES (?, ?, ?, ?, 1)`,
    ['Profa. Jussara Matos', 'prof.jussara@pbl.edu.br', passwordHashProf, 2]
  );
  const profLuciano = await runAsync(
    `INSERT INTO usuarios (nome, email, senha_hash, perfil_id, ativo) VALUES (?, ?, ?, ?, 1)`,
    ['Prof. Luciano Santos', 'prof.luciano@pbl.edu.br', passwordHashProf, 2]
  );
  const profNilvans = await runAsync(
    `INSERT INTO usuarios (nome, email, senha_hash, perfil_id, ativo) VALUES (?, ?, ?, ?, 1)`,
    ['Prof. Nilvans Silva', 'prof.nilvans@pbl.edu.br', passwordHashProf, 2]
  );

  // 4. Seed 20 Students from CSV real data
  const rawStudents = [
    { nome: 'Ketlly Beatriz Souza Rodrigues', email: 'aluno.ketlly@pbl.edu.br' },
    { nome: 'Kaila Cristina da Silva Lima', email: 'aluno.kaila@pbl.edu.br' },
    { nome: 'Ana Flávia Torres Moraes', email: 'aluno.anaflavia@pbl.edu.br' },
    { nome: 'Aniele Coimbra Bispo', email: 'aluno.aniele@pbl.edu.br' },
    { nome: 'Mariana Aparecida Prado Liberato dos Santos', email: 'aluno.mariana@pbl.edu.br' },
    { nome: 'Rhuan Petherson Pereira Gonçalves', email: 'aluno.rhuan@pbl.edu.br' },
    { nome: 'Lorenzo Comério', email: 'aluno.lorenzo@pbl.edu.br' },
    { nome: 'Yasmin da Silva Aguiar', email: 'aluno.yasmin@pbl.edu.br' },
    { nome: 'Rayssa Vitória Sá de Jesus', email: 'aluno.rayssa@pbl.edu.br' },
    { nome: 'Elisa Martins Ramos', email: 'aluno.elisa@pbl.edu.br' },
    { nome: 'André Alves Oliveira', email: 'aluno.andre@pbl.edu.br' },
    { nome: 'Carlos Cassiano Lopes Machado Filho', email: 'aluno.carlos@pbl.edu.br' },
    { nome: 'João Pedro Piana Brahim Pinha', email: 'aluno.joaopedro@pbl.edu.br' },
    { nome: 'Pedro Elvecio Sangali', email: 'aluno.pedro@pbl.edu.br' },
    { nome: 'Bruno Zatta Colombo', email: 'aluno.bruno@pbl.edu.br' },
    { nome: 'João Lucas Bittencourt de Souza', email: 'aluno.joaolucas@pbl.edu.br' },
    { nome: 'Samara Teixeira dos Santos', email: 'aluno.samara@pbl.edu.br' },
    { nome: 'Maria Eduarda Luns Souza', email: 'aluno.mariaeduarda@pbl.edu.br' },
    { nome: 'Clarise dos Santos Alves', email: 'aluno.clarise@pbl.edu.br' },
    { nome: 'Raquel Lima de Souza', email: 'aluno.raquel@pbl.edu.br' }
  ];

  const studentIds: number[] = [];
  for (const s of rawStudents) {
    const res = await runAsync(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil_id, ativo) VALUES (?, ?, ?, 3, 1)`,
      [s.nome, s.email, passwordHashAluno]
    );
    studentIds.push(res.lastID);
  }

  // 5. Seed Cursos
  const c1 = await runAsync(
    `INSERT INTO cursos (codigo, nome, descricao) VALUES ('ADMCONT', 'Administração e Ciências Contábeis', 'Bacharelado Interdisciplinar em Gestão e Controladoria')`
  );
  const c2 = await runAsync(
    `INSERT INTO cursos (codigo, nome, descricao) VALUES ('ADS', 'Análise e Desenvolvimento de Sistemas', 'Tecnólogo em Desenvolvimento de Software e Inovação')`
  );
  const c3 = await runAsync(
    `INSERT INTO cursos (codigo, nome, descricao) VALUES ('AGRO', 'Agronomia', 'Engenharia Agronômica e Gestão Agroindustrial')`
  );
  const c4 = await runAsync(
    `INSERT INTO cursos (codigo, nome, descricao) VALUES ('ENGPROD', 'Engenharia de Produção', 'Engenharia de Processos e Logística')`
  );

  // 6. Seed Disciplinas
  const d1 = await runAsync(
    `INSERT INTO disciplinas (codigo, nome, curso_id) VALUES ('ADM101', 'Gestão Organizacional e Clima', ?)`,
    [c1.lastID]
  );
  const d2 = await runAsync(
    `INSERT INTO disciplinas (codigo, nome, curso_id) VALUES ('ADM102', 'Eficiência Operacional e Processos', ?)`,
    [c1.lastID]
  );
  const d3 = await runAsync(
    `INSERT INTO disciplinas (codigo, nome, curso_id) VALUES ('ADS201', 'Engenharia de Software e Projetos', ?)`,
    [c2.lastID]
  );
  const d4 = await runAsync(
    `INSERT INTO disciplinas (codigo, nome, curso_id) VALUES ('ENG301', 'Gestão de Canteiros e Logística', ?)`,
    [c4.lastID]
  );

  // 7. Seed Período Letivo
  const p1 = await runAsync(
    `INSERT INTO periodos_letivos (nome, data_inicio, data_fim) VALUES ('2026/1', '2026-02-01', '2026-07-15')`
  );

  // 8. Seed Turmas
  const t1 = await runAsync(
    `INSERT INTO turmas (codigo, nome, disciplina_id, periodo_letivo_id) VALUES ('ADMCONT-010301', 'Turma A - 1º e 3º Período ADMCONT', ?, ?)`,
    [d1.lastID, p1.lastID]
  );
  const t2 = await runAsync(
    `INSERT INTO turmas (codigo, nome, disciplina_id, periodo_letivo_id) VALUES ('ADMCONT-010302', 'Turma B - Hospital e Logística', ?, ?)`,
    [d2.lastID, p1.lastID]
  );
  const t3 = await runAsync(
    `INSERT INTO turmas (codigo, nome, disciplina_id, periodo_letivo_id) VALUES ('ADS-20261', 'Turma ADS - Projetos PBL', ?, ?)`,
    [d3.lastID, p1.lastID]
  );

  // 9. Seed Grupos
  const g1 = await runAsync(`INSERT INTO grupos (nome, turma_id) VALUES ('Grupo Marcopolo', ?)`, [t1.lastID]);
  const g2 = await runAsync(`INSERT INTO grupos (nome, turma_id) VALUES ('Grupo Sicoob Credivar', ?)`, [t1.lastID]);
  const g3 = await runAsync(`INSERT INTO grupos (nome, turma_id) VALUES ('Grupo Hospital São Mateus', ?)`, [t2.lastID]);

  // 10. Seed Matrículas (distribute students into classes and groups)
  for (let i = 0; i < studentIds.length; i++) {
    const sId = studentIds[i];
    if (i < 10) {
      const grupoId = i < 5 ? g1.lastID : g2.lastID;
      await runAsync(`INSERT INTO matriculas (usuario_id, turma_id, grupo_id) VALUES (?, ?, ?)`, [
        sId,
        t1.lastID,
        grupoId
      ]);
    } else {
      await runAsync(`INSERT INTO matriculas (usuario_id, turma_id, grupo_id) VALUES (?, ?, ?)`, [
        sId,
        t2.lastID,
        g3.lastID
      ]);
    }
  }

  // 11. Seed Professor Bindings
  await runAsync(`INSERT INTO vinculos_professores (usuario_id, turma_id) VALUES (?, ?)`, [profJussara.lastID, t1.lastID]);
  await runAsync(`INSERT INTO vinculos_professores (usuario_id, turma_id) VALUES (?, ?)`, [profLuciano.lastID, t1.lastID]);
  await runAsync(`INSERT INTO vinculos_professores (usuario_id, turma_id) VALUES (?, ?)`, [profNilvans.lastID, t2.lastID]);

  // 12. Seed Config Mandatory Fields
  const camposObrigatorios = [
    { campo: 'titulo', rotulo: 'Título da Atividade', obrigatorio: 1 },
    { campo: 'contexto_problema', rotulo: 'Contexto / Cenário-Problema', obrigatorio: 1 },
    { campo: 'problema_central', rotulo: 'Problema Central', obrigatorio: 1 },
    { campo: 'objetivos_aprendizagem', rotulo: 'Objetivos de Aprendizagem', obrigatorio: 1 },
    { campo: 'etapas_pbl', rotulo: 'Etapas da Atividade', obrigatorio: 1 },
    { campo: 'criterios_avaliacao', rotulo: 'Critérios de Avaliação', obrigatorio: 1 },
    { campo: 'produtos_esperados', rotulo: 'Produtos / Entregas Esperadas', obrigatorio: 1 },
    { campo: 'conhecimentos_previos', rotulo: 'Conhecimentos Prévia Recomendados', obrigatorio: 0 },
    { campo: 'perguntas_norteadoras', rotulo: 'Perguntas Norteadoras', obrigatorio: 0 }
  ];

  for (const c of camposObrigatorios) {
    await runAsync(
      `INSERT INTO config_campos_obrigatorios (nome_campo, rotulo, obrigatorio, atualizado_por) VALUES (?, ?, ?, ?)`,
      [c.campo, c.rotulo, c.obrigatorio, adminId]
    );
  }

  // 13. Seed Sample Files
  const sampleFile1 = await runAsync(
    `INSERT INTO arquivos (nome_original, caminho_armazenado, tamanho_bytes, mime_type, categoria, hash_md5, enviado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      'Guia_Estudo_Caso_Marcopolo.pdf',
      'uploads/sample_marcopolo.pdf',
      1024500,
      'application/pdf',
      'PDF',
      'a1b2c3d4e5f6',
      profJussara.lastID
    ]
  );

  // 14. Seed Activity 1 - PUBLICADO (Marcopolo)
  const act1 = await runAsync(
    `INSERT INTO atividades_pbl (codigo_unico, titulo, curso_id, disciplina_id, professor_id, periodo_letivo_id, status, versao_atual)
     VALUES ('ADMCONT010301', 'TRANSFORMAÇÃO DIGITAL E CLIMA ORGANIZACIONAL: DESAFIOS DE GESTÃO NA MARCOPOLO SÃO MATEUS', ?, ?, ?, ?, 'PUBLICADO', 1)`,
    [c1.lastID, d1.lastID, profJussara.lastID, p1.lastID]
  );

  const ver1 = await runAsync(
    `INSERT INTO versoes_atividades (
      atividade_id, numero_versao, contexto_problema, problema_central, objetivos_aprendizagem,
      competencias_habilidades, conhecimentos_previos, instrucoes_gerais, perguntas_norteadoras,
      produtos_esperados, forma_realizacao, criterios_avaliacao, rubrica_json, carga_horaria_estimada,
      observacoes_professor, observacoes_internas_admin, criado_por
    ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, 'GRUPO', ?, ?, 20, ?, ?, ?)`,
    [
      act1.lastID,
      'A planta industrial da Marcopolo em São Mateus enfrenta o desafio de integrar automação de linha de montagem mantendo o clima organizacional motivado.',
      'Como redesenhar os fluxos de trabalho e comunicação interna para reduzir a resistência à transformação digital em 30% no prazo de 60 dias?',
      '1. Mapear resistências culturais;\n2. Elaborar plano de comunicação transparente;\n3. Propor estrutura de sustentação para a transição tecnológica.',
      'Gestão de Mudança, Liderança Situacional, Análise de Clima Organizacional, Métricas de Desempenho.',
      'Teoria das Relações Humanas, Conceitos de Indústria 4.0, Metodologias Ágeis de Gestão.',
      'Trabalhem em grupos de até 5 alunos. Consultem o material anexo e realizem entrevistas diagnósticas com os gestores simulados.',
      '1. Quais são as principais dores relatadas pelos colaboradores no chão de fábrica?\n2. De que maneira a liderança pode mediar o medo de demissões pela tecnologia?',
      'Relatório Diagnóstico Executivo (PDF de 5 a 10 páginas) e Apresentação em Pitch (Máximo 10 minutos).',
      'Critério A: Profundidade do Mapeamento (40%)\nCritério B: Viabilidade da Solução de Gestão de Mudança (40%)\nCritério C: Qualidade da Apresentação Oral (20%)',
      JSON.stringify({
        criterios: [
          { nome: 'Análise de Cenário', peso: 40, nivelExcelente: 'Identifica causas raiz e impacto organizacional completo' },
          { nome: 'Plano de Ação', peso: 40, nivelExcelente: 'Apresenta cronograma factível com KPIs bem definidos' },
          { nome: 'Apresentação Oral', peso: 20, nivelExcelente: 'Comunicação fluida, suporte visual impecável' }
        ]
      }),
      'Atividade desenvolvida com base no estudo empírico da unidade São Mateus.',
      'Aprovado integralmente pela administração. Conteúdo atende a todas as diretrizes institucionais.',
      profJussara.lastID
    ]
  );

  // Attach File to Versao 1
  await runAsync(
    `INSERT INTO arquivos_atividades (versao_atividade_id, arquivo_id, aprovado_pelo_admin, versao_material) VALUES (?, ?, 1, 'v1')`,
    [ver1.lastID, sampleFile1.lastID]
  );

  // Steps for Act 1
  await runAsync(`INSERT INTO etapas_pbl (versao_atividade_id, ordem, titulo, descricao, obrigatoria) VALUES (?, 1, 'Análise de Problema e Leitura de Cenário', 'Ler o caso de estudo e levantar as variáveis críticas do clima organizacional.', 1)`, [ver1.lastID]);
  await runAsync(`INSERT INTO etapas_pbl (versao_atividade_id, ordem, titulo, descricao, obrigatoria) VALUES (?, 2, 'Formulação de Hipóteses e Plano de Mudança', 'Elaborar o plano estratégico de comunicação e treinamento.', 1)`, [ver1.lastID]);
  await runAsync(`INSERT INTO etapas_pbl (versao_atividade_id, ordem, titulo, descricao, obrigatoria) VALUES (?, 3, 'Elaboração do Relatório e Entrega Final', 'Compilar a solução técnica e submeter o documento final no portal.', 1)`, [ver1.lastID]);

  // Admin Approval Record for Act 1
  await runAsync(
    `INSERT INTO analises_administrativas (atividade_id, versao_analisada, analista_id, decisao, justificativa) VALUES (?, 1, ?, 'APROVADO', 'Conteúdo validado e alinhado ao plano pedagógico do curso.')`,
    [act1.lastID, adminId]
  );

  // Segmentation for Act 1 (Turma A, with explicit exclusion of André Alves Oliveira - studentIds[10])
  const seg1 = await runAsync(`INSERT INTO segmentacoes (atividade_id, tipo_segmentacao) VALUES (?, 'MISTO')`, [act1.lastID]);
  await runAsync(`INSERT INTO segmentacao_regras (segmentacao_id, entidade_tipo, entidade_id, acao) VALUES (?, 'turma', ?, 'INCLUIR')`, [seg1.lastID, t1.lastID]);
  await runAsync(`INSERT INTO segmentacao_regras (segmentacao_id, entidade_tipo, entidade_id, acao) VALUES (?, 'aluno', ?, 'EXCLUIR')`, [seg1.lastID, studentIds[10]]); // André Alves Oliveira excluded!

  // Populate resolved target students for Act 1 (excluding studentIds[10])
  for (let i = 0; i < 10; i++) {
    if (studentIds[i] !== studentIds[10]) {
      await runAsync(`INSERT INTO alunos_segmentados (atividade_id, aluno_id) VALUES (?, ?)`, [act1.lastID, studentIds[i]]);
    }
  }

  // Publication Record for Act 1
  const pub1 = await runAsync(
    `INSERT INTO publicacoes (atividade_id, data_disponibilizacao, prazo_entrega, publicado_por, status_publicacao) VALUES (?, '2026-02-01 08:00:00', '2026-03-30 23:59:59', ?, 'PUBLICADO')`,
    [act1.lastID, adminId]
  );

  // Seed Submissions for Ketlly Beatriz (studentIds[0]) & Kaila Cristina (studentIds[1])
  const entrega1 = await runAsync(
    `INSERT INTO entregas (publicacao_id, aluno_id, grupo_id, status, conteudo_resposta, data_envio, comprovante_hash)
     VALUES (?, ?, ?, 'ENVIADO', ?, '2026-03-25 14:30:00', 'HASH-DELIVERY-KETLLY-20260325')`,
    [
      pub1.lastID,
      studentIds[0],
      g1.lastID,
      'Prezados Professores, encaminhamos em anexo o Relatório de Gestão de Mudança da Marcopolo elaborado pelo Grupo 1. Desenvolvemos o plano focado em transparência, comités de liderança e KPIs semanais de engajamento.'
    ]
  );

  // Seed Feedback for Ketlly's submission
  await runAsync(
    `INSERT INTO feedbacks (entrega_id, avaliador_id, nota_escrita, nota_oral, nota_total, observacoes, liberado_aluno)
     VALUES (?, ?, 1.56, 1.29, 2.85, 'Excelente profundidade na análise da resistência cultural da planta de São Mateus.', 1)`,
    [entrega1.lastID, profJussara.lastID]
  );

  // Activity 2 - AJUSTES SOLICITADOS (Prof. Nilvans / ADS)
  const act2 = await runAsync(
    `INSERT INTO atividades_pbl (codigo_unico, titulo, curso_id, disciplina_id, professor_id, periodo_letivo_id, status, versao_atual)
     VALUES ('ADS202602', 'SISTEMA DE MONITORAMENTO DE PACIENTES EM UTI COM IOT E DASHBOARD EM TEMPO REAL', ?, ?, ?, ?, 'AJUSTES_SOLICITADOS', 1)`,
    [c2.lastID, d3.lastID, profNilvans.lastID, p1.lastID]
  );

  const ver2 = await runAsync(
    `INSERT INTO versoes_atividades (
      atividade_id, numero_versao, contexto_problema, problema_central, objetivos_aprendizagem,
      competencias_habilidades, instrucoes_gerais, produtos_esperados, forma_realizacao, criterios_avaliacao,
      observacoes_professor, criado_por
    ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, 'INDIVIDUAL', ?, ?, ?)`,
    [
      act2.lastID,
      'Hospitais de grande porte necessitam de alertas em tempo real para oscilações súbitas nos sinais vitais de pacientes críticos em UTI.',
      'Como arquitetar uma aplicação resiliente de IoT capaz de processar 1.000 eventos por segundo sem perda de dados?',
      'Arquitetura pub/sub, WebSockets, bancos de dados de série temporal, tratamento de contingências de rede.',
      'Desenvolvimento Backend Assíncrono, Protocolo MQTT, UX/UI para Dashboards Médicos de Alta Criticidade.',
      'Desenvolva um protótipo com simulador de dados de telemetria e documentação da arquitetura.',
      'Repositório no GitHub e Vídeo Demonstrativo da Execução.',
      'Funcionalidade do simulador (50%), Latência abaixo de 200ms (30%), Documentação (20%).',
      'Aguardo validação do setor de TI da coordenação.',
      profNilvans.lastID
    ]
  );

  await runAsync(
    `INSERT INTO analises_administrativas (atividade_id, versao_analisada, analista_id, decisao, justificativa) VALUES (?, 1, ?, 'AJUSTES_SOLICITADOS', 'Por favor, detalhar melhor os critérios de avaliação e incluir rubrica formativa para os alunos do 1º período.')`,
    [act2.lastID, adminId]
  );

  await runAsync(
    `INSERT INTO comentarios_revisao (atividade_id, autor_id, texto, privado_admin) VALUES (?, ?, 'Ajuste a rubrica conforme sugestão para facilitar o entendimento do aluno.', 0)`,
    [act2.lastID, adminId]
  );

  // Activity 3 - RASCUNHO (Prof. Luciano)
  await runAsync(
    `INSERT INTO atividades_pbl (codigo_unico, titulo, curso_id, disciplina_id, professor_id, periodo_letivo_id, status, versao_atual)
     VALUES ('ENGPROD301', 'OTIMIZAÇÃO DE LEAN MANUFACTURING E REDUÇÃO DE SETUP NA LINHA DE EMBALAGEM', ?, ?, ?, ?, 'RASCUNHO', 1)`,
    [c4.lastID, d4.lastID, profLuciano.lastID, p1.lastID]
  );

  // Seed Notifications
  await runAsync(
    `INSERT INTO notificacoes (usuario_id, titulo, mensagem, link) VALUES (?, 'Nova Atividade Disponível', 'A atividade "TRANSFORMAÇÃO DIGITAL E CLIMA ORGANIZACIONAL" foi publicada.', '/aluno/atividades')`,
    [studentIds[0]]
  );

  await runAsync(
    `INSERT INTO notificacoes (usuario_id, titulo, mensagem, link) VALUES (?, 'Ajustes Solicitados em Atividade PBL', 'A administração solicitou ajustes na atividade ADS202602.', '/professor/atividades')`,
    [profNilvans.lastID]
  );

  // Seed Audit Logs
  await runAsync(
    `INSERT INTO logs_auditoria (usuario_id, acao, recurso, recurso_id, detalhes_json) VALUES (?, 'PUBLICAR_ATIVIDADE', 'atividades_pbl', ?, '{"status": "PUBLICADO", "segmentacao": "Turma A - 1º e 3º Período"}')`,
    [adminId, act1.lastID.toString()]
  );

  console.log('--- Database Initialization & Seeding Complete! ---');
  console.log('Credentials Summary:');
  console.log('Admin: admin@pbl.edu.br / admin123');
  console.log('Professor: prof.jussara@pbl.edu.br / prof123');
  console.log('Student: aluno.ketlly@pbl.edu.br / aluno123');
}

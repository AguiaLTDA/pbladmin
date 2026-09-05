import { supabase, isSupabaseConfigured } from './supabase';
import { User, PBLActivity, PBLVersion, PBLStep, StudentSubmission, NotificationItem, MandatoryFieldConfig } from '../types';

/**
 * Usuários da demonstração pública (GitHub Pages), usados apenas quando não há
 * backend Express local nem Supabase configurado.
 *
 * ATENÇÃO: são credenciais de vitrine, com senhas conhecidas e publicadas no
 * README. A autenticação de verdade acontece no backend Express
 * (`server/src/controllers/authController.ts`), que compara o bcrypt do banco.
 * Nunca use este caminho para dados reais de alunos.
 */
const DEMO_USERS: Record<string, User> = {
  'admin@pbl.edu.br': {
    id: 1,
    nome: 'Coordenadoria Geral de PBL',
    email: 'admin@pbl.edu.br',
    perfilId: 1,
    perfilNome: 'ADMIN',
    ativo: 1
  },
  'prof.jussara@pbl.edu.br': {
    id: 2,
    nome: 'Profa. Jussara Matos',
    email: 'prof.jussara@pbl.edu.br',
    perfilId: 2,
    perfilNome: 'PROFESSOR',
    ativo: 1
  },
  'prof.luciano@pbl.edu.br': {
    id: 3,
    nome: 'Prof. Luciano Santos',
    email: 'prof.luciano@pbl.edu.br',
    perfilId: 2,
    perfilNome: 'PROFESSOR',
    ativo: 1
  },
  'prof.nilvans@pbl.edu.br': {
    id: 4,
    nome: 'Prof. Nilvans Silva',
    email: 'prof.nilvans@pbl.edu.br',
    perfilId: 2,
    perfilNome: 'PROFESSOR',
    ativo: 1
  },
  'aluno.ketlly@pbl.edu.br': {
    id: 5,
    nome: 'Ketlly Beatriz Souza Rodrigues',
    email: 'aluno.ketlly@pbl.edu.br',
    perfilId: 3,
    perfilNome: 'ALUNO',
    ativo: 1
  },
  'aluno.kaila@pbl.edu.br': {
    id: 6,
    nome: 'Kaila Cristina da Silva Lima',
    email: 'aluno.kaila@pbl.edu.br',
    perfilId: 3,
    perfilNome: 'ALUNO',
    ativo: 1
  },
  'aluno.andre@pbl.edu.br': {
    id: 15,
    nome: 'André Alves Oliveira',
    email: 'aluno.andre@pbl.edu.br',
    perfilId: 3,
    perfilNome: 'ALUNO',
    ativo: 1
  }
};

/** Senhas da demonstração pública. Mesmas do README. */
const DEMO_PASSWORDS: Record<string, string> = {
  'admin@pbl.edu.br': 'admin123',
  'prof.jussara@pbl.edu.br': 'prof123',
  'prof.luciano@pbl.edu.br': 'prof123',
  'prof.nilvans@pbl.edu.br': 'prof123',
  'aluno.ketlly@pbl.edu.br': 'aluno123',
  'aluno.kaila@pbl.edu.br': 'aluno123',
  'aluno.andre@pbl.edu.br': 'aluno123'
};

const CREDENCIAIS_INVALIDAS = 'E-mail ou senha incorretos.';

export const supabaseService = {
  // 1. Autenticação & Usuários
  async login(email: string, senha: string): Promise<{ token: string; usuario: User }> {
    const emailNormalizado = email.trim().toLowerCase();

    // Caminho real: Supabase Auth valida a senha no servidor. Um SELECT na
    // tabela `usuarios` NÃO autentica ninguém — só diz que o e-mail existe.
    if (isSupabaseConfigured) {
      const { data: sessao, error: authError } = await supabase.auth.signInWithPassword({
        email: emailNormalizado,
        password: senha
      });

      if (authError || !sessao?.session) {
        throw new Error(CREDENCIAIS_INVALIDAS);
      }

      const { data: usuario } = await supabase
        .from('usuarios')
        .select('*, perfis(id, nome)')
        .eq('email', emailNormalizado)
        .eq('ativo', 1)
        .single();

      if (!usuario) {
        throw new Error('Usuário autenticado, mas sem cadastro acadêmico ativo na plataforma.');
      }

      const perfilNome =
        usuario.perfis?.nome ||
        (usuario.perfil_id === 1 ? 'ADMIN' : usuario.perfil_id === 2 ? 'PROFESSOR' : 'ALUNO');

      return {
        token: sessao.session.access_token,
        usuario: {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          perfilId: usuario.perfil_id,
          perfilNome: perfilNome as any,
          ativo: usuario.ativo
        }
      };
    }

    // Caminho de demonstração: senha conferida, ainda que contra uma constante.
    const demoUser = DEMO_USERS[emailNormalizado];
    if (demoUser && DEMO_PASSWORDS[emailNormalizado] === senha) {
      const token = `demo-session-${demoUser.id}-${Date.now()}`;
      return { token, usuario: demoUser };
    }

    throw new Error(CREDENCIAIS_INVALIDAS);
  },

  async getUserProfile(userId: number): Promise<User> {
    try {
      if (!isSupabaseConfigured) throw new Error('Supabase não configurado.');

      const { data: usuario, error } = await supabase
        .from('usuarios')
        .select('*, perfis(id, nome)')
        .eq('id', userId)
        .single();

      if (!error && usuario) {
        return {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          perfilId: usuario.perfil_id,
          perfilNome: usuario.perfis?.nome || (usuario.perfil_id === 1 ? 'ADMIN' : usuario.perfil_id === 2 ? 'PROFESSOR' : 'ALUNO'),
          ativo: usuario.ativo
        };
      }
    } catch (err) {
      console.warn('Supabase DB getUserProfile error, using fallback:', err);
    }

    const found = Object.values(DEMO_USERS).find((u) => u.id === userId);
    if (found) return found;

    return DEMO_USERS['admin@pbl.edu.br'];
  },

  // 2. Dashboard Stats
  async getDashboardStats(userId: number, role: string) {
    return {
      totalPbls: 3,
      emAnalise: 1,
      publicados: 1,
      entregasCount: 1,
      atividadesRecentSubmissions: [
        {
          id: 1,
          codigo_unico: 'ADMCONT010301',
          titulo: 'TRANSFORMAÇÃO DIGITAL E CLIMA ORGANIZACIONAL: DESAFIOS DE GESTÃO NA MARCOPOLO SÃO MATEUS',
          curso_nome: 'Administração e Ciências Contábeis',
          professor_nome: 'Profa. Jussara Matos',
          status: 'PUBLICADO',
          atualizado_em: new Date().toISOString()
        },
        {
          id: 2,
          codigo_unico: 'ADS202602',
          titulo: 'SISTEMA DE MONITORAMENTO DE PACIENTES EM UTI COM IOT E DASHBOARD EM TEMPO REAL',
          curso_nome: 'Análise e Desenvolvimento de Sistemas',
          professor_nome: 'Prof. Nilvans Silva',
          status: 'AJUSTES_SOLICITADOS',
          atualizado_em: new Date().toISOString()
        }
      ]
    };
  },

  // 3. Atividades PBL Gerais
  async getActivities(userId?: number, role?: string): Promise<PBLActivity[]> {
    try {
      if (!isSupabaseConfigured) throw new Error('Supabase não configurado.');

      let query = supabase.from('atividades_pbl').select(`
        *,
        cursos(id, nome),
        disciplinas(id, nome, codigo),
        usuarios(id, nome, email),
        periodos_letivos(id, nome),
        publicacoes(id, data_disponibilizacao, prazo_entrega, status_publicacao)
      `);

      if (role === 'PROFESSOR' && userId) {
        query = query.eq('professor_id', userId);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data.map((row: any) => {
          const pub = row.publicacoes && row.publicacoes.length > 0 ? row.publicacoes[0] : null;
          return {
            id: row.id,
            codigo_unico: row.codigo_unico || 'PBL-001',
            titulo: row.titulo || 'Atividade PBL',
            curso_id: row.curso_id || 1,
            curso_nome: row.cursos?.nome || 'Administração e Ciências Contábeis',
            disciplina_id: row.disciplina_id || 1,
            disciplina_nome: row.disciplinas?.nome || 'Gestão Organizacional e Clima',
            disciplina_codigo: row.disciplinas?.codigo || 'ADM101',
            professor_id: row.professor_id || 2,
            professor_nome: row.usuarios?.nome || 'Profa. Jussara Matos',
            professor_email: row.usuarios?.email || 'prof.jussara@pbl.edu.br',
            periodo_letivo_id: row.periodo_letivo_id || 1,
            periodo_nome: row.periodos_letivos?.nome || '2026/1',
            status: row.status || 'PUBLICADO',
            versao_atual: row.versao_atual || 1,
            criado_em: row.criado_em || new Date().toISOString(),
            atualizado_em: row.atualizado_em || new Date().toISOString(),
            publicacao_id: pub?.id,
            data_disponibilizacao: pub?.data_disponibilizacao,
            prazo_entrega: pub?.prazo_entrega,
            status_publicacao: pub?.status_publicacao
          };
        });
      }
    } catch (err) {
      console.warn('Supabase DB getActivities error, returning demo activities:', err);
    }

    return [
      {
        id: 1,
        codigo_unico: 'ADMCONT010301',
        titulo: 'TRANSFORMAÇÃO DIGITAL E CLIMA ORGANIZACIONAL: DESAFIOS DE GESTÃO NA MARCOPOLO SÃO MATEUS',
        curso_id: 1,
        curso_nome: 'Administração e Ciências Contábeis',
        disciplina_id: 1,
        disciplina_nome: 'Gestão Organizacional e Clima',
        disciplina_codigo: 'ADM101',
        professor_id: 2,
        professor_nome: 'Profa. Jussara Matos',
        professor_email: 'prof.jussara@pbl.edu.br',
        periodo_letivo_id: 1,
        periodo_nome: '2026/1',
        status: 'PUBLICADO',
        versao_atual: 1,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
        publicacao_id: 1,
        data_disponibilizacao: '2026-02-01T08:00:00.000Z',
        prazo_entrega: '2026-03-30T23:59:59.000Z',
        status_publicacao: 'PUBLICADO'
      },
      {
        id: 2,
        codigo_unico: 'ADS202602',
        titulo: 'SISTEMA DE MONITORAMENTO DE PACIENTES EM UTI COM IOT E DASHBOARD EM TEMPO REAL',
        curso_id: 2,
        curso_nome: 'Análise e Desenvolvimento de Sistemas',
        disciplina_id: 3,
        disciplina_nome: 'Engenharia de Software e Projetos',
        disciplina_codigo: 'ADS201',
        professor_id: 4,
        professor_nome: 'Prof. Nilvans Silva',
        professor_email: 'prof.nilvans@pbl.edu.br',
        periodo_letivo_id: 1,
        periodo_nome: '2026/1',
        status: 'AJUSTES_SOLICITADOS',
        versao_atual: 1,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString()
      },
      {
        id: 3,
        codigo_unico: 'ENGPROD301',
        titulo: 'OTIMIZAÇÃO DE LEAN MANUFACTURING E REDUÇÃO DE SETUP NA LINHA DE EMBALAGEM',
        curso_id: 4,
        curso_nome: 'Engenharia de Produção',
        disciplina_id: 4,
        disciplina_nome: 'Gestão de Canteiros e Logística',
        disciplina_codigo: 'ENG301',
        professor_id: 3,
        professor_nome: 'Prof. Luciano Santos',
        professor_email: 'prof.luciano@pbl.edu.br',
        periodo_letivo_id: 1,
        periodo_nome: '2026/1',
        status: 'RASCUNHO',
        versao_atual: 1,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString()
      }
    ];
  },

  // 4. Detalhes Completos da Atividade para a Tela de Revisão do Admin (`RevisaoPBLView`)
  async getActivityById(id: number): Promise<any> {
    const activities = await this.getActivities();
    const atv = activities.find((a) => a.id === Number(id)) || activities[0];

    const versaoAtualObj: PBLVersion = {
      id: 1,
      atividade_id: atv.id,
      numero_versao: 1,
      contexto_problema: 'A planta industrial da Marcopolo em São Mateus enfrenta o desafio de integrar automação de linha de montagem mantendo o clima organizacional motivado.',
      problema_central: 'Como redesenhar os fluxos de trabalho e comunicação interna para reduzir a resistência à transformação digital em 30% no prazo de 60 dias?',
      objetivos_aprendizagem: '1. Mapear resistências culturais;\n2. Elaborar plano de comunicação transparente;\n3. Propor estrutura de sustentação para a transição tecnológica.',
      competencias_habilidades: 'Gestão de Mudança, Liderança Situacional, Análise de Clima Organizacional, Métricas de Desempenho.',
      conhecimentos_previos: 'Teoria das Relações Humanas, Conceitos de Indústria 4.0, Metodologias Ágeis de Gestão.',
      instrucoes_gerais: 'Trabalhem em grupos de até 5 alunos. Consultem o material anexo e realizem entrevistas diagnósticas.',
      perguntas_norteadoras: '1. Quais são as principais dores relatadas no chão de fábrica?\n2. De que maneira a liderança pode mediar a transição?',
      produtos_esperados: 'Relatório Diagnóstico Executivo (PDF de 5 a 10 páginas) e Apresentação em Pitch (Máximo 10 minutos).',
      forma_realizacao: 'GRUPO',
      criterios_avaliacao: 'Critério A: Profundidade do Mapeamento (40%)\nCritério B: Viabilidade da Solução (40%)\nCritério C: Qualidade da Apresentação (20%)',
      carga_horaria_estimada: 20,
      observacoes_professor: 'Atividade desenvolvida com base no estudo empírico da unidade São Mateus.',
      observacoes_internas_admin: 'Aprovado integralmente pela coordenação.',
      criado_por: atv.professor_id,
      criado_por_nome: atv.professor_nome,
      criado_em: new Date().toISOString()
    };

    const etapasObj: PBLStep[] = [
      { id: 1, ordem: 1, titulo: 'Análise de Problema e Leitura de Cenário', descricao: 'Ler o caso de estudo e levantar variáveis do clima.', obrigatoria: true },
      { id: 2, ordem: 2, titulo: 'Formulação de Hipóteses e Plano de Mudança', descricao: 'Elaborar o plano estratégico de comunicação.', obrigatoria: true },
      { id: 3, ordem: 3, titulo: 'Elaboração do Relatório e Entrega Final', descricao: 'Compilar a solução técnica e submeter o documento final.', obrigatoria: true }
    ];

    return {
      atividade: atv,
      versaoAtual: versaoAtualObj,
      versao: versaoAtualObj, // Alias para compatibilidade total
      etapas: etapasObj,
      versoes: [versaoAtualObj],
      analises: [
        {
          id: 1,
          versao_analisada: 1,
          analista_nome: 'Coordenadoria Geral de PBL',
          decisao: 'APROVADO',
          justificativa: 'Conteúdo validado e alinhado às diretrizes pedagógicas.',
          criado_em: new Date().toISOString()
        }
      ],
      comentarios: [
        {
          id: 1,
          autor_nome: 'Coordenadoria Geral de PBL',
          texto: 'Excelente caso prático da planta de São Mateus.',
          privado_admin: 0,
          criado_em: new Date().toISOString()
        }
      ],
      arquivos: [
        {
          id: 1,
          nome_original: 'Guia_Estudo_Caso_Marcopolo.pdf',
          tamanho_bytes: 1024500,
          mime_type: 'application/pdf',
          categoria: 'PDF',
          aprovado_pelo_admin: 1,
          versao_material: 'v1'
        }
      ]
    };
  },

  // 5. Atividades Especificas do Aluno
  async getStudentActivities(): Promise<any[]> {
    return [
      {
        id: 1,
        codigo_unico: 'ADMCONT010301',
        titulo: 'TRANSFORMAÇÃO DIGITAL E CLIMA ORGANIZACIONAL: DESAFIOS DE GESTÃO NA MARCOPOLO SÃO MATEUS',
        curso_nome: 'Administração e Ciências Contábeis',
        disciplina_nome: 'Gestão Organizacional e Clima',
        professor_nome: 'Profa. Jussara Matos',
        prazo_entrega: '2026-03-30T23:59:59.000Z',
        estadoAluno: 'CONCLUIDA',
        nota_total: 2.85,
        liberado_aluno: 1
      },
      {
        id: 2,
        codigo_unico: 'ADS202602',
        titulo: 'SISTEMA DE MONITORAMENTO DE PACIENTES EM UTI COM IOT E DASHBOARD EM TEMPO REAL',
        curso_nome: 'Análise e Desenvolvimento de Sistemas',
        disciplina_nome: 'Engenharia de Software e Projetos',
        professor_nome: 'Prof. Nilvans Silva',
        prazo_entrega: '2026-04-15T23:59:59.000Z',
        estadoAluno: 'PENDENTE',
        liberado_aluno: 0
      }
    ];
  },

  async getStudentActivityDetails(activityId: number): Promise<any> {
    return {
      atividade: {
        id: activityId,
        codigo_unico: 'ADMCONT010301',
        titulo: 'TRANSFORMAÇÃO DIGITAL E CLIMA ORGANIZACIONAL: DESAFIOS DE GESTÃO NA MARCOPOLO SÃO MATEUS',
        curso_nome: 'Administração e Ciências Contábeis',
        disciplina_nome: 'Gestão Organizacional e Clima',
        professor_nome: 'Profa. Jussara Matos',
        status: 'PUBLICADO'
      },
      versao: {
        id: 1,
        contexto_problema: 'A planta industrial da Marcopolo em São Mateus enfrenta o desafio de integrar automação mantendo o clima motivado.',
        problema_central: 'Como redesenhar os fluxos de trabalho e comunicação interna para reduzir a resistência à transformação digital?',
        objetivos_aprendizagem: '1. Mapear resistências culturais;\n2. Elaborar plano de comunicação transparente.',
        competencias_habilidades: 'Gestão de Mudança, Liderança Situacional, Análise de Clima Organizacional.',
        instrucoes_gerais: 'Trabalhem em grupos de até 5 alunos. Consultem o material anexo.',
        perguntas_norteadoras: '1. Quais são as principais dores relatadas no chão de fábrica?\n2. Como a liderança pode mediar a transição?',
        produtos_esperados: 'Relatório Diagnóstico Executivo (PDF de 5 a 10 páginas) e Apresentação em Pitch.',
        criterios_avaliacao: 'Critério A: Profundidade do Mapeamento (40%)\nCritério B: Viabilidade da Solução (40%)\nCritério C: Apresentação Oral (20%)',
        forma_realizacao: 'GRUPO'
      },
      etapas: [
        { id: 1, ordem: 1, titulo: 'Análise de Problema e Leitura de Cenário', descricao: 'Ler o caso de estudo e levantar variáveis do clima.', obrigatoria: 1 },
        { id: 2, ordem: 2, titulo: 'Formulação de Hipóteses e Plano de Mudança', descricao: 'Elaborar o plano estratégico de comunicação.', obrigatoria: 1 },
        { id: 3, ordem: 3, titulo: 'Elaboração do Relatório e Entrega Final', descricao: 'Compilar a solução técnica e submeter o documento final.', obrigatoria: 1 }
      ],
      arquivosAtividade: [
        { id: 1, nome_original: 'Guia_Estudo_Caso_Marcopolo.pdf', tamanho_bytes: 1024500, mime_type: 'application/pdf', categoria: 'PDF' }
      ],
      entrega: {
        id: 1,
        status: 'ENVIADO',
        conteudo_resposta: 'Prezados Professores, encaminhamos em anexo o Relatório de Gestão de Mudança da Marcopolo elaborado pelo Grupo 1.',
        data_envio: '2026-03-25T14:30:00.000Z',
        comprovante_hash: 'HASH-DELIVERY-KETLLY-20260325'
      },
      arquivosEntrega: [],
      feedback: {
        nota_escrita: 1.56,
        nota_oral: 1.29,
        nota_total: 2.85,
        observacoes: 'Excelente profundidade na análise da resistência cultural da planta de São Mateus.',
        liberado_aluno: 1
      }
    };
  },

  // 6. Criar Atividade PBL
  async createActivity(payload: any): Promise<{ id: number; codigo_unico: string }> {
    const codigoUnico = `PBL-${Date.now().toString().slice(-6)}`;
    return { id: Date.now(), codigo_unico: codigoUnico };
  },

  // 7. Upload de Arquivo
  async uploadFile(file: File, userId: number): Promise<{ id: number; url: string; nome_original: string }> {
    return { id: Date.now(), url: URL.createObjectURL(file), nome_original: file.name };
  },

  // 8. Submeter Entrega do Aluno
  async submitStudentDelivery(publicacaoId: number, alunoId: number, conteudoResposta: string, file?: File): Promise<{ hash: string }> {
    const hashComprovante = `HASH-PBL-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    return { hash: hashComprovante };
  },

  // 9. Notificações
  async getNotifications(userId: number): Promise<NotificationItem[]> {
    return [
      {
        id: 1,
        usuario_id: userId,
        titulo: 'Bem-vindo à Plataforma PBL',
        mensagem: 'O ambiente virtual de Aprendizagem Baseada em Problemas está ativo.',
        link: '/admin/caixa-entrada',
        lida: 0,
        criado_em: new Date().toISOString()
      }
    ];
  },

  // 10. Logs de Auditoria
  async getAuditLogs() {
    return [
      {
        id: 1,
        usuario_id: 1,
        usuarios: { nome: 'Coordenadoria Geral de PBL', email: 'admin@pbl.edu.br' },
        acao: 'SESSAO_AUTENTICADA',
        recurso: 'usuarios',
        recurso_id: '1',
        detalhes_json: '{"ip": "127.0.0.1", "status": "Sucesso"}',
        criado_em: new Date().toISOString()
      },
      {
        id: 2,
        usuario_id: 1,
        usuarios: { nome: 'Coordenadoria Geral de PBL', email: 'admin@pbl.edu.br' },
        acao: 'PUBLICAR_ATIVIDADE',
        recurso: 'atividades_pbl',
        recurso_id: '1',
        detalhes_json: '{"status": "PUBLICADO", "segmentacao": "Turma A - 1º e 3º Período"}',
        criado_em: new Date().toISOString()
      }
    ];
  }
};

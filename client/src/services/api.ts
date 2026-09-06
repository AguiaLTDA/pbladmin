import { isSupabaseConfigured } from './supabase';
import { supabaseService } from './supabaseService';

// Em produção (build do GitHub Pages), aponta para o backend publicado no Render,
// injetado em tempo de build via VITE_API_BASE_URL. Em dev local, cai no padrão
// localhost:4000 quando a variável não está definida.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:4000/api';

/**
 * Ordem de resolução de uma chamada de API, da fonte mais confiável para a
 * menos confiável:
 *
 *   1. Backend Express real (local ou publicado, ver API_BASE_URL acima) — banco
 *      Postgres real, JWT, bcrypt, RBAC e auditoria. É a AUTORIDADE: se ele
 *      responder qualquer HTTP status, essa resposta vale, inclusive os erros
 *      (401/403/404/422).
 *   2. Supabase, quando VITE_SUPABASE_URL/ANON_KEY estiverem configuradas.
 *   3. Dados de demonstração em memória, só para a vitrine no GitHub Pages.
 *
 * Os passos 2 e 3 só entram em cena quando o passo anterior está indisponível
 * (falha de rede / não configurado) — nunca para mascarar um erro de negócio.
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('pbl_auth_token');

  // 1. Backend Express real — prioridade máxima quando alcançável.
  {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>)
    };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response: Response | null = null;

    try {
      response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
    } catch (fetchErr) {
      // Só uma falha de REDE (backend fora do ar) autoriza os fallbacks abaixo.
      console.warn(
        `Backend indisponível em ${API_BASE_URL}${endpoint}. Usando dados de demonstração.`
      );
    }

    if (response) {
      if (response.status === 401 && endpoint !== '/auth/login') {
        localStorage.removeItem('pbl_auth_token');
        localStorage.removeItem('pbl_user_data');
        if (!window.location.hash.includes('/login')) {
          window.location.hash = '/login';
        }
      }

      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Erro ao processar requisição.');
        }
        return data as T;
      }

      if (response.ok) {
        return (await response.text()) as unknown as T;
      }

      // Resposta de erro sem JSON: propaga em vez de fingir sucesso.
      throw new Error(`Erro ${response.status} ao processar requisição.`);
    }
  }

  // 2. Supabase / serviços em nuvem.
  try {
    const res = await handleSupabaseRequest<T>(endpoint, options);
    if (res !== undefined) return res;
  } catch (err: any) {
    // Credenciais inválidas são resposta legítima e devem chegar ao usuário.
    // Nunca cair no fallback de demonstração em cima de uma falha de login.
    if (endpoint.startsWith('/auth/')) throw err;
    console.warn(`Handler error on ${endpoint}:`, err?.message || err);
  }

  // 3. Vitrine estática (GitHub Pages), sem persistência.
  return getFallbackResponseForEndpoint<T>(endpoint, options);
}

// Roteador Inteligente de Endpoints em Nuvem & Demonstrador
async function handleSupabaseRequest<T>(endpoint: string, options: RequestInit): Promise<T | undefined> {
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : {};

  // Auth Login
  if (endpoint === '/auth/login' && method === 'POST') {
    return (await supabaseService.login(body.email, body.senha)) as unknown as T;
  }

  // Auth Profile
  if (endpoint === '/auth/profile' && method === 'GET') {
    const saved = localStorage.getItem('pbl_user_data');
    const parsed = saved ? JSON.parse(saved) : null;
    const userId = parsed?.id || 1;
    return (await supabaseService.getUserProfile(userId)) as unknown as T;
  }

  // Dashboard Stats
  if (endpoint.startsWith('/dashboard') && method === 'GET') {
    const saved = localStorage.getItem('pbl_user_data');
    const user = saved ? JSON.parse(saved) : { id: 1, perfilNome: 'ADMIN' };
    return (await supabaseService.getDashboardStats(user.id, user.perfilNome)) as unknown as T;
  }

  // Submissões e Atividades do Aluno (/submissions/student/activities)
  if (endpoint.startsWith('/submissions/student/activities')) {
    const parts = endpoint.split('?')[0].split('/').filter(Boolean); // ['submissions', 'student', 'activities', '1']
    
    // Detalhes da Atividade do Aluno
    if (parts.length === 4) {
      const id = parseInt(parts[3], 10);
      return (await supabaseService.getStudentActivityDetails(id)) as unknown as T;
    }

    // Lista de Atividades do Aluno
    return (await supabaseService.getStudentActivities()) as unknown as T;
  }

  // Submeter Entrega / Salvar Rascunho do Aluno
  if (endpoint.startsWith('/submissions/student/submit') || endpoint.startsWith('/submissions/student/draft')) {
    const saved = localStorage.getItem('pbl_user_data');
    const user = saved ? JSON.parse(saved) : { id: 5 };
    const res = await supabaseService.submitStudentDelivery(body.publicacao_id || 1, user.id, body.conteudo_resposta || '');
    return { status: 'ENVIADO', comprovante_hash: res.hash } as unknown as T;
  }

  // Atividades Gerais do Professor/Admin
  if (endpoint.startsWith('/pbl/activities') && method === 'GET') {
    const parts = endpoint.split('/').filter(Boolean);
    if (parts.length === 3) {
      const id = parseInt(parts[2], 10);
      return (await supabaseService.getActivityById(id)) as unknown as T;
    }
    const saved = localStorage.getItem('pbl_user_data');
    const user = saved ? JSON.parse(saved) : {};
    return (await supabaseService.getActivities(user.id, user.perfilNome)) as unknown as T;
  }

  // Criar Atividade
  if (endpoint === '/pbl/activities' && method === 'POST') {
    return (await supabaseService.createActivity(body)) as unknown as T;
  }

  // Notificações
  if (endpoint === '/notifications' && method === 'GET') {
    const saved = localStorage.getItem('pbl_user_data');
    const user = saved ? JSON.parse(saved) : { id: 1 };
    return (await supabaseService.getNotifications(user.id)) as unknown as T;
  }

  // Auditoria
  if (endpoint.startsWith('/audit') && method === 'GET') {
    return (await supabaseService.getAuditLogs()) as unknown as T;
  }

  return undefined;
}

// Fallbacks de Dados Garantidos com Retorno em 0ms
function getFallbackResponseForEndpoint<T>(endpoint: string, options: RequestInit): T {
  // Lista de Atividades do Aluno
  if (endpoint.includes('/submissions/student/activities')) {
    if (endpoint.match(/\/submissions\/student\/activities\/\d+/)) {
      return {
        atividade: {
          id: 1,
          codigo_unico: 'ADMCONT010301',
          titulo: 'TRANSFORMAÇÃO DIGITAL E CLIMA ORGANIZACIONAL: DESAFIOS DE GESTÃO NA MARCOPOLO SÃO MATEUS',
          curso_nome: 'Administração e Ciências Contábeis',
          disciplina_nome: 'Gestão Organizacional e Clima',
          professor_nome: 'Profa. Jussara Matos',
          status: 'PUBLICADO'
        },
        versao: {
          id: 1,
          contexto_problema: 'A planta industrial da Marcopolo em São Mateus enfrenta o desafio de integrar automação de linha de montagem mantendo o clima organizacional motivado.',
          problema_central: 'Como redesenhar os fluxos de trabalho e comunicação interna para reduzir a resistência à transformação digital em 30% no prazo de 60 dias?',
          objetivos_aprendizagem: '1. Mapear resistências culturais;\n2. Elaborar plano de comunicação transparente;\n3. Propor estrutura de sustentação.',
          competencias_habilidades: 'Gestão de Mudança, Liderança Situacional, Análise de Clima Organizacional, Métricas de Desempenho.',
          conhecimentos_previos: 'Teoria das Relações Humanas, Conceitos de Indústria 4.0, Metodologias Ágeis de Gestão.',
          instrucoes_gerais: 'Trabalhem em grupos de até 5 alunos. Consultem o material anexo.',
          perguntas_norteadoras: '1. Quais são as principais dores no chão de fábrica?\n2. De que maneira a liderança pode mediar a transição?',
          produtos_esperados: 'Relatório Diagnóstico Executivo (PDF de 5 a 10 páginas) e Apresentação em Pitch (Máximo 10 minutos).',
          criterios_avaliacao: 'Critério A: Profundidade do Mapeamento (40%)\nCritério B: Viabilidade da Solução (40%)\nCritério C: Qualidade da Apresentação (20%)',
          forma_realizacao: 'GRUPO'
        },
        etapas: [
          { id: 1, ordem: 1, titulo: 'Análise de Problema e Leitura de Cenário', descricao: 'Ler o caso de estudo e levantar as variáveis críticas do clima organizacional.', obrigatoria: 1 },
          { id: 2, ordem: 2, titulo: 'Formulação de Hipóteses e Plano de Mudança', descricao: 'Elaborar o plano estratégico de comunicação e treinamento.', obrigatoria: 1 },
          { id: 3, ordem: 3, titulo: 'Elaboração do Relatório e Entrega Final', descricao: 'Compilar a solução técnica e submeter o documento final no portal.', obrigatoria: 1 }
        ],
        arquivosAtividade: [
          { id: 1, nome_original: 'Guia_Estudo_Caso_Marcopolo.pdf', tamanho_bytes: 1024500, mime_type: 'application/pdf', categoria: 'PDF' }
        ],
        entrega: {
          id: 1,
          status: 'ENVIADO',
          conteudo_resposta: 'Prezados Professores, encaminhamos o Relatório de Gestão de Mudança da Marcopolo com a proposta de comitês transversais e indicadores semanais de engajamento.',
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
      } as unknown as T;
    }

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
    ] as unknown as T;
  }

  if (endpoint.includes('/academic/courses')) {
    return [
      { id: 1, codigo: 'ADMCONT', nome: 'Administração e Ciências Contábeis', descricao: 'Bacharelado Interdisciplinar em Gestão' },
      { id: 2, codigo: 'ADS', nome: 'Análise e Desenvolvimento de Sistemas', descricao: 'Tecnólogo em Software' },
      { id: 3, codigo: 'AGRO', nome: 'Agronomia', descricao: 'Engenharia Agronômica' },
      { id: 4, codigo: 'ENGPROD', nome: 'Engenharia de Produção', descricao: 'Logística e Processos' }
    ] as unknown as T;
  }

  if (endpoint.includes('/academic/disciplines')) {
    return [
      { id: 1, codigo: 'ADM101', nome: 'Gestão Organizacional e Clima', curso_id: 1, curso_nome: 'ADMCONT' },
      { id: 2, codigo: 'ADM102', nome: 'Eficiência Operacional e Processos', curso_id: 1, curso_nome: 'ADMCONT' },
      { id: 3, codigo: 'ADS201', nome: 'Engenharia de Software e Projetos', curso_id: 2, curso_nome: 'ADS' },
      { id: 4, codigo: 'ENG301', nome: 'Gestão de Canteiros e Logística', curso_id: 4, curso_nome: 'ENGPROD' }
    ] as unknown as T;
  }

  if (endpoint.includes('/academic/classes')) {
    return [
      { id: 1, codigo: 'ADMCONT-010301', nome: 'Turma A - 1º e 3º Período ADMCONT', disciplina_id: 1, periodo_letivo_id: 1 },
      { id: 2, codigo: 'ADMCONT-010302', nome: 'Turma B - Hospital e Logística', disciplina_id: 2, periodo_letivo_id: 1 },
      { id: 3, codigo: 'ADS-20261', nome: 'Turma ADS - Projetos PBL', disciplina_id: 3, periodo_letivo_id: 1 }
    ] as unknown as T;
  }

  if (endpoint.match(/\/academic\/groups\/\d+\/membros/)) {
    return [] as unknown as T;
  }

  if (endpoint.includes('/academic/groups')) {
    return [
      { id: 1, nome: 'Grupo Marcopolo', turma_id: 1, total_integrantes: 2 },
      { id: 2, nome: 'Grupo Sicoob Credivar', turma_id: 1, total_integrantes: 1 },
      { id: 3, nome: 'Grupo Hospital São Mateus', turma_id: 2, total_integrantes: 3 }
    ] as unknown as T;
  }

  if (endpoint.includes('/academic/my-enrollment')) {
    return [] as unknown as T;
  }

  if (endpoint.includes('/academic/periods')) {
    return [
      { id: 1, nome: '2026/1', data_inicio: '2026-02-01', data_fim: '2026-07-15', ativo: 1 }
    ] as unknown as T;
  }

  if (endpoint.includes('/academic/users')) {
    return [
      { id: 1, nome: 'Coordenadoria Geral de PBL', email: 'admin@pbl.edu.br', perfilId: 1, perfilNome: 'ADMIN', ativo: 1 },
      { id: 2, nome: 'Profa. Jussara Matos', email: 'prof.jussara@pbl.edu.br', perfilId: 2, perfilNome: 'PROFESSOR', ativo: 1 },
      { id: 3, nome: 'Prof. Luciano Santos', email: 'prof.luciano@pbl.edu.br', perfilId: 3, perfilNome: 'PROFESSOR', ativo: 1 },
      { id: 4, nome: 'Prof. Nilvans Silva', email: 'prof.nilvans@pbl.edu.br', perfilId: 4, perfilNome: 'PROFESSOR', ativo: 1 },
      { id: 5, nome: 'Ketlly Beatriz Souza Rodrigues', email: 'aluno.ketlly@pbl.edu.br', perfilId: 3, perfilNome: 'ALUNO', ativo: 1 },
      { id: 6, nome: 'Kaila Cristina da Silva Lima', email: 'aluno.kaila@pbl.edu.br', perfilId: 3, perfilNome: 'ALUNO', ativo: 1 },
      { id: 15, nome: 'André Alves Oliveira', email: 'aluno.andre@pbl.edu.br', perfilId: 3, perfilNome: 'ALUNO', ativo: 1 }
    ] as unknown as T;
  }

  if (endpoint.includes('/pbl/mandatory-fields')) {
    return [
      { id: 1, nome_campo: 'titulo', rotulo: 'Título da Atividade', obrigatorio: 1 },
      { id: 2, nome_campo: 'contexto_problema', rotulo: 'Contexto / Cenário-Problema', obrigatorio: 1 },
      { id: 3, nome_campo: 'problema_central', rotulo: 'Problema Central', obrigatorio: 1 },
      { id: 4, nome_campo: 'objetivos_aprendizagem', rotulo: 'Objetivos de Aprendizagem', obrigatorio: 1 },
      { id: 5, nome_campo: 'etapas_pbl', rotulo: 'Etapas da Atividade', obrigatorio: 1 },
      { id: 6, nome_campo: 'criterios_avaliacao', rotulo: 'Critérios de Avaliação', obrigatorio: 1 },
      { id: 7, nome_campo: 'produtos_esperados', rotulo: 'Produtos / Entregas Esperadas', obrigatorio: 1 }
    ] as unknown as T;
  }

  if (endpoint.includes('/files')) {
    return [
      {
        id: 1,
        nome_original: 'Guia_Estudo_Caso_Marcopolo.pdf',
        tamanho_bytes: 1024500,
        mime_type: 'application/pdf',
        categoria: 'PDF',
        enviado_por_nome: 'Profa. Jussara Matos',
        criado_em: new Date().toISOString()
      }
    ] as unknown as T;
  }

  if (endpoint.includes('/reports')) {
    return [
      { id: 1, titulo: 'Relatório Geral de Atividades PBL', criado_em: new Date().toISOString() }
    ] as unknown as T;
  }

  if (endpoint.includes('/publication/preview')) {
    return {
      alcanceNominal: 9,
      alunosIncluidos: 10,
      alunosExcluidos: 1,
      listaAlunos: [
        { id: 5, nome: 'Ketlly Beatriz Souza Rodrigues', email: 'aluno.ketlly@pbl.edu.br', status: 'INCLUIDO' },
        { id: 6, nome: 'Kaila Cristina da Silva Lima', email: 'aluno.kaila@pbl.edu.br', status: 'INCLUIDO' },
        { id: 15, nome: 'André Alves Oliveira', email: 'aluno.andre@pbl.edu.br', status: 'EXCLUIDO_MANUAL' }
      ]
    } as unknown as T;
  }

  // Escritas sem backend não persistem. A mensagem diz isso em voz alta em vez
  // de devolver um "sucesso" que induz o usuário ao erro.
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    return {
      message:
        'Modo demonstração: a ação foi simulada e NÃO foi salva. Inicie o backend (server/npm run dev) ou configure o Supabase para persistir os dados.',
      demo: true,
      persistido: false
    } as unknown as T;
  }

  return { message: 'Operação realizada com sucesso.', demo: true } as unknown as T;
}

export function getDownloadUrl(fileId: number): string {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');

  if (isSupabaseConfigured && supabaseUrl) {
    return `${supabaseUrl}/storage/v1/object/public/pbl-files/${fileId}`;
  }
  return `${API_BASE_URL}/files/download/${fileId}`;
}

/**
 * Baixa o arquivo autenticado e devolve uma object URL utilizável em <iframe>,
 * <embed> ou download. O endpoint /files/download exige o JWT no cabeçalho,
 * portanto um href direto não passa pela autorização do backend.
 *
 * Quem chama é responsável por revogar a URL com URL.revokeObjectURL().
 */
export async function fetchFileObjectUrl(fileId: number): Promise<string> {
  const token = localStorage.getItem('pbl_auth_token');

  const response = await fetch(`${API_BASE_URL}/files/download/${fileId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  if (!response.ok) {
    let mensagem = 'Não foi possível abrir o arquivo.';
    try {
      const erro = await response.json();
      mensagem = erro.message || mensagem;
    } catch {
      /* resposta sem corpo JSON */
    }
    throw new Error(mensagem);
  }

  return URL.createObjectURL(await response.blob());
}

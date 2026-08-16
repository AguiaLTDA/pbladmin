import { supabase } from './supabase';
import { User, PBLActivity, PBLVersion, PBLStep, StudentSubmission, NotificationItem, MandatoryFieldConfig } from '../types';

export const supabaseService = {
  // 1. Autenticação & Usuários
  async login(email: string, senha: string): Promise<{ token: string; usuario: User }> {
    // Busca usuário pelo e-mail na tabela usuarios
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('*, perfis(id, nome)')
      .eq('email', email)
      .eq('ativo', 1)
      .single();

    if (error || !usuario) {
      throw new Error('E-mail ou senha incorretos.');
    }

    // Em produção com Supabase Auth completo, usaria supabase.auth.signInWithPassword.
    // Para simplificar a demonstração sem alterar os hashes bcrypt, fazemos a verificação do usuário:
    const perfilNome = usuario.perfis?.nome || 'ALUNO';

    const userObj: User = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfilId: usuario.perfil_id,
      perfilNome: perfilNome as any,
      ativo: usuario.ativo
    };

    const dummyToken = `supabase-session-${usuario.id}-${Date.now()}`;
    return { token: dummyToken, usuario: userObj };
  },

  async getUserProfile(userId: number): Promise<User> {
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('*, perfis(id, nome)')
      .eq('id', userId)
      .single();

    if (error || !usuario) throw new Error('Usuário não encontrado.');

    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfilId: usuario.perfil_id,
      perfilNome: usuario.perfis?.nome || 'ALUNO',
      ativo: usuario.ativo
    };
  },

  // 2. Dashboard Stats
  async getDashboardStats(userId: number, role: string) {
    const { count: totalPbls } = await supabase.from('atividades_pbl').select('*', { count: 'exact', head: true });
    const { count: emAnalise } = await supabase.from('atividades_pbl').select('*', { count: 'exact', head: true }).eq('status', 'ENVIADO_ANALISE');
    const { count: publicados } = await supabase.from('atividades_pbl').select('*', { count: 'exact', head: true }).eq('status', 'PUBLICADO');
    const { count: entregasCount } = await supabase.from('entregas').select('*', { count: 'exact', head: true });

    return {
      totalPbls: totalPbls || 0,
      emAnalise: emAnalise || 0,
      publicados: publicados || 0,
      entregasCount: entregasCount || 0
    };
  },

  // 3. Atividades PBL
  async getActivities(userId?: number, role?: string): Promise<PBLActivity[]> {
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
    if (error) throw new Error(error.message);

    return (data || []).map((row: any) => {
      const pub = row.publicacoes && row.publicacoes.length > 0 ? row.publicacoes[0] : null;
      return {
        id: row.id,
        codigo_unico: row.codigo_unico,
        titulo: row.titulo,
        curso_id: row.curso_id,
        curso_nome: row.cursos?.nome,
        disciplina_id: row.disciplina_id,
        disciplina_nome: row.disciplinas?.nome,
        disciplina_codigo: row.disciplinas?.codigo,
        professor_id: row.professor_id,
        professor_nome: row.usuarios?.nome,
        professor_email: row.usuarios?.email,
        periodo_letivo_id: row.periodo_letivo_id,
        periodo_nome: row.periodos_letivos?.nome,
        status: row.status,
        versao_atual: row.versao_atual,
        criado_em: row.criado_em,
        atualizado_em: row.atualizado_em,
        publicacao_id: pub?.id,
        data_disponibilizacao: pub?.data_disponibilizacao,
        prazo_entrega: pub?.prazo_entrega,
        status_publicacao: pub?.status_publicacao
      };
    });
  },

  async getActivityById(id: number): Promise<{ atividade: PBLActivity; versao: PBLVersion; etapas: PBLStep[]; arquivos: any[] }> {
    const { data: atv, error: errAtv } = await supabase
      .from('atividades_pbl')
      .select(`
        *,
        cursos(id, nome),
        disciplinas(id, nome, codigo),
        usuarios(id, nome, email),
        periodos_letivos(id, nome)
      `)
      .eq('id', id)
      .single();

    if (errAtv || !atv) throw new Error('Atividade não encontrada.');

    // Versão Atual
    const { data: ver, error: errVer } = await supabase
      .from('versoes_atividades')
      .select('*, usuarios(nome)')
      .eq('atividade_id', id)
      .eq('numero_versao', atv.versao_atual)
      .single();

    if (errVer || !ver) throw new Error('Versão da atividade não encontrada.');

    // Etapas
    const { data: etapas } = await supabase
      .from('etapas_pbl')
      .select('*')
      .eq('versao_atividade_id', ver.id)
      .order('ordem', { ascending: true });

    const atividade: PBLActivity = {
      id: atv.id,
      codigo_unico: atv.codigo_unico,
      titulo: atv.titulo,
      curso_id: atv.curso_id,
      curso_nome: atv.cursos?.nome,
      disciplina_id: atv.disciplina_id,
      disciplina_nome: atv.disciplinas?.nome,
      disciplina_codigo: atv.disciplinas?.codigo,
      professor_id: atv.professor_id,
      professor_nome: atv.usuarios?.nome,
      professor_email: atv.usuarios?.email,
      periodo_letivo_id: atv.periodo_letivo_id,
      periodo_nome: atv.periodos_letivos?.nome,
      status: atv.status,
      versao_atual: atv.versao_atual,
      criado_em: atv.criado_em,
      atualizado_em: atv.atualizado_em
    };

    const versaoObj: PBLVersion = {
      ...ver,
      criado_por_nome: ver.usuarios?.nome
    };

    return { atividade, versao: versaoObj, etapas: etapas || [], arquivos: [] };
  },

  // 4. Salvar / Criar Atividade PBL
  async createActivity(payload: any): Promise<{ id: number; codigo_unico: string }> {
    const codigoUnico = `PBL-${Date.now().toString().slice(-6)}`;

    const { data: atv, error: errAtv } = await supabase
      .from('atividades_pbl')
      .insert({
        codigo_unico: codigoUnico,
        titulo: payload.titulo,
        curso_id: payload.curso_id,
        disciplina_id: payload.disciplina_id,
        professor_id: payload.professor_id,
        periodo_letivo_id: payload.periodo_letivo_id || 1,
        status: payload.submeterAnalise ? 'ENVIADO_ANALISE' : 'RASCUNHO',
        versao_atual: 1
      })
      .select()
      .single();

    if (errAtv || !atv) throw new Error('Erro ao criar atividade: ' + errAtv?.message);

    const { data: ver, error: errVer } = await supabase
      .from('versoes_atividades')
      .insert({
        atividade_id: atv.id,
        numero_versao: 1,
        contexto_problema: payload.contexto_problema,
        problema_central: payload.problema_central,
        objetivos_aprendizagem: payload.objetivos_aprendizagem,
        competencias_habilidades: payload.competencias_habilidades,
        conhecimentos_previos: payload.conhecimentos_previos,
        instrucoes_gerais: payload.instrucoes_gerais,
        perguntas_norteadoras: payload.perguntas_norteadoras,
        produtos_esperados: payload.produtos_esperados,
        forma_realizacao: payload.forma_realizacao || 'INDIVIDUAL',
        criterios_avaliacao: payload.criterios_avaliacao,
        carga_horaria_estimada: payload.carga_horaria_estimada || 10,
        criado_por: payload.professor_id
      })
      .select()
      .single();

    if (errVer || !ver) throw new Error('Erro ao criar versão da atividade: ' + errVer?.message);

    if (payload.etapas && Array.isArray(payload.etapas)) {
      const etapasPayload = payload.etapas.map((e: any, index: number) => ({
        versao_atividade_id: ver.id,
        ordem: index + 1,
        titulo: e.titulo,
        descricao: e.descricao || '',
        obrigatoria: e.obrigatoria ? 1 : 0
      }));
      await supabase.from('etapas_pbl').insert(etapasPayload);
    }

    return { id: atv.id, codigo_unico: codigoUnico };
  },

  // 5. Upload de Arquivos para Supabase Storage (Bucket: pbl-files)
  async uploadFile(file: File, userId: number): Promise<{ id: number; url: string; nome_original: string }> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('pbl-files')
      .upload(filePath, file);

    if (uploadError) {
      throw new Error('Erro no upload para Supabase Storage: ' + uploadError.message);
    }

    const { data: publicUrlData } = supabase.storage.from('pbl-files').getPublicUrl(filePath);

    // Registra metadados na tabela arquivos
    const { data: arqRecord, error: arqError } = await supabase
      .from('arquivos')
      .insert({
        nome_original: file.name,
        caminho_armazenado: publicUrlData.publicUrl,
        tamanho_bytes: file.size,
        mime_type: file.type || 'application/octet-stream',
        categoria: file.name.endsWith('.pdf') ? 'PDF' : 'DOCUMENTO',
        enviado_por: userId
      })
      .select()
      .single();

    if (arqError || !arqRecord) {
      throw new Error('Erro ao registrar metadados do arquivo.');
    }

    return { id: arqRecord.id, url: publicUrlData.publicUrl, nome_original: file.name };
  },

  // 6. Submeter Entrega de Aluno
  async submitStudentDelivery(publicacaoId: number, alunoId: number, conteudoResposta: string, file?: File): Promise<{ hash: string }> {
    let arquivoId: number | null = null;
    if (file) {
      const uploadRes = await this.uploadFile(file, alunoId);
      arquivoId = uploadRes.id;
    }

    const hashComprovante = `HASH-PBL-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const { data: entrega, error: errEntrega } = await supabase
      .from('entregas')
      .insert({
        publicacao_id: publicacaoId,
        aluno_id: alunoId,
        status: 'ENVIADO',
        conteudo_resposta: conteudoResposta,
        data_envio: new Date().toISOString(),
        comprovante_hash: hashComprovante
      })
      .select()
      .single();

    if (errEntrega || !entrega) throw new Error('Erro ao enviar entrega: ' + errEntrega?.message);

    if (arquivoId) {
      await supabase.from('arquivos_entregas').insert({
        entrega_id: entrega.id,
        arquivo_id: arquivoId
      });
    }

    return { hash: hashComprovante };
  },

  // 7. Notificações
  async getNotifications(userId: number): Promise<NotificationItem[]> {
    const { data, error } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('usuario_id', userId)
      .order('criado_em', { ascending: false });

    if (error) return [];
    return data || [];
  },

  // 8. Logs de Auditoria
  async getAuditLogs() {
    const { data, error } = await supabase
      .from('logs_auditoria')
      .select('*, usuarios(nome, email)')
      .order('criado_em', { ascending: false })
      .limit(50);

    if (error) return [];
    return data || [];
  }
};

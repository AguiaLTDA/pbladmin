import { Response } from 'express';
import { queryAsync, runAsync, getAsync } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../services/audit';
import { professorAlcancaAtividade } from '../services/horarioImport';

// --- CONFIGURAÇÃO DE CAMPOS OBRIGATÓRIOS ---
export async function getMandatoryFields(req: AuthenticatedRequest, res: Response) {
  try {
    const list = await queryAsync(`SELECT * FROM config_campos_obrigatorios ORDER BY id ASC`);
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao buscar campos obrigatórios.' });
  }
}

export async function updateMandatoryFields(req: AuthenticatedRequest, res: Response) {
  try {
    const { campos } = req.body; // Array of { nome_campo, obrigatorio }
    if (!Array.isArray(campos)) return res.status(400).json({ message: 'Formato inválido.' });

    for (const c of campos) {
      await runAsync(
        `UPDATE config_campos_obrigatorios SET obrigatorio = ?, atualizado_por = ?, atualizado_em = CURRENT_TIMESTAMP WHERE nome_campo = ?`,
        [c.obrigatorio ? 1 : 0, req.user?.id || null, c.nome_campo]
      );
    }

    await logAudit(req.user?.id || null, 'ATUALIZAR_CAMPOS_OBRIGATORIOS', 'config_campos_obrigatorios');
    return res.json({ message: 'Configuração de campos obrigatórios atualizada.' });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao atualizar campos obrigatórios.' });
  }
}

// --- CRIAR E EDITAR ATIVIDADE PBL (ADMIN) ---
// O Admin autora a atividade e a atribui a um professor já cadastrado
// (professor_id), que passa a enxergá-la e a avaliar as entregas dela.
export async function createPBLActivity(req: AuthenticatedRequest, res: Response) {
  try {
    const autorId = req.user?.id;
    if (!autorId) return res.status(401).json({ message: 'Não autenticado.' });

    const {
      titulo,
      cursoId,
      disciplinaId,
      periodoLetivoId,
      professorId: professorIdBody,
      contextoProblema,
      problemaCentral,
      objetivosAprendizagem,
      competenciasHabilidades,
      conhecimentosPrevios,
      instrucoesGerais,
      perguntasNorteadoras,
      produtosEsperados,
      formaRealizacao,
      criteriosAvaliacao,
      rubricaJson,
      cargaHorariaEstimada,
      observacoesProfessor,
      etapas // Array of { ordem, titulo, descricao, obrigatoria }
    } = req.body;

    if (!titulo || !cursoId || !disciplinaId || !periodoLetivoId || !professorIdBody) {
      return res.status(400).json({
        message: 'Título, curso, disciplina, período letivo e professor responsável são obrigatórios.'
      });
    }

    const professor = await getAsync<{ id: number }>(
      'SELECT id FROM usuarios WHERE id = ? AND perfil_id = 2 AND deletado_em IS NULL',
      [professorIdBody]
    );
    if (!professor) {
      return res.status(400).json({ message: 'Professor responsável inválido ou não encontrado.' });
    }
    const professorId = professor.id;

    // Generate Unique Code
    const codigoUnico = `PBL-${Date.now().toString(36).toUpperCase()}`;

    // 1. Create main activity row
    const actRes = await runAsync(
      `INSERT INTO atividades_pbl (codigo_unico, titulo, curso_id, disciplina_id, professor_id, periodo_letivo_id, status, versao_atual)
       VALUES (?, ?, ?, ?, ?, ?, 'RASCUNHO', 1)`,
      [codigoUnico, titulo, cursoId, disciplinaId, professorId, periodoLetivoId]
    );

    const atividadeId = actRes.lastID;

    // 2. Create version 1 row
    const verRes = await runAsync(
      `INSERT INTO versoes_atividades (
        atividade_id, numero_versao, contexto_problema, problema_central, objetivos_aprendizagem,
        competencias_habilidades, conhecimentos_previos, instrucoes_gerais, perguntas_norteadoras,
        produtos_esperados, forma_realizacao, criterios_avaliacao, rubrica_json, carga_horaria_estimada,
        observacoes_professor, criado_por
      ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        atividadeId,
        contextoProblema || '',
        problemaCentral || '',
        objetivosAprendizagem || '',
        competenciasHabilidades || '',
        conhecimentosPrevios || '',
        instrucoesGerais || '',
        perguntasNorteadoras || '',
        produtosEsperados || '',
        formaRealizacao || 'INDIVIDUAL',
        criteriosAvaliacao || '',
        rubricaJson ? JSON.stringify(rubricaJson) : null,
        cargaHorariaEstimada || 10,
        observacoesProfessor || '',
        autorId
      ]
    );

    // 3. Create stages if present
    if (Array.isArray(etapas)) {
      for (const e of etapas) {
        await runAsync(
          `INSERT INTO etapas_pbl (versao_atividade_id, ordem, titulo, descricao, obrigatoria) VALUES (?, ?, ?, ?, ?)`,
          [verRes.lastID, e.ordem || 1, e.titulo, e.descricao || '', e.obrigatoria !== false ? 1 : 0]
        );
      }
    }

    await logAudit(autorId, 'CRIAR_RASCUNHO_PBL', 'atividades_pbl', atividadeId, { codigoUnico, titulo, professorId });
    return res.status(201).json({ id: atividadeId, codigoUnico, message: 'Rascunho de atividade PBL criado com sucesso.' });
  } catch (err: any) {
    console.error('Error creating PBL:', err);
    return res.status(500).json({ message: 'Erro ao criar atividade PBL.' });
  }
}

// Update PBL Activity (Draft or Adjustment requested)
export async function updatePBLActivity(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const isTeacher = req.user?.perfilNome === 'PROFESSOR';

    const act = await getAsync<{ id: number; status: string; professor_id: number; versao_atual: number }>(
      'SELECT id, status, professor_id, versao_atual FROM atividades_pbl WHERE id = ? AND deletado_em IS NULL',
      [id]
    );

    if (!act) return res.status(404).json({ message: 'Atividade PBL não encontrada.' });

    if (isTeacher && act.professor_id !== userId) {
      return res.status(403).json({ message: 'Você só pode editar atividades criadas por você.' });
    }

    // Lock check: Teacher can only edit if status is RASCUNHO or AJUSTES_SOLICITADOS
    if (isTeacher && !['RASCUNHO', 'AJUSTES_SOLICITADOS'].includes(act.status)) {
      return res.status(403).json({
        message: `Esta atividade está com status '${act.status}' e encontra-se bloqueada para edição.`
      });
    }

    const {
      titulo,
      contextoProblema,
      problemaCentral,
      objetivosAprendizagem,
      competenciasHabilidades,
      conhecimentosPrevios,
      instrucoesGerais,
      perguntasNorteadoras,
      produtosEsperados,
      formaRealizacao,
      criteriosAvaliacao,
      rubricaJson,
      cargaHorariaEstimada,
      observacoesProfessor,
      observacoesInternasAdmin,
      etapas
    } = req.body;

    if (titulo) {
      await runAsync(`UPDATE atividades_pbl SET titulo = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`, [
        titulo,
        id
      ]);
    }

    let targetVersion = act.versao_atual;

    // If adjustments were requested and teacher is editing, generate NEW VERSION (v+1)
    if (act.status === 'AJUSTES_SOLICITADOS' && isTeacher) {
      targetVersion = act.versao_atual + 1;
      await runAsync(`UPDATE atividades_pbl SET versao_atual = ? WHERE id = ?`, [targetVersion, id]);
    }

    // Check if target version row exists, else insert
    const existingVer = await getAsync<{ id: number }>(
      'SELECT id FROM versoes_atividades WHERE atividade_id = ? AND numero_versao = ?',
      [id, targetVersion]
    );

    let versionId: number;

    if (existingVer) {
      versionId = existingVer.id;
      await runAsync(
        `UPDATE versoes_atividades SET 
          contexto_problema = ?, problema_central = ?, objetivos_aprendizagem = ?,
          competencias_habilidades = ?, conhecimentos_previos = ?, instrucoes_gerais = ?,
          perguntas_norteadoras = ?, produtos_esperados = ?, forma_realizacao = ?,
          criterios_avaliacao = ?, rubrica_json = ?, carga_horaria_estimada = ?,
          observacoes_professor = ?, observacoes_internas_admin = COALESCE(?, observacoes_internas_admin)
         WHERE id = ?`,
        [
          contextoProblema || '',
          problemaCentral || '',
          objetivosAprendizagem || '',
          competenciasHabilidades || '',
          conhecimentosPrevios || '',
          instrucoesGerais || '',
          perguntasNorteadoras || '',
          produtosEsperados || '',
          formaRealizacao || 'INDIVIDUAL',
          criteriosAvaliacao || '',
          rubricaJson ? JSON.stringify(rubricaJson) : null,
          cargaHorariaEstimada || 10,
          observacoesProfessor || '',
          observacoesInternasAdmin || null,
          versionId
        ]
      );
    } else {
      const verRes = await runAsync(
        `INSERT INTO versoes_atividades (
          atividade_id, numero_versao, contexto_problema, problema_central, objetivos_aprendizagem,
          competencias_habilidades, conhecimentos_previos, instrucoes_gerais, perguntas_norteadoras,
          produtos_esperados, forma_realizacao, criterios_avaliacao, rubrica_json, carga_horaria_estimada,
          observacoes_professor, observacoes_internas_admin, criado_por
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          targetVersion,
          contextoProblema || '',
          problemaCentral || '',
          objetivosAprendizagem || '',
          competenciasHabilidades || '',
          conhecimentosPrevios || '',
          instrucoesGerais || '',
          perguntasNorteadoras || '',
          produtosEsperados || '',
          formaRealizacao || 'INDIVIDUAL',
          criteriosAvaliacao || '',
          rubricaJson ? JSON.stringify(rubricaJson) : null,
          cargaHorariaEstimada || 10,
          observacoesProfessor || '',
          observacoesInternasAdmin || '',
          userId
        ]
      );
      versionId = verRes.lastID;
    }

    // Update stages
    if (Array.isArray(etapas)) {
      await runAsync(`DELETE FROM etapas_pbl WHERE versao_atividade_id = ?`, [versionId]);
      for (const e of etapas) {
        await runAsync(
          `INSERT INTO etapas_pbl (versao_atividade_id, ordem, titulo, descricao, obrigatoria) VALUES (?, ?, ?, ?, ?)`,
          [versionId, e.ordem || 1, e.titulo, e.descricao || '', e.obrigatoria !== false ? 1 : 0]
        );
      }
    }

    await logAudit(userId || null, 'ATUALIZAR_PBL', 'atividades_pbl', String(id), { versao: targetVersion });
    return res.json({ message: 'Atividade PBL atualizada com sucesso.', versao: targetVersion });
  } catch (err) {
    console.error('Update PBL error:', err);
    return res.status(500).json({ message: 'Erro ao atualizar atividade PBL.' });
  }
}

// Submit PBL Activity to Admin Analysis
export async function submitForAnalysis(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const act = await getAsync<{ id: number; status: string; professor_id: number; versao_atual: number }>(
      'SELECT id, status, professor_id, versao_atual FROM atividades_pbl WHERE id = ? AND deletado_em IS NULL',
      [String(id)]
    );

    if (!act) return res.status(404).json({ message: 'Atividade não encontrada.' });

    // Validate mandatory fields before submitting
    const mandatoryConfigs = await queryAsync<{ nome_campo: string; rotulo: string }>(
      'SELECT nome_campo, rotulo FROM config_campos_obrigatorios WHERE obrigatorio = 1'
    );

    const versionRow = await getAsync<any>(
      'SELECT * FROM versoes_atividades WHERE atividade_id = ? AND numero_versao = ?',
      [id, act.versao_atual]
    );

    if (versionRow) {
      const missingFields: string[] = [];
      for (const m of mandatoryConfigs) {
        const val = versionRow[m.nome_campo];
        if (!val || String(val).trim() === '') {
          missingFields.push(m.rotulo);
        }
      }

      if (missingFields.length > 0) {
        return res.status(400).json({
          message: `Não é possível enviar para análise. Preencha os campos obrigatórios: ${missingFields.join(', ')}`
        });
      }
    }

    const newStatus = act.status === 'AJUSTES_SOLICITADOS' ? 'REENVIADO' : 'ENVIADO_ANALISE';

    await runAsync(`UPDATE atividades_pbl SET status = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`, [
      newStatus,
      id
    ]);

    // Notify Administrators
    const admins = await queryAsync<{ id: number }>('SELECT id FROM usuarios WHERE perfil_id = 1 AND ativo = 1');
    for (const admin of admins) {
      await runAsync(
        `INSERT INTO notificacoes (usuario_id, titulo, mensagem, link) VALUES (?, ?, ?, ?)`,
        [
          admin.id,
          'Nova Atividade Submetida para Análise',
          `Uma atividade PBL foi submetida pelo professor e aguarda revisão.`,
          `/admin/revisao/${id}`
        ]
      );
    }

    await logAudit(userId || null, 'SUBMETER_PARA_ANALISE', 'atividades_pbl', String(id), { status: newStatus });
    return res.json({ message: 'Atividade enviada para análise da administração com sucesso.', status: newStatus });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao enviar atividade para análise.' });
  }
}

// LIST ACTIVITIES (With filters by role)
export async function listPBLActivities(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;
    const { status, cursoId, busca } = req.query;

    let sql = `
      SELECT a.*, c.nome as curso_nome, d.nome as disciplina_nome, d.codigo as disciplina_codigo,
             p.nome as professor_nome, pl.nome as periodo_nome
      FROM atividades_pbl a
      JOIN cursos c ON a.curso_id = c.id
      JOIN disciplinas d ON a.disciplina_id = d.id
      JOIN usuarios p ON a.professor_id = p.id
      JOIN periodos_letivos pl ON a.periodo_letivo_id = pl.id
      WHERE a.deletado_em IS NULL
    `;
    const params: any[] = [];

    // Role filtering:
    // PROFESSOR: atividades que ele criou OU das disciplinas/turmas que leciona
    // conforme o horário acadêmico.
    if (user?.perfilNome === 'PROFESSOR') {
      sql += ` AND (
        a.professor_id = ?
        OR EXISTS (
          SELECT 1 FROM vinculos_professores vp
          WHERE vp.usuario_id = ? AND vp.ativo = 1 AND vp.disciplina_id = a.disciplina_id
        )
        OR EXISTS (
          SELECT 1 FROM alunos_segmentados als
          JOIN matriculas m ON m.usuario_id = als.aluno_id AND m.deletado_em IS NULL
          JOIN vinculos_professores vp ON vp.turma_id = m.turma_id
          WHERE als.atividade_id = a.id AND vp.usuario_id = ? AND vp.ativo = 1
        )
      )`;
      params.push(user.id, user.id, user.id);
    }

    // ALUNO: Handled separately via student endpoint, but if called here, restrict to PUBLICADO
    if (user?.perfilNome === 'ALUNO') {
      return res.status(403).json({ message: 'Utilize o portal do aluno para consultar atividades.' });
    }

    if (status) {
      sql += ` AND a.status = ?`;
      params.push(status);
    }

    if (cursoId) {
      sql += ` AND a.curso_id = ?`;
      params.push(cursoId);
    }

    if (busca) {
      sql += ` AND (LOWER(a.titulo) LIKE LOWER(?) OR LOWER(a.codigo_unico) LIKE LOWER(?))`;
      params.push(`%${busca}%`, `%${busca}%`);
    }

    sql += ` ORDER BY a.atualizado_em DESC`;

    const list = await queryAsync(sql, params);
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao listar atividades PBL.' });
  }
}

// GET SINGLE ACTIVITY DETAILS & VERSIONS
export async function getPBLDetails(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const user = req.user;

    const act = await getAsync<any>(
      `SELECT a.*, c.nome as curso_nome, d.nome as disciplina_nome, d.codigo as disciplina_codigo,
              p.nome as professor_nome, p.email as professor_email, pl.nome as periodo_nome
       FROM atividades_pbl a
       JOIN cursos c ON a.curso_id = c.id
       JOIN disciplinas d ON a.disciplina_id = d.id
       JOIN usuarios p ON a.professor_id = p.id
       JOIN periodos_letivos pl ON a.periodo_letivo_id = pl.id
       WHERE a.id = ? AND a.deletado_em IS NULL`,
      [String(id)]
    );

    if (!act) return res.status(404).json({ message: 'Atividade não encontrada.' });

    // Permissions check: autor da atividade ou docente das turmas/disciplinas alcançadas.
    if (user?.perfilNome === 'PROFESSOR' && !(await professorAlcancaAtividade(user.id, String(id)))) {
      return res.status(403).json({
        message: 'Acesso negado. Esta atividade não pertence a você nem às turmas que você leciona.'
      });
    }

    // Fetch all versions
    const versions = await queryAsync(
      `SELECT v.*, u.nome as criado_por_nome 
       FROM versoes_atividades v 
       JOIN usuarios u ON v.criado_por = u.id 
       WHERE v.atividade_id = ? 
       ORDER BY v.numero_versao DESC`,
      [id]
    );

    // Fetch current version details & steps
    const currentVersionRow = versions.find((v: any) => v.numero_versao === act.versao_atual) || versions[0];
    let etapas: any[] = [];
    if (currentVersionRow) {
      etapas = await queryAsync(
        `SELECT * FROM etapas_pbl WHERE versao_atividade_id = ? ORDER BY ordem ASC`,
        [currentVersionRow.id]
      );
    }

    // Fetch administrative review history
    const analises = await queryAsync(
      `SELECT aa.*, u.nome as analista_nome 
       FROM analises_administrativas aa 
       JOIN usuarios u ON aa.analista_id = u.id 
       WHERE aa.atividade_id = ? 
       ORDER BY aa.criado_em DESC`,
      [id]
    );

    const comentarios = await queryAsync(
      `SELECT c.*, u.nome as autor_nome, u.perfil_id 
       FROM comentarios_revisao c 
       JOIN usuarios u ON c.autor_id = u.id 
       WHERE c.atividade_id = ? 
       ORDER BY c.criado_em ASC`,
      [id]
    );

    // Fetch attached files
    const arquivos = await queryAsync(
      `SELECT ar.*, aa.aprovado_pelo_admin, aa.versao_material
       FROM arquivos_atividades aa
       JOIN arquivos ar ON aa.arquivo_id = ar.id
       WHERE aa.versao_atividade_id = ? AND ar.deletado_em IS NULL`,
      [currentVersionRow?.id || 0]
    );

    return res.json({
      atividade: act,
      versaoAtual: currentVersionRow,
      etapas,
      versoes: versions,
      analises,
      comentarios,
      arquivos
    });
  } catch (err) {
    console.error('Error fetching PBL details:', err);
    return res.status(500).json({ message: 'Erro ao buscar detalhes da atividade PBL.' });
  }
}

// --- ADMIN REVIEW ACTIONS: APPROVE / REJECT / REQUEST ADJUSTMENTS ---
export async function reviewPBLActivity(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const adminId = req.user?.id;
    const { decisao, justificativa, observacoesInternas } = req.body;

    if (!adminId) return res.status(401).json({ message: 'Não autenticado.' });
    if (!['APROVADO', 'REPROVADO', 'AJUSTES_SOLICITADOS'].includes(decisao)) {
      return res.status(400).json({ message: 'Decisão de análise inválida.' });
    }

    if (decisao === 'AJUSTES_SOLICITADOS' && (!justificativa || justificativa.trim() === '')) {
      return res.status(400).json({ message: 'A justificativa é OBRIGATÓRIA ao solicitar ajustes ao professor.' });
    }

    const act = await getAsync<{ id: number; titulo: string; professor_id: number; versao_atual: number; status: string }>(
      'SELECT id, titulo, professor_id, versao_atual, status FROM atividades_pbl WHERE id = ?',
      [id]
    );

    if (!act) return res.status(404).json({ message: 'Atividade não encontrada.' });

    let newStatus = decisao;
    if (decisao === 'APROVADO') newStatus = 'APROVADO';
    if (decisao === 'REPROVADO') newStatus = 'REPROVADO';
    if (decisao === 'AJUSTES_SOLICITADOS') newStatus = 'AJUSTES_SOLICITADOS';

    // 1. Record decision in analises_administrativas
    await runAsync(
      `INSERT INTO analises_administrativas (atividade_id, versao_analisada, analista_id, decisao, justificativa)
       VALUES (?, ?, ?, ?, ?)`,
      [id, act.versao_atual, adminId, decisao, justificativa || 'Analise concluida pelo setor administrativo.']
    );

    // 2. Update status in atividades_pbl
    await runAsync(`UPDATE atividades_pbl SET status = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`, [
      newStatus,
      id
    ]);

    // 3. Update internal admin notes in versoes_atividades if provided
    if (observacoesInternas) {
      await runAsync(
        `UPDATE versoes_atividades SET observacoes_internas_admin = ? WHERE atividade_id = ? AND numero_versao = ?`,
        [observacoesInternas, id, act.versao_atual]
      );
    }

    // 4. Notify the assigned professor (informativo — quem edita agora é o Admin)
    await runAsync(
      `INSERT INTO notificacoes (usuario_id, titulo, mensagem, link) VALUES (?, ?, ?, ?)`,
      [
        act.professor_id,
        `Resultado da Análise PBL: ${decisao.replace('_', ' ')}`,
        decisao === 'AJUSTES_SOLICITADOS'
          ? `A administração solicitou ajustes na atividade vinculada a você. Motivo: ${justificativa}`
          : `A atividade vinculada a você foi ${decisao.toLowerCase()} pela administração.`,
        `/professor/dashboard`
      ]
    );

    // 5. Se precisa de ajustes, avisa os admins — são eles que agora editam o conteúdo
    if (decisao === 'AJUSTES_SOLICITADOS') {
      const admins = await queryAsync<{ id: number }>('SELECT id FROM usuarios WHERE perfil_id = 1 AND ativo = 1');
      for (const admin of admins) {
        await runAsync(
          `INSERT INTO notificacoes (usuario_id, titulo, mensagem, link) VALUES (?, ?, ?, ?)`,
          [
            admin.id,
            'Atividade PBL Aguardando Ajustes',
            `A atividade "${act.titulo}" precisa de ajustes antes de seguir para publicação.`,
            `/admin/pbl/editar/${id}`
          ]
        );
      }
    }

    await logAudit(adminId, `REVISAO_${decisao}`, 'atividades_pbl', String(id), { decisao, justificativa });
    return res.json({ message: `Atividade atualizada para '${newStatus}'.`, status: newStatus });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao registrar análise da atividade.' });
  }
}

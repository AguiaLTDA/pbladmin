import { Response, Request } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { queryAsync, runAsync, getAsync } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../services/audit';
import { enviarLinkVerificacao } from './authController';
import { emailConfigurado } from '../services/email';

/**
 * Mostra o e-mail de um cadastro existente sem entregá-lo por inteiro: o dono
 * reconhece o próprio endereço, mas a tela pública de cadastro não vira uma
 * fonte de e-mails de estudantes para quem só tem o número da matrícula.
 */
function mascararEmail(email: string): string {
  const [usuario, dominio] = String(email).split('@');
  if (!dominio) return '***';
  const visivel = usuario.slice(0, 3);
  return `${visivel}${usuario.length > 3 ? '***' : ''}@${dominio}`;
}

function gerarSenhaTemporaria(): string {
  // 10 caracteres alfanuméricos, fáceis de ditar/transcrever para o aluno.
  return crypto.randomBytes(8).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
}

/**
 * PUBLIC: autocadastro de estudante (antes do login).
 *
 * Não existe mais fila de aprovação: a conta do aluno nasce ativa e ele já entra
 * no portal com o e-mail e a senha que acabou de definir. O registro em
 * `pre_cadastros` deixa de ser "fila" e passa a ser o cadastro acadêmico
 * (matrícula, CPF, curso, turma informada) que a coordenação consulta.
 */
export async function criarPreCadastro(req: Request, res: Response) {
  try {
    const { nome, email, matricula, cpf, telefone, curso, turma, periodo, origem, senha } = req.body;

    if (!nome || !email || !matricula || !curso) {
      return res.status(400).json({ message: 'Nome, e-mail, matrícula e curso são obrigatórios.' });
    }

    const origemFinal = origem === 'ADMIN' ? 'ADMIN' : 'AUTOCADASTRO';
    if (origemFinal === 'AUTOCADASTRO' && !senha) {
      return res.status(400).json({ message: 'Defina a senha de acesso ao portal.' });
    }
    if (senha && String(senha).length < 6) {
      return res.status(400).json({ message: 'A senha deve ter no mínimo 6 caracteres.' });
    }

    const contaExistente = await getAsync<{ id: number }>('SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?)', [
      email
    ]);
    if (contaExistente) {
      return res.status(409).json({
        codigo: 'EMAIL_JA_CADASTRADO',
        message:
          'Já existe uma conta com este e-mail. Entre normalmente ou use "Esqueci minha senha" para recuperar o acesso.'
      });
    }

    // O mesmo estudante não pode se cadastrar duas vezes trocando de e-mail:
    // matrícula e CPF identificam a pessoa, o e-mail não. `usuarios.email` já é
    // único no banco, então aqui cobrimos os outros dois documentos.
    const matriculaNormalizada = String(matricula).trim();
    const cadastroMesmaMatricula = await getAsync<{ id: number; email: string; nome: string }>(
      `SELECT id, email, nome FROM pre_cadastros
        WHERE LOWER(matricula) = LOWER(?) AND deletado_em IS NULL
        ORDER BY criado_em ASC LIMIT 1`,
      [matriculaNormalizada]
    );
    if (cadastroMesmaMatricula) {
      return res.status(409).json({
        codigo: 'MATRICULA_JA_CADASTRADA',
        message:
          `A matrícula ${matriculaNormalizada} já tem cadastro no portal, feito com o e-mail ` +
          `${mascararEmail(cadastroMesmaMatricula.email)}. Se for você, entre com esse e-mail ou use ` +
          '"Esqueci minha senha". Se não reconhece esse endereço, procure a coordenação.'
      });
    }

    const cpfNormalizado = cpf ? String(cpf).replace(/\D/g, '') : '';
    if (cpfNormalizado) {
      const cadastroMesmoCpf = await getAsync<{ id: number; email: string }>(
        // `[^0-9]` e não `\D`: dentro de template literal o JS consome a barra
        // invertida e o Postgres receberia 'D', apagando a letra D em vez dos
        // separadores — a comparação nunca casaria.
        `SELECT id, email FROM pre_cadastros
          WHERE REGEXP_REPLACE(COALESCE(cpf, ''), '[^0-9]', '', 'g') = ? AND deletado_em IS NULL
          ORDER BY criado_em ASC LIMIT 1`,
        [cpfNormalizado]
      );
      if (cadastroMesmoCpf) {
        return res.status(409).json({
          codigo: 'CPF_JA_CADASTRADO',
          message:
            `Este CPF já tem cadastro no portal, feito com o e-mail ${mascararEmail(cadastroMesmoCpf.email)}. ` +
            'Se for você, entre com esse e-mail ou use "Esqueci minha senha".'
        });
      }
    }

    const perfilAluno = await getAsync<{ id: number }>(`SELECT id FROM perfis WHERE nome = 'ALUNO'`);
    if (!perfilAluno) {
      return res.status(500).json({ message: 'Perfil ALUNO não está configurado no sistema.' });
    }

    // Quando o admin cadastra alguém sem definir senha, geramos uma temporária
    // para ele repassar; no autocadastro a senha vem sempre do próprio aluno.
    const senhaTemporaria = senha ? undefined : gerarSenhaTemporaria();
    const senhaHash = await bcrypt.hash(String(senha || senhaTemporaria), 10);

    // Autocadastro nasce sem e-mail validado e o login fica travado até o aluno
    // clicar no link. Duas exceções, ambas por necessidade prática:
    // - origem ADMIN: quem cria é a coordenação, que já repassa a senha na mão;
    // - envio de e-mail não configurado: sem provedor não existe link para
    //   clicar, e travar seria trancar o aluno fora do portal sem saída.
    const exigeValidacao = origemFinal === 'AUTOCADASTRO' && emailConfigurado();
    const novoUsuario = await runAsync(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil_id, ativo, email_verificado_em)
       VALUES (?, ?, ?, ?, 1, ${exigeValidacao ? 'NULL' : 'CURRENT_TIMESTAMP'})`,
      [nome, email, senhaHash, perfilAluno.id]
    );

    // Cadastro da fila antiga para este mesmo e-mail: aproveita a linha em vez de
    // duplicar, já dando baixa nela (a senha guardada ali não serve mais).
    const registroAnterior = await getAsync<{ id: number }>(
      `SELECT id FROM pre_cadastros WHERE LOWER(email) = LOWER(?) AND status = 'PENDENTE'`,
      [email]
    );

    let registroId: number;
    if (registroAnterior) {
      await runAsync(
        `UPDATE pre_cadastros
         SET nome = ?, matricula = ?, cpf = ?, telefone = ?, curso = ?, turma = ?, periodo = ?,
             origem = ?, status = 'APROVADO', usuario_id = ?, senha_hash = NULL,
             atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          nome,
          matricula,
          cpf || null,
          telefone || null,
          curso,
          turma || null,
          periodo || null,
          origemFinal,
          novoUsuario.lastID,
          registroAnterior.id
        ]
      );
      registroId = registroAnterior.id;
    } else {
      const resInsert = await runAsync(
        `INSERT INTO pre_cadastros (nome, email, matricula, cpf, telefone, curso, turma, periodo, origem, status, usuario_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'APROVADO', ?)`,
        [
          nome,
          email,
          matricula,
          cpf || null,
          telefone || null,
          curso,
          turma || null,
          periodo || null,
          origemFinal,
          novoUsuario.lastID
        ]
      );
      registroId = resInsert.lastID;
    }

    await logAudit(novoUsuario.lastID, 'AUTOCADASTRO_ALUNO', 'usuarios', novoUsuario.lastID, {
      email,
      origem: origemFinal
    });

    let validacaoEnviada = false;
    let avisoEnvio: string | undefined;
    if (exigeValidacao) {
      try {
        validacaoEnviada = await enviarLinkVerificacao(novoUsuario.lastID, nome, email);
      } catch (erroEnvio) {
        // A conta já existe; sem o e-mail o aluno usa "reenviar link" na tela de
        // login. Derrubar o cadastro aqui o obrigaria a digitar tudo de novo.
        console.error('Falha ao enviar e-mail de validação do cadastro:', erroEnvio);
        avisoEnvio =
          'Não conseguimos enviar o e-mail de validação agora. Na tela de login, use ' +
          '"Reenviar e-mail de validação" para tentar de novo.';
      }
    }

    const mensagem = senhaTemporaria
      ? 'Conta de aluno criada. Repasse a senha temporária ao estudante.'
      : validacaoEnviada
        ? `Cadastro recebido! Enviamos um e-mail para ${email} — clique no link de confirmação para liberar o acesso.`
        : avisoEnvio ||
          'Cadastro concluído! Sua conta já está ativa e o acesso ao portal está liberado.';

    return res.status(201).json({
      id: registroId,
      usuarioId: novoUsuario.lastID,
      status: 'APROVADO',
      email,
      senhaTemporaria,
      validacaoPendente: exigeValidacao,
      validacaoEnviada,
      message: mensagem
    });
  } catch (err) {
    console.error('Erro ao criar cadastro de estudante:', err);
    return res.status(500).json({ message: 'Erro ao registrar o cadastro.' });
  }
}

// ADMIN: lista pré-cadastros (com filtro opcional de status)
export async function listarPreCadastros(req: AuthenticatedRequest, res: Response) {
  try {
    const { status } = req.query;
    // Nunca expõe `senha_hash` para o frontend — mesmo hasheada, não tem por que sair do servidor.
    // `grupos_nomes` e `total_matriculas` alimentam o alerta de "sem grupo" na
    // lista do admin: o aluno pode ter conta e turma e ainda não ter escolhido
    // grupo, e é justamente esse o caso que a coordenação precisa cobrar.
    let sql = `SELECT pc.id, pc.nome, pc.email, pc.matricula, pc.cpf, pc.telefone, pc.curso, pc.turma,
                      pc.periodo, pc.origem, pc.status, pc.usuario_id, pc.aprovado_por,
                      pc.justificativa_rejeicao, pc.criado_em, pc.atualizado_em,
                      (SELECT COUNT(*) FROM matriculas m
                        WHERE m.usuario_id = pc.usuario_id AND m.deletado_em IS NULL) as total_matriculas,
                      (SELECT string_agg(DISTINCT g.nome, ' • ') FROM matriculas m
                         JOIN grupos g ON m.grupo_id = g.id AND g.deletado_em IS NULL AND g.ativo = 1
                        WHERE m.usuario_id = pc.usuario_id AND m.deletado_em IS NULL) as grupos_nomes
               FROM pre_cadastros pc
               WHERE pc.deletado_em IS NULL`;
    const params: any[] = [];

    if (status) {
      sql += ` AND pc.status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY pc.criado_em DESC`;

    const lista = await queryAsync(sql, params);
    return res.json(lista);
  } catch (err) {
    console.error('Erro ao listar pré-cadastros:', err);
    return res.status(500).json({ message: 'Erro ao listar pré-cadastros.' });
  }
}

// ADMIN: aprova o pré-cadastro e cria a conta real do aluno
export async function aprovarPreCadastro(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    const preCadastro = await getAsync<{
      id: number;
      nome: string;
      email: string;
      status: string;
      senha_hash: string | null;
    }>('SELECT * FROM pre_cadastros WHERE id = ?', [id]);

    if (!preCadastro) return res.status(404).json({ message: 'Pré-cadastro não encontrado.' });
    if (preCadastro.status !== 'PENDENTE') {
      return res.status(400).json({ message: `Este pré-cadastro já foi ${preCadastro.status.toLowerCase()}.` });
    }

    const contaExistente = await getAsync<{ id: number }>(
      'SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?)',
      [preCadastro.email]
    );
    if (contaExistente) {
      return res.status(409).json({ message: 'Já existe uma conta de usuário com este e-mail.' });
    }

    const perfilAluno = await getAsync<{ id: number }>(`SELECT id FROM perfis WHERE nome = 'ALUNO'`);
    if (!perfilAluno) {
      return res.status(500).json({ message: 'Perfil ALUNO não está configurado no sistema.' });
    }

    // O aluno já escolheu a própria senha no autocadastro — só nesse caso não existe
    // `senha_hash` (ex.: pré-cadastro antigo ou criado pelo admin sem senha) é que
    // caímos de volta no fluxo de gerar uma senha temporária para repassar ao aluno.
    const senhaTemporaria = preCadastro.senha_hash ? undefined : gerarSenhaTemporaria();
    const senhaHash = preCadastro.senha_hash || (await bcrypt.hash(senhaTemporaria as string, 10));

    const novoUsuario = await runAsync(
      // Aprovacao manual pela coordenacao vale como validacao do e-mail.
      `INSERT INTO usuarios (nome, email, senha_hash, perfil_id, ativo, email_verificado_em)
       VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
      [preCadastro.nome, preCadastro.email, senhaHash, perfilAluno.id]
    );

    await runAsync(
      `UPDATE pre_cadastros
       SET status = 'APROVADO', usuario_id = ?, aprovado_por = ?, atualizado_em = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [novoUsuario.lastID, req.user?.id || null, id]
    );

    await logAudit(req.user?.id || null, 'APROVAR_PRE_CADASTRO', 'pre_cadastros', String(id), {
      email: preCadastro.email,
      usuarioId: novoUsuario.lastID
    });

    return res.json({
      message: senhaTemporaria
        ? 'Cadastro aprovado. Conta de aluno criada com sucesso.'
        : 'Cadastro aprovado. O aluno já pode entrar com a senha que definiu no cadastro.',
      usuarioId: novoUsuario.lastID,
      email: preCadastro.email,
      senhaTemporaria
    });
  } catch (err) {
    console.error('Erro ao aprovar pré-cadastro:', err);
    return res.status(500).json({ message: 'Erro ao aprovar o pré-cadastro.' });
  }
}

// ADMIN: rejeita o pré-cadastro
export async function rejeitarPreCadastro(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { justificativa } = req.body;

    const preCadastro = await getAsync<{ id: number; status: string }>('SELECT * FROM pre_cadastros WHERE id = ?', [
      id
    ]);
    if (!preCadastro) return res.status(404).json({ message: 'Pré-cadastro não encontrado.' });
    if (preCadastro.status !== 'PENDENTE') {
      return res.status(400).json({ message: `Este pré-cadastro já foi ${preCadastro.status.toLowerCase()}.` });
    }

    await runAsync(
      `UPDATE pre_cadastros
       SET status = 'REJEITADO', justificativa_rejeicao = ?, aprovado_por = ?, atualizado_em = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [justificativa || null, req.user?.id || null, id]
    );

    await logAudit(req.user?.id || null, 'REJEITAR_PRE_CADASTRO', 'pre_cadastros', String(id), { justificativa });

    return res.json({ message: 'Pré-cadastro rejeitado.' });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao rejeitar o pré-cadastro.' });
  }
}

// --- EXCLUSÃO DE ESTUDANTES PELA COORDENADORIA ---
// A exclusão é lógica nas duas pontas: o cadastro sai da lista e a conta do
// aluno perde o acesso (o login exige `deletado_em IS NULL`). As matrículas
// ficam intactas, mas as consultas de turma/grupo ignoram aluno excluído — por
// isso restaurar devolve o estudante exatamente como estava, com grupo e tudo.

/** ADMIN: exclui o cadastro do estudante e, se houver conta, o acesso dela. */
export async function excluirPreCadastro(req: AuthenticatedRequest, res: Response) {
  try {
    const adminId = req.user?.id;
    const { id } = req.params;

    const preCadastro = await getAsync<{
      id: number;
      nome: string;
      email: string;
      usuario_id: number | null;
      deletado_em: string | null;
    }>('SELECT id, nome, email, usuario_id, deletado_em FROM pre_cadastros WHERE id = ?', [id]);

    if (!preCadastro) return res.status(404).json({ message: 'Cadastro não encontrado.' });
    if (preCadastro.deletado_em) return res.status(400).json({ message: 'Este cadastro já está excluído.' });

    await runAsync(
      `UPDATE pre_cadastros SET deletado_em = CURRENT_TIMESTAMP, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );

    // Sem isso o aluno continuaria entrando no portal com a conta dele.
    if (preCadastro.usuario_id) {
      await runAsync(
        `UPDATE usuarios SET deletado_em = CURRENT_TIMESTAMP, ativo = 0, atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [preCadastro.usuario_id]
      );
    }

    await logAudit(adminId || null, 'EXCLUIR_CADASTRO_ESTUDANTE', 'pre_cadastros', String(id), {
      email: preCadastro.email,
      usuarioId: preCadastro.usuario_id
    });

    return res.json({
      message: preCadastro.usuario_id
        ? `Cadastro de ${preCadastro.nome} excluído e acesso revogado. Pode ser restaurado.`
        : `Cadastro de ${preCadastro.nome} excluído. Pode ser restaurado.`
    });
  } catch (err) {
    console.error('Erro ao excluir cadastro de estudante:', err);
    return res.status(500).json({ message: 'Erro ao excluir o cadastro.' });
  }
}

/** ADMIN: cadastros de estudantes excluídos (a "lixeira"). */
export async function listarPreCadastrosExcluidos(req: AuthenticatedRequest, res: Response) {
  try {
    const lista = await queryAsync(
      `SELECT id, nome, email, matricula, curso, turma, periodo, status, usuario_id, criado_em, deletado_em
       FROM pre_cadastros
       WHERE deletado_em IS NOT NULL
       ORDER BY deletado_em DESC`
    );
    return res.json(lista);
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao listar os cadastros excluídos.' });
  }
}

/** ADMIN: restaura o cadastro e devolve o acesso da conta do aluno. */
export async function restaurarPreCadastro(req: AuthenticatedRequest, res: Response) {
  try {
    const adminId = req.user?.id;
    const { id } = req.params;

    const preCadastro = await getAsync<{
      id: number;
      nome: string;
      email: string;
      usuario_id: number | null;
      deletado_em: string | null;
    }>('SELECT id, nome, email, usuario_id, deletado_em FROM pre_cadastros WHERE id = ?', [id]);

    if (!preCadastro) return res.status(404).json({ message: 'Cadastro não encontrado.' });
    if (!preCadastro.deletado_em) return res.status(400).json({ message: 'Este cadastro não está excluído.' });

    // Enquanto esteve excluído, o e-mail pode ter sido usado por outra conta:
    // devolver o acesso criaria dois logins iguais.
    const conflito = await getAsync<{ id: number }>(
      `SELECT id FROM usuarios
       WHERE LOWER(email) = LOWER(?) AND deletado_em IS NULL AND id != ?`,
      [preCadastro.email, preCadastro.usuario_id || 0]
    );
    if (conflito) {
      return res.status(409).json({
        message: 'Já existe outra conta ativa com este e-mail. Desative-a antes de restaurar este cadastro.'
      });
    }

    await runAsync(
      `UPDATE pre_cadastros SET deletado_em = NULL, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );

    if (preCadastro.usuario_id) {
      await runAsync(
        `UPDATE usuarios SET deletado_em = NULL, ativo = 1, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`,
        [preCadastro.usuario_id]
      );
    }

    await logAudit(adminId || null, 'RESTAURAR_CADASTRO_ESTUDANTE', 'pre_cadastros', String(id), {
      email: preCadastro.email,
      usuarioId: preCadastro.usuario_id
    });

    return res.json({ message: `Cadastro de ${preCadastro.nome} restaurado, com o acesso de volta.` });
  } catch (err) {
    console.error('Erro ao restaurar cadastro de estudante:', err);
    return res.status(500).json({ message: 'Erro ao restaurar o cadastro.' });
  }
}

/**
 * ADMIN: corrige os dados de um cadastro de estudante — inclusive o e-mail.
 *
 * Existe porque, com a validação por e-mail ativa, um endereço digitado errado
 * trancava o aluno fora do portal sem saída: ele não recebia o link, não
 * recuperava a senha e não podia se recadastrar (a matrícula já estava tomada).
 *
 * Trocar o e-mail invalida a validação anterior e dispara um link novo para o
 * endereço corrigido — o endereço novo ainda não foi provado por ninguém.
 */
export async function atualizarPreCadastro(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { nome, email, matricula, cpf, telefone, curso, turma, periodo } = req.body;

    if (!nome || !email || !matricula || !curso) {
      return res.status(400).json({ message: 'Nome, e-mail, matrícula e curso são obrigatórios.' });
    }

    const atual = await getAsync<{
      id: number;
      email: string;
      usuario_id: number | null;
    }>('SELECT id, email, usuario_id FROM pre_cadastros WHERE id = ? AND deletado_em IS NULL', [id]);
    if (!atual) return res.status(404).json({ message: 'Cadastro não encontrado.' });

    const emailNovo = String(email).trim();
    const emailMudou = emailNovo.toLowerCase() !== atual.email.toLowerCase();

    // As mesmas travas do autocadastro, ignorando o próprio registro.
    if (emailMudou) {
      const conflito = await getAsync<{ id: number }>(
        `SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?) AND id != ?`,
        [emailNovo, atual.usuario_id ?? 0]
      );
      if (conflito) {
        return res.status(409).json({
          codigo: 'EMAIL_JA_CADASTRADO',
          message: 'Já existe outra conta com este e-mail.'
        });
      }
    }

    const matriculaNova = String(matricula).trim();
    const conflitoMatricula = await getAsync<{ id: number; nome: string }>(
      `SELECT id, nome FROM pre_cadastros
        WHERE LOWER(matricula) = LOWER(?) AND deletado_em IS NULL AND id != ?`,
      [matriculaNova, atual.id]
    );
    if (conflitoMatricula) {
      return res.status(409).json({
        codigo: 'MATRICULA_JA_CADASTRADA',
        message: `A matrícula ${matriculaNova} já pertence ao cadastro de ${conflitoMatricula.nome}.`
      });
    }

    const cpfNormalizado = cpf ? String(cpf).replace(/\D/g, '') : '';
    if (cpfNormalizado) {
      const conflitoCpf = await getAsync<{ id: number; nome: string }>(
        `SELECT id, nome FROM pre_cadastros
          WHERE REGEXP_REPLACE(COALESCE(cpf, ''), '[^0-9]', '', 'g') = ?
            AND deletado_em IS NULL AND id != ?`,
        [cpfNormalizado, atual.id]
      );
      if (conflitoCpf) {
        return res.status(409).json({
          codigo: 'CPF_JA_CADASTRADO',
          message: `Este CPF já pertence ao cadastro de ${conflitoCpf.nome}.`
        });
      }
    }

    await runAsync(
      `UPDATE pre_cadastros
          SET nome = ?, email = ?, matricula = ?, cpf = ?, telefone = ?, curso = ?, turma = ?,
              periodo = ?, atualizado_em = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [
        nome,
        emailNovo,
        matriculaNova,
        cpf || null,
        telefone || null,
        curso,
        turma || null,
        periodo || null,
        atual.id
      ]
    );

    // Sem provedor de e-mail configurado, zerar a validação trancaria o aluno
    // fora sem link para clicar — nesse caso a conta segue liberada.
    const revalidar = emailMudou && emailConfigurado();
    let linkEnviado = false;

    if (atual.usuario_id) {
      await runAsync(
        `UPDATE usuarios
            SET nome = ?, email = ?,
                email_verificado_em = ${revalidar ? 'NULL' : 'email_verificado_em'},
                atualizado_em = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [nome, emailNovo, atual.usuario_id]
      );

      if (revalidar) {
        try {
          linkEnviado = await enviarLinkVerificacao(atual.usuario_id, nome, emailNovo);
        } catch (erroEnvio) {
          console.error('Falha ao enviar validação após correção de e-mail:', erroEnvio);
        }
      }
    }

    await logAudit(req.user?.id || null, 'EDITAR_PRE_CADASTRO', 'pre_cadastros', String(atual.id), {
      emailAnterior: atual.email,
      emailNovo,
      emailMudou
    });

    return res.json({
      revalidacaoPendente: revalidar,
      linkEnviado,
      message: revalidar
        ? linkEnviado
          ? `Cadastro atualizado. Enviamos um novo link de validação para ${emailNovo}.`
          : `Cadastro atualizado, mas o e-mail de validação não saiu. Use "Reenviar" na tela de login ou tente de novo.`
        : 'Cadastro atualizado com sucesso.'
    });
  } catch (err) {
    console.error('Erro ao atualizar cadastro de estudante:', err);
    return res.status(500).json({ message: 'Erro ao atualizar o cadastro.' });
  }
}

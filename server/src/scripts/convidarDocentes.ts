/**
 * Migra contas de docente para o e-mail institucional real e envia o convite de
 * primeiro acesso.
 *
 * Para cada conta: troca o e-mail, sorteia uma senha que ninguém conhece, zera a
 * validação (o endereço novo ainda não foi provado) e envia um link de 7 dias
 * para o docente definir a própria senha — clicar nele também valida o e-mail.
 *
 * A lista NÃO fica no repositório: são dados pessoais de terceiros e este repo é
 * público. Passe o caminho de um arquivo texto, uma conta por linha:
 *
 *     email_atual_no_portal ; email_institucional_novo
 *     # linhas começando com # são ignoradas
 *
 * Uso:
 *   npx tsx src/scripts/convidarDocentes.ts ../lista.txt --dry-run
 *   npx tsx src/scripts/convidarDocentes.ts ../lista.txt
 *
 * Sempre rode com --dry-run primeiro: ele mostra exatamente o que faria, sem
 * tocar no banco nem enviar nada.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getAsync, runAsync } from '../config/db';
import { APP_URL, emailConfigurado, enviarEmail, montarEmailPrimeiroAcesso } from '../services/email';
import { VALIDADE_MINUTOS, emitirToken } from '../services/tokens';
import { logAudit } from '../services/audit';

interface Linha {
  emailAtual: string;
  emailNovo: string;
}

function lerLista(caminho: string): Linha[] {
  const bruto = fs.readFileSync(caminho, 'utf8');
  const linhas: Linha[] = [];

  bruto.split(/\r?\n/).forEach((linha, i) => {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith('#')) return;

    const partes = limpa.split(';').map((p) => p.trim());
    if (partes.length !== 2 || !partes[0].includes('@') || !partes[1].includes('@')) {
      throw new Error(`Linha ${i + 1} inválida: esperado "email_atual ; email_novo" — recebi "${limpa}"`);
    }
    linhas.push({ emailAtual: partes[0], emailNovo: partes[1] });
  });

  return linhas;
}

async function main() {
  const caminho = process.argv[2];
  const simulacao = process.argv.includes('--dry-run');

  if (!caminho) throw new Error('Informe o arquivo com a lista: npx tsx src/scripts/convidarDocentes.ts <arquivo>');
  const absoluto = path.resolve(caminho);
  if (!fs.existsSync(absoluto)) throw new Error(`Arquivo não encontrado: ${absoluto}`);

  if (!simulacao && !emailConfigurado()) {
    throw new Error('Envio de e-mail não configurado — o convite não sairia. Defina EMAIL_API_KEY e EMAIL_FROM.');
  }

  const lista = lerLista(absoluto);
  console.log(`${lista.length} conta(s) na lista${simulacao ? ' — SIMULAÇÃO, nada será alterado' : ''}`);
  console.log(`Links apontando para ${APP_URL}`);
  console.log('');

  let convidados = 0;
  const problemas: string[] = [];

  for (const { emailAtual, emailNovo } of lista) {
    const conta = await getAsync<{ id: number; nome: string; email: string; perfil: string }>(
      `SELECT u.id, u.nome, u.email, p.nome as perfil
         FROM usuarios u JOIN perfis p ON u.perfil_id = p.id
        WHERE LOWER(u.email) = LOWER(?) AND u.deletado_em IS NULL`,
      [emailAtual]
    );

    if (!conta) {
      problemas.push(`${emailAtual}: nenhuma conta com este e-mail`);
      continue;
    }
    if (conta.perfil !== 'PROFESSOR') {
      problemas.push(`${emailAtual}: perfil ${conta.perfil}, não PROFESSOR — ignorado por segurança`);
      continue;
    }

    // O e-mail novo não pode pertencer a outra conta: seria um convite para
    // alguém definir senha na conta de um terceiro.
    const ocupado = await getAsync<{ id: number; email: string }>(
      'SELECT id, email FROM usuarios WHERE LOWER(email) = LOWER(?) AND id != ?',
      [emailNovo, conta.id]
    );
    if (ocupado) {
      problemas.push(`${emailNovo}: já pertence à conta #${ocupado.id} — ignorado`);
      continue;
    }

    if (simulacao) {
      console.log(`[simulado] ${conta.nome}: ${conta.email} -> ${emailNovo}`);
      convidados++;
      continue;
    }

    const senhaAleatoria = crypto.randomBytes(24).toString('base64url');
    await runAsync(
      `UPDATE usuarios
          SET email = ?, senha_hash = ?, email_verificado_em = NULL, atualizado_em = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [emailNovo, await bcrypt.hash(senhaAleatoria, 10), conta.id]
    );

    const token = await emitirToken(conta.id, 'PRIMEIRO_ACESSO');
    const link = `${APP_URL}/#/redefinir-senha?token=${token}`;
    const dias = Math.round(VALIDADE_MINUTOS.PRIMEIRO_ACESSO / (60 * 24));

    try {
      await enviarEmail({ ...montarEmailPrimeiroAcesso(conta.nome, link, dias), para: emailNovo });
      convidados++;
      console.log(`OK  ${conta.nome}: ${conta.email} -> ${emailNovo}`);
    } catch (erro: any) {
      // O e-mail já foi trocado no banco; só o envio falhou. O docente ainda
      // entra por "Esqueci minha senha", que agora chega no endereço real.
      problemas.push(`${emailNovo}: e-mail atualizado, mas o convite não saiu (${erro.message})`);
    }

    await logAudit(null, 'MIGRAR_EMAIL_DOCENTE', 'usuarios', String(conta.id), {
      emailAnterior: conta.email,
      emailNovo
    });
  }

  console.log('');
  console.log(`${convidados} de ${lista.length} ${simulacao ? 'seriam convidados' : 'convidados'}.`);
  if (problemas.length) {
    console.log('');
    console.log('Pendências:');
    problemas.forEach((p) => console.log(`  - ${p}`));
  }
}

main()
  .catch((err) => {
    console.error(`FALHOU: ${err.message || err}`);
    process.exitCode = 1;
  })
  .finally(() => process.exit());

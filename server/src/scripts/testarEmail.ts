/**
 * Testa o envio real de e-mail com as credenciais configuradas, sem precisar
 * criar cadastro nem mexer no banco.
 *
 * Uso:
 *   npx tsx src/scripts/testarEmail.ts seu.email@dominio.com
 *   npx tsx src/scripts/testarEmail.ts seu.email@dominio.com recuperacao
 *
 * O segundo argumento escolhe o modelo: 'verificacao' (padrão) ou 'recuperacao'.
 * Os links apontam para APP_URL com um token de exemplo — servem para conferir
 * a aparência da mensagem e se ela chega, não para validar nada de verdade.
 */
import {
  APP_URL,
  emailConfigurado,
  enviarEmail,
  montarEmailRecuperacao,
  montarEmailVerificacao,
  motivoEmailIndisponivel
} from '../services/email';

async function main() {
  const destino = process.argv[2];
  const modelo = (process.argv[3] || 'verificacao').toLowerCase();

  if (!destino || !destino.includes('@')) {
    throw new Error('Informe o e-mail de destino: npx tsx src/scripts/testarEmail.ts voce@dominio.com');
  }

  if (!emailConfigurado()) {
    throw new Error(
      `Envio não configurado (${motivoEmailIndisponivel()}). Defina EMAIL_PROVIDER, EMAIL_API_KEY ` +
        'e EMAIL_FROM no .env antes de testar.'
    );
  }

  console.log(`Provedor: ${process.env.EMAIL_PROVIDER || 'resend'}`);
  console.log(`Remetente: ${process.env.EMAIL_FROM}`);
  console.log(`APP_URL (base dos links): ${APP_URL}`);
  console.log(`Modelo: ${modelo}`);
  console.log(`Enviando para ${destino}...`);

  const linkExemplo = `${APP_URL}/#/${
    modelo === 'recuperacao' ? 'redefinir-senha' : 'verificar-email'
  }?token=TOKEN_DE_EXEMPLO_SEM_VALIDADE`;

  const msg =
    modelo === 'recuperacao'
      ? montarEmailRecuperacao('Estudante de Teste', linkExemplo, 60)
      : montarEmailVerificacao('Estudante de Teste', linkExemplo, 48);

  await enviarEmail({ ...msg, para: destino });

  console.log('OK: o provedor aceitou a mensagem.');
  console.log('Confira a caixa de entrada e o spam. Se não chegar, veja os logs do provedor.');
}

main()
  .catch((err) => {
    console.error(`FALHOU: ${err.message || err}`);
    process.exitCode = 1;
  })
  .finally(() => process.exit());

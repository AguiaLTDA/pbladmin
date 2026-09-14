/**
 * Aplica schema.sql (CREATE TABLE IF NOT EXISTS) e as migrações incrementais
 * (runMigrations) direto no banco configurado em .env, sem depender de reiniciar
 * o servidor. Idempotente — seguro rodar quantas vezes precisar.
 *
 * Uso: npx tsx src/scripts/aplicarMigracoes.ts
 */
import { initAndSeedDb } from '../db/seed';
import { runMigrations } from '../db/migrate';

async function main() {
  await initAndSeedDb();
  await runMigrations();
  console.log('OK: schema.sql e migrações aplicados.');
}

main()
  .catch((err) => {
    console.error('Erro ao aplicar migrações:', err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());

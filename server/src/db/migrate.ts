import { runAsync } from '../config/db';

// schema.sql já cria as tabelas no formato final; o único ajuste que não dá para expressar
// em CREATE TABLE IF NOT EXISTS é este índice único (parte da chave depende de COALESCE).
export async function runMigrations() {
  await runAsync(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_vinculo_prof_unico
       ON vinculos_professores (usuario_id, turma_id, COALESCE(disciplina_id, 0))`
  );
}

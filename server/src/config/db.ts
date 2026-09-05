import dotenv from 'dotenv';
import { Pool } from 'pg';

// Garante que as env vars já estejam carregadas mesmo se este módulo for importado
// (via a cadeia de rotas/controllers) antes do dotenv.config() de app.ts rodar.
dotenv.config();

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.on('connect', () => {
  console.log('Connected to Supabase (Postgres) database at:', process.env.DB_HOST);
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client:', err.message);
});

// SQLite queries in this codebase use positional `?` placeholders; Postgres needs `$1, $2, ...`.
const toPgPlaceholders = (sql: string): string => {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
};

export const queryAsync = async <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
  const result = await pool.query(toPgPlaceholders(sql), params);
  return result.rows as T[];
};

export const getAsync = async <T = any>(sql: string, params: any[] = []): Promise<T | undefined> => {
  const result = await pool.query(toPgPlaceholders(sql), params);
  return (result.rows[0] as T) || undefined;
};

// SQLite's `run()` exposes the auto-generated id via `this.lastID`; Postgres needs
// an explicit `RETURNING id` to get it back, added here so call sites stay unchanged.
export const runAsync = async (sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> => {
  const isInsert = /^\s*insert\b/i.test(sql) && !/\breturning\b/i.test(sql);
  const text = toPgPlaceholders(sql) + (isInsert ? ' RETURNING id' : '');
  const result = await pool.query(text, params);
  return {
    lastID: isInsert && result.rows[0] ? result.rows[0].id : 0,
    changes: result.rowCount ?? 0,
  };
};

// Used only for multi-statement DDL scripts (schema.sql) with no parameters, which
// Postgres executes over the simple query protocol when called with a bare string.
export const execAsync = async (sql: string): Promise<void> => {
  await pool.query(sql);
};

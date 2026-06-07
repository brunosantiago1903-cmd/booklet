import postgres from "postgres";

/**
 * Conexão única com o Postgres (pool). Usa DATABASE_URL.
 * Ex.: postgres://postgres:senha@db:5432/gestao
 */
const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

export const sql =
  globalForDb.sql ??
  postgres(process.env.DATABASE_URL!, {
    max: 10,
    idle_timeout: 20,
  });

if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;

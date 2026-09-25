import pg from "pg";

const { Pool } = pg;

// Singleton pool instance
let pool: pg.Pool | null = null;

export function getDbPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env["DATABASE_URL"];
    if (!connectionString) {
      console.warn("[DB] Warning: DATABASE_URL is not set. Database queries will fail until DATABASE_URL is configured.");
    }
    pool = new Pool({
      connectionString,
      ssl: connectionString?.includes("localhost") ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const db = getDbPool();
  return db.query<T>(text, params);
}

import pg from "pg";
import type { Config } from "./config.ts";

export function createPool({ config }: { config: Config }): pg.Pool {
  const pool = new pg.Pool({ connectionString: config.databaseUrl, connectionTimeoutMillis: 3000 });
  pool.on("error", (error) => {
    console.error(`Database connection error: ${error.message}`);
  });
  return pool;
}

export async function transaction<T>(pool: pg.Pool, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

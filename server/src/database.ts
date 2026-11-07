import pg from "pg";
import type { Config } from "./container.ts";

export function createPool({ config }: { config: Config }): pg.Pool {
  const pool = new pg.Pool({ connectionString: config.databaseUrl, connectionTimeoutMillis: 3000 });
  pool.on("error", (error) => {
    console.error(`Database connection error: ${error.message}`);
  });
  return pool;
}

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type pg from "pg";

export const migrationsDirectory = fileURLToPath(new URL("../migrations", import.meta.url));

export async function migrate(pool: pg.Pool, directory: string): Promise<string[]> {
  await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const { rows } = await pool.query<{ name: string }>("SELECT name FROM schema_migrations");
  const applied = new Set(rows.map((row) => row.name));
  const pending = (await readdir(directory)).filter((name) => name.endsWith(".sql") && !applied.has(name)).sort();
  for (const name of pending) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(await readFile(join(directory, name), "utf8"));
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  return pending;
}

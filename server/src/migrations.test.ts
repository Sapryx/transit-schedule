import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrate } from "./migrations.ts";
import { useTestServer } from "./testing/testServer.ts";

describe("migrate", () => {
  const server = useTestServer();

  it("applies pending migrations in order and skips applied ones on re-run", async () => {
    const { pool } = server.container.cradle;
    const directory = await mkdtemp(join(tmpdir(), "migrations-"));
    await writeFile(join(directory, "0002_insert.sql"), "INSERT INTO probe (value) VALUES ('second');");
    await writeFile(join(directory, "0001_create.sql"), "CREATE TABLE probe (id serial PRIMARY KEY, value text);");
    await writeFile(join(directory, "notes.txt"), "not a migration");

    expect(await migrate(pool, directory)).toEqual(["0001_create.sql", "0002_insert.sql"]);
    expect(await migrate(pool, directory)).toEqual([]);

    const { rows } = await pool.query("SELECT value FROM probe");
    expect(rows).toEqual([{ value: "second" }]);
  });
});

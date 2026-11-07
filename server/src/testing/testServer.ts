import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { AwilixContainer } from "awilix";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { buildContainer, type Cradle } from "../container.ts";
import { migrate, migrationsDirectory } from "../migrations.ts";

export interface TestServer {
  container: AwilixContainer<Cradle>;
  databaseUrl: string;
}

export function useTestServer(): TestServer {
  let database: StartedPostgreSqlContainer;
  const server = {} as TestServer;

  beforeAll(async () => {
    database = await new PostgreSqlContainer("postgres:18-alpine").start();
    server.databaseUrl = database.getConnectionUri();
    const container = buildContainer({ port: 0, databaseUrl: server.databaseUrl });
    await migrate(container.cradle.pool, migrationsDirectory);
    await container.dispose();
  }, 120_000);

  beforeEach(async () => {
    server.container = buildContainer({ port: 0, databaseUrl: server.databaseUrl });
    await server.container.cradle.pool.query(`
      DO $$
      DECLARE tables text;
      BEGIN
        SELECT string_agg(format('%I', tablename), ', ') INTO tables
        FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations';
        IF tables IS NOT NULL THEN
          EXECUTE 'TRUNCATE ' || tables || ' RESTART IDENTITY CASCADE';
        END IF;
      END $$`);
  });

  afterEach(async () => {
    await server.container.dispose();
  });

  afterAll(async () => {
    await database?.stop();
  });

  return server;
}

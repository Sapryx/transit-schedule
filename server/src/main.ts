import { buildContainer } from "./container.ts";
import { migrate, migrationsDirectory } from "./migrations.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}
const container = buildContainer({ port: Number(process.env.PORT ?? 3000), databaseUrl });
const { app, config, pool } = container.cradle;
const applied = await migrate(pool, migrationsDirectory);
console.log(`Applied ${applied.length} migration(s)`);
app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});

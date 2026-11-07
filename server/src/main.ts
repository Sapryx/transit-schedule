import { readConfig } from "./config.ts";
import { buildContainer } from "./container.ts";
import { migrate, migrationsDirectory } from "./migrations.ts";

const container = buildContainer(readConfig(process.env));
const { app, config, pool, networkSync } = container.cradle;
const applied = await migrate(pool, migrationsDirectory);
console.log(`Applied ${applied.length} migration(s)`);
app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
  void networkSync.syncIfEmpty();
});

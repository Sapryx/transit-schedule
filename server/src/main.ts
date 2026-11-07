import { readConfig } from "./config.ts";
import { buildContainer } from "./container.ts";

const container = buildContainer(readConfig(process.env));
const { app, config } = container.cradle;
app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});

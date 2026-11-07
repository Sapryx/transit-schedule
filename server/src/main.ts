import { buildContainer } from "./container.ts";

const container = buildContainer({ port: Number(process.env.PORT ?? 3000) });
const { app, config } = container.cradle;
app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});

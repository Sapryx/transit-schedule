import express from "express";
import type { Auth } from "./auth.ts";

export function createApp({ auth }: { auth: Auth }): express.Express {
  const app = express();
  app.use(express.json());
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.post("/api/auth/login", async (req, res) => {
    const session = await auth.signIn(req.body?.login, req.body?.password);
    if (!session) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }
    res.json(session);
  });
  app.use("/api/admin", auth.requireDispatcher);
  return app;
}

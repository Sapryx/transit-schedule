import express from "express";
import type pg from "pg";
import type { Auth } from "./auth.ts";
import type { Calendar } from "./calendar.ts";
import { calendarRoutes } from "./calendarRoutes.ts";

export function createApp({ pool, auth, calendar }: { pool: pg.Pool; auth: Auth; calendar: Calendar }): express.Express {
  const app = express();
  app.use(express.json());
  app.get("/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok", database: "ok" });
    } catch {
      res.status(503).json({ status: "error", database: "unavailable" });
    }
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
  app.use("/api", calendarRoutes(calendar));
  return app;
}

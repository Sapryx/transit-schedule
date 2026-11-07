import express from "express";
import type pg from "pg";

export function createApp({ pool }: { pool: pg.Pool }): express.Express {
  const app = express();
  app.get("/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok", database: "ok" });
    } catch {
      res.status(503).json({ status: "error", database: "unavailable" });
    }
  });
  return app;
}

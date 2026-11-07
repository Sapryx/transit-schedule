import express from "express";
import type { NetworkAdmin } from "./networkAdmin.ts";

const isId = (value: string) => /^[1-9]\d{0,8}$/.test(value);

export function networkAdminRoutes(networkAdmin: NetworkAdmin): express.Router {
  const router = express.Router();

  router.get("/routes", async (_req, res) => {
    res.json(await networkAdmin.routes());
  });

  router.get("/routes/:id", async (req, res) => {
    const route = isId(req.params.id) ? await networkAdmin.route(Number(req.params.id)) : null;
    if (!route) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(route);
  });

  return router;
}

import express from "express";
import type { Deletable, NetworkAdmin, Outcome } from "./networkAdmin.ts";

const isId = (value: string) => /^[1-9]\d{0,8}$/.test(value);

const statuses: Record<Outcome, number> = { done: 204, not_found: 404, not_missing_from_osm: 409, stop_in_use: 409 };

function reply(res: express.Response, outcome: Outcome) {
  if (outcome === "done") {
    res.status(204).end();
    return;
  }
  res.status(statuses[outcome]).json({ error: outcome });
}

export function networkAdminRoutes(networkAdmin: NetworkAdmin): express.Router {
  const router = express.Router();

  router.get("/routes", async (_req, res) => {
    res.json(await networkAdmin.routes());
  });

  router.get("/routes/:id", async (req, res) => {
    const route = isId(req.params.id) ? await networkAdmin.route(Number(req.params.id)) : null;
    if (!route) {
      reply(res, "not_found");
      return;
    }
    res.json(route);
  });

  router.patch("/routes/:id", async (req, res) => {
    if (!isId(req.params.id)) {
      reply(res, "not_found");
      return;
    }
    const withdrawn = req.body?.withdrawn;
    if (typeof withdrawn !== "boolean") {
      res.status(422).json({ error: "invalid_withdrawn" });
      return;
    }
    reply(res, await networkAdmin.setWithdrawn(Number(req.params.id), withdrawn));
  });

  router.post("/directions/:id/review", async (req, res) => {
    reply(res, isId(req.params.id) ? await networkAdmin.confirmReview(Number(req.params.id)) : "not_found");
  });

  router.get("/stops", async (_req, res) => {
    res.json(await networkAdmin.stops());
  });

  for (const table of ["routes", "directions", "stops"] satisfies Deletable[]) {
    router.delete(`/${table}/:id`, async (req, res) => {
      reply(res, isId(req.params.id) ? await networkAdmin.remove(table, Number(req.params.id)) : "not_found");
    });
  }

  return router;
}

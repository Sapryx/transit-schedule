import express from "express";
import { languages, type Language, type PassengerNetwork } from "./passengerNetwork.ts";
import { isId } from "./routeParams.ts";

function language(req: express.Request, res: express.Response): Language {
  const chosen = (req.acceptsLanguages(...languages) || "en") as Language;
  res.set("Content-Language", chosen);
  return chosen;
}

export function byId<T>(find: (id: number, language: Language) => Promise<T | null>): express.RequestHandler<{ id: string }> {
  return async (req, res) => {
    const chosen = language(req, res);
    const found = isId(req.params.id) ? await find(Number(req.params.id), chosen) : null;
    if (!found) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(found);
  };
}

export function passengerRoutes(passengerNetwork: PassengerNetwork): express.Router {
  const router = express.Router();

  router.get("/routes", async (req, res) => {
    res.json(await passengerNetwork.routes(language(req, res)));
  });

  router.get("/routes/:id", byId(passengerNetwork.route));

  router.get("/stops", async (req, res) => {
    const query = typeof req.query.query === "string" ? req.query.query : "";
    res.json(await passengerNetwork.stops(query, language(req, res)));
  });

  router.get("/stops/:id", byId(passengerNetwork.stop));

  return router;
}

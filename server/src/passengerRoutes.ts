import express from "express";
import { languages, type Language, type PassengerNetwork } from "./passengerNetwork.ts";
import { isId } from "./routeParams.ts";

function language(req: express.Request, res: express.Response): Language {
  const chosen = (req.acceptsLanguages(...languages) || "en") as Language;
  res.set("Content-Language", chosen);
  return chosen;
}

export function passengerRoutes(passengerNetwork: PassengerNetwork): express.Router {
  const router = express.Router();

  router.get("/routes", async (req, res) => {
    res.json(await passengerNetwork.routes(language(req, res)));
  });

  router.get("/routes/:id", async (req, res) => {
    const chosen = language(req, res);
    const route = isId(req.params.id) ? await passengerNetwork.route(Number(req.params.id), chosen) : null;
    if (!route) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(route);
  });

  return router;
}

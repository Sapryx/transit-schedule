import express from "express";
import type { JourneyPlanner } from "./journeyPlanner.ts";
import { languages, type Language, type PassengerNetwork } from "./passengerNetwork.ts";
import { isId, parseDateTime } from "./routeParams.ts";

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

const isStopId = (value: unknown): value is string => typeof value === "string" && isId(value);

export function passengerRoutes(passengerNetwork: PassengerNetwork, journeyPlanner: JourneyPlanner): express.Router {
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

  router.get("/journeys", async (req, res) => {
    const chosen = language(req, res);
    const { from, to, at } = req.query;
    const time = at === undefined ? undefined : parseDateTime(at);
    if (!isStopId(from) || !isStopId(to) || from === to || time === null) {
      res.status(400).json({ error: "invalid_parameters" });
      return;
    }
    const found = await journeyPlanner.journeys(Number(from), Number(to), time, chosen);
    if (!found) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(found);
  });

  return router;
}

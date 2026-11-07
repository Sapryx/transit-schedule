import express from "express";
import { isId } from "./routeParams.ts";
import type { Schedule, ScheduleResult } from "./schedule.ts";

function respond(res: express.Response, result: ScheduleResult<string>) {
  if (result === "ok") {
    res.status(204).end();
    return;
  }
  res.status(result === "not_found" ? 404 : 422).json({ error: result });
}

export function scheduleRoutes(schedule: Schedule): express.Router {
  const router = express.Router();

  router.put("/directions/:id/travel-offsets", async (req, res) => {
    respond(res, isId(req.params.id) ? await schedule.setTravelOffsets(Number(req.params.id), req.body) : "not_found");
  });

  router.put("/directions/:id/departures", async (req, res) => {
    respond(res, isId(req.params.id) ? await schedule.setDepartures(Number(req.params.id), req.body) : "not_found");
  });

  return router;
}

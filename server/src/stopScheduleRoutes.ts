import express from "express";
import { dayTypes } from "./calendar.ts";
import { byId } from "./passengerRoutes.ts";
import { isId, parseDateTime } from "./routeParams.ts";
import type { StopSchedule } from "./stopSchedule.ts";

export function stopScheduleRoutes(stopSchedule: StopSchedule): express.Router {
  const router = express.Router();

  router.get("/stops/:id/schedule", (req, res, next) => {
    const dayType = dayTypes.find((candidate) => candidate === req.query.dayType);
    if (!dayType) {
      res.status(422).json({ error: "invalid_day_type" });
      return;
    }
    return byId((id, language) => stopSchedule.schedule(id, dayType, language))(req, res, next);
  });

  router.get("/stops/:id/upcoming", (req, res, next) => {
    const { at, limit = "10" } = req.query;
    const time = at === undefined ? undefined : parseDateTime(at);
    if (time === null || typeof limit !== "string" || !isId(limit)) {
      res.status(400).json({ error: "invalid_parameters" });
      return;
    }
    return byId((id, language) => stopSchedule.upcoming(id, time, Number(limit), language))(req, res, next);
  });

  return router;
}

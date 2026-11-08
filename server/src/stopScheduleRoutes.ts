import express from "express";
import { dayTypes } from "./calendar.ts";
import { byId } from "./passengerRoutes.ts";
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

  return router;
}

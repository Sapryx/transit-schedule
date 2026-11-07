import express from "express";
import { isDate, type Calendar } from "./calendar.ts";

function invalidDate(res: express.Response) {
  res.status(422).json({ error: "invalid_date" });
}

export function dayTypeRoutes(calendar: Calendar): express.Router {
  const router = express.Router();

  router.get("/calendar/day-type", async (req, res) => {
    const date = req.query.date ?? calendar.today();
    if (!isDate(date)) {
      invalidDate(res);
      return;
    }
    res.json(await calendar.dayInfo(date));
  });

  return router;
}

export function holidayRoutes(calendar: Calendar): express.Router {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const dates = await calendar.holidays(req.query.past === "true");
    res.json(dates.map((date) => ({ date })));
  });

  router.post("/", async (req, res) => {
    const date = req.body?.date;
    if (!isDate(date)) {
      invalidDate(res);
      return;
    }
    if (!(await calendar.addHoliday(date))) {
      res.status(409).json({ error: "duplicate_date" });
      return;
    }
    res.status(201).json({ date });
  });

  router.delete("/:date", async (req, res) => {
    const { date } = req.params;
    if (!isDate(date)) {
      invalidDate(res);
      return;
    }
    if (!(await calendar.removeHoliday(date))) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.status(204).end();
  });

  return router;
}

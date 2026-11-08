import express from "express";
import type pg from "pg";
import type { Auth } from "./auth.ts";
import type { Calendar } from "./calendar.ts";
import { dayTypeRoutes, holidayRoutes } from "./calendarRoutes.ts";
import type { NetworkAdmin } from "./networkAdmin.ts";
import { networkAdminRoutes } from "./networkAdminRoutes.ts";
import { SyncError, type NetworkSync } from "./osm/networkSync.ts";
import type { PassengerNetwork } from "./passengerNetwork.ts";
import { passengerRoutes } from "./passengerRoutes.ts";
import type { Schedule } from "./schedule.ts";
import { scheduleRoutes } from "./scheduleRoutes.ts";

export function createApp({
  pool,
  auth,
  calendar,
  networkSync,
  networkAdmin,
  schedule,
  passengerNetwork,
}: {
  pool: pg.Pool;
  auth: Auth;
  calendar: Calendar;
  networkSync: NetworkSync;
  networkAdmin: NetworkAdmin;
  schedule: Schedule;
  passengerNetwork: PassengerNetwork;
}): express.Express {
  const app = express();
  app.use(express.json());
  app.get("/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok", database: "ok" });
    } catch {
      res.status(503).json({ status: "error", database: "unavailable" });
    }
  });
  app.post("/api/auth/login", async (req, res) => {
    const session = await auth.signIn(req.body?.login, req.body?.password);
    if (!session) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }
    res.json(session);
  });
  app.use("/api/admin", auth.requireDispatcher);
  app.post("/api/admin/osm-sync", async (_req, res) => {
    try {
      res.json(await networkSync.run());
    } catch (error) {
      if (!(error instanceof SyncError)) {
        throw error;
      }
      res.status(error.code === "sync_in_progress" ? 409 : 502).json({ error: error.code });
    }
  });
  app.use("/api/admin/holidays", holidayRoutes(calendar));
  app.use("/api/admin", networkAdminRoutes(networkAdmin));
  app.use("/api/admin", scheduleRoutes(schedule));
  app.use("/api", dayTypeRoutes(calendar));
  app.use("/api", passengerRoutes(passengerNetwork));
  return app;
}

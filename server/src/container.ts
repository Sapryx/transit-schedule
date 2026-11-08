import { asFunction, asValue, createContainer, InjectionMode } from "awilix";
import type express from "express";
import type pg from "pg";
import { createApp } from "./app.ts";
import { createAuth, type Auth } from "./auth.ts";
import { createCalendar, type Calendar } from "./calendar.ts";
import { createSystemClock, type Clock } from "./clock.ts";
import type { Config } from "./config.ts";
import { createPool } from "./database.ts";
import { createJourneyPlanner, type JourneyPlanner } from "./journeyPlanner.ts";
import { createNetworkAdmin, type NetworkAdmin } from "./networkAdmin.ts";
import { createNetworkSync, type NetworkSync } from "./osm/networkSync.ts";
import { createOverpassSource, type OsmSource } from "./osm/osmSource.ts";
import { createPassengerNetwork, type PassengerNetwork } from "./passengerNetwork.ts";
import { createSchedule, type Schedule } from "./schedule.ts";
import { createStopSchedule, type StopSchedule } from "./stopSchedule.ts";

export interface Cradle {
  config: Config;
  clock: Clock;
  pool: pg.Pool;
  auth: Auth;
  osmSource: OsmSource;
  networkSync: NetworkSync;
  networkAdmin: NetworkAdmin;
  schedule: Schedule;
  passengerNetwork: PassengerNetwork;
  journeyPlanner: JourneyPlanner;
  stopSchedule: StopSchedule;
  calendar: Calendar;
  app: express.Express;
}

export function buildContainer(config: Config) {
  const container = createContainer<Cradle>({ injectionMode: InjectionMode.PROXY, strict: true });
  container.register({
    config: asValue(config),
    clock: asFunction(createSystemClock).singleton(),
    pool: asFunction(createPool).singleton().disposer((pool) => pool.end()),
    auth: asFunction(createAuth).singleton(),
    osmSource: asFunction(createOverpassSource).singleton(),
    networkSync: asFunction(createNetworkSync).singleton(),
    networkAdmin: asFunction(createNetworkAdmin).singleton(),
    schedule: asFunction(createSchedule).singleton(),
    passengerNetwork: asFunction(createPassengerNetwork).singleton(),
    journeyPlanner: asFunction(createJourneyPlanner).singleton(),
    stopSchedule: asFunction(createStopSchedule).singleton(),
    calendar: asFunction(createCalendar).singleton(),
    app: asFunction(createApp).singleton(),
  });
  return container;
}

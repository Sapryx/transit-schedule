import { asFunction, asValue, createContainer, InjectionMode } from "awilix";
import type express from "express";
import type pg from "pg";
import { createApp } from "./app.ts";
import { createAuth, type Auth } from "./auth.ts";
import { createSystemClock, type Clock } from "./clock.ts";
import type { Config } from "./config.ts";
import { createPool } from "./database.ts";

export interface Cradle {
  config: Config;
  clock: Clock;
  pool: pg.Pool;
  auth: Auth;
  app: express.Express;
}

export function buildContainer(config: Config) {
  const container = createContainer<Cradle>({ injectionMode: InjectionMode.PROXY, strict: true });
  container.register({
    config: asValue(config),
    clock: asFunction(createSystemClock).singleton(),
    pool: asFunction(createPool).singleton().disposer((pool) => pool.end()),
    auth: asFunction(createAuth).singleton(),
    app: asFunction(createApp).singleton(),
  });
  return container;
}

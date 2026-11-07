import { asFunction, asValue, createContainer, InjectionMode } from "awilix";
import type express from "express";
import type pg from "pg";
import { createApp } from "./app.ts";
import { createPool } from "./database.ts";

export interface Config {
  port: number;
  databaseUrl: string;
}

export interface Clock {
  now(): Date;
}

export interface Cradle {
  config: Config;
  clock: Clock;
  pool: pg.Pool;
  app: express.Express;
}

export function buildContainer(config: Config) {
  const container = createContainer<Cradle>({ injectionMode: InjectionMode.PROXY, strict: true });
  container.register({
    config: asValue(config),
    clock: asValue({ now: () => new Date() }),
    pool: asFunction(createPool).singleton().disposer((pool) => pool.end()),
    app: asFunction(createApp).singleton(),
  });
  return container;
}

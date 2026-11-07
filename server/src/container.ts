import { asFunction, asValue, createContainer, InjectionMode } from "awilix";
import type express from "express";
import { createApp } from "./app.ts";
import { createAuth, type Auth } from "./auth.ts";
import { createSystemClock, type Clock } from "./clock.ts";
import type { Config } from "./config.ts";

export interface Cradle {
  config: Config;
  clock: Clock;
  auth: Auth;
  app: express.Express;
}

export function buildContainer(config: Config) {
  const container = createContainer<Cradle>({ injectionMode: InjectionMode.PROXY, strict: true });
  container.register({
    config: asValue(config),
    clock: asFunction(createSystemClock).singleton(),
    auth: asFunction(createAuth).singleton(),
    app: asFunction(createApp).singleton(),
  });
  return container;
}

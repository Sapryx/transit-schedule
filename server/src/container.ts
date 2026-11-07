import { asFunction, asValue, createContainer, InjectionMode } from "awilix";
import type express from "express";
import { createApp } from "./app.ts";

export interface Config {
  port: number;
}

export interface Cradle {
  config: Config;
  app: express.Express;
}

export function buildContainer(config: Config) {
  const container = createContainer<Cradle>({ injectionMode: InjectionMode.PROXY, strict: true });
  container.register({
    config: asValue(config),
    app: asFunction(createApp).singleton(),
  });
  return container;
}

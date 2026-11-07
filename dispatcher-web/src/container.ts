import { asFunction, asValue, createContainer, InjectionMode } from "awilix";
import type { i18n } from "i18next";
import { createI18n } from "./i18n.ts";

export interface Config {
  apiBaseUrl: string;
  language: string;
}

export interface Cradle {
  config: Config;
  i18n: i18n;
}

export function buildContainer(config: Config) {
  const container = createContainer<Cradle>({ injectionMode: InjectionMode.PROXY, strict: true });
  container.register({
    config: asValue(config),
    i18n: asFunction(({ config }: Cradle) => createI18n(config.language)).singleton(),
  });
  return container;
}

export type AppContainer = ReturnType<typeof buildContainer>;
